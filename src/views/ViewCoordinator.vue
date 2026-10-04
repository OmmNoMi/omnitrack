<template>
  <div class="omnitrack-view-coordinator flex-1 flex flex-col min-h-0">
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
      @open-block-drawer="$emit('open-block-drawer', $event)"
      @open-task-raven-drawer="$emit('open-task-raven-drawer', $event)"
      @open-book-modal="$emit('open-book-modal', $event)"
      @open-eod-modal="$emit('open-eod-modal', $event)"
      @start-session="$emit('start-session', $event)"
      @stop-session="$emit('stop-session')"
      @switch-task="$emit('switch-task', $event)"
      @toggle-all-blocks="$emit('toggle-all-blocks')"
      @set-timeline-zoom="$emit('set-timeline-zoom', $event)"
      @navigate-timeline-day="$emit('navigate-timeline-day', $event)"
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
      @open-block-drawer="$emit('open-block-drawer', $event)"
      @approve-timesheet="$emit('approve-timesheet', $event)"
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
      @fetch-pending-approvals="$emit('fetch-pending-approvals')"
      @approve-all-pending="$emit('approve-all-pending')"
      @approve-block="$emit('approve-block', $event)"
      @open-block-drawer="$emit('open-block-drawer', $event)"
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
      @open-book-modal="$emit('open-book-modal', $event)"
      @open-block-drawer="$emit('open-block-drawer', $event)"
      @open-task-details="$emit('open-task-details', $event)"
      @open-task-raven-drawer="$emit('open-task-raven-drawer', $event)"
      @start-task-immediately="$emit('start-task-immediately', $event)"
      @plan-attention-task="$emit('plan-attention-task', $event)"
      @start-focus-session="$emit('start-focus-session', $event)"
      @stop-focus-session="$emit('stop-focus-session')"
      @toggle-task-expansion="$emit('toggle-task-expansion', $event)"
      @cell-drag-over="$emit('cell-drag-over', $event)"
      @cell-drop="$emit('cell-drop', $event)"
      @drag-start="$emit('drag-start', $event)"
      @navigate-day="$emit('navigate-day', $event)"
      @navigate-today="$emit('navigate-today')"
      @navigate-date="$emit('navigate-date', $event)"
      @set-view-mode="$emit('set-view-mode', $event)"
      @show-block-hover="$emit('show-block-hover', $event)"
      @hide-block-hover="$emit('hide-block-hover')"
    />
  </div>
</template>

<script>
export default {
  name: "ViewCoordinator",
  props: {
    activeTab: { type: String, default: "dashboard" },
    isDarkMode: { type: Boolean, default: false },
    isManager: { type: Boolean, default: false },
    isClient: { type: Boolean, default: false },
    todayDate: { type: String, default: "" },
    selectedDashboardDate: { type: String, default: "" },
    clientDeliveredHours: { type: [Number, String], default: 0 },
    clientInProgressCount: { type: [Number, String], default: 0 },
    clientTotalPlannedHours: { type: [Number, String], default: 0 },
    clientReliabilityRate: { type: [Number, String], default: 0 },
    clientTasks: { type: Array, default: () => [] },
    clientSessions: { type: Array, default: () => [] },
    clientUpcomingBlocks: { type: Array, default: () => [] },
    teamMembers: { type: Array, default: () => [] },
    selectedEmployee: { type: String, default: "" },
    employeeMenuItems: { type: Array, default: () => [] },
    dashboardDateDisplay: { type: String, default: "" },
    isTodayTimeline: { type: Boolean, default: true },
    timelineZoomMode: { type: String, default: "stretch" },
    timelineMembers: { type: Array, default: () => [] },
    redLineLeftPct: { type: Number, default: 0 },
    currentTimelineTimeFormatted: { type: String, default: "" },
    adherenceTheme: { type: String, default: "blue" },
    adherenceEmoji: { type: String, default: "🎯" },
    totalCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    cancelledCount: { type: Number, default: 0 },
    totalLogged: { type: [Number, String], default: 0 },
    totalPlanned: { type: [Number, String], default: 0 },
    adherencePct: { type: Number, default: 100 },
    paginatedBlocks: { type: Array, default: () => [] },
    allBlocksExpanded: { type: Boolean, default: false },
    fmtHrs: { type: Function, default: (h) => (Number(h) || 0).toFixed(1) },
    hhmm: { type: Function, default: () => "" },
    isBlockCompleted: { type: Function, default: () => false },
    isBlockLocked: { type: Function, default: () => false },
    timesheetHorizon: { type: String, default: "week" },
    totalFilteredHours: { type: [Number, String], default: 0 },
    filteredWorkBlocks: { type: Array, default: () => [] },
    pendingApprovals: { type: Array, default: () => [] },
    loadingApprovals: { type: Boolean, default: false },
    attendancePresence: { type: Object, default: () => ({}) },
    synthesizerLogs: { type: Array, default: () => [] },
    hourlyPresence: { type: Array, default: () => [] },
    filteredPlannerTasks: { type: Array, default: () => [] },
    plannerBusy: { type: Boolean, default: false },
    plannerTaskSearch: { type: String, default: "" },
    plannerTaskFilter: { type: String, default: "all" },
    calendarViewMode: { type: String, default: "day" },
    plannerDate: { type: String, default: "" },
    plannerDateDisplay: { type: String, default: "" },
    plannerData: { type: Object, default: () => ({}) },
    calendarDays: { type: Array, default: () => [] },
    activeSession: { type: Object, default: null },
    isTracking: { type: Boolean, default: false },
    nowLineTop: { type: Number, default: 0 },
    hoverCard: { type: Object, default: null }
  },
  emits: [
    "open-block-drawer",
    "open-task-raven-drawer",
    "open-book-modal",
    "open-eod-modal",
    "start-session",
    "stop-session",
    "switch-task",
    "toggle-all-blocks",
    "set-timeline-zoom",
    "navigate-timeline-day",
    "approve-timesheet",
    "fetch-pending-approvals",
    "approve-all-pending",
    "approve-block",
    "open-task-details",
    "start-task-immediately",
    "plan-attention-task",
    "start-focus-session",
    "stop-focus-session",
    "toggle-task-expansion",
    "cell-drag-over",
    "cell-drop",
    "drag-start",
    "navigate-day",
    "navigate-today",
    "navigate-date",
    "set-view-mode",
    "show-block-hover",
    "hide-block-hover"
  ]
};
</script>
