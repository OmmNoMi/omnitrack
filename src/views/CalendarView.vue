<template>
  <div class="space-y-4 sm:space-y-5 lg:space-y-0 lg:flex-1 lg:min-h-0 lg:h-full lg:flex lg:flex-col">
<!-- 3-Column Responsive Grid on Big Large Screens: Left Assigned Work · Center Calendar · Right Stats -->
      <div class="grid grid-cols-1 lg:grid-cols-[240px_1fr_220px] xl:grid-cols-[280px_1fr_260px] gap-3.5 sm:gap-4 items-stretch lg:h-full lg:min-h-0 flex-1">

        <!-- Left rail: assigned tasks (Frappe UI FCard) -->
        <CalendarAssignedTasks />

        <!-- Calendar (Frappe UI FCard Container) -->
        <CalendarPlannerGrid />

        <!-- Right side rail: Statistical Counts Cards (Right side panel on big screens) -->
        <CalendarWeekStats />
      </div>  <!-- /planner three-column grid -->
    </div>  <!-- /TAB 8: PLANNER -->
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import CalendarAssignedTasks from './calendar/CalendarAssignedTasks.vue';
import CalendarPlannerGrid from './calendar/CalendarPlannerGrid.vue';
import CalendarWeekStats from './calendar/CalendarWeekStats.vue';

export default {
  name: 'CalendarView',
  components: { CalendarAssignedTasks, CalendarPlannerGrid, CalendarWeekStats },
  setup() {
    return useWorkstationContext([

    ]);
  },
}
</script>
