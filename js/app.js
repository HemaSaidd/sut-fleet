/**
 * UniFleet Safety - Application Logic & State Controller
 * جامعة السويدي للتكنولوجيا (Elsewedy University of Technology - SUT)
 */

// Application State Store
const AppState = {
  currentView: 'operations-center',
  selectedBusId: '101', // Default: خط العاشر 1
  selectedViolationCodes: ['PHONE_USAGE'],
  currentIncidents: [...FLEET_DATA.initialIncidents],
  activeFilter: 'ALL',
  searchQuery: '',
  selectedIncidentId: 'SUT-1',
  audioAlertsEnabled: true,
  audioContext: null,
  simulatedAttachedImage: null,
  stickerSelectedBusId: '101',
  systemHost: FLEET_DATA.university.defaultHost,
  isLiveConnected: false
};

// ==========================================
// INITIALIZATION ON DOM LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initStudentViolationsGrid();
  updateStudentBusHeader();
  renderIncidentsList();
  renderSelectedIncidentDetails(AppState.selectedIncidentId);
  renderVendorsTable();
  renderViolationBreakdown();
  initStickerGenerator();
  updateKpiSummary();

  // Connect to Live Realtime Backend (Cloud Firebase or Local SQLite)
  if (!initFirebaseIfEnabled()) {
    loadIncidentsFromBackend();
    initRealtimeStream();
  }

  // Check URL parameters: if student scan, redirect to standalone report.html
  const urlParams = new URLSearchParams(window.location.search);
  const busParam = urlParams.get('bus');
  const modeParam = urlParams.get('mode');
  const viewParam = urlParams.get('view');

  if (modeParam === 'student' || busParam) {
    window.location.replace('report.html' + window.location.search);
    return;
  }

  // Admin Flow
  const isAdminAuth = sessionStorage.getItem('sut_admin_authorized') === 'true';
  if (isAdminAuth) {
    document.getElementById('adminLogoutBtn')?.classList.remove('hidden');
    switchMainView(viewParam || 'operations-center');
  } else {
    // Require SUT Fleet PIN 19616 to unlock Operations Center
    AppState.pendingAdminView = viewParam || 'operations-center';
    openAdminPinModal();
  }
});

// ==========================================
// VIEW SWITCHING & SECURITY ACCESS
// ==========================================
function switchMainView(viewId) {
  // Protect admin views with PIN if not authorized
  if (viewId === 'operations-center' || viewId === 'sticker-generator') {
    const isAuth = sessionStorage.getItem('sut_admin_authorized') === 'true';
    if (!isAuth) {
      AppState.pendingAdminView = viewId;
      openAdminPinModal();
      return;
    }
    document.getElementById('adminLogoutBtn')?.classList.remove('hidden');
  }

  AppState.currentView = viewId;

  // Toggle buttons
  document.querySelectorAll('.switcher-btn').forEach(btn => btn.classList.remove('active'));
  if (viewId === 'student-mobile') {
    document.getElementById('tabMobileView')?.classList.add('active');
  } else if (viewId === 'operations-center') {
    document.getElementById('tabDashboardView')?.classList.add('active');
  } else if (viewId === 'sticker-generator') {
    document.getElementById('tabStickerView')?.classList.add('active');
  }

  // Toggle view panels
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active-panel'));
  if (viewId === 'student-mobile') {
    document.getElementById('viewStudentMobile')?.classList.add('active-panel');
  } else if (viewId === 'operations-center') {
    document.getElementById('viewOperationsCenter')?.classList.add('active-panel');
    renderIncidentsList();
    renderSelectedIncidentDetails(AppState.selectedIncidentId);
  } else if (viewId === 'sticker-generator') {
    document.getElementById('viewStickerGenerator')?.classList.add('active-panel');
    updateStickerPreview(AppState.stickerSelectedBusId);
  }
}

// ==========================================
// ADMIN PIN AUTHENTICATION HANDLERS
// ==========================================
function openAdminPinModal() {
  const modal = document.getElementById('adminPinModal');
  const input = document.getElementById('adminPinInput');
  const err = document.getElementById('pinErrorMessage');
  if (err) err.classList.add('hidden');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 150);
  }
  if (modal) modal.classList.remove('hidden');
}

function closeAdminPinModal() {
  const isAuth = sessionStorage.getItem('sut_admin_authorized') === 'true';
  const modal = document.getElementById('adminPinModal');
  if (!isAuth) {
    // If student or unauthorized user closes PIN modal, redirect to report.html
    window.location.replace('report.html');
    return;
  }
  if (modal) modal.classList.add('hidden');
  AppState.pendingAdminView = null;
}

function handleAdminPinSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('adminPinInput');
  const err = document.getElementById('pinErrorMessage');
  const val = input ? input.value.trim() : '';

  // Official SUT Fleet Operations PIN: 19616
  if (val === '19616') {
    sessionStorage.setItem('sut_admin_authorized', 'true');
    const modal = document.getElementById('adminPinModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('student-mode');
    document.getElementById('adminLogoutBtn')?.classList.remove('hidden');
    const target = AppState.pendingAdminView || 'operations-center';
    AppState.pendingAdminView = null;
    switchMainView(target);
  } else {
    if (err) err.classList.remove('hidden');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('sut_admin_authorized');
  document.getElementById('adminLogoutBtn')?.classList.add('hidden');
  AppState.pendingAdminView = 'operations-center';
  openAdminPinModal();
}

// ==========================================
// AUDIO ALERT SYNTHESIZER (Web Audio API)
// ==========================================
function playSafetyAlertChime(severity = 'CRITICAL') {
  if (!AppState.audioAlertsEnabled) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    
    if (!AppState.audioContext) {
      AppState.audioContext = new AudioCtx();
    }
    
    if (AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume();
    }

    const now = AppState.audioContext.currentTime;
    const osc = AppState.audioContext.createOscillator();
    const gain = AppState.audioContext.createGain();

    osc.type = severity === 'CRITICAL' ? 'sawtooth' : 'sine';

    if (severity === 'CRITICAL') {
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(587.33, now + 0.15); // D5
      osc.frequency.setValueAtTime(880, now + 0.3); // A5

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else {
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.18); // E5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    osc.connect(gain);
    gain.connect(AppState.audioContext.destination);
  } catch (err) {
    console.warn("Audio synthesis unavailable:", err);
  }
}

function toggleAudioAlerts() {
  AppState.audioAlertsEnabled = !AppState.audioAlertsEnabled;
  const icon = document.getElementById('soundIcon');
  if (icon) {
    icon.textContent = AppState.audioAlertsEnabled ? '🔔' : '🔕';
  }
}

// ==========================================
// VIEW 1: STUDENT MOBILE LOGIC
// ==========================================

function updateStudentBusHeader() {
  const bus = FLEET_DATA.buses.find(b => b.id === AppState.selectedBusId) || FLEET_DATA.buses[0];
  
  const plateEl = document.getElementById('studentBusPlate');
  const lineEl = document.getElementById('studentBusLine');
  const vendorEl = document.getElementById('studentBusVendor');
  const driverEl = document.getElementById('studentDriverName');

  if (plateEl) plateEl.textContent = bus.lineName;
  if (lineEl) lineEl.textContent = bus.lineName;
  if (vendorEl) vendorEl.textContent = "شركة أبو الهول";
  if (driverEl) driverEl.textContent = "";
}

function initStudentViolationsGrid() {
  const grid = document.getElementById('violationsGrid');
  if (!grid) return;

  grid.innerHTML = FLEET_DATA.violationTypes.map(v => {
    const isSelected = AppState.selectedViolationCodes.includes(v.code);
    return `
      <div class="violation-card-radio ${isSelected ? 'selected' : ''}" 
           id="vcard_${v.code}" 
           onclick="toggleViolationCard('${v.code}')">
        <div class="v-card-top">
          <span class="v-icon">${v.icon}</span>
          <span class="v-checkbox-circle">✓</span>
        </div>
        <span class="v-title">${v.title}</span>
        <span class="v-risk-tag">${v.riskLabel}</span>
      </div>
    `;
  }).join('');
}

function toggleViolationCard(code) {
  const idx = AppState.selectedViolationCodes.indexOf(code);
  if (idx > -1) {
    if (AppState.selectedViolationCodes.length > 1) {
      AppState.selectedViolationCodes.splice(idx, 1);
    }
  } else {
    AppState.selectedViolationCodes.push(code);
  }

  // Update UI selection classes
  FLEET_DATA.violationTypes.forEach(v => {
    const el = document.getElementById(`vcard_${v.code}`);
    if (el) {
      if (AppState.selectedViolationCodes.includes(v.code)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    }
  });

  // Suggest severity automatically
  const firstViolation = FLEET_DATA.violationTypes.find(v => v.code === AppState.selectedViolationCodes[0]);
  if (firstViolation) {
    if (firstViolation.defaultSeverity === 'CRITICAL') {
      const radio = document.getElementById('sevCritical');
      if (radio) radio.checked = true;
    } else if (firstViolation.defaultSeverity === 'MEDIUM') {
      const radio = document.getElementById('sevMedium');
      if (radio) radio.checked = true;
    } else {
      const radio = document.getElementById('sevLow');
      if (radio) radio.checked = true;
    }
  }
}

function detectUserLocation() {
  const locInput = document.getElementById('reportLocationInput');
  const btn = document.getElementById('btnGpsAuto');
  if (!locInput) return;

  if (btn) btn.innerHTML = '<span>⏳ جارٍ التحديد...</span>';

  // Realistic locations near Elsewedy University of Technology & transit corridors
  const sampleLocations = [
    "طريق الإسماعيلية الصحراوي - أمام بوابة العاشر من رمضان",
    "طريق بلبيس العاشر - بعد محطة التحصيل باتجاه جامعة السويدي",
    "الطريق الدائري الإقليمي - تقاطع طريق السويس",
    "طريق مصر الإسماعيلية - كوبري العبور اتجاه العاشر",
    "محور 26 يوليو - قبل مطلع الشيخ زايد",
    "طريق بنها - الزقازيق الزراعي أمام مدخل منيا القمح",
    "الطريق الدائري الأوسطي - مدخل التجمع الخامس"
  ];

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const randLoc = sampleLocations[Math.floor(Math.random() * sampleLocations.length)];
        locInput.value = `${randLoc} (GPS حي: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
        if (btn) btn.innerHTML = '<span>📍 تم التحديد بدقة</span>';
      },
      () => {
        const randLoc = sampleLocations[Math.floor(Math.random() * sampleLocations.length)];
        locInput.value = randLoc;
        if (btn) btn.innerHTML = '<span>📍 تم التحديد تلقائياً</span>';
      },
      { timeout: 3000 }
    );
  } else {
    const randLoc = sampleLocations[Math.floor(Math.random() * sampleLocations.length)];
    locInput.value = randLoc;
    if (btn) btn.innerHTML = '<span>📍 تم التحديد تلقائياً</span>';
  }
}

function simulateMediaAttachment() {
  const placeholder = document.getElementById('uploadPlaceholder');
  const preview = document.getElementById('attachedPreview');
  const previewImg = document.getElementById('previewImage');
  const previewName = document.getElementById('previewName');

  const sampleEvidences = [
    {
      name: "driver_mobile_usage.jpg",
      url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80"
    },
    {
      name: "speedometer_115km.jpg",
      url: "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80"
    },
    {
      name: "smoking_incabin.jpg",
      url: "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&auto=format&fit=crop&q=80"
    }
  ];

  const selectedSample = sampleEvidences[Math.floor(Math.random() * sampleEvidences.length)];
  AppState.simulatedAttachedImage = selectedSample.url;

  if (placeholder && preview && previewImg && previewName) {
    placeholder.classList.add('hidden');
    preview.classList.remove('hidden');
    previewImg.src = selectedSample.url;
    previewName.textContent = selectedSample.name;
  }
}

function removeAttachedMedia(event) {
  if (event) event.stopPropagation();
  const placeholder = document.getElementById('uploadPlaceholder');
  const preview = document.getElementById('attachedPreview');
  AppState.simulatedAttachedImage = null;

  if (placeholder && preview) {
    placeholder.classList.remove('hidden');
    preview.classList.add('hidden');
  }
}

function toggleAnonymousMode(isAnon) {
  const fields = document.getElementById('studentContactFields');
  if (fields) {
    fields.style.display = isAnon ? 'none' : 'block';
  }
}

// ==========================================
// REALTIME API & BACKEND INTEGRATION
// ==========================================

let firebaseDb = null;

function initFirebaseIfEnabled() {
  if (FLEET_DATA.firebaseConfig && FLEET_DATA.firebaseConfig.enabled && FLEET_DATA.firebaseConfig.apiKey && typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FLEET_DATA.firebaseConfig);
      }
      firebaseDb = firebase.database();
      console.log("Firebase Realtime Cloud Database Connected!");

      const statusLabel = document.getElementById('serverLiveLabel');
      if (statusLabel) statusLabel.textContent = "مباشر SUT (سحابي Firebase)";
      const statusDot = document.getElementById('serverLiveDot');
      if (statusDot) {
        statusDot.style.background = "#10b981";
        statusDot.classList.add('pulsing');
      }

      let isInitialLoad = true;

      // Seed with initial sample incidents if database is completely empty on first launch
      firebaseDb.ref('incidents').once('value', snapshot => {
        if (!snapshot.exists()) {
          const initialMap = {};
          FLEET_DATA.initialIncidents.forEach(inc => {
            const key = inc.id.replace(/[^a-zA-Z0-9_-]/g, "");
            initialMap[key] = inc;
          });
          firebaseDb.ref('incidents').set(initialMap);
        }
        setTimeout(() => {
          isInitialLoad = false;
        }, 1200);
      });

      // Listen for incoming incidents in real-time
      firebaseDb.ref('incidents').limitToLast(100).on('child_added', (snap) => {
        const item = snap.val();
        if (item && item.id) {
          handleIncomingLiveIncident(item, isInitialLoad);
        }
      });

      firebaseDb.ref('incidents').on('child_changed', (snap) => {
        const item = snap.val();
        if (item && item.id) {
          handleIncomingIncidentUpdate({
            incidentId: item.id,
            status: item.status,
            actionsTaken: item.actionsTaken
          });
        }
      });
      return true;
    } catch (e) {
      console.warn("Firebase Init Error:", e);
    }
  }
  return false;
}

async function loadIncidentsFromBackend() {
  try {
    const res = await fetch('/api/incidents');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && Array.isArray(data.incidents) && data.incidents.length > 0) {
      AppState.currentIncidents = data.incidents;
      AppState.selectedIncidentId = data.incidents[0].id;
      renderIncidentsList();
      renderSelectedIncidentDetails(AppState.selectedIncidentId);
      updateKpiSummary();
    }
  } catch (err) {
    console.log("Using local master dataset (server running locally or offline):", err);
  }

  // Detect Cloudflare Public HTTPS Tunnel
  checkServerHealthAndTunnel();
}

async function checkServerHealthAndTunnel() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (data.publicUrl) {
        applyPublicUrl(data.publicUrl);
      }
    }
  } catch (err) {}
}

function applyPublicUrl(publicUrl) {
  if (!publicUrl) return;
  AppState.systemHost = publicUrl;
  const hostInput = document.getElementById('customHostInput');
  if (hostInput) hostInput.value = publicUrl;

  const statusLabel = document.getElementById('serverLiveLabel');
  if (statusLabel) statusLabel.textContent = "مباشر SUT (4G نشط 🌍)";

  const presetsContainer = document.querySelector('.host-presets');
  if (presetsContainer && !document.getElementById('pillPublicCloudflare')) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'pillPublicCloudflare';
    pill.className = 'preset-pill active';
    pill.textContent = 'رابط 4G المباشر (Cloudflare)';
    pill.onclick = () => setPresetHost(publicUrl);
    presetsContainer.prepend(pill);
  }

  updateStickerPreview(AppState.stickerSelectedBusId);
}

function initRealtimeStream() {
  if (typeof window === 'undefined' || !window.EventSource) return;

  const statusDot = document.getElementById('serverLiveDot');
  const statusLabel = document.getElementById('serverLiveLabel');

  function setLiveStatus(connected) {
    AppState.isLiveConnected = connected;
    if (statusLabel) {
      statusLabel.textContent = connected ? "مباشر SUT (متصل)" : "جاري إعادة الاتصال...";
    }
    if (statusDot) {
      statusDot.style.background = connected ? "#10b981" : "#f59e0b";
      if (connected) {
        statusDot.classList.add('pulsing');
      } else {
        statusDot.classList.remove('pulsing');
      }
    }
  }

  try {
    const evtSource = new EventSource('/api/events');

    evtSource.onopen = () => {
      setLiveStatus(true);
    };

    evtSource.addEventListener('new_incident', (e) => {
      try {
        const incident = JSON.parse(e.data);
        handleIncomingLiveIncident(incident);
      } catch (err) {
        console.error("Failed to parse incoming incident SSE:", err);
      }
    });

    evtSource.addEventListener('incident_updated', (e) => {
      try {
        const updateData = JSON.parse(e.data);
        handleIncomingIncidentUpdate(updateData);
      } catch (err) {
        console.error("Failed to parse incident update SSE:", err);
      }
    });

    evtSource.addEventListener('system_public_url', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.publicUrl) {
          applyPublicUrl(data.publicUrl);
        }
      } catch (err) {
        console.error("Failed to parse public url SSE:", err);
      }
    });

    evtSource.onerror = () => {
      setLiveStatus(false);
    };
  } catch (err) {
    console.warn("Realtime EventSource error:", err);
    setLiveStatus(false);
  }
}

function handleIncomingLiveIncident(incident, isInitialLoad = false) {
  // Prevent duplicate insertion
  if (AppState.currentIncidents.some(i => i.id === incident.id)) {
    return;
  }

  // Prepend new incident to array
  AppState.currentIncidents.unshift(incident);
  AppState.selectedIncidentId = incident.id;

  if (!isInitialLoad) {
    // Sound Chime Alert
    playSafetyAlertChime(incident.severity || 'CRITICAL');

    // Show visual toast notification banner
    showLiveAlertToast(incident);
  }

  // Update UI and KPIs
  updateKpiSummary();
  renderIncidentsList();
  
  if (AppState.currentView === 'operations-center') {
    renderSelectedIncidentDetails(incident.id);
  }

  if (!isInitialLoad) {
    // Mark newly arrived row with glowing flash class
    setTimeout(() => {
      const newCard = document.getElementById(`inc_card_${incident.id}`);
      if (newCard) {
        newCard.classList.add('newly-arrived');
      }
    }, 50);
  }
}

function handleIncomingIncidentUpdate(updateData) {
  const incident = AppState.currentIncidents.find(i => i.id === updateData.incidentId);
  if (incident) {
    incident.status = updateData.status;
    if (updateData.actionsTaken) {
      incident.actionsTaken = updateData.actionsTaken;
    }
    renderIncidentsList();
    if (AppState.selectedIncidentId === updateData.incidentId) {
      renderSelectedIncidentDetails(updateData.incidentId);
    }
    updateKpiSummary();
  }
}

function showLiveAlertToast(incident) {
  const container = document.getElementById('liveToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  let sevClass = 'toast-critical';
  let sevText = 'خطر داهم 🔴';
  if (incident.severity === 'MEDIUM') {
    sevClass = 'toast-medium';
    sevText = 'مخالفة متوسطة 🟠';
  } else if (incident.severity === 'LOW') {
    sevClass = 'toast-low';
    sevText = 'ملاحظة عامة 🔵';
  }

  toast.className = `live-toast ${sevClass}`;
  toast.innerHTML = `
    <div class="toast-icon">${incident.violationIcon || '⚠️'}</div>
    <div class="toast-body">
      <div class="toast-title">
        <span>🚨 بلاغ جديد: ${incident.busPlate || 'باص'} (${incident.lineName || ''})</span>
        <span class="toast-badge">${sevText}</span>
      </div>
      <div class="toast-desc"><strong>${incident.violationTitle}</strong>: ${incident.notes || 'بلاغ وارد من طالب بالجامعة'}</div>
      <div class="toast-meta">📍 ${incident.location} • اضغط هنا للمتابعة الفورية في غرفة العمليات</div>
    </div>
  `;

  toast.onclick = () => {
    switchMainView('operations-center');
    AppState.selectedIncidentId = incident.id;
    renderIncidentsList();
    renderSelectedIncidentDetails(incident.id);
    toast.remove();
  };

  container.appendChild(toast);

  // Auto remove after 9 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.transition = 'opacity 0.4s, transform 0.4s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-40px)';
      setTimeout(() => toast.remove(), 400);
    }
  }, 9000);
}

async function syncIncidentActionToServer(incidentId, status, actionEntry) {
  // Sync to Cloud Firebase if enabled
  if (firebaseDb) {
    try {
      const sanitizedKey = incidentId.replace(/[^a-zA-Z0-9_-]/g, "");
      const updates = { status: status };
      const inc = AppState.currentIncidents.find(i => i.id === incidentId);
      if (inc && inc.actionsTaken) {
        updates.actionsTaken = inc.actionsTaken;
      }
      await firebaseDb.ref('incidents/' + sanitizedKey).update(updates);
    } catch (err) {
      console.warn("Firebase action sync error:", err);
    }
  }

  // Sync to Local Server via HTTP
  try {
    await fetch('/api/incidents/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId: incidentId,
        status: status,
        actionEntry: actionEntry
      })
    });
  } catch (err) {
    console.warn("Could not sync action to server:", err);
  }
}

// Student Submission Handler
async function handleStudentReportSubmit(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('btnSubmitReport');
  const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ جاري إرسال البلاغ لغرفة العمليات...</span>';
  }

  const bus = FLEET_DATA.buses.find(b => b.id === AppState.selectedBusId) || FLEET_DATA.buses[0];
  const firstViolation = FLEET_DATA.violationTypes.find(v => v.code === AppState.selectedViolationCodes[0]) || FLEET_DATA.violationTypes[0];
  
  const sevInput = document.querySelector('input[name="severityLevel"]:checked');
  const severity = sevInput ? sevInput.value : 'CRITICAL';
  
  const location = document.getElementById('reportLocationInput')?.value || "طريق مصر الإسماعيلية الصحراوي أمام العاشر";
  const notes = document.getElementById('reportNotesInput')?.value || "مخالفة واضحة على خط جامعة السويدي تستوجب التنبيه الفوري.";
  
  const isAnonymous = document.getElementById('anonToggle')?.checked || false;
  const studentName = isAnonymous ? "طالب بـ SUT (مجهول)" : (document.getElementById('studentNameInput')?.value || "طالب بجامعة السويدي");
  const studentPhone = isAnonymous ? "" : (document.getElementById('studentPhoneInput')?.value || "01xxxxxxxxx");

  // Generate Sequential SUT Ticket ID: SUT-1, SUT-2, ...
  const nextSeq = (AppState.currentIncidents?.length || 0) + 1;
  const ticketId = `SUT-${nextSeq}`;

  const newIncident = {
    id: ticketId,
    timestamp: "الآن (منذ ثوانٍ)",
    isoDate: new Date().toISOString(),
    busId: bus.id,
    busPlate: `باص ${bus.id}`,
    lineName: bus.lineName,
    vendorId: bus.vendorId,
    vendorName: bus.vendorName,
    driverName: bus.driverName,
    driverPhone: bus.driverPhone,
    violationCode: firstViolation.code,
    violationTitle: firstViolation.title,
    violationIcon: firstViolation.icon,
    severity: severity,
    location: location,
    notes: notes,
    hasAttachment: !!AppState.simulatedAttachedImage,
    attachmentType: AppState.simulatedAttachedImage ? 'image' : null,
    attachmentUrl: AppState.simulatedAttachedImage,
    isAnonymous: isAnonymous,
    studentName: studentName,
    studentPhone: studentPhone,
    status: 'NEW',
    actionsTaken: []
  };

  // 1. Try sending to Cloud Firebase if active
  let savedOnServer = false;
  if (firebaseDb) {
    try {
      const sanitizedKey = ticketId.replace(/[^a-zA-Z0-9_-]/g, "");
      await firebaseDb.ref('incidents/' + sanitizedKey).set(newIncident);
      savedOnServer = true;
    } catch (err) {
      console.warn("Firebase submission error:", err);
    }
  }

  // 2. Try sending to local backend via HTTP POST
  try {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIncident)
    });
    if (res.ok) {
      savedOnServer = true;
    }
  } catch (err) {
    console.warn("Backend unavailable, caching locally:", err);
  }

  // 2. Local Fallback / Direct update if on same browser
  if (!AppState.currentIncidents.some(i => i.id === ticketId)) {
    AppState.currentIncidents.unshift(newIncident);
    AppState.selectedIncidentId = ticketId;
    updateKpiSummary();
    renderIncidentsList();
    renderSelectedIncidentDetails(ticketId);
  }

  // Sound Chime
  playSafetyAlertChime(severity);

  // Restore button state
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHTML;
  }

  // Show Success Modal inside Phone
  const modal = document.getElementById('mobileSuccessModal');
  const ticketSpan = document.getElementById('successTicketId');
  if (ticketSpan) ticketSpan.textContent = ticketId;
  if (modal) modal.classList.remove('hidden');
}

function resetStudentReportForm() {
  const modal = document.getElementById('mobileSuccessModal');
  if (modal) modal.classList.add('hidden');

  const form = document.getElementById('studentReportForm');
  if (form) form.reset();
  removeAttachedMedia();
  AppState.selectedViolationCodes = ['PHONE_USAGE'];
  initStudentViolationsGrid();
  toggleAnonymousMode(false);
}

// Modal: Select Bus (All 23 lines)
function openBusSelectorModal() {
  const modal = document.getElementById('busSelectorModal');
  const list = document.getElementById('modalBusesList');
  if (!modal || !list) return;

  list.innerHTML = FLEET_DATA.buses.map(b => `
    <div class="bus-modal-item" onclick="selectBus('${b.id}')">
      <div>
        <strong style="color:#60a5fa">باص ${b.id}</strong> - <span style="font-weight:700; color:#fff">${b.lineName}</span>
        <div style="font-size:0.75rem; color:#94a3b8">${b.vendorName} • السائق: ${b.driverName}</div>
      </div>
      <button class="btn-location-gps">اختيار الخط</button>
    </div>
  `).join('');

  modal.classList.remove('hidden');
}

function closeBusSelectorModal() {
  const modal = document.getElementById('busSelectorModal');
  if (modal) modal.classList.add('hidden');
}

function selectBus(busId) {
  AppState.selectedBusId = busId;
  AppState.stickerSelectedBusId = busId;
  updateStudentBusHeader();
  closeBusSelectorModal();

  const stickerSelect = document.getElementById('stickerBusSelect');
  if (stickerSelect) stickerSelect.value = busId;
  updateStickerPreview(busId);
}

function simulateRandomIncident() {
  const randomBus = FLEET_DATA.buses[Math.floor(Math.random() * FLEET_DATA.buses.length)];
  const randomViolation = FLEET_DATA.violationTypes[Math.floor(Math.random() * FLEET_DATA.violationTypes.length)];
  
  selectBus(randomBus.id);
  AppState.selectedViolationCodes = [randomViolation.code];
  initStudentViolationsGrid();
  detectUserLocation();
  simulateMediaAttachment();

  const notesEl = document.getElementById('reportNotesInput');
  if (notesEl) {
    notesEl.value = `بلاغ عاجل على ${randomBus.lineName}: رصد ${randomViolation.title} بشكل متكرر أثناء نقل الطلاب.`;
  }
}

// ==========================================
// VIEW 2: OPERATIONS COMMAND CENTER
// ==========================================

function updateKpiSummary() {
  const total = AppState.currentIncidents.length;
  const critical = AppState.currentIncidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').length;

  const countPill = document.getElementById('streamCountPill');
  const activeBadge = document.getElementById('activeIncidentsBadge');
  const kpiIncidents = document.getElementById('kpiTodayIncidents');
  const kpiCritical = document.getElementById('kpiCriticalCount');
  const kpiBuses = document.getElementById('kpiActiveBuses');

  if (countPill) countPill.textContent = `${total} بلاغات`;
  if (activeBadge) activeBadge.textContent = critical;
  if (kpiIncidents) kpiIncidents.textContent = total;
  if (kpiCritical) kpiCritical.textContent = `${critical} حرجة`;
  if (kpiBuses) kpiBuses.textContent = FLEET_DATA.buses.length;
}

function filterIncidents(filterType, btnElement) {
  AppState.activeFilter = filterType;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderIncidentsList();
}

function handleIncidentSearch(query) {
  AppState.searchQuery = query.trim().toLowerCase();
  renderIncidentsList();
}

function renderIncidentsList() {
  const listEl = document.getElementById('incidentsList');
  if (!listEl) return;

  let filtered = AppState.currentIncidents.filter(inc => {
    if (AppState.activeFilter === 'CRITICAL' && inc.severity !== 'CRITICAL') return false;
    if (AppState.activeFilter === 'PENDING' && inc.status === 'RESOLVED') return false;
    if (AppState.activeFilter === 'RESOLVED' && inc.status !== 'RESOLVED') return false;

    if (AppState.searchQuery) {
      const q = AppState.searchQuery;
      const matchBus = inc.busPlate.toLowerCase().includes(q) || inc.busId.includes(q);
      const matchDriver = inc.driverName.toLowerCase().includes(q);
      const matchLine = inc.lineName.toLowerCase().includes(q);
      const matchViolation = inc.violationTitle.toLowerCase().includes(q);
      const matchVendor = inc.vendorName.toLowerCase().includes(q);
      return matchBus || matchDriver || matchLine || matchViolation || matchVendor;
    }

    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding: 2rem 1rem; color:#64748b;">
        <span style="font-size: 2rem; display:block; margin-bottom:0.5rem">🔍</span>
        <p>لا توجد بلاغات تطابق البحث على خطوط جامعة السويدي</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map(inc => {
    const isSelected = inc.id === AppState.selectedIncidentId;
    const sevClass = inc.severity === 'CRITICAL' ? 'crit' : (inc.severity === 'MEDIUM' ? 'med' : 'low');

    let statusBadgeText = "جديد 🔴";
    let statusBadgeClass = "status-new";
    if (inc.status === 'INVESTIGATING') {
      statusBadgeText = "قيد المتابعة 🟡";
      statusBadgeClass = "status-investigating";
    } else if (inc.status === 'FINED') {
      statusBadgeText = "تم تطبيق غرامة 🟣";
      statusBadgeClass = "status-fined";
    } else if (inc.status === 'RESOLVED') {
      statusBadgeText = "تم الحل والتحقق 🟢";
      statusBadgeClass = "status-resolved";
    }

    return `
      <div class="incident-item-card ${sevClass} ${isSelected ? 'selected-incident' : ''}" 
           id="card_${inc.id.replace('#', '').replace('-', '')}"
           onclick="selectIncidentForDetails('${inc.id}')">
        
        <div class="card-top-line">
          <span class="inc-bus-tag">${inc.busPlate} - ${inc.lineName}</span>
          <span class="inc-time">${inc.timestamp}</span>
        </div>

        <div class="card-violation-title">
          <span>${inc.violationIcon}</span>
          <span>${inc.violationTitle}</span>
        </div>

        <div class="card-location-line">
          📍 ${inc.location}
        </div>

        <div class="card-footer-tags">
          <span style="color:#94a3b8">${inc.vendorName}</span>
          <span class="status-badge ${statusBadgeClass}">${statusBadgeText}</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectIncidentForDetails(incidentId) {
  AppState.selectedIncidentId = incidentId;

  document.querySelectorAll('.incident-item-card').forEach(c => c.classList.remove('selected-incident'));
  const card = document.getElementById(`card_${incidentId.replace('#', '').replace('-', '')}`);
  if (card) card.classList.add('selected-incident');

  renderSelectedIncidentDetails(incidentId);
}

function renderSelectedIncidentDetails(incidentId) {
  const emptyState = document.getElementById('emptyWorkspaceState');
  const content = document.getElementById('activeWorkspaceContent');
  if (!content) return;

  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) {
    if (emptyState) emptyState.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  content.classList.remove('hidden');

  let sevBadge = `<span style="background:rgba(239,68,68,0.2); color:#f87171; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px;">خطر حرج 🔴</span>`;
  if (incident.severity === 'MEDIUM') {
    sevBadge = `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px;">مخالفة متوسطة 🟠</span>`;
  } else if (incident.severity === 'LOW') {
    sevBadge = `<span style="background:rgba(59,130,246,0.2); color:#93c5fd; font-size:0.75rem; font-weight:800; padding:2px 8px; border-radius:12px;">ملاحظة عامة 🔵</span>`;
  }

  const actionsLogHTML = incident.actionsTaken.length === 0 
    ? `<p style="font-size:0.75rem; color:#64748b; font-style:italic">لم يتم اتخاذ إجراءات بعد. استخدم الأزرار أدناه للتدخل الفوري من إدارة الحركة بجامعة السويدي.</p>`
    : incident.actionsTaken.map(a => `
        <div style="font-size:0.75rem; margin-bottom:6px; border-right:2px solid #3b82f6; padding-right:8px">
          <strong style="color:#60a5fa">${a.time} - ${a.user}:</strong>
          <span style="color:#cbd5e1">${a.text}</span>
        </div>
      `).join('');

  content.innerHTML = `
    <!-- Top Header -->
    <div class="workspace-header-strip">
      <div class="ws-title-group">
        <h2>
          <span>${incident.violationIcon}</span>
          <span>${incident.violationTitle}</span>
          ${sevBadge}
        </h2>
        <span class="ws-ticket-id">تذكرة رقم: ${incident.id} • ${incident.timestamp}</span>
      </div>
      <div>
        <span class="inc-bus-tag" style="font-size:0.85rem; padding:4px 10px">${incident.busPlate} (${incident.lineName})</span>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="ws-meta-grid">
      <div class="ws-meta-item">
        <span class="label">خط السير المعتمد بـ SUT:</span>
        <span class="val" style="color:#60a5fa">${incident.lineName}</span>
      </div>
      <div class="ws-meta-item">
        <span class="label">السائق المكلف:</span>
        <span class="val">${incident.driverName} (${incident.driverPhone})</span>
      </div>
      <div class="ws-meta-item">
        <span class="label">الشركة المشغلة:</span>
        <span class="val">${incident.vendorName}</span>
      </div>
      <div class="ws-meta-item">
        <span class="label">الموقع وقت الإبلاغ:</span>
        <span class="val" style="color:#93c5fd">📍 ${incident.location}</span>
      </div>
      <div class="ws-meta-item">
        <span class="label">بيانات الطالب المُبلّغ:</span>
        <span class="val">${incident.isAnonymous ? '🔒 بلاغ مجهول الهوية (لحماية الطالب)' : `👤 ${incident.studentName} (${incident.studentPhone})`}</span>
      </div>
      <div class="ws-meta-item">
        <span class="label">حالة التذكرة:</span>
        <span class="val" style="color:#34d399">${incident.status}</span>
      </div>
    </div>

    <!-- Details Split -->
    <div class="ws-content-split">
      <div class="ws-evidence-card">
        <h4>📸 دليل وتوثيق المخالفة:</h4>
        ${incident.hasAttachment && incident.attachmentUrl 
          ? `<img src="${incident.attachmentUrl}" class="evidence-image-preview" alt="دليل المخالفة">`
          : `<div style="height:140px; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#64748b; font-size:0.8rem; border-radius:6px; margin-bottom:8px">لا يوجد ملف مصور مرفق</div>`
        }
        <div class="evidence-notes-text">
          <strong>إفادة الطالب:</strong> "${incident.notes}"
        </div>
      </div>

      <div class="ws-evidence-card">
        <h4>📋 سجل الإجراءات الميدانية (Action Log):</h4>
        <div style="background:rgba(0,0,0,0.3); padding:0.75rem; border-radius:6px; min-height:160px; max-height:190px; overflow-y:auto">
          ${actionsLogHTML}
        </div>
      </div>
    </div>

    <!-- Action Execution Toolbar -->
    <div class="ws-action-bar">
      <div class="action-bar-title">⚡ إجراءات إدارة الحركة بجامعة السويدي للتكنولوجيا:</div>
      <div class="actions-buttons-cluster">
        <button class="act-btn act-call" onclick="triggerDirectDriverCall('${incident.id}')">
          <span>📞 اتصال فوري بالسائق / المشرف</span>
        </button>
        <button class="act-btn act-fine" onclick="triggerContractorFine('${incident.id}')">
          <span>⚖️ توقيع غرامة مالية على المقاول</span>
        </button>
        <button class="act-btn act-replace" onclick="triggerVehicleReplacement('${incident.id}')">
          <span>🔄 طلب استبدال الحافلة / السائق فوراً</span>
        </button>
        <button class="act-btn act-resolve" onclick="triggerResolveIncident('${incident.id}')">
          <span>✓ اعتماد الحل وإغلاق البلاغ</span>
        </button>
      </div>
    </div>
  `;
}

// Action Handlers
function triggerDirectDriverCall(incidentId) {
  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  const confirmed = confirm(`هل تريد الاتصال هاتفياً بالسائق: ${incident.driverName} (${incident.lineName}) على الرقم (${incident.driverPhone}) للتحقيق الميداني؟`);
  if (confirmed) {
    incident.status = 'INVESTIGATING';
    const actionEntry = {
      time: "الآن",
      user: "مسؤول غرفة عمليات SUT",
      text: `تم الاتصال هاتفياً بالسائق (${incident.driverName}) وتنبيهه فوراً ومتابعة سرعة الحافلة.`
    };
    incident.actionsTaken.push(actionEntry);
    syncIncidentActionToServer(incidentId, incident.status, actionEntry);
    renderIncidentsList();
    renderSelectedIncidentDetails(incidentId);
    window.open(`tel:${incident.driverPhone}`);
  }
}

function triggerContractorFine(incidentId) {
  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  const defaultFine = 3000;
  const fineInput = prompt(`أدخل مبلغ الغرامة بالجنيه لخصمه من مستخلص ${incident.vendorName}:`, defaultFine);
  if (fineInput && !isNaN(fineInput)) {
    const fineAmount = parseInt(fineInput, 10);
    incident.status = 'FINED';
    const actionEntry = {
      time: "الآن",
      user: "مدير حركة جامعة السويدي",
      text: `تم توقيع غرامة بقيمة ${fineAmount.toLocaleString()} ج.م على شركة (${incident.vendorName}) لخرق شروط السلامة على ${incident.lineName}.`
    };
    incident.actionsTaken.push(actionEntry);
    syncIncidentActionToServer(incidentId, incident.status, actionEntry);

    const vendor = FLEET_DATA.vendors.find(v => v.id === incident.vendorId);
    if (vendor) {
      vendor.finesTotal += fineAmount;
      vendor.safetyScore = Math.max(65, vendor.safetyScore - 3);
      if (vendor.safetyScore < 85) vendor.status = 'WARNING';
      if (vendor.safetyScore < 75) vendor.status = 'DANGER';
      renderVendorsTable();
    }

    renderIncidentsList();
    renderSelectedIncidentDetails(incidentId);
    alert(`✓ تم قيد الغرامة (${fineAmount.toLocaleString()} ج.م) في المستخلص المالي لشركة ${incident.vendorName}.`);
  }
}

function triggerVehicleReplacement(incidentId) {
  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  const confirmed = confirm(`إرسال أمر رسمي لشركة (${incident.vendorName}) لتوفير حافلة بديلة فوراً على ${incident.lineName}؟`);
  if (confirmed) {
    incident.status = 'INVESTIGATING';
    const actionEntry = {
      time: "الآن",
      user: "إدارة الخدمات الميدانية SUT",
      text: `إلزام ${incident.vendorName} بتوفير حافلة بديلة مطابقة لمعايير SUT خلال 45 دقيقة.`
    };
    incident.actionsTaken.push(actionEntry);
    syncIncidentActionToServer(incidentId, incident.status, actionEntry);
    renderIncidentsList();
    renderSelectedIncidentDetails(incidentId);
    alert("✓ تم إرسال أمر الاستبدال لشركة النقل.");
  }
}

function triggerResolveIncident(incidentId) {
  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  incident.status = 'RESOLVED';
  const actionEntry = {
    time: "الآن",
    user: "غرفة عمليات SUT",
    text: "تم التحقق من انتظام الحافلة وسلامة الركاب وإغلاق البلاغ."
  };
  incident.actionsTaken.push(actionEntry);
  syncIncidentActionToServer(incidentId, incident.status, actionEntry);
  updateKpiSummary();
  renderIncidentsList();
  renderSelectedIncidentDetails(incidentId);
}

// Vendors Table
function renderVendorsTable() {
  const tbody = document.getElementById('vendorsTableBody');
  if (!tbody) return;

  tbody.innerHTML = FLEET_DATA.vendors.map(v => {
    let badgeClass = 'comp-compliant';
    let badgeText = 'معتمد وممتثل ✓';
    if (v.status === 'WARNING') {
      badgeClass = 'comp-warning';
      badgeText = 'إنذار لتدني الأمان ⚠️';
    } else if (v.status === 'DANGER') {
      badgeClass = 'comp-danger';
      badgeText = 'مهدد بفسخ العقد ⛔';
    }

    return `
      <tr>
        <td><strong>${v.name}</strong><br><span style="font-size:0.7rem; color:#64748b">${v.contactPerson}</span></td>
        <td>${v.activeBuses} حافلة</td>
        <td>${v.totalIncidents}</td>
        <td style="color:${v.criticalIncidents > 2 ? '#ef4444' : '#f8fafc'}">${v.criticalIncidents}</td>
        <td><strong style="color:#60a5fa">${v.safetyScore}%</strong></td>
        <td><strong style="color:#f87171">${v.finesTotal.toLocaleString()} ج.م</strong></td>
        <td><span class="compliance-badge ${badgeClass}">${badgeText}</span></td>
      </tr>
    `;
  }).join('');
}

// Recurring Violations Breakdown Chart
function renderViolationBreakdown() {
  const container = document.getElementById('violationBreakdownList');
  if (!container) return;

  container.innerHTML = VIOLATION_STATISTICS.map(v => `
    <div class="v-breakdown-item">
      <div class="v-break-label">
        <span>${v.title}</span>
        <strong>${v.count} بلاغ (${v.percentage}%)</strong>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${v.colorClass}" style="width: ${v.percentage}%"></div>
      </div>
    </div>
  `).join('');
}

function exportVendorSafetyReport() {
  alert("📊 تم استخراج تقرير خصومات ومخالفات أسطول جامعة السويدي للتكنولوجيا بصيغة رسمية معتمدة.");
}

// ==========================================
// VIEW 3: STICKER GENERATOR LOGIC (All 23 Lines)
// ==========================================

function initStickerGenerator() {
  const select = document.getElementById('stickerBusSelect');
  if (!select) return;

  // Populate all 23 SUT lines
  select.innerHTML = FLEET_DATA.buses.map(b => `
    <option value="${b.id}">باص ${b.id} - ${b.lineName} (${b.vendorName})</option>
  `).join('');

  const hostInput = document.getElementById('customHostInput');
  if (hostInput) hostInput.value = AppState.systemHost;

  updateStickerPreview(AppState.stickerSelectedBusId);
}

function handleHostChange(newHost) {
  AppState.systemHost = newHost.trim().replace(/\/$/, "");
  updateStickerPreview(AppState.stickerSelectedBusId);
}

function setPresetHost(presetUrl) {
  AppState.systemHost = presetUrl;
  const hostInput = document.getElementById('customHostInput');
  if (hostInput) hostInput.value = presetUrl;

  document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
  if (typeof event !== 'undefined' && event && event.target) {
    event.target.classList.add('active');
  }

  updateStickerPreview(AppState.stickerSelectedBusId);
}

function updateStickerPreview(busId) {
  AppState.stickerSelectedBusId = busId;
  const bus = FLEET_DATA.buses.find(b => b.id === busId) || FLEET_DATA.buses[0];

  const plateEl = document.getElementById('stkBusNumber');
  const lineEl = document.getElementById('stkBusLine');
  const vendorEl = document.getElementById('stkVendorName');
  const qrHolder = document.getElementById('stickerQrHolder');
  const urlDisplay = document.getElementById('stickerEncodedUrl');

  if (plateEl) plateEl.textContent = `باص ${bus.id}`;
  if (lineEl) lineEl.textContent = bus.lineName;
  if (vendorEl) vendorEl.textContent = bus.vendorName;

  // The actual full URL encoded into the QR code for students (points exclusively to report.html)
  const targetUrl = `${AppState.systemHost}/report.html?bus=${bus.id}`;

  if (urlDisplay) {
    urlDisplay.textContent = targetUrl;
  }

  // Generate genuine ISO/IEC 18004 Vector SVG QR code
  if (qrHolder && window.PureSVGQRGenerator) {
    qrHolder.innerHTML = PureSVGQRGenerator.generateSVG(targetUrl, 180, "#000000", "#ffffff");
  }
}

function testQrScanningLink() {
  const bus = FLEET_DATA.buses.find(b => b.id === AppState.stickerSelectedBusId) || FLEET_DATA.buses[0];
  const targetUrl = `${AppState.systemHost}/report.html?bus=${bus.id}`;
  window.open(targetUrl, '_blank');
}

function updateStickerPhone(phoneText) {
  const hotline = document.getElementById('stkHotlinePhone');
  if (hotline) hotline.textContent = phoneText;
}

function setStickerSize(size) {
  const sheet = document.getElementById('printableSticker');
  document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
  
  if (size === 'A4') {
    if (sheet) sheet.style.width = '620px';
    event.target.classList.add('active');
  } else {
    if (sheet) sheet.style.width = '480px';
    event.target.classList.add('active');
  }
}
