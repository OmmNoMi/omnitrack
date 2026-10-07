import { ref, computed } from "vue";
import { blockTitle } from '../utils/blockTitle.js';
import { composeWrapNote } from '../utils/wrapNote.js';
import { countSessionWords, minSessionWords } from '../utils/sessionWords.js';

/**
 * Workstation API methods.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationApi(w) {
  const { _errText, _explicitBoundBlock, activeBlock, activeTab, assignedTasks, attentionTasks, broadcastSessionCleared, cancelSyncDebounce, checkBlockOverrun, checkInactivity, currentUser, discardConfirm, getIsStoppingSession, getLastLocalStop, getLastLocalUpdate, getLocalTodayISO, getNatureBadge, isSessionElevated, isTracking, lastActivityTime, lastInactivityAlertTime, markSessionEnded, newSessionPoint, notificationPermission, openSessionCard, plannerData, postJSON, projects, refuseEmptySession, restoreActiveSession, selectedDashboardDate, selectedEmployee, selectedNature, selectedProject, sessionHasLines, sessionNotesList, setLastLocalStop, setLastLocalUpdate, setStoppingSession, showToast, startTime, stopConfirmName, syncActiveSession, synthesizerLogs, tasks, teamMembers, todayDate, trackerBlockName, trackerBoundBlock, trackerNature, trackerNotes, trackerProject, trackerSeconds, trackerTimer, triggerHaptic, unmarkSessionEnded, updateDashboardKPIs, wasEndedHere, workBlocks } = w;
  const fetchAttendancePresence = (...args) => w.fetchAttendancePresence(...args);
  const fetchPlannerData = (...args) => w.fetchPlannerData(...args);

  // 8. API Methods
  const fetchWorkstationData = async (emp = 'All') => {
    try {
      const url = `/api/method/omnitrack.api.get_workstation_data?employee=${encodeURIComponent(emp)}&_=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data && data.message) {
        const m = data.message;
        workBlocks.value = m.work_blocks || [];
        projects.value = m.projects || [];
        tasks.value = m.tasks || [];
        assignedTasks.value = m.assigned_tasks || [];
        attentionTasks.value = m.attention_tasks || [];
        if (m.team_members && m.team_members.length) {
          teamMembers.value = m.team_members;
        }
        synthesizerLogs.value = m.synthesizer_logs || [];
        if (m.today_date) {
          const localToday = getLocalTodayISO();
          todayDate.value = localToday || m.today_date;
          if (!selectedDashboardDate.value) {
            selectedDashboardDate.value = todayDate.value;
          }
        }
        if (m.current_user) currentUser.value = m.current_user;
        if (m.kpis) updateDashboardKPIs(m.kpis);

        // Evict zombie local session if the bound block is already logged/completed
        // (Only for stale sessions older than 15s to avoid racing newly started local tracking)
        if (isTracking.value && trackerBlockName.value && (Date.now() - (getLastLocalUpdate() || 0) >= 15000)) {
          const curBlock = (workBlocks.value || []).find(b => b.name === trackerBlockName.value);
          if (curBlock && (curBlock.status === 'Logged (Full)' || curBlock.status === 'Logged (Over)' || curBlock.status === 'Logged (Partial)' || curBlock.status === 'Completed' || curBlock.status === 'Cancelled' || curBlock.status === 'Missed')) {
            if (m.active_session && m.active_session.status === 'active') {
              curBlock.status = 'In Progress';
              if (m.active_session.trackerBlockName !== trackerBlockName.value) {
                restoreActiveSession(m.active_session);
              }
            } else {
              isTracking.value = false;
              if (trackerTimer.value) clearInterval(trackerTimer.value);
              trackerTimer.value = null;
              trackerSeconds.value = 0;
              startTime.value = null;
              sessionNotesList.value = [];
              trackerNotes.value = '';
              trackerBlockName.value = null;
              markSessionEnded();
              localStorage.removeItem('omnitrack_active_session');
            }
          }
        }

        // Multi-device active session sync (computer <-> mobile phone)
        if (m.active_session && m.active_session.status === 'active' && m.active_session.startTime
            && !getIsStoppingSession() && (Date.now() - (getLastLocalStop() || 0) >= 10000)) {
          if (wasEndedHere(m.active_session.startTime)) {
            const srvTime = Number(m.active_session.lastUpdated || m.active_session.startTime || 0);
            if (srvTime > (getLastLocalStop() || 0)) {
              unmarkSessionEnded(m.active_session.startTime);
            }
          }
          if (!wasEndedHere(m.active_session.startTime)) {
            const serverLines = Array.isArray(m.active_session.sessionNotesList) ? m.active_session.sessionNotesList : [];
            const localLines = sessionNotesList.value || [];
            const serverTime = Number(m.active_session.lastUpdated || m.active_session.startTime || 0);
            if (!isTracking.value || serverLines.length >= localLines.length || serverTime > (getLastLocalUpdate() || 0)) {
              restoreActiveSession(m.active_session);
            }
          }
        } else if (m.active_session === null && isTracking.value) {
          const localAge = Date.now() - (getLastLocalUpdate() || 0);
          if (localAge >= 15000) {
            isTracking.value = false;
            if (trackerTimer.value) clearInterval(trackerTimer.value);
            trackerSeconds.value = 0;
            sessionNotesList.value = [];
            trackerNotes.value = '';
            trackerBlockName.value = null;
            markSessionEnded();
            localStorage.removeItem('omnitrack_active_session');
            showToast('Session was completed on another device', 'info');
          } else {
            syncActiveSession(true);
          }
        }

        // Sync Pillar 2 attendance presence variance
        fetchAttendancePresence();
      }
    } catch (e) {
      console.error("API error:", e);
    }
  };
  const onEmployeeChange = () => {
    fetchWorkstationData(selectedEmployee.value);
    if (typeof fetchPlannerData === 'function' && activeTab.value === 'planner') {
      fetchPlannerData();
    }
    showToast(`Viewing ${selectedEmployee.value === 'All' ? 'All Team Members' : selectedEmployee.value}`, 'info');
  };
  // A session started by mistake (or abandoned because something else came up)
  // must be throwable away. Two-step, because it drops the elapsed time.
  let _discardTimer = null;
  // Stop & Save and Discard are one control: a single tab stop, arrows between
  // them (WAI-ARIA toolbar), so Tab never lands on Discard by accident.
  // The roving index is Vue state, not a tabindex the handler pokes into the
  // DOM. Written straight to the DOM it survived until the next re-render and
  // then drifted, so Tab out of the notes box could land on Discard — one
  // keystroke from throwing the session away. Stop owns the tab stop.
  // Read the start off the same payload the tracker persists, so a session
  // restored after a reload — or re-anchored by Adjust — shows its real start
  // rather than one inferred from the tick count. trackerSeconds is touched
  // deliberately: it is the dependency that makes this recompute as time runs.
  const sessionStart = computed(() => {
    trackerSeconds.value;
    if (!isTracking.value) return null;
    let ms = 0;
    try {
      const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
      if (p && p.startTime) ms = Number(p.startTime);
    } catch (e) {}
    if (!ms) ms = Date.now() - trackerSeconds.value * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return {
      date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    };
  });
  const sessionToolFocus = ref('stop');
  const sessionToolTabindex = (id) => (sessionToolFocus.value === id ? 0 : -1);
  const onSessionToolbarKey = (ev) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (keys.indexOf(ev.key) === -1) return;
    const items = [...ev.currentTarget.querySelectorAll('[data-session-tool]')];
    if (items.length < 2) return;
    ev.preventDefault();
    const cur = Math.max(0, items.indexOf(document.activeElement));
    let next = cur;
    if (ev.key === 'ArrowLeft') next = (cur - 1 + items.length) % items.length;
    else if (ev.key === 'ArrowRight') next = (cur + 1) % items.length;
    else if (ev.key === 'Home') next = 0;
    else next = items.length - 1;
    // Identify by position, not by the attribute's value: Frappe UI's button
    // renders through to a real <button> but drops data-* values on the way,
    // so the attribute is only good as a marker, never as a label.
    const ids = isTracking.value ? (trackerBoundBlock.value ? ['discard', 'adjust', 'noshow', 'stop'] : ['discard', 'adjust', 'stop']) : ['unplanned', 'stop'];
    sessionToolFocus.value = ids[next] || 'stop';
    items[next].focus();
  };
  // Leaving the group resets it. The group is one tab stop and that stop is
  // always Stop, never whichever button was last arrowed to.
  const onSessionToolbarFocusOut = (ev) => {
    if (!ev.currentTarget.contains(ev.relatedTarget)) sessionToolFocus.value = 'stop';
  };
  const discardSession = () => {
    if (!isTracking.value) return;
    if (!discardConfirm.value) {
      discardConfirm.value = true;
      showToast('Discard this session? Press Discard again — nothing will be saved.', 'warning');
      if (_discardTimer) clearTimeout(_discardTimer);
      _discardTimer = setTimeout(() => { discardConfirm.value = false; }, 6000);
      return;
    }
    if (_discardTimer) clearTimeout(_discardTimer);
    discardConfirm.value = false;
    triggerHaptic([40, 30, 40]);
    let sTime = null;
    try {
      const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
      if (p && p.startTime) sTime = Number(p.startTime);
    } catch (e) {}
    setLastLocalStop(Date.now());
    setStoppingSession(true, 8000);
    isTracking.value = false;
    startTime.value = null;
    isSessionElevated.value = false;
    if (trackerTimer.value) clearInterval(trackerTimer.value);
    trackerTimer.value = null;
    markSessionEnded(sTime);
    localStorage.removeItem('omnitrack_active_session');
    // A sync debounced 500ms ago still holds the live payload; cancel it
    // so it cannot overwrite the server clear.
    cancelSyncDebounce();
    postJSON('sync_active_session', { session_data: null }).catch(() => {});
    broadcastSessionCleared();
    trackerSeconds.value = 0;
    trackerBlockName.value = null;
    trackerNotes.value = '';
    sessionNotesList.value = [];
    w.sessionTasks.value = [];
    newSessionPoint.value = '';
    stopConfirmName.value = '';
    showToast('Session discarded. Nothing was logged.', 'info');
  };
  const toggleTrack = async (customEndMs = null, customStartMs = null) => {
    triggerHaptic([40]);
    if (!isTracking.value) {
      setStoppingSession(false);
      setLastLocalStop(0);
      isTracking.value = true;
      w.sessionTasks.value = [];
      const sTime = customStartMs ? Number(customStartMs) : Date.now();
      unmarkSessionEnded(sTime);
      startTime.value = sTime;
      trackerSeconds.value = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
      lastActivityTime.value = Date.now();
      lastInactivityAlertTime.value = 0;
      setLastLocalUpdate(Date.now());
      syncActiveSession(true);
      // Request browser notification permission on user gesture (clicking Start)
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(p => { notificationPermission.value = p; }).catch(() => {});
        }
      } catch (e) {}
      trackerTimer.value = setInterval(() => {
        trackerSeconds.value = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
        checkInactivity();
        checkBlockOverrun();
      }, 1000);
      showToast(`Focus timer started for ${selectedNature.value}`, 'info');
    } else {
      // A line typed but not added yet is part of the log: Stop saves it, never drops it
      const draft = String((newSessionPoint && newSessionPoint.value) || '').trim();
      if (draft) { sessionNotesList.value.push(draft); newSessionPoint.value = ''; syncActiveSession(true); }
      // Checked before the clock is torn down, so a refused stop leaves the session exactly
      // as it was and nothing is lost. The words are counted as the server counts them: a
      // session refused there for being short was once already cleared, and an hour was lost.
      const notesNow = composeWrapNote(trackerNotes.value, sessionNotesList.value);
      if (!sessionHasLines.value || countSessionWords(notesNow) < minSessionWords(window.OMNITRACK_SESSION)) { refuseEmptySession(); return; }
      triggerHaptic([40, 50, 40]);
      let sTime = null;
      try {
        const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
        if (p && p.startTime) sTime = Number(p.startTime);
      } catch (e) {}
      // The session as it stands, put back if the save is refused
      const keptSession = {
        startTime: sTime || Number(startTime.value) || (Date.now() - trackerSeconds.value * 1000),
        selectedNature: selectedNature.value,
        selectedProject: selectedProject.value,
        trackerNotes: trackerNotes.value,
        trackerBlockName: trackerBlockName.value,
        sessionNotesList: [...(sessionNotesList.value || [])],
        sessionTasks: [...(w.sessionTasks.value || [])],
        // The newest copy there is: the server keeps it over anything older
        linesRev: Date.now(),
        lastActivityTime: lastActivityTime.value || Date.now(),
        lastUpdated: Date.now(),
        status: 'active'
      };
      const keepSession = (err) => {
        setStoppingSession(false);
        setLastLocalStop(0);
        unmarkSessionEnded(keptSession.startTime);
        restoreActiveSession(keptSession);
        syncActiveSession(true);
        showToast('Not saved, the session is still running. ' + _errText(err), 'danger');
      };
      setLastLocalStop(Date.now());
      setStoppingSession(true, 8000);
      isTracking.value = false;
      isSessionElevated.value = false;
      if (trackerTimer.value) clearInterval(trackerTimer.value);
      trackerTimer.value = null;
      markSessionEnded(sTime);
      localStorage.removeItem('omnitrack_active_session');
      // A sync debounced 500ms ago still holds the live payload; cancel it. The server copy
      // stays until the save succeeds: both saves clear it themselves, so a refused save
      // leaves the session on the server, on other devices, and here.
      cancelSyncDebounce();
      // snapshot, then zero the clock: a standby HUD showing the last
      // session's elapsed time reads like a session that is still open
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
      const finalNotes = notesNow;
      sessionNotesList.value = [];
      // Taken now: the session is over, and these become the new block's task rows
      const doneTasks = w.sessionTasks.value || [];
      w.sessionTasks.value = [];

      const now = new Date(effectiveStopMs);
      const from = new Date(now.getTime() - elapsedSecs * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      const sessionDate = from.getFullYear() + '-' + pad(from.getMonth() + 1) + '-' + pad(from.getDate());

      if (boundBlock) {
        // Recorded against a Planner block -> a real Work Session (the timesheet).
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
          broadcastSessionCleared();
          showToast(`Logged ${hrs.toFixed(2)}h against focus block`, 'success');
          trackerNotes.value = '';
          fetchWorkstationData(selectedEmployee.value);
          if (typeof fetchPlannerData === 'function') await fetchPlannerData();
          const refreshed = (plannerData.value.blocks || []).find(x => x.name === boundBlock);
          if (refreshed && showBlockDrawer.value) activeBlock.value = refreshed;
        } catch (err) {
          keepSession(err);
        } finally {
          setStoppingSession(false);
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
          project: selectedProject.value,
          session_tasks: JSON.stringify(doneTasks)
        });
        broadcastSessionCleared();
        showToast(`Logged ${hrs.toFixed(2)} hrs successfully!`, 'success');
        trackerNotes.value = '';
        fetchWorkstationData(selectedEmployee.value);
        if (typeof fetchPlannerData === 'function' && activeTab.value === 'planner') fetchPlannerData();
      } catch (err) {
        keepSession(err);
      } finally {
        setStoppingSession(false);
      }
    }
  };
  // Start the header stopwatch bound to a specific Planner block.
  const trackPlannerBlock = (b) => {
    if (isTracking.value) { showToast('Stop the current timer first', 'danger'); return; }
    _explicitBoundBlock.value = b;
    trackerBlockName.value = b.name;
    let rawN = blockTitle(b, '');
    if (rawN.includes('•')) {
      const parts = rawN.split('•').map(s => s.trim()).filter(Boolean);
      trackerNotes.value = parts[0] || '';
      sessionNotesList.value = parts.slice(1);
    } else {
      trackerNotes.value = rawN;
      sessionNotesList.value = [];
    }
    const proj = b.project || '';
    selectedProject.value = proj;
    trackerProject.value = proj;
    const nat = getNatureBadge(b.task_nature).label;
    selectedNature.value = nat;
    trackerNature.value = nat;
    showBlockDrawer.value = false;
    toggleTrack();
    openSessionCard();
  };
const showBlockDrawer = ref(false);

  Object.assign(w, {
    fetchWorkstationData,
    onEmployeeChange,
    sessionStart,
    sessionToolTabindex,
    onSessionToolbarKey,
    onSessionToolbarFocusOut,
    discardSession,
    toggleTrack,
    trackPlannerBlock,
    showBlockDrawer,
  });
}
