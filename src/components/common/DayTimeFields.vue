<template>
  <!-- Day, then start – end with quick lengths. One component for every dialog that asks
       "when": planning a block and logging a session look and behave the same. -->
  <div class="space-y-4">
    <div class="flex gap-3">
      <FeatherIcon name="calendar" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
      <div class="flex-1 min-w-0 space-y-2 [&_input]:h-9 [&_input]:text-base">
        <p class="text-sm font-medium" :class="labelText" aria-hidden="true">{{ dayLabel }}</p>
        <div v-input-attrs="{ 'aria-label': dayLabel, 'aria-haspopup': 'dialog' }">
          <DatePicker
            variant="outline"
            :model-value="date"
            format="ddd, D MMM YYYY"
            :clearable="false"
            placeholder="Pick a day"
            @update:model-value="$emit('update:date', $event)"
          />
        </div>
        <ChoiceChips :options="dayOptions" :model-value="date" aria-label="Quick day" @update:model-value="$emit('update:date', $event)" />
      </div>
    </div>

    <div class="flex gap-3">
      <FeatherIcon name="clock" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
      <div class="flex-1 min-w-0 space-y-2">
        <!-- A length no chip names sits beside the label, so the chip row stays one line at 375px -->
        <p class="text-sm font-medium" :class="labelText"><span aria-hidden="true">{{ timeLabel }}</span><span v-if="mins > 0 && !durations.includes(mins)" class="font-normal tabular-nums" :class="mutedText">{{ ' · ' }}{{ durationLabel(mins) }}</span></p>
        <!-- As in Google Calendar: the end list starts after the start and names each length.
             Both accept typing ("2pm", "14:30"); the list is every 15 minutes. -->
        <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 [&_input]:h-9 [&_input]:text-base">
          <TimePicker variant="outline" :model-value="start" placeholder="Start" :interval="15" @update:model-value="setStart" />
          <span :class="mutedText" aria-hidden="true">–</span>
          <TimePicker variant="outline" :model-value="end" placeholder="End" :options="endOptions" placement="bottom-end" @update:model-value="$emit('update:end', $event)" />
        </div>
        <div class="flex flex-wrap items-center gap-1.5 pt-0.5" role="toolbar" aria-label="Quick time adjustments">
          <span class="text-xs font-medium" :class="mutedText">Start:</span>
          <button
            v-if="scheduledStart && scheduledStart.slice(0, 5) !== start"
            type="button"
            :class="pillClass"
            aria-label="Set start time to scheduled start"
            title="Snap to scheduled start"
            @click="applyOnTime"
          >On time</button>
          <button type="button" :class="pillClass" aria-label="Start 30 minutes earlier" title="Started 30m ago" @click="nudgeStart(-30)">-30m</button>
          <button type="button" :class="pillClass" aria-label="Start 15 minutes earlier" title="Started 15m ago" @click="nudgeStart(-15)">-15m</button>
          <button type="button" :class="pillClass" aria-label="Start 10 minutes earlier" title="Started 10m ago" @click="nudgeStart(-10)">-10m</button>
          <button type="button" :class="pillClass" aria-label="Start 5 minutes earlier" title="Started 5m ago" @click="nudgeStart(-5)">-5m</button>
          <span class="text-xs font-medium ml-1" :class="mutedText">End:</span>
          <button type="button" :class="pillClass" aria-label="Set end time to current time" title="Set end to now" @click="setEndNow">Now</button>
          <button type="button" :class="pillClass" aria-label="Extend end time by 5 minutes" title="Add 5m to end" @click="nudgeEnd(5)">+5m</button>
          <button type="button" :class="pillClass" aria-label="Extend end time by 15 minutes" title="Add 15m to end" @click="nudgeEnd(15)">+15m</button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <ChoiceChips :options="durationOptions" :model-value="mins" aria-label="Length" @update:model-value="setDuration" />
          <span v-if="nextDay" class="text-sm font-medium text-blue-600 dark:text-blue-400">Ends next day</span>
          <span v-if="start && end && mins <= 0" class="text-sm text-ink-red-4" role="alert">End is the same as start</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ChoiceChips from "./ChoiceChips.vue";
import { vInputAttrs } from "../../utils/popover.js";
import { toMin, toHHMM, spanMins, localISO, durationLabel, endTimeOptions } from "../../utils/clockTime.js";

export default {
  name: "DayTimeFields",
  components: { ChoiceChips },
  directives: { inputAttrs: vInputAttrs },
  props: {
    date: { type: String, default: "" },
    start: { type: String, default: "" },
    end: { type: String, default: "" },
    // Quick-day chips, as offsets from today: planning looks ahead, logging looks back
    dayOffsets: { type: Array, default: () => [0, 1, 2, 3] },
    // Four at most, so the chips sit on one line in the narrowest box (the session box)
    durations: { type: Array, default: () => [30, 60, 120, 240] },
    isDarkMode: { type: Boolean, default: false },
    // A timesheet entry says "Worked on"; a plan says "Day"
    dayLabel: { type: String, default: "Day" },
    timeLabel: { type: String, default: "Time" },
    scheduledStart: { type: String, default: "" },
    isLive: { type: Boolean, default: false },
    capToNow: { type: Boolean, default: false },
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
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      return endTimeOptions(this.start, {
        currentEnd: this.end,
        capToNow: this.capToNow || this.isLive,
        nowHHMM: toHHMM(nowMin),
      });
    },
    iconTone() { return this.isDarkMode ? "text-gray-300" : "text-gray-600"; },
    mutedText() { return this.isDarkMode ? "text-gray-300" : "text-gray-700"; },
    labelText() { return this.isDarkMode ? "text-gray-200" : "text-gray-800"; },
    pillClass() {
      return "text-xs font-medium px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E1F22] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer select-none transition-colors";
    },
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
    nudgeStart(deltaMins) {
      const base = this.start
        ? toMin(this.start)
        : (new Date().getHours() * 60 + new Date().getMinutes());
      const newStart = (base + deltaMins + 24 * 60) % (24 * 60);
      const newStartHHMM = toHHMM(newStart);
      this.$emit("update:start", newStartHHMM);
      if (!this.end || (!this.isLive && this.mins <= 0)) {
        this.$emit("update:end", toHHMM((newStart + 60) % (24 * 60)));
      }
    },
    applyOnTime() {
      if (!this.scheduledStart) return;
      const s = this.scheduledStart.slice(0, 5);
      this.$emit("update:start", s);
      if (!this.end || (!this.isLive && this.mins <= 0)) {
        this.$emit("update:end", toHHMM((toMin(s) + 60) % (24 * 60)));
      }
    },
    setEndNow() {
      const now = new Date();
      const nowHHMM = toHHMM(now.getHours() * 60 + now.getMinutes());
      this.$emit("update:end", nowHHMM);
      if (!this.start) {
        this.$emit("update:start", toHHMM((toMin(nowHHMM) - 60 + 24 * 60) % (24 * 60)));
      }
    },
    nudgeEnd(deltaMins) {
      const base = this.end
        ? toMin(this.end)
        : (this.start
            ? toMin(this.start) + (this.mins > 0 ? this.mins : 30)
            : new Date().getHours() * 60 + new Date().getMinutes());
      const newEnd = (base + deltaMins + 24 * 60) % (24 * 60);
      this.$emit("update:end", toHHMM(newEnd));
    },
  },
};
</script>
