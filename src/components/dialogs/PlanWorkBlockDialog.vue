<template>
  <f-dialog
    :model-value="modelValue"
    title="Plan time"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <FeatherIcon name="calendar" class="w-4 h-4" />
    </template>

    <!-- Step 1 (after a calendar slot is picked): which tasks? -->
    <PlanTaskStep
      v-if="step === 'task'"
      ref="taskStep"
      v-model:query="query"
      v-model:checked="checked"
      :task-options="taskOptions"
      :when-line="whenLine"
      :is-dark-mode="isDarkMode"
      @pick="commit"
      @continue="continueWithChecked"
      @skip="skipTask"
    />

    <!-- The one form that creates a Planned Work Block. State lives in workBlockStore.bookForm;
         openPlanDialog() fills it and submitBooking() saves it. Every field carries a visible
         label: an icon alone does not say what a filled-in value is. -->
    <form v-else :id="listId + '-form'" class="space-y-4" @submit.prevent="canSave && $emit('submit')">
      <ChoiceChips block :options="modeOptions" :model-value="mode" aria-label="Kind of time" @update:model-value="setMode" />

      <div>
        <label :for="fieldId('title')" class="block mb-1 text-sm font-medium" :class="labelText">{{ titleLabel }}</label>
        <!-- One task picked and no title yet: the task's name is offered. Tab (or a swipe
             right on a phone) takes it; typing anything keeps the typed title. -->
        <TextInput
          :id="fieldId('title')"
          ref="titleInput"
          size="lg"
          variant="outline"
          v-model="form.deliverable_notes"
          :placeholder="titleSuggestion || titlePlaceholder"
          :aria-keyshortcuts="titleSuggestion ? 'Tab' : undefined"
          :aria-describedby="titleSuggestion ? fieldId('title-hint') : undefined"
          data-autofocus
          @keydown="onTitleKey"
          @touchstart.passive="onTitleTouchStart"
          @touchend="onTitleTouchEnd"
        />
        <div v-if="titleSuggestion" class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Button variant="subtle" size="sm" icon-left="corner-down-right" :label="'Use task name'" @click="useSuggestion">Use task name</Button>
          <span :id="fieldId('title-hint')" class="text-sm" :class="mutedText">
            <span class="hidden sm:inline">or press Tab</span><span class="sm:hidden">or swipe right on the title</span>
          </span>
        </div>
      </div>

      <DayTimeFields
        v-model:date="form.work_date"
        v-model:start="form.start_time"
        v-model:end="form.end_time"
        :is-dark-mode="isDarkMode"
      />

      <template v-if="mode === 'work'">
        <div class="flex gap-3">
          <FeatherIcon name="check-square" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
          <div class="flex-1 min-w-0">
            <p :id="fieldId('tasks')" class="mb-1 text-sm font-medium" :class="labelText">{{ pickedRows.length > 1 ? `Tasks (${pickedRows.length})` : 'Task' }}</p>
            <!-- One task picker for the whole dialog: Add reopens the searchable list above, which
                 has the room a dropdown squeezed into this column does not. To swap a task,
                 remove it and add another; a separate Change control was noise. -->
            <!-- A plain outlined list, the same details (and colours) as the list they came from -->
            <ul v-if="pickedRows.length" :aria-labelledby="fieldId('tasks')" class="rounded-lg border border-outline-gray-2 divide-y divide-outline-gray-2">
              <li v-for="row in pickedRows" :key="row.key" class="flex items-center gap-2 pl-3 pr-1 py-2">
                <div class="flex-1 min-w-0">
                  <p class="flex items-start gap-2 text-base leading-snug text-ink-gray-8">
                    <Badge v-if="row.isNew" theme="blue" variant="subtle" label="New task" class="mt-0.5 shrink-0" />
                    <span class="line-clamp-2 break-words" :title="row.label">{{ row.label }}</span>
                  </p>
                  <p v-if="row.meta.length" class="mt-0.5 flex flex-wrap gap-x-1.5 text-sm" :class="mutedText">
                    <template v-for="(m, j) in row.meta" :key="j">
                      <span v-if="j" aria-hidden="true">·</span>
                      <span :class="toneClass(m.tone, isDarkMode)">{{ m.text }}</span>
                    </template>
                  </p>
                </div>
                <Button variant="ghost" icon="x" :label="'Remove ' + row.label" class="shrink-0" @click="removePicked(row)" />
              </li>
            </ul>
            <Button
              variant="outline"
              theme="blue"
              size="md"
              class="w-full !justify-start"
              :class="pickedRows.length ? 'mt-2' : ''"
              icon-left="plus"
              :label="pickedRows.length ? 'Add another task' : 'Link tasks (optional)'"
              @click="openTaskStep(!!pickedRows.length)"
            >{{ pickedRows.length ? 'Add another task' : 'Link tasks (optional)' }}</Button>
          </div>
        </div>

        <!-- A task already carries its project -->
        <div v-if="!form.work_items.length && projectOptions.length > 0" class="flex gap-3">
          <FeatherIcon name="folder" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
          <div class="flex-1 min-w-0">
            <p class="mb-1 text-sm font-medium" :class="labelText" aria-hidden="true">Project</p>
            <Combobox open-on-click variant="outline" size="md" v-model="form.project" :options="projectOptions" placeholder="General Work" aria-label="Project" />
          </div>
        </div>

        <!-- A team session: the block goes on every person's calendar, with the same tasks -->
        <div v-if="peopleOptions.length" class="flex gap-3">
          <FeatherIcon name="users" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
          <div class="flex-1 min-w-0 [&_button[data-slot=trigger]]:w-full">
            <label :for="fieldId('people')" class="block mb-1 text-sm font-medium" :class="labelText">Work with</label>
            <MultiSelect
              :id="fieldId('people')"
              v-model="form.people"
              variant="outline"
              size="md"
              :options="peopleOptions"
              placeholder="Search people"
              empty-text="No one matches"
            >
              <!-- Own trigger: the built-in one shows the search box's placeholder when empty -->
              <template #trigger="{ open, selectedOptions }">
                <Button
                  :id="fieldId('people')"
                  variant="outline"
                  size="md"
                  class="w-full !justify-between"
                  icon-right="chevron-down"
                  aria-haspopup="listbox"
                  :aria-expanded="open ? 'true' : 'false'"
                  :label="'Work with: ' + (selectedOptions.length ? peopleNames : 'just you')"
                  :title="peopleNames || undefined"
                >
                  <span class="truncate" :class="selectedOptions.length ? 'text-ink-gray-8' : 'text-ink-gray-5'">{{ selectedOptions.length ? peopleNames : 'Just you' }}</span>
                </Button>
              </template>
              <template #footer="{ clearAll, selectedOptions }">
                <div class="flex items-center justify-between gap-2 border-t border-outline-gray-1 px-3 py-1.5">
                  <span class="text-sm" :class="mutedText">{{ selectedOptions.length ? `${selectedOptions.length} with you` : 'Pick everyone in this session' }}</span>
                  <Button v-if="selectedOptions.length" variant="ghost" size="sm" label="Clear" @click="clearAll">Clear</Button>
                </div>
              </template>
            </MultiSelect>
            <p v-if="form.people.length" class="mt-1 text-sm" :class="mutedText">Goes on their calendars too, with the same tasks</p>
          </div>
        </div>
      </template>

      <!-- Managers can plan on a teammate's calendar -->
      <div v-if="isManager && planForOptions.length > 1" class="flex gap-3">
        <FeatherIcon name="user" class="w-5 h-5 mt-7 shrink-0" :class="iconTone" aria-hidden="true" />
        <div class="flex-1 min-w-0">
          <p class="mb-1 text-sm font-medium" :class="labelText" aria-hidden="true">Whose calendar</p>
          <Combobox open-on-click variant="outline" size="md" v-model="form.assigned_employee" :options="planForOptions" :placeholder="planForOptions[0].label" aria-label="Whose calendar" />
        </div>
      </div>

    </form>

    <template #actions>
      <!-- Task step: skipping keeps whatever was typed as the block's name -->
      <div v-if="step === 'task'" class="flex flex-wrap items-center justify-end gap-2 w-full">
        <Button v-if="fromDetails" variant="ghost" label="Back" @click="toDetails">Back</Button>
        <Button v-else variant="ghost" label="Cancel" @click="$emit('update:modelValue', false)">Cancel</Button>
        <Button v-if="checked.length" variant="solid" theme="blue" :label="continueLabel" @click="continueWithChecked">{{ continueLabel }}</Button>
        <Button v-else variant="subtle" :label="query.trim() ? 'Skip, just name it' : 'Skip'" @click="skipTask">{{ query.trim() ? 'Skip, just name it' : 'Skip' }}</Button>
      </div>
      <div v-else class="flex items-center justify-end gap-2 w-full">
        <Button variant="ghost" label="Cancel" @click="$emit('update:modelValue', false)">Cancel</Button>
        <!-- the actions slot sits outside the <form>; `form` ties Save to it, so Enter in any field saves -->
        <Button variant="solid" theme="blue" label="Save" type="submit" :form="listId + '-form'" :loading="busy" :disabled="!canSave">Save</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { PLANNED, BREAK, AWAY_NATURES } from "../../stores/workBlockStore.js";
