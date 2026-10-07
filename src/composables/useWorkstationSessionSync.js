/**
 * useWorkstationSessionSync Composable
 * Encapsulates:
 * 1. BroadcastChannel instant cross-tab sync (`omnitrack_workstation_channel`).
 * 2. Active stopwatch synchronization to local storage and backend (`sync_active_session`).
 * 3. Session restore logic with clock-skew resilience and status reconciliation. A long session is
 *    restored and asked about (InactivityGovernorModal), never evicted on load.
 * 4. Ended session tombstone tracking (`_ENDED_KEY`, `markSessionEnded`, `wasEndedHere`, `unmarkSessionEnded`).
 * 5. Multi-device remote session reconciliation (`reconcileActiveSession`, `handleRemoteSessionCleared`).
 * 6. Background polling & phone-wake synchronization (`checkRemoteActiveSession`).
 */

import * as Vue from "vue";
import { toKind } from "../utils/activity.js";
const { ref, nextTick } = Vue;

export function useWorkstationSessionSync({
  postJSON,
  showToast,
  isTracking,
  startTime,
  trackerSeconds,
  trackerTimer,
  trackerNotes,
  selectedNature,
  trackerNature,
  selectedProject,
  trackerProject,
  trackerBlockName,
  sessionNotesList,
  sessionTasks,
  sessionNotesScroll,
  workBlocks,
  workFocusBlocks,
  lastActivityTime,
  lastInactivityAlertTime,
  selectedEmployee,
  activeTab,
  fetchWorkstationData,
  fetchPlannerData,
  checkInactivity,
  checkBlockOverrun,
  getLocalTodayISO
}) {
  let _syncDebounceTimer = null;
  let _lastLocalUpdate = Date.now();
  let _lastLocalStop = 0;
  let _isStoppingSession = false;
  let _isCheckingActiveSession = false;
  let _isRestoring = false;

  // Phase 4: Instant Cross-Tab Broadcast Channel Sync
  let _omnitrackChannel = null;
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      _omnitrackChannel = new BroadcastChannel('omnitrack_workstation_channel');
      _omnitrackChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.type) return;
        if (data.type === 'session_sync' && data.payload) {
          if (!_isStoppingSession) {
            restoreActiveSession(data.payload);
          }
        } else if (data.type === 'session_cleared') {
          if (isTracking.value) {
            isTracking.value = false;
            if (trackerTimer.value) clearInterval(trackerTimer.value);
            trackerTimer.value = null;
            trackerSeconds.value = 0;
          }
        }
      };
    } catch (e) {}
  }

  const broadcastSessionCleared = () => {
    try {
      if (_omnitrackChannel) {
        _omnitrackChannel.postMessage({ type: 'session_cleared' });
      }
    } catch (e) {}
  };

  const setStoppingSession = (val, durationMs = 0) => {
    _isStoppingSession = val;
    if (val && durationMs > 0) {
      setTimeout(() => { _isStoppingSession = false; }, durationMs);
    }
  };

  const getIsStoppingSession = () => _isStoppingSession;

  const setLastLocalStop = (t = Date.now()) => {
    _lastLocalStop = t;
  };

  const getLastLocalStop = () => _lastLocalStop;

  const setLastLocalUpdate = (t = Date.now()) => {
    _lastLocalUpdate = t;
  };

  const getLastLocalUpdate = () => _lastLocalUpdate;

  const cancelSyncDebounce = () => {
    if (_syncDebounceTimer) {
      clearTimeout(_syncDebounceTimer);
      _syncDebounceTimer = null;
    }
  };

  // Ended session storage & tombstone helpers
  const _ENDED_KEY = 'omnitrack_ended_sessions';
  const _endedSessions = new Set();
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
      sessionTasks: sessionTasks.value,
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
    // A long or overnight session is never thrown away here. Loading a page is not a choice the
    // person made, and the server copy is the only one other devices have. It is restored as it
    // was; its last activity is old, so the first tick of checkInactivity opens the "still
    // working?" dialog, which offers stop at the last note, keep running, or discard.

    // If bound to a work block, handle status reconciliation gracefully
    if (sessionData.trackerBlockName) {
      const matched = (workBlocks.value || []).find(b => b.name === sessionData.trackerBlockName) ||
                      ((workFocusBlocks && workFocusBlocks.value) || []).find(b => b.name === sessionData.trackerBlockName);
      if (matched) {
        if (sessionData.status === 'active') {
          matched.status = 'In Progress';
        } else if (matched.status === 'Logged (Full)' || matched.status === 'Logged (Over)' || matched.status === 'Logged (Partial)' || matched.status === 'Completed' || matched.status === 'Cancelled' || matched.status === 'Missed') {
          markSessionEnded();
          localStorage.removeItem('omnitrack_active_session');
          return false;
        }
      }
    }

    _isRestoring = true;
    try {
      isTracking.value = true;
      startTime.value = startMs;
      trackerSeconds.value = elapsed;
      selectedNature.value = toKind(sessionData.selectedNature);
      trackerNature.value = toKind(sessionData.selectedNature);
      selectedProject.value = sessionData.selectedProject || '';
      trackerProject.value = sessionData.selectedProject || '';
      let rawN = sessionData.trackerNotes || '';
      if (rawN.includes('•') && (!sessionData.sessionNotesList || sessionData.sessionNotesList.length === 0)) {
        const parts = rawN.split('•').map(s => s.trim()).filter(Boolean);
        trackerNotes.value = parts[0] || '';
        sessionNotesList.value = parts.slice(1);
      } else {
        trackerNotes.value = rawN;
        sessionNotesList.value = Array.isArray(sessionData.sessionNotesList) ? sessionData.sessionNotesList : [];
      }
      sessionTasks.value = Array.isArray(sessionData.sessionTasks) ? sessionData.sessionTasks : [];
      trackerBlockName.value = sessionData.trackerBlockName || null;
      const sLastAct = Number(sessionData.lastActivityTime) || 0;
      const sLastUpd = Number(sessionData.lastUpdated) || 0;
      lastActivityTime.value = Math.max(sLastAct, sLastUpd) || Date.now();

      const clockSkewMs = (startMs > Date.now()) ? (startMs - Date.now()) : 0;
      if (trackerTimer.value) clearInterval(trackerTimer.value);
      trackerTimer.value = setInterval(() => {
        const curLocalElapsed = Math.floor((Date.now() + clockSkewMs - startMs) / 1000);
        trackerSeconds.value = Math.max(0, curLocalElapsed);
        if (typeof checkInactivity === 'function') checkInactivity();
        if (typeof checkBlockOverrun === 'function') checkBlockOverrun();
      }, 1000);

      localStorage.setItem('omnitrack_active_session',
        JSON.stringify(Object.assign({}, sessionData, { status: 'active' })));
      return true;
    } finally {
      nextTick(() => { _isRestoring = false; });
    }
  };

  let _lastClearedToast = 0;
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
    sessionTasks.value = [];
    trackerNotes.value = '';
    trackerBlockName.value = null;
    markSessionEnded();
    localStorage.removeItem('omnitrack_active_session');
    if (!(opts && opts.silent) && typeof fetchWorkstationData === 'function') {
      fetchWorkstationData(selectedEmployee ? selectedEmployee.value : 'All');
    }
    if (typeof fetchPlannerData === 'function' && activeTab && activeTab.value === 'planner') {
      fetchPlannerData();
    }
    if (!(opts && opts.silent) && Date.now() - _lastClearedToast > 30000) {
      _lastClearedToast = Date.now();
      showToast('Session saved on another device', 'info');
    }
  };

  const reconcileActiveSession = (remote) => {
    if (_isStoppingSession || (Date.now() - _lastLocalStop < 10000)) {
      handleRemoteSessionCleared({ silent: true });
      return;
    }
    if (remote && remote.startTime && wasEndedHere(remote.startTime) && !isTracking.value) {
      const remoteHeartbeat = Number(remote.lastUpdated || remote.startTime || 0);
      if (remote.status === 'active' && remoteHeartbeat > _lastLocalStop) {
        unmarkSessionEnded(remote.startTime);
      } else {
        handleRemoteSessionCleared({ silent: true });
        return;
      }
    }
    if (!remote || remote.status !== 'active') {
      if (!isTracking.value || Date.now() - _lastLocalUpdate >= 15000) {
        handleRemoteSessionCleared();
      }
      return;
    }

    if (!isTracking.value) {
      restoreActiveSession(remote);
      showToast('Live session synced from mobile', 'info');
      return;
    }

    if (remote.startTime && (remote.trackerBlockName !== trackerBlockName.value || Math.abs(Number(remote.startTime) - (Number(startTime.value) || 0)) > 60000)) {
      restoreActiveSession(remote);
      showToast('Switched to active session from cloud', 'info');
      return;
    }

    if (Date.now() - _lastLocalUpdate < 1200) return;

    const remoteLines = Array.isArray(remote.sessionNotesList) ? remote.sessionNotesList : [];
    const localLines = sessionNotesList.value || [];
    if (JSON.stringify(remoteLines) !== JSON.stringify(localLines)) {
      sessionNotesList.value = [...remoteLines];
      nextTick(() => {
        if (sessionNotesScroll && sessionNotesScroll.value) {
          sessionNotesScroll.value.scrollTop = sessionNotesScroll.value.scrollHeight;
        }
      });
    }

    const remoteTasks = Array.isArray(remote.sessionTasks) ? remote.sessionTasks : [];
    if (JSON.stringify(remoteTasks) !== JSON.stringify(sessionTasks.value || [])) {
      sessionTasks.value = [...remoteTasks];
    }

    if (remote.trackerNotes !== undefined && remote.trackerNotes !== trackerNotes.value) {
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
      const isNotesFocused = activeEl && (
        activeEl.getAttribute('aria-label') === 'Deliverable or task title' ||
        (activeEl.tagName === 'INPUT' && activeEl.placeholder && activeEl.placeholder.includes('Deliverable'))
      );
      if (!isNotesFocused) {
        trackerNotes.value = remote.trackerNotes || '';
      }
    }

    if (remote.selectedProject !== undefined && remote.selectedProject !== selectedProject.value) {
      selectedProject.value = remote.selectedProject || '';
      trackerProject.value = remote.selectedProject || '';
    }
    if (remote.selectedNature !== undefined && toKind(remote.selectedNature) !== selectedNature.value) {
      selectedNature.value = toKind(remote.selectedNature);
      trackerNature.value = toKind(remote.selectedNature);
    }

    if (remote.trackerBlockName !== undefined && remote.trackerBlockName !== trackerBlockName.value) {
      trackerBlockName.value = remote.trackerBlockName || null;
    }

    localStorage.setItem('omnitrack_active_session', JSON.stringify(Object.assign({}, remote, { status: 'active' })));
  };

  const checkRemoteActiveSession = async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (_isCheckingActiveSession) return;
    if (_isStoppingSession || (Date.now() - _lastLocalStop < 10000)) return;
    _isCheckingActiveSession = true;
    try {
      const res = await fetch(`/api/method/omnitrack.api.get_active_session?_=${Date.now()}`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        const active = data.message;
        if (active && active.status === 'active') {
          reconcileActiveSession(active);
        } else if (!active && isTracking.value) {
          if (Date.now() - _lastLocalUpdate < 15000) {
            syncActiveSession(true);
          } else {
            handleRemoteSessionCleared({ silent: true });
          }
        }
      }
    } catch (e) {
    } finally {
      _isCheckingActiveSession = false;
    }
  };

  return {
    syncActiveSession,
    restoreActiveSession,
    reconcileActiveSession,
    handleRemoteSessionCleared,
    checkRemoteActiveSession,
    markSessionEnded,
    unmarkSessionEnded,
    wasEndedHere,
    broadcastSessionCleared,
    setStoppingSession,
    getIsStoppingSession,
    setLastLocalStop,
    getLastLocalStop,
    setLastLocalUpdate,
    getLastLocalUpdate,
    cancelSyncDebounce,
    isRestoring: () => _isRestoring
  };
}
