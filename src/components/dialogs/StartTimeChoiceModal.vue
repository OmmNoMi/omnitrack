<template>
  <f-dialog
    :model-value="modelValue"
    title="Choose Session Start Time"
    :dismissable="true"
    size="sm"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('cancel')"
  >
    <div class="space-y-3 py-2">
      <div class="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
        You are starting work on
        <span class="font-bold text-gray-900 dark:text-white">{{ pendingBlockLabel }}</span>,
        which was scheduled earlier today. How would you like to anchor your session start?
      </div>

      <div class="space-y-2 mt-2">
        <button
          v-for="opt in options"
          :key="opt.label"
          type="button"
          @click="$emit('select', opt.epoch)"
          class="w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer group"
          :class="opt.isOntime
            ? (isDarkMode ? 'bg-emerald-950/40 border-emerald-800 hover:bg-emerald-950/70 hover:border-emerald-700' : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300')
            : (isDarkMode ? 'bg-[#252528] border-gray-700 hover:bg-[#2b2b2f]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100')"
        >
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            :class="opt.isOntime ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'"
          >
            <FeatherIcon :name="opt.isOntime ? 'target' : 'clock'" class="w-4 h-4" aria-hidden="true" />
          </div>
          <div class="flex-1 min-w-0">
            <div
              class="text-xs font-bold leading-tight"
              :class="opt.isOntime ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-200'"
            >
              {{ opt.label }}
            </div>
            <div class="text-[11px] mt-0.5 text-gray-700 dark:text-gray-300">
              {{ opt.sublabel }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2 w-full">
        <Button variant="ghost" theme="gray" size="sm" @click="$emit('cancel')">Cancel</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { blockTitle } from '../../utils/blockTitle.js';
export default {
  name: "StartTimeChoiceModal",
  props: {
    modelValue: { type: Boolean, default: false },
    pendingBlock: { type: Object, default: null },
    options: { type: Array, default: () => [] },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "select", "cancel"],
  computed: {
    pendingBlockLabel() {
      if (!this.pendingBlock) return "this block";
      return blockTitle(this.pendingBlock, this.pendingBlock.name || "this block");
    },
  },
};
</script>
