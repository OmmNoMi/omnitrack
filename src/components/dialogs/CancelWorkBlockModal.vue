<template>
  <f-dialog
    :model-value="modelValue"
    title="Cancel Work Block"
    subtitle="Audit reason for schedule variance"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    </template>

    <div v-if="targetBlock" class="space-y-4 text-xs">
      <!-- Target Block Summary Card -->
      <div class="p-3 rounded-2xl border" :class="isDarkMode ? 'bg-[#161618] border-[#2E2E32]' : 'bg-gray-50 border-gray-200'">
        <div class="text-[10px] uppercase font-bold tracking-wider text-gray-400">Target Block</div>
        <div class="font-extrabold text-sm text-gray-900 dark:text-white mt-0.5">
          {{ targetBlock.task_subject || targetBlock.work_item_label || targetBlock.deliverable_notes || 'Work block' }}
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
          <span>📅 {{ targetBlock.work_date }}</span>
          <span>⏱ {{ formatHHMM(targetBlock.start_time) }}–{{ formatHHMM(targetBlock.end_time) }} ({{ formatDuration(targetBlock.duration_hours) }}h planned)</span>
        </div>
      </div>

      <!-- Structured Reason Dropdown -->
      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Cancellation Reason *</label>
        <f-combobox
          v-model="cancelForm.reason"
          :options="reasons"
          placeholder="Select cancellation reason..."
          search-placeholder="Filter cancellation reason..."
          aria-label="Cancellation reason"
        ></f-combobox>
      </div>

      <!-- Notes / Context -->
      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Context / Notes (Optional)</label>
        <textarea
          v-model="cancelForm.notes"
          rows="2"
          placeholder="e.g. Waited 10m on call. Rescheduling needed."
          class="w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
        ></textarea>
      </div>

      <!-- Log Elapsed Time Checkbox -->
      <div
        v-if="isTrackingThisBlock"
        class="p-3 rounded-xl border bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 space-y-1"
      >
        <label class="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            v-model="cancelForm.log_elapsed"
            class="mt-0.5 rounded text-red-600 focus:ring-red-500"
          />
          <div class="text-xs">
            <span class="font-bold text-amber-900 dark:text-amber-200">Log elapsed wait time ({{ formattedTime }})</span>
            <p class="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
              Record this wait time as a timesheet session on the block before cancelling. Frees your tracker immediately.
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #actions>
      <div class="flex items-center justify-between gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">
          Keep Block
        </f-button>
        <f-button
          variant="solid"
          theme="red"
          size="sm"
          :disabled="busy"
          :loading="busy"
          @click="$emit('confirm')"
        >
          Confirm Cancellation
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "CancelWorkBlockModal",
  props: {
    modelValue: { type: Boolean, default: false },
    targetBlock: { type: Object, default: null },
    cancelForm: { type: Object, required: true },
    reasons: { type: Array, default: () => [] },
    isTrackingThisBlock: { type: Boolean, default: false },
    formattedTime: { type: String, default: "00:00:00" },
    busy: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "confirm"],
  methods: {
    formatHHMM(val) {
      if (!val) return "";
      return String(val).substring(0, 5);
    },
    formatDuration(hours) {
      return Number(hours || 0).toFixed(1);
    },
  },
};
</script>
