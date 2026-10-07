<template>
  <div class="omnitrack-dialog-coordinator">
    <!-- ========================================== -->
    <!-- MODULAR DIALOGS (Part 1: Session)-->
    <!-- ========================================== -->
    <!-- The only dialog that creates a work block; opened by workBlockStore.openPlanDialog() -->
    <PlanWorkBlockDialog
      :model-value="showBookModal"
      @update:model-value="$emit('update:showBookModal', $event)"
      :form="bookForm"
      :busy="plannerBusy"
      :is-manager="isManager"
      :is-dark-mode="isDarkMode"
      :task-options="comboboxBookTaskOptions"
      :project-options="comboboxProjectOptions"
      :partner-options="comboboxPairingPartnerOptions"
      :assignee-options="comboboxAssigneeOptions"
      @submit="$emit('submit-booking')"
    />

    <EmptyStopModal
      :model-value="showEmptyStopModal"
      @update:model-value="$emit('update:showEmptyStopModal', $event)"
      :quick-note="emptyStopQuickNote"
      @update:quick-note="$emit('update:emptyStopQuickNote', $event)"
      :elapsed-hours="emptyStopElapsedHrs"
      :logged-words="emptyStopLoggedWords"
      :min-words="sessionMinWords"
      :is-dark-mode="isDarkMode"
      @save="$emit('confirm-empty-stop-save')"
      @discard="$emit('confirm-empty-stop-discard')"
    />

    <StartTimeChoiceModal
      :model-value="showStartTimeChoiceModal"
      @update:model-value="$emit('update:showStartTimeChoiceModal', $event)"
      :pending-block="pendingStartBlock"
      :options="pendingStartTimeOptions"
      :is-dark-mode="isDarkMode"
      @select="$emit('select-start-time-choice', $event)"
      @cancel="$emit('cancel-start-time-choice')"
    />

    <InactivityGovernorModal
      :model-value="showInactivityModal"
      @update:model-value="$emit('update:showInactivityModal', $event)"
      :inactivity-minutes="inactivityMinutes"
      :is-dark-mode="isDarkMode"
      :active-task-label="activeTaskLabel"
      :session-start="sessionStart"
      :last-activity-time-h-h-m-m="lastActivityTimeHHMM"
      :suggested-stop-h-h-m-m="suggestedStopHHMM"
      :formatted-time="formattedTime"
      @confirm-working="$emit('confirm-still-working')"
      @stop-now="$emit('stop-inactivity-now')"
      @stop-at-last-edit="$emit('stop-inactivity-at-last-edit')"
      @discard="$emit('discard-inactivity')"
    />

    <!-- ========================================== -->
    <!-- MODULAR DIALOGS (Part 2: Planning & Lifecycles) -->
    <!-- ========================================== -->
    <RunawayTimerModal
      :model-value="showRunawayAlertModal"
      @update:model-value="$emit('update:showRunawayAlertModal', $event)"
      :guard-data="runawayGuardData"
      :choice="runawayChoice"
      :is-dark-mode="isDarkMode"
      @select-option="$emit('select-runaway-option', $event)"
      @confirm="$emit('confirm-runaway-resolution')"
    />

    <EODWrapUpModal
      :model-value="showEODModal"
      @update:model-value="$emit('update:showEODModal', $event)"
      :summary="eodSummary"
      :pending-blocks="eodPendingBlocks"
      @convert-all="$emit('convert-all-pending-blocks')"
      @convert-block="$emit('convert-pending-block', $event)"
      @complete="$emit('complete-eod')"
    />

    <SwitchTaskModal
      :model-value="showSwitchTaskModal"
      @update:model-value="$emit('update:showSwitchTaskModal', $event)"
      :wrap-up-note="switchWrapUpNote"
      @update:wrap-up-note="$emit('update:switchWrapUpNote', $event)"
      :search-query="switchSearchQuery"
      @update:search-query="$emit('update:switchSearchQuery', $event)"
      :formatted-time="formattedTime"
      :is-bound="isBound"
      :candidates="switchCandidates"
      @switch-to="$emit('switch-task-to', $event)"
    />

    <WrapAndStartNextModal
      :model-value="showSwitchConfirmModal"
      @update:model-value="$emit('update:showSwitchConfirmModal', $event)"
      :wrap-up-note="switchWrapUpNote"
      @update:wrap-up-note="$emit('update:switchWrapUpNote', $event)"
      :formatted-time="formattedTime"
      :current-session-label="currentSessionLabel"
      :current-log-count="currentLogCount"
      :selected-project="selectedProject"
      :target-item="switchTargetItem"
      :is-switching="isSwitchingSession"
      @confirm="$emit('confirm-switch-and-start')"
    />

    <CancelWorkBlockModal
      :model-value="showCancelModal"
      @update:model-value="$emit('update:showCancelModal', $event)"
      :target-block="cancelTargetBlock"
      :cancel-form="cancelForm"
      :reasons="cancelReasons"
      :is-tracking-this-block="isTrackingThisBlock"
      :formatted-time="formattedTime"
      :busy="plannerBusy"
      :is-dark-mode="isDarkMode"
      @confirm="$emit('submit-cancel-block', $event)"
    />

    <!-- Adding or editing a work session by hand is the session box people know from the
         timer (add, edit, a free window). Correcting the running session's start stays a sheet. -->
    <WorkSessionEntry
      :model-value="showEditSessionModal && editSessionForm.mode !== 'live'"
      @update:model-value="$emit('update:showEditSessionModal', $event)"
      :form="editSessionForm"
      :is-saving="isSavingEditSession"
      :is-dark-mode="isDarkMode"
      :day-offsets="entryDayOffsets"
      @save="$emit('save-edit-session')"
    />
    <TimesheetEntryDialog
      :model-value="showEditSessionModal && editSessionForm.mode === 'live'"
      @update:model-value="$emit('update:showEditSessionModal', $event)"
      :form="editSessionForm"
      :is-saving="isSavingEditSession"
      :is-dark-mode="isDarkMode"
      :day-offsets="entryDayOffsets"
      @save="$emit('save-edit-session')"
      @keep-running="$emit('keep-session-running')"
    />
  </div>
