<template>
  <!-- Day, then start – end with quick lengths. One component for every dialog that asks
       "when": planning a block and logging a session look and behave the same. -->
  <div class="space-y-4">
    <div class="flex gap-3">
      <FeatherIcon name="calendar" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
      <div class="flex-1 min-w-0 space-y-2 [&_input]:h-9 [&_input]:text-base">
        <p class="text-sm font-medium" :class="labelText" aria-hidden="true">{{ dayLabel }}</p>
        <DatePicker
          variant="outline"
          :model-value="date"
          format="ddd, D MMM YYYY"
          :clearable="false"
          placeholder="Pick a day"
          :aria-label="dayLabel"
          aria-haspopup="dialog"
          @update:model-value="$emit('update:date', $event)"
        />
        <ChoiceChips :options="dayOptions" :model-value="date" aria-label="Quick day" @update:model-value="$emit('update:date', $event)" />
      </div>
    </div>

    <div class="flex gap-3">
      <FeatherIcon name="clock" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
      <div class="flex-1 min-w-0 space-y-2">
        <p class="text-sm font-medium" :class="labelText" aria-hidden="true">{{ timeLabel }}</p>
        <!-- As in Google Calendar: the end list starts after the start and names each length.
             Both accept typing ("2pm", "14:30"); the list is every 15 minutes. -->
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 [&_input]:h-9 [&_input]:text-base">
          <TimePicker variant="outline" :model-value="start" placeholder="Start" :interval="15" @update:model-value="setStart" />
          <span :class="mutedText" aria-hidden="true">–</span>
          <TimePicker variant="outline" :model-value="end" placeholder="End" :options="endOptions" placement="bottom-end" @update:model-value="$emit('update:end', $event)" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <ChoiceChips :options="durationOptions" :model-value="mins" aria-label="Length" @update:model-value="setDuration" />
          <span v-if="mins > 0 && !durations.includes(mins)" class="text-sm tabular-nums" :class="mutedText">{{ durationLabel(mins) }}</span>
          <span v-if="nextDay" class="text-sm" :class="mutedText">Ends next day</span>
          <span v-if="start && end && mins <= 0" class="text-sm text-ink-red-4" role="alert">End is the same as start</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ChoiceChips from "./ChoiceChips.vue";
import { toMin, toHHMM, spanMins, localISO, durationLabel, endTimeOptions } from "../../utils/clockTime.js";

export default {
  name: "DayTimeFields",
  components: { ChoiceChips },
  props: {
    date: { type: String, default: "" },
    start: { type: String, default: "" },
    end: { type: String, default: "" },
    // Quick-day chips, as offsets from today: planning looks ahead, logging looks back
    dayOffsets: { type: Array, default: () => [0, 1, 2, 3] },
    durations: { type: Array, default: () => [30, 60, 90, 120, 180, 240] },
    isDarkMode: { type: Boolean, default: false },
    // A timesheet entry says "Worked on"; a plan says "Day"
    dayLabel: { type: String, default: "Day" },
    timeLabel: { type: String, default: "Time" },
  },
  emits: ["update:date", "update:start", "update:end"],
  computed: {
    dayOptions() {
      return this.dayOffsets.map((offset) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        const named = { 0: "Today", 1: "Tomorrow", "-1": "Yesterday" }[offset];
        return {
          label: named || d.toLocaleDateString(undefined, { weekday: "short" }),
          value: localISO(d),
          tooltip: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }),
        };
      });
    },
    mins() {
      return spanMins(this.start, this.end);
    },
    nextDay() {
      return !!(this.start && this.end) && toMin(this.end) < toMin(this.start);
    },
    durationOptions() {
      return this.durations.map((m) => ({ label: durationLabel(m), value: m }));
    },
    // Every 15 minutes after the start, to the end of the day, each with its length
    endOptions() {
      return endTimeOptions(this.start);
    },
    iconTone() { return this.isDarkMode ? "text-gray-300" : "text-gray-600"; },
    mutedText() { return this.isDarkMode ? "text-gray-300" : "text-gray-700"; },
    labelText() { return this.isDarkMode ? "text-gray-200" : "text-gray-800"; },
  },
  methods: {
    durationLabel,
    // Moving the start keeps the length, as in a calendar
    setStart(value) {
      const keep = this.mins > 0 ? this.mins : 60;
      this.$emit("update:start", value);
      if (value) this.$emit("update:end", toHHMM((toMin(value) + keep) % (24 * 60)));
    },
    setDuration(mins) {
      if (!this.start || !mins) return;
      this.$emit("update:end", toHHMM((toMin(this.start) + mins) % (24 * 60)));
    },
  },
};
</script>
