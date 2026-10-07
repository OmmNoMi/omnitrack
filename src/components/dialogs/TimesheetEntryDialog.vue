<template>
  <div>
    <!-- The one timesheet panel. Adding an entry against a block, editing a logged one, logging
         a free window, and correcting or stopping the running session all use this form; only
         the title and the buttons change (form.mode: add | edit | free | live). It opens as the
         Work Session sheet, so it reads as the session it will become, and it records time
         already worked only: nothing after now can be logged (start a session for that). It
         never moves a block (that is Reschedule). It sits above the other sheets and below the
         frappe-ui popovers (z-60) its date and time lists open. -->
    <div v-if="modelValue" class="fixed inset-0 z-[48] bg-black/30 transition-opacity" aria-hidden="true" @click="close"></div>
    <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="modelValue" ref="sheet" class="fixed inset-y-0 right-0 z-[49] w-full max-w-md shadow-xl overflow-y-auto sm:rounded-l-2xl" :class="isDarkMode ? 'bg-[#1E1F22]' : 'bg-white'" role="dialog" aria-modal="true" aria-labelledby="entry-sheet-kind entry-sheet-title" @keydown.capture="noteEscape" @keydown="onKey">
        <form class="px-6 pt-4 pb-6 space-y-6" @submit.prevent="primary">

          <!-- Header: the same Work Session kind as a logged entry's sheet, and what is being done -->
          <div class="space-y-2">
            <div class="flex items-center gap-1">
              <DetailKind id="entry-sheet-kind" kind="session" :is-dark-mode="isDarkMode" class="flex-1" />
              <Button variant="ghost" icon="x" class="shrink-0" label="Close" data-sheet-close @click="close" />
            </div>
            <h2 id="entry-sheet-title" class="min-w-0 text-[22px] leading-7 font-normal break-words" :class="strongText">{{ title }}</h2>
          </div>

          <dl v-if="form.block_title || started" class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-base items-baseline">
            <template v-if="form.block_title">
              <dt :class="mutedText">Work block</dt>
              <dd class="min-w-0 break-words" :class="strongText">{{ form.block_title }}<template v-if="planLine"><br><span class="text-sm" :class="mutedText">{{ planLine }}</span></template></dd>
            </template>
            <template v-if="started">
              <dt :class="mutedText">Running since</dt>
              <dd class="min-w-0 tabular-nums" :class="strongText">{{ started }}</dd>
            </template>
          </dl>

          <div class="space-y-1">
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
            <p v-if="form.lines" class="text-sm" :class="mutedText">
              {{ form.lines === 1 ? 'The session note is' : 'The ' + form.lines + ' session notes are' }} added when it is logged.
            </p>
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
          <!-- Time not worked yet cannot be charged; the clock is how time ahead gets logged -->
          <p v-if="ahead" class="text-sm" :class="lateText" role="alert">{{ aheadText }}</p>

          <div class="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Entry actions">
            <Button variant="ghost" label="Cancel" @click="close">Cancel</Button>
            <Button
              v-if="isLive"
              variant="subtle"
              label="Keep running"
              tooltip="Save the start and notes; the clock keeps going"
              :disabled="!form.from_time"
              @click="$emit('keep-running')"
            >Keep running</Button>
            <Button type="submit" variant="solid" theme="blue" class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white" :label="saveLabel" :loading="isSaving" :disabled="!canSave">
              {{ saveLabel }}
            </Button>
          </div>
        </form>
      </div>
    </transition>
  </div>
</template>

