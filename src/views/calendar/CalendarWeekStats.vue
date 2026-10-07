<template>
  <div class="order-3 lg:col-span-1 xl:col-span-1 flex flex-col space-y-2.5 w-full min-h-0 lg:h-full lg:max-h-full overflow-hidden">
    <div class="flex items-center justify-between px-1 shrink-0">
      <h3 class="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300">Week Performance</h3>
      <span class="text-[10px] font-mono font-semibold" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Overview</span>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 content-start items-start gap-2 sm:gap-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
      <!-- Card 1: Planned this week -->
      <div :class="['omni-card']" class="!p-2.5 xl:!p-3 transition-all">
        <div class="flex items-center justify-between">
          <div class="text-[10px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">Planned this week</div>
          <Badge v-if="plannerData.totals && plannerData.totals.away_count" theme="orange" variant="subtle" size="sm">
            {{ plannerData.totals.away_count }} away
          </Badge>
        </div>
        <div class="text-lg xl:text-xl font-extrabold mt-0.5" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
          {{ fmtHrs(plannerData.totals.planned_hours) }}<span class="text-xs font-normal text-gray-600 dark:text-gray-300">h</span>
        </div>
        <div class="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">
          {{ plannerData.totals.block_count }} work block{{ plannerData.totals.block_count === 1 ? '' : 's' }}
        </div>
      </div>

      <!-- Card 2: Actually logged -->
      <div :class="['omni-card']" class="!p-2.5 xl:!p-3 transition-all">
        <div class="text-[10px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">Actually logged</div>
        <div class="text-lg xl:text-xl font-extrabold text-emerald-500 mt-0.5">
          {{ fmtHrs(plannerData.totals.actual_hours) }}<span class="text-xs font-normal text-gray-600 dark:text-gray-300">h</span>
        </div>
        <div class="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">across real sessions</div>
      </div>

      <!-- Card 3: Plan vs actual -->
      <div :class="['omni-card']" class="!p-2.5 xl:!p-3 transition-all">
        <div class="text-[10px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">Plan vs actual</div>
        <div class="text-lg xl:text-xl font-extrabold mt-0.5" :class="plannerData.totals.variance_hours < 0 ? 'text-amber-500' : (plannerData.totals.variance_hours > 0 ? 'text-rose-500' : 'text-gray-600 dark:text-gray-300')">
          {{ plannerData.totals.variance_hours > 0 ? '+' : '' }}{{ fmtHrs(plannerData.totals.variance_hours) }}<span class="text-xs font-normal text-gray-600 dark:text-gray-300">h</span>
        </div>
        <div class="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5">
          {{ plannerData.totals.variance_hours < 0 ? 'under-logged vs plan' : (plannerData.totals.variance_hours > 0 ? 'overran the plan' : 'on plan') }}
        </div>
      </div>

      <!-- Card 4: Adherence -->
      <div :class="['omni-card']" class="!p-2.5 xl:!p-3 transition-all">
        <div class="text-[10px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">Adherence</div>
        <div class="text-lg xl:text-xl font-extrabold text-blue-500 mt-0.5">
          {{ plannerData.totals.adherence_pct }}<span class="text-xs font-normal text-gray-600 dark:text-gray-300">%</span>
        </div>
        <div class="mt-1 h-1.5 rounded-full overflow-hidden" :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'">
          <div class="h-full bg-blue-500 rounded-full transition-all duration-300" :style="{ width: Math.min(100, plannerData.totals.adherence_pct) + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

export default {
  name: 'CalendarWeekStats',
  setup() {
    return useWorkstationContext([
      'fmtHrs',
      'isDarkMode',
      'plannerData'
    ]);
  },
};
</script>
