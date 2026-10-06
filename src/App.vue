<template>
<div id="app" v-cloak class="min-h-screen flex flex-col flex-1 transition-colors duration-200" :class="[isDarkMode ? 'dark bg-[#121212] text-gray-100' : 'bg-[#F8F9FA] text-gray-900', activeTab === 'planner' ? 'lg:h-screen lg:max-h-screen lg:overflow-hidden' : '']">

  <!-- ========================================== -->
  <!-- FLOATING TOAST NOTIFICATION               -->
  <!-- ========================================== -->
  <transition enter-active-class="transform ease-out duration-200 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="toast.show" role="status" aria-live="polite" class="fixed top-4 right-4 left-4 sm:left-auto z-50 flex items-center gap-3 pl-4 pr-1.5 py-1.5 min-h-12 rounded-xl shadow-lg border text-sm sm:max-w-sm bg-white border-gray-200 text-gray-900 dark:bg-[#1E1F22] dark:border-gray-700 dark:text-gray-100" @mouseenter="holdToast" @mouseleave="releaseToast" @focusin="holdToast" @focusout="releaseToast">
      <FeatherIcon
        :name="toast.type === 'success' ? 'check-circle' : (toast.type === 'danger' ? 'alert-triangle' : (toast.type === 'warning' ? 'alert-circle' : 'info'))"
        class="w-5 h-5 shrink-0"
        :class="toast.type === 'success' ? 'text-green-700 dark:text-green-400' : (toast.type === 'danger' ? 'text-red-700 dark:text-red-400' : (toast.type === 'warning' ? 'text-orange-700 dark:text-orange-400' : 'text-blue-700 dark:text-blue-400'))"
        aria-hidden="true"
      />
      <span class="flex-1 py-1.5">{{ toast.message }}</span>
      <Button v-if="toast.action" variant="ghost" class="!text-blue-700 dark:!text-blue-300 font-medium" :label="toast.action.label" @click="runToastAction">{{ toast.action.label }}</Button>
      <Button variant="ghost" icon="x" label="Dismiss" @click="toast.show = false" />
    </div>
  </transition>

  <!-- ========================================== -->
  <!-- 1. TOP APP BAR                             -->
  <!-- ========================================== -->
  <WorkstationHeader
    :is-dark-mode="isDarkMode"
    :is-client="isClient"
    :is-tracking="isTracking"
    :is-session-elevated="isSessionElevated"
    :formatted-time="formattedTime"
    :notification-permission="notificationPermission"
    :header-menu-items="headerMenuItems"
    @go-dashboard="activeTab = 'dashboard'"
    @toggle-focus="toggleSessionFocus"
    @open-raven="openRavenApp"
    @enable-notifications="enableNotificationsUserGesture"
  />

  <!-- ========================================== -->
  <!-- 4. MAIN WORKSPACE CONTAINER                -->
  <!-- ========================================== -->
  <main 
    class="flex-1 max-w-7xl w-full mx-auto px-3 pt-3 pb-32 sm:px-6 sm:pt-6 sm:pb-44 space-y-4 sm:space-y-6 transition-all" 
    :class="[
      isDarkMode ? 'bg-[#121212]' : 'bg-[#F8F9FA]',
      activeTab === 'planner' ? 'lg:flex lg:flex-col lg:min-h-0 lg:max-h-full lg:overflow-hidden lg:pt-3.5 lg:pb-[72px] lg:space-y-0 xl:max-w-[1440px] 2xl:max-w-[1680px]' : ''
    ]"
  >

    <!-- Notification Permission Banner (Mobile & Desktop) -->
    <div
      v-if="showNotificationBanner && notificationPermission === 'default'"
      class="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs shrink-0 lg:mb-3"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <FeatherIcon name="bell" class="w-4 h-4 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
        <div class="text-sm text-blue-900 dark:text-blue-100 truncate" title="Get an alert when a running session goes idle or a planned block ends">
          Turn on notifications to hear about idle sessions and blocks that end.
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <Button variant="solid" label="Turn on" @click="enableNotificationsUserGesture" />
        <Button variant="ghost" icon="x" label="Dismiss" @click="showNotificationBanner = false" />
      </div>
    </div>

    <!-- 1. Active Timesheet Card ("Desk Remote HUD") — Elevated Focus Popup or Inline -->
    <SessionOverlay
      :is-tracking="isTracking"
      :active-tab="activeTab"
      v-model:is-session-elevated="isSessionElevated"
      :tracker-seconds="trackerSeconds"
      :tracker-notes="trackerNotes"
      :tracker-project="trackerProject"
      :tracker-nature="trackerNature"
      :tracker-bound-block="trackerBoundBlock"
      :session-notes-list="sessionNotesList"
      :min-line-chars="minLogLineChars"
      :projects="projects"
      :nature-options="natureOptions"
      :assigned-tasks="assignedTasks"
      :work-blocks="workBlocks"
      :mod-key="modKey"
      :is-dark-mode="isDarkMode"
      :discard-confirm="discardConfirm"
      @trap-tab="trapSessionPopupTab"
      @stop="toggleTrack"
      @adjust="openAdjustModal"
      @discard="discardSession"
      @add-line="appendSessionLine($event)"
      @remove-line="removeSessionPoint($event)"
      @bind-block="bindSessionToBlock($event)"
      @unbind-block="bindSessionToBlock(null)"
      @toggle-elevate="isSessionElevated = !isSessionElevated"
      @update:notes="trackerNotes = $event; syncActiveSession();"
      @update:project="trackerProject = $event; syncActiveSession();"
      @update:nature="trackerNature = $event; syncActiveSession();"
    />

    <!-- Views take everything from the workstation via useWorkstationContext. -->
    <div class="omnitrack-view-coordinator flex-1 flex flex-col min-h-0">
      <DashboardView v-if="activeTab === 'dashboard'" />
      <TimesheetsView v-else-if="activeTab === 'timesheets'" />
      <AttendanceView v-else-if="activeTab === 'attendance'" />
      <CalendarView v-else-if="activeTab === 'planner'" />
    </div>
  </main>

  <!-- hover card: short, simple, informative preview with view details link -->
  <BlockHoverCard
    :hover-card="hoverCard"
    :is-dark-mode="isDarkMode"
    :fmt-hrs="fmtHrs"
    :seg-time-title="segTimeTitle"
    :is-block-locked="isBlockLocked"
    @cancel-hide="cancelHideHover"
    @hide="hideBlockHover"
    @view-details="openBlockDrawer($event); hideBlockHoverNow()"
  />

  <!-- ========================================== -->
  <!-- MODULAR DRAWERS COORDINATOR                -->
  <!-- ========================================== -->
  <DrawerCoordinator
    :show-block-drawer="showBlockDrawer"
    :active-block="activeBlock"
    :is-dark-mode="isDarkMode"
    :is-tracking="isTracking"
    :tracker-block-name="trackerBlockName"
    :planner-busy="plannerBusy"
    :drawer-chat-messages="drawerChatMessages"
    :is-block-completed="isBlockCompleted"
    :is-block-reschedulable="isBlockReschedulable"
    :is-block-cancellable="isBlockCancellable"
    :can-log-timesheet="canLogTimesheet"
    :can-review="isManager"
    :show-session-drawer="showSessionDrawer"
    :session-entry="sessionEntry"
    :show-task-raven-drawer="showTaskRavenDrawer"
    :raven-task="ravenTask"
    :raven-messages="ravenMessages"
    :task-connected-blocks="taskConnectedBlocks"
    :raven-sprint-recaps="ravenSprintRecaps"
    :raven-loading="ravenLoading"
    @close-block-drawer="showBlockDrawer = false"
    @close-session-drawer="showSessionDrawer = false"
    @open-session-block="openSessionBlock"
    @start-session="startFocusBlock"
    @stop-session="toggleTrack"
    @open-cancel-modal="openCancelModal"
    @log-session="logSessionFor"
    @open-raven="openRavenApp"
    @edit-session="editSessionRow"
    @delete-session="deleteSessionRow"
    @submit-reschedule="submitReschedule"
    @approve-block="quickApproveBlock"
    @flag-block="quickFlagBlock"
    @close-raven-drawer="closeTaskRavenDrawer"
    @start-task-immediately="startTaskImmediately"
    @plan-attention-task="planAttentionTask"
    @open-block-drawer="openBlockDrawer"
    @send-raven-message="sendRavenMessage"
  />
  <!-- ========================================== -->
  <!-- 5. WORKSPACE BOTTOM NAVIGATION DOCK        -->
  <!-- ========================================== -->
  <WorkstationBottomNav
    :is-dark-mode="isDarkMode"
    v-model:active-tab="activeTab"
    :is-manager="isManager"
    :is-tracking="isTracking"
    :bottom-bar-timer="bottomBarTimer"
    :formatted-time="formattedTime"
    @open-session="openSessionCard"
    @open-new-task="openNewTaskModal"
  />

  <!-- ========================================== -->
  <!-- MODULAR DIALOG COORDINATOR (All 12 Modals) -->
  <!-- ========================================== -->
  <DialogCoordinator
    :is-dark-mode="isDarkMode"
    :is-manager="isManager"
    :formatted-time="formattedTime"
    :planner-busy="plannerBusy"

    v-model:show-book-modal="showBookModal"
    :book-form="bookForm"
    :combobox-assignee-options="comboboxAssigneeOptions"
    :combobox-book-task-options="comboboxBookTaskOptions"
    :combobox-project-options="comboboxProjectOptions"
    :combobox-pairing-partner-options="comboboxPairingPartnerOptions"
    @submit-booking="submitBooking"

    v-model:show-empty-stop-modal="showEmptyStopModal"
    v-model:empty-stop-quick-note="emptyStopQuickNote"
    :empty-stop-elapsed-hrs="emptyStopElapsedHrs"
    @confirm-empty-stop-save="confirmEmptyStopSave"
    @confirm-empty-stop-discard="confirmEmptyStopDiscard"

    v-model:show-start-time-choice-modal="showStartTimeChoiceModal"
    :pending-block="pendingStartBlock"
    :pending-start-time-options="pendingStartTimeOptions"
    @select-start-time-choice="selectStartTimeChoice"
    @cancel-start-time-choice="showStartTimeChoiceModal = false; pendingStartBlock = null"

    v-model:show-inactivity-modal="showInactivityModal"
    :inactivity-minutes="inactivityMinutes"
    :active-task-label="trackerBoundBlock ? blockTitle(trackerBoundBlock, '') : ''"
    :session-start="sessionStart"
    :last-activity-time-h-h-m-m="lastActivityTimeHHMM"
    :suggested-stop-h-h-m-m="suggestedStopHHMM"
    @confirm-still-working="confirmStillWorking"
    @stop-inactivity-now="stopInactivitySessionNow"
    @stop-inactivity-at-last-edit="stopInactivitySessionAtLastEditPlus15"
    @discard-inactivity="discardInactivitySession"

    v-model:show-workflow-modal="showWorkflowModal"
    :workflow-target-action="workflowTargetAction"
    :workflow-target-task="workflowTargetTask"
    v-model:workflow-comment="workflowComment"
    :workflow-busy="workflowBusy"
    @submit-workflow-action="submitWorkflowAction"

    v-model:show-runaway-alert-modal="showRunawayAlertModal"
    :runaway-guard-data="runawayGuardData"
    :runaway-choice="runawayChoice"
    @select-runaway-option="resolveRunawayOption"
    @confirm-runaway-resolution="confirmRunawayResolution"

    v-model:show-e-o-d-modal="showEODModal"
    :eod-summary="eodSummary"
    :eod-pending-blocks="eodPendingBlocks"
    @convert-all-pending-blocks="convertAllPendingPlannedBlocks"
    @convert-pending-block="quickConvertPlanToActual"
    @complete-eod="showEODModal = false; showToast('EOD review complete! Great work today.', 'success');"

    v-model:show-switch-task-modal="showSwitchTaskModal"
    v-model:switch-wrap-up-note="switchWrapUpNote"
    v-model:switch-search-query="switchSearchQuery"
    :is-bound="!!trackerBoundBlock"
    :switch-candidates="switchCandidates"
    @switch-task-to="executeSwitchTask"

    v-model:show-switch-confirm-modal="showSwitchConfirmModal"
    :current-session-label="(trackerBoundBlock && blockTitle(trackerBoundBlock, '')) || trackerNotes || 'Current session'"
    :current-log-count="(sessionNotesList || []).filter((n) => String(n).trim()).length"
    :selected-project="selectedProject"
    :switch-target-item="switchTargetItem"
    :is-switching-session="isSwitchingSession"
    @confirm-switch-and-start="confirmSwitchAndStart"

    v-model:show-cancel-modal="showCancelModal"
    :cancel-target-block="cancelTargetBlock"
    :cancel-form="cancelForm"
    :cancel-reasons="cancelReasons"
    :is-tracking-this-block="isTracking && trackerBlockName === (cancelTargetBlock && cancelTargetBlock.name)"
    @submit-cancel-block="submitCancelBlock"

    v-model:show-edit-session-modal="showEditSessionModal"
    :edit-session-form="editSessionForm"
    :entry-day-offsets="entryDayOffsets"
    :is-saving-edit-session="isSavingEditSession"
    @save-edit-session="saveEditSession"
    @keep-session-running="applyAdjustedStartTime"
  />

  <!-- The one task form: block task rows, assigned work and the dashboard all open it -->
  <TaskFormDialog />

