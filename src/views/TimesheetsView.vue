<template>
  <div class="space-y-4 sm:space-y-6">
<div class="rounded-3xl border shadow-xs overflow-hidden transition-colors" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
        
        <div class="p-4 border-b flex items-center justify-between gap-3 flex-wrap transition-colors" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-800' : 'bg-gray-50/60 border-gray-200'">
          <div class="flex items-center gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">Invoice-Verifiable Timesheet Summary</h3>
              <p class="text-xs mt-0.5" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
                Filtered for <strong class="text-blue-500">{{ selectedEmployee === 'All' ? 'All Team Members' : selectedEmployee }}</strong>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Horizon Filter Buttons (Day / Week / Month / All) -->
            <div class="inline-flex items-center rounded-xl border p-0.5 shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-white border-gray-300'" role="group" aria-label="Timesheet review horizon">
              <f-button
                v-for="hz in [['day', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['all', 'All Logs']]"
                :key="hz[0]"
                size="xs"
                :variant="timesheetHorizon === hz[0] ? 'solid' : 'ghost'"
                :theme="timesheetHorizon === hz[0] ? 'blue' : 'gray'"
                @click="timesheetHorizon = hz[0]"
                class="!text-xs font-semibold"
              >
                {{ hz[1] }}
              </f-button>
            </div>

            <!-- Member Filter Dropdown -->
            <f-dropdown-menu
              v-if="isManager"
              :items="employeeMenuItems"
              align="right"
              aria-label="Filter timesheets by team member"
            >
              <template #trigger="{ isOpen }">
                <f-button
                  variant="outline"
                  theme="gray"
                  size="sm"
                  class="!text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  :aria-expanded="isOpen ? 'true' : 'false'"
                >
                  <template #prefix>
                    <span>👤</span>
                  </template>
                  <span>{{ selectedEmployee === 'All' ? 'All Members' : selectedEmployee }}</span>
                  <template #suffix>
                    <svg class="w-3.5 h-3.5 opacity-60 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </template>
                </f-button>
              </template>
            </f-dropdown-menu>

            <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
              Total Hours: {{ totalFilteredHours }} hrs
            </span>
          </div>
        </div>

        <!-- Mobile Card List View -->
        <div class="block md:hidden divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-100'">
          <div v-for="b in filteredWorkBlocks" :key="b.name" class="p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs font-bold text-blue-500">{{ b.name }}</span>
              <span class="font-mono font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ Number(b.duration_hours).toFixed(2) }} hrs</span>
            </div>
            <h4 class="font-bold text-xs" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">{{ b.deliverable_notes || b.task_subject || 'General Task' }}</h4>
            <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>👤 {{ b.associate_name || b.employee }}</span>
              <span>📁 {{ b.project_name || 'General' }}</span>
              <span>📅 {{ b.work_date }}</span>
            </div>
          </div>

          <div v-if="filteredWorkBlocks.length === 0" class="p-8 text-center text-xs text-gray-400">
            No timesheet logs for {{ selectedEmployee }}.
          </div>
        </div>

        <!-- Desktop Full Table View -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="font-bold text-xs border-b" :class="isDarkMode ? 'bg-[#252528] text-gray-400 border-gray-800' : 'bg-gray-100/70 text-gray-600 border-gray-200'">
                <th class="py-3.5 px-4">Block ID</th>
                <th class="py-3.5 px-4">Work Date</th>
                <th class="py-3.5 px-4">Assignee</th>
                <th class="py-3.5 px-4">Deliverable Notes</th>
                <th class="py-3.5 px-4">Project</th>
                <th class="py-3.5 px-4">Nature</th>
                <th class="py-3.5 px-4">Duration</th>
                <th class="py-3.5 px-4">Approval Status</th>
                <th class="py-3.5 px-4 text-right" v-if="isManager">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">
              <tr v-for="b in filteredWorkBlocks" :key="b.name" class="transition-colors" :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50/80'">
                <td class="py-3.5 px-4 font-mono font-semibold" :class="isDarkMode ? 'text-blue-400' : 'text-blue-600'">{{ b.name }}</td>
                <td class="py-3.5 px-4" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ b.work_date }}</td>
                <td class="py-3.5 px-4 font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ b.associate_name || b.employee }}</td>
                <td class="py-3.5 px-4 max-w-xs truncate" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
                  <div>{{ b.deliverable_notes || b.task_subject }}</div>
                  <div v-if="b.flagged_reason" class="text-[10px] text-amber-500 font-medium mt-0.5 truncate" :title="b.flagged_reason">
                    🚩 Flag: {{ b.flagged_reason }}
                  </div>
                </td>
                <td class="py-3.5 px-4 font-medium" :class="isDarkMode ? 'text-gray-300' : 'text-gray-600'">{{ b.project_name || 'General Work' }}</td>
                <td class="py-3.5 px-4">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" :class="b.task_nature && b.task_nature.includes('Unplanned') ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'">
                    {{ b.task_nature || '🎯 Planned' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-mono font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                  <div>{{ Number(b.actual_hours || b.duration_hours).toFixed(2) }} hrs</div>
                  <div v-if="b.actual_hours && b.duration_hours" class="text-[10px] text-gray-400">plan: {{ Number(b.duration_hours).toFixed(2) }}h</div>
                </td>
                <td class="py-3.5 px-4">
                  <span v-if="b.approval_status === 'Approved'" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    ✓ Approved
                  </span>
                  <span v-else-if="b.approval_status === 'Flagged'" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    🚩 Flagged
                  </span>
                  <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {{ b.approval_status || 'Draft' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right" v-if="isManager">
                  <div class="flex items-center justify-end gap-1.5" v-if="b.actual_hours > 0 && b.approval_status !== 'Approved'">
                    <f-button
                      variant="solid"
                      theme="blue"
                      size="xs"
                      @click="quickApproveBlock(b)"
                      title="Approve timesheet"
                    >
                      ✓ Approve
                    </f-button>
                    <f-button
                      variant="outline"
                      theme="gray"
                      size="xs"
                      @click="quickFlagBlock(b)"
                      title="Flag for clarification"
                    >
                      🚩 Flag
                    </f-button>
                  </div>
                  <span v-else-if="b.approval_status === 'Approved'" class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Locked
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>
</template>

<script>
export default {
  name: 'TimesheetsView',
  props: {
    isDarkMode: { type: Boolean, default: false },
    isManager: { type: Boolean, default: false },
    timesheetFilterDate: { type: String, default: '' },
    managerTimesheets: { type: Array, default: () => [] },
    employeeFilter: { type: String, default: '' },
    employeeList: { type: Array, default: () => [] },
    fmtHrs: { type: Function, default: (h) => (h != null ? Number(h).toFixed(2) : '0.00') },
    hhmm: { type: Function, default: (t) => (t ? t.slice(0, 5) : '') }
  },
  emits: [
    'update-filter-date',
    'open-block-drawer',
    'approve-timesheet',
    'reject-timesheet'
  ]
}
</script>
