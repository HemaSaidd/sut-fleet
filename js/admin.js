/**
 * UniFleet Operations Center - Admin Controller & Live Sync
 * جامعة السويدي للتكنولوجيا (Elsewedy University of Technology - SUT)
 */

const AppState = {
  currentView: 'operations-center',
  selectedIncidentId: null,
  activeFilter: 'ALL',
  searchQuery: '',
  audioAlertsEnabled: true,
  audioContext: null,
  stickerSelectedBusId: '101',
  systemHost: FLEET_DATA.university.defaultHost,
  currentIncidents: [...FLEET_DATA.initialIncidents],
  isLiveConnected: false
};

let firebaseDb = null;

// ==========================================
// INITIALIZATION ON DOM LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Check Admin PIN Auth
  const isAuth = sessionStorage.getItem('sut_admin_authorized') === 'true';
  if (!isAuth) {
    openAdminPinModal();
  } else {
    document.getElementById('adminLogoutBtn')?.classList.remove('hidden');
  }

  // Set default host in sticker input
  if (typeof window !== 'undefined' && window.location.origin) {
    AppState.systemHost = window.location.origin;
  }

  // Connect to Firebase Cloud Realtime Database
  initFirebaseCloud();

  // Render initial tables & analytics
  renderVendorsTable();
  renderViolationBreakdown();
  initStickerGenerator();
  updateKpiSummary();
  renderIncidentsList();

  if (AppState.currentIncidents.length > 0) {
    selectIncidentForDetails(AppState.currentIncidents[0].id);
  }
});

// ==========================================
// ADMIN PIN HANDLERS
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
    // If cancelled without PIN, redirect to student page
    window.location.replace('index.html');
    return;
  }
  const modal = document.getElementById('adminPinModal');
  if (modal) modal.classList.add('hidden');
  document.getElementById('appMainViewport')?.classList.remove('admin-locked');
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
// VIEW SWITCHING
// ==========================================
function switchAdminView(viewId) {
  AppState.currentView = viewId;

  document.querySelectorAll('.switcher-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active-panel'));

  if (viewId === 'operations-center') {
    document.getElementById('tabDashboardView')?.classList.add('active');
    document.getElementById('viewOperationsCenter')?.classList.add('active-panel');
    renderIncidentsList();
  } else if (viewId === 'sticker-generator') {
    document.getElementById('tabStickerView')?.classList.add('active');
    document.getElementById('viewStickerGenerator')?.classList.add('active-panel');
    updateStickerPreview(AppState.stickerSelectedBusId);
  }
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
        statusDot.classList.add('pulsing');
      }

      let isInitialLoad = true;

      // Seed with sample initial incidents if empty
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
          handleIncomingIncidentUpdate({
            incidentId: item.id,
            status: item.status,
            actionsTaken: item.actionsTaken
          });
        }
      });
    } catch (e) {
      console.warn("Firebase Init Error:", e);
    }
  }
}