</template>

<script>
export default {
  name: "DialogCoordinator",
  props: {
    // Shared / Context
    isDarkMode: { type: Boolean, default: false },
    isManager: { type: Boolean, default: false },
    formattedTime: { type: String, default: "" },
    plannerBusy: { type: Boolean, default: false },

    // PlanWorkBlockDialog
    showBookModal: { type: Boolean, default: false },
    bookForm: { type: Object, default: () => ({}) },
    comboboxAssigneeOptions: { type: Array, default: () => [] },
    comboboxBookTaskOptions: { type: Array, default: () => [] },
    comboboxProjectOptions: { type: Array, default: () => [] },
    comboboxPairingPartnerOptions: { type: Array, default: () => [] },

    // EmptyStopModal
    showEmptyStopModal: { type: Boolean, default: false },
    emptyStopQuickNote: { type: String, default: "" },
    emptyStopElapsedHrs: { type: [Number, String], default: 0 },
    emptyStopLoggedWords: { type: Number, default: 0 },
    sessionMinWords: { type: Number, default: 15 },

    // StartTimeChoiceModal
    showStartTimeChoiceModal: { type: Boolean, default: false },
    pendingStartBlock: { type: Object, default: null },
    pendingStartTimeOptions: { type: Array, default: () => [] },

    // InactivityGovernorModal
    showInactivityModal: { type: Boolean, default: false },
    inactivityMinutes: { type: Number, default: 0 },
    activeTaskLabel: { type: String, default: "" },
    sessionStart: { type: [String, Number, Date], default: null },
    lastActivityTimeHHMM: { type: String, default: "" },
    suggestedStopHHMM: { type: String, default: "" },

    // RunawayTimerModal
    showRunawayAlertModal: { type: Boolean, default: false },
    runawayGuardData: { type: Object, default: null },
    runawayChoice: { type: String, default: "stop_at_eod" },

    // EODWrapUpModal
    showEODModal: { type: Boolean, default: false },
    eodSummary: { type: Object, default: () => ({}) },
    eodPendingBlocks: { type: Array, default: () => [] },

    // SwitchTaskModal
    showSwitchTaskModal: { type: Boolean, default: false },
    switchWrapUpNote: { type: String, default: "" },
    switchSearchQuery: { type: String, default: "" },
    isBound: { type: Boolean, default: false },
    switchCandidates: { type: Array, default: () => [] },

    // WrapAndStartNextModal
    showSwitchConfirmModal: { type: Boolean, default: false },
    currentSessionLabel: { type: String, default: "" },
    currentLogCount: { type: Number, default: 0 },
    selectedProject: { type: String, default: "" },
    switchTargetItem: { type: Object, default: null },
    isSwitchingSession: { type: Boolean, default: false },

    // CancelWorkBlockModal
    showCancelModal: { type: Boolean, default: false },
    cancelTargetBlock: { type: Object, default: null },
    cancelForm: { type: Object, default: () => ({}) },
    cancelReasons: { type: Array, default: () => [] },
    isTrackingThisBlock: { type: Boolean, default: false },

    // TimesheetEntryDialog
    showEditSessionModal: { type: Boolean, default: false },
    editSessionForm: { type: Object, default: () => ({}) },
    isSavingEditSession: { type: Boolean, default: false },
    entryDayOffsets: { type: Array, default: () => [0, -1] }
  },
  emits: [
    "update:showBookModal",
    "submit-booking",
    "update:showEmptyStopModal",
    "update:emptyStopQuickNote",
    "confirm-empty-stop-save",
    "confirm-empty-stop-discard",
    "update:showStartTimeChoiceModal",
    "select-start-time-choice",
    "cancel-start-time-choice",
    "update:showInactivityModal",
    "confirm-still-working",
    "stop-inactivity-now",
    "stop-inactivity-at-last-edit",
    "discard-inactivity",
    "update:showRunawayAlertModal",
    "select-runaway-option",
    "confirm-runaway-resolution",
    "update:showEODModal",
    "convert-all-pending-blocks",
    "convert-pending-block",
    "complete-eod",
    "update:showSwitchTaskModal",
    "update:switchWrapUpNote",
    "update:switchSearchQuery",
    "switch-task-to",
    "update:showSwitchConfirmModal",
    "confirm-switch-and-start",
    "update:showCancelModal",
    "submit-cancel-block",
    "update:showEditSessionModal",
    "save-edit-session",
    "keep-session-running"
  ]
};
</script>
