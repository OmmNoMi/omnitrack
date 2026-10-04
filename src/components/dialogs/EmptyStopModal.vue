<template>
  <f-dialog
    :model-value="modelValue"
    title="End Focus Session"
    subtitle="No bullet notes recorded yet"
    size="sm"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-3 py-1">
      <p class="text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-600'">
        You haven't added any bullet notes to this session. What would you like to do with this elapsed time?
      </p>
      <div class="block space-y-1">
        <label class="text-[11px] font-bold" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
          Quick Note (used for Timesheet description):
        </label>
        <input
          v-model="internalQuickNote"
          type="text"
          placeholder="e.g. Focus work session"
          class="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'"
          @keydown.enter.prevent="$emit('save')"
        />
      </div>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <f-button
          variant="outline"
          theme="gray"
          size="sm"
          @click="$emit('discard')"
        >
          Discard (No Timesheet)
        </f-button>
        <f-button
          variant="solid"
          theme="blue"
          size="sm"
          @click="$emit('save')"
        >
          Save &amp; Log ({{ formattedHours }}h)
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "EmptyStopModal",
  props: {
    modelValue: { type: Boolean, default: false },
    quickNote: { type: String, default: "" },
    elapsedHours: { type: Number, default: 0 },
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
    formattedHours() {
      const n = Number(this.elapsedHours) || 0;
      return n.toFixed(1);
    },
  },
};
</script>
