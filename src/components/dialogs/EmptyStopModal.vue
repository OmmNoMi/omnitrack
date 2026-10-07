<template>
  <!-- Stop opens this when the session's title and log hold fewer words than a saved session
       needs (OmniTrack Settings > Minimum Words per Session). It is asked before the clock
       stops, so closing it leaves the session running with nothing lost. Save stays off until
       there are enough words; nothing is ever filled in for the person. -->
  <f-dialog
    :model-value="modelValue"
    title="Describe this session"
    size="sm"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form class="space-y-2 py-1" @submit.prevent="save">
      <Textarea
        v-model="internalQuickNote"
        variant="outline"
        size="md"
        :rows="3"
        label="What did you get done?"
        :placeholder="'At least ' + minWords + ' words in all. Ctrl+Enter saves.'"
        class="[&_textarea]:resize-none"
        aria-describedby="empty-stop-count"
        data-autofocus
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      />
      <p id="empty-stop-count" class="text-sm tabular-nums" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'" aria-live="polite">
        {{ totalWords }} of {{ minWords }} words<template v-if="loggedWords"> ({{ loggedWords }} already in the log)</template>
      </p>
    </form>

    <template #actions>
      <div class="flex flex-wrap items-center justify-end gap-2 w-full">
        <!-- Only a session with nothing written can be thrown away from here -->
        <Button v-if="!loggedWords" variant="ghost" theme="red" size="sm" class="sm:mr-auto !text-red-700 dark:!text-red-300" label="Discard session" @click="$emit('discard')" />
        <Button variant="outline" theme="gray" size="sm" label="Keep running" @click="$emit('update:modelValue', false)" />
        <Button variant="solid" theme="blue" size="sm" :label="'Save ' + formattedHours + 'h'" :disabled="!enough" @click="save" />
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { countSessionWords } from "../../utils/sessionWords.js";

export default {
  name: "EmptyStopModal",
  props: {
    modelValue: { type: Boolean, default: false },
    quickNote: { type: String, default: "" },
    elapsedHours: { type: Number, default: 0 },
    loggedWords: { type: Number, default: 0 },
    minWords: { type: Number, default: 15 },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "update:quickNote", "save", "discard"],
  computed: {
    internalQuickNote: {
      get() {
        return this.quickNote;
      },
      set(val) {
        this.$emit("update:quickNote", val);
      },
    },
    totalWords() {
      return this.loggedWords + countSessionWords(this.quickNote);
    },
    enough() {
      return this.totalWords >= this.minWords;
    },
    formattedHours() {
      const n = Number(this.elapsedHours) || 0;
      return n.toFixed(1);
    },
  },
  methods: {
    save() {
      if (this.enough) this.$emit("save");
    },
  },
};
</script>
