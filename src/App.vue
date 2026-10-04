<template>
<div id="app" v-cloak class="min-h-screen flex flex-col flex-1 transition-colors duration-200" :class="[isDarkMode ? 'dark bg-[#121212] text-gray-100' : 'bg-[#F8F9FA] text-gray-900', activeTab === 'planner' ? 'lg:h-screen lg:max-h-screen lg:overflow-hidden' : '']">

  <!-- ========================================== -->
  <!-- FLOATING TOAST NOTIFICATION               -->
  <!-- ========================================== -->
  <transition enter-active-class="transform ease-out duration-200 transition" enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2" enter-to-class="translate-y-0 opacity-100 sm:translate-x-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="toast.show" class="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold max-w-sm" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'">
      <span class="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0" :class="toast.type === 'success' ? 'text-emerald-500' : (toast.type === 'danger' ? 'text-red-500' : 'text-blue-500')">
        <svg v-if="toast.type === 'success'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <svg v-else-if="toast.type === 'danger'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </span>
      <span class="flex-1">{{ toast.message }}</span>
      <button @click="toast.show = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1 font-bold cursor-pointer flex items-center justify-center">✕</button>
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
        <span class="text-lg shrink-0">🔔</span>
        <div class="text-xs text-blue-900 dark:text-blue-200 truncate">
          <span class="font-bold">Enable Mobile Notifications:</span>
          Get alerts on your phone when your running timesheet is idle or a planned block ends.
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <f-button
          variant="solid"
          size="sm"
          class="!bg-blue-600 hover:!bg-blue-700 !text-white text-xs font-semibold cursor-pointer"
          @click="enableNotificationsUserGesture"
        >
          Enable Alerts
        </f-button>
        <button
          type="button"
          @click="showNotificationBanner = false"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 cursor-pointer"
          aria-label="Dismiss banner"
        >
          ✕
        </button>
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
      :projects="projects"
      :nature-options="natureOptions"
      :assigned-tasks="assignedTasks"
      :work-blocks="workBlocks"
      :mod-key="modKey"
      :is-dark-mode="isDarkMode"
      :session-card-flash="sessionCardFlash"
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

    <!-- ======================================== -->
    <!-- MODULAR SUB-VIEWS COORDINATOR            -->
    <!-- ======================================== -->
    <ViewCoordinator
      :active-tab="activeTab"
      :is-dark-mode="isDarkMode"
      :is-manager="isManager"
      :is-client="isClient"
      :today-date="todayDate"
      :selected-dashboard-date="selectedDashboardDate"
      :client-delivered-hours="clientDeliveredHours"
      :client-in-progress-count="clientInProgressCount"
      :client-total-planned-hours="clientTotalPlannedHours"
      :client-reliability-rate="clientReliabilityRate"
      :client-tasks="clientTasks"
      :client-sessions="clientSessions"
      :client-upcoming-blocks="clientUpcomingBlocks"
      :team-members="teamMembers"
      :selected-employee="selectedEmployee"
      :employee-menu-items="employeeMenuItems"
      :dashboard-date-display="dashboardDateDisplay"
      :is-today-timeline="isTodayTimeline"
      :timeline-zoom-mode="timelineZoomMode"
      :timeline-members="timelineMembers"
      :red-line-left-pct="redLineLeftPct"
      :current-timeline-time-formatted="currentTimelineTimeFormatted"
      :adherence-theme="adherenceTheme"
      :adherence-emoji="adherenceEmoji"
      :total-count="totalCount"
      :completed-count="completedCount"
      :cancelled-count="cancelledCount"
      :total-logged="totalLogged"
      :total-planned="totalPlanned"
      :adherence-pct="adherencePct"
      :paginated-blocks="paginatedBlocks"
      :all-blocks-expanded="allBlocksExpanded"
      :fmt-hrs="fmtHrs"
      :hhmm="hhmm"
      :is-block-completed="isBlockCompleted"
      :is-block-locked="isBlockLocked"
      :timesheet-horizon="timesheetHorizon"
      :total-filtered-hours="totalFilteredHours"
      :filtered-work-blocks="filteredWorkBlocks"
      :pending-approvals="pendingApprovals"
      :loading-approvals="loadingApprovals"
      :attendance-presence="attendancePresence"
      :synthesizer-logs="synthesizerLogs"
      :hourly-presence="hourlyPresence"
      :filtered-planner-tasks="filteredPlannerTasks"
      :planner-busy="plannerBusy"
      :planner-task-search="plannerTaskSearch"
      :planner-task-filter="plannerTaskFilter"
      :calendar-view-mode="calendarViewMode"
      :planner-date="plannerDate"
      :planner-date-display="plannerDateDisplay"
      :planner-data="plannerData"
      :calendar-days="calendarDays"
      :active-session="activeSession"
      :is-tracking="isTracking"
      :now-line-top="nowLineTop"
      :hover-card="hoverCard"
      @open-block-drawer="openBlockDrawer"
      @open-task-raven-drawer="openTaskRavenDrawer"
      @open-book-modal="openBookModal"
      @open-eod-modal="openEODWrapUpDrawer"
      @start-session="startSessionFromBlock"
      @stop-session="toggleTrack"
      @switch-task="promptSwitchSession"
      @toggle-all-blocks="toggleAllBlocksExpanded"
      @set-timeline-zoom="setTimelineZoom"
      @navigate-timeline-day="navigateTimelineDay"
      @approve-timesheet="approveTimesheetBlock"
      @fetch-pending-approvals="fetchPendingApprovals"
      @approve-all-pending="approveAllPending"
      @approve-block="approveTimesheetBlock"
      @open-task-details="openTaskDetails"
      @start-task-immediately="startSessionFromTask"
      @plan-attention-task="planAttentionTask"
      @start-focus-session="startSessionFromBlock"
      @stop-focus-session="toggleTrack"
      @toggle-task-expansion="toggleTaskExpansion"
      @cell-drag-over="onCalendarDragOver"
      @cell-drop="onCalendarDrop"
      @drag-start="onCalendarBlockDragStart"
      @navigate-day="navigateCalendarDay"
      @navigate-today="navigateCalendarToday"
      @navigate-date="navigateCalendarDate"
      @set-view-mode="setCalendarViewMode"
      @show-block-hover="showBlockHover"
      @hide-block-hover="hideBlockHover"
    />
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
    :show-task-raven-drawer="showTaskRavenDrawer"
    :raven-task="ravenTask"
    :raven-messages="ravenMessages"
    :task-connected-blocks="taskConnectedBlocks"
    :raven-sprint-recaps="ravenSprintRecaps"
    :raven-loading="ravenLoading"
    @close-block-drawer="showBlockDrawer = false"
    @start-session="startSessionFromBlock"
    @stop-session="toggleTrack"
    @toggle-reschedule="toggleRescheduleForm"
    @open-cancel-modal="openCancelModal"
    @toggle-manual-log="showBlockManualLog = !showBlockManualLog"
    @open-raven="openRavenFromBlock"
    @edit-session="openEditSessionModal"
    @delete-session="deleteSessionRow"
    @submit-reschedule="submitReschedule"
    @submit-session="submitBlockSession"
    @close-raven-drawer="closeTaskRavenDrawer"
    @start-task-immediately="startSessionFromTask"
    @plan-attention-task="planAttentionTask"
    @open-block-drawer="openBlockDrawer"
    @send-raven-message="sendRavenChatMessage"
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
    :book-form-task="bookFormTask"
    :combobox-assignee-options="comboboxAssigneeOptions"
    :combobox-book-task-options="comboboxBookTaskOptions"
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
    :active-task-label="trackerNotes || (trackerBoundBlock ? (trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label) : 'Active Work')"
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

    v-model:show-new-task-modal="showNewTaskModal"
    :new-task-form="newTaskForm"
    :combobox-project-options="comboboxProjectOptions"
    :combobox-task-options="comboboxTaskOptions"
    :team-members="teamMembers"
    :nature-options="natureOptions"
    @save-new-planned-task="saveNewPlannedTask"
    @new-task-time-change="onNewTaskTimeChange"
    @new-task-duration-preset="setNewTaskDurationPreset"

    v-model:show-adjust-modal="showAdjustModal"
    v-model:adjust-mode="adjustMode"
    :is-tracking="isTracking"
    :adjust-form="adjustForm"
    :keep-running-elapsed-formatted="keepRunningElapsedFormatted"
    :min-timesheet-date="minTimesheetDate"
    :today-date="todayDate"
    :original-start-time-formatted="originalStartTimeFormatted"
    :adjust-duration-minutes="adjustDurationMinutes"
    :adjust-duration-formatted="adjustDurationFormatted"
    :adjust-duration-short="adjustDurationShort"
    @nudge-adjust-time="nudgeAdjustTime"
    @set-adjust-end-now="setAdjustEndNow"
    @apply-adjusted-start-time="applyAdjustedStartTime"
    @submit-adjusted-timesheet="submitAdjustedTimesheet"

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
    :current-session-label="(trackerBoundBlock && (trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label || trackerBoundBlock.deliverable_notes)) || trackerNotes || 'Active Work Session'"
    :selected-project="selectedProject"
    :selected-nature="selectedNature"
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
    :edit-session-duration="editSessionDuration"
    :is-saving-edit-session="isSavingEditSession"
    @save-edit-session="saveEditSession"
  />

</div>
</template>

<script>
import { useOmniTrackWorkstation } from './composables/useOmniTrackWorkstation.js';

export default {
  name: 'OmniTrackApp',
  setup() {
    return useOmniTrackWorkstation();
  }
};
</script>
