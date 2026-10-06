<template>
  <div
    v-if="hoverCard"
    data-block-hover-card
    class="fixed z-50 w-64 rounded-xl border p-3 space-y-2 pointer-events-auto shadow-lg bg-white border-gray-200 text-gray-900 dark:bg-[#1E1F22] dark:border-gray-700 dark:text-gray-100 dark:shadow-black/40"
    :style="{ left: hoverCard.left + 'px', top: hoverCard.top + 'px' }"
    @mouseenter="$emit('cancel-hide')"
    @mouseleave="$emit('hide')"
    role="tooltip"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="text-sm font-semibold leading-snug break-words">
        <template v-if="hoverCard.source === 'logged'">
          {{ (hoverCard.seg && hoverCard.seg.notes) || blockTitle(hoverCard.block, 'Logged work') }}
        </template>
        <template v-else>
          {{ blockTitle(hoverCard.block) }}
        </template>
      </div>
      <span v-if="hoverCard.seg && hoverCard.seg.is_live_active" :class="[CHIP, 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200']">
        <span class="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true"></span>
        Live
      </span>
      <span v-else-if="hoverCard.source === 'logged'" :class="[CHIP, 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200']">
        {{ fmtHrs((hoverCard.seg && hoverCard.seg.hours) || hoverCard.block.actual_hours) }}h logged
      </span>
      <span v-else-if="isBlockLocked(hoverCard.block)" :class="[CHIP, 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200']">
        Past
      </span>
    </div>

    <div class="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
      <div class="tabular-nums">{{ segTimeTitle(hoverCard.seg) }}</div>
      <div
        v-if="hoverCard.block.project_name || hoverCard.block.project"
        class="break-words"
      >{{ hoverCard.block.project_name || hoverCard.block.project }}</div>
      <div v-if="approval && !(hoverCard.seg && hoverCard.seg.is_live_active)" class="break-words">{{ approval.label }}</div>
    </div>

    <div class="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
      <!-- The day is already on screen; only an ERPNext Timesheet reference adds anything. -->
      <span class="truncate text-gray-700 dark:text-gray-300 tabular-nums">
        {{ (hoverCard.seg && hoverCard.seg.timesheet) || hoverCard.block.timesheet || '' }}
      </span>
      <button
        type="button"
        @click.stop="$emit('view-details', hoverCard.block)"
        class="shrink-0 font-medium text-blue-700 dark:text-blue-300 hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
      >View details</button>
    </div>
  </div>
</template>

<script>
import { blockTitle } from '../../utils/blockTitle.js';
import { approvalState } from '../../utils/approval.js';
const CHIP = 'shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full text-[11px] font-medium tabular-nums';

export default {
  name: "BlockHoverCard",
  props: {
    hoverCard: { type: Object, default: null },
    isDarkMode: { type: Boolean, default: false },
    fmtHrs: { type: Function, default: (h) => (Number(h) || 0).toFixed(1) },
    segTimeTitle: { type: Function, default: () => "" },
    isBlockLocked: { type: Function, default: () => false }
  },
  emits: ["cancel-hide", "hide", "view-details"],
  computed: {
    approval() { return this.hoverCard ? approvalState(this.hoverCard.block) : null; },
  },
  setup() {
    return { CHIP, blockTitle };
  }
};
</script>
