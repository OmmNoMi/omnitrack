<template>
  <!-- The day in one sentence, then what is left: each planned block not logged yet, with one
       Log that opens its own entry box, where the person says what they did. Never one press
       that writes every plan in as the work, and no closing button that pretends to do more. -->
  <f-dialog
    :model-value="modelValue"
    title="Wrap up the day"
    size="md"
    z-index="z-[85]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <p class="text-base leading-relaxed text-ink-gray-8">
      You logged <span class="font-semibold text-ink-gray-9 tabular-nums">{{ loggedText }}</span> today<template v-if="pendingBlocks.length">. {{ pendingText }} not logged yet.</template><template v-else>, and nothing planned is left to log.</template>
    </p>

    <ul v-if="pendingBlocks.length" class="divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto" aria-label="Planned, not logged">
      <li v-for="b in pendingBlocks" :key="b.name" class="flex items-center justify-between gap-3 py-2">
        <div class="min-w-0">
          <div class="text-sm font-medium text-ink-gray-9 break-words">{{ blockTitle(b) }}</div>
          <div class="text-xs text-ink-gray-7 tabular-nums">{{ whenText(b) }}</div>
        </div>
        <Button variant="outline" size="sm" :label="'Log ' + blockTitle(b)" data-log-block @click="$emit('log-block', b)">Log</Button>
      </li>
    </ul>

    <template #actions>
      <div class="flex items-center justify-end">
        <Button variant="solid" size="md" label="Done" @click="$emit('update:modelValue', false)">Done</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { blockTitle } from "../../utils/blockTitle.js";
import { clock, toMin, hoursMinutes } from "../../utils/clockTime.js";

export default {
  name: "EODWrapUpModal",
  props: {
    modelValue: { type: Boolean, default: false },
    summary: { type: Object, default: null },
    pendingBlocks: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue", "log-block"],
  computed: {
    loggedText() {
      return hoursMinutes(Math.round(((this.summary && this.summary.total_actual_hours) || 0) * 60));
    },
    pendingText() {
      const n = this.pendingBlocks.length;
      return n === 1 ? "1 planned block is" : `${n} planned blocks are`;
    },
  },
  methods: {
    blockTitle,
    whenText(b) {
      return b.start_time && b.end_time ? `${clock(toMin(b.start_time))} – ${clock(toMin(b.end_time))}` : "";
    },
  },
};
</script>
