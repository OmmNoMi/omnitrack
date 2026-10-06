<template>
  <teleport to="body" :disabled="!isSessionElevated">
    <div
      v-if="isTracking && (activeTab === 'dashboard' || isSessionElevated)"
      :class="[
        isSessionElevated
          ? 'fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto'
          : 'relative mb-6'
      ]"
      @click.self="$emit('update:isSessionElevated', false)"
    >
      <div
        ref="sessionCardRef"
        :class="[
          isSessionElevated
            ? 'relative w-full max-w-4xl bg-white dark:bg-[#1E1F22] rounded-3xl shadow-2xl p-4 sm:p-6 space-y-4 my-auto'
            : 'relative w-full'
        ]"
        @click.stop
        :role="isSessionElevated ? 'dialog' : null"
        :aria-modal="isSessionElevated ? 'true' : null"
        :aria-labelledby="isSessionElevated ? 'session-popup-title' : null"
        @keydown.tab="$emit('trap-tab', $event)"
      >
        <!-- Elevated header: what this is, and the way back -->
        <div v-if="isSessionElevated" class="flex items-center justify-between gap-3">
          <h2 id="session-popup-title" class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500 pulse-record" aria-hidden="true"></span>
            Recording
          </h2>
          <Button
            variant="ghost"
            icon="minimize-2"
            label="Minimize to page"
            tooltip="Minimize · Esc"
            aria-keyshortcuts="Escape"
            @click="$emit('update:isSessionElevated', false)"
          />
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
          :min-line-chars="minLineChars"
          :projects="projects"
          :nature-options="natureOptions"
          :assigned-tasks="assignedTasks"
          :work-blocks="workBlocks"
          :mod-key="modKey"
          :is-dark-mode="isDarkMode"
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
    minLineChars: { type: Number, default: 10 },
    projects: { type: Array, default: () => [] },
    natureOptions: { type: Array, default: () => [] },
    assignedTasks: { type: Array, default: () => [] },
    workBlocks: { type: Array, default: () => [] },
    modKey: { type: String, default: "Ctrl" },
    isDarkMode: { type: Boolean, default: false },
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
