<template>
  <!-- Asked when a planned block is started late. One question, two answers: the session runs
       from the planned start, or from now. Now is where focus starts: it claims no time that was
       not tracked. Escape or the close button starts nothing. -->
  <f-dialog
    :model-value="modelValue"
    title="When did you start?"
    :subtitle="pendingBlockLabel || null"
    size="md"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('cancel')"
  >
    <template #header-icon>
      <FeatherIcon name="clock" class="h-5 w-5" aria-hidden="true" />
    </template>

    <p class="text-base leading-relaxed text-ink-gray-8">
      It was planned for <span class="font-semibold text-ink-gray-9 tabular-nums">{{ plannedLabel }}</span>, {{ lateText }} ago.
    </p>

    <template #actions>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="subtle" size="md" :label="'At ' + plannedLabel" data-start-planned @click="$emit('select', plannedStartMs)">At {{ plannedLabel }}</Button>
        <Button
          variant="solid"
          size="md"
          label="Just now"
          data-autofocus
          data-start-now
          @click="$emit('select', null)"
        >Just now</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { blockTitle } from "../../utils/blockTitle.js";
import { momentLabel, hoursMinutes } from "../../utils/clockTime.js";

export default {
  name: "StartTimeChoiceModal",
  props: {
    modelValue: { type: Boolean, default: false },
    pendingBlock: { type: Object, default: null },
    // The block's planned start today, in ms
    plannedStartMs: { type: Number, default: 0 },
  },
  emits: ["update:modelValue", "select", "cancel"],
  computed: {
    pendingBlockLabel() {
      return this.pendingBlock ? blockTitle(this.pendingBlock, "") : "";
    },
    plannedLabel() {
      return this.plannedStartMs ? momentLabel(this.plannedStartMs) : "";
    },
    // Read again each time the question opens
    lateText() {
      void this.modelValue;
      return hoursMinutes((Date.now() - this.plannedStartMs) / 60000);
    },
  },
};
</script>
