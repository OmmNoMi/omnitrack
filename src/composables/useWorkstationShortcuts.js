import { computed, nextTick } from "vue";
import { useWorkstationSessionModals } from "./useWorkstationSessionModals.js";
import { popoverOpen } from "../utils/popover.js";
import { blockTitle } from '../utils/blockTitle.js';

/**
 * Keyboard shortcuts, session modals and schedule tracks.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationShortcuts(w) {
  const { _errText, _explicitBoundBlock, activeBlock, activeTab, appendSessionLine, checkInactivity, discardConfirm, extractErrorMessage, flt, fmtHrs, focusSessionPointInput, getLocalTodayISO, hhmm, isManager, isSessionElevated, isTracking, markSessionEnded, newSessionPoint, openNewTaskModal, postJSON, recordUserActivity, selectedDashboardDate, selectedEmployee, selectedNature, selectedProject, sessionNotesList, sessionPointInput, showToast, showTrackerPopup, startTime, stopConfirmName, syncActiveSession, todayDate, todayISO, trackerBlockName, trackerBoundBlock, trackerNotes, trackerSeconds, trackerTimer, triggerHaptic } = w;
  const discardSession = (...args) => w.discardSession(...args);
  const fetchPlannerData = (...args) => w.fetchPlannerData(...args);
  const fetchWorkstationData = (...args) => w.fetchWorkstationData(...args);
  const openBookModal = (...args) => w.openBookModal(...args);
  const promptSwitchSession = (...args) => w.promptSwitchSession(...args);
  const toggleTrack = (...args) => w.toggleTrack(...args);
  const trackBlock = (...args) => w.trackBlock(...args);

  // The header timer and Shift+S elevates to the session timesheet in full focus
  const openSessionCard = () => {
    showTrackerPopup.value = false;
    // Idle: there is no HUD to jump to, so this gesture opens an unplanned
    // session. Planned work should be started from its block instead.
    if (!isTracking.value) {
      _explicitBoundBlock.value = null;
      trackerBlockName.value = null;
      toggleTrack();
    }
    isSessionElevated.value = true;
    nextTick(focusSessionPointInput);
  };
  const toggleSessionFocus = () => {
    if (!isTracking.value) {
      _explicitBoundBlock.value = null;
      trackerBlockName.value = null;
      toggleTrack();
      isSessionElevated.value = true;
      focusSessionPointInput();
      return;
    }
    isSessionElevated.value = !isSessionElevated.value;
    if (isSessionElevated.value) focusSessionPointInput();
  };
  // Shift+D: jump to the day view and land on the selected day, so the arrow keys
  // pick a day and Tab reaches that day's Start Session button straight away.
  const openDayView = () => {
    activeTab.value = 'dashboard';
    nextTick(() => {
      // land just under the sticky header, not centred half off-screen
      const sect = document.querySelector('[data-day-section]') || document.querySelector('[data-day-strip]');
      if (sect) {
        const header = document.querySelector('header.sticky');
        const offset = (header ? header.getBoundingClientRect().height : 0) + 16;
        const y = sect.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
      const day = document.querySelector('[data-day-strip] [data-day-btn][aria-checked="true"]');
      if (day) day.focus({ preventScroll: true });
    });
  };
  // Global shortcuts. Shift+T new task · Shift+P plan a block · Shift+D the day view ·
  // Shift+S jump to the
  // session-log input (then Tab reaches Stop & Save) · Cmd/Ctrl+S stops and saves ·
  // "/" also jumps to the add-line input.
  const _typingIn = (t) => {
    const tag = t && t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.isContentEditable);
  };
  const planBlockShortcut = () => {
    activeTab.value = 'planner';
    const iso = todayDate.value || todayISO();
    const hour = Math.min(22, new Date().getHours());
    nextTick(() => { openBookModal(iso, hour); });
  };
  // Shortcuts are worthless if nobody is told they exist — show the real modifier
  // for the platform rather than a generic "Ctrl".
  const isMacLike = (typeof navigator !== 'undefined') &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const modKey = isMacLike ? '\u2318' : 'Ctrl';
  const _slashFocus = (ev) => {
    // Esc minimizes elevated session popup, unless an open list inside it (Activity, Project)
    // takes this Escape to close itself: one Escape, one step back. reka's Combobox closes
    // without preventDefault, so an open list is checked as well.
    if (ev.key === 'Escape' && isSessionElevated.value) {
      if (ev.defaultPrevented || popoverOpen()) return;
      ev.preventDefault();
      isSessionElevated.value = false;
      return;
    }
    // Cmd/Ctrl+S stops the session instead of saving the browser page.
    if ((ev.metaKey || ev.ctrlKey) && String(ev.key || '').toLowerCase() === 's') {
      ev.preventDefault();
      if (isTracking.value) toggleTrack();
      else showToast('No session is running', 'info');
      return;
    }
    // Cmd/Ctrl+D discards. Destructive, but discardSession already asks once and
    // only throws the session away on the second press, so the key is safe.
    if ((ev.metaKey || ev.ctrlKey) && String(ev.key || '').toLowerCase() === 'd') {
      ev.preventDefault();
      if (isTracking.value) discardSession();
      else showToast('No session is running', 'info');
      return;
    }
    // Cmd/Ctrl+E opens Adjust, to fix the start/end of the running clock.
    if ((ev.metaKey || ev.ctrlKey) && String(ev.key || '').toLowerCase() === 'e') {
      ev.preventDefault();
      if (isTracking.value) openAdjustModal();
      else showToast('No session is running', 'info');
      return;
    }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.shiftKey && !_typingIn(ev.target)) {
      const k = String(ev.key || '').toLowerCase();
      if (k === 't') {
        ev.preventDefault();
        if (isTracking.value) {
          isSessionElevated.value = true;
          focusSessionPointInput();
        } else {
          openNewTaskModal();
        }
        return;
      }
      if (k === 'p') { ev.preventDefault(); planBlockShortcut(); return; }
      if (k === 's') { ev.preventDefault(); toggleSessionFocus(); return; }
      if (k === 'd') { ev.preventDefault(); openDayView(); return; }
    }
    if (ev.key !== '/') return;
    if (_typingIn(ev.target)) return;
    const hasSessionInput = isTracking.value || !!sessionPointInput.value ||
      !!document.querySelector('#omnitrack-session-box-root [data-session-input]') ||
      !!document.querySelector('#omnitrack-session-box-root textarea');
    if (!hasSessionInput) return;
    ev.preventDefault();
    if (isTracking.value && activeTab.value !== 'dashboard' && !isSessionElevated.value) {
      activeTab.value = 'dashboard';
    }
    focusSessionPointInput();
  };
  const removeSessionPoint = (idx) => {
    sessionNotesList.value.splice(idx, 1);
    recordUserActivity();
    syncActiveSession(true);
    triggerHaptic([20]);
  };
  const updateTrackerNotesFromPoints = () => {
    // Preserved for backwards-compatibility
  };
  // A timesheet with no lines is an hour with nothing attached to it. The
  // manager reading it cannot tell what was done, and when the hour reaches a
  // client's invoice it reads as time billed for no work. So this is a hard
  // rule, not a confirmation: no lines, no save.
  const sessionHasLines = computed(() =>
    (sessionNotesList.value || []).some(p => String(p || '').trim().length >= 3) ||
    String(trackerNotes.value || '').trim().length >= 3 ||
    !!trackerBlockName.value ||
    !!trackerBoundBlock.value
  );
  // Session Modals: Empty Stop, Start Time Choice, Adjust Timesheet, Runaway Guard, Edit/Delete Session
  const sessionModalsStore = useWorkstationSessionModals({
    postJSON,
    showToast,
    isTracking,
    startTime,
    trackerSeconds,
    trackerTimer,
    trackerNotes,
    trackerBoundBlock,
    trackerBlockName,
    sessionNotesList,
    sessionHasLines,
    selectedNature,
    selectedProject,
    todayDate,
    todayISO,
    isSessionElevated,
    isManager,
    activeBlock,
    selectedEmployee,
    selectedDashboardDate,
    newSessionPoint,
    stopConfirmName,
    discardConfirm,
    toggleTrack: (...args) => toggleTrack(...args),
    discardSession: () => discardSession(),
    appendSessionLine: (note) => appendSessionLine(note),
    syncActiveSession: (force) => syncActiveSession(force),
    recordUserActivity: () => recordUserActivity(),
    checkInactivity: () => checkInactivity(),
    markSessionEnded: (t) => markSessionEnded(t),
    trackBlock: (b, epoch) => trackBlock(b, epoch),
    fetchWorkstationData: (emp) => fetchWorkstationData(emp),
    fetchPlannerData: () => { if (typeof fetchPlannerData === 'function') fetchPlannerData(); },
    getLocalTodayISO,
    hhmm,
    fmtHrs,
    flt,
    extractErrorMessage,
    _errText
  });
  const {
    showEmptyStopModal,
    emptyStopQuickNote,
    emptyStopElapsedHrs,
    openEmptyStopModal,
    confirmEmptyStopDiscard,
    confirmEmptyStopSave,
    refuseEmptySession,
    showStartTimeChoiceModal,
    pendingStartBlock,
    pendingStartTimeOptions,
    parseBlockStartEpoch,
    selectStartTimeChoice,
    showAdjustModal,
    adjustMode,
    originalStartTimeFormatted,
    adjustForm,
    minTimesheetDate,
    adjustDurationMinutes,
    adjustDurationShort,
    adjustDurationFormatted,
    keepRunningElapsedFormatted,
    openAdjustModal,
    nudgeAdjustTime,
    setAdjustEndNow,
    applyAdjustedStartTime,
    submitAdjustedTimesheet,
    showRunawayAlertModal,
    runawayGuardData,
    runawayChoice,
    checkRunawayStopwatch,
    resolveRunawayOption,
    confirmRunawayResolution,
    quickLogTimelineGap,
    showEditSessionModal,
    isSavingEditSession,
    editSessionTargetBlock,
    editSessionForm,
    editSessionDuration,
    openEditSessionModal,
    saveEditSession,
    confirmDeleteSession
  } = sessionModalsStore;
  const requestStopFocusBlock = (b) => {
    const running = isTracking.value && trackerBlockName.value === b.name;
    if (running && !sessionHasLines.value) { openEmptyStopModal(); return; }
    stopConfirmName.value = '';
    startFocusBlock(b);
  };
  const startFocusBlock = (b) => {
    if (!b) return;
    if (isTracking.value && trackerBlockName.value === b.name) {
      toggleTrack();
      return;
    }
    if (isTracking.value) {
      promptSwitchSession({
        id: b.name,
        name: b.name,
        label: blockTitle(b, b.name),
        project: b.project,
        project_name: b.project_name,
        is_block: true,
        task_nature: b.task_nature,
        work_date: b.work_date,
        start_time: b.start_time,
        end_time: b.end_time,
      });
      return;
    }

    // Check if block scheduled start is in the past today
    const startEpoch = parseBlockStartEpoch(b);
    const now = Date.now();
    if (startEpoch && startEpoch < now) {
      const elapsedMinutes = Math.floor((now - startEpoch) / 60000);
      if (elapsedMinutes <= 2) {
        // Auto-anchor on time without prompting if <= 2 mins
        trackBlock(b, startEpoch);
        return;
      } else if (elapsedMinutes <= 120) {
        // Prompt user with 1-click suggested start times
        pendingStartBlock.value = b;
        const schedTimeStr = b.start_time ? String(b.start_time).substring(0, 5) : '';
        const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        pendingStartTimeOptions.value = [
          {
            label: `Start on time at ${schedTimeStr}`,
            sublabel: `${elapsedMinutes}m elapsed · Plan adherence protected`,
            epoch: startEpoch,
            isOntime: true
          },
          {
            label: `Start from now at ${nowTimeStr}`,
            sublabel: `Fresh start at 00:00:00`,
            epoch: now,
            isOntime: false
          }
        ];
        showStartTimeChoiceModal.value = true;
        return;
      }
    }

    trackBlock(b);
  };
  Object.assign(w, {
    openSessionCard,
    toggleSessionFocus,
    openDayView,
    isMacLike,
    modKey,
    _slashFocus,
    removeSessionPoint,
    sessionHasLines,
    showEmptyStopModal,
    emptyStopQuickNote,
    emptyStopElapsedHrs,
    openEmptyStopModal,
    confirmEmptyStopDiscard,
    confirmEmptyStopSave,
    refuseEmptySession,
    showStartTimeChoiceModal,
    pendingStartBlock,
    pendingStartTimeOptions,
    selectStartTimeChoice,
    showAdjustModal,
    adjustMode,
    originalStartTimeFormatted,
    adjustForm,
    minTimesheetDate,
    adjustDurationMinutes,
    adjustDurationShort,
    adjustDurationFormatted,
    keepRunningElapsedFormatted,
    openAdjustModal,
    nudgeAdjustTime,
    setAdjustEndNow,
    applyAdjustedStartTime,
    submitAdjustedTimesheet,
    showRunawayAlertModal,
    runawayGuardData,
    runawayChoice,
    checkRunawayStopwatch,
    resolveRunawayOption,
    confirmRunawayResolution,
    quickLogTimelineGap,
    showEditSessionModal,
    isSavingEditSession,
    editSessionForm,
    editSessionDuration,
    openEditSessionModal,
    saveEditSession,
    confirmDeleteSession,
    requestStopFocusBlock,
    startFocusBlock,
  });
}
