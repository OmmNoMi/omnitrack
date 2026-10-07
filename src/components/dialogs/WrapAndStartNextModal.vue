<template>
  <f-dialog
    :model-value="modelValue"
    :title="targetItem && !targetItem.is_block ? 'Start the next task?' : 'Start the next block?'"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- A route of two stops, the way directions read: what stops and is saved, then what starts.
         The log already holds what was done, so nothing is retyped; one optional last line. -->
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
      <li v-if="targetItem" class="flex gap-3">
        <span class="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-blue-700 bg-surface-modal dark:border-blue-400" aria-hidden="true"></span>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-ink-gray-7">Starts now</div>
          <div class="mt-0.5 text-base font-semibold text-ink-gray-9 break-words">{{ targetItem.label }}</div>
          <div v-if="toLine" class="text-xs text-ink-gray-7">{{ toLine }}</div>
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
        placeholder="Optional"
        aria-describedby="wrap-last-line-hint"
        autocomplete="off"
      />
      <p id="wrap-last-line-hint" class="mt-1 text-xs text-ink-gray-7">Added to the log before it is saved.</p>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button variant="ghost" label="Keep working" @click="$emit('update:modelValue', false)" />
        <Button
          variant="solid"
          theme="blue"
          class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800"
          label="Switch"
          data-autofocus
          :loading="isSwitching"
          :disabled="isSwitching"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { clock, toMin } from "../../utils/clockTime.js";

const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;

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
  },
  emits: ["update:modelValue", "update:wrapUpNote", "confirm"],
  computed: {
    internalWrapUpNote: {
      get() {
        return this.wrapUpNote;
      },
      set(val) {
        this.$emit("update:wrapUpNote", val);
      },
    },
    // Only what is worth knowing: how much is in the log, and for whom.
    fromLine() {
      const n = this.currentLogCount;
      return [n ? plural(n, "line") + " in the log" : "Nothing in the log yet", this.selectedProject].filter(Boolean).join(" · ");
    },
    // A planned block says when it was planned for, in the clock people read.
    toLine() {
      const t = this.targetItem;
      if (!t) return "";
      const when = t.start_time && t.end_time
        ? `Planned ${clock(toMin(t.start_time))} – ${clock(toMin(t.end_time))}`
        : "";
      return [when, t.project ? t.project_name || t.project : ""].filter(Boolean).join(" · ");
    },
  },
};
</script>
