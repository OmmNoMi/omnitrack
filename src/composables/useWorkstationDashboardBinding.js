import { ref } from "vue";
import { useWorkstationDashboard } from "./useWorkstationDashboard.js";

/**
 * Dashboard store binding.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationDashboardBinding(w) {
  const { _minsOf, addDays, currentUser, filteredWorkBlocks, getLocalTodayISO, isDarkMode, isNonWorkingNature, isTracking, nowMinute, selectedEmployee, selectedProject, teamMembers, todayDate, todayISO, trackerBlockName, trackerBoundBlock } = w;

  // Dashboard Domain Store Integration
  const dashboardStore = useWorkstationDashboard({
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
    _minsOf,
    nowMinute
  });
  const {
    selectedDashboardDate,
    dashboardWeekOffset,
    dashboardWeekDays,
    selectedDashboardDateLabel,
    pastBlocksHeading,
    getBlockBadgeTheme,
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
    countedNow,
    blockCountedHours,
    getStartsInText,
    upcomingFocusBlocks,
    pastFocusBlocks,
    showAllPastBlocks,
    visiblePastFocusBlocks,
    remainingPastBlocksCount,
    concludedRovingRow,
    concludedRovingCol,
    canBlockReopen,
    setConcludedRoving,
    concludedTabindex,
    focusConcludedCell,
    onConcludedGridKey,
    toggleShowAllPastBlocks,
    dashboardKPIs,
    updateDashboardKPIs,
    paciPlannedHours,
    paciUnplannedHours,
    paciNonWorkingHours,
    paciRatio,
    totalFilteredHours,
    _blockEffectiveStartMins,
    _byTimeDesc,
    _byTimeAsc
  } = dashboardStore;
  // Kept under this name for the keyboard shortcut and the header menu; it is the one plan dialog
  const openNewTaskModal = (initialDateOrOpts = null) => {
    // `@click="openNewTaskModal"` passes the MouseEvent here; only a YYYY-MM-DD string is a date
    let explicit = null;
    let askTask = false;
    const isEvent = initialDateOrOpts && typeof initialDateOrOpts === 'object' && ('preventDefault' in initialDateOrOpts || 'target' in initialDateOrOpts);
    if (typeof initialDateOrOpts === 'string') {
      explicit = initialDateOrOpts;
    } else if (initialDateOrOpts && typeof initialDateOrOpts === 'object' && !isEvent) {
      if (typeof initialDateOrOpts.date === 'string') explicit = initialDateOrOpts.date;
      if (initialDateOrOpts.askTask) askTask = true;
    }
    w.workBlockStore.openPlanDialog({
      date: explicit || selectedDashboardDate.value || todayDate.value,
      askTask
    });
  };

  Object.assign(w, {
    selectedDashboardDate,
    dashboardWeekOffset,
    dashboardWeekDays,
    selectedDashboardDateLabel,
    pastBlocksHeading,
    getBlockBadgeTheme,
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
    countedNow,
    blockCountedHours,
    getStartsInText,
    upcomingFocusBlocks,
    pastFocusBlocks,
    showAllPastBlocks,
    visiblePastFocusBlocks,
    remainingPastBlocksCount,
    concludedRovingRow,
    concludedRovingCol,
    canBlockReopen,
    setConcludedRoving,
    concludedTabindex,
    focusConcludedCell,
    onConcludedGridKey,
    toggleShowAllPastBlocks,
    dashboardKPIs,
    updateDashboardKPIs,
    paciPlannedHours,
    paciUnplannedHours,
    paciNonWorkingHours,
    paciRatio,
    totalFilteredHours,
    openNewTaskModal,
  });
}
