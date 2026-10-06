<template>
  <f-dialog
    :model-value="modelValue"
    title="Wrap up the day"
    subtitle="Log what you planned, then finish the day."
    size="lg"
    z-index="z-[85]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-4 py-2 text-sm">
      <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-gray-700 dark:text-gray-300">Logged today</span>
          <span class="font-semibold tabular-nums" :title="remainingStatus">
            {{ formatDuration(summary ? summary.total_actual_hours : 0) }}h of 8h
          </span>
        </div>
        <div
          class="w-full h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700"
          role="progressbar"
          aria-label="Logged today"
          :aria-valuenow="Math.round(progressPercentage)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="h-full rounded-full bg-green-600 dark:bg-green-500 transition-all duration-300" :style="{ width: progressPercentage + '%' }"></div>
        </div>
      </div>

      <div v-if="pendingBlocks && pendingBlocks.length" class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <span class="font-medium text-gray-900 dark:text-gray-100">Planned, not logged ({{ pendingBlocks.length }})</span>
          <Button
            variant="subtle"
            :label="'Log all ' + formatDuration(summary ? summary.unconverted_hours : 0) + 'h'"
            @click="$emit('convert-all')"
          />
        </div>
        <ul class="divide-y divide-gray-100 dark:divide-gray-800 max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <li v-for="b in pendingBlocks" :key="b.name" class="flex items-center justify-between gap-3 px-3 py-2">
            <div class="min-w-0">
              <div class="truncate font-medium" :title="blockTitle(b)">{{ blockTitle(b) }}</div>
              <div class="text-xs text-gray-700 dark:text-gray-300 tabular-nums">{{ b.start_time }}–{{ b.end_time }}</div>
            </div>
            <Button variant="outline" :label="'Log ' + formatDuration(b.duration_hours) + 'h'" @click="$emit('convert-block', b)" />
          </li>
        </ul>
      </div>
      <p v-else class="text-gray-700 dark:text-gray-300">Every planned block for today is logged.</p>
    </div>
    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button variant="ghost" label="Close" @click="$emit('update:modelValue', false)" />
        <Button variant="solid" label="Finish the day" @click="$emit('complete')" />
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { blockTitle } from '../../utils/blockTitle.js';
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
      if (rem <= 0) return "Target met";
      return `${rem.toFixed(1)}h remaining`;
    },
  },
  methods: {
    blockTitle,
    formatDuration(hours) {
      return Number(hours || 0).toFixed(1);
    },
  },
};
</script>
