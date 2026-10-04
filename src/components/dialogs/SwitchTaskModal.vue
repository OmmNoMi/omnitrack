<template>
  <f-dialog
    :model-value="modelValue"
    title="Switch Active Task"
    subtitle="Log time on current work block and transition to another immediately"
    size="md"
    z-index="z-[80]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- Current Session Summary & Wrap-Up Note -->
      <div class="p-3 rounded-2xl bg-gray-50 dark:bg-[#18191B] border border-gray-200 dark:border-gray-800 space-y-2">
        <div class="flex items-center justify-between text-gray-600 dark:text-gray-300 font-medium">
          <span>Active Clock: <strong class="font-mono text-gray-900 dark:text-white">{{ formattedTime }}</strong></span>
          <span class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
            {{ isBound ? 'Bound to Block' : 'Unbound Focus' }}
          </span>
        </div>
        <div>
          <label for="switch-wrap-note" class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Current Session Wrap-Up Note (Saved to timesheet)
          </label>
          <input
            id="switch-wrap-note"
            type="text"
            v-model="internalWrapUpNote"
            class="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#25272A] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What did you wrap up before switching?"
          />
        </div>
      </div>

      <!-- Search Candidate Blocks & Tasks -->
      <div class="space-y-2">
        <label for="switch-target-search" class="block font-bold text-gray-800 dark:text-gray-200">
          Select Target Task to Switch To:
        </label>
        <div class="relative">
          <input
            id="switch-target-search"
            type="search"
            v-model="internalSearchQuery"
            class="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#25272A] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search today's planned blocks or assigned tasks..."
            autocomplete="off"
          />
          <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      <!-- Candidate Selection List -->
      <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
        <div v-if="candidates.length === 0" class="py-6 text-center text-gray-400 italic">
          No matching work blocks or tasks found for today.
        </div>
        <button
          v-for="item in candidates"
          :key="item.id || item.name"
          type="button"
          @click="$emit('switch-to', item)"
          class="w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white dark:bg-[#222427] border-gray-200 dark:border-gray-700/80 hover:border-blue-400 dark:hover:border-blue-500"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                :class="item.is_block ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'"
              >
                {{ item.is_block ? 'Planned Block' : 'Open Task' }}
              </span>
              <span class="font-bold text-gray-900 dark:text-white truncate text-xs">{{ item.label }}</span>
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {{ item.sublabel || item.project || 'General' }}
            </div>
          </div>
          <span class="shrink-0 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            Switch →
          </span>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)">
          Cancel
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "SwitchTaskModal",
  props: {
    modelValue: { type: Boolean, default: false },
    formattedTime: { type: String, default: "00:00:00" },
    isBound: { type: Boolean, default: false },
    wrapUpNote: { type: String, default: "" },
    searchQuery: { type: String, default: "" },
    candidates: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue", "update:wrapUpNote", "update:searchQuery", "switch-to"],
  computed: {
    internalWrapUpNote: {
      get() {
        return this.wrapUpNote;
      },
      set(val) {
        this.$emit("update:wrapUpNote", val);
      },
    },
    internalSearchQuery: {
      get() {
        return this.searchQuery;
      },
      set(val) {
        this.$emit("update:searchQuery", val);
      },
    },
  },
};
</script>