</div>
</template>

<script>
import { provide, computed } from 'vue';
import { entryDayOffsets as dayOffsetsFor } from './utils/timesheetEntry.js';
import { useOmniTrackWorkstation } from './composables/useOmniTrackWorkstation.js';
import { WORKSTATION_KEY } from './composables/useWorkstationContext.js';
import { blockTitle } from './utils/blockTitle.js';

export default {
  name: 'OmniTrackApp',
  setup() {
    const workstation = useOmniTrackWorkstation();
    provide(WORKSTATION_KEY, workstation);

    // The drawers are prop/emit components; these adapt their events to the
    // workstation's real signatures (the earlier wiring named functions that
    // never existed, so every drawer action was a silent no-op).
    const { isBlockCompleted, isPastBlock, isTracking, trackerBlockName, timesheetHorizonHours, isManager } = workstation;
    const isOpenPlan = (b) => !!b && !isBlockCompleted(b) && !isPastBlock(b) && !['Rescheduled', 'Cancelled'].includes(b.status);
    const isRecordingOn = (b) => isTracking.value && trackerBlockName.value === b.name;
    // A running session does not hold the plan where it is: rescheduling moves the plan and
    // the session keeps recording on this block until it is stopped. A session with no block
    // of its own (is_live_active) has no plan to move.
    const isBlockReschedulable = (b) => isOpenPlan(b) && !b.is_live_active;
    // Cancelling a block while its session runs would throw away the work being recorded
    const isBlockCancellable = (b) => isOpenPlan(b) && !b.is_live_active && !isRecordingOn(b);
    // Timesheet entry day chips reach back as far as the server's horizon allows
    const entryDayOffsets = computed(() => dayOffsetsFor(timesheetHorizonHours.value, isManager.value));
    const editSessionRow = (session, block) => workstation.openEditSessionModal(block, session);
    // Adding a timesheet entry by hand opens the same dialog as editing one
    const logSessionFor = (block) => workstation.openEditSessionModal(block, {});
    const deleteSessionRow = (session, block) => workstation.confirmDeleteSession(block, session);
    // A logged entry's sheet hands over to its block's sheet; one sheet at a time
    const openSessionBlock = (block) => {
      workstation.showSessionDrawer.value = false;
      workstation.openBlockDrawer(block);
    };
    const sendRavenMessage = ({ content }) => {
      workstation.ravenChatInput.value = content;
      return workstation.sendRavenChatMessage();
    };
    return {
      ...workstation,
      blockTitle,
      isBlockReschedulable,
      isBlockCancellable,
      entryDayOffsets,
      editSessionRow,
      logSessionFor,
      deleteSessionRow,
      openSessionBlock,
      sendRavenMessage
    };
  }
};
</script>
