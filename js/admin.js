/**
 * SUT Fleet Operations Center - Admin Controller & Live Sync
 * جامعة السويدي للتكنولوجيا (Elsewedy University of Technology - SUT)
 * تصميم عصري ومنظم وبسيط لإدارة ومتابعة البلاغات
 */

function getDeletedIncidentIds() {
  try {
    return JSON.parse(localStorage.getItem('sut_deleted_incident_ids') || '[]');
  } catch (e) {
    return [];
  }
}

function markIncidentDeleted(id) {
  try {
    const list = getDeletedIncidentIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem('sut_deleted_incident_ids', JSON.stringify(list));
    }
  } catch (e) {}
}

const AppState = {
  selectedIncidentId: null,
  activeFilter: 'ALL',
  searchQuery: '',
  displayMode: 'split', // 'split' (cards + workspace) or 'table' (full data table)
  audioAlertsEnabled: true,
  audioContext: null,
  currentIncidents: FLEET_DATA.initialIncidents.filter(i => !getDeletedIncidentIds().includes(i.id)),
  isLiveConnected: false
};

let firebaseDb = null;

// ==========================================
// INITIALIZATION ON DOM LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Ensure deleted items are filtered out
  const deletedIds = getDeletedIncidentIds();
  AppState.currentIncidents = AppState.currentIncidents.filter(i => !deletedIds.includes(i.id));
  // Check Admin PIN Auth
  const isAuth = sessionStorage.getItem('sut_admin_authorized') === 'true';
  if (!isAuth) {
    openAdminPinModal();
  } else {
    document.getElementById('adminLogoutBtn')?.classList.remove('hidden');
  }

  // Connect to Firebase Cloud Realtime Database
  initFirebaseCloud();

  // Connect to Local Python Backend & SSE if running locally
  initLocalBackendSync();

  // Render initial tables & analytics
  updateKpiSummary();
  renderIncidentsList();
  renderMiniViolationsBreakdown();

  if (AppState.currentIncidents.length > 0) {
    selectIncidentForDetails(AppState.currentIncidents[0].id, false);
  }
});

// ==========================================
// ADMIN PIN AUTHENTICATION
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
  document.getElementById('appMainViewport')?.classList.add('admin-locked');
}

function closeAdminPinModal() {
  const isAuth = sessionStorage.getItem('sut_admin_authorized') === 'true';
  if (!isAuth) {
    window.location.replace('index.html');
    return;
  }
  const modal = document.getElementById('adminPinModal');
  if (modal) modal.classList.add('hidden');
  document.getElementById('appMainViewport')?.classList.remove('admin-locked');
}

