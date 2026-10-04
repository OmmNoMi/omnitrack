<template>
  <f-dialog
    :model-value="modelValue"
    title="Edit Logged Work Session"
    subtitle="Fine-tune start/end times and deliverable notes"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- Session Date -->
      <div>
        <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Session Date</label>
        <input
          type="date"
          v-model="editForm.session_date"
          class="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-blue-500"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'"
        />
      </div>

      <!-- Start and End Time -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
          <input
            type="time"
            v-model="editForm.from_time"
            class="w-full px-3 py-2 rounded-xl border font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'"
          />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">End Time</label>
          <input
            type="time"
            v-model="editForm.to_time"
            class="w-full px-3 py-2 rounded-xl border font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'"
          />
        </div>
      </div>

      <!-- Calculated Duration Badge -->
      <div
        class="flex items-center justify-between p-2.5 rounded-xl border"
        :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-gray-50 border-gray-200'"
      >
        <span class="text-gray-500 dark:text-gray-400 font-medium">Calculated Duration</span>
        <span class="font-mono font-bold text-emerald-500 text-sm">{{ durationHours }}h</span>
      </div>

      <!-- Notes / Bullets -->
      <div>
        <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Session Deliverables &amp; Notes</label>
        <textarea
          v-model="editForm.notes"
          rows="4"
          placeholder="Update deliverables or bullet notes for this session..."
          class="w-full p-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'"
        ></textarea>
      </div>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">
          Cancel
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" :loading="isSaving" @click="$emit('save')">
          Save Changes
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "EditSessionModal",
  props: {
    modelValue: { type: Boolean, default: false },
    editForm: { type: Object, required: true },
    durationHours: { type: [Number, String], default: "0.0" },
    isSaving: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "save"],
};
</script>
