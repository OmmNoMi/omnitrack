import { lazy } from "./workstationBag.js";
import { ref, computed, nextTick } from "vue";
import { WORK } from "../utils/activity.js";
import { useWorkstationTimeline } from "./useWorkstationTimeline.js";
import { useWorkstationAudioSync } from "./useWorkstationAudioSync.js";
import { useWorkstationSessionSync } from "./useWorkstationSessionSync.js";

/**
 * Computed helpers, timeline and cross-tab session sync.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationSessionClock(w) {
  const { _minToHHMM, _minsOf, activeTab, filteredWorkBlocks, getLocalTodayISO, isTracking, newSessionPoint, nowMinute, postJSON, selectedDashboardDate, selectedEmployee, selectedNature, selectedProject, sessionNotesList, sessionNotesScroll, showToast, startTime, todayDate, todayISO, trackerBlockName, trackerBoundBlock, trackerNature, trackerNotes, trackerProject, trackerSeconds, trackerTimer, triggerHaptic, workBlocks, workFocusBlocks } = w;
  const fetchPlannerData = (...args) => w.fetchPlannerData(...args);
  const fetchWorkstationData = (...args) => w.fetchWorkstationData(...args);
  const focusLogRow = (...args) => w.focusLogRow(...args);
  const focusSessionPointInput = (...args) => w.focusSessionPointInput(...args);
  const toggleTrack = (...args) => w.toggleTrack(...args);
  const hourLabel = lazy(w, 'hourLabel');

  // 7. Computed Helpers
  const currentEmployeeFirstName = computed(() => {
    if (selectedEmployee.value === 'All') return 'Hardik';
    return selectedEmployee.value.split(' ')[0] || 'Alex';
  });
  const formattedTime = computed(() => {
    const hrs = String(Math.floor(trackerSeconds.value / 3600)).padStart(2, '0');
    const mins = String(Math.floor((trackerSeconds.value % 3600) / 60)).padStart(2, '0');
    const secs = String(trackerSeconds.value % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  });
  const bottomBarTimer = computed(() => {
    const s = trackerSeconds.value || 0;
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, '0');

    if (hrs === 0) {
      return {
        isHours: false,
        primary: `${pad(mins)}:${pad(secs)}`,
        sub: 'min:sec',
        mins: pad(mins),
        secs: pad(secs)
      };
    }

    return {
      isHours: true,
      hours: hrs,
      minutes: pad(mins),
      seconds: pad(secs),
      primary: `${hrs}h ${pad(mins)}m`,
      sub: `${pad(secs)}s`
    };
  });
  const paginatedBlocks = computed(() => {
    return filteredWorkBlocks.value.slice(0, 25);
  });
  // Time ordering & block position helpers


  // Google Meet-Style Day Focus Block Groupings & PACI extracted to useWorkstationDashboard


  // Timeline Domain Store Integration
  const timelineStore = useWorkstationTimeline({
    todayDate,
    selectedDashboardDate,
    workFocusBlocks,
    isTracking,
    startTime,
    trackerBlockName,
    trackerNotes,
    selectedProject,
    selectedNature,
    nowMinute,
    getLocalTodayISO,
    todayISO,
    _minToHHMM,
    _minsOf,
    hourLabel: (h) => hourLabel(h)
  });
  const {
    timelineZoom,
    timelineZoomOptions,
    timelineTrackWidth,
    onTimelineZoomKey,
    timelineScroller,
    timelineCanScrollLeft,
    timelineCanScrollRight,
    syncTimelineEdges,
    nudgeTimeline,
    dayTimeline,
    scrollTimelineToWork,
    blockLogState,
    blockLogPct
  } = timelineStore;
  const lastActivityTime = ref(Date.now());
  const lastInactivityAlertTime = ref(0);
  const showInactivityModal = ref(false);
  // Activity moves the clock on, but never answers the still-working question: a click or a Tab
  // inside it is the person choosing an answer, and closing on it lost the question (and moved
  // the time its Stop was going to use to now).
  const recordUserActivity = () => {
    lastActivityTime.value = Date.now();
  };
  // Multi-Device Audio Synthesizer, Mobile Notifications & Block Overrun Engine
  const audioSyncStore = useWorkstationAudioSync({
    postJSON,
    showToast,
    isTracking,
    trackerBoundBlock,
    confirmStillWorking: () => { if (typeof confirmStillWorking === 'function') confirmStillWorking(); }
  });
  const {
    playUpcoming10mChime,
    playStartOnTimeChime,
    playOverrunChime,
    playInactivityChime,
    unlockAudio,
    notificationPermission,
    showNotificationBanner,
    enableNotificationsUserGesture,
    dispatchInactivityNotification,
    lastOverrunAlertTime,
    checkBlockOverrun
  } = audioSyncStore;
  const isProductionEnv = computed(() => {
    if (typeof window === 'undefined') return true;
    const host = (window.location.hostname || '').toLowerCase();
    return host.includes('ommnomi.in') || host.includes('frappecloud.com');
  });
  const isBlockOverrun = computed(() => {
    const _ = trackerSeconds.value;
    if (!isTracking.value || !trackerBoundBlock.value) return false;
    const b = trackerBoundBlock.value;
    if (!b.end_time) return false;
    const [eh, em] = b.end_time.split(':').map(Number);
    if (isNaN(eh) || isNaN(em)) return false;
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const endMins = eh * 60 + em;
    return curMins > endMins;
  });
  const overrunMinutes = computed(() => {
    const _ = trackerSeconds.value;
    if (!isBlockOverrun.value || !trackerBoundBlock.value) return 0;
    const [eh, em] = trackerBoundBlock.value.end_time.split(':').map(Number);
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    return Math.max(0, curMins - (eh * 60 + em));
  });
  const earlyStartMinutes = computed(() => {
    const _ = trackerSeconds.value;
    if (!isTracking.value || !trackerBoundBlock.value || !startTime.value) return 0;
    const b = trackerBoundBlock.value;
    if (!b.start_time) return 0;
    const [sh, sm] = b.start_time.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm)) return 0;
    const sDate = new Date(Number(startTime.value));
    const startMins = sDate.getHours() * 60 + sDate.getMinutes();
    const plannedMins = sh * 60 + sm;
    return startMins < plannedMins ? (plannedMins - startMins) : 0;
  });
  const quickExtendActiveBlock = async (mins) => {
    triggerHaptic([30]);
    try {
      const res = await postJSON('extend_active_block_duration', { extend_minutes: mins });
      if (res && res.status === 'success') {
        showToast(`Extended planned block by +${mins}m`, 'success');
        await fetchWorkstationData(selectedEmployee.value);
      } else {
        showToast('Could not extend block: ' + (res.status || 'unknown'), 'warning');
      }
    } catch (e) {
      showToast('Failed to extend block: ' + (e.message || e), 'error');
    }
  };
  const startUnplannedEscalation = () => {
    triggerHaptic([40]);
    // No block: Stop makes a new one, which the server marks unplanned
    selectedNature.value = WORK;
    trackerNature.value = WORK;
    trackerBlockName.value = null;
    trackerNotes.value = 'Urgent Escalation / Ad-hoc Session';
    sessionNotesList.value = [];
    toggleTrack();
    showToast('Started an unplanned session', 'warning');
  };
  const lastNoteMs = () => Math.max(lastActivityTime.value || 0, getLastLocalUpdate() || 0) || Date.now();
  // The moment the still-working question is about, held from when it was asked: what the
  // person does while answering is not the time they stepped away.
  const idleSinceMs = ref(0);
  const inactivityIdleSince = computed(() => {
    const _ = trackerSeconds.value;
    return showInactivityModal.value && idleSinceMs.value ? idleSinceMs.value : lastNoteMs();
  });
  const inactivityMinutes = computed(() => {
    const _ = trackerSeconds.value;
    return Math.max(1, Math.floor((Date.now() - inactivityIdleSince.value) / 60000));
  });
  // "Log until": 15 minutes after the last activity, never after now
  const inactivityStopAt = computed(() => {
    const _ = trackerSeconds.value;
    return Math.min(Date.now(), inactivityIdleSince.value + 15 * 60 * 1000);
  });
  const checkInactivity = () => {
    if (!isTracking.value) return;
    const now = Date.now();
    const act = lastNoteMs();
    const idleMs = now - act;
    const INACTIVITY_MS = 30 * 60 * 1000;
    const REPEAT_MS = 30 * 60 * 1000;

    if (idleMs >= INACTIVITY_MS) {
      const timeSinceAlert = now - (lastInactivityAlertTime.value || 0);
      if (!lastInactivityAlertTime.value || timeSinceAlert >= REPEAT_MS) {
        lastInactivityAlertTime.value = now;
        idleSinceMs.value = act;
        showInactivityModal.value = true;
        playInactivityChime();
        dispatchInactivityNotification(`No notes logged for ${Math.floor(idleMs / 60000)}m on "${trackerNotes.value || 'Active Work'}". Are you still working?`);
      }
    }
  };
  const confirmStillWorking = () => {
    recordUserActivity();
    lastInactivityAlertTime.value = 0;
    showInactivityModal.value = false;
    isSessionElevated.value = true;
    syncActiveSession(true);
    nextTick(() => {
      focusSessionPointInput();
    });
    showToast('Session open. Add what you have been working on.', 'success');
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => { notificationPermission.value = p; }).catch(() => {});
    }
  };
  // The prompt never stops a session itself: Adjust opens the running session's own box, its end
  // already at the suggested stop (held from when the question was asked), and the person
  // stops it there, or keeps it running
  const adjustInactivitySession = () => {
    const endMs = inactivityStopAt.value;
    showInactivityModal.value = false;
    recordUserActivity();
    w.openAdjustModal({ endMs });
  };
  // Multi-Device Cross-Tab Session Synchronization
  const sessionSyncStore = useWorkstationSessionSync({
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
    sessionTasks: w.sessionTasks,
    sessionNotesScroll,
    workBlocks,
    workFocusBlocks,
    lastActivityTime,
    lastInactivityAlertTime,
    selectedEmployee,
    activeTab,
    fetchWorkstationData: (emp) => { if (typeof fetchWorkstationData === 'function') fetchWorkstationData(emp); },
    fetchPlannerData: async () => { if (typeof fetchPlannerData === 'function') await fetchPlannerData(); },
    checkInactivity: () => { if (typeof checkInactivity === 'function') checkInactivity(); },
    checkBlockOverrun: () => { if (typeof checkBlockOverrun === 'function') checkBlockOverrun(); },
    getLocalTodayISO
  });
  const {
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
    cancelSyncDebounce
  } = sessionSyncStore;
  // A timesheet line is often a paragraph, not a phrase: the field grows with the
  // text, Shift+Enter breaks a line, and plain Enter still files the entry.
  const growSessionPoint = () => {
    const el = sessionPointInput.value;
    if (!el || !el.style) return;
    // An empty textarea reports a scrollHeight of two rows, so let CSS own the
    // resting size and only measure once there is something to measure.
    el.style.height = '';
    if (!el.value) return;
    void el.offsetHeight;                 // force the reflow before measuring
    el.style.height = el.scrollHeight + 'px';
  };
  const onSessionPointEnter = (ev) => {
    if (ev.shiftKey || ev.isComposing) return;   // Shift+Enter writes a new line
    ev.preventDefault();
    addSessionPoint();
  };
  // Only leave the field for the log when there is nothing above the caret to
  // move through — otherwise Up is just normal cursor movement in the text.
  const onSessionPointUp = (ev) => {
    const el = ev.currentTarget;
    if (el && el.selectionStart > 0) return;
    ev.preventDefault();
    focusLogRow(sessionNotesList.value.length - 1);
  };
  const addSessionPoint = () => {
    const pt = (newSessionPoint.value || '').trim();
    if (!pt) return;
    sessionNotesList.value.push(pt);
    newSessionPoint.value = '';
    recordUserActivity();
    nextTick(() => { const el = sessionPointInput.value; if (el && el.style) el.style.height = ''; });
    // newest sits at the bottom of the list — keep it in view
    nextTick(() => { if (sessionNotesScroll.value) sessionNotesScroll.value.scrollTop = sessionNotesScroll.value.scrollHeight; });
    syncActiveSession(true);
    triggerHaptic([25]);
  };
  // Chronological order: #1 is the first line of the session and the newest
  // sits last, right above the input. row.i is the real array index.
  const sessionNotesRows = computed(() =>
    (sessionNotesList.value || []).map((t, i) => ({ i: i, t: t, n: i + 1 }))
  );
const isSessionElevated = ref(false);
const sessionPointInput = ref(null);
const plannerAnchor = ref('');

  Object.assign(w, {
    currentEmployeeFirstName,
    formattedTime,
    bottomBarTimer,
    paginatedBlocks,
    timelineZoom,
    timelineZoomOptions,
    timelineTrackWidth,
    onTimelineZoomKey,
    timelineScroller,
    timelineCanScrollLeft,
    timelineCanScrollRight,
    syncTimelineEdges,
    nudgeTimeline,
    dayTimeline,
    blockLogState,
    blockLogPct,
    lastActivityTime,
    lastInactivityAlertTime,
    showInactivityModal,
    recordUserActivity,
    playUpcoming10mChime,
    playStartOnTimeChime,
    playInactivityChime,
    unlockAudio,
    notificationPermission,
    showNotificationBanner,
    enableNotificationsUserGesture,
    checkBlockOverrun,
    isProductionEnv,
    isBlockOverrun,
    overrunMinutes,
    earlyStartMinutes,
    quickExtendActiveBlock,
    startUnplannedEscalation,
    inactivityMinutes,
    inactivityIdleSince,
    inactivityStopAt,
    checkInactivity,
    confirmStillWorking,
    adjustInactivitySession,
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
    growSessionPoint,
    onSessionPointEnter,
    onSessionPointUp,
    addSessionPoint,
    sessionNotesRows,
    isSessionElevated,
    sessionPointInput,
    plannerAnchor,
  });
}
