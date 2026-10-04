<template>
  <f-dialog
    :model-value="modelValue"
    :title="inactivityMinutes >= 60 ? 'Prolonged Inactivity Detected' : 'Are you still working?'"
    :subtitle="inactivityMinutes >= 60 ? 'Active timer left running unattended' : '30 minutes without activity or notes'"
    size="md"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-3.5 py-1 text-xs">
      <div
        class="p-3.5 rounded-2xl border flex items-start gap-3 transition-colors"
        :class="inactivityMinutes >= 60 ? (isDarkMode ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50/70 border-amber-200 text-amber-900') : (isDarkMode ? 'bg-blue-950/20 border-blue-800/40 text-blue-200' : 'bg-blue-50/70 border-blue-200 text-blue-900')"
      >
        <span class="text-base select-none shrink-0" aria-hidden="true">{{ inactivityMinutes >= 60 ? '⚠️' : '⏱️' }}</span>
        <div class="space-y-1">
          <div class="font-bold text-[13px] leading-snug">
            {{ inactivityMinutes >= 60 ? ('No notes logged for ' + Math.floor(inactivityMinutes / 60) + 'h ' + (inactivityMinutes % 60) + 'm') : ('No notes logged for ' + inactivityMinutes + ' minutes') }}
          </div>
          <p class="text-xs leading-relaxed opacity-90">
            {{ inactivityMinutes >= 60 ? 'This session appears to have been left running without updates. You can continue working, cap the timesheet at your last edit, or discard this session.' : 'You normally log bullet updates every 10–15 minutes on active work.' }}
          </p>
        </div>
      </div>

      <div
        class="rounded-2xl border p-4 space-y-2.5 transition-colors"
        :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-gray-200' : 'bg-gray-50/80 border-gray-200 text-gray-700'"
      >
        <div class="flex items-start justify-between text-xs gap-3">
          <span class="text-gray-400 font-medium shrink-0">Active Task:</span>
          <span class="font-bold text-right break-words line-clamp-2 text-gray-900 dark:text-white">{{ activeTaskLabel }}</span>
        </div>
        <div v-if="sessionStart" class="flex items-center justify-between text-xs">
          <span class="text-gray-400 font-medium">Session started:</span>
          <span class="font-mono font-medium">{{ sessionStart.date }} · {{ sessionStart.time }}</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-400 font-medium">Last edit recorded:</span>
          <span class="font-mono font-bold">{{ lastActivityTimeHHMM }}</span>
        </div>
        <div class="flex items-center justify-between text-xs pt-1 border-t border-gray-200/50 dark:border-gray-800">
          <span class="text-gray-400 font-medium">Current elapsed timer:</span>
          <span class="font-mono font-black text-sm text-blue-600 dark:text-blue-400">{{ formattedTime }}</span>
        </div>
      </div>
    </div>

    <template #actions>
      <div class="flex flex-col gap-3 w-full">
        <!-- Primary & Completion Actions Row -->
        <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 w-full">
          <f-button
            variant="ghost"
            theme="gray"
            size="sm"
            @click="$emit('stop-now')"
          >
            Stop Now
          </f-button>
          <f-button
            variant="outline"
            theme="gray"
            size="sm"
            @click="$emit('stop-at-last-edit')"
            :title="'Log timesheet up to ' + suggestedStopHHMM"
          >
            Stop at {{ suggestedStopHHMM }} (+15m)
          </f-button>
          <f-button
            variant="solid"
            theme="blue"
            size="sm"
            autofocus
            data-autofocus
            data-confirm-working
            @click="$emit('confirm-working')"
            class="font-bold shadow-sm"
          >
            Yes, Still Working
          </f-button>
        </div>

        <!-- Danger Zone: Isolated Discard Session -->
        <div v-if="inactivityMinutes >= 60" class="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
          <span>Stepped away or forgot to stop?</span>
          <f-button
            variant="ghost"
            theme="red"
            size="xs"
            data-destructive
            @click="$emit('discard')"
            title="Discard this unattended session without creating a timesheet"
          >
            Discard Session
          </f-button>
        </div>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "InactivityGovernorModal",
  props: {
    modelValue: { type: Boolean, default: false },
    inactivityMinutes: { type: Number, default: 0 },
    isDarkMode: { type: Boolean, default: false },
    activeTaskLabel: { type: String, default: "Active Work" },
    sessionStart: { type: Object, default: null },
    lastActivityTimeHHMM: { type: String, default: "" },
    suggestedStopHHMM: { type: String, default: "" },
    formattedTime: { type: String, default: "00:00:00" },
  },
  emits: ["update:modelValue", "confirm-working", "stop-now", "stop-at-last-edit", "discard"],
};
</script>
