import { ref, computed, nextTick } from "vue";
import { useWorkstationPlannerLayout } from "./useWorkstationPlannerLayout.js";
import { useWorkstationCardStyles } from "./useWorkstationCardStyles.js";

/**
 * Planner state, hover card and read-only past rules.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationPlannerState(w) {
  const { _minToHHMM, _utcDate, addDays, bookForm, currentUser, getLocalTodayISO, hhmm, isDarkMode, isManager, isNonWorkingNature, isTracking, nowMinute, plannerAnchor, plannerData, selectedNature, selectedProject, startTime, teamMembers, todayDate, todayISO, trackerBlockName, trackerNotes, trackerSeconds } = w;
  const plannerShift = (...args) => w.plannerShift(...args);

  const plannerBusy = ref(false);
  const pickedTask = ref(null);
  const plannerDrag = ref(null);
  const slotSel = ref(null);
  const _mins = (t) => {
    if (!t) return 0;
    const p = String(t).split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  };
  const _utc = (iso) => _utcDate(iso);
  const _iso = (dt) => getLocalTodayISO(dt);
  plannerAnchor.value = todayISO();
  const cardStylesStore = useWorkstationCardStyles({
    isDarkMode,
    isTracking,
    trackerBlockName,
    todayDate,
    todayISO,
    nowMinute,
    _mins,
    hhmm,
    isNonWorkingNature
  });
  const {
    PROJECT_HUES,
    projectHue,
    blockVisualState,
    blockClass,
    timelinePlannedStyle,
    timelineLoggedStyle,
    blockStyle,
    segTimeTitle
  } = cardStylesStore;
  const plannerLayoutStore = useWorkstationPlannerLayout({
    plannerData,
    plannerAnchor,
    todayDate,
    todayISO,
    getLocalTodayISO,
    addDays,
    _utcDate,
    _mins,
    _minToHHMM,
    nowMinute,
    isTracking,
    startTime,
    trackerBlockName,
    trackerNotes,
    trackerSeconds,
    selectedNature,
    selectedProject,
    sessionTasks: w.sessionTasks,
    currentUser: w.currentUser,
    plannerDrag,
    slotSel,
    plannerShift: (dir) => plannerShift(dir),
    blockStyle
  });
  const {
    PLANNER_HOUR_PX,
    plannerGridScroll,
    scrollPlannerToMorning,
    userCustomizedPlannerView,
    getDeviceDefaultPlannerView,
    plannerView,
    setUserPlannerView,
    handleResize,
    plannerNatureOptions,
    showNatureFilter,
    natureFilter,
    natureFilterLabel,
    plannerNatureMenuItems,
    setNatureFilter,
    toggleNatureFilter,
    _blockNature,
    plannerRange,
    plannerHours,
    plannerDays,
    plannerRangeLabel,
    dowLabel,
    domLabel,
    hourLabel,
    mondayOf,
    timedSegmentsForDay,
    blocksForDay,
    _gridBottomPx,
    blockTop,
    blockHeight,
    segTop,
    segHeight,
    segStyle,
    startNowClock,
    stopNowClock,
    nowLineTop,
    nowLineLabel,
    isTodayCol,
    plannerViewOrder,
    onPlannerViewKey,
    officeStart,
    officeEnd,
    onPlannerTouchStart,
    onPlannerTouchEnd,
    officeMarks,
    isPastCol,
    pastShadeStyle
  } = plannerLayoutStore;
  const comboboxPairingPartnerOptions = computed(() => {
    const curr = currentUser.value || '';
    return (teamMembers.value || [])
      .filter(m => m.name !== curr && m.email !== curr)
      .map(m => ({
        value: m.name || m.email,
        label: m.full_name || m.name,
        description: m.role || ''
      }));
  });
  const showBlockReschedule = ref(false);
  const showBlockManualLog = ref(false);
  const sessionForm = ref({ session_date: '', from_time: '', to_time: '', hours: '', notes: '' });
  // ---- Past is read-only ----------------------------------------------------
  // History should not be rewritten by a stray drag: anything that already
  // happened is locked, only now-and-later can be moved or booked.
  const isPastSlot = (iso, endMin) => {
    const today = todayDate.value || todayISO();
    if (!iso) return false;
    if (iso < today) return true;
    if (iso > today) return false;
    return (endMin || 0) <= nowMinute.value;
  };
  const pastBlockGraceHours = computed(() => {
    return (plannerData.value && plannerData.value.past_block_lock_grace_hours != null)
      ? Number(plannerData.value.past_block_lock_grace_hours)
      : 24;
  });
  const timesheetHorizonHours = computed(() => {
    return (plannerData.value && plannerData.value.timesheet_modification_horizon_hours != null)
      ? Number(plannerData.value.timesheet_modification_horizon_hours)
      : 48;
  });
  const isPastBlock = (b) => {
    if (!b || !b.work_date) return false;
    const grace = pastBlockGraceHours.value;
    const endT = b.end_time || '23:59:59';
    const parts = b.work_date.split('-');
    if (parts.length < 3) return false;
    const timeParts = endT.split(':');
    const blockDt = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      parseInt(timeParts[0] || '23', 10),
      parseInt(timeParts[1] || '59', 10),
      parseInt(timeParts[2] || '59', 10)
    );
    const now = new Date();
    const diffHours = (now.getTime() - blockDt.getTime()) / (1000 * 60 * 60);
    return diffHours > grace;
  };
  const canLogTimesheet = (b) => {
    if (!b) return false;
    if (isManager.value) return true;
    const horizon = timesheetHorizonHours.value;
    const dtStr = b.work_date || todayDate.value || todayISO();
    const parts = dtStr.split('-');
    if (parts.length < 3) return true;
    const blockDt = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      23, 59, 59
    );
    const now = new Date();
    const diffHours = (now.getTime() - blockDt.getTime()) / (1000 * 60 * 60);
    return diffHours <= horizon;
  };
  const isBlockLocked = (b) => {
    if (!b) return false;
    let e = _mins(b.end_time);
    if (!(e > 0)) e = _mins(b.start_time);
    return isPastSlot(b.work_date, e);
  };
  // ---- Hover card: read a block without opening the drawer ------------------
  const STATE_TEXT = {
    planned: 'Planned — not started',
    logged: 'Time logged',
    missed: 'Past · no time logged',
    away: 'Non-working',
    cancelled: 'Cancelled'
  };
  let _hoverCardTimer = null;
  const hoverCard = ref(null);
  // The card is a tooltip: the block it describes points at it while it shows, and Escape
  // dismisses it without closing anything else (WCAG 1.4.13).
  let _hoverTrigger = null;
  const onHoverEscape = (e) => {
    if (e.key !== 'Escape' || !hoverCard.value) return;
    e.preventDefault();
    clearHover();
  };
  const clearHover = () => {
    hoverCard.value = null;
    if (_hoverTrigger) _hoverTrigger.removeAttribute('aria-describedby');
    _hoverTrigger = null;
    document.removeEventListener('keydown', onHoverEscape, true);
  };
  const cancelHideHover = () => {
    if (_hoverCardTimer) {
      clearTimeout(_hoverCardTimer);
      _hoverCardTimer = null;
    }
  };
  const hideBlockHover = (immediate = false) => {
    cancelHideHover();
    if (immediate === true) {
      clearHover();
      return;
    }
    _hoverCardTimer = setTimeout(clearHover, 160);
  };
  const showBlockHover = (ev, seg, source) => {
    if (plannerDrag.value || slotSel.value) return;
    cancelHideHover();
    const b = (seg && seg.block) || seg;
    if (!b) return;
    if (_hoverTrigger && _hoverTrigger !== ev.currentTarget) _hoverTrigger.removeAttribute('aria-describedby');
    _hoverTrigger = ev.currentTarget;
    _hoverTrigger.setAttribute('aria-describedby', 'block-hover-card');
    document.addEventListener('keydown', onHoverEscape, true);
    const r = ev.currentTarget.getBoundingClientRect();
    const top = placeHoverCard(r, 85);

    hoverCard.value = {
      block: b,
      seg: seg,
      source: source || 'planner',
      state: source === 'logged' ? 'logged' : blockVisualState(b),
      // Fixed-position so the scroll container cannot clip it; flipped when it
      // would run off the right edge.
      left: Math.max(10, Math.min(r.left, window.innerWidth - 298)),
      top: Math.round(top)
    };
    // Titles wrap, so the card's height is only known once it renders. Measure it, then
    // place it again, clear of the bottom bar and its raised session button.
    nextTick(() => {
      const card = document.querySelector('[data-block-hover-card]');
      if (!card || !hoverCard.value || hoverCard.value.block !== b) return;
      hoverCard.value.top = Math.round(placeHoverCard(r, card.offsetHeight));
    });
  };
  // Below the block when it fits, otherwise above; never on top of the block, under the bottom bar or off screen.
  const placeHoverCard = (r, height) => {
    const nav = document.querySelector('nav[aria-label="Workstation navigation"]');
    const floor = nav
      ? Math.min(...[nav, ...nav.querySelectorAll('*')].map((e) => e.getBoundingClientRect().top).filter((t) => t > 0)) - 8
      : window.innerHeight - 10;
    if (r.bottom + 8 + height <= floor) return r.bottom + 8;
    if (r.top - 8 - height >= 10) return r.top - 8 - height;
    return Math.max(10, floor - height);
  };
  const hoverStateText = computed(() => {
    const hc = hoverCard.value;
    return hc ? (STATE_TEXT[hc.state] || hc.state) : '';
  });

  Object.assign(w, {
    plannerBusy,
    pickedTask,
    plannerDrag,
    slotSel,
    _mins,
    _utc,
    blockVisualState,
    blockClass,
    timelinePlannedStyle,
    timelineLoggedStyle,
    blockStyle,
    segTimeTitle,
    PLANNER_HOUR_PX,
    plannerGridScroll,
    scrollPlannerToMorning,
    plannerView,
    setUserPlannerView,
    handleResize,
    plannerNatureOptions,
    showNatureFilter,
    natureFilter,
    natureFilterLabel,
    plannerNatureMenuItems,
    setNatureFilter,
    toggleNatureFilter,
    plannerRange,
    plannerHours,
    plannerDays,
    plannerRangeLabel,
    dowLabel,
    domLabel,
    hourLabel,
    timedSegmentsForDay,
    blocksForDay,
    blockTop,
    blockHeight,
    segTop,
    segHeight,
    segStyle,
    startNowClock,
    stopNowClock,
    nowLineTop,
    nowLineLabel,
    isTodayCol,
    onPlannerViewKey,
    officeStart,
    officeEnd,
    onPlannerTouchStart,
    onPlannerTouchEnd,
    officeMarks,
    isPastCol,
    pastShadeStyle,
    comboboxPairingPartnerOptions,
    showBlockReschedule,
    showBlockManualLog,
    sessionForm,
    isPastSlot,
    pastBlockGraceHours,
    timesheetHorizonHours,
    isPastBlock,
    canLogTimesheet,
    isBlockLocked,
    hoverCard,
    cancelHideHover,
    hideBlockHover,
    showBlockHover,
    hoverStateText,
  });
}