<script>
import DayTimeFields from "../common/DayTimeFields.vue";
import DetailKind from "../common/DetailKind.vue";
import { spanMins, durationLabel, clock, toMin } from "../../utils/clockTime.js";
import { entryEndMs } from "../../utils/timesheetEntry.js";
import { popoverOpen, menuTrigger } from "../../utils/popover.js";
import { setScrollLock } from "../../utils/scrollLock.js";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default {
  name: "TimesheetEntryDialog",
  components: { DayTimeFields, DetailKind },
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
  data() {
    return { now: Date.now(), tick: null, escForPopover: false };
  },
  computed: {
    isLive() { return this.form.mode === "live"; },
    title() {
      if (this.isLive) return "Running session";
      return this.form.mode === "edit" ? "Edit work session" : "Add work session";
    },
    started() { return this.isLive && this.form.started_at ? clock(toMin(this.form.started_at)) : ""; },
    planLine() {
      if (this.form.mode === "add" && this.form.block_when) return `Planned for ${this.form.block_when}. The plan stays as it is.`;
      return "";
    },
    mins() {
      return spanMins(this.form.from_time, this.form.to_time);
    },
    // A session is time already worked: it cannot end after now
    ahead() {
      const end = entryEndMs(this.form.session_date, this.form.from_time, this.mins);
      return end != null && this.mins > 0 && end > this.now + 60000;
    },
    aheadText() {
      const d = new Date(this.now);
      return `A work session is time already worked, so it has to end by ${clock(d.getHours() * 60 + d.getMinutes())}. For time still ahead, start a session when the work begins.`;
    },
    saveLabel() {
      if (this.isLive) return this.mins > 0 ? `Stop and log ${durationLabel(this.mins)}` : "Stop and log";
      return this.form.mode === "edit" ? "Save" : "Add session";
    },
    // A running session may lean on its own notes; anything else needs a line of its own
    canSave() {
      const f = this.form;
      const said = String(f.notes || "").trim().length >= 3 || (this.isLive && f.lines > 0);
      return !this.isSaving && !!f.session_date && this.mins > 0 && !this.ahead && said;
    },
    strongText() { return this.isDarkMode ? "text-gray-100" : "text-gray-900"; },
    mutedText() { return this.isDarkMode ? "text-gray-300" : "text-gray-700"; },
    lateText() { return this.isDarkMode ? "text-red-200" : "text-red-700"; },
  },
  watch: {
    modelValue: { immediate: true, handler(open) { if (open) this.opened(); else this.closed(); } },
  },
  beforeUnmount() { this.closed(); },
  methods: {
    opened() {
      // Kept to hand focus back on close: the menu's button when it was opened from a menu
      if (!this.opener || !document.contains(this.opener)) this.opener = menuTrigger(document.activeElement);
      setScrollLock("timesheet-entry", true);
      this.now = Date.now();
      clearInterval(this.tick);
      this.tick = setInterval(() => { this.now = Date.now(); }, 30000);
      // Straight to the notes: what got done is the one thing always asked. A menu hands focus
      // back to its button once it has closed, after this tick (AGENTS.md, "focus after picking
      // from a Dropdown"), so for a moment focus that lands outside the sheet is taken back.
      this.$nextTick(() => {
        this.toNotes();
        const back = (e) => {
          if (this.$refs.sheet && !this.$refs.sheet.contains(e.target)) setTimeout(() => this.toNotes());
        };
        document.addEventListener("focusin", back, true);
        setTimeout(() => document.removeEventListener("focusin", back, true), 600);
      });
    },
    toNotes() {
      const el = this.modelValue && this.$refs.sheet && this.$refs.sheet.querySelector("textarea");
      if (el) el.focus();
    },
    // Back to what opened it, unless focus has moved somewhere on purpose
    closed() {
      clearInterval(this.tick);
      this.tick = null;
      setScrollLock("timesheet-entry", false);
      const opener = this.opener;
      this.opener = null;
      const here = document.activeElement;
      const lost = !here || here === document.body || (this.$refs.sheet && this.$refs.sheet.contains(here));
      if (lost && opener && document.contains(opener)) opener.focus();
    },
    close() { this.$emit("update:modelValue", false); },
    primary() {
      this.now = Date.now();
      if (this.canSave) this.$emit("save");
    },
    // A list whose focus stays on its trigger closes on this Escape before it reaches onKey
    noteEscape(e) { if (e.key === "Escape") this.escForPopover = popoverOpen(); },
    // Esc closes this sheet only (an open list takes its own Escape first); Tab stays inside
    onKey(e) {
      if (e.key === "Escape") {
        const popover = this.escForPopover;
        this.escForPopover = false;
        if (e.defaultPrevented || popover) return;
        e.preventDefault();
        e.stopPropagation();
        this.close();
        return;
      }
      if (e.key !== "Tab" || !this.$refs.sheet) return;
      const items = [...this.$refs.sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
  },
};
</script>