async function sha256Hex(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleAdminPinSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('adminPinInput');
  const err = document.getElementById('pinErrorMessage');
  const val = input ? input.value.trim() : '';

  // Cryptographic SHA-256 hash of authorized operations PIN (19616)
  const AUTH_HASH = '3c62ec5be05ec2c2033c11c48059533ac47121c3d3f1e02a993aed10cfe808a3';
  
  let isAuthorized = false;
  try {
    const inputHash = await sha256Hex(val);
    if (inputHash === AUTH_HASH) {
      isAuthorized = true;
    }
  } catch (e) {
    if (val === '19616') isAuthorized = true;
  }

  if (isAuthorized) {
    sessionStorage.setItem('sut_admin_authorized', 'true');
    const modal = document.getElementById('adminPinModal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('appMainViewport')?.classList.remove('admin-locked');
    document.getElementById('adminLogoutBtn')?.classList.remove('hidden');
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
  openAdminPinModal();
}

// ==========================================
// VIEW MODE SWITCHER (SPLIT CARDS VS TABLE)
// ==========================================
function switchDisplayMode(mode) {
  AppState.displayMode = mode;

  const splitWrap = document.getElementById('splitViewContainer');
  const tableWrap = document.getElementById('tableViewContainer');
  const btnSplit = document.getElementById('btnModeSplit');
  const btnTable = document.getElementById('btnModeTable');

  if (mode === 'split') {
    if (splitWrap) splitWrap.classList.remove('hidden');
    if (tableWrap) tableWrap.classList.add('hidden');
    if (btnSplit) btnSplit.classList.add('active');
    if (btnTable) btnTable.classList.remove('active');
  } else {
    if (splitWrap) splitWrap.classList.add('hidden');
    if (tableWrap) tableWrap.classList.remove('hidden');
    if (btnSplit) btnSplit.classList.remove('active');
    if (btnTable) btnTable.classList.add('active');
  }

  renderIncidentsList();
}

// ==========================================
// FIREBASE REALTIME CONNECTION
// ==========================================
function initFirebaseCloud() {
  if (FLEET_DATA.firebaseConfig && FLEET_DATA.firebaseConfig.enabled && typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FLEET_DATA.firebaseConfig);
      }
      firebaseDb = firebase.database();
      console.log("Firebase connected in Admin Operations Center!");

      const statusLabel = document.getElementById('serverLiveLabel');
      if (statusLabel) statusLabel.textContent = "مباشر SUT (Firebase)";
      const statusDot = document.getElementById('serverLiveDot');
      if (statusDot) {
        statusDot.style.background = "#10b981";
      }

      let isInitialLoad = true;

      // Seed with initial incidents if empty and not cleared
      firebaseDb.ref('incidents').once('value', snapshot => {
        const deletedIds = getDeletedIncidentIds();
        if (!snapshot.exists() && deletedIds.length === 0) {
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

      // Realtime listener for incoming incidents
      firebaseDb.ref('incidents').limitToLast(100).on('child_added', (snap) => {
        const item = snap.val();
        if (item && item.id) {
          handleIncomingLiveIncident(item, isInitialLoad);
        }
      });

      firebaseDb.ref('incidents').on('child_changed', (snap) => {
        const item = snap.val();
        if (item && item.id) {
          const deletedIds = getDeletedIncidentIds();
          if (deletedIds.includes(item.id)) return;
          const existing = AppState.currentIncidents.find(i => i.id === item.id);
          if (existing && existing.isoDate === item.isoDate && 
              (existing.status !== item.status || JSON.stringify(existing.actionsTaken || []) !== JSON.stringify(item.actionsTaken || []))) {
            handleIncomingIncidentUpdate({
              incidentId: item.id,
              status: item.status,
              actionsTaken: item.actionsTaken
            });
          } else {
            handleIncomingLiveIncident(item, false);
          }
        }
      });

      // Listen for deleted incidents from other sessions / devices
      firebaseDb.ref('incidents').on('child_removed', (snap) => {
        const item = snap.val();
        const id = (item && item.id) ? item.id : snap.key;
        if (id) {
          handleIncomingIncidentDeleted(id);
        }
      });
    } catch (e) {
      console.warn("Firebase Init Error:", e);
    }
  }
}

function handleIncomingLiveIncident(incident, isInitialLoad = false) {
  if (!incident || !incident.id) return;
  const deletedIds = getDeletedIncidentIds();
  if (deletedIds.includes(incident.id)) return;
  const existingIdx = AppState.currentIncidents.findIndex(i => i.id === incident.id);
  if (existingIdx > -1) {
    AppState.currentIncidents[existingIdx] = incident;
    if (!isInitialLoad) {
      const [updated] = AppState.currentIncidents.splice(existingIdx, 1);
      AppState.currentIncidents.unshift(updated);
      playSafetyAlertChime(incident.severity);
      showPushNotificationToast(incident);
    }
  } else {
    AppState.currentIncidents.unshift(incident);
    if (!isInitialLoad) {
      playSafetyAlertChime(incident.severity);
      showPushNotificationToast(incident);
    }
  }

  // Keep ordered newest first
  AppState.currentIncidents.sort((a, b) => {
    const da = a.isoDate ? new Date(a.isoDate).getTime() : 0;
    const db = b.isoDate ? new Date(b.isoDate).getTime() : 0;
    return db - da;
  });

  updateKpiSummary();
  renderIncidentsList();
  renderMiniViolationsBreakdown();

  if (!AppState.selectedIncidentId || !isInitialLoad) {
    selectIncidentForDetails(incident.id, false);
  }
}

function handleIncomingIncidentUpdate(update) {
  const inc = AppState.currentIncidents.find(i => i.id === update.incidentId);
  if (inc) {
    if (update.status) inc.status = update.status;
    if (update.actionsTaken) inc.actionsTaken = update.actionsTaken;
    updateKpiSummary();
    renderIncidentsList();
    if (AppState.selectedIncidentId === update.incidentId) {
      renderSelectedIncidentDetails(update.incidentId);
    }
  }
}

// ==========================================
// LOCAL BACKEND SYNC (SERVER.PY / SQLITE / SSE)
// ==========================================
function initLocalBackendSync() {
  if (typeof window === 'undefined' || !window.location || !window.location.protocol.startsWith('http')) return;

  fetch('/api/incidents')
    .then(res => {
      if (!res.ok) throw new Error('Not local backend');
      return res.json();
    })
    .then(data => {
      if (data && data.success && Array.isArray(data.incidents)) {
        const deletedIds = getDeletedIncidentIds();
        data.incidents.forEach(inc => {
          if (deletedIds.includes(inc.id)) return;
          const idx = AppState.currentIncidents.findIndex(i => i.id === inc.id);
          if (idx === -1) {
            AppState.currentIncidents.push(inc);
          } else if (inc.isoDate && !AppState.currentIncidents[idx].isoDate) {
            AppState.currentIncidents[idx] = inc;
          }
        });
        AppState.currentIncidents.sort((a, b) => {
          const da = a.isoDate ? new Date(a.isoDate).getTime() : 0;
          const db = b.isoDate ? new Date(b.isoDate).getTime() : 0;
          return db - da;
        });
        updateKpiSummary();
        renderIncidentsList();
        renderMiniViolationsBreakdown();
      }
    })
    .catch(() => {});

  try {
    if (window.EventSource) {
      const evtSource = new EventSource('/api/events');
      evtSource.addEventListener('new_incident', (e) => {
        try {
          const incident = JSON.parse(e.data);
          handleIncomingLiveIncident(incident, false);
        } catch (err) {}
      });
      evtSource.addEventListener('incident_updated', (e) => {
        try {
          const updateData = JSON.parse(e.data);
          handleIncomingIncidentUpdate(updateData);
        } catch (err) {}
      });
      evtSource.addEventListener('incident_deleted', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.incidentId) {
            handleIncomingIncidentDeleted(data.incidentId);
          }
        } catch (err) {}
      });
      evtSource.addEventListener('all_incidents_cleared', () => {
        try {
          handleIncomingAllIncidentsCleared();
        } catch (err) {}
      });
    }
  } catch (err) {}
}

// ==========================================
// AUDIO ALERT SYNTHESIZER
// ==========================================
function playSafetyAlertChime(severity = 'CRITICAL') {
  if (!AppState.audioAlertsEnabled) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!AppState.audioContext) AppState.audioContext = new AudioCtx();
    if (AppState.audioContext.state === 'suspended') AppState.audioContext.resume();

    const now = AppState.audioContext.currentTime;
    const osc = AppState.audioContext.createOscillator();
    const gain = AppState.audioContext.createGain();

    if (severity === 'CRITICAL') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.18);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }

    osc.connect(gain);
    gain.connect(AppState.audioContext.destination);
  } catch (err) {}
}

function toggleAudioAlerts() {
  AppState.audioAlertsEnabled = !AppState.audioAlertsEnabled;
  const icon = document.getElementById('soundIcon');
  if (icon) icon.textContent = AppState.audioAlertsEnabled ? '🔔' : '🔕';
}

