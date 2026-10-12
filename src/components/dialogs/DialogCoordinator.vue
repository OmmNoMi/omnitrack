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
      :error="bookError"
      @submit="$emit('submit-booking')"
    />

    <StartTimeChoiceModal
      :model-value="showStartTimeChoiceModal"
      @update:model-value="$emit('update:showStartTimeChoiceModal', $event)"
      :pending-block="pendingStartBlock"
      :planned-start-ms="pendingStartMs"
      @select="$emit('select-start-time-choice', $event)"
      @cancel="$emit('cancel-start-time-choice')"
    />

    <InactivityGovernorModal
      :model-value="showInactivityModal"
      @update:model-value="$emit('update:showInactivityModal', $event)"
      :inactivity-minutes="inactivityMinutes"
      :is-dark-mode="isDarkMode"
      :active-task-label="activeTaskLabel"
      :idle-since-ms="idleSinceMs"
      :formatted-time="formattedTime"
      @confirm-working="$emit('confirm-still-working')"
      @adjust="$emit('adjust-inactivity')"
    />

    <!-- ========================================== -->
    <!-- MODULAR DIALOGS (Part 2: Planning & Lifecycles) -->
    <!-- ========================================== -->
    <EODWrapUpModal
      :model-value="showEODModal"
      @update:model-value="$emit('update:showEODModal', $event)"
      :summary="eodSummary"
      :pending-blocks="eodPendingBlocks"
      @log-block="$emit('log-pending-block', $event)"
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
      :pick="switchPick"
      :candidates="switchCandidates"
      :log-words="switchLogWords"
      :min-words="switchMinWords"
      :error="switchError"
      @pick="$emit('update:switchTargetItem', $event)"
      @confirm="$emit('confirm-switch-and-start')"
    />

    <CancelWorkBlockModal
      :model-value="showCancelModal"
      @update:model-value="$emit('update:showCancelModal', $event)"
      :target-block="cancelTargetBlock"
      :cancel-form="cancelForm"
      :reasons="cancelReasons"
      :busy="plannerBusy"
      :error="cancelError"
      @confirm="$emit('submit-cancel-block')"
    />

    <!-- Adding or editing a work session by hand is the session box people know from the
         timer (add, edit, a free window). The running session is corrected in its own box
         (Adjust, SessionControlsPane), never here. -->
    <WorkSessionEntry
      :model-value="showEditSessionModal"
      @update:model-value="$emit('update:showEditSessionModal', $event)"
      :form="editSessionForm"
      :is-saving="isSavingEditSession"
      :is-dark-mode="isDarkMode"
      :day-offsets="entryDayOffsets"
      @save="$emit('save-edit-session')"
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
    bookError: { type: String, default: "" },
    comboboxAssigneeOptions: { type: Array, default: () => [] },
    comboboxBookTaskOptions: { type: Array, default: () => [] },
    comboboxProjectOptions: { type: Array, default: () => [] },
    comboboxPairingPartnerOptions: { type: Array, default: () => [] },

    // StartTimeChoiceModal
    showStartTimeChoiceModal: { type: Boolean, default: false },
    pendingStartBlock: { type: Object, default: null },
    pendingStartMs: { type: Number, default: 0 },

    // InactivityGovernorModal
    showInactivityModal: { type: Boolean, default: false },
    inactivityMinutes: { type: Number, default: 0 },
    activeTaskLabel: { type: String, default: "" },
    idleSinceMs: { type: Number, default: 0 },

    // EODWrapUpModal
    showEODModal: { type: Boolean, default: false },
    eodSummary: { type: Object, default: () => ({}) },
    eodPendingBlocks: { type: Array, default: () => [] },

    // WrapAndStartNextModal: the one switch dialog
    showSwitchConfirmModal: { type: Boolean, default: false },
    switchWrapUpNote: { type: String, default: "" },
    switchPick: { type: Boolean, default: false },
    switchCandidates: { type: Array, default: () => [] },
    switchLogWords: { type: Number, default: 0 },
    switchMinWords: { type: Number, default: 15 },
    switchError: { type: String, default: "" },
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
    cancelError: { type: String, default: "" },

    // WorkSessionEntry
    showEditSessionModal: { type: Boolean, default: false },
    editSessionForm: { type: Object, default: () => ({}) },
    isSavingEditSession: { type: Boolean, default: false },
    entryDayOffsets: { type: Array, default: () => [0, -1] }
  },
  emits: [
    "update:showBookModal",
    "submit-booking",
    "update:showStartTimeChoiceModal",
    "select-start-time-choice",
    "cancel-start-time-choice",
    "update:showInactivityModal",
    "confirm-still-working",
    "adjust-inactivity",
    "update:showEODModal",
    "log-pending-block",
    "update:switchWrapUpNote",
    "update:switchTargetItem",
    "update:showSwitchConfirmModal",
    "confirm-switch-and-start",
    "update:showCancelModal",
    "submit-cancel-block",
    "update:showEditSessionModal",
    "save-edit-session"
  ]
};
</script>