import ChoiceChips from "../common/ChoiceChips.vue";
import PlanTaskStep from "./PlanTaskStep.vue";
import DayTimeFields from "../common/DayTimeFields.vue";
import { taskMeta, toneClass } from "../../utils/taskMeta.js";
import { spanMins, whenLine } from "../../utils/clockTime.js";

let uid = 0;
// A swipe is a mostly sideways move of at least this many pixels
const SWIPE_PX = 48;

export default {
  name: "PlanWorkBlockDialog",
  components: { ChoiceChips, DayTimeFields, PlanTaskStep },
  props: {
    modelValue: { type: Boolean, default: false },
    form: { type: Object, required: true },
    busy: { type: Boolean, default: false },
    isManager: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
    taskOptions: { type: Array, default: () => [] },
    projectOptions: { type: Array, default: () => [] },
    partnerOptions: { type: Array, default: () => [] },
    assigneeOptions: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue", "submit"],
  data() {
    return {
      step: "details",
      fromDetails: false,
      query: "",
      // Rows ticked in the task step; committed to form.work_items on continue
      checked: [],
      // Adding keeps a new task already named in the form
      keepNew: false,
      touch: null,
      listId: "plan-task-list-" + (++uid),
    };
  },
  watch: {
    // Each opening starts fresh: the task step only when the caller asked for it
    modelValue: {
      immediate: true,
      handler(open) {
        if (!open) return;
        this.step = this.form.ask_task ? "task" : "details";
        this.fromDetails = false;
        this.query = "";
        this.checked = [];
        // Viewing your own calendar arrives as your user id; that is the "Your calendar" option
        if (this.form.assigned_employee && this.form.assigned_employee === this.currentUser) this.form.assigned_employee = "";
      },
    },
  },
  computed: {
    mode() {
      const n = this.form.nature;
      if (n === BREAK) return "break";
      return AWAY_NATURES.includes(n) ? "away" : "work";
    },
    // The kind chips are the activity (Work, Break, Away); planned or not is never picked,
    // a block made here is a plan. Each kind keeps its colour: work blue, break green, away amber
    modeOptions() {
      return [
        { label: "Work", value: "work", icon: "briefcase", tone: "blue" },
        { label: "Break", value: "break", icon: "coffee", tone: "green" },
        { label: "Away", value: "away", icon: "umbrella", tone: "amber" },
      ];
    },
    modeTone() {
      return { work: "blue", break: "green", away: "amber" }[this.mode];
    },
    titleLabel() {
      return { work: "Title", break: "Note", away: "Reason" }[this.mode];
    },
    titlePlaceholder() {
      return { work: "What will you work on?", break: "Optional", away: "Optional" }[this.mode];
    },
    whenLine() {
      return whenLine(this.form.work_date, this.form.start_time, this.form.end_time);
    },
    continueLabel() {
      return this.checked.length === 1 ? "Continue with 1 task" : `Continue with ${this.checked.length} tasks`;
    },
    durationMins() {
      return spanMins(this.form.start_time, this.form.end_time);
    },
    // The tasks the block is for, in order (the first is its main task), then a new one
    pickedRows() {
      const rows = this.form.work_items.map((ref) => {
        const t = this.taskOptions.find((o) => o.value === ref);
        const label = (t && t.label) || (ref === this.form.work_item && this.form.work_item_label) || ref;
        return { key: ref, ref, label, meta: t ? taskMeta(t) : [] };
      });
      if (this.form.new_task_subject) rows.push({ key: "__new", isNew: true, label: this.form.new_task_subject, meta: [] });
      return rows;
    },
    // Offered as the title only when the block is for exactly one task
    titleSuggestion() {
      if (this.mode !== "work" || this.pickedRows.length !== 1 || (this.form.deliverable_notes || "").trim()) return "";
      return this.pickedRows[0].label;
    },
    // Everyone but whoever's calendar this is
    peopleOptions() {
      const owner = this.form.assigned_employee;
      return this.partnerOptions.filter((p) => p.value && p.value !== owner);
    },
    peopleNames() {
      return this.form.people
        .map((v) => (this.partnerOptions.find((p) => p.value === v) || {}).label || v)
        .join(", ");
    },
    // "" is the planner's own calendar, shown by name so the field always reads as a person
    planForOptions() {
      const me = this.currentUser;
      const myName = (typeof window !== "undefined" && window.OMNITRACK_SESSION && window.OMNITRACK_SESSION.user_fullname) || me || "Me";
      return [
        { value: "", label: `${myName} (you)` },
        ...this.assigneeOptions.filter((o) => o.value && o.value !== me),
      ];
    },
    currentUser() {
      return (typeof window !== "undefined" && window.OMNITRACK_SESSION && window.OMNITRACK_SESSION.user) || "";
    },
    canSave() {
      if (this.busy || !this.form.work_date) return false;
      if (this.durationMins <= 0) return false;
      return this.mode !== "work" || !!((this.form.deliverable_notes || "").trim() || this.form.work_items.length || this.form.new_task_subject);
    },
    iconTone() { return this.isDarkMode ? "text-gray-300" : "text-gray-600"; },
    mutedText() { return this.isDarkMode ? "text-gray-300" : "text-gray-700"; },
    labelText() { return this.isDarkMode ? "text-gray-200" : "text-gray-800"; },
  },
  methods: {
    toneClass,
    fieldId(name) { return `${this.listId}-${name}`; },
    continueWithChecked() { this.commit(this.checked, ""); },
    commit(refs, newSubject) {
      const unique = [...new Set(refs.filter(Boolean))];
      // Adding to a block keeps what it already had; a fresh pick replaces it
      this.form.work_items = unique;
      this.form.work_item = unique[0] || "";
      this.form.new_task_subject = newSubject || (this.keepNew ? this.form.new_task_subject : "");
      this.checked = [];
      this.toDetails();
    },
    // The list unmounts, so focus moves to the title rather than falling to <body>
    toDetails() {
      this.step = "details";
      this.$nextTick(() => {
        const el = this.$refs.titleInput && this.$refs.titleInput.el;
        if (el) el.focus();
      });
    },
    // No task: what was typed becomes the block's name (unless it already has one)
    skipTask() {
      if (!this.fromDetails) this.clearTasks();
      const typed = this.query.trim();
      if (typed && !(this.fromDetails && (this.form.deliverable_notes || "").trim())) this.form.deliverable_notes = typed;
      this.toDetails();
    },
    clearTasks() {
      this.form.work_items = [];
      this.form.work_item = "";
      this.form.work_item_label = "";
      this.form.new_task_subject = "";
    },
    removePicked(row) {
      if (row.isNew) {
        this.form.new_task_subject = "";
      } else {
        this.form.work_items = this.form.work_items.filter((r) => r !== row.ref);
        this.form.work_item = this.form.work_items[0] || "";
        if (!this.form.work_item) this.form.work_item_label = "";
      }
    },
    // Back to the list from the form. `adding` keeps the current tasks ticked, so a pick adds
    // to them; with none there is nothing to keep. Back changes nothing.
    openTaskStep(adding) {
      this.fromDetails = true;
      this.keepNew = !!adding;
      this.query = "";
      this.checked = adding ? [...this.form.work_items] : [];
      this.step = "task";
      // once the list has mounted: focus its search, starting on the task already linked
      this.$nextTick(() => {
        if (this.$refs.taskStep) this.$refs.taskStep.focusOn(this.form.work_item);
      });
    },
    useSuggestion() {
      if (!this.titleSuggestion) return;
      this.form.deliverable_notes = this.titleSuggestion;
      const el = this.$refs.titleInput && this.$refs.titleInput.el;
      if (el) el.focus();
    },
    // Tab accepts the offered title once; with a title already there Tab moves on as usual
    onTitleKey(e) {
      if (e.key === "Tab" && !e.shiftKey && this.titleSuggestion) {
        e.preventDefault();
        this.useSuggestion();
      }
    },
    onTitleTouchStart(e) {
      const t = e.changedTouches && e.changedTouches[0];
      this.touch = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTitleTouchEnd(e) {
      const t = e.changedTouches && e.changedTouches[0];
      const from = this.touch;
      this.touch = null;
      if (!t || !from || !this.titleSuggestion) return;
      const dx = t.clientX - from.x, dy = t.clientY - from.y;
      if (dx >= SWIPE_PX && Math.abs(dy) < dx / 2) this.useSuggestion();
    },
    setMode(m) {
      if (m === this.mode) return;
      this.form.nature = m === "break" ? BREAK : m === "away" ? AWAY_NATURES[0] : PLANNED;
    },
  },
};
</script>
