<template>
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
    <!-- Title names the day; subtitle says what is in it. Shift+D lives in the strip tooltip. -->
    <div class="min-w-0" data-day-section>
      <h2 class="text-xl sm:text-2xl font-bold tracking-tight" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
        {{ dashboardDayTitle }}
      </h2>
      <p class="text-xs mt-0.5" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
        {{ dashboardDaySummary }}
      </p>
    </div>

    <div class="flex items-center gap-2 min-w-0">
      <!-- 7-day strip: the day chips are a roving radiogroup; Today and the arrows are plain buttons -->
      <div class="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar py-1"
        aria-label="Pick a day" data-day-strip @keydown="onDashboardDayKey">
        <Button v-if="todayDirection === 'left'" size="sm" variant="subtle" icon-left="chevron-left" label="Jump to today" tooltip="Jump to today" @click="resetDashboardToToday">Today</Button>
        <Button size="sm" variant="ghost" icon="chevron-left" label="Previous 7 days" tooltip="Previous week" @click="shiftDashboardWeek(-1)" />
        <!-- No title on a wrapper: it is inherited by every child and stacks on the arrow Buttons' own tooltips -->
        <div class="flex items-center gap-0.5 sm:gap-1" role="radiogroup" aria-label="Day of the week" aria-keyshortcuts="Shift+D">
          <button
            v-for="d in dashboardWeekDays"
            :key="d.dateStr"
            type="button"
            data-day-btn
            role="radio"
            :aria-checked="d.isSelected ? 'true' : 'false'"
            :aria-label="d.dateStr"
            :title="d.dateStr + ' · Shift+D, then ← →'"
            :tabindex="d.isSelected ? 0 : -1"
            class="flex flex-col items-center justify-center min-w-[36px] sm:min-w-[42px] py-1.5 rounded-xl text-center transition-colors cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            :class="d.isSelected ? 'bg-[#1B64DA] text-white' : (isDarkMode ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-800')"
            @click="selectDashboardDate(d.dateStr)">
            <span class="text-[10px] font-semibold">{{ d.dow }}</span>
            <span class="text-sm font-bold" :class="d.isToday && !d.isSelected ? 'text-blue-600' : ''">{{ d.dayNum }}</span>
            <span class="w-1 h-1 rounded-full" :class="d.isToday ? (d.isSelected ? 'bg-white' : 'bg-blue-600') : 'bg-transparent'" aria-hidden="true"></span>
          </button>
        </div>
        <Button size="sm" variant="ghost" icon="chevron-right" label="Next 7 days" tooltip="Next week" @click="shiftDashboardWeek(1)" />
        <Button v-if="todayDirection === 'right'" size="sm" variant="subtle" icon-right="chevron-right" label="Jump to today" tooltip="Jump to today" @click="resetDashboardToToday">Today</Button>
      </div>

      <!-- The one "plan" action on the dashboard; icon-only on phones -->
      <Button variant="solid" theme="blue" icon-left="plus" label="Plan a new focus block" tooltip="Plan focus block" class="shrink-0" @click="openNewTaskModal">
        <span class="hidden sm:inline">Plan</span>
      </Button>
    </div>
  </div>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

export default {
  name: 'DashboardDateSelector',
  setup() {
    return useWorkstationContext([
      'dashboardDaySummary',
      'dashboardDayTitle',
      'dashboardWeekDays',
      'isDarkMode',
      'onDashboardDayKey',
      'openNewTaskModal',
      'resetDashboardToToday',
      'selectDashboardDate',
      'shiftDashboardWeek',
      'todayDirection'
    ]);
  },
};
</script>
