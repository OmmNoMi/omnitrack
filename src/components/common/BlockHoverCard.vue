<template>
  <!-- A peek at a block, as a Material card: when and where it stands on top, its name once, then
       what got done as a short list. The notes are never the title; they start with it, so a
       title made of notes says the name twice and runs every line together.
       A plain tooltip: nothing in it takes focus. The block it describes opens its details
       (click or Enter). The pointer may still rest on it, and Escape dismisses it. -->
  <div
    v-if="hoverCard"
    id="block-hover-card"
    data-block-hover-card
    class="fixed z-50 w-72 rounded-xl border p-3 space-y-2 pointer-events-auto shadow-lg bg-white border-gray-200 text-gray-900 dark:bg-[#1E1F22] dark:border-gray-700 dark:text-gray-100 dark:shadow-black/40"
    :style="{ left: hoverCard.left + 'px', top: hoverCard.top + 'px' }"
    @mouseenter="$emit('cancel-hide')"
    @mouseleave="$emit('hide')"
    role="tooltip"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs tabular-nums text-gray-700 dark:text-gray-300">{{ segTimeTitle(hoverCard.seg) }}</span>
      <span v-if="hoverCard.seg && hoverCard.seg.is_live_active" :class="[CHIP, 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200']">
        <span class="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true"></span>
        Live
      </span>
      <span v-else-if="hoverCard.source === 'logged'" :class="[CHIP, 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200']">
        {{ loggedText }}
      </span>
      <span v-else-if="isBlockLocked(hoverCard.block)" :class="[CHIP, 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200']">
        Past
      </span>
    </div>

    <div class="text-sm font-semibold leading-snug break-words">{{ title }}</div>

    <ul v-if="notes.length" class="text-xs leading-snug text-gray-700 dark:text-gray-300 space-y-0.5" aria-label="What got done">
      <li v-for="(line, i) in notes.slice(0, NOTE_LINES)" :key="i" class="flex items-start gap-1.5 break-words">
        <FeatherIcon v-if="line.done" name="check-circle" class="w-3.5 h-3.5 mt-px shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
        <span class="min-w-0" :class="line.done || !anyDone ? '' : 'pl-5'"><span v-if="line.done && line.text !== 'Completed'" class="sr-only">Done: </span>{{ line.text }}</span>
      </li>
      <li v-if="notes.length > NOTE_LINES" :class="anyDone ? 'pl-5' : ''">{{ notes.length - NOTE_LINES }} more in details</li>
    </ul>

    <div v-if="project || billingRef || (approval && !(hoverCard.seg && hoverCard.seg.is_live_active))" class="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
      <div v-if="project" class="break-words">{{ project }}</div>
      <div v-if="approval && !(hoverCard.seg && hoverCard.seg.is_live_active)" class="break-words">{{ approval.label }}</div>
      <!-- The day is already on screen; only the ERPNext Timesheet it went to adds anything. -->
      <div v-if="billingRef" class="tabular-nums">ERPNext Timesheet {{ billingRef }}</div>
    </div>
  </div>
</template>

<script>
import { blockTitle } from '../../utils/blockTitle.js';
import { approvalState } from '../../utils/approval.js';
import { noteLines } from '../../utils/wrapNote.js';
import { durationLabel } from '../../utils/clockTime.js';
const CHIP = 'shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full text-[11px] font-medium tabular-nums';
// A peek, not the record: the rest is one click away in its details
const NOTE_LINES = 3;

export default {
  name: "BlockHoverCard",
  props: {
    hoverCard: { type: Object, default: null },
    isDarkMode: { type: Boolean, default: false },
    segTimeTitle: { type: Function, default: () => "" },
    isBlockLocked: { type: Function, default: () => false }
  },
  emits: ["cancel-hide", "hide"],
  computed: {
    title() {
      return blockTitle(this.hoverCard.block, this.hoverCard.source === 'logged' ? 'Logged work' : 'Work block');
    },
    // A logged bar is one session: its own notes. A block's notes are its plan.
    notes() {
      const seg = this.hoverCard.seg;
      const raw = this.hoverCard.source === 'logged' ? seg && seg.notes : this.hoverCard.block.deliverable_notes;
      return noteLines(raw, this.title);
    },
    // Plain lines line up with the text of ticked ones, past the check
    anyDone() { return this.notes.slice(0, NOTE_LINES).some((l) => l.done); },
    // In minutes under an hour (2m), never a sliver of an hour
    loggedText() {
      const seg = this.hoverCard.seg;
      const hours = Number((seg && seg.hours) || this.hoverCard.block.actual_hours) || 0;
      return durationLabel(Math.max(1, Math.round(hours * 60))) + ' logged';
    },
    billingRef() { return (this.hoverCard.seg && this.hoverCard.seg.timesheet) || this.hoverCard.block.timesheet || ''; },
    project() { return this.hoverCard.block.project_name || this.hoverCard.block.project || ''; },
    approval() { return this.hoverCard ? approvalState(this.hoverCard.block) : null; },
  },
  setup() {
    return { CHIP, NOTE_LINES };
  }
};
</script>
