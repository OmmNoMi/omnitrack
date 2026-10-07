<template>
  <!-- Adding or editing a work session by hand opens the session box people know from the
       timer, in the timer's own popup frame: the same Log lines and "What did you get done?"
       field, the block's tasks, Project and Activity. Only the clock's place differs: it says
       when the work was done (form.mode: add | edit | free). It records time already worked
       only: nothing after now can be saved (start a session for that). It never moves a block
       (that is Reschedule). It sits above the sheets (z-45..47) and below the frappe-ui
       popovers (z-60) its date, time and project lists open. -->
  <teleport to="body">
    <div
      v-if="modelValue"
      :class="[SESSION_BACKDROP, 'z-[49]']"
      @click.self="close"
    >
      <div
        ref="sheet"
        :class="SESSION_PANEL"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-session-title"
        @keydown.capture="noteEscape"
        @keydown="onKey"
      >
        <!-- The popup's header, as when a session is raised: what this is, and the way out -->
        <div class="flex items-center justify-between gap-3">
          <h2 id="entry-session-title" class="min-w-0 text-base font-semibold break-words text-gray-900 dark:text-white">{{ title }}</h2>
          <Button variant="ghost" icon="x" label="Close" tooltip="Close · Esc" aria-keyshortcuts="Escape" data-sheet-close @click="close" />
        </div>

        <SessionBox
          ref="box"
          mode="entry"
          :entry="form"
          :day-offsets="dayOffsets"
          :is-saving="isSaving"
          :tracker-project="form.project || ''"
          :tracker-nature="form.nature || 'Work'"
          :tracker-bound-block="block"
          :session-notes-list="form.log || []"
          :min-line-chars="minLogLineChars"
          :projects="projects"
          :nature-options="natureOptions"
          :mod-key="modKey"
          :is-dark-mode="isDarkMode"
          @add-line="form.log.push($event)"
          @remove-line="form.log.splice($event, 1)"
          @update:project="form.project = $event"
          @update:nature="form.nature = $event"
          @save="$emit('save')"
          @cancel="close"
        />
      </div>
    </div>
  </teleport>
</template>

<script>
import { Button } from "frappe-ui";
import SessionBox from "../../session/SessionBox.vue";
import { useWorkstationContext } from "../../composables/useWorkstationContext.js";
import { popoverOpen, menuTrigger } from "../../utils/popover.js";
import { setScrollLock } from "../../utils/scrollLock.js";
import { SESSION_BACKDROP, SESSION_PANEL } from "../../utils/sessionFrame.js";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default {
  name: "WorkSessionEntry",
  components: { Button, SessionBox },
  props: {
    modelValue: { type: Boolean, default: false },
    // { mode, name, block_title, session_date, from_time, to_time, log, project, nature }
    form: { type: Object, required: true },
    isSaving: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
    // Back as far as the timesheet horizon allows (utils/timesheetEntry.entryDayOffsets)
    dayOffsets: { type: Array, default: () => [0, -1] },
  },
  emits: ["update:modelValue", "save"],
  setup() {
    const ws = useWorkstationContext(["editSessionTargetBlock", "projects", "natureOptions", "minLogLineChars", "modKey"]);
    return { ...ws, block: ws.editSessionTargetBlock, SESSION_BACKDROP, SESSION_PANEL };
  },
  data() {
    return { escForPopover: false };
  },
  computed: {
    title() { return this.form.mode === "edit" ? "Edit work session" : "Add work session"; },
  },
  watch: {
    modelValue: { immediate: true, handler(open) { if (open) this.opened(); else this.closed(); } },
  },
  beforeUnmount() { this.closed(); },
  methods: {
    opened() {
      // Kept to hand focus back on close: the menu's button when it was opened from a menu
      if (!this.opener || !document.contains(this.opener)) this.opener = menuTrigger(document.activeElement);
      setScrollLock("work-session-entry", true);
      // Straight to the Log's field: what got done is the one thing always asked. A menu hands
      // focus back to its button once it has closed, after this tick (AGENTS.md, "focus after
      // picking from a Dropdown"), so for a moment focus that lands outside is taken back.
      this.$nextTick(() => {
        this.toLine();
        const back = (e) => {
          if (this.$refs.sheet && !this.$refs.sheet.contains(e.target)) setTimeout(() => this.toLine());
        };
        document.addEventListener("focusin", back, true);
        setTimeout(() => document.removeEventListener("focusin", back, true), 600);
      });
    },
    toLine() {
      const el = this.modelValue && this.$refs.sheet && this.$refs.sheet.querySelector("[data-entry-line]");
      if (el) el.focus();
    },
    // Back to what opened it, unless focus has moved somewhere on purpose
    closed() {
      setScrollLock("work-session-entry", false);
      const opener = this.opener;
      this.opener = null;
      const here = document.activeElement;
      const lost = !here || here === document.body || (this.$refs.sheet && this.$refs.sheet.contains(here));
      if (lost && opener && document.contains(opener)) opener.focus();
    },
    close() { this.$emit("update:modelValue", false); },
    // A list whose focus stays on its trigger closes on this Escape before it reaches onKey
    noteEscape(e) { if (e.key === "Escape") this.escForPopover = popoverOpen(); },
    // Esc closes this popup only (an open list or a log row takes its own Escape first); Tab
    // stays inside; Cmd/Ctrl+Enter saves. The app's own shortcuts (Cmd+S stops the running
    // session, Shift+P plans a block) do not reach past an open entry.
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
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (this.$refs.box) this.$refs.box.entrySave();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === "/" || (e.shiftKey && e.key.length === 1)) e.stopPropagation();
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
