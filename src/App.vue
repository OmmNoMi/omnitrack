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
    <teleport to="body" :disabled="!isSessionElevated">
      <div
        v-if="isTracking && (activeTab === 'dashboard' || isSessionElevated)"
        :class="[
          isSessionElevated
            ? 'fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200'
            : 'relative mb-6'
        ]"
        @click.self="isSessionElevated && (isSessionElevated = false)"
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
          @keydown.tab="trapSessionPopupTab"
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
            <!-- One control, not a sentence plus a bare glyph: the same
                 label + shortcut-chip shape every other action in this app uses,
                 so Esc reads as this button's shortcut instead of loose advice. -->
            <button
              type="button"
              @click="isSessionElevated = false"
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
        </div>
      </div>
    </teleport>

    <!-- ======================================== -->
    <!-- MODULAR SUB-VIEWS                        -->
    <!-- ======================================== -->
    <DashboardView
      v-if="activeTab === 'dashboard'"
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
    />

    <TimesheetsView
      v-else-if="activeTab === 'timesheets'"
      :is-dark-mode="isDarkMode"
      :is-manager="isManager"
      :selected-employee="selectedEmployee"
      :employee-menu-items="employeeMenuItems"
      :timesheet-horizon="timesheetHorizon"
      :total-filtered-hours="totalFilteredHours"
      :filtered-work-blocks="filteredWorkBlocks"
      :fmt-hrs="fmtHrs"
      :hhmm="hhmm"
      @open-block-drawer="openBlockDrawer"
      @approve-timesheet="approveTimesheetBlock"
    />

    <AttendanceView
      v-else-if="activeTab === 'attendance'"
      :is-dark-mode="isDarkMode"
      :is-manager="isManager"
      :selected-employee="selectedEmployee"
      :employee-menu-items="employeeMenuItems"
      :pending-approvals="pendingApprovals"
      :loading-approvals="loadingApprovals"
      :attendance-presence="attendancePresence"
      :synthesizer-logs="synthesizerLogs"
      :hourly-presence="hourlyPresence"
      :fmt-hrs="fmtHrs"
      :hhmm="hhmm"
      @fetch-pending-approvals="fetchPendingApprovals"
      @approve-all-pending="approveAllPending"
      @approve-block="approveTimesheetBlock"
      @open-block-drawer="openBlockDrawer"
    />

    <CalendarView
      v-else-if="activeTab === 'planner'"
      :is-dark-mode="isDarkMode"
      :is-manager="isManager"
      :employee-menu-items="employeeMenuItems"
      :selected-employee-name="selectedEmployee"
      :assigned-tasks="filteredPlannerTasks"
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
      :fmt-hrs="fmtHrs"
      :hhmm="hhmm"
      :is-block-completed="isBlockCompleted"
      @open-book-modal="openBookModal"
      @open-block-drawer="openBlockDrawer"
      @open-task-details="openTaskDetails"
      @open-task-raven-drawer="openTaskRavenDrawer"
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
  <!-- MODULAR DIALOGS (Part 1: Session & Workflow)-->
  <!-- ========================================== -->
  <BookWorkBlockModal
    v-model="showBookModal"
    :book-form="bookForm"
    :book-form-task="bookFormTask"
    :is-manager="isManager"
    :is-dark-mode="isDarkMode"
    :planner-busy="plannerBusy"
    :combobox-assignee-options="comboboxAssigneeOptions"
    :combobox-book-task-options="comboboxBookTaskOptions"
    :combobox-pairing-partner-options="comboboxPairingPartnerOptions"
    @submit="submitBooking"
  />

  <EmptyStopModal
    v-model="showEmptyStopModal"
    v-model:quick-note="emptyStopQuickNote"
    :elapsed-hours="emptyStopElapsedHrs"
    :is-dark-mode="isDarkMode"
    @save="confirmEmptyStopSave"
    @discard="confirmEmptyStopDiscard"
  />

  <StartTimeChoiceModal
    v-model="showStartTimeChoiceModal"
    :pending-block="pendingStartBlock"
    :options="pendingStartTimeOptions"
    :is-dark-mode="isDarkMode"
    @select="selectStartTimeChoice"
    @cancel="showStartTimeChoiceModal = false; pendingStartBlock = null"
  />

  <InactivityGovernorModal
    v-model="showInactivityModal"
    :inactivity-minutes="inactivityMinutes"
    :is-dark-mode="isDarkMode"
    :active-task-label="trackerNotes || (trackerBoundBlock ? (trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label) : 'Active Work')"
    :session-start="sessionStart"
    :last-activity-time-h-h-m-m="lastActivityTimeHHMM"
    :suggested-stop-h-h-m-m="suggestedStopHHMM"
    :formatted-time="formattedTime"
    @confirm-working="confirmStillWorking"
    @stop-now="stopInactivitySessionNow"
    @stop-at-last-edit="stopInactivitySessionAtLastEditPlus15"
    @discard="discardInactivitySession"
  />

  <TaskWorkflowModal
    v-model="showWorkflowModal"
    :target-action="workflowTargetAction"
    :target-task="workflowTargetTask"
    v-model:comment="workflowComment"
    :busy="workflowBusy"
    :is-dark-mode="isDarkMode"
    @confirm="submitWorkflowAction"
  />

  <!-- ========================================== -->
  <!-- MODULAR DRAWERS                           -->
  <!-- ========================================== -->
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
    @close="showBlockDrawer = false"
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
  />

  <RavenCollaborationDrawer
    :show="showTaskRavenDrawer"
    :task="ravenTask"
    :is-dark-mode="isDarkMode"
    :messages="ravenMessages"
    :blocks="taskConnectedBlocks"
    :recaps="ravenSprintRecaps"
    :loading-messages="ravenLoading"
    @close="closeTaskRavenDrawer"
    @start-task-immediately="startSessionFromTask"
    @plan-attention-task="planAttentionTask"
    @open-block-drawer="openBlockDrawer"
    @send-message="sendRavenChatMessage"
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
  <!-- MODULAR DIALOGS (Part 2: Planning & Lifecycles) -->
  <!-- ========================================== -->
  <PlanFocusBlockModal
    v-model="showNewTaskModal"
    :new-task-form="newTaskForm"
    :combobox-project-options="comboboxProjectOptions"
    :combobox-task-options="comboboxTaskOptions"
    :combobox-assignee-options="comboboxAssigneeOptions"
    :team-members="teamMembers"
    :nature-options="natureOptions"
    :is-dark-mode="isDarkMode"
    @submit="saveNewPlannedTask"
    @time-change="onNewTaskTimeChange"
    @duration-preset="setNewTaskDurationPreset"
  />

  <!-- ========================================== -->
  <!-- ADJUST TIMESHEET TIMING MODAL DIALOG       -->
  <!-- ========================================== -->
  <AdjustTimingModal
    v-model="showAdjustModal"
    v-model:adjust-mode="adjustMode"
    :is-tracking="isTracking"
    :is-manager="isManager"
    :is-dark-mode="isDarkMode"
    :adjust-form="adjustForm"
    :keep-running-elapsed-formatted="keepRunningElapsedFormatted"
    :min-timesheet-date="minTimesheetDate"
    :today-date="todayDate"
    :original-start-time-formatted="originalStartTimeFormatted"
    :adjust-duration-minutes="adjustDurationMinutes"
    :adjust-duration-formatted="adjustDurationFormatted"
    :adjust-duration-short="adjustDurationShort"
    @nudge="nudgeAdjustTime"
    @set-end-now="setAdjustEndNow"
    @apply-start-time="applyAdjustedStartTime"
    @submit-timesheet="submitAdjustedTimesheet"
  />

  <!-- ========================================== -->
  <!-- PILLAR 3: RUNAWAY TIMER ALERT DIALOG        -->
  <!-- ========================================== -->
  <RunawayTimerModal
    v-model="showRunawayAlertModal"
    :guard-data="runawayGuardData"
    :choice="runawayChoice"
    :is-dark-mode="isDarkMode"
    @select-option="resolveRunawayOption"
    @confirm="confirmRunawayResolution"
  />

  <!-- ========================================== -->
  <!-- PILLAR 5: EOD WRAP-UP RECONCILIATION MODAL -->
  <!-- ========================================== -->
  <EODWrapUpModal
    v-model="showEODModal"
    :summary="eodSummary"
    :pending-blocks="eodPendingBlocks"
    @convert-all="convertAllPendingPlannedBlocks"
    @convert-block="quickConvertPlanToActual"
    @complete="showEODModal = false; showToast('EOD review complete! Great work today.', 'success');"
  />

  <!-- ========================================== -->
  <!-- SWITCH ACTIVE TASK MODAL DIALOG            -->
  <!-- ========================================== -->
  <SwitchTaskModal
    v-model="showSwitchTaskModal"
    v-model:wrap-up-note="switchWrapUpNote"
    v-model:search-query="switchSearchQuery"
    :formatted-time="formattedTime"
    :is-bound="!!trackerBoundBlock"
    :candidates="switchCandidates"
    @switch-to="executeSwitchTask"
  />

  <!-- ========================================== -->
  <!-- WRAP & START NEXT SESSION CONFIRMATION     -->
  <!-- ========================================== -->
  <WrapAndStartNextModal
    v-model="showSwitchConfirmModal"
    v-model:wrap-up-note="switchWrapUpNote"
    :formatted-time="formattedTime"
    :current-session-label="(trackerBoundBlock && (trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label || trackerBoundBlock.deliverable_notes)) || trackerNotes || 'Active Work Session'"
    :selected-project="selectedProject"
    :selected-nature="selectedNature"
    :target-item="switchTargetItem"
    :is-switching="isSwitchingSession"
    :is-dark-mode="isDarkMode"
    @confirm="confirmSwitchAndStart"
  />

  <!-- ========================================== -->
  <!-- CANCEL WORK BLOCK MODAL DIALOG             -->
  <!-- ========================================== -->
  <CancelWorkBlockModal
    v-model="showCancelModal"
    :target-block="cancelTargetBlock"
    :cancel-form="cancelForm"
    :reasons="cancelReasons"
    :is-tracking-this-block="isTracking && trackerBlockName === (cancelTargetBlock && cancelTargetBlock.name)"
    :formatted-time="formattedTime"
    :busy="plannerBusy"
    :is-dark-mode="isDarkMode"
    @confirm="submitCancelBlock"
  />

  <!-- ========================================== -->
  <!-- EDIT LOGGED WORK SESSION MODAL DIALOG       -->
  <!-- ========================================== -->
  <EditSessionModal
    v-model="showEditSessionModal"
    :edit-form="editSessionForm"
    :duration-hours="editSessionDuration"
    :is-saving="isSavingEditSession"
    :is-dark-mode="isDarkMode"
    @save="saveEditSession"
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
