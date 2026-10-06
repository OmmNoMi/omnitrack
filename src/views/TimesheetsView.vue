<template>
  <section class="rounded-2xl border overflow-hidden" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'" aria-labelledby="timesheets-heading">
    <!-- Toolbar: period, person, total. Approval happens inside each timesheet, not here. -->
    <div class="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
      <h2 id="timesheets-heading" class="text-base font-semibold" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">Timesheets</h2>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="inline-flex items-center gap-0.5 rounded-lg p-0.5" :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'" role="group" aria-label="Period">
          <Button
            v-for="hz in horizons"
            :key="hz.id"
            size="sm"
            :variant="timesheetHorizon === hz.id ? 'solid' : 'ghost'"
            :theme="timesheetHorizon === hz.id ? 'blue' : 'gray'"
            :aria-pressed="timesheetHorizon === hz.id ? 'true' : 'false'"
            @click="timesheetHorizon = hz.id">{{ hz.label }}</Button>
        </div>
        <div v-if="isManager" class="w-52">
          <Combobox
            open-on-click
            :model-value="selectedEmployee"
            :options="employeeOptions"
            placeholder="Search teammates"
            aria-label="Filter timesheets by team member"
            @update:model-value="setSelectedEmployee"
          />
        </div>
        <span class="text-sm font-semibold tabular-nums" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'" title="Total hours in this view">{{ totalFilteredHours }}h</span>
      </div>
    </div>

    <p v-if="filteredWorkBlocks.length === 0" class="px-4 py-10 text-center text-sm" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
      No timesheets in this period.
    </p>

    <!-- One list for every width: each row opens the timesheet, where it can be reviewed -->
    <ul v-else class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-100'" aria-label="Timesheets">
      <li v-for="b in filteredWorkBlocks" :key="b.name">
        <button
          type="button"
          class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
          :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'"
          :title="details(b)"
          @click="openBlockDrawer(b)">
          <span class="w-20 shrink-0 text-xs tabular-nums" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ shortDate(b.work_date) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium truncate" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ b.deliverable_notes || b.task_subject || 'Work block' }}</span>
            <span class="block text-xs truncate" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
              <template v-if="selectedEmployee === 'All'">{{ b.associate_name || b.employee }} · </template>{{ b.project_name || 'General' }}
            </span>
          </span>
          <span class="shrink-0 text-sm font-semibold tabular-nums" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ hoursOf(b) }}h</span>
          <Badge class="shrink-0 w-[7.5rem] justify-center" :theme="status(b).theme" variant="subtle">{{ status(b).label }}</Badge>
        </button>
      </li>
    </ul>
  </section>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';

export default {
  name: 'TimesheetsView',
  data() {
    return {
      horizons: [
        { id: 'day', label: 'Today' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
        { id: 'all', label: 'All' },
      ],
    };
  },
  methods: {
    hoursOf(b) { return Number(b.actual_hours || b.duration_hours || 0).toFixed(2); },
    shortDate(d) {
      if (!d) return '';
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },
    // The one status a timesheet carries in the list; review actions live in the drawer.
    status(b) {
      if (b.approval_status === 'Approved') return { theme: 'green', label: 'Approved' };
      if (b.approval_status === 'Flagged') return { theme: 'orange', label: 'Flagged' };
      if (Number(b.actual_hours) > 0) return { theme: 'blue', label: 'Awaiting approval' };
      return { theme: 'gray', label: 'Not logged' };
    },
    details(b) {
      return [
        b.name,
        b.task_nature || '',
        b.duration_hours ? Number(b.duration_hours).toFixed(2) + 'h planned' : '',
        b.flagged_reason ? 'Flagged: ' + b.flagged_reason : '',
      ].filter(Boolean).join(' · ');
    },
  },
  setup() {
    return useWorkstationContext([
      'employeeOptions',
      'setSelectedEmployee',
      'filteredWorkBlocks',
      'openBlockDrawer',
      'selectedEmployee',
      'timesheetHorizon',
      'totalFilteredHours',
      'isDarkMode',
      'isManager'
    ]);
  },
}
</script>
