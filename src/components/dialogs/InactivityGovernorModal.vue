<template>
  <!-- Asked when a running session has gone a while without activity. One question, two answers:
       Keep working, or Adjust times, which opens the session's own box with the end already at
       the suggested stop. Stopping happens there, never from here: the person may still be
       working, and one press must not end a running session. -->
  <f-dialog
    :model-value="modelValue"
    title="Are you still working?"
    :subtitle="activeTaskLabel || null"
    size="md"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <FeatherIcon name="clock" class="h-5 w-5" aria-hidden="true" />
    </template>

    <p class="text-base leading-relaxed text-ink-gray-8">
      No activity since <span class="font-semibold text-ink-gray-9 tabular-nums">{{ sinceLabel }}</span> ({{ idleText }} ago).
      If you stopped, adjust the times before you log them.
    </p>

    <template #actions>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="subtle" size="md" label="Adjust times" data-idle-adjust @click="$emit('adjust')">Adjust times</Button>
        <Button
          variant="solid"
          size="md"
          label="Keep working"
          data-autofocus
          data-confirm-working
          @click="$emit('confirm-working')"
        >Keep working</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { momentLabel, hoursMinutes } from "../../utils/clockTime.js";

export default {
  name: "InactivityGovernorModal",
  props: {
    modelValue: { type: Boolean, default: false },
    inactivityMinutes: { type: Number, default: 0 },
    isDarkMode: { type: Boolean, default: false },
    activeTaskLabel: { type: String, default: "" },
    // The moment the question is about, held from when it was asked
    idleSinceMs: { type: Number, default: 0 },
    // Ticks every second; read so the times move on while the question waits
    formattedTime: { type: String, default: "00:00:00" },
  },
  emits: ["update:modelValue", "confirm-working", "adjust"],
  computed: {
    nowMs() { void this.formattedTime; return Date.now(); },
    sinceLabel() { return this.idleSinceMs ? momentLabel(this.idleSinceMs, this.nowMs) : ""; },
    idleText() { return hoursMinutes(this.inactivityMinutes); },
  },
};
</script>