function showPushNotificationToast(incident) {
  const container = document.getElementById('liveToastContainer');
  if (!container) return;

  const isCritical = incident.severity === 'CRITICAL';
  const toast = document.createElement('div');
  toast.className = `live-push-toast ${isCritical ? 'critical-toast' : ''}`;
  toast.innerHTML = `
    <div class="toast-icon">${incident.violationIcon || '🚨'}</div>
    <div class="toast-body">
      <strong>${incident.violationTitle} (${incident.lineName})</strong>
      <p style="margin:2px 0 4px 0;">${incident.location}</p>
      ${isCritical ? `
        <button type="button" onclick="sendWhatsAppSupervisorAlert('${incident.id}')" style="background:#25D366; color:#fff; border:none; padding:5px 12px; border-radius:6px; font-weight:700; font-size:0.78rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; margin-top:5px; box-shadow:0 2px 8px rgba(37,211,102,0.4);">
          <span>📲 إرسال واتساب لمشرف أبو الهول فوراً</span>
        </button>
      ` : ''}
    </div>
    <button class="toast-close-btn" onclick="this.parentElement.remove()">✕</button>
  `;

  container.prepend(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 7000);
}

// ==========================================
// QUICK FILTERING & SEARCH
// ==========================================
function applyQuickFilter(filterType) {
  AppState.activeFilter = filterType;

  // Update button active states
  const btnMap = {
    'ALL': 'filterBtnAll',
    'CRITICAL': 'filterBtnCritical',
    'PENDING': 'filterBtnPending',
    'RESOLVED': 'filterBtnResolved'
  };

  Object.values(btnMap).forEach(id => {
    document.getElementById(id)?.classList.remove('active');
  });

  const activeBtnId = btnMap[filterType];
  if (activeBtnId) {
    document.getElementById(activeBtnId)?.classList.add('active');
  }

  renderIncidentsList();
}

function handleIncidentSearch(query) {
  AppState.searchQuery = query.trim().toLowerCase();

  // Keep both search inputs synchronized
  const input1 = document.getElementById('incidentSearchInput');
  const input2 = document.getElementById('tableSearchInput');
  if (input1 && input1.value !== query) input1.value = query;
  if (input2 && input2.value !== query) input2.value = query;

  renderIncidentsList();
}

// ==========================================
// KPI & SUMMARY COUNTERS
// ==========================================
function updateKpiSummary() {
  const total = AppState.currentIncidents.length;
  const critical = AppState.currentIncidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').length;
  const pending = AppState.currentIncidents.filter(i => i.status !== 'RESOLVED').length;
  const resolved = AppState.currentIncidents.filter(i => i.status === 'RESOLVED').length;

  // Header Counters
  const cntAll = document.getElementById('cntAll');
  const cntCritical = document.getElementById('cntCritical');
  const cntPending = document.getElementById('cntPending');
  const cntResolved = document.getElementById('cntResolved');

  if (cntAll) cntAll.textContent = total;
  if (cntCritical) cntCritical.textContent = critical;
  if (cntPending) cntPending.textContent = pending;
  if (cntResolved) cntResolved.textContent = resolved;

  // Modal Counters
  const mTotal = document.getElementById('modalKpiTotal');
  const mCrit = document.getElementById('modalKpiCritical');
  const mPend = document.getElementById('modalKpiPending');
  const mRes = document.getElementById('modalKpiResolved');

  if (mTotal) mTotal.textContent = total;
  if (mCrit) mCrit.textContent = critical;
  if (mPend) mPend.textContent = pending;
  if (mRes) mRes.textContent = resolved;
}

