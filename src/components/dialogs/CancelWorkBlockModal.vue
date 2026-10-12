<template>
  <!-- One question; the buttons are the answers. Nothing is picked for the person: the reason
       goes on the block's record, so Cancel block waits until they choose one. A block that is
       recording is not offered here (isBlockCancellable): its session is stopped and saved first. -->
  <f-dialog
    :model-value="modelValue"
    title="Cancel this block?"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div v-if="targetBlock" class="space-y-4">
      <div>
        <div class="text-base font-semibold text-ink-gray-9 break-words">{{ blockTitle(targetBlock) }}</div>
        <div class="text-sm text-ink-gray-7 tabular-nums">{{ whenLine }}</div>
      </div>

      <div>
        <label for="cancel-reason" class="block mb-1 text-sm font-medium text-ink-gray-8">Reason</label>
        <Combobox
          id="cancel-reason"
          open-on-click
          variant="outline"
          size="md"
          :model-value="cancelForm.reason || null"
          :options="reasons"
          placeholder="Pick a reason"
          data-autofocus
          @update:model-value="setReason"
        />
      </div>

      <div>
        <label for="cancel-note" class="block mb-1 text-sm font-medium text-ink-gray-8">Note <span class="font-normal text-ink-gray-7">(optional)</span></label>
        <Textarea
          id="cancel-note"
          variant="outline"
          size="md"
          :rows="2"
          :model-value="cancelForm.notes"
          placeholder="Added to the block's activity"
          @update:model-value="setNote"
        />
      </div>

      <p v-if="error" role="alert" class="text-sm text-ink-red-4">Not cancelled. {{ error }}</p>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button variant="ghost" label="Keep block" @click="$emit('update:modelValue', false)" />
        <Button
          variant="solid"
          theme="red"
          label="Cancel block"
          :loading="busy"
          :disabled="!cancelForm.reason || busy"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { blockTitle } from "../../utils/blockTitle.js";
import { clock, toMin } from "../../utils/clockTime.js";

export default {
  name: "CancelWorkBlockModal",
  props: {
    modelValue: { type: Boolean, default: false },
    targetBlock: { type: Object, default: null },
    cancelForm: { type: Object, required: true },
    reasons: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    // Why the server refused; the block is as it was
    error: { type: String, default: "" },
  },
  emits: ["update:modelValue", "confirm"],
  computed: {
    whenLine() {
      const b = this.targetBlock;
      if (!b) return "";
      const [y, m, d] = String(b.work_date || "").split("-").map(Number);
      const day = y ? new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";
      const span = b.start_time && b.end_time ? `${clock(toMin(b.start_time))} – ${clock(toMin(b.end_time))}` : "";
      return [day, span].filter(Boolean).join(" · ");
    },
  },
  methods: {
    blockTitle,
    setReason(v) {
      this.cancelForm.reason = (v && typeof v === "object" ? v.value : v) || "";
    },
    setNote(v) {
      this.cancelForm.notes = v || "";
    },
  },
};
</script>
