<template>
  <f-dialog
    :model-value="modelValue"
    title="Wrap & Start Next Session"
    subtitle="Save your running session and transition immediately"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- 1. Current Running Session Card -->
      <div class="p-3.5 rounded-2xl border bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/60 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span class="text-[10px] uppercase font-bold tracking-wider text-amber-800 dark:text-amber-200">Current Session to Wrap</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white/80 dark:bg-black/40 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
            ⏱ {{ formattedTime }}
          </span>
        </div>
        <div class="font-extrabold text-sm text-gray-900 dark:text-white">
          {{ currentSessionLabel }}
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-3">
          <span v-if="selectedProject">📁 {{ selectedProject }}</span>
          <span>🏷 {{ selectedNature }}</span>
        </div>

        <!-- Session Summary Notes -->
        <div class="pt-1">
          <label for="switch-confirm-notes" class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
            Session Summary &amp; Work Logged (will be saved to timesheet) *
          </label>
          <textarea
            id="switch-confirm-notes"
            v-model="internalWrapUpNote"
            rows="3"
            class="w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
            :class="isDarkMode ? 'bg-[#121212] border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
            placeholder="Review or add notes for this completed session..."
          ></textarea>
        </div>
      </div>

      <!-- Transition Indicator -->
      <div class="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold">
        <span>↓</span>
        <span>Transitioning to</span>
        <span>↓</span>
      </div>

      <!-- 2. Target Block to Start Immediately Card -->
      <div v-if="targetItem" class="p-3.5 rounded-2xl border bg-blue-50/70 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/60 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-300">
            {{ targetItem.is_block ? 'Next Planned Block' : 'Next Task' }}
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Starts Immediately
          </span>
        </div>
        <div class="font-extrabold text-sm text-gray-900 dark:text-white">
          {{ targetItem.label }}
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-3">
          <span v-if="targetItem.sublabel">{{ targetItem.sublabel }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <template #actions>
      <div class="flex items-center justify-between gap-3 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">
          Cancel (Keep Current)
        </f-button>
        <f-button
          variant="solid"
          theme="blue"
          size="sm"
          class="!font-bold shadow-md"
          :loading="isSwitching"
          :disabled="isSwitching"
          @click="$emit('confirm')"
        >
          <template #prefix>
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </template>
          <span>Save &amp; Start Next Session</span>
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "WrapAndStartNextModal",
  props: {
    modelValue: { type: Boolean, default: false },
    formattedTime: { type: String, default: "00:00:00" },
    currentSessionLabel: { type: String, default: "Active Work Session" },
    selectedProject: { type: String, default: "" },
    selectedNature: { type: String, default: "⚠️ Unplanned" },
    wrapUpNote: { type: String, default: "" },
    targetItem: { type: Object, default: null },
    isSwitching: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "update:wrapUpNote", "confirm"],
  computed: {
    internalWrapUpNote: {
      get() {
        return this.wrapUpNote;
      },
      set(val) {
        this.$emit("update:wrapUpNote", val);
      },
    },
  },
};
</script>
