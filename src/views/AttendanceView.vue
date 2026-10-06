<template>
  <div class="space-y-4 sm:space-y-6">
<!-- TEAM WORK BLOCK & TIMESHEET APPROVALS (Manager Governance) -->
      <div v-if="isManager" class="rounded-2xl border shadow-xs overflow-hidden transition-colors" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
        <div class="p-4 border-b flex flex-wrap items-center justify-between gap-3 transition-colors" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-800' : 'bg-gray-50/60 border-gray-200'">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">Team Work Block &amp; Timesheet Approvals</h3>
              <p class="text-[11px] text-gray-700 dark:text-gray-300">Review logged team actuals, deliverables, and grant official timesheet approval.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Member Filter Dropdown in Team Tab -->
            <div class="w-52">
              <Combobox
                open-on-click
                :model-value="selectedEmployee"
                :options="employeeOptions"
                placeholder="Search teammates"
                aria-label="Filter approvals by team member"
                @update:model-value="setSelectedEmployee"
              />
            </div>

            <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold" :class="isDarkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-blue-700'">
              {{ pendingApprovals.length }} Pending
            </span>
            <Button
              v-if="pendingApprovals.length > 0"
              variant="solid"
              theme="blue"
              size="sm"
              :disabled="loadingApprovals"
              @click="approveAllPending"
            >
              Approve All ({{ pendingApprovals.length }})
            </Button>
            <Button
              variant="ghost"
              theme="gray"
              size="sm"
              :disabled="loadingApprovals"
              @click="fetchPendingApprovals"
            >
              Refresh
            </Button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="font-bold text-xs border-b" :class="isDarkMode ? 'bg-[#252528] text-gray-600 border-gray-800' : 'bg-gray-100/70 text-gray-700 border-gray-200'">
                <th class="py-3.5 px-4">Teammate</th>
                <th class="py-3.5 px-4">Date &amp; Time Window</th>
                <th class="py-3.5 px-4">Work Item &amp; Project</th>
                <th class="py-3.5 px-4">Logged Actuals</th>
                <th class="py-3.5 px-4">Collaboration</th>
                <th class="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">
              <tr v-for="b in pendingApprovals" :key="b.name" class="transition-colors" :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50/80'">
                <td class="py-3.5 px-4 font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {{ (b.associate_name || b.employee || '?').substring(0, 1).toUpperCase() }}
                    </div>
                    <div>
                      <div class="leading-tight">{{ b.associate_name || b.employee }}</div>
                      <div class="text-[10px] text-gray-600 font-mono">{{ b.employee }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3.5 px-4" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
                  <div class="font-semibold">{{ b.work_date }}</div>
                  <div class="text-[11px] text-gray-600 font-mono">{{ hhmm(b.start_time) }} – {{ hhmm(b.end_time) }}</div>
                </td>
                <td class="py-3.5 px-4">
                  <div class="font-bold leading-snug line-clamp-1" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
                    {{ blockTitle(b, b.name) }}
                  </div>
                  <div class="text-[11px] text-gray-600 flex items-center gap-1.5 mt-0.5">
                    <span v-if="b.project">{{ b.project }} ·</span>
                    <span>{{ b.task_nature || 'Work' }}</span>
                  </div>
                </td>
                <td class="py-3.5 px-4 font-mono">
                  <div class="font-extrabold text-emerald-500">{{ fmtHrs(b.actual_hours) }} hrs</div>
                  <div class="text-[10px] text-gray-600">plan: {{ fmtHrs(b.duration_hours) }}h</div>
                </td>
                <td class="py-3.5 px-4">
                  <span v-if="b.pairing_partner" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                    {{ b.pairing_partner_name || b.pairing_partner }}
                  </span>
                  <span v-else class="text-xs text-gray-700 dark:text-gray-300">Solo</span>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <Button
                    variant="solid"
                    theme="blue"
                    size="sm"
                    :disabled="loadingApprovals"
                    @click="approveWorkBlockSingle(b)"
                  >
                    Approve
                  </Button>
                </td>
              </tr>
              <tr v-if="pendingApprovals.length === 0">
                <td colspan="6" class="py-12 text-center text-xs" :class="isDarkMode ? 'text-gray-600' : 'text-gray-700'">
                  Nothing is waiting for your approval.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-2xl border shadow-xs overflow-hidden transition-colors" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
        
        <div class="p-4 border-b flex items-center justify-between transition-colors" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-800' : 'bg-gray-50/60 border-gray-200'">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">Split-Shift Synthesizer Multi-Session Logs</h3>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold" :class="isDarkMode ? 'bg-purple-950 text-purple-300' : 'bg-purple-50 text-purple-700'">
            {{ synthesizerLogs.length }} Logs
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="font-bold text-xs border-b" :class="isDarkMode ? 'bg-[#252528] text-gray-600 border-gray-800' : 'bg-gray-100/70 text-gray-700 border-gray-200'">
                <th class="py-3.5 px-4">Log ID</th>
                <th class="py-3.5 px-4">Employee</th>
                <th class="py-3.5 px-4">Attendance Date</th>
                <th class="py-3.5 px-4">Synthesized Status</th>
                <th class="py-3.5 px-4">Total Working Hours</th>
                <th class="py-3.5 px-4">Effective Sessions</th>
              </tr>
            </thead>
            <tbody class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">
              <tr v-for="log in synthesizerLogs" :key="log.name" class="transition-colors" :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50/80'">
                <td class="py-3.5 px-4 font-mono font-semibold" :class="isDarkMode ? 'text-gray-300' : 'text-gray-800'">{{ log.name }}</td>
                <td class="py-3.5 px-4 font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ log.employee }}</td>
                <td class="py-3.5 px-4" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ log.attendance_date }}</td>
                <td class="py-3.5 px-4">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                    {{ log.synthesized_status || 'Present' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-mono font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ log.total_working_hours || '6.5' }} hrs</td>
                <td class="py-3.5 px-4 font-mono" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ log.effective_sessions_completed || '2' }} Sessions</td>
              </tr>
              <tr v-if="synthesizerLogs.length === 0">
                <td colspan="6" class="py-12 text-center text-xs" :class="isDarkMode ? 'text-gray-600' : 'text-gray-700'">
                  No split-shift synthesizer logs recorded.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>  <!-- /TAB 5: ATTENDANCE ENGINE -->
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { blockTitle } from '../utils/blockTitle.js';

export default {
  name: 'AttendanceView',
  methods: { blockTitle },
  setup() {
    return useWorkstationContext([
      'approveAllPending',
      'approveWorkBlockSingle',
      'employeeOptions',
      'setSelectedEmployee',
      'fetchPendingApprovals',
      'loadingApprovals',
      'selectedEmployee',
      'synthesizerLogs',
      'isDarkMode',
      'isManager',
      'pendingApprovals',
      'fmtHrs',
      'hhmm'
    ]);
  },
}
</script>
