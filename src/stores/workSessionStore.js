import * as Vue from "vue";
import { WORK, toKind } from "../utils/activity.js";
const { ref, computed } = Vue;

export function useWorkSessionStore({
  postJSON,
  showToast,
  csrfToken,
  fetchWorkstationData,
  fetchPlannerData,
  selectedEmployee,
  todayDate,
  yesterdayDate,
  minTimesheetDate,
  isManager,
  triggerHaptic
}) {
  const isTracking = ref(false);
  const trackerSeconds = ref(0);
  const trackerTimer = ref(null);
  const trackerNotes = ref('');
  const selectedNature = ref(WORK);
  const selectedProject = ref('');
  const trackerProject = selectedProject;
  const trackerNature = selectedNature;
  const trackerBlockName = ref(null);
  const startTime = ref(null);
  const sessionNotesList = ref([]);
  const discardConfirm = ref(false);
  const isSessionElevated = ref(false);
  const lastActivityTime = ref(Date.now());
  const lastInactivityAlertTime = ref(0);
  const notificationPermission = ref(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');

  // Modals state
  const showAdjustModal = ref(false);
  const adjustMode = ref('keep_running'); // 'keep_running' | 'stop_and_log'
  const originalStartTimeFormatted = ref('');
  const adjustForm = ref({
    work_date: '',
    from_time: '09:00',
    to_time: '10:00',
    notes: ''
  });
  const showRunawayAlertModal = ref(false);
  const runawayGuardData = ref({ elapsed_hours: 0, suggested_cap_hours: 0, reason: '', started_at_str: '' });
  const runawayChoice = ref('cap'); // 'keep' | 'cap' | 'custom'
  const showEmptyStopModal = ref(false);
  const emptyStopQuickNote = ref('');
  const emptyStopElapsedHrs = ref(0);
  const showInactivityModal = ref(false);
  const inactivityMinutes = ref(30);
  const showEODModal = ref(false);
  const showEditSessionModal = ref(false);
  const isSavingEditSession = ref(false);
  const editSessionTargetBlock = ref(null);
  const editSessionForm = ref({
    name: '',
    session_date: '',
    from_time: '',
    to_time: '',
    notes: ''
  });

  // Cross-device and tab synchronization
  let _syncDebounceTimer = null;
  let _lastLocalUpdate = Date.now();
  let _lastLocalStop = 0;
  let _isStoppingSession = false;
  let _isCheckingActiveSession = false;
  let _isRestoring = false;
  const _ENDED_KEY = 'omnitrack_ended_sessions';
  const _endedSessions = new Set();
  const _omnitrackChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('omnitrack_workstation_bus') : null;

  const _readEndedStore = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(_ENDED_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(e => e && Date.now() - Number(e.at || 0) < 21600000) : [];
    } catch (e) { return []; }
  };

  const markSessionEnded = (sTime) => {
    const add = [];
    try {
      if (sTime) add.push(Math.round(Number(sTime)));
      const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
      if (p && p.startTime) add.push(Math.round(Number(p.startTime)));
    } catch (e) {}
    add.forEach(t => _endedSessions.add(t));
    try {
      const store = _readEndedStore();
      add.forEach(t => { if (!store.some(e => Math.abs(Number(e.start) - t) < 5000)) store.push({ start: t, at: Date.now() }); });
      localStorage.setItem(_ENDED_KEY, JSON.stringify(store.slice(-40)));
    } catch (e) {}
  };

  const wasEndedHere = (sTime) => {
    const t = Math.round(Number(sTime));
    if (!t) return false;
    for (const ended of _endedSessions) if (Math.abs(ended - t) < 5000) return true;
    return _readEndedStore().some(e => Math.abs(Number(e.start) - t) < 5000);
  };

  const unmarkSessionEnded = (sTime) => {
    if (!sTime) return;
    const t = Math.round(Number(sTime));
    for (const ended of Array.from(_endedSessions)) {
      if (Math.abs(ended - t) < 5000) _endedSessions.delete(ended);
    }
    try {
      const store = _readEndedStore().filter(e => Math.abs(Number(e.start) - t) >= 5000);
      localStorage.setItem(_ENDED_KEY, JSON.stringify(store));
    } catch (e) {}
  };

  const recordUserActivity = () => {
    lastActivityTime.value = Date.now();
  };

  const bottomBarTimer = computed(() => {
    const s = trackerSeconds.value || 0;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    const isHours = hours > 0;
    return {
      hours,
      minutes,
      seconds,
      isHours,
      formatted: isHours 
        ? `${hours}h ${String(minutes).padStart(2, '0')}m`
        : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  });

  const formattedTime = computed(() => {
    const s = trackerSeconds.value || 0;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  const sessionHasLines = computed(() =>
    (sessionNotesList.value || []).some(p => String(p || '').trim().length >= 3) ||
    String(trackerNotes.value || '').trim().length >= 3 ||
    !!trackerBlockName.value
  );

  const syncActiveSession = (immediate = false) => {
    if (!isTracking.value) {
      markSessionEnded();
      localStorage.removeItem('omnitrack_active_session');
      if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
      postJSON('sync_active_session', { session_data: null }).catch(() => {});
      return;
    }

    if (_isStoppingSession) return;
    _lastLocalUpdate = Date.now();

    const curStart = Number(startTime.value) || (Date.now() - (trackerSeconds.value * 1000));
    const payload = {
      startTime: curStart,
      selectedNature: selectedNature.value,
      selectedProject: selectedProject.value,
      trackerNotes: trackerNotes.value,
      trackerBlockName: trackerBlockName.value,
      sessionNotesList: sessionNotesList.value,
      lastActivityTime: lastActivityTime.value || _lastLocalUpdate,
      lastUpdated: _lastLocalUpdate,
      status: 'active'
    };
    localStorage.setItem('omnitrack_active_session', JSON.stringify(payload));
    try {
      if (_omnitrackChannel) {
        _omnitrackChannel.postMessage({ type: 'session_sync', payload });
      }
    } catch (e) {}

    const sendToServer = () => {
      postJSON('sync_active_session', { session_data: payload }).catch(() => {});
    };

    if (immediate) {
      if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
      sendToServer();
    } else {
      if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
      _syncDebounceTimer = setTimeout(sendToServer, 500);
    }
  };

  const handleRemoteSessionCleared = (opts) => {
    if (!isTracking.value) return;
    if (Date.now() - _lastLocalUpdate < 15000) return;

    isTracking.value = false;
    startTime.value = null;
    if (trackerTimer.value) {
      clearInterval(trackerTimer.value);
      trackerTimer.value = null;
    }
    trackerSeconds.value = 0;
    sessionNotesList.value = [];
    trackerNotes.value = '';
    trackerBlockName.value = null;
    markSessionEnded();
    localStorage.removeItem('omnitrack_active_session');
    if (!(opts && opts.silent) && fetchWorkstationData) {
      fetchWorkstationData(selectedEmployee ? selectedEmployee.value : null);
    }
    if (!(opts && opts.silent) && fetchPlannerData) {
      fetchPlannerData();
    }
    if (!(opts && opts.silent)) {
      showToast('Timesheet session saved on other device', 'info');
    }
  };

  const restoreActiveSession = (sessionData) => {
    if (!sessionData || !sessionData.startTime) return false;
    if (sessionData.status && sessionData.status !== 'active') return false;
    if (_isStoppingSession || (Date.now() - _lastLocalStop < 10000)) return false;

    if (wasEndedHere(sessionData.startTime)) {
      const remoteHeartbeat = Number(sessionData.lastUpdated || sessionData.startTime || 0);
      if (sessionData.status === 'active' && remoteHeartbeat > _lastLocalStop) {
        unmarkSessionEnded(sessionData.startTime);
      } else {
        return false;
      }
    }

    const startMs = Number(sessionData.startTime);
    const serverHeartbeat = Number(sessionData.lastUpdated || sessionData.lastActivityTime || 0);
    const serverElapsed = (serverHeartbeat > startMs) ? Math.floor((serverHeartbeat - startMs) / 1000) : 0;
    const localElapsed = Math.floor((Date.now() - startMs) / 1000);
    const elapsed = Math.max(0, Math.max(serverElapsed, localElapsed));
    if (elapsed >= 86400 || elapsed >= 10 * 3600) return false;

    _isRestoring = true;
    try {
      isTracking.value = true;
      startTime.value = startMs;
      trackerSeconds.value = elapsed;
      selectedNature.value = toKind(sessionData.selectedNature);
      selectedProject.value = sessionData.selectedProject || '';
      let rawN = sessionData.trackerNotes || '';
      if (rawN.includes('•') && (!sessionData.sessionNotesList || sessionData.sessionNotesList.length === 0)) {
        const parts = rawN.split('•').map(s => s.trim()).filter(Boolean);
        trackerNotes.value = parts[0] || '';
        sessionNotesList.value = parts.slice(1);
      } else {
        trackerNotes.value = rawN;
        sessionNotesList.value = Array.isArray(sessionData.sessionNotesList) ? sessionData.sessionNotesList : [];
      }
      trackerBlockName.value = sessionData.trackerBlockName || null;
      const sLastAct = Number(sessionData.lastActivityTime) || 0;
      const sLastUpd = Number(sessionData.lastUpdated) || 0;
      lastActivityTime.value = Math.max(sLastAct, sLastUpd) || Date.now();

      const clockSkewMs = (startMs > Date.now()) ? (startMs - Date.now()) : 0;
      if (trackerTimer.value) clearInterval(trackerTimer.value);
      trackerTimer.value = setInterval(() => {
        const curLocalElapsed = Math.floor((Date.now() + clockSkewMs - startMs) / 1000);
        trackerSeconds.value = Math.max(0, curLocalElapsed);
        checkInactivity();
      }, 1000);

      localStorage.setItem('omnitrack_active_session', JSON.stringify(Object.assign({}, sessionData, { status: 'active' })));
      return true;
    } finally {
      Vue.nextTick(() => { _isRestoring = false; });
    }
  };

  const checkInactivity = () => {
    if (!isTracking.value) return;
    const now = Date.now();
    const INACTIVITY_MS = 30 * 60 * 1000;
    const REPEAT_MS = 15 * 60 * 1000;
    const idleMs = now - (lastActivityTime.value || now);
    if (idleMs >= INACTIVITY_MS) {
      const timeSinceAlert = now - (lastInactivityAlertTime.value || 0);
      if (!lastInactivityAlertTime.value || timeSinceAlert >= REPEAT_MS) {
        lastInactivityAlertTime.value = now;
        showInactivityModal.value = true;
      }
    }
  };

  const toggleTrack = async (customEndMs = null, customStartMs = null) => {
    if (triggerHaptic) triggerHaptic([40]);
    if (!isTracking.value) {
      _isStoppingSession = false;
      _lastLocalStop = 0;
      isTracking.value = true;
      const sTime = customStartMs ? Number(customStartMs) : Date.now();
      unmarkSessionEnded(sTime);
      startTime.value = sTime;
      trackerSeconds.value = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
      lastActivityTime.value = Date.now();
      lastInactivityAlertTime.value = 0;
      _lastLocalUpdate = Date.now();
      syncActiveSession(true);
      trackerTimer.value = setInterval(() => {
        trackerSeconds.value = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
        checkInactivity();
      }, 1000);
      showToast(`Focus timer started for ${selectedNature.value}`, 'info');
    } else {
      if (!sessionHasLines.value) {
        const elapsedSecs = trackerSeconds.value;
        emptyStopElapsedHrs.value = Math.max(0.01, Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100);
        emptyStopQuickNote.value = String(trackerNotes.value || '').trim() || 'Focus work session';
        showEmptyStopModal.value = true;
        return;
      }
      if (triggerHaptic) triggerHaptic([40, 50, 40]);
      let sTime = null;
      try {
        const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
        if (p && p.startTime) sTime = Number(p.startTime);
      } catch (e) {}
      _lastLocalStop = Date.now();
      _isStoppingSession = true;
      isTracking.value = false;
      isSessionElevated.value = false;
      if (trackerTimer.value) clearInterval(trackerTimer.value);
      trackerTimer.value = null;
      markSessionEnded(sTime);
      localStorage.removeItem('omnitrack_active_session');
      if (_syncDebounceTimer) { clearTimeout(_syncDebounceTimer); _syncDebounceTimer = null; }
      postJSON('sync_active_session', { session_data: null }).catch(() => {});
      try {
        if (_omnitrackChannel) _omnitrackChannel.postMessage({ type: 'session_cleared' });
      } catch (e) {}

      let elapsedSecs = trackerSeconds.value;
      let effectiveStopMs = Date.now();
      if (customEndMs && customEndMs < effectiveStopMs) {
        effectiveStopMs = customEndMs;
        if (sTime) {
          if (effectiveStopMs < sTime) effectiveStopMs = sTime + 60000;
          elapsedSecs = Math.max(60, Math.floor((effectiveStopMs - sTime) / 1000));
        } else {
          elapsedSecs = Math.min(elapsedSecs, Math.max(60, Math.floor((effectiveStopMs - (Date.now() - elapsedSecs * 1000)) / 1000)));
        }
      }
      trackerSeconds.value = 0;
      const hrs = Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100;
      const boundBlock = trackerBlockName.value;
      trackerBlockName.value = null;
      const rawTitle = (trackerNotes.value || '').trim();
      const bullets = sessionNotesList.value.filter(p => p.trim()).map(p => `• ${p.trim()}`).join('\n');
      const finalNotes = (rawTitle && bullets) ? `${rawTitle}\n\n${bullets}` : (rawTitle || bullets || `Focus session (${selectedNature.value})`);
      sessionNotesList.value = [];

      const now = new Date(effectiveStopMs);
      const from = new Date(now.getTime() - elapsedSecs * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      const sessionDate = from.getFullYear() + '-' + pad(from.getMonth() + 1) + '-' + pad(from.getDate());

      if (boundBlock) {
        try {
          await postJSON('log_work_session', {
            block_name: boundBlock,
            session_date: sessionDate,
            from_time: pad(from.getHours()) + ':' + pad(from.getMinutes()),
            to_time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
            hours: hrs,
            notes: finalNotes,
            logged_via: 'Stopwatch'
          });
          showToast(`Logged ${hrs.toFixed(2)}h against focus block`, 'success');
          trackerNotes.value = '';
          if (fetchWorkstationData) fetchWorkstationData(selectedEmployee ? selectedEmployee.value : null);
          if (fetchPlannerData) await fetchPlannerData();
        } catch (err) {
          showToast('Could not log session: ' + (err && err.message || err), 'danger');
        } finally {
          setTimeout(() => { _isStoppingSession = false; }, 8000);
        }
        return;
      }

      try {
        await postJSON('quick_timer_punch', {
          action: 'stop',
          duration_seconds: elapsedSecs,
          duration_hours: hrs,
          from_time: pad(from.getHours()) + ':' + pad(from.getMinutes()),
          to_time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
          work_date: sessionDate,
          work_nature: selectedNature.value,
          task_nature: selectedNature.value,
          deliverable_notes: finalNotes,
          notes: finalNotes,
          project: selectedProject.value
        });
        showToast(`Logged ${hrs.toFixed(2)} hrs successfully!`, 'success');
        trackerNotes.value = '';
        if (fetchWorkstationData) fetchWorkstationData(selectedEmployee ? selectedEmployee.value : null);
        if (fetchPlannerData) fetchPlannerData();
      } catch (err) {
        showToast('Timer punch recorded locally.', 'success');
      } finally {
        setTimeout(() => { _isStoppingSession = false; }, 8000);
      }
    }
  };

  const discardSession = () => {
    if (!isTracking.value) return;
    if (!discardConfirm.value) {
      discardConfirm.value = true;
      showToast('Discard this session? Press Discard again — nothing will be saved.', 'warning');
      setTimeout(() => { discardConfirm.value = false; }, 6000);
      return;
    }
    discardConfirm.value = false;
    let sTime = null;
    try {
      const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
      if (p && p.startTime) sTime = Number(p.startTime);
    } catch (e) {}
    _lastLocalStop = Date.now();
    _isStoppingSession = true;
    isTracking.value = false;
    startTime.value = null;
    isSessionElevated.value = false;
    if (trackerTimer.value) clearInterval(trackerTimer.value);
    trackerTimer.value = null;
    markSessionEnded(sTime);
    localStorage.removeItem('omnitrack_active_session');
    if (_syncDebounceTimer) { clearTimeout(_syncDebounceTimer); _syncDebounceTimer = null; }
    postJSON('sync_active_session', { session_data: null }).catch(() => {});
    try {
      if (_omnitrackChannel) _omnitrackChannel.postMessage({ type: 'session_cleared' });
    } catch (e) {}
    trackerSeconds.value = 0;
    trackerBlockName.value = null;
    trackerNotes.value = '';
    sessionNotesList.value = [];
    showToast('Session discarded — no timesheet was created', 'info');
    setTimeout(() => { _isStoppingSession = false; }, 8000);
  };

  return {
    isTracking,
    trackerSeconds,
    trackerTimer,
    trackerNotes,
    selectedNature,
    selectedProject,
    trackerProject,
    trackerNature,
    trackerBlockName,
    startTime,
    sessionNotesList,
    discardConfirm,
    isSessionElevated,
    lastActivityTime,
    lastInactivityAlertTime,
    notificationPermission,
    showAdjustModal,
    adjustMode,
    originalStartTimeFormatted,
    adjustForm,
    showRunawayAlertModal,
    runawayGuardData,
    runawayChoice,
    showEmptyStopModal,
    emptyStopQuickNote,
    emptyStopElapsedHrs,
    showInactivityModal,
    inactivityMinutes,
    showEODModal,
    showEditSessionModal,
    isSavingEditSession,
    editSessionTargetBlock,
    editSessionForm,
    bottomBarTimer,
    formattedTime,
    sessionHasLines,
    syncActiveSession,
    handleRemoteSessionCleared,
    restoreActiveSession,
    recordUserActivity,
    checkInactivity,
    toggleTrack,
    discardSession
  };
}
