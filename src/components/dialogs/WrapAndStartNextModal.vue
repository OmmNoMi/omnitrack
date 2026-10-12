<template>
  <f-dialog
    :model-value="modelValue"
    :title="title"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- A route of two stops, the way directions read: what stops and is saved, then what starts.
         From the Switch button the second stop is the question, picked in place: one dialog, never
         a list to pick from with a second dialog to confirm it. The log already holds what was
         done, so nothing is retyped; one last line, needed only when the log is too short to save. -->
    <ol class="text-sm" aria-label="Switch">
      <li class="relative flex gap-3 pb-5">
        <span class="absolute left-[5px] top-4 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600" aria-hidden="true"></span>
        <span class="relative mt-1 h-3 w-3 shrink-0 rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true"></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3 text-xs font-medium text-ink-gray-7">
            <span>Ends now and is saved</span>
            <span class="tabular-nums" :aria-label="'Running for ' + formattedTime">{{ formattedTime }}</span>
          </div>
          <div class="mt-0.5 text-base font-semibold text-ink-gray-9 break-words">{{ currentSessionLabel }}</div>
          <div class="text-xs text-ink-gray-7">{{ fromLine }}</div>
        </div>
      </li>
      <li v-if="pick || targetItem" class="flex gap-3">
        <span class="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-blue-700 bg-surface-modal dark:border-blue-400" aria-hidden="true"></span>
        <div class="min-w-0 flex-1">
          <template v-if="pick">
            <label for="switch-to" class="block mb-1 text-xs font-medium text-ink-gray-7">Starts now</label>
            <Combobox
              id="switch-to"
              open-on-click
              variant="outline"
              size="md"
              :model-value="pickedValue"
              :options="pickOptions"
              placeholder="Pick a block or task"
              empty-text="Nothing planned or assigned"
              :data-autofocus="focusOn === 'pick' ? '' : null"
              @update:model-value="onPick"
            />
          </template>
          <template v-else>
            <div class="text-xs font-medium text-ink-gray-7">Starts now</div>
            <div class="mt-0.5 text-base font-semibold text-ink-gray-9 break-words">{{ targetItem.label }}</div>
          </template>
          <div v-if="toLine" class="mt-0.5 text-xs text-ink-gray-7">{{ toLine }}</div>
        </div>
      </li>
    </ol>

    <div>
      <label for="wrap-last-line" class="block mb-1 text-sm font-medium text-ink-gray-8">Last line for the log</label>
      <TextInput
        id="wrap-last-line"
        v-model="internalWrapUpNote"
        variant="outline"
        size="md"
        :placeholder="enoughWords ? 'Optional' : 'What did you do?'"
        aria-describedby="wrap-last-line-hint"
        autocomplete="off"
        :data-autofocus="focusOn === 'line' ? '' : null"
      />
      <p id="wrap-last-line-hint" class="mt-1 text-xs" :class="enoughWords ? 'text-ink-gray-7' : 'text-amber-800 dark:text-amber-200'">
        <template v-if="enoughWords">Added to the log before it is saved.</template>
        <template v-else>Describe what you did in at least {{ minWords }} words (you wrote {{ wordsNow }}).</template>
      </p>
    </div>

    <p v-if="error" role="alert" class="text-sm text-ink-red-4">Not switched, the session is still running. {{ error }}</p>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button variant="ghost" label="Keep working" @click="$emit('update:modelValue', false)" />
        <Button
          variant="solid"
          theme="blue"
          class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white"
          label="Switch"
          data-switch
          :data-autofocus="focusOn === 'switch' ? '' : null"
          :loading="isSwitching"
          :disabled="!canSwitch"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { clock, toMin } from "../../utils/clockTime.js";
import { countSessionWords } from "../../utils/sessionWords.js";

const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;
const valueOf = (t) => (t ? (t.is_block ? "block:" : "task:") + t.name : null);

export default {
  name: "WrapAndStartNextModal",
  props: {
    modelValue: { type: Boolean, default: false },
    formattedTime: { type: String, default: "00:00:00" },
    currentSessionLabel: { type: String, default: "Current session" },
    currentLogCount: { type: Number, default: 0 },
    selectedProject: { type: String, default: "" },
    wrapUpNote: { type: String, default: "" },
    targetItem: { type: Object, default: null },
    isSwitching: { type: Boolean, default: false },
    // Opened from the Switch button: what starts is picked here
    pick: { type: Boolean, default: false },
    candidates: { type: Array, default: () => [] },
    // Words the session is saved with before the last line, and how many a saved session needs
    logWords: { type: Number, default: 0 },
    minWords: { type: Number, default: 15 },
    // Why the server refused the switch; the session is still running
    error: { type: String, default: "" },
  },
  emits: ["update:modelValue", "update:wrapUpNote", "pick", "confirm"],
  computed: {
    internalWrapUpNote: {
      get() {
        return this.wrapUpNote;
      },
      set(val) {
        this.$emit("update:wrapUpNote", val);
      },
    },
    // Fixed while the dialog is open, so it does not change under the person once they pick
    title() {
      if (this.pick) return "What are you switching to?";
      return this.targetItem && !this.targetItem.is_block ? "Start the next task?" : "Start the next block?";
    },
    wordsNow() {
      return this.logWords + countSessionWords(this.wrapUpNote);
    },
    enoughWords() {
      return this.wordsNow >= this.minWords;
    },
    canSwitch() {
      return !!this.targetItem && this.enoughWords && !this.isSwitching;
    },
    // Focus starts where the work is: the open question, then a log too short to save, then Switch
    focusOn() {
      if (this.pick && !this.targetItem) return "pick";
      return this.enoughWords ? "switch" : "line";
    },
    pickedValue() {
      return valueOf(this.targetItem);
    },
    pickOptions() {
      const option = (t) => ({ label: t.label, value: valueOf(t), description: this.details(t) });
      const blocks = this.candidates.filter((t) => t.is_block).map(option);
      const tasks = this.candidates.filter((t) => !t.is_block).map(option);
      return [
        blocks.length && { group: "Planned today", options: blocks },
        tasks.length && { group: "Your tasks", options: tasks },
      ].filter(Boolean);
    },
    // Only what is worth knowing: how much is in the log, and for whom.
    fromLine() {
      const n = this.currentLogCount;
      return [n ? plural(n, "line") + " in the log" : "Nothing in the log yet", this.selectedProject].filter(Boolean).join(" · ");
    },
    toLine() {
      return this.targetItem ? this.details(this.targetItem, "Planned ") : "";
    },
  },
  methods: {
    // A planned block says when it was planned for, in the clock people read; then its project.
    details(t, lead = "") {
      const when = t.start_time && t.end_time
        ? `${lead}${clock(toMin(t.start_time))} – ${clock(toMin(t.end_time))}`
        : "";
      return [when, t.project ? t.project_name || t.project : ""].filter(Boolean).join(" · ");
    },
    onPick(value) {
      const t = this.candidates.find((c) => valueOf(c) === value);
      if (t) this.$emit("pick", t);
    },
  },
};
</script>
