<template>
  <!-- Asked when a running session has gone a while without a note. One question, one sentence
       on why it is asked, and the answers. The session itself holds the rest. -->
  <f-dialog
    :model-value="modelValue"
    :title="long ? 'Still working on this?' : 'Are you still working?'"
    :subtitle="activeTaskLabel || null"
    size="md"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <FeatherIcon name="clock" class="h-5 w-5" aria-hidden="true" />
    </template>

    <div class="space-y-2 text-base leading-relaxed" :class="bodyText">
      <p>
        No note since <span class="font-medium tabular-nums" :title="sessionStart ? 'Session started ' + sessionStart.date + ', ' + sessionStart.time : null">{{ lastActivityTimeHHMM }}</span>, {{ idleText }} ago.
        <template v-if="elapsedText">The timer has run {{ elapsedText }}.</template>
      </p>
      <p v-if="long">If you stepped away, stop at your last note, or discard the session.</p>
    </div>

    <template #actions>
      <div class="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
        <Button
          v-if="long"
          variant="ghost"
          theme="red"
          size="md"
          label="Discard session"
          tooltip="Nothing is logged"
          class="sm:mr-auto !text-red-700 dark:!text-red-300"
          data-destructive
          @click="$emit('discard')"
        >Discard session</Button>
        <Button variant="ghost" size="md" label="Stop now" @click="$emit('stop-now')">Stop now</Button>
        <Button
          variant="outline"
          size="md"
          :label="'Stop at ' + suggestedStopHHMM"
          tooltip="Your last note plus 15 minutes"
          @click="$emit('stop-at-last-edit')"
        >Stop at {{ suggestedStopHHMM }}</Button>
        <Button
          variant="solid"
          size="md"
          label="Still working"
          data-autofocus
          data-confirm-working
          @click="$emit('confirm-working')"
        >Still working</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
// 47 → "47 min", 72 → "1 h 12 min"
const span = (minutes) => {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

export default {
  name: "InactivityGovernorModal",
  props: {
    modelValue: { type: Boolean, default: false },
    inactivityMinutes: { type: Number, default: 0 },
    isDarkMode: { type: Boolean, default: false },
    activeTaskLabel: { type: String, default: "" },
    sessionStart: { type: Object, default: null },
    lastActivityTimeHHMM: { type: String, default: "" },
    suggestedStopHHMM: { type: String, default: "" },
    formattedTime: { type: String, default: "00:00:00" },
  },
  emits: ["update:modelValue", "confirm-working", "stop-now", "stop-at-last-edit", "discard"],
  computed: {
    long() { return this.inactivityMinutes >= 60; },
    idleText() { return span(Math.max(0, Math.floor(this.inactivityMinutes))); },
    // "03:34:18" → "3 h 34 min"
    elapsedText() {
      const [h, m] = String(this.formattedTime || '').split(':').map(Number);
      return Number.isFinite(h) && Number.isFinite(m) && (h || m) ? span(h * 60 + m) : '';
    },
    bodyText() { return this.isDarkMode ? 'text-gray-200' : 'text-gray-800'; },
  },
};
</script>
