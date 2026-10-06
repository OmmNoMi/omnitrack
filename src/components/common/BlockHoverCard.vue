<template>
  <div
    v-if="hoverCard"
    class="fixed z-50 w-64 rounded-xl border shadow-xl p-2.5 space-y-1.5 pointer-events-auto"
    :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100 shadow-black/40' : 'bg-white border-gray-200 text-gray-900 shadow-gray-400/20'"
    :style="{ left: hoverCard.left + 'px', top: hoverCard.top + 'px' }"
    @mouseenter="$emit('cancel-hide')"
    @mouseleave="$emit('hide')"
    role="tooltip"
  >
    <!-- Title & Compact Status Badge -->
    <div class="flex items-start justify-between gap-1.5">
      <div class="text-xs font-bold leading-tight break-words line-clamp-2">
        <template v-if="hoverCard.source === 'logged'">
          {{ (hoverCard.seg && hoverCard.seg.notes) || hoverCard.block.task_subject || hoverCard.block.work_item_label || 'Logged Work Session' }}
        </template>
        <template v-else>
          {{ hoverCard.block.task_subject || hoverCard.block.work_item_label || hoverCard.block.deliverable_notes || 'Work block' }}
        </template>
      </div>
      <span
        v-if="hoverCard.seg && hoverCard.seg.is_live_active"
        class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 animate-pulse"
      >
        🔴 Live
      </span>
      <span
        v-else-if="hoverCard.source === 'logged'"
        class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      >
        ✓ {{ fmtHrs((hoverCard.seg && hoverCard.seg.hours) || hoverCard.block.actual_hours) }}h
      </span>
      <span
        v-else-if="isBlockLocked(hoverCard.block)"
        class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      >
        🔒 Past
      </span>
    </div>

    <!-- Meta row: Time & Project -->
    <div class="flex items-center justify-between gap-2 text-[10px]" :class="isDarkMode ? 'text-gray-600' : 'text-gray-700'">
      <div class="font-mono font-medium flex items-center gap-1">
        <span>⏱</span>
        <span>{{ segTimeTitle(hoverCard.seg) }}</span>
      </div>
      <div
        v-if="hoverCard.block.project_name || hoverCard.block.project"
        class="truncate max-w-[120px]"
        :title="hoverCard.block.project_name || hoverCard.block.project"
      >
        📁 {{ hoverCard.block.project_name || hoverCard.block.project }}
      </div>
    </div>

    <!-- Footer Action: View Details link -->
    <div class="pt-1 border-t flex items-center justify-between text-[11px]" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
      <span
        v-if="hoverCard.block.timesheet || (hoverCard.seg && hoverCard.seg.timesheet)"
        class="text-[9px] font-mono font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[120px]"
      >
        TS: {{ hoverCard.seg && hoverCard.seg.timesheet ? hoverCard.seg.timesheet : hoverCard.block.timesheet }}
      </span>
      <span v-else class="text-[9px] text-gray-600">{{ hoverCard.block.work_date }}</span>

      <button
        type="button"
        @click.stop="$emit('view-details', hoverCard.block)"
        class="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-0.5 cursor-pointer ml-auto"
      >
        <span>View Details</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "BlockHoverCard",
  props: {
    hoverCard: { type: Object, default: null },
    isDarkMode: { type: Boolean, default: false },
    fmtHrs: { type: Function, default: (h) => (Number(h) || 0).toFixed(1) },
    segTimeTitle: { type: Function, default: () => "" },
    isBlockLocked: { type: Function, default: () => false }
  },
  emits: ["cancel-hide", "hide", "view-details"]
};
</script>