function handleIncomingLiveIncident(incident, isInitialLoad = false) {
  const existingIdx = AppState.currentIncidents.findIndex(i => i.id === incident.id);
  if (existingIdx > -1) {
    AppState.currentIncidents[existingIdx] = incident;
  } else {
    AppState.currentIncidents.unshift(incident);

    if (!isInitialLoad) {
      playSafetyAlertChime(incident.severity);
      showPushNotificationToast(incident);
    }
  }

  updateKpiSummary();
  renderIncidentsList();

  if (!AppState.selectedIncidentId || !isInitialLoad) {
    selectIncidentForDetails(incident.id);
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

  const toast = document.createElement('div');
  toast.className = `live-push-toast ${incident.severity === 'CRITICAL' ? 'critical-toast' : ''}`;
  toast.innerHTML = `
    <div class="toast-icon">${incident.violationIcon || '🚨'}</div>
    <div class="toast-body">
      <strong>${incident.violationTitle} (${incident.busPlate})</strong>
      <p>${incident.location}</p>
    </div>
    <button class="toast-close-btn" onclick="this.parentElement.remove()">✕</button>
  `;

  container.prepend(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 6000);
}

// ==========================================
// INCIDENTS LIST & SEARCH/FILTER
// ==========================================
function filterIncidents(filterType, element) {
  AppState.activeFilter = filterType;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
  renderIncidentsList();
}

function handleIncidentSearch(query) {
  AppState.searchQuery = query.trim().toLowerCase();
  renderIncidentsList();
}

function renderIncidentsList() {
  const container = document.getElementById('incidentsList');
  if (!container) return;

  let filtered = AppState.currentIncidents.filter(inc => {
    if (AppState.activeFilter === 'CRITICAL' && inc.severity !== 'CRITICAL') return false;
    if (AppState.activeFilter === 'PENDING' && (inc.status === 'RESOLVED' || inc.status === 'FINED')) return false;
    if (AppState.activeFilter === 'RESOLVED' && inc.status !== 'RESOLVED' && inc.status !== 'FINED') return false;

    if (AppState.searchQuery) {
      const q = AppState.searchQuery;
      const matchLine = inc.lineName?.toLowerCase().includes(q);
      const matchPlate = inc.busPlate?.toLowerCase().includes(q);
      const matchVio = inc.violationTitle?.toLowerCase().includes(q);
      const matchDriver = inc.driverName?.toLowerCase().includes(q);
      if (!matchLine && !matchPlate && !matchVio && !matchDriver) return false;
    }
    return true;
  });

  const countPill = document.getElementById('streamCountPill');
  if (countPill) countPill.textContent = `${filtered.length} بلاغات`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.5rem 1rem; text-align: center; color: #64748b;">
        <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">🔍</span>
        <p>لا توجد بلاغات مطابقة لخيارات التصفية</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(inc => {
    const isSelected = inc.id === AppState.selectedIncidentId;
    let sevBadge = `<span style="background:rgba(239,68,68,0.2); color:#f87171; font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px;">حرج 🔴</span>`;
    if (inc.severity === 'MEDIUM') {
      sevBadge = `<span style="background:rgba(245,158,11,0.2); color:#fbbf24; font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px;">متوسط 🟠</span>`;
    } else if (inc.severity === 'LOW') {
      sevBadge = `<span style="background:rgba(59,130,246,0.2); color:#93c5fd; font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px;">ملاحظة 🔵</span>`;
    }

    let statusText = 'بلاغ جديد 🔔';
    let statusClass = 'st-new';
    if (inc.status === 'INVESTIGATING') {
      statusText = 'قيد التحقيق ⏳';
      statusClass = 'st-investigating';
    } else if (inc.status === 'FINED') {
      statusText = 'غرامة معتمدة ⚠️';
      statusClass = 'st-fined';
    } else if (inc.status === 'RESOLVED') {
      statusText = 'تم الحل ✓';
      statusClass = 'st-resolved';
    }

    return `
      <div class="incident-item-card ${isSelected ? 'selected-incident' : ''}" 
           id="card_${inc.id.replace(/[^a-zA-Z0-9]/g, '')}" 
           onclick="selectIncidentForDetails('${inc.id}')">
        <div class="card-top-row">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:1.2rem">${inc.violationIcon || '⚠️'}</span>
            <strong>${inc.violationTitle}</strong>
          </div>
          ${sevBadge}
        </div>
        <div class="card-meta-line">
          <span>🚌 ${inc.busPlate} • ${inc.lineName}</span>
          <span style="color:#64748b">• ${inc.timestamp}</span>
        </div>
        <div class="card-footer-tags">
          <span style="color:#94a3b8">${inc.vendorName}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectIncidentForDetails(incidentId) {
  AppState.selectedIncidentId = incidentId;
  document.querySelectorAll('.incident-item-card').forEach(c => c.classList.remove('selected-incident'));
  const card = document.getElementById(`card_${incidentId.replace(/[^a-zA-Z0-9]/g, '')}`);
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

  const actionsLogHTML = (!incident.actionsTaken || incident.actionsTaken.length === 0)
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
          <span>${incident.violationIcon || '⚠️'}</span>
          <span>${incident.violationTitle}</span>
          ${sevBadge}
        </h2>
        <span class="ws-ticket-id">تذكرة رقم: ${incident.id} • ${incident.timestamp}</span>
      </div>
      <div class="ws-status-group">
        <span class="status-badge st-${incident.status.toLowerCase()}">${getIncidentStatusArabic(incident.status)}</span>
      </div>
    </div>

    <!-- Bus & Driver Intelligence Card -->
    <div class="ws-bus-card">
      <div class="ws-bus-header">
        <div>
          <span class="bus-badge-lg">${incident.busPlate}</span>
          <span class="line-title-lg">${incident.lineName}</span>
        </div>
        <span class="vendor-tag">${incident.vendorName}</span>
      </div>
      <div class="ws-bus-body">
        <div class="driver-contact-row">
          <div class="driver-meta">
            <span class="d-avatar">👤</span>
            <div>
              <strong style="color:#f8fafc">كابتن/ ${incident.driverName}</strong>
              <p style="font-size:0.72rem; color:#94a3b8">سائق معتمد لدى جامعة السويدي للتكنولوجيا</p>
            </div>
          </div>
          <div class="driver-actions">
            <a href="tel:${incident.driverPhone}" class="btn-call-driver">
              📞 اتصال بالسائق (${incident.driverPhone || '01011223344'})
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Location & Incident Description -->
    <div class="ws-section-box">
      <div class="location-banner">
        <span>📍 الموقع المرصود:</span>
        <strong>${incident.location}</strong>
      </div>
      <div class="notes-quote">
        <p>"${incident.notes || 'بلاغ رصد مخالفة أمان مباشر عبر باركود الحافلة'}"</p>
        <span class="reporter-tag">مقدم البلاغ: ${incident.studentName} ${incident.studentPhone ? `(${incident.studentPhone})` : ''}</span>
      </div>
    </div>

    <!-- Media Evidence Attachment -->
    ${incident.attachmentUrl ? `
      <div class="ws-section-box">
        <span class="section-sub-title">📷 دليل المخالفة المرفق من هاتف الطالب:</span>
        <div class="evidence-preview-wrap">
          <img src="${incident.attachmentUrl}" alt="دليل المخالفة" class="evidence-full-img" onclick="window.open(this.src, '_blank')">
        </div>
      </div>
    ` : ''}

    <!-- Investigation Log -->
    <div class="ws-section-box">
      <span class="section-sub-title">📝 سجل تدخلات إدارة الحركة والتحقيق:</span>
      <div class="actions-log-container">
        ${actionsLogHTML}
      </div>
    </div>

    <!-- Action Execution Bar -->
    <div class="ws-action-bar">
      <button class="btn-action btn-act-warn" onclick="executeAdminAction('${incident.id}', 'INVESTIGATING', 'تم الاتصال بالسائق وتوجيه إنذار فوري وتخفيف السرعة')">
        <span>⚠️ توجيه إنذار فوري</span>
      </button>
      <button class="btn-action btn-act-fine" onclick="executeAdminAction('${incident.id}', 'FINED', 'تم توقيع غرامة 500 ج.م على الشركة المشغلة لخرق تعليمات السلامة')">
        <span>💸 توقيع غرامة تعاقدية</span>
      </button>
      <button class="btn-action btn-act-resolve" onclick="executeAdminAction('${incident.id}', 'RESOLVED', 'تم التحقق من الالتزام وإغلاق البلاغ بنجاح')">
        <span>✓ حل البلاغ وإغلاقه</span>
      </button>
    </div>
  `;
}

function getIncidentStatusArabic(status) {
  if (status === 'NEW') return 'بلاغ جديد 🔔';
  if (status === 'INVESTIGATING') return 'قيد المتابعة ⏳';
  if (status === 'FINED') return 'غرامة معتمدة ⚠️';
  if (status === 'RESOLVED') return 'تم الحل والمطابقة ✓';
  return status;
}

async function executeAdminAction(incidentId, newStatus, actionText) {
  const incident = AppState.currentIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const actionEntry = {
    time: timeStr,
    user: "مشرف الحركة SUT",
    text: actionText
  };

  incident.status = newStatus;
  if (!incident.actionsTaken) incident.actionsTaken = [];
  incident.actionsTaken.push(actionEntry);

  // Sync to Firebase
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
// KPI & ANALYTICS SUMMARY
// ==========================================
function updateKpiSummary() {
  const badge = document.getElementById('activeIncidentsBadge');
  const todayKpi = document.getElementById('kpiTodayIncidents');
  const criticalKpi = document.getElementById('kpiCriticalCount');

  const activeCount = AppState.currentIncidents.filter(i => i.status !== 'RESOLVED').length;
  const criticalCount = AppState.currentIncidents.filter(i => i.severity === 'CRITICAL' && i.status !== 'RESOLVED').length;

  if (badge) badge.textContent = activeCount;
  if (todayKpi) todayKpi.textContent = activeCount;
  if (criticalKpi) criticalKpi.textContent = `${criticalCount} حرجة`;
}

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
  alert("📊 تم استخراج بيان خصومات ومخالفات شركات النقل لجامعة السويدي للتكنولوجيا.");
}

// ==========================================
// VIEW 2: STICKER GENERATOR LOGIC
// ==========================================
function initStickerGenerator() {
  const select = document.getElementById('stickerBusSelect');
  if (!select) return;

  select.innerHTML = FLEET_DATA.buses.map(b => `
    <option value="${b.id}">${b.lineName}</option>
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

  if (plateEl) plateEl.textContent = bus.lineName;
  if (lineEl) lineEl.textContent = bus.lineName;
  if (vendorEl) vendorEl.textContent = bus.vendorName || "شركة أبو الهول";

  // The actual full URL encoded into the QR code for students:
  // Points directly to the root report form (index.html?bus=101)
  const targetUrl = `${AppState.systemHost}/?bus=${bus.id}`;

  if (urlDisplay) {
    urlDisplay.textContent = targetUrl;
  }

  // Generate ISO/IEC 18004 Vector SVG QR code
  if (qrHolder && window.PureSVGQRGenerator) {
    qrHolder.innerHTML = PureSVGQRGenerator.generateSVG(targetUrl, 180, "#000000", "#ffffff");
  }
}

function testQrScanningLink() {
  const bus = FLEET_DATA.buses.find(b => b.id === AppState.stickerSelectedBusId) || FLEET_DATA.buses[0];
  const targetUrl = `${AppState.systemHost}/?bus=${bus.id}`;
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
    if (typeof event !== 'undefined' && event && event.target) event.target.classList.add('active');
  } else {
    if (sheet) sheet.style.width = '480px';
    if (typeof event !== 'undefined' && event && event.target) event.target.classList.add('active');
  }
}
