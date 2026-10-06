import { ref, computed } from "vue";

/** Dashboard KPI snapshot and the planned/unplanned (PACI) hour rollups. */
export function useDashboardKpis({ filteredWorkBlocks, isNonWorkingNature }) {
  const DEFAULT_KPIS = {
    today: { target_hours: 8, planned_hours: 0, actual_hours: 0, variance_hours: 0, away_count: 0, block_count: 0, completed_count: 0, todo_completed_pct: 0, non_working_hours: 0 },
    week: { target_hours: 40, planned_hours: 0, actual_hours: 0, variance_hours: 0, adherence_pct: 0, away_count: 0, block_count: 0, non_working_hours: 0 },
    month: { target_hours: 160, planned_hours: 0, actual_hours: 0, capacity_hours: 160, capacity_pct: 0, away_count: 0, block_count: 0, non_working_hours: 0 }
  };

  const dashboardKPIs = ref(JSON.parse(JSON.stringify(DEFAULT_KPIS)));

  const updateDashboardKPIs = (incoming) => {
    if (!incoming || typeof incoming !== 'object') return;
    const base = JSON.parse(JSON.stringify(DEFAULT_KPIS));
    ['today', 'week', 'month'].forEach(section => {
      base[section] = Object.assign(
        {},
        base[section],
        dashboardKPIs.value && dashboardKPIs.value[section] ? dashboardKPIs.value[section] : {},
        incoming[section] && typeof incoming[section] === 'object' ? incoming[section] : {}
      );
    });
    dashboardKPIs.value = base;
  };

  // PACI Computeds
  const paciPlannedHours = computed(() => {
    const list = filteredWorkBlocks.value;
    // Planned-ness is the block's own flag, never its activity
    const total = list.filter(b => !isNonWorkingNature(b.task_nature) && !b.unplanned)
                      .reduce((acc, b) => acc + (parseFloat(b.duration_hours) || 0), 0);
    return total.toFixed(1);
  });

  const paciUnplannedHours = computed(() => {
    const list = filteredWorkBlocks.value;
    const total = list.filter(b => !isNonWorkingNature(b.task_nature) && b.unplanned)
                      .reduce((acc, b) => acc + (parseFloat(b.duration_hours) || 0), 0);
    return total.toFixed(1);
  });

  const paciNonWorkingHours = computed(() => {
    const list = filteredWorkBlocks.value;
    const total = list.filter(b => isNonWorkingNature(b.task_nature))
                      .reduce((acc, b) => acc + (parseFloat(b.actual_hours || b.duration_hours) || 0), 0);
    return total.toFixed(1);
  });

  const paciRatio = computed(() => {
    const p = parseFloat(paciPlannedHours.value) || 0;
    const u = parseFloat(paciUnplannedHours.value) || 0;
    const total = p + u;
    if (total === 0) return 0;
    return Math.round((p / total) * 100);
  });

  const totalFilteredHours = computed(() => {
    return (parseFloat(paciPlannedHours.value) + parseFloat(paciUnplannedHours.value)).toFixed(1);
  });



  return {
    dashboardKPIs,
    updateDashboardKPIs,
    paciPlannedHours,
    paciUnplannedHours,
    paciNonWorkingHours,
    paciRatio,
    totalFilteredHours
  };
}
