import { ref, computed, watch, nextTick } from "vue";
import { useDashboardDayNav } from "./useDashboardDayNav.js";
import { toKind } from "../utils/activity.js";
import { useDashboardKpis } from "./useDashboardKpis.js";
import { useDashboardConcludedGrid } from "./useDashboardConcludedGrid.js";

export function useWorkstationDashboard({
  todayDate,
  filteredWorkBlocks,
  isTracking,
  trackerBlockName,
  trackerBoundBlock,
  isDarkMode,
  isNonWorkingNature,
  getLocalTodayISO,
  todayISO,
  addDays,
  _minsOf
}) {
  // Google Meet-Style Dashboard State & Agenda
  const selectedDashboardDate = ref(getLocalTodayISO());
  const dashboardWeekOffset = ref(0);

  const dashboardWeekDays = computed(() => {
    const todayStr = todayDate.value || getLocalTodayISO();
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const centerDate = new Date(ty, tm - 1, td);
    centerDate.setDate(centerDate.getDate() + (dashboardWeekOffset.value * 7));

    const days = [];
    const dowNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = -3; i <= 3; i++) {
      const d = new Date(centerDate);
      d.setDate(centerDate.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayNum}`;
      days.push({
        dateStr,
        dayNum: d.getDate(),
        dow: dowNames[d.getDay()],
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDashboardDate.value
      });
    }
    return days;
  });

  const selectedDashboardDateLabel = computed(() => {
    if (!selectedDashboardDate.value) return '';
    const [y, m, d] = selectedDashboardDate.value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  });

  const _isPastDay = () => !!(selectedDashboardDate.value && todayDate.value && selectedDashboardDate.value < todayDate.value);

  const _blockEffectiveStartMins = (b, targetDate) => {
    if (!b) return -1;
    if (targetDate && b.work_date !== targetDate && b.start_time && b.end_time) {
      const sMins = _minsOf(b.start_time);
      const eMins = _minsOf(b.end_time);
      if (eMins < sMins) return 0;
    }
    return _minsOf(b.start_time);
  };

  const _byTimeDesc = (list) => {
    const dt = selectedDashboardDate.value;
    return [...list].sort((x, y) => _blockEffectiveStartMins(y, dt) - _blockEffectiveStartMins(x, dt));
  };
  const _byTimeAsc = (list) => {
    const dt = selectedDashboardDate.value;
    return [...list].sort((x, y) => _blockEffectiveStartMins(x, dt) - _blockEffectiveStartMins(y, dt));
  };

  const dayFocusBlocks = computed(() => {
    const dt = selectedDashboardDate.value;
    return filteredWorkBlocks.value.filter(b => {
      if (b.work_date === dt) return true;
      if (b.start_time && b.end_time && dt && b.work_date && addDays(b.work_date, 1) === dt) {
        const sMins = _minsOf(b.start_time);
        const eMins = _minsOf(b.end_time);
        if (eMins < sMins) return true;
      }
      return false;
    });
  });

  const awayFocusBlocks = computed(() => {
    return dayFocusBlocks.value.filter(b => isNonWorkingNature(b.task_nature));
  });

  const workFocusBlocks = computed(() => {
    return dayFocusBlocks.value.filter(b => !isNonWorkingNature(b.task_nature));
  });

  const isBlockCompleted = (b) => {
    if (!b) return false;
    const act = parseFloat(b.actual_hours) || 0;
    const dur = parseFloat(b.duration_hours) || 0;
    return b.status === 'Completed' || b.status === 'Logged (Full)' || b.status === 'Logged (Partial)' || b.status === 'Logged (Over)' || (act > 0 && act >= dur);
  };

  const activeOrCurrentBlocks = computed(() => {
    const list = [];
    if (isTracking.value && trackerBoundBlock.value) {
      list.push(trackerBoundBlock.value);
    }
    workFocusBlocks.value.forEach(b => {
      if (list.some(x => x.name === b.name)) return;
      if (isBlockCompleted(b) || b.status === 'Cancelled' || b.status === 'Rescheduled' || b.status === 'Missed') return;
      const todayStr = todayDate.value || getLocalTodayISO();
      if (selectedDashboardDate.value === todayStr && b.start_time && b.end_time) {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const [sh, sm] = b.start_time.split(':').map(Number);
        const [eh, em] = b.end_time.split(':').map(Number);
        const sMins = sh * 60 + (sm || 0);
        const eMins = eh * 60 + (em || 0);
        if (nowMins >= sMins && nowMins <= eMins) {
          list.push(b);
        }
      }
    });
    return list;
  });

  const untrackedCurrentBlocks = computed(() => {
    return activeOrCurrentBlocks.value.filter(b => !(isTracking.value && trackerBoundBlock.value && b.name === trackerBoundBlock.value.name));
  });

  const isBlockInNow = (b) => {
    if (!b) return false;
    return activeOrCurrentBlocks.value.some(x => x.name === b.name);
  };

  const isBlockConcluded = (b) => {
    if (!b) return false;
    if (isBlockCompleted(b)) return true;
    if (b.status === 'Cancelled' || b.status === 'Rescheduled' || b.status === 'Missed' || b.status === 'Completed' || b.status === 'Logged (Full)' || b.status === 'Logged (Over)' || b.status === 'Logged (Partial)') return true;
    if (_isPastDay()) return true;
    const isToday = selectedDashboardDate.value === todayDate.value;
    if (isToday) {
      const endMin = _minsOf(b.end_time);
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (endMin > 0 && endMin <= nowMins && (!isTracking.value || trackerBoundBlock.value?.name !== b.name) && !isBlockInNow(b)) return true;
    }
    return false;
  };

  const upNextBlock = computed(() => {
    if (_isPastDay()) return null;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const activeNames = new Set(activeOrCurrentBlocks.value.map(b => b.name));

    const upcoming = workFocusBlocks.value
      .filter(b => !activeNames.has(b.name) && !isBlockConcluded(b))
      .sort((a, b) => _minsOf(a.start_time) - _minsOf(b.start_time));

    const nextFuture = upcoming.find(b => _minsOf(b.start_time) >= nowMins);
    if (nextFuture) return nextFuture;

    const currentWindow = upcoming.find(b => _minsOf(b.end_time) > nowMins);
    return currentWindow || null;
  });

  const getStartsInText = (b) => {
    if (!b || !b.start_time) return '';
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = b.start_time.split(':').map(Number);
    const sMins = sh * 60 + (sm || 0);
    const diff = sMins - nowMins;
    if (diff > 0 && diff < 60) return `Starts in ${diff}m`;
    if (diff >= 60) {
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return m > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${h}h`;
    }
    const endMin = _minsOf(b.end_time);
    if (endMin > nowMins) {
      const rem = endMin - nowMins;
      return `In progress · ${rem}m left`;
    }
    return 'Scheduled time passed';
  };

  const upcomingFocusBlocks = computed(() => {
    if (_isPastDay()) return [];
    const activeNames = new Set(activeOrCurrentBlocks.value.map(b => b.name));
    return _byTimeAsc(workFocusBlocks.value.filter(b => {
      if (activeNames.has(b.name)) return false;
      if (isBlockConcluded(b)) return false;
      return true;
    }));
  });

  const pastFocusBlocks = computed(() => {
    if (_isPastDay()) return _byTimeDesc(workFocusBlocks.value);
    return _byTimeDesc(workFocusBlocks.value.filter(b => isBlockConcluded(b)));
  });

  const showAllPastBlocks = ref(false);
  const visiblePastFocusBlocks = computed(() => {
    if (showAllPastBlocks.value || pastFocusBlocks.value.length <= 2) {
      return pastFocusBlocks.value;
    }
    return pastFocusBlocks.value.slice(0, 2);
  });
  const remainingPastBlocksCount = computed(() => Math.max(0, pastFocusBlocks.value.length - 2));

  const pastBlocksHeading = computed(() => {
    const sel = selectedDashboardDate.value, t = todayDate.value;
    return (sel && t && sel < t) ? 'What Happened · Plan vs Timesheet' : 'Daily Accomplishments & Concluded Deliverables';
  });

  const pastDeliverablesStats = computed(() => {
    const blocks = pastFocusBlocks.value || [];
    let completedCount = 0;
    let cancelledCount = 0;
    let totalLogged = 0;
    let totalPlanned = 0;
    blocks.forEach(b => {
      if (b.status === 'Cancelled') {
        cancelledCount++;
      } else {
        completedCount++;
      }
      totalLogged += parseFloat(b.actual_hours || 0);
      totalPlanned += parseFloat(b.duration_hours || 0);
    });
    const adherencePct = totalPlanned > 0 ? Math.min(100, Math.round((totalLogged / totalPlanned) * 100)) : 100;
    return {
      totalCount: blocks.length,
      completedCount,
      cancelledCount,
      totalLogged: totalLogged.toFixed(1),
      totalPlanned: totalPlanned.toFixed(1),
      adherencePct
    };
  });

  const getBlockCardAccent = (b) => {
    if (!b) return null;
    if (b.status === 'Cancelled') return 'red';
    const act = parseFloat(b.actual_hours || 0);
    const dur = parseFloat(b.duration_hours || 0);
    if (b.status === 'Logged (Over)' || act > dur + 0.05) return 'purple';
    if (b.status === 'Logged (Partial)' || (act < dur - 0.05 && act > 0)) return 'amber';
    return 'green';
  };

  const getBlockBadgeTheme = (b) => {
    if (!b) return 'gray';
    const st = (b.status || '').toLowerCase();
    if (st === 'cancelled') return 'red';
    if (st === 'completed' || st === 'logged (full)') return 'green';
    if (st === 'logged (partial)') return 'orange';
    if (st === 'logged (over)') return 'blue';
    if (st === 'in progress') return 'blue';
    if (st === 'missed') return 'red';
    return 'blue';
  };

  const getBlockVarianceBadge = (b) => {
    if (!b || b.status === 'Cancelled') return null;
    const act = parseFloat(b.actual_hours || 0);
    const dur = parseFloat(b.duration_hours || 0);
    const diff = Math.round((act - dur) * 100) / 100;
    if (Math.abs(diff) < 0.05) {
      return { label: 'On Schedule (±0.0h)', theme: 'green' };
    }
    if (diff < 0) {
      const mins = Math.round(Math.abs(diff) * 60);
      return { label: `Concluded ${mins}m early (${diff.toFixed(1)}h)`, theme: 'orange' };
    }
    const mins = Math.round(diff * 60);
    return { label: `Overrun +${mins}m (+${diff.toFixed(1)}h)`, theme: 'blue' };
  };

  const focusBlocksHeading = computed(() => {
    const sel = selectedDashboardDate.value;
    const t = todayDate.value;
    if (sel && t && sel < t) return 'Focus blocks that were planned';
    if (sel && t && sel > t) return 'Planned focus blocks';
    return 'Upcoming focus blocks';
  });

  const dashboardDayTitle = computed(() => {
    if (!selectedDashboardDate.value) return 'Your Day';
    if (selectedDashboardDate.value === todayDate.value) return 'Your Day';
    const [y, m, d] = selectedDashboardDate.value.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const rel = dt > new Date() ? 'Planned for ' : '';
    return rel + dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  });

  const dashboardDaySummary = computed(() => {
    const blocks = dayFocusBlocks.value || [];
    const planned = blocks.reduce((t, b) => t + (Number(b.duration_hours) || 0), 0);
    const logged = blocks.reduce((t, b) => t + (Number(b.actual_hours) || 0), 0);
    const date = selectedDashboardDateLabel.value;
    // The empty state below already says nothing is planned; the subtitle only names the day.
    if (!blocks.length) return date;
    const n = blocks.length + (blocks.length === 1 ? ' block' : ' blocks');
    return date + ' · ' + n + ' · ' + planned.toFixed(1) + 'h planned · ' + logged.toFixed(1) + 'h logged';
  });

  const todayDirection = computed(() => {
    const t = todayDate.value;
    const sel = selectedDashboardDate.value;
    if (!t || !sel) return '';
    if (sel !== t) return t < sel ? 'left' : 'right';
    if (dashboardWeekOffset.value > 0) return 'left';
    if (dashboardWeekOffset.value < 0) return 'right';
    return '';
  });

  const { shiftDashboardWeek, selectDashboardDate, onDashboardDayKey, resetDashboardToToday } =
    useDashboardDayNav({ selectedDashboardDate, dashboardWeekOffset, dashboardWeekDays, todayDate, getLocalTodayISO });

  const formatAmPm = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const formatBlockRange = (b) => {
    if (!b.start_time || !b.end_time) return 'All Day';
    return `${formatAmPm(b.start_time)} – ${formatAmPm(b.end_time)}`;
  };

  const getMeetUrl = (b) => {
    if (!b) return null;
    if (b.meet_url) return b.meet_url;
    const notes = b.deliverable_notes || '';
    const match = notes.match(/https:\/\/(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\/[^\s"'>]+/i);
    return match ? match[0] : null;
  };

  const getBlockTimingInfo = (b) => {
    const dark = isDarkMode.value;
    const pill = (label, light, night) => ({ label, pillClass: dark ? night : light });
    if (!b) return pill('—', 'bg-gray-100 text-gray-600', 'bg-gray-800 text-gray-300');
    const status = (b.status || '').toLowerCase();
    if (status === 'cancelled') return pill(b.cancel_reason ? `Cancelled (${b.cancel_reason})` : 'Cancelled', 'bg-rose-50 text-rose-600 line-through border border-rose-200', 'bg-rose-950/70 text-rose-400 line-through border border-rose-900');
    if (status === 'rescheduled') return pill('Rescheduled ↗', 'bg-slate-100 text-slate-600 border border-dashed border-slate-300', 'bg-slate-800 text-slate-400 border border-dashed border-slate-700');
    if (status === 'logged (full)') return pill('Logged (Full)', 'bg-emerald-50 text-emerald-700 border border-emerald-200', 'bg-emerald-950/70 text-emerald-300 border border-emerald-800');
    if (status === 'logged (partial)') return pill('Logged (Partial)', 'bg-amber-50 text-amber-700 border border-amber-200', 'bg-amber-950/70 text-amber-300 border border-amber-800');
    if (status === 'logged (over)') return pill('Logged (Over)', 'bg-purple-50 text-purple-700 border border-purple-200', 'bg-purple-950/70 text-purple-300 border border-purple-800');
    if (status === 'completed') return pill('Completed', 'bg-emerald-50 text-emerald-700', 'bg-emerald-950/70 text-emerald-300');
    if (isTracking.value && trackerBlockName.value === b.name) return pill('Recording', 'bg-red-600 text-white', 'bg-red-600 text-white');
    if (status === 'in progress') return pill('In Progress', 'bg-blue-50 text-blue-700', 'bg-blue-950/70 text-blue-300');
    if (status === 'missed') return pill('Missed', 'bg-red-50 text-red-600 border border-red-200', 'bg-red-950/70 text-red-400 border border-red-800');
    if (b.is_away) {
      return pill(toKind(b.task_nature), 'bg-rose-50 text-rose-700 border border-rose-200', 'bg-rose-950/70 text-rose-300 border border-rose-800/60');
    }

    const date = b.work_date || '';
    const today = todayDate.value || todayISO();
    if (date && date < today) return pill('Missed', 'bg-rose-50 text-rose-700', 'bg-rose-950/70 text-rose-300');
    if (date && date > today) return pill('Upcoming', 'bg-gray-100 text-gray-600', 'bg-gray-800 text-gray-300');
    const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
    const startMin = _minsOf(b.start_time);
    const endMin = _minsOf(b.end_time);
    if (endMin > startMin && nowMin >= startMin && nowMin < endMin) return pill('Now', 'bg-blue-50 text-blue-700', 'bg-blue-950/70 text-blue-300');
    if (endMin > startMin && nowMin >= endMin) return pill('Overdue', 'bg-amber-50 text-amber-700', 'bg-amber-950/70 text-amber-300');
    return pill('Today', 'bg-gray-100 text-gray-600', 'bg-gray-800 text-gray-300');
  };

  const { dashboardKPIs, updateDashboardKPIs, paciPlannedHours, paciUnplannedHours, paciNonWorkingHours, paciRatio, totalFilteredHours } =
    useDashboardKpis({ filteredWorkBlocks, isNonWorkingNature });

  const {
    concludedRovingRow, concludedRovingCol, canBlockReopen, hasBlockExpandableNotes, getConcludedNotesCol, getMaxConcludedCol,
    setConcludedRoving, concludedTabindex, focusConcludedCell, onConcludedGridKey, toggleShowAllPastBlocks,
    expandedBlockNotes, isBlockNotesExpanded, toggleBlockNotes, isLongNote
  } = useDashboardConcludedGrid({ selectedDashboardDate, showAllPastBlocks, visiblePastFocusBlocks });


  return {
    selectedDashboardDate,
    dashboardWeekOffset,
    dashboardWeekDays,
    selectedDashboardDateLabel,
    pastBlocksHeading,
    pastDeliverablesStats,
    getBlockCardAccent,
    getBlockBadgeTheme,
    getBlockVarianceBadge,
    focusBlocksHeading,
    dashboardDayTitle,
    dashboardDaySummary,
    todayDirection,
    shiftDashboardWeek,
    selectDashboardDate,
    onDashboardDayKey,
    resetDashboardToToday,
    formatAmPm,
    formatBlockRange,
    getMeetUrl,
    getBlockTimingInfo,
    dayFocusBlocks,
    awayFocusBlocks,
    workFocusBlocks,
    activeOrCurrentBlocks,
    untrackedCurrentBlocks,
    upNextBlock,
    isBlockInNow,
    isBlockConcluded,
    isBlockCompleted,
    getStartsInText,
    upcomingFocusBlocks,
    pastFocusBlocks,
    showAllPastBlocks,
    visiblePastFocusBlocks,
    remainingPastBlocksCount,
    concludedRovingRow,
    concludedRovingCol,
    canBlockReopen,
    hasBlockExpandableNotes,
    getConcludedNotesCol,
    getMaxConcludedCol,
    setConcludedRoving,
    concludedTabindex,
    focusConcludedCell,
    onConcludedGridKey,
    toggleShowAllPastBlocks,
    expandedBlockNotes,
    isBlockNotesExpanded,
    toggleBlockNotes,
    isLongNote,
    dashboardKPIs,
    updateDashboardKPIs,
    paciPlannedHours,
    paciUnplannedHours,
    paciNonWorkingHours,
    paciRatio,
    totalFilteredHours,
    _minsOf,
    _blockEffectiveStartMins,
    _byTimeDesc,
    _byTimeAsc
  };
}
