<template>
  <teleport to="body" :disabled="!isSessionElevated">
    <div
      v-if="isTracking && (activeTab === 'dashboard' || isSessionElevated)"
      :class="[
        isSessionElevated
          ? 'fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200'
          : 'relative mb-6'
      ]"
      @click.self="$emit('update:isSessionElevated', false)"
    >
      <div
        ref="sessionCardRef"
        :class="[
          isSessionElevated
            ? 'relative w-full max-w-4xl bg-white dark:bg-[#1E1F22] rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700/80 p-4 sm:p-6 space-y-3.5 my-auto overflow-hidden animate-in zoom-in-95 duration-200'
            : 'relative w-full'
        ]"
        @click.stop
        :role="isSessionElevated ? 'dialog' : null"
        :aria-modal="isSessionElevated ? 'true' : null"
        :aria-labelledby="isSessionElevated ? 'session-popup-title' : null"
        @keydown.tab="$emit('trap-tab', $event)"
      >
        <!-- Elevated Header Bar (Visible only when in full focus popup) -->
        <div v-if="isSessionElevated" class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span id="session-popup-title" class="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              Current Session Timesheet
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Full Focus
            </span>
          </div>
          <button
            type="button"
            @click="$emit('update:isSessionElevated', false)"
            class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-xl font-bold text-[11px] border shadow-2xs cursor-pointer transition-colors border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 dark:border-gray-700 dark:bg-[#2B2D30] dark:text-gray-200 dark:hover:bg-gray-800"
            title="Minimize to page (Esc)"
            aria-label="Minimize popup"
            aria-keyshortcuts="Escape"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span class="hidden sm:inline">Minimize</span>
            <kbd class="hidden sm:inline-block font-mono text-[10px] font-bold leading-none px-1.5 py-0.5 rounded border border-gray-300 bg-gray-100 text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
              aria-hidden="true">Esc</kbd>
          </button>
        </div>

        <!-- Modular Frappe UI Timesheet Session Box -->
        <SessionBox
          v-if="isTracking"
          :is-tracking="isTracking"
          :tracker-seconds="trackerSeconds"
          :tracker-notes="trackerNotes"
          :tracker-project="trackerProject"
          :tracker-nature="trackerNature"
          :tracker-bound-block="trackerBoundBlock"
          :session-notes-list="sessionNotesList"
          :projects="projects"
          :nature-options="natureOptions"
          :assigned-tasks="assignedTasks"
          :work-blocks="workBlocks"
          :mod-key="modKey"
          :is-dark-mode="isDarkMode"
          :session-card-flash="sessionCardFlash"
          :discard-confirm="discardConfirm"
          :is-elevated="isSessionElevated"
          @stop="$emit('stop')"
          @adjust="$emit('adjust')"
          @discard="$emit('discard')"
          @add-line="$emit('add-line', $event)"
          @remove-line="$emit('remove-line', $event)"
          @bind-block="$emit('bind-block', $event)"
          @unbind-block="$emit('unbind-block')"
          @toggle-elevate="$emit('toggle-elevate')"
          @update:notes="$emit('update:notes', $event)"
          @update:project="$emit('update:project', $event)"
          @update:nature="$emit('update:nature', $event)"
        />
      </div>
    </div>
  </teleport>
</template>

<script>
export default {
  name: "SessionOverlay",
  props: {
    isTracking: { type: Boolean, default: false },
    activeTab: { type: String, default: "dashboard" },
    isSessionElevated: { type: Boolean, default: false },
    trackerSeconds: { type: Number, default: 0 },
    trackerNotes: { type: String, default: "" },
    trackerProject: { type: String, default: "" },
    trackerNature: { type: String, default: "" },
    trackerBoundBlock: { type: Object, default: null },
    sessionNotesList: { type: Array, default: () => [] },
    projects: { type: Array, default: () => [] },
    natureOptions: { type: Array, default: () => [] },
    assignedTasks: { type: Array, default: () => [] },
    workBlocks: { type: Array, default: () => [] },
    modKey: { type: String, default: "Ctrl" },
    isDarkMode: { type: Boolean, default: false },
    sessionCardFlash: { type: Boolean, default: false },
    discardConfirm: { type: Boolean, default: false }
  },
  emits: [
    "update:isSessionElevated",
    "trap-tab",
    "stop",
    "adjust",
    "discard",
    "add-line",
    "remove-line",
    "bind-block",
    "unbind-block",
    "toggle-elevate",
    "update:notes",
    "update:project",
    "update:nature"
  ]
};
</script>
