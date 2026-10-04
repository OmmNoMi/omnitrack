<template>
  <f-dialog
    :model-value="modelValue"
    title="End of Day Reconciliation Ritual"
    subtitle="Review today's accomplishments, unallocated gaps, and finalize your timesheet."
    size="lg"
    z-index="z-[85]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <span class="text-xl">🏁</span>
    </template>
    <div class="space-y-4 py-2 text-xs">
      <!-- Target vs Logged Bar -->
      <div class="p-4 rounded-2xl bg-gray-50 dark:bg-[#1E1F22] border border-gray-200 dark:border-gray-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-gray-700 dark:text-gray-300">Daily Target: 8.0 Hours</span>
          <span
            class="font-mono font-extrabold text-sm"
            :class="summary && summary.total_actual_hours >= 8.0 ? 'text-emerald-500' : 'text-amber-500'"
          >
            {{ summary ? summary.total_actual_hours : 0 }}h / 8.0h ({{ remainingStatus }})
          </span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
          <div
            class="h-full bg-emerald-500 rounded-full transition-all duration-300"
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
      </div>

      <!-- Pending unlogged blocks list -->
      <div v-if="pendingBlocks && pendingBlocks.length" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-gray-700 dark:text-gray-300">
            Unlogged Planned Commitments ({{ pendingBlocks.length }})
          </span>
          <button
            type="button"
            @click="$emit('convert-all')"
            class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
          >
            ⚡ Convert All ({{ summary ? summary.unconverted_hours : 0 }}h)
          </button>
        </div>
        <div class="space-y-1.5 max-h-48 overflow-y-auto">
          <div
            v-for="b in pendingBlocks"
            :key="b.name"
            class="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161618]"
          >
            <div>
              <div class="font-bold">{{ b.task_subject || b.deliverable_notes || 'Focus Block' }}</div>
              <div class="text-[11px] text-gray-500">
                {{ b.start_time }}–{{ b.end_time }} ({{ formatDuration(b.duration_hours) }}h)
              </div>
            </div>
            <f-button
              size="xs"
              variant="solid"
              theme="green"
              @click="$emit('convert-block', b)"
            >
              Convert ({{ formatDuration(b.duration_hours) }}h)
            </f-button>
          </div>
        </div>
      </div>
      <div
        v-else
        class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
      >
        <span>✓ All planned blocks for today have been logged or addressed.</span>
      </div>
    </div>
    <template #actions>
      <div class="flex items-center justify-between w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">
          Close
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="$emit('complete')">
          Complete EOD Ritual ✓
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "EODWrapUpModal",
  props: {
    modelValue: { type: Boolean, default: false },
    summary: { type: Object, default: null },
    pendingBlocks: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue", "convert-all", "convert-block", "complete"],
  computed: {
    progressPercentage() {
      const actual = this.summary ? this.summary.total_actual_hours || 0 : 0;
      return Math.min(100, (actual / 8.0) * 100);
    },
    remainingStatus() {
      if (!this.summary) return "";
      const actual = this.summary.total_actual_hours || 0;
      const rem = 8.0 - actual;
      if (rem <= 0) return "Goal Met";
      return `${rem.toFixed(1)}h remaining`;
    },
  },
  methods: {
    formatDuration(hours) {
      return Number(hours || 0).toFixed(1);
    },
  },
};
</script>
