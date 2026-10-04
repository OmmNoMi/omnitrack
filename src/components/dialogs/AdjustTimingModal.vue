<template>
  <f-dialog
    :model-value="modelValue"
    title="Adjust Timesheet Timing"
    :subtitle="isTracking ? 'Fine-tune ongoing session start time or conclude and log to timesheet' : 'Backdate or record a past focus session window'"
    size="md"
    z-index="z-[75]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </template>

    <!-- Mode Selector Tabs (only when actively tracking) -->
    <div v-if="isTracking" class="p-1 rounded-2xl bg-gray-100 dark:bg-[#161618] border border-gray-200/80 dark:border-gray-800 flex items-center gap-1">
      <button
        type="button"
        @click="internalMode = 'keep_running'; adjustMode = 'keep_running'"
        class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        :class="internalMode === 'keep_running' ? 'bg-white dark:bg-[#25272B] text-blue-600 dark:text-blue-400 shadow-xs font-black' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Fix Start Time (Keep Running)</span>
      </button>
      <button
        type="button"
        @click="internalMode = 'stop_and_log'; adjustMode = 'stop_and_log'"
        class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        :class="internalMode === 'stop_and_log' ? 'bg-white dark:bg-[#25272B] text-emerald-600 dark:text-emerald-400 shadow-xs font-black' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
        <span>Stop & Log to Timesheet</span>
      </button>
    </div>

    <!-- MODE A: FIX START TIME (KEEP RUNNING) -->
    <div v-if="isTracking && internalMode === 'keep_running'" class="space-y-4 text-xs">
      <div
        class="p-4 rounded-2xl border flex items-center justify-between transition-colors"
        :class="isDarkMode ? 'bg-blue-950/20 border-blue-900/50' : 'bg-blue-50/60 border-blue-100'"
      >
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span class="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">Live Stopwatch Preview</span>
          </div>
          <div class="text-xl sm:text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
            {{ keepRunningElapsedFormatted }}
          </div>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">
            Stopwatch will seamlessly continue ticking up with this adjusted duration.
          </p>
        </div>
        <f-badge theme="blue" variant="subtle" size="sm">▶ Active</f-badge>
      </div>

      <!-- Start Date -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="font-bold text-gray-700 dark:text-gray-300">Session Start Date *</label>
          <span v-if="!isManager" class="text-[10px] text-gray-400">Allowed: Today &amp; Yesterday</span>
        </div>
        <div class="relative flex items-center">
          <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <input
            type="date"
            v-model="adjustForm.work_date"
            :min="minTimesheetDate"
            :max="todayDate"
            class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
          />
        </div>
      </div>

      <!-- Start Time (From) + Quick Nudge Chips -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-gray-700 dark:text-gray-300">Corrected Start Time (From) *</label>
          <span v-if="originalStartTimeFormatted" class="text-[11px] font-mono text-gray-400">Originally recorded: {{ originalStartTimeFormatted }}</span>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="relative flex-1 flex items-center">
            <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              step="60"
              v-model="adjustForm.from_time"
              class="w-full pl-10 pr-3.5 py-2 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
            />
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <f-button size="xs" variant="subtle" theme="gray" @click="$emit('nudge', 'from', -30)" title="Started 30m earlier">-30m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="$emit('nudge', 'from', -15)" title="Started 15m earlier">-15m</f-button>
            <f-button size="xs" variant="subtle" theme="blue" @click="$emit('nudge', 'from', -5)" title="Started 5m earlier">-5m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="$emit('nudge', 'from', 5)" title="Started 5m later">+5m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="$emit('nudge', 'from', 15)" title="Started 15m later">+15m</f-button>
          </div>
        </div>
      </div>

      <!-- Notes / Activity Log -->
      <div class="space-y-1.5">
        <label class="block font-bold text-gray-700 dark:text-gray-300">Live Notes / Activity Description</label>
        <textarea
          v-model="adjustForm.notes"
          rows="3"
          placeholder="Update or add bullets to your current session notes..."
          class="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
        ></textarea>
      </div>
    </div>

    <!-- MODE B: STOP & LOG TO TIMESHEET (OR WHEN NOT TRACKING) -->
    <div v-else class="space-y-4 text-xs">
      <div
        class="p-4 rounded-2xl border flex items-center justify-between transition-colors"
        :class="adjustDurationMinutes > 0 ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50/60 border-emerald-100') : (isDarkMode ? 'bg-rose-950/20 border-rose-900/50' : 'bg-rose-50/60 border-rose-100')"
      >
        <div class="space-y-0.5">
          <div
            class="text-[10px] uppercase font-bold tracking-wider"
            :class="adjustDurationMinutes > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
          >
            Calculated Duration
          </div>
          <div
            class="text-xl sm:text-2xl font-black font-mono tracking-tight"
            :class="adjustDurationMinutes > 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ adjustDurationFormatted }}
          </div>
          <div class="text-[11px] text-gray-500 dark:text-gray-400">
            {{ isTracking ? 'Clock will stop and write this window directly to your timesheet.' : 'Will be recorded to your timesheet.' }}
          </div>
        </div>
        <f-badge :theme="adjustDurationMinutes > 0 ? 'green' : 'red'" variant="subtle" size="sm">
          {{ adjustDurationMinutes > 0 ? '✓ Valid Duration' : 'Invalid Range' }}
        </f-badge>
      </div>

      <!-- Session Date -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="font-bold text-gray-700 dark:text-gray-300">Session Date *</label>
          <span v-if="!isManager" class="text-[10px] text-gray-400">Allowed: Today &amp; Yesterday</span>
        </div>
        <div class="relative flex items-center">
          <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <input
            type="date"
            v-model="adjustForm.work_date"
            :min="minTimesheetDate"
            :max="todayDate"
            class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
          />
        </div>
      </div>

      <!-- Start Time (From) -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-gray-700 dark:text-gray-300">Start Time (From) *</label>
          <span class="text-[10px] text-gray-400 font-semibold">Quick adjust</span>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="relative flex-1 flex items-center">
            <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              step="60"
              v-model="adjustForm.from_time"
              class="w-full pl-10 pr-3.5 py-2 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
            />
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <f-button size="xs" variant="subtle" theme="gray" @click="$emit('nudge', 'from', -15)" title="Started 15m earlier">-15m</f-button>
            <f-button size="xs" variant="subtle" theme="blue" @click="$emit('nudge', 'from', -5)" title="Started 5m earlier">-5m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="$emit('nudge', 'from', 5)" title="Started 5m later">+5m</f-button>
          </div>
        </div>
      </div>

      <!-- End Time (To) -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-gray-700 dark:text-gray-300">End Time (To) *</label>
          <span class="text-[10px] text-gray-400 font-semibold">Quick adjust</span>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="relative flex-1 flex items-center">
            <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              step="60"
              v-model="adjustForm.to_time"
              class="w-full pl-10 pr-3.5 py-2 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
            />
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <f-button size="xs" variant="subtle" theme="gray" @click="$emit('nudge', 'to', -5)" title="Finished 5m earlier">-5m</f-button>
            <f-button size="xs" variant="subtle" theme="blue" @click="$emit('nudge', 'to', 5)" title="Finished 5m later">+5m</f-button>
            <f-button size="xs" variant="subtle" theme="green" @click="$emit('set-end-now')" title="Set End Time to Right Now">Now</f-button>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="space-y-1.5">
        <label class="block font-bold text-gray-700 dark:text-gray-300">Notes / Activity Log *</label>
        <textarea
          v-model="adjustForm.notes"
          rows="3"
          placeholder="What did you work on during this period? (bullets recommended)"
          class="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
        ></textarea>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #actions>
      <div class="flex items-center justify-between gap-3 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">
          Cancel
        </f-button>
        
        <f-button
          v-if="isTracking && internalMode === 'keep_running'"
          variant="solid"
          theme="blue"
          size="sm"
          @click="$emit('apply-start-time')"
          title="Update the session start time and keep timing"
        >
          <template #prefix>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </template>
          <span>Update Start Time & Keep Running</span>
        </f-button>

        <f-button
          v-else
          variant="solid"
          theme="blue"
          size="sm"
          @click="$emit('submit-timesheet')"
          :disabled="adjustDurationMinutes <= 0"
          :title="isTracking ? 'Stop the live stopwatch and write this duration to your timesheet' : 'Write this duration to your timesheet'"
        >
          <template #prefix>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          </template>
          <span>{{ isTracking ? 'Stop & Log ' + adjustDurationShort + ' to Timesheet' : 'Log ' + adjustDurationShort + ' to Timesheet' }}</span>
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "AdjustTimingModal",
  props: {
    modelValue: { type: Boolean, default: false },
    isTracking: { type: Boolean, default: false },
    isManager: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
    adjustMode: { type: String, default: "keep_running" },
    adjustForm: { type: Object, required: true },
    keepRunningElapsedFormatted: { type: String, default: "00:00:00" },
    minTimesheetDate: { type: String, default: "" },
    todayDate: { type: String, default: "" },
    originalStartTimeFormatted: { type: String, default: "" },
    adjustDurationMinutes: { type: Number, default: 0 },
    adjustDurationFormatted: { type: String, default: "0h 0m" },
    adjustDurationShort: { type: String, default: "0.0h" },
  },
  emits: [
    "update:modelValue",
    "update:adjustMode",
    "nudge",
    "set-end-now",
    "apply-start-time",
    "submit-timesheet",
  ],
  computed: {
    internalMode: {
      get() {
        return this.adjustMode;
      },
      set(val) {
        this.$emit("update:adjustMode", val);
      },
    },
  },
};
</script>
