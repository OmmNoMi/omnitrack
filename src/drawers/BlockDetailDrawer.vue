<template>
  <div>
    <!-- Backdrop for Block Detail Drawer -->
    <div v-if="show && block" @click="$emit('close')" class="fixed inset-0 z-[59] bg-black/40 backdrop-blur-xs transition-opacity" aria-hidden="true"></div>

    <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="show && block" class="fixed inset-y-0 right-0 z-[60] w-full max-w-md shadow-2xl overflow-y-auto" :class="isDarkMode ? 'bg-[#1E1F22] border-l border-gray-800' : 'bg-white'" role="dialog" aria-modal="true" aria-label="Work block detail">
        <div class="p-5 space-y-4">
          
          <!-- Header -->
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-[11px] font-bold uppercase text-gray-400">{{ block.work_date }} · {{ hhmm(block.start_time) }}–{{ hhmm(block.end_time) }}</div>
              <h3 class="font-extrabold text-base mt-0.5 leading-snug break-words" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ block.task_subject || block.work_item_label || block.deliverable_notes || 'Work block' }}</h3>
              <div class="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                <f-badge :theme="isBlockCompleted(block) ? 'green' : (isTracking && trackerBlockName === block.name ? 'red' : (block.status === 'Cancelled' ? 'red' : (block.status === 'Rescheduled' ? 'gray' : 'blue')))" variant="subtle" size="xs">
                  {{ isTracking && trackerBlockName === block.name ? '● Recording' : (block.status === 'Cancelled' ? (block.cancel_reason ? 'Cancelled (' + block.cancel_reason + ')' : 'Cancelled') : (isBlockCompleted(block) ? '✓ ' + (block.status || 'Completed') : block.status)) }}
                </f-badge>
                <f-badge v-if="block.rescheduled_to" theme="gray" variant="outline" size="xs">↷ to {{ block.rescheduled_to }}</f-badge>
                <f-badge v-if="block.rescheduled_from" theme="gray" variant="outline" size="xs">↶ from {{ block.rescheduled_from }}</f-badge>
                <f-badge v-if="block.task_nature" theme="gray" variant="outline" size="xs">{{ block.task_nature }}</f-badge>
                <f-badge v-if="block.pairing_partner" theme="purple" variant="subtle" size="xs">
                  👥 Paired with {{ block.pairing_partner_name || block.pairing_partner }}
                </f-badge>
                <f-badge v-if="block.approval_status === 'Approved'" theme="green" variant="subtle" size="xs">
                  ✓ Approved
                </f-badge>
                <f-badge v-else-if="block.actual_hours > 0" theme="amber" variant="subtle" size="xs">
                  ⏳ Pending Approval
                </f-badge>
                <span v-if="block.project_name || block.project" class="text-gray-400 truncate max-w-[150px]">📁 {{ block.project_name || block.project }}</span>
              </div>
            </div>
            <f-button variant="ghost" theme="gray" size="sm" class="!w-8 !h-8 !p-0 shrink-0" @click="$emit('close')" aria-label="Close">
              <template #prefix>
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </template>
            </f-button>
          </div>

          <!-- Planned vs Actual Progress Card -->
          <div class="rounded-2xl p-3.5 border space-y-2" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="text-gray-500">Duration</span>
              <span :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">
                <span class="font-bold text-sm">{{ block.actual_hours != null ? Number(block.actual_hours).toFixed(2) : '0.00' }}h</span>
                <span class="text-gray-400"> / {{ block.duration_hours }}h planned</span>
                <span v-if="block.variance_hours != null && Math.abs(block.variance_hours) > 0.05" class="ml-1.5 text-[11px] font-bold" :class="block.variance_hours > 0 ? 'text-rose-500' : 'text-emerald-500'">
                  ({{ block.variance_hours > 0 ? '+' : '' }}{{ Number(block.variance_hours).toFixed(2) }}h)
                </span>
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" :class="block.variance_hours > 0.25 ? 'bg-rose-500' : 'bg-blue-600'" :style="{ width: Math.min(100, Math.round(((block.actual_hours || 0) / (block.duration_hours || 1)) * 100)) + '%' }"></div>
            </div>
          </div>

          <!-- Actions Bar -->
          <div class="flex items-center gap-2 flex-wrap">
            <f-button v-if="!isBlockCompleted(block) && (!isTracking || trackerBlockName !== block.name)" variant="solid" theme="blue" size="sm" class="flex-1 !font-bold" @click="$emit('start-session', block)">
              <template #prefix>
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </template>
              Start Session
            </f-button>
            <f-button v-if="isTracking && trackerBlockName === block.name" variant="solid" theme="red" size="sm" class="flex-1 !font-bold animate-pulse" @click="$emit('stop-session', block)">
              <template #prefix>
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              </template>
              Stop live session
            </f-button>
            <f-button v-if="isBlockReschedulable(block)" variant="subtle" theme="gray" size="sm" @click="$emit('toggle-reschedule')">
              Reschedule
            </f-button>
            <f-button v-if="isBlockCancellable(block)" variant="subtle" theme="red" size="sm" @click="$emit('open-cancel-modal', block)">
              Cancel
            </f-button>
            <f-button v-if="canLogTimesheet(block)" variant="subtle" theme="green" size="sm" @click="$emit('toggle-manual-log')">
              + Log manually
            </f-button>
          </div>

          <!-- Quantitative Deliverables & Outputs Card -->
          <div v-if="block.deliverable_target || block.deliverable_metric || block.deliverable_output_summary || block.deliverable_notes" class="rounded-2xl p-3.5 border space-y-2.5" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Deliverable & Output Metrics
              </span>
              <span v-if="block.deliverable_metric" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                {{ block.deliverable_metric }}
              </span>
            </div>
            
            <div v-if="block.deliverable_target" class="flex items-baseline justify-between text-xs pt-1 border-t" :class="isDarkMode ? 'border-gray-700' : 'border-gray-200'">
              <span class="text-gray-400">Target Output:</span>
              <span class="font-extrabold text-sm text-gray-800 dark:text-gray-100">{{ block.deliverable_target }} <span class="text-[11px] font-medium text-gray-400">{{ block.deliverable_metric || 'units' }}</span></span>
            </div>

            <div v-if="block.deliverable_notes" class="text-xs text-gray-600 dark:text-gray-300 pt-1">
              <span class="font-semibold text-gray-400 text-[10px] uppercase block mb-0.5">Commitment Notes</span>
              {{ block.deliverable_notes }}
            </div>

            <div v-if="block.deliverable_output_summary" class="rounded-xl p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 mt-2">
              <div class="font-bold text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                Achieved Output Summary
              </div>
              <div class="font-medium whitespace-pre-wrap">{{ block.deliverable_output_summary }}</div>
            </div>
          </div>

          <!-- Living Specifications & Raven Link -->
          <div class="rounded-2xl p-3 border flex items-center justify-between gap-3 cursor-pointer hover:border-purple-400 transition-colors" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'" @click="$emit('open-raven', block)">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  Task Discussion & Living Specs
                  <span class="inline-block w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                </div>
                <div class="text-[11px] text-gray-400 truncate">{{ drawerChatMessages && drawerChatMessages.length ? drawerChatMessages.length + ' message(s)' : 'Specs & thread' }}</div>
              </div>
            </div>
            <f-button variant="subtle" theme="purple" size="xs">Open Raven ↗</f-button>
          </div>

          <!-- Timesheet Sessions list -->
          <div class="space-y-2 pt-2 border-t" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
            <div class="flex items-center justify-between text-xs font-bold text-gray-500">
              <span>Logged Sessions ({{ (block.sessions || []).length }})</span>
              <span>{{ block.actual_hours != null ? Number(block.actual_hours).toFixed(2) : '0.00' }} hrs</span>
            </div>
            <div v-if="!block.sessions || !block.sessions.length" class="text-xs text-gray-400 py-3 text-center">
              No sessions recorded yet. Click "Start Session" to begin.
            </div>
            <div v-else class="space-y-2">
              <div v-for="s in block.sessions" :key="s.name || s.from_time" class="p-2.5 rounded-xl border text-xs" :class="isDarkMode ? 'bg-[#25262A] border-gray-800' : 'bg-gray-50 border-gray-200'">
                <div class="flex items-center justify-between text-gray-400 text-[11px]">
                  <span>{{ s.session_date }} · {{ hhmm(s.from_time) }}–{{ hhmm(s.to_time) }}</span>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-gray-700 dark:text-gray-300">{{ Number(s.hours || 0).toFixed(2) }}h</span>
                    <button v-if="canLogTimesheet(block)" type="button" @click="$emit('edit-session', s, block)" class="text-blue-500 hover:text-blue-700 p-0.5" title="Edit session">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button v-if="canLogTimesheet(block)" type="button" @click="$emit('delete-session', s, block)" class="text-rose-500 hover:text-rose-700 p-0.5" title="Delete session">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                <div v-if="s.notes" class="mt-1 text-gray-700 dark:text-gray-200 text-xs whitespace-pre-line">{{ s.notes }}</div>
              </div>
            </div>
          </div>

          <!-- Collapsible Reschedule Form -->
          <div v-if="showRescheduleForm && isBlockReschedulable(block)" class="rounded-2xl p-3.5 border space-y-2 transition-all" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <h4 class="text-xs font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">Reschedule block</h4>
            <div class="grid grid-cols-3 gap-2">
              <label class="block"><span class="text-[10px] font-bold text-gray-500">Date</span>
                <input type="date" v-model="rescheduleForm.work_date" aria-label="New work date" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
              <label class="block"><span class="text-[10px] font-bold text-gray-500">Start</span>
                <input type="time" v-model="rescheduleForm.start_time" aria-label="New start time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
              <label class="block"><span class="text-[10px] font-bold text-gray-500">End</span>
                <input type="time" v-model="rescheduleForm.end_time" aria-label="New end time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            </div>
            <f-button variant="solid" theme="blue" size="sm" class="w-full !font-bold" @click="$emit('submit-reschedule')" :disabled="plannerBusy">Save new time</f-button>
          </div>

          <!-- Collapsible Manual Session Form -->
          <div v-if="showBlockManualLog && canLogTimesheet(block)" class="rounded-2xl p-3.5 border space-y-2 transition-all" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <h4 class="text-xs font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">Log a work session manually</h4>
            <div class="grid grid-cols-3 gap-2">
              <label class="block"><span class="text-[10px] font-bold text-gray-500">Date</span>
                <input type="date" v-model="sessionForm.session_date" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
              <label class="block"><span class="text-[10px] font-bold text-gray-500">From</span>
                <input type="time" v-model="sessionForm.from_time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
              <label class="block"><span class="text-[10px] font-bold text-gray-500">To</span>
                <input type="time" v-model="sessionForm.to_time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            </div>
            <div class="flex items-center gap-2">
              <label class="block flex-1"><span class="text-[10px] font-bold text-gray-500">or hours</span>
                <input type="number" step="0.25" min="0" v-model="sessionForm.hours" placeholder="e.g. 1.5" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
              <label class="block flex-[2]"><span class="text-[10px] font-bold text-gray-500">Notes (required)</span>
                <input type="text" v-model="sessionForm.notes" placeholder="What did you get done?" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            </div>
            <f-button variant="solid" theme="green" size="sm" class="w-full !font-bold" @click="$emit('submit-session')" :disabled="plannerBusy">Add session</f-button>
          </div>

        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: 'BlockDetailDrawer',
  props: {
    show: { type: Boolean, default: false },
    block: { type: Object, default: () => null },
    isDarkMode: { type: Boolean, default: false },
    isTracking: { type: Boolean, default: false },
    trackerBlockName: { type: String, default: '' },
    plannerBusy: { type: Boolean, default: false },
    showRescheduleForm: { type: Boolean, default: false },
    rescheduleForm: { type: Object, default: () => ({ work_date: '', start_time: '', end_time: '' }) },
    showBlockManualLog: { type: Boolean, default: false },
    sessionForm: { type: Object, default: () => ({ session_date: '', from_time: '', to_time: '', hours: '', notes: '' }) },
    drawerChatMessages: { type: Array, default: () => [] },
    hhmm: { type: Function, default: (t) => t ? t.slice(0, 5) : '' },
    isBlockCompleted: { type: Function, default: () => false },
    isBlockReschedulable: { type: Function, default: () => false },
    isBlockCancellable: { type: Function, default: () => false },
    canLogTimesheet: { type: Function, default: () => true }
  },
  emits: [
    'close',
    'start-session',
    'stop-session',
    'toggle-reschedule',
    'open-cancel-modal',
    'toggle-manual-log',
    'open-raven',
    'edit-session',
    'delete-session',
    'submit-reschedule',
    'submit-session'
  ]
}
</script>
