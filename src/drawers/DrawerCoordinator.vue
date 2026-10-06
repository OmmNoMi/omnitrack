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
      :drawer-chat-messages="drawerChatMessages"
      :is-block-completed="isBlockCompleted"
      :is-block-reschedulable="isBlockReschedulable"
      :is-block-cancellable="isBlockCancellable"
      :can-log-timesheet="canLogTimesheet"
      :can-review="canReview"
      @close="$emit('close-block-drawer')"
      @start-session="$emit('start-session', $event)"
      @stop-session="$emit('stop-session')"
      @open-cancel-modal="$emit('open-cancel-modal', $event)"
      @log-session="$emit('log-session', $event)"
      @open-raven="$emit('open-raven', $event)"
      @edit-session="(session, block) => $emit('edit-session', session, block)"
      @delete-session="(session, block) => $emit('delete-session', session, block)"
      @submit-reschedule="$emit('submit-reschedule', $event)"
      @approve="$emit('approve-block', $event)"
      @flag="(block, reason) => $emit('flag-block', block, reason)"
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
    drawerChatMessages: { type: Array, default: () => [] },
    isBlockCompleted: { type: Function, default: () => false },
    isBlockReschedulable: { type: Function, default: () => false },
    isBlockCancellable: { type: Function, default: () => false },
    canLogTimesheet: { type: Function, default: () => true },
    canReview: { type: Boolean, default: false },

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
    "open-cancel-modal",
    "log-session",
    "open-raven",
    "edit-session",
    "delete-session",
    "submit-reschedule",
    "approve-block",
    "flag-block",
    "close-raven-drawer",
    "start-task-immediately",
    "plan-attention-task",
    "open-block-drawer",
    "send-raven-message"
  ]
};
</script>
