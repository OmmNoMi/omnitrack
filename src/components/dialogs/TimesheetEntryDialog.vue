<template>
  <!-- The one timesheet panel. Adding an entry against a block, editing a logged one, logging
       a free window, and correcting or stopping the running session all use this form; only
       the title and the buttons change (form.mode: add | edit | free | live). It records time
       worked; it never moves a block (that is Reschedule). -->
  <f-dialog
    :model-value="modelValue"
    :title="title"
    :subtitle="form.block_title || null"
    size="md"
    z-index="z-[75]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="primary">
      <p v-if="intro" class="text-sm" :class="mutedText">{{ intro }}</p>
      <div class="flex gap-3">
        <FeatherIcon name="align-left" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
        <div class="flex-1 min-w-0">
          <Textarea
            v-model="form.notes"
            variant="outline"
            size="md"
            :rows="3"
            label="What did you get done?"
            placeholder="A line or two a manager or client can read. Ctrl+Enter saves."
            data-autofocus
            @keydown.meta.enter.prevent="primary"
            @keydown.ctrl.enter.prevent="primary"
          />
          <p v-if="form.lines" class="mt-1 text-sm" :class="mutedText">
            {{ form.lines === 1 ? 'The session note is' : 'The ' + form.lines + ' session notes are' }} added when it is logged.
          </p>
        </div>
      </div>
      <DayTimeFields
        v-model:date="form.session_date"
        v-model:start="form.from_time"
        v-model:end="form.to_time"
        day-label="Worked on"
        time-label="From – to"
        :day-offsets="dayOffsets"
        :durations="[15, 30, 60, 90, 120, 180]"
        :is-dark-mode="isDarkMode"
      />
    </form>

    <template #actions>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" label="Cancel" @click="$emit('update:modelValue', false)">Cancel</Button>
        <Button
          v-if="isLive"
          variant="subtle"
          label="Keep running"
          tooltip="Save the start and notes; the clock keeps going"
          :disabled="!form.from_time"
          @click="$emit('keep-running')"
        >Keep running</Button>
        <Button variant="solid" :label="saveLabel" :loading="isSaving" :disabled="!canSave" @click="$emit('save')">
          {{ saveLabel }}
        </Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import DayTimeFields from "../common/DayTimeFields.vue";
import { toMin, durationLabel } from "../../utils/clockTime.js";

export default {
  name: "TimesheetEntryDialog",
  components: { DayTimeFields },
  props: {
    modelValue: { type: Boolean, default: false },
    // { mode, name, block_title, block_when, started_at, lines, session_date, from_time, to_time, notes }
    form: { type: Object, required: true },
    isSaving: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
    // Back as far as the timesheet horizon allows (utils/timesheetEntry.entryDayOffsets)
    dayOffsets: { type: Array, default: () => [0, -1] },
  },
  emits: ["update:modelValue", "save", "keep-running"],
  computed: {
    isLive() { return this.form.mode === "live"; },
    title() {
      if (this.isLive) return "Running session";
      return this.form.mode === "edit" ? "Edit timesheet entry" : "Add timesheet entry";
    },
    intro() {
      if (this.isLive) return this.form.started_at ? `Running since ${this.form.started_at}.` : "";
      if (this.form.mode === "add" && this.form.block_when) return `Records time you worked. The block stays planned for ${this.form.block_when}.`;
      return "";
    },
    mins() {
      return toMin(this.form.to_time) - toMin(this.form.from_time);
    },
    saveLabel() {
      if (this.isLive) return this.mins > 0 ? `Stop and log ${durationLabel(this.mins)}` : "Stop and log";
      return this.form.mode === "edit" ? "Save" : "Add entry";
    },
    // A running session may lean on its own notes; anything else needs a line of its own
    canSave() {
      const f = this.form;
      const said = String(f.notes || "").trim().length >= 3 || (this.isLive && f.lines > 0);
      return !this.isSaving && !!f.session_date && this.mins > 0 && said;
    },
    mutedText() { return this.isDarkMode ? "text-gray-300" : "text-gray-700"; },
    iconTone() { return this.isDarkMode ? "text-gray-300" : "text-gray-700"; },
  },
  methods: {
    primary() {
      if (this.canSave) this.$emit("save");
    },
  },
};
</script>