// ==========================================
// RENDER INCIDENTS LIST (CARDS + TABLE)
// ==========================================
function renderIncidentsList() {
  const cardsContainer = document.getElementById('incidentsList');
  const tableContainer = document.getElementById('incidentsTableBody');

  const filtered = AppState.currentIncidents.filter(inc => {
    if (AppState.activeFilter === 'CRITICAL' && inc.severity !== 'CRITICAL') return false;
    if (AppState.activeFilter === 'PENDING' && inc.status === 'RESOLVED') return false;
    if (AppState.activeFilter === 'RESOLVED' && inc.status !== 'RESOLVED') return false;

    if (AppState.searchQuery) {
      const q = AppState.searchQuery;
      const matchLine = inc.lineName?.toLowerCase().includes(q);
      const matchVio = inc.violationTitle?.toLowerCase().includes(q);
      const matchLoc = inc.location?.toLowerCase().includes(q);
      const matchId = inc.id?.toLowerCase().includes(q);
      const matchStudent = inc.studentName?.toLowerCase().includes(q);
      const matchCode = inc.studentId?.toLowerCase().includes(q);
      if (!matchLine && !matchVio && !matchLoc && !matchId && !matchStudent && !matchCode) return false;
    }
    return true;
  });

  const countPill = document.getElementById('streamCountPill');
  const tableCountPill = document.getElementById('tableCountPill');
  if (countPill) countPill.textContent = `${filtered.length} بلاغات`;
  if (tableCountPill) tableCountPill.textContent = `${filtered.length} بلاغات`;

  // 1. POPULATE CARDS FEED
  if (cardsContainer) {
    if (filtered.length === 0) {
      cardsContainer.innerHTML = `
        <div style="padding: 3rem 1rem; text-align: center; color: #64748b;">
          <span style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;">🔍</span>
          <p style="margin: 0; font-size: 0.85rem;">لا توجد بلاغات مطابقة لخيارات التصفية</p>
        </div>
      `;
    } else {
      cardsContainer.innerHTML = filtered.map(inc => {
        const isSelected = inc.id === AppState.selectedIncidentId;
        
        let sevClass = 'low';
        let sevBadge = `<span style="background:rgba(59,130,246,0.18); color:#93c5fd; font-size:0.7rem; font-weight:700; padding:2px 7px; border-radius:4px; border:1px solid rgba(59,130,246,0.3)">عامة</span>`;
        
        if (inc.severity === 'CRITICAL') {
          sevClass = 'crit';
          sevBadge = `<span style="background:rgba(239,68,68,0.22); color:#f87171; font-size:0.7rem; font-weight:700; padding:2px 7px; border-radius:4px; border:1px solid rgba(239,68,68,0.35)">🚨 حرجة</span>`;
        } else if (inc.severity === 'MEDIUM') {
          sevClass = 'med';
          sevBadge = `<span style="background:rgba(245,158,11,0.22); color:#fbbf24; font-size:0.7rem; font-weight:700; padding:2px 7px; border-radius:4px; border:1px solid rgba(245,158,11,0.35)">🟡 متوسطة</span>`;
        }

        let statusText = 'جديد';
        let statusClass = 'st-new';
        if (inc.status === 'INVESTIGATING') {
          statusText = 'قيد المتابعة';
          statusClass = 'st-investigating';
        } else if (inc.status === 'FINED') {
          statusText = 'إجراء معتمد';
          statusClass = 'st-fined';
        } else if (inc.status === 'RESOLVED') {
          statusText = 'تم الحل';
          statusClass = 'st-resolved';
        }

        return `
          <div class="inc-card ${sevClass} ${isSelected ? 'active-card' : ''}" 
               id="card_${inc.id.replace(/[^a-zA-Z0-9]/g, '')}" 
               onclick="selectIncidentForDetails('${inc.id}', false)">
            
            <div class="card-top">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="card-id-tag">#${inc.id}</span>
                ${sevBadge}
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="card-time">🕒 ${inc.timestamp || 'الآن'}</span>
                <button type="button" 
                        class="btn-card-delete" 
                        onclick="deleteIncidentPrompt(event, '${inc.id}')" 
                        title="حذف هذا البلاغ نهائياً">
                  🗑️
                </button>
              </div>
            </div>

            <div class="card-title-line">
              <span style="font-size:1.15rem;">${inc.violationIcon || '⚠️'}</span>
              <span style="color:#ffffff; font-weight:700;">${inc.violationTitle}</span>
            </div>

            <div class="card-route-line">
              <span>🚌 ${inc.lineName}</span>
            </div>

            <div class="card-bottom">
              <span style="color:#94a3b8; font-size:0.75rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">
                👤 ${inc.studentName || 'طالب SUT'} ${inc.studentId ? `(${inc.studentId})` : ''}
              </span>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="status-pill ${statusClass}">${statusText}</span>
                <button type="button" 
                        class="btn-card-delete-badge" 
                        onclick="deleteIncidentPrompt(event, '${inc.id}')" 
                        title="حذف هذا البلاغ نهائياً">
                  🗑️ مسح
                </button>
              </div>
            </div>

          </div>
        `;
      }).join('');
    }
  }

  // 2. POPULATE FULL DATA TABLE
  if (tableContainer) {
    if (filtered.length === 0) {
      tableContainer.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 3rem; color: #64748b;">
            لا توجد بلاغات مطابقة للتصفية
          </td>
        </tr>
      `;
    } else {
      tableContainer.innerHTML = filtered.map(inc => {
        let sevBadge = `<span style="background:rgba(59,130,246,0.18); color:#93c5fd; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid rgba(59,130,246,0.3)">عامة</span>`;
        if (inc.severity === 'CRITICAL') {
          sevBadge = `<span style="background:rgba(239,68,68,0.22); color:#f87171; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid rgba(239,68,68,0.35)">🚨 حرجة</span>`;
        } else if (inc.severity === 'MEDIUM') {
          sevBadge = `<span style="background:rgba(245,158,11,0.22); color:#fbbf24; font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid rgba(245,158,11,0.35)">🟡 متوسطة</span>`;
        }

        let statusText = 'جديد';
        let statusClass = 'st-new';
        if (inc.status === 'INVESTIGATING') {
          statusText = 'قيد المتابعة';
          statusClass = 'st-investigating';
        } else if (inc.status === 'FINED') {
          statusText = 'إجراء معتمد';
          statusClass = 'st-fined';
        } else if (inc.status === 'RESOLVED') {
          statusText = 'تم الحل';
          statusClass = 'st-resolved';
        }

        return `
          <tr style="cursor: pointer;" onclick="selectIncidentForDetails('${inc.id}', true)">
            <td><strong style="color:#38bdf8; font-family:monospace;">#${inc.id}</strong></td>
            <td style="color:#94a3b8; font-size:0.78rem;">${inc.timestamp || '-'}</td>
            <td>${sevBadge}</td>
            <td>
              <span style="display:flex; align-items:center; gap:6px;">
                <span>${inc.violationIcon || '⚠️'}</span>
                <strong>${inc.violationTitle}</strong>
              </span>
            </td>
            <td><strong style="color:#60a5fa">${inc.lineName}</strong></td>
            <td>${inc.studentName || 'غير مسجل'}</td>
            <td style="color:#38bdf8; font-family:monospace;">${inc.studentId || '-'}</td>
            <td>
              ${inc.studentPhone ? `
                <a href="tel:${inc.studentPhone}" style="color:#38bdf8; text-decoration:none;" onclick="event.stopPropagation()">
                  📞 ${inc.studentPhone}
                </a>
              ` : '<span style="color:#64748b">-</span>'}
            </td>
            <td style="color:#cbd5e1; font-size:0.78rem;">${inc.location}</td>
            <td><span class="status-pill ${statusClass}">${statusText}</span></td>
            <td style="text-align: center;">
              <div style="display:inline-flex; gap:6px;" onclick="event.stopPropagation()">
                <button type="button" class="btn-header-action" style="padding:4px 8px; font-size:0.75rem;" onclick="selectIncidentForDetails('${inc.id}', true)">
                  <span>🔍 عرض التفاصيل</span>
                </button>
                <button type="button" class="btn-ws-whatsapp" style="padding:4px 8px; font-size:0.75rem;" onclick="sendWhatsAppSupervisorAlert('${inc.id}')">
                  <span>📲 المشرف</span>
                </button>
                <button type="button" class="btn-ws-delete" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteIncidentPrompt(event, '${inc.id}')" title="حذف هذا البلاغ">
                  <span>🗑️ حذف</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

// ==========================================
// EXPORT INCIDENTS TO CSV (EXCEL)
// ==========================================
function exportIncidentsToCSV() {
  const headers = ["رقم البلاغ", "وقت البلاغ", "مستوى الأمان", "نوع المخالفة", "خط السير", "الشركة المشغلة", "اسم الطالب", "كود الطالب", "هاتف الطالب", "الموقع", "ملاحظات الطالب", "الحالة"];
  
  const rows = AppState.currentIncidents.map(inc => [
    inc.id,
    inc.timestamp || "",
    inc.severity === 'CRITICAL' ? 'حرجة' : inc.severity === 'MEDIUM' ? 'متوسطة' : 'عامة',
    inc.violationTitle,
    inc.lineName,
    "شركة أبو الهول",
    inc.studentName || "",
    inc.studentId || "",
    inc.studentPhone || "",
    inc.location || "",
    (inc.notes || "").replace(/"/g, '""'),
    getIncidentStatusArabic(inc.status)
  ]);

  let csvContent = "\uFEFF"; // UTF-8 BOM for Arabic support in Excel
  csvContent += headers.map(h => `"${h}"`).join(",") + "\r\n";

  rows.forEach(row => {
    csvContent += row.map(v => `"${v}"`).join(",") + "\r\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SUT_Incidents_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// SELECT & RENDER INCIDENT WORKSPACE
// ==========================================
function selectIncidentForDetails(incidentId, shouldSwitchToSplit = false) {
  AppState.selectedIncidentId = incidentId;

  // Highlight selected card
  document.querySelectorAll('.inc-card').forEach(c => c.classList.remove('active-card'));
  const card = document.getElementById(`card_${incidentId.replace(/[^a-zA-Z0-9]/g, '')}`);
  if (card) {
    card.classList.add('active-card');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  renderSelectedIncidentDetails(incidentId);

  // If invoked from table view and requested, switch to split view so the user can take action
  if (shouldSwitchToSplit && AppState.displayMode === 'table') {
    switchDisplayMode('split');
  }
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

  let sevBadge = `<span style="background:rgba(239,68,68,0.22); color:#f87171; font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:6px; border:1px solid rgba(239,68,68,0.35)">🚨 حالة حرجة</span>`;
  if (incident.severity === 'MEDIUM') {
    sevBadge = `<span style="background:rgba(245,158,11,0.22); color:#fbbf24; font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:6px; border:1px solid rgba(245,158,11,0.35)">🟡 حالة متوسطة</span>`;
  } else if (incident.severity === 'LOW') {
    sevBadge = `<span style="background:rgba(59,130,246,0.18); color:#93c5fd; font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:6px; border:1px solid rgba(59,130,246,0.3)">🔵 حالة عامة</span>`;
  }

  const actionsLogHTML = (!incident.actionsTaken || incident.actionsTaken.length === 0)
    ? `<p style="font-size:0.78rem; color:#64748b; margin:0; font-style:italic">لم يتم تسجيل إجراءات بعد على هذه التذكرة.</p>`
    : incident.actionsTaken.map(a => `
        <div class="timeline-item">
          <strong>${a.time} - ${a.user}:</strong>
          <span>${a.text}</span>
        </div>
      `).join('');

  content.innerHTML = `
    <!-- Top Workspace Banner -->
    <div class="ws-top-banner">
      <div class="ws-main-meta">
        <h2>
          <span>${incident.violationIcon || '⚠️'}</span>
          <span>${incident.violationTitle}</span>
          ${sevBadge}
        </h2>
        <div class="ws-sub-meta">
          <span style="color:#38bdf8; font-weight:800; font-size:0.85rem;">تذكرة: #${incident.id}</span>
          <span>•</span>
          <span>${incident.timestamp || 'اليوم'}</span>
          <span>•</span>
          <span class="status-pill st-${incident.status.toLowerCase()}">${getIncidentStatusArabic(incident.status)}</span>
        </div>
      </div>

      <div class="ws-top-actions">
        <button type="button" class="btn-ws-whatsapp" onclick="sendWhatsAppSupervisorAlert('${incident.id}')">
          <span>📲 واتساب المشرف (01040772030)</span>
        </button>
        <a href="tel:01040772030" class="btn-ws-call">
          <span>📞 اتصال</span>
        </a>
        <button type="button" class="btn-ws-delete" onclick="deleteIncidentPrompt(event, '${incident.id}')" title="حذف هذا البلاغ نهائياً من النظام">
          <span>🗑️ حذف البلاغ</span>
        </button>
      </div>
    </div>

    <!-- Structured 2-Column Info Grid -->
    <div class="ws-info-grid">
      
      <!-- Card 1: Incident & Trip Details -->
      <div class="ws-info-card">
        <div class="ws-info-card-title">
          <span>🚌</span>
          <span>بيانات الرحلة والمخالفة</span>
        </div>

        <div class="ws-detail-row">
          <span class="ws-detail-label">خط السير:</span>
          <span class="ws-detail-value" style="color:#60a5fa">${incident.lineName}</span>
        </div>

        <div class="ws-detail-row">
          <span class="ws-detail-label">الشركة المشغلة:</span>
          <span class="ws-detail-value">شركة أبو الهول لنقل الركاب</span>
        </div>

        <div class="ws-detail-row">
          <span class="ws-detail-label">الموقع الجغرافي:</span>
          <span class="ws-detail-value">${incident.location}</span>
        </div>

        <div style="margin-top:0.75rem;">
          <span class="ws-detail-label" style="display:block; margin-bottom:4px;">وصف وملاحظات الطالب:</span>
          <div class="student-quote-box">
            "${incident.notes || 'بلاغ رصد مخالفة أمان مباشر عبر باركود الحافلة'}"
          </div>
        </div>
      </div>

      <!-- Card 2: Student Reporter Details -->
      <div class="ws-info-card">
        <div class="ws-info-card-title">
          <span>👤</span>
          <span>بيانات الطالب المُبلّغ</span>
        </div>

        <div class="ws-detail-row">
          <span class="ws-detail-label">اسم الطالب:</span>
          <span class="ws-detail-value">${incident.studentName || 'غير مسجل'}</span>
        </div>

        <div class="ws-detail-row">
          <span class="ws-detail-label">كود الطالب (ID):</span>
          <span class="ws-detail-value" style="color:#38bdf8">${incident.studentId || 'غير مسجل'}</span>
        </div>

        <div class="ws-detail-row">
          <span class="ws-detail-label">رقم الهاتف:</span>
          <span class="ws-detail-value">${incident.studentPhone || 'غير مسجل'}</span>
        </div>

        ${incident.studentPhone ? `
          <div style="margin-top:0.85rem; padding-top:0.65rem; border-top:1px solid rgba(255,255,255,0.06); display:flex; gap:8px;">
            <a href="https://wa.me/2${incident.studentPhone}" target="_blank" class="btn-ws-call" style="flex:1; justify-content:center; text-decoration:none; font-size:0.78rem;">
              <span>💬 تواصل واتساب مع الطالب</span>
            </a>
            <a href="tel:${incident.studentPhone}" class="btn-ws-call" style="text-decoration:none; font-size:0.78rem;">
              <span>📞 اتصال</span>
            </a>
          </div>
        ` : ''}

        <!-- Department Offices -->
        <div style="margin-top:0.75rem; background:rgba(0,0,0,0.25); padding:8px 10px; border-radius:6px; font-size:0.75rem; color:#94a3b8;">
          🏢 مقرات الجامعة: مكتب إدارة النقل (غرفة 039 الدور الأرضي) • مكتب السيفتي (غرفة 112 الدور الأول)
        </div>
      </div>

      <!-- Card 3: Photo Attachment Evidence -->
      <div class="ws-info-card">
        <div class="ws-info-card-title">
          <span>📷</span>
          <span>صورة ودليل المخالفة</span>
        </div>

        ${incident.attachmentUrl ? `
          <div class="evidence-thumb-wrap" onclick="window.open('${incident.attachmentUrl}', '_blank')" title="اضغط لفتح الصورة بالحجم الكامل">
            <img src="${incident.attachmentUrl}" alt="دليل المخالفة">
          </div>
          <span style="font-size:0.72rem; color:#94a3b8; display:block; text-align:center; margin-top:6px;">🔍 اضغط على الصورة لفتحها بالحجم الكامل في نافذة جديدة</span>
        ` : `
          <div style="padding:1.5rem 1rem; text-align:center; color:#64748b; font-size:0.8rem;">
            <span>📷 لا توجد صورة مرفقة مع هذا البلاغ</span>
          </div>
        `}
      </div>

      <!-- Card 4: Audit & Action Timeline -->
      <div class="ws-info-card">
        <div class="ws-info-card-title">
          <span>📝</span>
          <span>سجل إجراءات المتابعة والتحقيق</span>
        </div>

        <div class="timeline-container">
          ${actionsLogHTML}
        </div>
      </div>

    </div>

    <!-- Bottom Action Execution Ribbon -->
    <div class="ws-action-ribbon">
      <div class="action-ribbon-title">اتخاذ إجراء إداري رسمي على التذكرة:</div>
      
      <div style="margin-bottom:0.75rem;">
        <input type="text" id="customActionNote" class="feed-search-input" placeholder="ملاحظة إدارية إضافية (اختياري)..." style="width:100%;">
      </div>

      <div class="action-buttons-row">
        <button type="button" class="btn-act btn-act-warn" onclick="handleExecuteAction('${incident.id}', 'INVESTIGATING', 'توجيه إنذار رسمي')">
          <span>⚠️ توجيه إنذار رسمي</span>
        </button>
        <button type="button" class="btn-act btn-act-fine" onclick="handleExecuteAction('${incident.id}', 'FINED', 'اعتماد مخالفة رسمية')">
          <span>🚫 اعتماد مخالفة وغرامة</span>
        </button>
        <button type="button" class="btn-act btn-act-resolve" onclick="handleExecuteAction('${incident.id}', 'RESOLVED', 'تم التحقق من الالتزام وحل البلاغ')">
          <span>✅ حل البلاغ وإغلاقه</span>
        </button>
      </div>
    </div>
  `;
}

function getIncidentStatusArabic(status) {
  if (status === 'NEW') return 'جديد';
  if (status === 'INVESTIGATING') return 'قيد المتابعة';
  if (status === 'FINED') return 'إجراء معتمد';
  if (status === 'RESOLVED') return 'تم الحل';
  return status;
}

// ==========================================
// EXECUTE ADMIN ACTION & SYNC
// ==========================================
async function handleExecuteAction(incidentId, newStatus, defaultText) {
  const customNoteInput = document.getElementById('customActionNote');
  const customNote = customNoteInput ? customNoteInput.value.trim() : '';
  const actionText = customNote ? `${defaultText}: ${customNote}` : defaultText;

  await executeAdminAction(incidentId, newStatus, actionText);
}

async function executeAdminAction(incidentId, newStatus, actionText) {
  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const actionEntry = {
    time: timeStr,
    user: "مشرف النقل والسلامة SUT",
    text: actionText
  };

  incident.status = newStatus;
  if (!incident.actionsTaken) incident.actionsTaken = [];
  incident.actionsTaken.push(actionEntry);

  // Sync to Firebase Cloud
  if (firebaseDb) {
    try {
      const key = incidentId.replace(/[^a-zA-Z0-9_-]/g, "");
      await firebaseDb.ref('incidents/' + key).update({
        status: newStatus,
        actionsTaken: incident.actionsTaken
      });
    } catch (e) {
      console.warn("Firebase update error:", e);
    }
  }

  // Also post to local backend if running
  try {
    await fetch(`/api/incidents/${incidentId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId: incidentId,
        status: newStatus,
        actionEntry: actionEntry
      })
    });
  } catch (e) {}

  updateKpiSummary();
  renderIncidentsList();
  renderSelectedIncidentDetails(incidentId);
}

// ==========================================
// WHATSAPP SUPERVISOR ALERT
// ==========================================
function formatSupervisorAlertMessage(incident) {
  const line = incident.lineName || "خط غير محدد";
  const violation = incident.violationTitle || "مخالفة أمان";
  const loc = incident.location || "طريق خط السير";
  const notes = incident.notes || "بلاغ مسجل مباشرة من ركاب الحافلة";
  const ticket = incident.id || "SUT";
  const time = incident.timestamp || "الآن";

  return `🚨 *جامعة السويدي للتكنولوجيا (SUT) - إدارة السلامة والصحة المهنية*
--------------------------------------------------
⚠️ *إشعار أمان عاجل لمشرف تشغيل شركة أبو الهول*
📋 *رقم التذكرة:* #${ticket}
🚌 *الخط الميداني:* ${line}
🏢 *الشركة المشغلة:* شركة أبو الهول لنقل الركاب
🚨 *نوع المخالفة:* ${violation}
📊 *مستوى الخطورة:* حالة حرجة تستوجب التدخل الفوري
📍 *الموقع الجغرافي:* ${loc}
📝 *ملاحظات البلاغ:* ${notes}
🕒 *وقت البلاغ:* ${time}
--------------------------------------------------
⚠️ *المطلوب فوراً:*
1. الاتصال المباشر بالسائق وتوجيه أمر بالتهدئة والالتزام الفوري بقواعد السلامة.
2. إفادة إدارة النقل والسلامة بالجامعة بالإجراء المتخذ لإغلاق التذكرة.
🏢 المقرات: مكتب إدارة النقل (غرفة 039 الدور الأرضي) • مكتب السيفتي (غرفة 112 الدور الأول)
📞 هاتف متابعة إدارة النقل والسلامة (اتصال أو واتساب): 01040772030`;
}

function sendWhatsAppSupervisorAlert(incidentId) {
  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  const msg = formatSupervisorAlertMessage(incident);
  const phone = "201040772030"; // Unified Transport Administration Phone (WhatsApp / Calls)
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;

  executeAdminAction(incidentId, 'INVESTIGATING', 'تم إرسال إشعار أمان عاجل لإدارة النقل (01040772030) عبر تطبيق واتساب');

  window.open(url, '_blank');
}

// ==========================================
// STATS & VIOLATIONS BREAKDOWN MODAL
// ==========================================
function openStatsAnalyticsModal() {
  const modal = document.getElementById('statsAnalyticsModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderMiniViolationsBreakdown();
  }
}

function closeStatsAnalyticsModal() {
  const modal = document.getElementById('statsAnalyticsModal');
  if (modal) modal.classList.add('hidden');
}

function handleModalBackdropClick(event) {
  if (event.target && event.target.id === 'statsAnalyticsModal') {
    closeStatsAnalyticsModal();
  }
}

function renderMiniViolationsBreakdown() {
  const container = document.getElementById('miniViolationsBreakdown');
  if (!container) return;

  const stats = {};
  AppState.currentIncidents.forEach(inc => {
    const title = inc.violationTitle || "أخرى";
    const icon = inc.violationIcon || "⚠️";
    if (!stats[title]) {
      stats[title] = { count: 0, icon: icon };
    }
    stats[title].count += 1;
  });

  const sorted = Object.entries(stats).sort((a, b) => b[1].count - a[1].count);
  const total = sorted.reduce((sum, item) => sum + item[1].count, 0) || 1;

  const colorPalettes = [
    { bg: "linear-gradient(90deg, #ef4444, #f87171)", badge: "rgba(239,68,68,0.15)", text: "#fca5a5", border: "rgba(239,68,68,0.3)" },
    { bg: "linear-gradient(90deg, #f59e0b, #fbbf24)", badge: "rgba(245,158,11,0.15)", text: "#fde68a", border: "rgba(245,158,11,0.3)" },
    { bg: "linear-gradient(90deg, #3b82f6, #60a5fa)", badge: "rgba(59,130,246,0.15)", text: "#bfdbfe", border: "rgba(59,130,246,0.3)" },
    { bg: "linear-gradient(90deg, #10b981, #34d399)", badge: "rgba(16,185,129,0.15)", text: "#a7f3d0", border: "rgba(16,185,129,0.3)" },
    { bg: "linear-gradient(90deg, #8b5cf6, #a78bfa)", badge: "rgba(139,92,246,0.15)", text: "#ddd6fe", border: "rgba(139,92,246,0.3)" },
  ];

  if (sorted.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; color:#64748b; padding:1.2rem; font-size:0.85rem;">
        لا توجد بلاغات مسجلة حتى الآن
      </div>
    `;
    return;
  }

  container.innerHTML = sorted.map(([title, item], index) => {
    const pct = Math.round((item.count / total) * 100);
    const palette = colorPalettes[index % colorPalettes.length];
    return `
      <div style="background:rgba(30,41,59,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:0.85rem 1rem; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            <span style="font-size:1.15rem; flex-shrink:0;">${item.icon}</span>
            <span style="font-size:0.82rem; font-weight:600; color:#f1f5f9; line-height:1.3;" title="${title}">
              ${title}
            </span>
          </div>
          <span style="font-size:0.75rem; font-weight:700; background:${palette.badge}; color:${palette.text}; border:1px solid ${palette.border}; padding:2px 8px; border-radius:6px; white-space:nowrap; flex-shrink:0;">
            ${item.count} بلاغ (${pct}%)
          </span>
        </div>
        <div>
          <div style="height:6px; background:rgba(255,255,255,0.07); border-radius:4px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${palette.bg}; border-radius:4px; transition:width 0.4s ease;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// INCIDENT DELETION LOGIC (SINGLE & BULK)
// ==========================================
async function deleteIncidentPrompt(event, incidentId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const inc = AppState.currentIncidents.find(i => i.id === incidentId);
  const title = inc ? inc.violationTitle : incidentId;

  const confirmed = confirm(
    `🗑️ تأكيد حذف البلاغ نهائياً:\n\n` +
    `• رقم البلاغ: #${incidentId}\n` +
    `• المخالفة: ${title}\n\n` +
    `هل تريد بالتأكيد حذف هذا البلاغ بشكل دائم من سجل البلاغات وقاعدة البيانات؟\n` +
    `هذا الإجراء لا يمكن التراجع عنه.`
  );

  if (!confirmed) return;

  await executeDeleteIncident(incidentId);
}

async function executeDeleteIncident(incidentId) {
  // 1. Mark in localStorage so it never re-appears
  markIncidentDeleted(incidentId);

  // 2. Remove from AppState
  AppState.currentIncidents = AppState.currentIncidents.filter(i => i.id !== incidentId);

  // 3. Remove from Firebase Realtime Database
  const key = incidentId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (firebaseDb) {
    try {
      await firebaseDb.ref('incidents/' + key).remove();
    } catch (e) {
      console.warn("Firebase delete error:", e);
    }
  }
  try {
    fetch(`https://sut-fleet-default-rtdb.firebaseio.com/incidents/${key}.json`, {
      method: 'DELETE'
    }).catch(() => {});
  } catch (e) {}

  // 4. Delete from local Python backend if active
  try {
    fetch(`/api/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'DELETE'
    }).catch(() => {});
    fetch('/api/incidents/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: incidentId })
    }).catch(() => {});
  } catch (e) {}

  // 5. Update workspace selection if needed
  if (AppState.selectedIncidentId === incidentId) {
    if (AppState.currentIncidents.length > 0) {
      selectIncidentForDetails(AppState.currentIncidents[0].id, false);
    } else {
      AppState.selectedIncidentId = null;
      const emptyState = document.getElementById('emptyWorkspaceState');
      const content = document.getElementById('activeWorkspaceContent');
      if (emptyState) emptyState.classList.remove('hidden');
      if (content) content.classList.add('hidden');
    }
  }

  // 6. Refresh UI
  updateKpiSummary();
  renderIncidentsList();
  renderMiniViolationsBreakdown();

  // 7. Feedback toast
  showAdminActionToast(`تم حذف البلاغ #${incidentId} بنجاح من النظام.`);
}

async function handleClearAllTestIncidents() {
  if (!AppState.currentIncidents || AppState.currentIncidents.length === 0) {
    alert("سجل البلاغات فارغ بالفعل، لا توجد كروت لحذفها.");
    return;
  }

  const count = AppState.currentIncidents.length;
  const confirmed = confirm(
    `🚨 تحذير: مسح كافة البلاغات (${count} بلاغ)\n\n` +
    `هل تريد بالتأكيد حذف كافة البلاغات المسجلة حالياً من المنظومة وقاعدة البيانات بالكامل؟\n\n` +
    `هذا الإجراء سيقوم بمسح كافة الكروت التجريبية نهائياً لتنظيف السجل.`
  );

  if (!confirmed) return;

  const ids = AppState.currentIncidents.map(i => i.id);
  ids.forEach(id => markIncidentDeleted(id));

  // Firebase wipe
  if (firebaseDb) {
    try {
      await firebaseDb.ref('incidents').remove();
    } catch (e) {}
  }
  try {
    fetch('https://sut-fleet-default-rtdb.firebaseio.com/incidents.json', {
      method: 'DELETE'
    }).catch(() => {});
  } catch (e) {}

  // Python server clear
  try {
    fetch('/api/incidents/clear-all', {
      method: 'POST'
    }).catch(() => {});
  } catch (e) {}

  AppState.currentIncidents = [];
  AppState.selectedIncidentId = null;

  const emptyState = document.getElementById('emptyWorkspaceState');
  const content = document.getElementById('activeWorkspaceContent');
  if (emptyState) emptyState.classList.remove('hidden');
  if (content) content.classList.add('hidden');

  updateKpiSummary();
  renderIncidentsList();
  renderMiniViolationsBreakdown();

  showAdminActionToast(`تم مسح جميع البلاغات (${count} بلاغ) بنجاح.`);
}

function handleIncomingIncidentDeleted(incidentId) {
  markIncidentDeleted(incidentId);
  const existingIdx = AppState.currentIncidents.findIndex(i => i.id === incidentId || i.id.replace(/[^a-zA-Z0-9_-]/g, "") === incidentId);
  if (existingIdx > -1) {
    AppState.currentIncidents.splice(existingIdx, 1);
    if (AppState.selectedIncidentId === incidentId) {
      if (AppState.currentIncidents.length > 0) {
        selectIncidentForDetails(AppState.currentIncidents[0].id, false);
      } else {
        AppState.selectedIncidentId = null;
        const emptyState = document.getElementById('emptyWorkspaceState');
        const content = document.getElementById('activeWorkspaceContent');
        if (emptyState) emptyState.classList.remove('hidden');
        if (content) content.classList.add('hidden');
      }
    }
    updateKpiSummary();
    renderIncidentsList();
    renderMiniViolationsBreakdown();
  }
}

function handleIncomingAllIncidentsCleared() {
  AppState.currentIncidents = [];
  AppState.selectedIncidentId = null;
  const emptyState = document.getElementById('emptyWorkspaceState');
  const content = document.getElementById('activeWorkspaceContent');
  if (emptyState) emptyState.classList.remove('hidden');
  if (content) content.classList.add('hidden');
  updateKpiSummary();
  renderIncidentsList();
  renderMiniViolationsBreakdown();
}

function showAdminActionToast(message, icon = '🗑️') {
  const container = document.getElementById('liveToastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'live-push-toast';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <h4 style="margin:0; font-size:0.85rem; color:#fff;">إدارة أسطول السويدي SUT</h4>
      <p style="margin:2px 0 0 0; font-size:0.78rem; color:#cbd5e1;">${message}</p>
    </div>
    <button class="toast-close-btn" onclick="this.parentElement.remove()">✕</button>
  `;
  container.prepend(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

