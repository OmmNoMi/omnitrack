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
  <header class="sticky top-0 z-40 border-b px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 transition-colors duration-200 shrink-0" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200 shadow-xs'">
    
    <!-- Authentic Brand Identity -->
    <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
      <img src="/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg" alt="OmniTrack" class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-xs object-contain cursor-pointer shrink-0" @click="activeTab = 'dashboard'">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-bold text-sm sm:text-base tracking-tight truncate" :class="isDarkMode ? 'text-white' : 'text-gray-900'">OmniTrack</span>
        <span v-if="isClient" class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center gap-1 shrink-0">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
          Client Portal
        </span>
      </div>
    </div>

    <!-- Header Controls: Stopwatch & Menu (Pure Frappe UI) -->
    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
      
      <!-- Header stopwatch: click (or Shift+S) elevates to the session timesheet in full focus -->
      <f-button
        v-if="!isClient"
        :variant="isTracking ? (isSessionElevated ? 'solid' : 'subtle') : 'subtle'"
        :theme="isTracking ? (isSessionElevated ? 'blue' : 'red') : 'gray'"
        size="sm"
        class="font-mono !rounded-full !px-2.5 sm:!px-3 !py-1 text-xs font-bold transition-all cursor-pointer"
        :aria-label="isTracking ? (isSessionElevated ? 'Minimize full focus (Shift+S / Esc)' : 'Full focus (Shift+S)') : 'Start session (Shift+S)'"
        :title="isTracking ? (isSessionElevated ? 'Minimize full focus (Shift+S / Esc)' : 'Full focus (Shift+S)') : 'Start session (Shift+S)'"
        @click="toggleSessionFocus"
      >
        <template #prefix>
          <span class="w-2 h-2 rounded-full mr-1 inline-block" :class="isTracking ? (isSessionElevated ? 'bg-white animate-pulse' : 'bg-red-500 pulse-record') : 'bg-gray-400'"></span>
        </template>
        <span>{{ formattedTime }}</span>
        <template #suffix>
          <svg v-if="isTracking && !isSessionElevated" class="w-3 h-3 ml-1 text-red-500 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </template>
      </f-button>

      <!-- Raven Team Collaboration Launcher -->
      <f-button
        variant="subtle"
        theme="purple"
        size="sm"
        class="!rounded-full !px-2.5 sm:!px-3 !py-1 text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
        aria-label="Open Raven Collaboration"
        title="Open Raven Team Chat"
        @click="openRavenApp"
      >
        <template #prefix>
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </template>
        <span class="hidden sm:inline">Raven Chat</span>
      </f-button>

      <!-- Notification Status / Permission Button -->
      <f-button
        v-if="notificationPermission !== 'granted'"
        variant="subtle"
        :theme="notificationPermission === 'denied' ? 'red' : 'blue'"
        size="sm"
        class="!rounded-full !px-2.5 !py-1 text-xs font-semibold flex items-center gap-1 cursor-pointer"
        :title="notificationPermission === 'denied' ? 'Notifications blocked in browser settings' : 'Enable Mobile Notifications for timesheets'"
        :aria-label="notificationPermission === 'denied' ? 'Notifications blocked' : 'Enable Mobile Notifications'"
        @click="enableNotificationsUserGesture"
      >
        <template #prefix>
          <span>{{ notificationPermission === 'denied' ? '🔕' : '🔔' }}</span>
        </template>
        <span class="hidden sm:inline">{{ notificationPermission === 'denied' ? 'Alerts Blocked' : 'Enable Alerts' }}</span>
      </f-button>

      <!-- App Menu (Pure Frappe UI FDropdownMenu) -->
      <f-dropdown-menu
        :items="headerMenuItems"
        aria-label="OmniTrack Menu"
        align="right"
      >
        <template #trigger="{ isOpen }">
          <f-button
            variant="subtle"
            theme="gray"
            size="sm"
            class="!rounded-full !p-2 flex items-center justify-center cursor-pointer"
            aria-label="Menu"
            :aria-expanded="isOpen ? 'true' : 'false'"
          >
            <template #prefix>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <line x1="4" y1="7" x2="20" y2="7"></line>
                <line x1="4" y1="12" x2="20" y2="12"></line>
                <line x1="4" y1="17" x2="20" y2="17"></line>
              </svg>
            </template>
          </f-button>
        </template>
      </f-dropdown-menu>

    </div>

  </header>

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
  <div v-if="hoverCard" class="fixed z-50 w-64 rounded-xl border shadow-xl p-2.5 space-y-1.5 pointer-events-auto"
    :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100 shadow-black/40' : 'bg-white border-gray-200 text-gray-900 shadow-gray-400/20'"
    :style="{ left: hoverCard.left + 'px', top: hoverCard.top + 'px' }"
    @mouseenter="cancelHideHover"
    @mouseleave="hideBlockHover"
    role="tooltip">
    
    <!-- Title & Compact Status Badge -->
    <div class="flex items-start justify-between gap-1.5">
      <div class="text-xs font-bold leading-tight break-words line-clamp-2">
        <template v-if="hoverCard.source === 'logged'">
          {{ (hoverCard.seg && hoverCard.seg.notes) || hoverCard.block.task_subject || hoverCard.block.work_item_label || 'Logged Work Session' }}
        </template>
        <template v-else>
          {{ hoverCard.block.task_subject || hoverCard.block.work_item_label || hoverCard.block.deliverable_notes || 'Work block' }}
        </template>
      </div>
      <span v-if="hoverCard.seg && hoverCard.seg.is_live_active" class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 animate-pulse">
        🔴 Live
      </span>
      <span v-else-if="hoverCard.source === 'logged'" class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        ✓ {{ fmtHrs((hoverCard.seg && hoverCard.seg.hours) || hoverCard.block.actual_hours) }}h
      </span>
      <span v-else-if="isBlockLocked(hoverCard.block)" class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        🔒 Past
      </span>
    </div>

    <!-- Meta row: Time & Project -->
    <div class="flex items-center justify-between gap-2 text-[10px]" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
      <div class="font-mono font-medium flex items-center gap-1">
        <span>⏱</span>
        <span>{{ segTimeTitle(hoverCard.seg) }}</span>
      </div>
      <div v-if="hoverCard.block.project_name || hoverCard.block.project" class="truncate max-w-[120px]" :title="hoverCard.block.project_name || hoverCard.block.project">
        📁 {{ hoverCard.block.project_name || hoverCard.block.project }}
      </div>
    </div>

    <!-- Footer Action: View Details link -->
    <div class="pt-1 border-t flex items-center justify-between text-[11px]" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
      <span v-if="hoverCard.block.timesheet || (hoverCard.seg && hoverCard.seg.timesheet)" class="text-[9px] font-mono font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[120px]">
        TS: {{ hoverCard.seg && hoverCard.seg.timesheet ? hoverCard.seg.timesheet : hoverCard.block.timesheet }}
      </span>
      <span v-else class="text-[9px] text-gray-400">{{ hoverCard.block.work_date }}</span>

      <button type="button"
        @click.stop="openBlockDrawer(hoverCard.block); hideBlockHoverNow()"
        class="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-0.5 cursor-pointer ml-auto">
        <span>View Details</span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </div>
  </div>


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
  <nav class="fixed bottom-0 left-0 right-0 z-40 border-t flex items-center justify-around px-3 py-2 transition-colors pb-safe backdrop-blur-md" :class="isDarkMode ? 'bg-[#1E1F22]/95 border-gray-800 shadow-2xl' : 'bg-white/95 border-gray-200 shadow-lg'" role="tablist" aria-label="Workstation navigation">
    <div class="w-full max-w-xl mx-auto flex items-center justify-around">
      
      <!-- Dashboard Tab -->
      <f-button 
        variant="ghost"
        :theme="activeTab === 'dashboard' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'dashboard' ? '!text-blue-500 font-bold' : (isDarkMode ? '!text-gray-400 font-medium' : '!text-gray-500 font-medium')"
        role="tab"
        :aria-selected="activeTab === 'dashboard' ? 'true' : 'false'"
        aria-label="Dashboard"
        @click="activeTab = 'dashboard'"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"></rect><rect x="14" y="3" width="7" height="5" rx="1.5"></rect><rect x="14" y="12" width="7" height="9" rx="1.5"></rect><rect x="3" y="16" width="7" height="5" rx="1.5"></rect></svg>
        </template>
        <span class="text-[10px] mt-0.5">Dashboard</span>
      </f-button>

      <!-- Calendar Tab -->
      <f-button 
        variant="ghost"
        :theme="activeTab === 'planner' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'planner' ? '!text-blue-500 font-bold' : (isDarkMode ? '!text-gray-400 font-medium' : '!text-gray-500 font-medium')"
        role="tab"
        :aria-selected="activeTab === 'planner' ? 'true' : 'false'"
        aria-label="Calendar"
        @click="activeTab = 'planner'"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="8" y1="14" x2="10" y2="14"></line><line x1="14" y1="14" x2="16" y2="14"></line></svg>
        </template>
        <span class="text-[10px] mt-0.5">Calendar</span>
      </f-button>

      <!-- Floating Quick Start/Stop Timer Button in Center -->
      <f-button 
        variant="solid"
        :theme="isTracking ? 'red' : 'blue'"
        size="lg"
        class="relative shrink-0 !h-14 !flex !flex-col !items-center !justify-center shadow-xl active:scale-90 transition-all -mt-6 ring-4 cursor-pointer !p-0"
        :class="[
          isDarkMode ? 'ring-[#1E1F22]' : 'ring-white',
          (isTracking && bottomBarTimer.isHours) ? '!w-auto !min-w-[4.75rem] !px-3 !rounded-full shadow-2xl' : '!w-14 !rounded-full'
        ]"
        aria-label="Open the current session timesheet"
        :title="isTracking ? 'Open the session timesheet — recording ' + formattedTime : 'Open the session timesheet'"
        @click="openSessionCard"
      >
        <template v-if="isTracking">
          <!-- Under 1 hour: Show MM:SS with clear min:sec helper and live ticking -->
          <div v-if="!bottomBarTimer.isHours" class="flex flex-col items-center justify-center leading-none select-none">
            <span class="text-[13px] font-mono font-black tabular-nums tracking-tight text-white leading-none">
              {{ bottomBarTimer.primary }}
            </span>
            <span class="text-[7px] font-mono font-bold uppercase tracking-wider text-red-100 opacity-90 mt-0.5 leading-none">
              min:sec
            </span>
          </div>

          <!-- 1 hour or more: Dynamically expand into a sleek stadium capsule showing hours, minutes, seconds -->
          <div v-else class="flex flex-col items-center justify-center leading-none select-none px-0.5">
            <div class="flex items-baseline gap-0.5 text-white leading-none">
              <span class="text-[12px] font-mono font-black tabular-nums leading-none">{{ bottomBarTimer.hours }}h</span>
              <span class="text-[12px] font-mono font-black tabular-nums leading-none">{{ bottomBarTimer.minutes }}m</span>
              <span class="text-[10px] font-mono font-semibold tabular-nums text-red-200 opacity-95 ml-0.5 leading-none">{{ bottomBarTimer.seconds }}s</span>
            </div>
            <span class="text-[7px] font-mono font-bold uppercase tracking-wider text-red-100 opacity-90 mt-0.5 leading-none flex items-center gap-1">
              <span class="w-1 h-1 rounded-full bg-white animate-ping"></span>
              <span>REC</span>
            </span>
          </div>
        </template>
        <span v-else class="text-[11px] font-extrabold uppercase tracking-wide leading-none">Log</span>
      </f-button>

      <!-- Timesheets Tab -->
      <f-button 
        variant="ghost"
        :theme="activeTab === 'timesheets' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'timesheets' ? '!text-blue-500 font-bold' : (isDarkMode ? '!text-gray-400 font-medium' : '!text-gray-500 font-medium')"
        role="tab"
        :aria-selected="activeTab === 'timesheets' ? 'true' : 'false'"
        aria-label="Timesheets"
        @click="activeTab = 'timesheets'"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </template>
        <span class="text-[10px] mt-0.5">Timesheets</span>
      </f-button>

      <!-- Team Tab (if Manager) or + Task -->
      <f-button 
        v-if="isManager"
        variant="ghost"
        :theme="activeTab === 'attendance' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'attendance' ? '!text-blue-500 font-bold' : (isDarkMode ? '!text-gray-400 font-medium' : '!text-gray-500 font-medium')"
        role="tab"
        :aria-selected="activeTab === 'attendance' ? 'true' : 'false'"
        aria-label="Team"
        @click="activeTab = 'attendance'"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        </template>
        <span class="text-[10px] mt-0.5">Team</span>
      </f-button>
      <f-button 
        v-else
        variant="ghost"
        theme="gray"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="isDarkMode ? '!text-gray-400 font-medium' : '!text-gray-500 font-medium'"
        aria-label="Create a new task"
        @click="openNewTaskModal"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </template>
        <span class="text-[10px] mt-0.5">+ Task</span>
      </f-button>

    </div>
  </nav>

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
