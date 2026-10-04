<template>
  <f-dialog
    :model-value="modelValue"
    title="Plan Focus Block"
    subtitle="Schedule dedicated time to protect your focus and deliver results"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- What will you focus on -->
      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
          What will you focus on? <span class="text-rose-500">*</span>
        </label>
        <f-input
          size="md"
          v-model="newTaskForm.notes"
          placeholder="e.g. Website Timetable & Dynamic Branch Configuration"
          aria-label="What will you focus on"
        ></f-input>
      </div>

      <!-- Project & Task Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Project</label>
          <f-combobox
            v-model="newTaskForm.project"
            :options="comboboxProjectOptions"
            placeholder="Select project..."
            search-placeholder="Search projects..."
            aria-label="Project"
          ></f-combobox>
        </div>

        <div>
          <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Task (Optional)</label>
          <f-combobox
            v-model="newTaskForm.task"
            :options="comboboxTaskOptions"
            placeholder="Link to task (optional)..."
            search-placeholder="Search tasks..."
            aria-label="Task"
          ></f-combobox>
        </div>
      </div>

      <!-- Schedule & Time Window Card -->
      <div class="p-3.5 rounded-2xl border" :class="isDarkMode ? 'bg-[#25272B] border-gray-800' : 'bg-gray-50/80 border-gray-200'">
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <span class="font-bold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Schedule & Time Window</span>
          <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
            {{ newTaskForm.duration ? newTaskForm.duration.toFixed(1) : '1.0' }}h duration
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label class="block text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">Date</label>
            <input 
              type="date" 
              v-model="newTaskForm.date" 
              class="w-full rounded-xl px-2.5 py-2 outline-none border transition-colors text-xs font-mono" 
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'">
          </div>

          <div>
            <label class="block text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">Start Time</label>
            <input 
              type="time" 
              v-model="newTaskForm.startTime" 
              @change="onTimeChange"
              class="w-full rounded-xl px-2.5 py-2 outline-none border transition-colors text-xs font-mono" 
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'">
          </div>

          <div>
            <label class="block text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">End Time</label>
            <input 
              type="time" 
              v-model="newTaskForm.endTime" 
              @change="onTimeChange"
              class="w-full rounded-xl px-2.5 py-2 outline-none border transition-colors text-xs font-mono" 
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'">
          </div>
        </div>

        <!-- Quick Duration Chips -->
        <div class="flex items-center gap-1.5 pt-2.5 flex-wrap">
          <span class="text-[10px] text-gray-400 mr-1">Quick presets:</span>
          <button
            v-for="dur in [0.5, 1, 1.5, 2, 3, 4]"
            :key="dur"
            type="button"
            @click="setDurationPreset(dur)"
            class="px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer select-none active:scale-95"
            :class="newTaskForm.duration === dur ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : (isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100')">
            {{ dur >= 1 ? (dur % 1 === 0 ? dur + 'h' : dur + 'h') : '30m' }}
          </button>
        </div>
      </div>

      <!-- Work Nature Chips -->
      <div>
        <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Work Nature</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button 
            v-for="opt in natureOptions" 
            :key="opt.id"
            type="button"
            @click="newTaskForm.nature = opt.label"
            class="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer select-none active:scale-95"
            :class="newTaskForm.nature === opt.label ? (isDarkMode ? opt.darkActiveClass : opt.lightActiveClass) : (isDarkMode ? 'bg-[#2A2A2A] border-[#3A3A3A] text-gray-400 hover:bg-[#333333]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100')">
            <span v-html="opt.svgIcon" class="w-3.5 h-3.5 flex items-center justify-center"></span>
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </div>

      <!-- Assignee / Team Member (if multiple members) -->
      <div v-if="teamMembers && teamMembers.length > 1">
        <label class="block font-bold mb-1 flex items-center justify-between" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
          <span>Assignee (Team Member)</span>
          <span class="text-[10px] text-gray-400">Defaults to you</span>
        </label>
        <f-combobox
          v-model="newTaskForm.assignee"
          :options="comboboxAssigneeOptions"
          placeholder="Select team member..."
          search-placeholder="Search team member..."
          aria-label="Assign To Team Member"
        ></f-combobox>
      </div>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-3 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">
          Cancel
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="$emit('submit')">
          <template #prefix>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          </template>
          Schedule Focus Block
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "PlanFocusBlockModal",
  props: {
    modelValue: { type: Boolean, default: false },
    newTaskForm: { type: Object, required: true },
    comboboxProjectOptions: { type: Array, default: () => [] },
    comboboxTaskOptions: { type: Array, default: () => [] },
    comboboxAssigneeOptions: { type: Array, default: () => [] },
    teamMembers: { type: Array, default: () => [] },
    natureOptions: { type: Array, default: () => [] },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "submit", "time-change", "duration-preset"],
  methods: {
    onTimeChange() {
      this.$emit("time-change");
    },
    setDurationPreset(dur) {
      this.$emit("duration-preset", dur);
    },
  },
};
</script>
