<template>
  <div class="omnitrack-drawer-coordinator">
    <!-- Block Detail Drawer -->
    <BlockDetailDrawer
      :show="showBlockDrawer"
      :block="activeBlock"
      :is-dark-mode="isDarkMode"
      :is-tracking="isTracking"
      :tracker-block-name="trackerBlockName"
      :planner-busy="plannerBusy"
      :show-reschedule-form="showRescheduleForm"
      :reschedule-form="rescheduleForm"
      :show-block-manual-log="showBlockManualLog"
      :session-form="sessionForm"
      :drawer-chat-messages="drawerChatMessages"
      :hhmm="hhmm"
      :is-block-completed="isBlockCompleted"
      :is-block-reschedulable="isBlockReschedulable"
      :is-block-cancellable="isBlockCancellable"
      :can-log-timesheet="canLogTimesheet"
      @close="$emit('close-block-drawer')"
      @start-session="$emit('start-session', $event)"
      @stop-session="$emit('stop-session')"
      @toggle-reschedule="$emit('toggle-reschedule')"
      @open-cancel-modal="$emit('open-cancel-modal', $event)"
      @toggle-manual-log="$emit('toggle-manual-log')"
      @open-raven="$emit('open-raven', $event)"
      @edit-session="$emit('edit-session', $event)"
      @delete-session="$emit('delete-session', $event)"
      @submit-reschedule="$emit('submit-reschedule', $event)"
      @submit-session="$emit('submit-session', $event)"
    />

    <!-- Raven Collaboration Drawer -->
    <RavenCollaborationDrawer
      :show="showTaskRavenDrawer"
      :task="ravenTask"
      :is-dark-mode="isDarkMode"
      :messages="ravenMessages"
      :blocks="taskConnectedBlocks"
      :recaps="ravenSprintRecaps"
      :loading-messages="ravenLoading"
      @close="$emit('close-raven-drawer')"
      @start-task-immediately="$emit('start-task-immediately', $event)"
      @plan-attention-task="$emit('plan-attention-task', $event)"
      @open-block-drawer="$emit('open-block-drawer', $event)"
      @send-message="$emit('send-raven-message', $event)"
    />
  </div>
</template>

<script>
export default {
  name: "DrawerCoordinator",
  props: {
    // Block Detail Drawer props
    showBlockDrawer: { type: Boolean, default: false },
    activeBlock: { type: Object, default: null },
    isDarkMode: { type: Boolean, default: false },
    isTracking: { type: Boolean, default: false },
    trackerBlockName: { type: String, default: null },
    plannerBusy: { type: Boolean, default: false },
    showRescheduleForm: { type: Boolean, default: false },
    rescheduleForm: { type: Object, default: () => ({}) },
    showBlockManualLog: { type: Boolean, default: false },
    sessionForm: { type: Object, default: () => ({}) },
    drawerChatMessages: { type: Array, default: () => [] },
    hhmm: { type: Function, default: () => "" },
    isBlockCompleted: { type: Function, default: () => false },
    isBlockReschedulable: { type: Function, default: () => false },
    isBlockCancellable: { type: Function, default: () => false },
    canLogTimesheet: { type: Function, default: () => true },

    // Raven Collaboration Drawer props
    showTaskRavenDrawer: { type: Boolean, default: false },
    ravenTask: { type: Object, default: null },
    ravenMessages: { type: Array, default: () => [] },
    taskConnectedBlocks: { type: Array, default: () => [] },
    ravenSprintRecaps: { type: Array, default: () => [] },
    ravenLoading: { type: Boolean, default: false }
  },
  emits: [
    "close-block-drawer",
    "start-session",
    "stop-session",
    "toggle-reschedule",
    "open-cancel-modal",
    "toggle-manual-log",
    "open-raven",
    "edit-session",
    "delete-session",
    "submit-reschedule",
    "submit-session",
    "close-raven-drawer",
    "start-task-immediately",
    "plan-attention-task",
    "open-block-drawer",
    "send-raven-message"
  ]
};
</script>
