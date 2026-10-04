<template>
  <f-dialog
    :model-value="modelValue"
    :title="bookForm.mode === 'work' ? 'Book a work block' : 'Mark time away'"
    size="sm"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-3">
      <div class="flex gap-1.5">
        <button
          v-for="m in [['work','🎯 Work'],['break','☕ Break'],['🌴 Leave','🌴 Leave']]"
          :key="m[0]"
          type="button"
          @click="bookForm.mode = m[0]"
          class="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer transition-colors"
          :class="bookForm.mode === m[0] ? (isDarkMode ? 'bg-blue-950/80 border-blue-600 text-blue-200' : 'bg-blue-50 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600')"
        >
          {{ m[1] }}
        </button>
      </div>

      <!-- Quick Date Presets -->
      <div class="flex items-center justify-between gap-1 pt-1">
        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Date:</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            @click="setDatePreset(0)"
            class="text-[10px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors"
            :class="isDateActive(0) ? (isDarkMode ? 'bg-blue-900 border-blue-600 text-white' : 'bg-blue-100 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700')"
          >
            Today
          </button>
          <button
            type="button"
            @click="setDatePreset(1)"
            class="text-[10px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors"
            :class="isDateActive(1) ? (isDarkMode ? 'bg-blue-900 border-blue-600 text-white' : 'bg-blue-100 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700')"
          >
            Tomorrow
          </button>
          <button
            type="button"
            @click="setDatePreset(2)"
            class="text-[10px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors"
            :class="isDateActive(2) ? (isDarkMode ? 'bg-blue-900 border-blue-600 text-white' : 'bg-blue-100 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700')"
          >
            +2 Days
          </button>
        </div>
      </div>

      <!-- Assign To Employee (Managers / Reporting Officers) -->
      <div v-if="isManager" class="block space-y-1">
        <label class="text-[11px] font-bold text-gray-500 flex items-center justify-between">
          <span>👤 Assign To Employee</span>
          <span class="text-[10px] font-normal text-blue-500">Direct Manager Scheduling</span>
        </label>
        <f-combobox
          v-model="bookForm.assigned_employee"
          :options="comboboxAssigneeOptions"
          placeholder="— Assign to Myself —"
          search-placeholder="Search teammate..."
          aria-label="Assign to Employee"
        ></f-combobox>
      </div>

      <div v-if="bookForm.mode === 'work'" class="block space-y-1">
        <label class="text-[11px] font-bold text-gray-500">Task / work item</label>
        <f-combobox
          v-model="bookForm.work_item"
          :options="comboboxBookTaskOptions"
          placeholder="— Ad-hoc (no linked task) —"
          search-placeholder="Search task by title or project..."
          aria-label="Task or work item"
        ></f-combobox>
      </div>

      <!-- Collaborative Pairing Partner (Reciprocal Mirroring) -->
      <div v-if="bookForm.mode === 'work'" class="block space-y-1">
        <label class="text-[11px] font-bold text-gray-500 flex items-center justify-between">
          <span>👥 Collaborative Pairing Partner (optional)</span>
          <span class="text-[10px] font-normal text-blue-500">Auto-mirrors block &amp; session</span>
        </label>
        <f-combobox
          v-model="bookForm.pairing_partner"
          :options="comboboxPairingPartnerOptions"
          placeholder="— Solo Session (No pairing) —"
          search-placeholder="Search teammate..."
          aria-label="Pairing partner"
        ></f-combobox>
      </div>

      <!-- Full detail of the picked task -->
      <div
        v-if="bookForm.mode === 'work' && bookFormTask"
        class="rounded-xl border px-3 py-2 space-y-1"
        :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'"
      >
        <div
          class="text-xs font-bold leading-snug break-words"
          :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'"
        >
          {{ bookFormTask.subject }}
        </div>
        <div
          class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]"
          :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'"
        >
          <span v-if="bookFormTask.project_name || bookFormTask.project">📁 {{ bookFormTask.project_name || bookFormTask.project }}</span>
          <span v-if="bookFormTask.priority">· {{ bookFormTask.priority }}</span>
          <span v-if="bookFormTask.due_date">· due {{ bookFormTask.due_date }}</span>
          <span v-if="bookFormTask.status">· {{ bookFormTask.status }}</span>
        </div>
        <!-- Task KPI Progress -->
        <div v-if="bookFormTask.kpi_target" class="py-1">
          <div class="flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span>🎯 KPI Target: {{ bookFormTask.kpi_name || 'Deliverable' }}</span>
            <span>{{ bookFormTask.kpi_completed || 0 }} / {{ bookFormTask.kpi_target }} {{ bookFormTask.kpi_unit }} ({{ bookFormTask.kpi_progress || 0 }}%)</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              class="bg-emerald-500 h-full rounded-full transition-all"
              :style="{ width: Math.min(bookFormTask.kpi_progress || 0, 100) + '%' }"
            ></div>
          </div>
        </div>
        <div
          class="flex flex-wrap items-center gap-x-2 text-[11px]"
          :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'"
        >
          <span>planned <b :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ fmtHrs(bookFormTask.booked_hours) }}h</b></span>
          <span>· logged <b class="text-emerald-500">{{ fmtHrs(bookFormTask.logged_hours) }}h</b></span>
          <span>· expected <b :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ fmtHrs(bookFormTask.estimate_hours) }}h</b></span>
        </div>
        <div
          v-if="bookFormTask.description"
          class="text-[11px] leading-snug break-words max-h-24 overflow-y-auto"
          :class="isDarkMode ? 'text-gray-400' : 'text-gray-600'"
        >
          {{ bookFormTask.description }}
        </div>
      </div>

      <!-- Date & Time -->
      <div v-if="bookForm.mode === 'work' || bookForm.mode === 'break'" class="grid grid-cols-3 gap-2">
        <label class="block col-span-1">
          <span class="text-[11px] font-bold text-gray-500">Date</span>
          <input
            type="date"
            v-model="bookForm.work_date"
            class="mt-1 w-full text-sm rounded-xl px-2 py-2 border outline-none"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"
          />
        </label>
        <label class="block col-span-1">
          <span class="text-[11px] font-bold text-gray-500">Start</span>
          <input
            type="time"
            v-model="bookForm.start_time"
            class="mt-1 w-full text-sm rounded-xl px-2 py-2 border outline-none"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"
          />
        </label>
        <label class="block col-span-1">
          <span class="text-[11px] font-bold text-gray-500">End</span>
          <input
            type="time"
            v-model="bookForm.end_time"
            class="mt-1 w-full text-sm rounded-xl px-2 py-2 border outline-none"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"
          />
        </label>
      </div>
      <div v-else class="space-y-1">
        <label class="block">
          <span class="text-[11px] font-bold text-gray-500">Date</span>
          <input
            type="date"
            v-model="bookForm.work_date"
            class="mt-1 w-full text-sm rounded-xl px-3 py-2 border outline-none"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"
          />
        </label>
        <div class="text-[11px] text-gray-400 pl-0.5">Recorded as an all-day leave event on the calendar banner.</div>
      </div>
      <label class="block">
        <span class="text-[11px] font-bold text-gray-500">Notes (optional)</span>
        <input
          type="text"
          v-model="bookForm.deliverable_notes"
          :placeholder="bookForm.mode === 'work' ? 'What will you get done?' : (bookForm.mode === 'break' ? 'Short break details' : 'Reason / coverage details')"
          class="mt-1 w-full text-sm rounded-xl px-3 py-2 border outline-none"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"
        />
      </label>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">Cancel</f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="$emit('submit')" :disabled="plannerBusy">
          {{ bookForm.mode === 'work' ? 'Book block' : 'Mark away' }}
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "BookWorkBlockModal",
  props: {
    modelValue: { type: Boolean, default: false },
    bookForm: { type: Object, required: true },
    bookFormTask: { type: Object, default: null },
    isManager: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
    plannerBusy: { type: Boolean, default: false },
    comboboxAssigneeOptions: { type: Array, default: () => [] },
    comboboxBookTaskOptions: { type: Array, default: () => [] },
    comboboxPairingPartnerOptions: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue", "submit"],
  methods: {
    fmtHrs(val) {
      const n = Number(val) || 0;
      return n.toFixed(1);
    },
    getDateOffsetISO(offsetDays) {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    setDatePreset(offsetDays) {
      this.bookForm.work_date = this.getDateOffsetISO(offsetDays);
    },
    isDateActive(offsetDays) {
      return this.bookForm.work_date === this.getDateOffsetISO(offsetDays);
    },
  },
};
</script>
