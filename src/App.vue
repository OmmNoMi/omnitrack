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

          <!-- Genuine Frappe UI Timesheet Session Box (Compiled via Vite + @frappe/ui) -->
          <frappe-ui-timesheet-box
            v-if="hasFrappeUI && isTracking"
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
          ></frappe-ui-timesheet-box>

          <f-card v-else-if="isTracking" :highlight="sessionCardFlash" class="transition-all duration-200">
            
            <!-- One timesheet, two panes: its lines on the left, the session meta on the right. -->
            <div class="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x transition-all scroll-mt-28 px-0.5"
              :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">
          
          <!-- LEFT PANE: the lines of this session — Shift+S lands here, Tab reaches Stop & Save -->
          <div class="lg:col-span-6 flex flex-col pb-5 lg:pb-0 lg:pr-6">
            
            <div class="flex-1 min-h-0 flex flex-col justify-between">
              <!-- Header -->
              <div class="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-gray-200/80 dark:border-gray-800">
                <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Current Session Log</h4>
                <f-badge
                  theme="gray"
                  size="xs"
                  :aria-label="sessionNotesList.length + ' lines logged'">{{ sessionNotesList.length }}</f-badge>
              </div>

              <!-- Running Lines List -->
              <div ref="sessionNotesScroll" class="max-h-[220px] min-h-0 space-y-1.5 overflow-y-auto px-1 py-0.5">
                <!-- chronological: the line you just typed lands at the bottom, next to the input -->
                <div 
                  v-for="row in sessionNotesRows" 
                  :key="row.i"
                  data-log-row
                  :tabindex="activeSessionRowIndex === row.i ? 0 : -1"
                  @focus="activeSessionRowIndex = row.i"
                  @keydown="onLogRowKey($event, row)"
                  :aria-label="'Line ' + row.n + ': ' + row.t + '. Press Enter to remove, Right Arrow for delete button.'"
                  class="group flex items-start justify-between gap-2 pl-2 pr-2.5 py-2 rounded-xl border text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/70 bg-white border-gray-200/90 text-gray-800 shadow-2xs dark:bg-[#2B2D30] dark:border-gray-700/80 dark:text-gray-200">
                  <div class="flex items-start gap-2 min-w-0">
                    <f-badge theme="blue" size="xs" variant="subtle" class="!w-5 !h-5 !p-0 shrink-0 select-none">{{ row.n }}</f-badge>
                    <!-- a line can be a paragraph now, so keep the author's breaks -->
                    <span class="font-medium min-w-0 whitespace-pre-line break-words">{{ row.t }}</span>
                  </div>
                  <f-button 
                    data-remove-line-btn
                    variant="ghost"
                    theme="red"
                    size="xs"
                    :tabindex="activeSessionRowIndex === row.i ? 0 : -1"
                    @click.stop="removeSessionPoint(row.i)"
                    @keydown="onRemoveBtnKey($event, row)"
                    title="Remove this line (Delete / Enter)"
                    aria-label="Remove line"
                    class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity !p-0.5 !h-auto !w-auto text-gray-400 hover:text-red-500 focus:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                    ✕
                  </f-button>
                </div>

                <!-- Empty State prompt -->
                <div v-if="sessionNotesList.length === 0" class="text-center py-6 border border-dashed rounded-xl border-gray-300 text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <!-- The `/` key is a keyboard affordance: on a phone there is no key
                       to press, so point at the box instead of at a shortcut. -->
                  <div class="text-xs font-medium lg:hidden">No lines yet — write your first one below</div>
                  <div class="text-xs font-medium hidden lg:block">No lines yet — press <kbd class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 border text-[10px] font-mono text-gray-600 dark:text-gray-300">/</kbd> to start</div>
                  <!-- Say the rule up front, so Stop is never a surprise refusal. -->
                  <div v-if="isTracking" class="text-[11px] mt-1.5">At least one line is needed to save this session</div>
                </div>
              </div>
            </div>

            <!-- Single-Line Add Input Bar at the Bottom -->
            <div class="flex items-end gap-2 pt-3 border-t mt-auto" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200/80'">
              <div class="relative flex-1">
                <textarea
                  rows="1"
                  ref="sessionPointInput"
                  v-model="newSessionPoint"
                  @input="growSessionPoint"
                  @keydown.enter="onSessionPointEnter"
                  @keydown.up="onSessionPointUp"
                  aria-label="Add a timesheet line"
                  aria-describedby="session-point-hint"
                  placeholder="What did you just complete?"
                  class="w-full text-xs rounded-xl pl-3.5 pr-3.5 lg:pr-9 py-2 outline-none border transition-colors shadow-xs focus:ring-2 resize-none overflow-y-auto leading-5 max-h-40 block"
                  :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500/25' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20'"></textarea>
                <kbd v-if="!newSessionPoint" title="Press / or Shift+S anywhere to jump here"
                  class="hidden lg:block absolute right-2 bottom-[7px] pointer-events-none font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  :class="isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-500'">/</kbd>
              </div>
              <!-- f-button's size prop pins its own height, so it sat 9px shorter than
                   the textarea next to it. Pin it back to the input's height instead of
                   nudging padding, which only held at one font size. Enter is the real
                   way this gets used; the button is the discoverable copy of it. -->
              <f-button 
                variant="solid" 
                theme="blue"
                size="sm"
                @click="addSessionPoint"
                tabindex="-1"
                :disabled="!newSessionPoint.trim()"
                title="Add this line (Enter)"
                aria-keyshortcuts="Enter"
                class="!h-[37px] rounded-xl px-3.5 shadow-xs font-bold shrink-0">
                <span>Add</span>
                <template #suffix>
                  <kbd class="hidden lg:inline-block font-mono text-[10px] font-bold leading-none px-1.5 py-0.5 rounded border border-white/30 bg-white/15 text-white/90"
                    aria-hidden="true">&crarr;</kbd>
                </template>
              </f-button>
            </div>
            <p id="session-point-hint" class="sr-only">Press Enter to add the line. Press Shift and Enter together to start a new line within the same entry.</p>

          </div>

          <!-- RIGHT PANE: the same session's meta — timer, bound block, title, project -->
          <div class="lg:col-span-6 flex flex-col gap-3.5 pt-5 lg:pt-0 lg:pl-6">
            <div>
              <!-- Header / Status Context -->
              <div v-if="trackerBlockName" class="flex items-center justify-end gap-2 pb-2.5">
                <f-badge theme="blue" size="xs" class="max-w-[170px] truncate" title="Bound to Calendar Block">
                  📅 Bound to Block
                </f-badge>
              </div>

              <!-- Timer & Main Action Hero Bar -->
              <div class="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap px-3 py-2.5 rounded-xl border transition-colors"
                :class="[isDarkMode ? 'bg-[#25262A] border-gray-800' : 'bg-gray-50 border-gray-200', trackerBlockName ? 'mt-3' : '']">
                <div class="flex items-center gap-2.5 min-w-0 shrink-0">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="isTracking ? 'bg-red-500 animate-pulse' : 'bg-gray-400'"></span>
                  <div class="min-w-0">
                    <div class="font-mono text-xl font-bold tracking-tight tabular-nums leading-none"
                      :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                      {{ formattedTime }}
                    </div>
                    <!-- An elapsed count says how long, never since when. On a timesheet
                         the start is the fact that has to be defensible, so show it. -->
                    <div v-if="isTracking && sessionStart" class="text-[10px] font-semibold mt-1 whitespace-nowrap"
                      :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
                      Started {{ sessionStart.date }} &middot; {{ sessionStart.time }}
                    </div>
                  </div>
                  <span v-if="trackerBoundBlock" class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                    📦 {{ trackerBoundBlock.name }}
                  </span>
                  <span v-else-if="!isTracking" class="text-[10px] uppercase font-bold tracking-wider text-gray-400">standby</span>
                </div>

                <div class="flex items-center gap-1.5 shrink-0 ml-auto" role="toolbar" aria-orientation="horizontal"
                  aria-label="Session controls" data-session-toolbar @keydown="onSessionToolbarKey" @focusout="onSessionToolbarFocusOut">
                <!-- A mis-started session has to be abandonable without writing a timesheet. -->
                <f-button
                  v-if="isTracking"
                  data-session-tool="discard"
                  :tabindex="sessionToolTabindex('discard')"
                  :variant="discardConfirm ? 'solid' : 'outline'"
                  :theme="discardConfirm ? 'amber' : 'gray'"
                  size="sm"
                  @click="discardSession"
                  :aria-label="(discardConfirm ? 'Confirm discard: throw this session away without saving' : 'Discard this session without saving') + '. Keyboard shortcut ' + (isMacLike ? 'Command' : 'Control') + ' D'"
                  :title="discardConfirm ? 'Press again to discard (' + modKey + 'D)' : 'Discard without saving (' + modKey + 'D)'"
                  class="font-bold py-2 px-3">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </template>
                  <span>{{ discardConfirm ? 'Discard?' : 'Discard' }}</span>
                  <template #suffix>
                    <kbd class="hidden lg:inline-block font-mono text-[10px] font-bold leading-none px-1.5 py-1 rounded border"
                      :class="isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300' : 'border-gray-300 bg-gray-100 text-gray-500'"
                      aria-hidden="true">{{ modKey }}D</kbd>
                  </template>
                </f-button>

                <!-- Adjust timing button: allows ±5m or custom start/end datetime adjustment -->
                <f-button
                  v-if="isTracking"
                  data-session-tool="adjust"
                  :tabindex="sessionToolTabindex('adjust')"
                  variant="outline"
                  theme="gray"
                  size="sm"
                  @click="openAdjustModal"
                  :aria-label="'Adjust start and end datetime of this timesheet. Keyboard shortcut ' + (isMacLike ? 'Command' : 'Control') + ' E'"
                  :title="'Adjust start/end time — ±5 min or backdate (' + modKey + 'E)'"
                  class="font-bold py-2 px-3">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </template>
                  <span>Adjust</span>
                  <template #suffix>
                    <kbd class="hidden lg:inline-block font-mono text-[10px] font-bold leading-none px-1.5 py-1 rounded border"
                      :class="isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-300' : 'border-gray-300 bg-gray-100 text-gray-500'"
                      aria-hidden="true">{{ modKey }}E</kbd>
                  </template>
                </f-button>

                <!-- 1-Tap Client No-Show / Cancel Quick Action -->
                <f-button
                  v-if="isTracking && trackerBoundBlock"
                  data-session-tool="noshow"
                  :tabindex="sessionToolTabindex('noshow')"
                  variant="outline"
                  theme="red"
                  size="sm"
                  @click="openCancelModalForActive"
                  :aria-label="'Mark meeting as Client No-Show or Cancel block'"
                  :title="'Client No-Show / Cancel block (' + modKey + 'N)'"
                  class="font-bold py-2 px-3">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </template>
                  <span>No-Show</span>
                </f-button>

                <!-- 1-Click Unplanned Urgent Escalation Action -->
                <f-button
                  v-if="!isTracking"
                  data-session-tool="unplanned"
                  :tabindex="sessionToolTabindex('unplanned')"
                  variant="subtle"
                  theme="amber"
                  size="sm"
                  @click="startUnplannedEscalation"
                  class="font-bold py-2 px-3 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60"
                  title="Start an ad-hoc, urgent, or spontaneous session (logs exclusively to Logged lane)"
                  aria-label="Start ad-hoc urgent session">
                  <template #prefix>
                    <span aria-hidden="true">⚠️</span>
                  </template>
                  <span>Ad-hoc / Urgent</span>
                </f-button>

                <f-button
                  data-session-tool="stop"
                  :tabindex="sessionToolTabindex('stop')"
                  @click="toggleTrack"
                  variant="solid"
                  :theme="isTracking ? 'red' : 'blue'"
                  size="sm"
                  :aria-label="(isTracking ? 'Stop the active session and file its timesheet' : 'Start session and begin recording timesheet') + '. Keyboard shortcut ' + (isMacLike ? 'Command' : 'Control') + ' S'"
                  :title="!isTracking ? 'Start a session (' + modKey + 'S)' : (sessionHasLines ? 'Stop the session (' + modKey + 'S) — your lines are already saved' : 'Add at least one line before stopping — a timesheet with no description cannot be saved')"
                  class="font-bold py-2 px-3.5">
                  <template #prefix>
                    <svg v-if="!isTracking" class="w-3 h-3 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                    <svg v-else class="w-3 h-3 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>
                  </template>
                  <!-- Just "Stop": every line here is already saved as it is typed, so
                       "Save" implied work was at risk. The shortcut rides in the label. -->
                  <span>{{ isTracking ? 'Stop' : 'Start Session' }}</span>
                  <template #suffix>
                    <kbd class="hidden lg:inline-block font-mono text-[10px] font-bold leading-none px-1.5 py-1 rounded border border-white/30 bg-white/15 text-white/90"
                      aria-hidden="true">{{ modKey }}S</kbd>
                  </template>
                </f-button>
                </div>
              </div>
            </div>

            <!-- What this session is bound to: the block's own title, timing and notes -->
            <div v-if="trackerBoundBlock" class="rounded-2xl border px-3.5 py-3 space-y-2 bg-blue-50/70 border-blue-200/90 dark:bg-blue-950/30 dark:border-blue-800/60 shadow-2xs">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-blue-600 text-white shrink-0 shadow-2xs">
                    📦 {{ trackerBoundBlock.name }}
                  </span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 shrink-0">
                    {{ trackerBoundBlock.status || 'Planned' }}
                  </span>
                  <span class="text-xs font-bold text-blue-950 dark:text-blue-100 truncate" :title="trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label">
                    {{ trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label || 'Work block' }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[11px] font-mono font-bold text-blue-800 dark:text-blue-300">
                    {{ hhmm(trackerBoundBlock.start_time) }}–{{ hhmm(trackerBoundBlock.end_time) }}
                  </span>
                  <button
                    type="button"
                    @click="bindSessionToBlock(null)"
                    class="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Unbind from this Planned Work Block"
                    aria-label="Unbind block"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <!-- Detailed Connected Task Row -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px] border-t border-blue-200/60 dark:border-blue-900/50 pt-2 text-blue-900 dark:text-blue-200">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="font-bold text-gray-500 dark:text-gray-400 shrink-0">🎯 Task:</span>
                  <span class="font-semibold truncate text-blue-950 dark:text-blue-100">
                    {{ trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label || trackerBoundBlock.task || 'General Task' }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 min-w-0 sm:justify-end">
                  <span class="font-bold text-gray-500 dark:text-gray-400 shrink-0">🗂 Project:</span>
                  <span class="font-medium truncate text-blue-900 dark:text-blue-200">
                    {{ trackerBoundBlock.project_name || trackerBoundBlock.project || 'General Work (Internal)' }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-blue-700/90 dark:text-blue-300/90 pt-0.5">
                  <span>📅 {{ trackerBoundBlock.work_date }}</span>
                  <span>🏷 {{ trackerBoundBlock.task_nature }}</span>
                  <span v-if="trackerBoundBlock.duration_hours">⏱ planned {{ fmtHrs(trackerBoundBlock.duration_hours) }}</span>
                  <span v-if="trackerBoundBlock.actual_hours">· logged {{ fmtHrs(trackerBoundBlock.actual_hours) }}</span>
                </div>
                <div class="sm:text-right text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  Timesheet will log against <strong class="font-mono">{{ trackerBoundBlock.name }}</strong>
                </div>

                <!-- Early Start Recognition Badge -->
                <div v-if="earlyStartMinutes > 0" class="col-span-full pt-1">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Started {{ earlyStartMinutes }}m early &middot; Scheduled plan: {{ trackerBoundBlock.start_time }}</span>
                  </span>
                </div>

                <!-- Overrun Grace Banner -->
                <div v-if="isBlockOverrun" class="col-span-full pt-1 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800 text-[11px] shadow-2xs">
                  <div class="flex items-center gap-1.5 font-medium">
                    <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    <span>Session exceeded planned end time by <strong class="font-bold">{{ overrunMinutes }}m</strong></span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" @click="quickExtendActiveBlock(15)" class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 hover:bg-amber-300 text-amber-900 dark:bg-amber-900 dark:hover:bg-amber-800 dark:text-amber-100 transition-colors cursor-pointer" title="Extend planned block by +15 minutes">+15m</button>
                    <button type="button" @click="quickExtendActiveBlock(30)" class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 hover:bg-amber-300 text-amber-900 dark:bg-amber-900 dark:hover:bg-amber-800 dark:text-amber-100 transition-colors cursor-pointer" title="Extend planned block by +30 minutes">+30m</button>
                  </div>
                </div>
              </div>

              <!-- Interactive Action Items / Focus Tasks Checklist in Live Session -->
              <div v-if="trackerBoundBlock.connected_tasks && trackerBoundBlock.connected_tasks.length" 
                class="mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-900/50 space-y-1.5">
                <div class="flex items-center justify-between text-[11px] font-bold text-blue-950 dark:text-blue-100">
                  <span class="flex items-center gap-1.5">
                    <span>Focus Tasks</span>
                    <span class="text-[10px] font-medium text-blue-700 dark:text-blue-300">({{ getBlockTasksDoneCount(trackerBoundBlock) }}/{{ trackerBoundBlock.connected_tasks.length }} completed)</span>
                  </span>
                  <button type="button" class="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    @click="openBlockDrawer(trackerBoundBlock)">Manage / Add ↗</button>
                </div>

                <div class="space-y-1 max-h-36 overflow-y-auto pr-1">
                  <div v-for="(item, idx) in trackerBoundBlock.connected_tasks" :key="item.id || item.ref || idx"
                    class="flex items-start gap-2 p-1.5 rounded-lg border text-xs transition-colors"
                    :class="isTaskDone(item) ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-900/40 text-gray-400 line-through' : 'bg-emerald-50/50 border-emerald-200/60 text-gray-500 line-through') : (isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white' : 'bg-white border-blue-200/80 text-gray-900')">
                    
                    <input type="checkbox" :checked="isTaskDone(item)" @change="toggleTaskDone(trackerBoundBlock, item)"
                      class="mt-0.5 w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer shrink-0">
                    <span class="min-w-0 flex-1 leading-snug break-words">{{ item.subject || item.title || item.task }}</span>
                    <span v-if="isTaskDone(item)" class="text-[9px] font-bold text-emerald-500 shrink-0">✓ Done</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form: Deliverable Title & Dropdowns -->
            <div class="space-y-3">
              <!-- Deliverable / Task Select Dropdown (Search-to-Select Open ToDo or Planned Block) -->
              <div class="relative" data-todo-picker-container>
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 shrink-0">
                      Task / Open ToDo
                    </label>
                    <span v-if="trackerBlockName" class="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <span>🔗 Block: {{ trackerBlockName }}</span>
                      <button type="button" @click="bindSessionToBlock(null)" class="hover:text-red-500 font-bold ml-0.5" title="Unbind from block">✕</button>
                    </span>
                    <span v-else-if="trackerBoundBlock" class="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      <span>🔗 Block: {{ trackerBoundBlock.name }}</span>
                      <button type="button" @click="bindSessionToBlock(null)" class="hover:text-red-500 font-bold ml-0.5" title="Unbind from block">✕</button>
                    </span>
                  </div>
                  <div v-if="openTodos.length > 0" class="text-[10px] text-gray-400 font-medium">
                    {{ openTodos.length }} open ToDo{{ openTodos.length > 1 ? 's' : '' }}
                  </div>
                </div>

                <!-- Dropdown Trigger Button (Styled like Frappe UI Select) -->
                <div class="relative">
                  <button
                    type="button"
                    @click="toggleTodoPicker"
                    class="w-full flex items-center justify-between text-xs font-medium rounded-xl px-3.5 py-2.5 outline-none border transition-colors shadow-2xs !bg-white !border-gray-300 !text-gray-900 hover:!border-gray-400 focus:!border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:!bg-[#2B2D30] dark:!border-gray-700 dark:!text-white cursor-pointer"
                    aria-label="Select open ToDo or Task"
                  >
                    <div class="flex items-center gap-2 truncate min-w-0 flex-1">
                      <span v-if="trackerBlockName || trackerBoundBlock" class="text-blue-500 shrink-0">📅</span>
                      <span v-else-if="trackerNotes" class="text-blue-500 shrink-0">📋</span>
                      <span v-else class="text-gray-400 shrink-0">🔍</span>
                      <span class="truncate" :class="trackerNotes ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'">
                        {{ trackerNotes || 'Select an open ToDo or search tasks...' }}
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0 ml-2">
                      <svg class="w-3.5 h-3.5 text-gray-400 transition-transform" :class="{ 'rotate-180': todoDropdownOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </button>

                  <!-- A control inside a control is invalid HTML: the parser closes the
                       outer <button> at the inner one and every following </div> then
                       lands on the wrong element, collapsing the page. Keep Clear a
                       sibling of the trigger, placed over it. -->
                  <button
                    v-if="trackerNotes"
                    type="button"
                    @click.stop="clearSelectedTodo"
                    class="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Clear selection"
                    aria-label="Clear selected ToDo"
                  >
                    ✕
                  </button>

                  <!-- Popover Menu with Embedded Search -->
                  <div
                    v-if="todoDropdownOpen"
                    class="absolute left-0 right-0 top-full mt-1.5 w-full max-h-72 overflow-hidden rounded-2xl bg-white dark:bg-[#1E1F22] border border-gray-200 dark:border-gray-700 shadow-2xl z-50 flex flex-col"
                  >
                    <!-- Search Input at top of Popover -->
                    <div class="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#25272B]">
                      <div class="relative flex items-center">
                        <svg class="w-3.5 h-3.5 absolute left-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                        </svg>
                        <input
                          ref="todoSearchInput"
                          v-model="todoSearchQuery"
                          type="text"
                          placeholder="Type to search open ToDos..."
                          class="w-full pl-9 pr-7 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16171A] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                          @keydown.esc="todoDropdownOpen = false"
                          @keydown.enter.prevent="onTodoSearchEnter"
                        />
                        <button v-if="todoSearchQuery" type="button" @click="todoSearchQuery = ''" class="absolute right-2.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </div>
                    </div>

                    <!-- Scrollable Options List -->
                    <div class="overflow-y-auto flex-1 p-1.5 space-y-1">
                      <!-- Group: Open ToDos -->
                      <div v-if="filteredOpenTodos.length > 0">
                        <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center justify-between">
                          <span>📋 Open ToDos</span>
                          <span class="font-mono text-[9px]">{{ filteredOpenTodos.length }}</span>
                        </div>
                        <button
                          v-for="(t, idx) in filteredOpenTodos"
                          :key="'todo-' + idx"
                          type="button"
                          @click="selectTodoToAutofill(t)"
                          class="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-blue-50/80 dark:hover:bg-blue-950/40 transition-colors flex flex-col gap-1 cursor-pointer group"
                          :class="trackerNotes === (t.subject || t.title || t.name) ? 'bg-blue-50 dark:bg-blue-950/60 font-semibold' : ''"
                        >
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {{ t.subject || t.title || t.name }}
                            </span>
                            <span v-if="t.priority" class="text-[9px] font-bold px-1.5 py-0.2 rounded" :class="t.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'">
                              {{ t.priority }}
                            </span>
                          </div>
                          <div class="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                            <span v-if="t.project_name || t.project" class="truncate font-medium text-blue-600 dark:text-blue-400">
                              🗂 {{ t.project_name || t.project }}
                            </span>
                            <span v-if="t.due_date">📅 Due {{ t.due_date }}</span>
                          </div>
                        </button>
                      </div>

                      <!-- Group: Today's Planned Blocks -->
                      <div v-if="filteredPlannedBlocks.length > 0" class="pt-1 border-t border-gray-100 dark:border-gray-800">
                        <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center justify-between">
                          <span>📅 Today's Planned Blocks</span>
                          <span class="font-mono text-[9px]">{{ filteredPlannedBlocks.length }}</span>
                        </div>
                        <button
                          v-for="(b, idx) in filteredPlannedBlocks"
                          :key="'block-' + idx"
                          type="button"
                          @click="selectPlannedBlock(b)"
                          class="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-blue-50/80 dark:hover:bg-blue-950/40 transition-colors flex flex-col gap-1 cursor-pointer group"
                          :class="trackerBlockName === b.name ? 'bg-blue-50 dark:bg-blue-950/60 font-semibold' : ''"
                        >
                          <div class="flex items-center justify-between gap-1">
                            <span class="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {{ b.task_subject || b.work_item_label || 'Work Block' }}
                            </span>
                            <span class="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">{{ b.name }}</span>
                          </div>
                          <div class="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                            <span class="font-mono">{{ b.start_time }}–{{ b.end_time }}</span>
                            <span v-if="b.project_name || b.project">🗂 {{ b.project_name || b.project }}</span>
                            <span v-if="b.task_nature">🏷 {{ b.task_nature }}</span>
                          </div>
                        </button>
                      </div>

                      <!-- Custom Title Option -->
                      <div v-if="showCustomOption" class="pt-1 border-t border-gray-100 dark:border-gray-800">
                        <button
                          type="button"
                          @click="selectCustomTitle"
                          class="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-200"
                        >
                          <span class="text-sm">✏️</span>
                          <span class="truncate">Use custom title: <strong class="text-blue-600 dark:text-blue-400">"{{ todoSearchQuery.trim() }}"</strong></span>
                        </button>
                      </div>

                      <!-- Empty State -->
                      <div v-if="filteredOpenTodos.length === 0 && filteredPlannedBlocks.length === 0 && !showCustomOption" class="py-6 text-center text-xs text-gray-400">
                        No open ToDos or planned blocks found
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Two Dropdowns: Project & Activity Nature (Frappe UI FDropdown) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <!-- Assigned Project -->
                <div>
                  <label class="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">Project</label>
                  <f-dropdown
                    v-model="selectedProject"
                    :options="dropdownItems('project')"
                    placeholder="General Work (Internal)"
                    aria-label="Project"
                    @change="syncActiveSession"
                  ></f-dropdown>
                </div>

                <!-- Activity Nature -->
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Activity Nature</label>
                    <span v-if="isNonWorkingNature(selectedNature)" class="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      Non-Paid
                    </span>
                  </div>
                  <f-dropdown
                    v-model="selectedNature"
                    :options="dropdownItems('nature')"
                    placeholder="Select activity nature"
                    aria-label="Activity nature"
                    @change="syncActiveSession"
                  ></f-dropdown>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Shortcut legend: one quiet line under the whole card, ordered the way the
             work flows — write a line, then break it, then stop. Keyboard-only, so it
             is hidden on phones where none of it can be pressed. -->
        <p class="hidden lg:flex flex-wrap items-center gap-x-2 gap-y-1 mt-4 pt-3 border-t text-[10px] leading-none"
          :class="isDarkMode ? 'border-gray-800 text-gray-500' : 'border-gray-200/80 text-gray-400'">
          <span class="font-bold uppercase tracking-wider">Shortcuts</span>
          <span><kbd class="font-mono font-bold">/</kbd> jump to the line box</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">Shift</kbd>+<kbd class="font-mono font-bold">Enter</kbd> new line in the same entry</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">Enter</kbd> add the line</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">{{ modKey }}S</kbd> stop the session</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">{{ modKey }}E</kbd> adjust its times</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">{{ modKey }}D</kbd> discard it</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">Shift</kbd>+<kbd class="font-mono font-bold">S</kbd> full focus</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">Shift</kbd>+<kbd class="font-mono font-bold">P</kbd> plan</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">Shift</kbd>+<kbd class="font-mono font-bold">T</kbd> task</span>
          <span aria-hidden="true">·</span>
          <span><kbd class="font-mono font-bold">Shift</kbd>+<kbd class="font-mono font-bold">D</kbd> day</span>
        </p>

      </f-card>  <!-- /Desk Remote HUD card -->
        </div>
      </div>
    </teleport>

    <!-- ======================================== -->
    <!-- TAB 1: EXECUTIVE DASHBOARD & GOOGLE MEET AGENDA -->
    <!-- ======================================== -->
    <div v-if="activeTab === 'dashboard'" class="space-y-6">

      <!-- ===================================================================== -->
      <!-- EXECUTIVE CLIENT PORTAL: PROJECT PULSE & DAILY SCORECARD              -->
      <!-- ===================================================================== -->
      <section v-if="isClient" class="space-y-6" aria-label="Project Pulse">
        <!-- Executive Welcome Banner -->
        <div class="rounded-3xl p-6 border shadow-sm transition-all"
          :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  CampusCredit CATMA
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Operations
                </span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black mt-2 tracking-tight">Executive Project Pulse</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Real-time delivery status, engineering sprints, and support sessions managed by <strong class="text-gray-700 dark:text-gray-300">OmmNoMi Automation LLP</strong>.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <div class="text-[10px] font-bold uppercase text-gray-400">Selected Date</div>
                <div class="text-sm font-extrabold">{{ selectedDashboardDate === todayDate ? "Today (" + todayDate + ")" : selectedDashboardDate }}</div>
              </div>
            </div>
          </div>

          <!-- Quick Metrics Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Delivered Today</div>
              <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {{ fmtHrs(clientDeliveredHours) }}h
              </div>
            </div>
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Engineering</div>
              <div class="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {{ clientInProgressCount }} session{{ clientInProgressCount === 1 ? '' : 's' }}
              </div>
            </div>
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Planned Today</div>
              <div class="text-lg font-black text-gray-800 dark:text-gray-200 mt-0.5">
                {{ fmtHrs(clientTotalPlannedHours) }}h
              </div>
            </div>
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Reliability Rate</div>
              <div class="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
                {{ clientReliabilityRate }}%
              </div>
            </div>
          </div>
        </div>

        <!-- Today's Story Scorecard -->
        <div class="space-y-4">
          <h3 class="text-sm font-extrabold uppercase tracking-wider text-gray-500 px-1">Today's Delivery Scorecard</h3>

          <!-- Card 1: Completed Deliverables -->
          <div v-if="clientCompletedBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed Deliverables ({{ clientCompletedBlocks.length }})</h4>
              </div>
              <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{{ fmtHrs(clientCompletedHours) }}h total</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientCompletedBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-gray-600 dark:text-gray-300">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">✓ {{ b.status || 'Completed' }}</span>
                    <span v-if="b.task_nature" class="text-[10px] text-gray-400">🏷 {{ b.task_nature }}</span>
                  </div>
                  <div class="text-sm font-bold text-gray-900 dark:text-white">{{ b.task_subject || b.deliverable_notes }}</div>
                  <div v-if="b.deliverable_notes && b.deliverable_notes !== b.task_subject" class="text-xs text-gray-500 dark:text-gray-400">{{ b.deliverable_notes }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{{ fmtHrs(b.actual_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">planned {{ fmtHrs(b.duration_hours) }}h</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: In Progress -->
          <div v-if="clientInProgressBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-blue-200 dark:border-blue-900 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">In Progress · Active Engineering ({{ clientInProgressBlocks.length }})</h4>
              </div>
              <span class="text-xs font-bold text-blue-600 dark:text-blue-400">Active</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientInProgressBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">🔄 In Progress</span>
                  </div>
                  <div class="text-sm font-bold text-gray-900 dark:text-white">{{ b.task_subject || b.deliverable_notes }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ b.deliverable_notes || 'Active engineering sprint' }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-black font-mono text-blue-600 dark:text-blue-400">{{ fmtHrs(b.actual_hours || b.duration_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">allocated</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 3: Rescheduled & Cancelled -->
          <div v-if="clientCancelledBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Rescheduled & Cancelled ({{ clientCancelledBlocks.length }})</h4>
              </div>
              <span class="text-xs font-bold text-gray-400">Audited Schedule Variance</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientCancelledBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-gray-500 line-through">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="b.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'">
                      {{ b.status === 'Cancelled' ? (b.cancel_reason ? 'Cancelled (' + b.cancel_reason + ')' : 'Cancelled') : 'Rescheduled ↗' }}
                    </span>
                  </div>
                  <div class="text-sm font-bold text-gray-600 dark:text-gray-300 line-through">{{ b.task_subject || b.deliverable_notes }}</div>
                  <div class="text-xs text-gray-400">
                    <span v-if="b.cancel_reason">Reason: {{ b.cancel_reason }} · </span>
                    <span v-if="b.actual_hours > 0">{{ fmtHrs(b.actual_hours) }}h wait logged</span>
                    <span v-else>Freed capacity returned to engineering</span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-mono text-gray-400">{{ fmtHrs(b.actual_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">planned {{ fmtHrs(b.duration_hours) }}h</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 4: Upcoming Scheduled -->
          <div v-if="clientUpcomingBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-400">Upcoming Scheduled ({{ clientUpcomingBlocks.length }})</h4>
              </div>
              <span class="text-xs font-mono font-bold text-gray-500">{{ fmtHrs(clientUpcomingHours) }}h total</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientUpcomingBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">📅 Scheduled</span>
                  </div>
                  <div class="text-sm font-bold text-gray-900 dark:text-white">{{ b.task_subject || b.deliverable_notes }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-black font-mono text-gray-700 dark:text-gray-300">{{ fmtHrs(b.duration_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">planned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================================================================== -->
      <!-- INTERNAL TEAM WORKSTATION (ENGINEER / MANAGER VIEW)                   -->
      <!-- ===================================================================== -->
      <div v-else class="space-y-6">

        <!-- 1. HERO AGENDA: HAPPENING NOW & UP NEXT (Top Priority - Instant Start) -->
      <!-- ===================================================================== -->
      <section v-if="untrackedCurrentBlocks.length > 0 || (selectedDashboardDate === todayDate && upNextBlock)" aria-labelledby="hero-now-heading" class="space-y-3">
        
        <!-- Case 1: Happening Now (Excludes block actively tracked in top cockpit) -->
        <div 
          v-for="b in untrackedCurrentBlocks" 
          :key="'hero-now-' + b.name"
          @click="openBlockDrawer(b)"
          class="rounded-3xl p-5 sm:p-6 border shadow-sm transition-all duration-200 border-l-4 cursor-pointer hover:shadow-md"
          :class="isTracking && trackerBlockName === b.name ? (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-red-500 text-white' : 'bg-white border-gray-200 border-l-red-500 text-gray-900') : (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-blue-500 text-white' : 'bg-white border-gray-200 border-l-blue-500 text-gray-900')">
          
          <div class="flex items-center justify-between gap-3 mb-2.5">
            <h3 id="hero-now-heading" class="text-xs font-black uppercase tracking-wider flex items-center gap-2"
              :class="isTracking && trackerBlockName === b.name ? 'text-red-500' : 'text-blue-500'">
              <span class="w-2.5 h-2.5 rounded-full" :class="isTracking && trackerBlockName === b.name ? 'bg-red-500 animate-pulse' : 'bg-blue-500'"></span>
              <span>{{ isTracking && trackerBlockName === b.name ? 'Recording Right Now' : 'Happening Now' }}</span>
            </h3>
            <span v-if="isTracking && trackerBlockName === b.name" class="font-mono font-bold text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
              ● Live Session Active
            </span>
          </div>

          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-2 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <!-- Start Time Pill -->
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black"
                  :class="isTracking && trackerBlockName === b.name ? 'bg-red-600 text-white' : (isDarkMode ? 'bg-blue-950/70 text-blue-300 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200')">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>{{ formatBlockRange(b) }}</span>
                </span>

                <!-- Dynamic Status Pill -->
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider" :class="getBlockTimingInfo(b).pillClass">
                  {{ getBlockTimingInfo(b).label }}
                </span>

                <!-- Nature Badge -->
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" :class="getNatureBadge(b.task_nature).badgeClass">
                  <span v-html="getNatureBadge(b.task_nature).svgIcon" class="w-3 h-3 flex items-center justify-center" aria-hidden="true"></span>
                  <span>{{ getNatureBadge(b.task_nature).label }}</span>
                </span>

                <!-- Project -->
                <span v-if="b.project_name || b.project" class="text-xs text-gray-500 dark:text-gray-400">
                  📁 {{ b.project_name || b.project }}
                </span>
              </div>

              <!-- Title -->
              <h3 class="text-lg sm:text-xl font-extrabold leading-snug transition-colors"
                :class="isTracking && trackerBlockName === b.name ? 'text-red-500 dark:text-red-400' : ''">
                {{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}
              </h3>

              <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <span v-if="b.task" class="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                  📋 Task: {{ b.task }}
                </span>
                <span>👤 {{ b.associate_name || b.employee }}</span>
                <span aria-hidden="true">·</span>
                <span>Expected: <strong class="font-mono font-bold">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
                <span v-if="b.actual_hours">· Logged: <strong class="text-emerald-500 font-mono font-bold">{{ Number(b.actual_hours).toFixed(1) }}h</strong></span>
                <span v-if="b.variance_hours !== undefined && b.actual_hours > 0" :class="b.variance_hours <= 0 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'">
                  ({{ b.variance_hours <= 0 ? '' : '+' }}{{ Number(b.variance_hours).toFixed(1) }}h variance)
                </span>
              </div>
            </div>

            <!-- Start / Stop Session Button -->
            <div class="flex items-center gap-3 self-stretch md:self-center justify-end">
              <template v-if="isTracking && trackerBlockName === b.name">
                <span class="font-mono font-bold text-sm tabular-nums" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'" aria-label="Elapsed time">{{ formattedTime }}</span>
                <button 
                  type="button"
                  @click.stop="requestStopFocusBlock(b)"
                  :aria-label="stopConfirmName === b.name ? 'Stop and save without any log lines' : 'Stop the session and save the timesheet'"
                  class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  :class="stopConfirmName === b.name ? 'bg-red-600 border-red-600 text-white hover:bg-red-700' : (isDarkMode ? 'border-red-800 text-red-300 hover:bg-red-950/40' : 'border-red-300 text-red-700 hover:bg-red-50')">
                  <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>
                  <span>{{ stopConfirmName === b.name ? 'Stop anyway' : 'Stop & save' }}</span>
                </button>
                <button
                  type="button"
                  @click.stop="discardSession"
                  :aria-label="discardConfirm ? 'Confirm discard: throw this session away without saving' : 'Discard this session without saving'"
                  class="inline-flex items-center justify-center px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  :class="discardConfirm ? 'bg-amber-500 border-amber-500 text-white' : (isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100')">
                  {{ discardConfirm ? 'Discard?' : 'Discard' }}
                </button>
                <button
                  type="button"
                  @click.stop="openAdjustModal"
                  aria-label="Adjust start and end datetime of this timesheet"
                  title="Adjust start/end time"
                  class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Adjust</span>
                </button>
              </template>
              <template v-else>
                <button
                  type="button"
                  v-if="!isBlockLocked(b)"
                  @click.stop="openBlockDrawer(b)"
                  :aria-label="'Reschedule ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                  title="Reschedule this planned block"
                  class="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-xs sm:text-sm font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  :class="isDarkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Reschedule</span>
                </button>
                <button 
                  type="button"
                  @click.stop="startFocusBlock(b)"
                  :aria-label="'Start session for ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                  class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-[#1A73E8] hover:bg-blue-700 ring-4 ring-blue-500/20 shadow-md transition-all cursor-pointer select-none active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <span>Start Session</span>
                </button>
              </template>
            </div>
          </div>

          <!-- Working-on-this indicator -->
          <div v-if="isTracking && trackerBlockName === b.name"
            class="mt-3.5 pt-3 border-t flex items-center gap-2 flex-wrap text-[11px] font-semibold"
            :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'"
            role="status" aria-live="polite">
            <span class="inline-flex items-center gap-1.5" :class="isDarkMode ? 'text-red-300' : 'text-red-600'">
              <span class="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden="true"></span>
              <span>{{ (b.associate_name || b.employee) === currentUserFullName ? 'You are working on this' : (b.associate_name || b.employee) + ' is working on this' }}</span>
            </span>
            <span aria-hidden="true" class="text-gray-300 dark:text-gray-700">·</span>
            <span class="text-gray-500 dark:text-gray-400" v-if="sessionNotesList.length">{{ sessionNotesList.length }} line{{ sessionNotesList.length === 1 ? '' : 's' }} in the session log</span>
            <button v-else type="button" @click.stop="focusSessionPointInput"
              class="underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              :class="isDarkMode ? 'text-blue-300' : 'text-blue-600'">Nothing logged yet — add a line</button>
          </div>
        </div>

        <!-- Case 2: Up Next Card (Next Scheduled Block on Today's Agenda) -->
        <div 
          v-if="upNextBlock && !isBlockInNow(upNextBlock)"
          class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200"
          :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          
          <div class="flex items-center justify-between gap-3 mb-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500/70"></span>
              <span>Up Next</span>
              <span class="text-gray-400 dark:text-gray-600">·</span>
              <span class="text-blue-600 dark:text-blue-400 font-semibold lowercase">{{ getStartsInText(upNextBlock) }}</span>
            </h4>
            <span class="text-[11px] font-mono text-gray-400 font-semibold">{{ formatBlockRange(upNextBlock) }}</span>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1.5 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" :class="getNatureBadge(upNextBlock.task_nature).badgeClass">
                  <span v-html="getNatureBadge(upNextBlock.task_nature).svgIcon" class="w-3 h-3 flex items-center justify-center" aria-hidden="true"></span>
                  <span>{{ getNatureBadge(upNextBlock.task_nature).label }}</span>
                </span>
                <span v-if="upNextBlock.project_name || upNextBlock.project" class="text-xs text-gray-500 dark:text-gray-400">
                  📁 {{ upNextBlock.project_name || upNextBlock.project }}
                </span>
                <span v-if="upNextBlock.task" class="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                  📋 Task: {{ upNextBlock.task }}
                </span>
              </div>

              <h4 class="text-base sm:text-lg font-bold leading-snug truncate">
                {{ upNextBlock.task_subject || upNextBlock.deliverable_notes || 'Focus Work Block' }}
              </h4>

              <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>Expected: <strong class="font-mono font-bold">{{ Number(upNextBlock.duration_hours || 0).toFixed(1) }}h</strong></span>
              </div>
            </div>

            <!-- Up Next Actions -->
            <div class="flex items-center gap-2 self-stretch sm:self-center justify-end">
              <a
                v-if="getMeetUrl(upNextBlock)"
                :href="getMeetUrl(upNextBlock)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all select-none cursor-pointer"
                aria-label="Open Meeting Link"
              >
                <span>Join Meet ↗</span>
              </a>
              <button
                type="button"
                v-if="!isBlockLocked(upNextBlock)"
                @click.stop="openBlockDrawer(upNextBlock)"
                :aria-label="'Reschedule ' + (upNextBlock.task_subject || 'Work Block')"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                :class="isDarkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
                <span>Reschedule</span>
              </button>
              <button 
                type="button"
                @click.stop="startFocusBlock(upNextBlock)"
                :aria-label="'Start session now for ' + (upNextBlock.task_subject || 'Work Block')"
                class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#1A73E8] hover:bg-blue-700 ring-2 ring-blue-500/20 shadow-xs transition-all cursor-pointer select-none active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                <span>Start Session</span>
              </button>
            </div>
          </div>
        </div>

      </section>

      <!-- 2. Attention Needed: Overdue & Underplanned Tasks (WCAG 2.1 AA Compliant) -->
      <section v-if="attentionTasks && attentionTasks.length > 0" 
        aria-labelledby="attention-tasks-heading"
        class="rounded-3xl border-2 p-4 sm:p-5 transition-all shadow-sm"
        :class="isDarkMode ? 'bg-[#1E1F22] border-amber-500/50 text-white' : 'bg-amber-50/70 border-amber-400 text-gray-900'">
        
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3.5">
          <div class="flex items-center gap-2.5">
            <span class="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs" aria-hidden="true">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h3 id="attention-tasks-heading" class="text-sm sm:text-base font-extrabold tracking-tight">
                  Action Required: Overdue & Underplanned Tasks
                </h3>
                <f-badge theme="red" variant="solid" size="xs">
                  {{ attentionTasks.length }} {{ attentionTasks.length === 1 ? 'task' : 'tasks' }}
                </f-badge>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                Tasks that are past due or have fewer hours booked in your calendar than needed to complete them.
              </p>
            </div>
          </div>
          <f-button 
            variant="ghost"
            theme="blue"
            size="sm"
            @click="openPlannerWithFilter(attentionFilter)"
            aria-label="Open Planner Calendar to allocate time">
            <span>Open Planner Calendar</span>
            <template #suffix><span aria-hidden="true">→</span></template>
          </f-button>
        </div>

        <!-- Real-world Quick Filter Bar & Search -->
        <div class="flex items-center justify-between gap-2.5 flex-wrap pt-2.5 pb-1 mb-2 border-t border-amber-200/60 dark:border-amber-900/40">
          <div class="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Filter action required tasks" @keydown="onAttentionTabKeydown">
            <f-button
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'all' ? 'solid' : 'subtle'"
              theme="gray"
              :aria-selected="attentionFilter === 'all'"
              :tabindex="attentionFilter === 'all' ? 0 : -1"
              data-attention-tab="all"
              @click="setAttentionFilter('all')"
            >
              <span>All</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ attentionTasks.length }})</span>
              </template>
            </f-button>
            <f-button
              v-if="overdueTasksCount > 0"
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'overdue' ? 'solid' : 'subtle'"
              theme="red"
              :aria-selected="attentionFilter === 'overdue'"
              :tabindex="attentionFilter === 'overdue' ? 0 : -1"
              data-attention-tab="overdue"
              @click="setAttentionFilter('overdue')"
            >
              <template #prefix><span aria-hidden="true">⚠️</span></template>
              <span>Overdue</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ overdueTasksCount }})</span>
              </template>
            </f-button>
            <f-button
              v-if="underplannedTasksCount > 0"
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'underplanned' ? 'solid' : 'subtle'"
              theme="amber"
              :aria-selected="attentionFilter === 'underplanned'"
              :tabindex="attentionFilter === 'underplanned' ? 0 : -1"
              data-attention-tab="underplanned"
              @click="setAttentionFilter('underplanned')"
            >
              <template #prefix><span aria-hidden="true">⏱️</span></template>
              <span>Underplanned</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ underplannedTasksCount }})</span>
              </template>
            </f-button>
            <f-button
              v-if="dueSoonTasksCount > 0"
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'due_soon' ? 'solid' : 'subtle'"
              theme="blue"
              :aria-selected="attentionFilter === 'due_soon'"
              :tabindex="attentionFilter === 'due_soon' ? 0 : -1"
              data-attention-tab="due_soon"
              @click="setAttentionFilter('due_soon')"
            >
              <template #prefix><span aria-hidden="true">📅</span></template>
              <span>Due Soon</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ dueSoonTasksCount }})</span>
              </template>
            </f-button>
          </div>

          <!-- Quick Search -->
          <div class="relative w-full sm:w-48 ml-auto">
            <f-input
              size="sm"
              v-model="attentionSearch"
              placeholder="Search tasks..."
              aria-label="Search action required tasks"
            >
              <template #prefix>
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </template>
              <template #suffix>
                <button v-if="attentionSearch" @click="attentionSearch = ''" type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs cursor-pointer p-0.5" aria-label="Clear search">✕</button>
              </template>
            </f-input>
          </div>
        </div>

        <!-- Attention Task Cards Grid with 2D Roving Tabindex -->
        <div v-if="visibleAttentionTasks.length === 0" class="text-center py-6 border border-dashed rounded-2xl"
          :class="isDarkMode ? 'border-gray-800 text-gray-400' : 'border-amber-200 text-gray-500'">
          <span>No tasks found matching this filter.</span>
          <button type="button" class="ml-1.5 text-blue-500 font-bold hover:underline" @click="attentionFilter = 'all'; attentionSearch = ''">Clear filter</button>
        </div>
        <ul v-else role="grid" class="space-y-2.5" :aria-rowcount="visibleAttentionTasks.length" aria-colcount="4" aria-label="Action required overdue and underplanned task table. Use arrow keys to navigate rows and actions.">
          <li 
            v-for="(t, rIdx) in visibleAttentionTasks" 
            :key="t.ref || t.id || t.docname"
            role="row"
            :aria-rowindex="rIdx + 1"
            @click="openTaskDetails(t)"
            class="rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer hover:shadow-md"
            :class="isDarkMode ? 'bg-[#2B2D30]/90 border-gray-700/80 hover:border-amber-500/50' : 'bg-white border-amber-200 hover:border-amber-400 shadow-xs'">
            
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-1.5 flex-1 min-w-0">
                <!-- Badges: Clean, Non-Redundant -->
                <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <f-badge v-if="t.days_overdue > 0" theme="red" variant="solid" size="xs">
                    Overdue {{ t.days_overdue }}d
                  </f-badge>
                  <f-badge v-else-if="t.is_due_today" theme="amber" variant="solid" size="xs">
                    Due Today
                  </f-badge>

                  <f-badge v-if="t.deficit_hours > 0" theme="amber" variant="subtle" size="xs">
                    {{ Number(t.deficit_hours).toFixed(1) }}h Deficit
                  </f-badge>
                  <f-badge v-else-if="t.is_unplanned" theme="amber" variant="subtle" size="xs">
                    Unplanned
                  </f-badge>

                  <f-badge v-if="t.priority === 'Urgent' || t.priority === 'High'" theme="red" variant="subtle" size="xs">
                    {{ t.priority }} Priority
                  </f-badge>

                  <f-badge v-if="t.due_date" theme="gray" variant="outline" size="xs">
                    📅 {{ t.due_date }}
                  </f-badge>

                  <f-badge v-if="t.project_name || t.project" theme="gray" variant="subtle" size="xs">
                    📁 {{ t.project_name || t.project }}
                  </f-badge>
                </div>

                <!-- Subject (Column 0 in Roving Tabindex) -->
                <h4 class="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-snug">
                  <button 
                    type="button"
                    @click.stop="openTaskDetails(t)"
                    :title="'Open details panel for ' + t.subject"
                    :tabindex="attentionTabindex(rIdx, 0)"
                    :data-attention-row="rIdx"
                    :data-attention-col="0"
                    @focus="setAttentionRoving(rIdx, 0)"
                    @keydown="onAttentionGridKey($event, rIdx, 0)"
                    class="text-left font-bold hover:underline hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer">
                    <span>{{ t.subject }}</span>
                    <span class="text-xs font-normal text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">View details →</span>
                  </button>
                  <a 
                    :href="getTaskDeskUrl(t)" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    @click.stop
                    :title="'Open ' + (t.doctype || 'Task') + ' ' + (t.docname || t.id) + ' in Desk'"
                    class="ml-1.5 inline-flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-40 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                    :aria-label="'Open ' + (t.doctype || 'Task') + ' in Desk'">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </h4>

                <!-- Planning Metrics Pill (Zero Redundant Sentences) -->
                <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px]"
                    :class="t.is_unplanned ? 'bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'">
                    <span>Booked:</span>
                    <strong :class="t.booked_hours > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'">{{ Number(t.booked_hours || 0).toFixed(1) }}h</strong>
                    <template v-if="t.estimate_hours > 0">
                      <span>/ {{ Number(t.estimate_hours).toFixed(1) }}h est.</span>
                    </template>
                  </span>
                  <span v-if="t.logged_hours > 0" class="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                    · Logged: {{ Number(t.logged_hours).toFixed(1) }}h
                  </span>
                </div>
              </div>

              <!-- Action Buttons (Columns 1, 2, 3 in Roving Tabindex) -->
              <div class="flex items-center gap-2 self-stretch sm:self-center flex-wrap sm:flex-nowrap pt-1 sm:pt-0">
                <!-- Schedule in Planner (Col 1) -->
                <f-button 
                  variant="subtle" 
                  theme="blue" 
                  size="sm" 
                  @click.stop="planAttentionTask(t)"
                  :tabindex="attentionTabindex(rIdx, 1)"
                  :data-attention-row="rIdx"
                  :data-attention-col="1"
                  @focus="setAttentionRoving(rIdx, 1)"
                  @keydown="onAttentionGridKey($event, rIdx, 1)"
                  :aria-label="'Schedule ' + t.subject + ' into planner calendar'">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </template>
                  <span>Plan in Calendar</span>
                </f-button>

                <!-- Immediate Focus Session (Col 2) -->
                <f-button 
                  variant="solid" 
                  theme="blue" 
                  size="sm" 
                  @click.stop="startTaskImmediately(t)"
                  :tabindex="attentionTabindex(rIdx, 2)"
                  :data-attention-row="rIdx"
                  :data-attention-col="2"
                  @focus="setAttentionRoving(rIdx, 2)"
                  @keydown="onAttentionGridKey($event, rIdx, 2)"
                  :aria-label="'Start focus session now for ' + t.subject">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                  </template>
                  <span>Start Now</span>
                </f-button>

                <!-- Raven Task Discussion & Specs (Col 3) -->
                <f-button 
                  variant="subtle" 
                  theme="purple" 
                  size="sm" 
                  @click.stop="openTaskRavenDrawer(t)"
                  :tabindex="attentionTabindex(rIdx, 3)"
                  :data-attention-row="rIdx"
                  :data-attention-col="3"
                  @focus="setAttentionRoving(rIdx, 3)"
                  @keydown="onAttentionGridKey($event, rIdx, 3)"
                  :aria-label="'Discuss and view specs for ' + t.subject">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h6"/></svg>
                  </template>
                  <span>Discuss</span>
                </f-button>

                <!-- Encapsulated Workflow Actions Dropdown Menu (Col 4) -->
                <f-dropdown-menu
                  v-if="t.workflow_actions && t.workflow_actions.length > 0"
                  :items="getTaskWorkflowMenuItems(t)"
                  title="Workflow Actions"
                  @click.stop
                  :aria-label="'Workflow actions for ' + t.subject"
                  align="right">
                  <template #trigger="{ isOpen }">
                    <f-button
                      variant="outline"
                      theme="gray"
                      size="sm"
                      :tabindex="attentionTabindex(rIdx, 4)"
                      :data-attention-row="rIdx"
                      :data-attention-col="4"
                      @focus="setAttentionRoving(rIdx, 4)"
                      @keydown="onAttentionGridKey($event, rIdx, 4)"
                      :aria-expanded="isOpen ? 'true' : 'false'"
                      :aria-label="'Workflow actions for ' + t.subject">
                      <template #prefix>
                        <svg class="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                      </template>
                      <span>Workflow</span>
                      <template #suffix>
                        <svg class="w-3 h-3 transition-transform duration-150" :class="isOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                      </template>
                    </f-button>
                  </template>
                </f-dropdown-menu>
              </div>
            </div>

          </li>
        </ul>

        <!-- Google Meet-Style Show More / Show Less Toggle -->
        <div v-if="attentionTasks.length > 3" class="pt-2.5 flex justify-center">
          <button
            type="button"
            data-attention-show-more
            @click="toggleShowAllAttentionTasks"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full border transition-all shadow-xs cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 bg-white/95 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 dark:bg-gray-800/95 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-gray-700"
            :aria-expanded="showAllAttentionTasks ? 'true' : 'false'"
            :aria-label="showAllAttentionTasks ? 'Show fewer overdue tasks' : ('Show ' + remainingAttentionTasksCount + ' more overdue tasks')">
            <span v-if="!showAllAttentionTasks" class="inline-flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              <span>Show {{ remainingAttentionTasksCount }} more</span>
            </span>
            <span v-else class="inline-flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
              <span>Show less</span>
            </span>
          </button>
        </div>

      </section>

      <!-- 3. Google Meet-Style Agenda & Focus Work Blocks -->
      <div class="space-y-4">
        
        <!-- Google Meet Date & Day Selector Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          
          <!-- Selected Date Display with Explicit 'Today' Button -->
          <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap" data-day-section>
            <!-- Title says which day you are looking at; subtitle says what is in it -->
            <div>
              <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                {{ dashboardDayTitle }}
              </h2>
              <p class="text-[11px] font-semibold mt-0.5" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
                {{ dashboardDaySummary }}
              </p>
              <p class="text-[10px] mt-1 hidden sm:block" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">
                Press <kbd class="px-1.5 py-0.5 rounded border font-mono text-[10px]" :class="isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'">Shift</kbd>
                + <kbd class="px-1.5 py-0.5 rounded border font-mono text-[10px]" :class="isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'">D</kbd>
                from anywhere, then ← → to pick a day
              </p>
            </div>
          </div>

          <!-- Google Meet Horizontal 7-Day Picker Strip (Today Centered in Middle) -->
          <div class="flex items-center gap-1 sm:gap-2 w-full sm:w-auto self-start sm:self-auto overflow-x-auto no-scrollbar py-1"
            aria-label="Pick a day" data-day-strip @keydown="onDashboardDayKey">
            <!-- Today only appears when you are away from it, on the side it lies on -->
            <button
              type="button"
              v-if="todayDirection === 'left'"
              @click="resetDashboardToToday"
              aria-label="Jump to today"
              title="Jump to today"
              class="inline-flex items-center gap-1.5 shrink-0 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-2xl border transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-95 shadow-xs mr-0.5 sm:mr-1"
              :class="isDarkMode ? 'bg-[#25262A] border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg><span>Today</span>
            </button>

            <!-- the 7 day buttons are the radiogroup; Today and the arrows are plain buttons -->
            <div class="flex items-center gap-0.5 sm:gap-2 min-w-0" role="radiogroup" aria-label="Day of the week">
            <!-- Prev Week Arrow -->
            <button 
              type="button"
              @click="shiftDashboardWeek(-1)"
              class="p-1 sm:p-2 shrink-0 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              :class="isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'"
              title="Previous 7 days"
              aria-label="Previous 7 days">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            <!-- 7 Days (Today is index 3 / Middle by default) -->
            <button 
              type="button"
              v-for="d in dashboardWeekDays" 
              :key="d.dateStr"
              @click="selectDashboardDate(d.dateStr)"
              data-day-btn
              role="radio"
              :aria-checked="d.isSelected ? 'true' : 'false'"
              :aria-label="d.dateStr"
              :tabindex="d.isSelected ? 0 : -1"
              class="flex flex-col items-center justify-center min-w-[34px] sm:min-w-[44px] py-1.5 px-0.5 sm:px-1 rounded-2xl text-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              :class="d.isSelected ? 'bg-[#1B64DA] text-white font-bold shadow-md scale-105 ring-2 ring-blue-500/30' : (isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700')">
              <span class="text-[10px] font-bold tracking-tight opacity-80">{{ d.dow }}</span>
              <span class="text-xs sm:text-sm font-extrabold mt-0.5" :class="d.isToday && !d.isSelected ? 'text-blue-500 font-black' : ''">{{ d.dayNum }}</span>
              <span v-if="d.isToday" class="w-1 h-1 rounded-full mt-0.5" :class="d.isSelected ? 'bg-white' : 'bg-blue-500'"></span>
            </button>

            <!-- Next Week Arrow -->
            <button 
              type="button"
              @click="shiftDashboardWeek(1)"
              class="p-1 sm:p-2 shrink-0 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              :class="isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'"
              title="Next 7 days"
              aria-label="Next 7 days">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            </div>
            <button
              type="button"
              v-if="todayDirection === 'right'"
              @click="resetDashboardToToday"
              aria-label="Jump to today"
              title="Jump to today"
              class="inline-flex items-center gap-1.5 shrink-0 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-2xl border transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-95 shadow-xs ml-0.5 sm:ml-1"
              :class="isDarkMode ? 'bg-[#25262A] border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'">
              <span>Today</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <!-- Define Task Action -->
          <div class="hidden sm:flex items-center gap-2">
            <button 
              @click="openNewTaskModal"
              aria-label="Plan a new focus block"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#1B64DA] hover:bg-blue-600 text-white transition-all shadow-md cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Plan Focus Block</span>
            </button>
          </div>

        </div>

        <!-- Google Meet-Style Focus Block Cards -->
        <div v-if="dayFocusBlocks.length > 0" class="space-y-4">

          <!-- Day at a glance: planned over logged, on one timeline -->
          <div v-if="dayTimeline" class="rounded-3xl p-4 sm:p-5 border shadow-xs"
            :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
            <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Day at a glance</h4>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 text-[11px] font-semibold">
                <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm border border-gray-400 bg-gray-400/20" aria-hidden="true"></span><span class="text-gray-500 dark:text-gray-400">Planned {{ dayTimeline.plannedH.toFixed(1) }}h</span></span>
                <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm bg-gray-500" aria-hidden="true"></span><span class="text-gray-500 dark:text-gray-400">Logged {{ dayTimeline.loggedH.toFixed(1) }}h</span></span>
                <span class="inline-flex items-center gap-1.5" title="Time logged when nothing was planned for it"><span class="w-3 h-2 rounded-sm bg-rose-500" aria-hidden="true"></span><span class="text-gray-500 dark:text-gray-400">Off plan</span></span>
                <span v-if="dayTimeline.gapH > 0.05" class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm bg-amber-400" aria-hidden="true"></span><span class="text-amber-600 dark:text-amber-400">{{ dayTimeline.gapH.toFixed(1) }}h unlogged</span></span>
                <span v-if="attendancePresence && attendancePresence.shift_presence_hours > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border" :class="attendancePresence.unallocated_presence_hours > 0.5 ? (isDarkMode ? 'bg-amber-950/60 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800') : (isDarkMode ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800')">
                  <span>🏢 Office Presence: {{ attendancePresence.shift_presence_hours }}h</span>
                  <span v-if="attendancePresence.unallocated_presence_hours > 0.5" class="ml-1 text-red-500 font-extrabold">({{ attendancePresence.unallocated_presence_hours }}h unallocated)</span>
                </span>
                <div class="inline-flex items-center rounded-full p-0.5 border" role="radiogroup" aria-label="Hours visible across the timeline"
                  @keydown="onTimelineZoomKey"
                  :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-100 border-gray-200'">
                  <button v-for="z in timelineZoomOptions" :key="z" type="button" role="radio"
                    :aria-checked="timelineZoom === z ? 'true' : 'false'"
                    :aria-label="z + ' hours across'"
                    data-timeline-zoom
                    :tabindex="timelineZoom === z ? 0 : -1"
                    @click="timelineZoom = z"
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    :class="timelineZoom === z ? (isDarkMode ? 'bg-[#1E1F22] text-white' : 'bg-white text-gray-900 shadow-xs') : (isDarkMode ? 'text-gray-400' : 'text-gray-500')">{{ z }}h</button>
                </div>
              </div>
            </div>
            <!-- Two named lines, not one band: what was planned, and under it what was
                 actually logged. The gutter sits outside the scroller so the labels
                 stay put while the day scrolls. -->
            <div class="flex gap-2">
            <div class="shrink-0 w-[52px] select-none text-[9px] font-bold uppercase tracking-wider pt-3.5"
              :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'" aria-hidden="true">
              <div class="h-7 leading-7">Planned</div>
              <div class="h-6 leading-6 mt-1.5">Logged</div>
              <div class="h-4 mt-0.5"></div>
            </div>
            <!-- The day is wider than the card, and a hidden scrollbar gives no hint
                 of that. Show a real button on each side that can still be scrolled,
                 so the affordance is visible and operable by keyboard (WCAG 2.1.1). -->
            <div class="relative flex-1 min-w-0">
            <button v-if="timelineCanScrollLeft" type="button" @click="nudgeTimeline(-1)"
              aria-label="Scroll timeline to earlier hours"
              class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              :class="isDarkMode ? 'bg-[#1E1F22]/90 border-gray-700 text-gray-300 hover:bg-gray-800' : 'bg-white/90 border-gray-200 text-gray-600 hover:bg-gray-50'">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button v-if="timelineCanScrollRight" type="button" @click="nudgeTimeline(1)"
              aria-label="Scroll timeline to later hours"
              class="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              :class="isDarkMode ? 'bg-[#1E1F22]/90 border-gray-700 text-gray-300 hover:bg-gray-800' : 'bg-white/90 border-gray-200 text-gray-600 hover:bg-gray-50'">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div ref="timelineScroller" @scroll="syncTimelineEdges" class="overflow-x-auto no-scrollbar w-full -mr-1 pr-1 pt-3.5">
            <div class="relative" role="img" :style="{ width: timelineTrackWidth }"
              :aria-label="dayTimeline.plannedH.toFixed(1) + ' hours planned and ' + dayTimeline.loggedH.toFixed(1) + ' hours logged on ' + selectedDashboardDateLabel">
              <!-- hour grid -->
              <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div v-for="t in dayTimeline.ticks" :key="'t' + t.m" class="absolute top-0 bottom-4 w-px"
                  :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'" :style="{ left: t.left }"></div>
              </div>

              <!-- Current Time Red Line (When viewing today) -->
              <div v-if="selectedDashboardDate === todayDate"
                class="absolute top-0 bottom-4 pointer-events-none z-20"
                :style="{ left: ((nowMinute / 1440) * 100) + '%' }"
                aria-hidden="true">
                <div class="relative h-full flex flex-col items-center">
                  <!-- Time badge on top -->
                  <span class="absolute -top-3.5 -translate-x-1/2 text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-red-500 text-white shadow-xs whitespace-nowrap">
                    {{ nowLineLabel }}
                  </span>
                  <!-- Red dot at top of vertical line -->
                  <span class="w-2 h-2 -mt-0.5 rounded-full bg-red-500 shadow-xs shrink-0"></span>
                  <!-- Crisp red vertical line through planned and logged lanes -->
                  <div class="w-[2px] flex-1 bg-red-500 shadow-xs"></div>
                </div>
              </div>
              <!-- planned lane -->
              <div class="relative h-7">
                <div v-for="(r, i) in dayTimeline.planned" :key="'p' + i"
                  class="absolute top-0 h-7 rounded-md border text-[10px] font-bold px-1.5 leading-7 truncate cursor-pointer hover:brightness-95"
                  :style="Object.assign({ left: r.left, width: r.width }, timelinePlannedStyle(r.block))"
                  tabindex="0"
                  :aria-label="(r.block.task_subject || r.block.deliverable_notes || 'Work block') + ' ' + formatBlockRange(r.block)"
                  @mouseenter="showBlockHover($event, r, 'timeline')"
                  @mouseleave="hideBlockHover"
                  @focus="showBlockHover($event, r, 'timeline')"
                  @blur="hideBlockHover"
                  @keydown.enter.prevent="openBlockDrawer(r.block)"
                  @click="openBlockDrawer(r.block)">{{ r.block.task_subject || r.block.deliverable_notes || 'Block' }}</div>
              </div>
              <!-- logged lane -->
              <div class="relative h-6 mt-1.5">
                <div v-for="(r, i) in dayTimeline.logged" :key="'l' + i"
                  class="absolute top-0 h-6 rounded-md text-[10px] font-bold text-white px-2 leading-6 truncate cursor-pointer hover:brightness-110 shadow-xs flex items-center select-none"
                  :class="r.is_live_active ? 'rounded-r-none z-10' : ''"
                  :style="Object.assign({ left: r.left, width: r.width }, timelineLoggedStyle(r))"
                  tabindex="0"
                  :aria-label="'Logged: ' + (r.notes || r.block.task_subject || 'Session') + ' · ' + fmtHrs(r.hours) + 'h'"
                  @mouseenter="showBlockHover($event, r, 'logged')"
                  @mouseleave="hideBlockHover"
                  @focus="showBlockHover($event, r, 'logged')"
                  @blur="hideBlockHover"
                  @keydown.enter.prevent="openBlockDrawer(r.block)"
                  @click="openBlockDrawer(r.block)">
                  <span v-if="r.is_live_active" class="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1.5 shrink-0"></span>
                  <span class="truncate">{{ r.notes || r.block.task_subject || (r.timesheet ? 'TS: ' + r.timesheet : 'Logged ' + fmtHrs(r.hours) + 'h') }}</span>
                  <span v-if="r.is_live_active" class="ml-auto text-[9px] font-mono tracking-tight text-white/90 font-black pl-1 shrink-0">REC &bull;</span>
                </div>
                <!-- Interactive 1-Click Gap Booking Pills -->
                <div v-for="(g, gi) in (dayTimeline.gaps || [])" :key="'gap' + gi"
                  class="absolute top-0 h-6 rounded-md border border-dashed text-[9px] font-bold px-1.5 leading-6 truncate cursor-pointer hover:scale-102 transition-transform flex items-center justify-center select-none z-10"
                  :class="isDarkMode ? 'border-amber-700/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60' : 'border-amber-300 bg-amber-50/90 text-amber-800 hover:bg-amber-100'"
                  :style="{ left: g.left, width: g.width }"
                  tabindex="0"
                  :title="'Click to quickly log ' + g.label + ' (' + g.from_time + '–' + g.to_time + ')'"
                  :aria-label="'Quickly log ' + g.label"
                  @keydown.enter.prevent="quickLogTimelineGap(g)"
                  @click.stop="quickLogTimelineGap(g)">
                  <span>{{ g.label }}</span>
                </div>
                <div v-if="!dayTimeline.logged.length"
                  class="absolute inset-0 rounded-md border border-dashed flex items-center justify-center text-[10px] font-semibold"
                  :class="isDarkMode ? 'border-amber-800 text-amber-400' : 'border-amber-300 text-amber-600'">No sessions logged</div>
              </div>
              <!-- hour labels -->
              <div class="relative h-4 mt-0.5" aria-hidden="true">
                <span v-for="t in dayTimeline.ticks" :key="'lb' + t.m"
                  class="absolute -translate-x-1/2 text-[9px] font-mono text-gray-400" :style="{ left: t.left }">{{ t.label }}</span>
              </div>
            </div>
            </div>
            </div>
            </div>
          </div>

          
          <!-- Category: Happening Now (Excludes block actively tracked in top cockpit) -->
          <div v-if="untrackedCurrentBlocks.length > 0" class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-blue-500">Happening Now</h4>
            <div class="space-y-3">
              <div 
                v-for="b in untrackedCurrentBlocks" 
                :key="b.name"
                class="rounded-3xl p-5 sm:p-6 border shadow-sm transition-all duration-200 border-l-4"
                :class="isTracking && trackerBlockName === b.name ? (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-red-500 text-white' : 'bg-white border-gray-200 border-l-red-500 text-gray-900') : (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-blue-500 text-white' : 'bg-white border-gray-200 border-l-blue-500 text-gray-900')">
                
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div class="space-y-2 flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <!-- Start Time Pill -->
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black"
                        :class="isTracking && trackerBlockName === b.name ? 'bg-red-600 text-white' : (isDarkMode ? 'bg-blue-950/70 text-blue-300 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200')">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>{{ formatBlockRange(b) }}</span>
                      </span>

                      <!-- Dynamic Status Pill -->
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider" :class="getBlockTimingInfo(b).pillClass">
                        {{ getBlockTimingInfo(b).label }}
                      </span>

                      <!-- Nature Badge -->
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" :class="getNatureBadge(b.task_nature).badgeClass">
                        <span v-html="getNatureBadge(b.task_nature).svgIcon" class="w-3 h-3 flex items-center justify-center" aria-hidden="true"></span>
                        <span>{{ getNatureBadge(b.task_nature).label }}</span>
                      </span>

                      <!-- Project -->
                      <span v-if="b.project_name || b.project" class="text-xs text-gray-500 dark:text-gray-400">
                        📁 {{ b.project_name || b.project }}
                      </span>
                    </div>

                    <!-- Title is text, not a control: starting/stopping happens on the button only. -->
                    <h3 class="text-lg sm:text-xl font-extrabold leading-snug transition-colors"
                      :class="isTracking && trackerBlockName === b.name ? 'text-red-500 dark:text-red-400' : ''">
                      {{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}
                    </h3>

                    <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <span v-if="b.task" class="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        📋 Task: {{ b.task }}
                      </span>
                      <span>👤 {{ b.associate_name || b.employee }}</span>
                      <span aria-hidden="true">·</span>
                      <span>Expected: <strong class="font-mono font-bold">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
                      <span v-if="b.actual_hours">· Logged: <strong class="text-emerald-500 font-mono font-bold">{{ Number(b.actual_hours).toFixed(1) }}h</strong></span>
                      <span v-if="b.variance_hours !== undefined && b.actual_hours > 0" :class="b.variance_hours <= 0 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'">
                        ({{ b.variance_hours <= 0 ? '' : '+' }}{{ Number(b.variance_hours).toFixed(1) }}h variance)
                      </span>
                    </div>
                  </div>

                  <!-- Start / Stop Session Button -->
                  <div class="flex items-center gap-3 self-stretch md:self-center justify-end">
                    <template v-if="isTracking && trackerBlockName === b.name">
                      <!-- one clock per card: this is it -->
                      <span class="font-mono font-bold text-sm tabular-nums" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'" aria-label="Elapsed time">{{ formattedTime }}</span>
                      <button 
                        type="button"
                        @click.stop="requestStopFocusBlock(b)"
                        :aria-label="stopConfirmName === b.name ? 'Stop and save without any log lines' : 'Stop the session and save the timesheet'"
                        class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        :class="stopConfirmName === b.name ? 'bg-red-600 border-red-600 text-white hover:bg-red-700' : (isDarkMode ? 'border-red-800 text-red-300 hover:bg-red-950/40' : 'border-red-300 text-red-700 hover:bg-red-50')">
                        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>
                        <span>{{ stopConfirmName === b.name ? 'Stop anyway' : 'Stop & save' }}</span>
                      </button>
                      <button
                        type="button"
                        @click.stop="discardSession"
                        :aria-label="discardConfirm ? 'Confirm discard: throw this session away without saving' : 'Discard this session without saving'"
                        :title="discardConfirm ? 'Press again to discard' : 'Discard without saving'"
                        class="inline-flex items-center justify-center px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        :class="discardConfirm ? 'bg-amber-500 border-amber-500 text-white' : (isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100')">
                        {{ discardConfirm ? 'Discard?' : 'Discard' }}
                      </button>
                      <button
                        type="button"
                        @click.stop="openAdjustModal"
                        aria-label="Adjust start and end datetime of this timesheet"
                        title="Adjust start/end time (±5 min or backdate)"
                        class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>Adjust</span>
                      </button>
                      <button
                        type="button"
                        @click.stop="openSwitchTaskModal"
                        aria-label="Switch to another task without losing time"
                        title="Switch task (⇄) — log current session and transition to target immediately"
                        class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'">
                        <span class="font-bold" aria-hidden="true">⇄</span>
                        <span>Switch</span>
                      </button>
                    </template>
                    <template v-else>
                      <!-- A block that has not happened yet is still a plan: let it move. -->
                      <button
                        type="button"
                        v-if="!isBlockLocked(b)"
                        @click.stop="openBlockDrawer(b)"
                        :aria-label="'Reschedule ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                        title="Reschedule this planned block"
                        class="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-xs sm:text-sm font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        :class="isDarkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>Reschedule</span>
                      </button>
                      <button 
                        type="button"
                        @click.stop="startFocusBlock(b)"
                        :aria-label="'Start session for ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                        class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-[#1A73E8] hover:bg-blue-700 ring-4 ring-blue-500/20 shadow-md transition-all cursor-pointer select-none active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                        <span>Start Session</span>
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Working-on-this indicator. The timesheet itself is filled in the
                     Session Log card above; this card does not duplicate that input. -->
                <div v-if="isTracking && trackerBlockName === b.name"
                  class="mt-3.5 pt-3 border-t flex items-center gap-2 flex-wrap text-[11px] font-semibold"
                  :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'"
                  role="status" aria-live="polite">
                  <span class="inline-flex items-center gap-1.5" :class="isDarkMode ? 'text-red-300' : 'text-red-600'">
                    <span class="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden="true"></span>
                    <span>{{ (b.associate_name || b.employee) === currentUserFullName ? 'You are working on this' : (b.associate_name || b.employee) + ' is working on this' }}</span>
                  </span>
                  <span aria-hidden="true" class="text-gray-300 dark:text-gray-700">·</span>
                  <span class="text-gray-500 dark:text-gray-400" v-if="sessionNotesList.length">{{ sessionNotesList.length }} line{{ sessionNotesList.length === 1 ? '' : 's' }} in the session log</span>
                  <button v-else type="button" @click.stop="focusSessionPointInput"
                    class="underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                    :class="isDarkMode ? 'text-blue-300' : 'text-blue-600'">Nothing logged yet — add a line</button>
                </div>

              </div>
            </div>
          </div>

          <!-- Category: Upcoming Focus Blocks -->
          <div v-if="upcomingFocusBlocks.length > 0" class="space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ focusBlocksHeading }}</h4>
            <div class="space-y-3">
              <f-card 
                v-for="b in upcomingFocusBlocks" 
                :key="b.name"
                :padded="true">
                
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div class="space-y-2 flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <f-badge theme="gray" variant="outline" size="xs">
                        {{ formatBlockRange(b) }}
                      </f-badge>

                      <!-- Dynamic Status Pill -->
                      <f-badge :theme="getBlockBadgeTheme(b)" variant="subtle" size="xs">
                        {{ getBlockTimingInfo(b).label }}
                      </f-badge>

                      <f-badge v-if="b.task_nature" theme="gray" variant="outline" size="xs">
                        {{ getNatureBadge(b.task_nature).label }}
                      </f-badge>

                      <f-badge v-if="b.project_name || b.project" theme="blue" variant="subtle" size="xs">
                        📁 {{ b.project_name || b.project }}
                      </f-badge>
                    </div>

                    <h3 class="text-base sm:text-lg font-bold leading-snug">
                      {{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}
                    </h3>

                    <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <f-badge v-if="b.task" theme="blue" variant="outline" size="xs">
                        📋 Task: {{ b.task }}
                      </f-badge>
                      <span>👤 {{ b.associate_name || b.employee }}</span>
                      <span aria-hidden="true">·</span>
                      <span>Expected: <strong class="font-mono font-bold">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
                    </div>
                  </div>

                  <!-- Actions Cluster (Frappe UI FButton) -->
                  <div class="flex items-center gap-2 self-stretch md:self-center justify-end">
                    <f-button
                      v-if="!isBlockLocked(b)"
                      theme="gray"
                      variant="outline"
                      size="sm"
                      @click.stop="openBlockDrawer(b)"
                      :aria-label="'Reschedule ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                      title="Reschedule this planned block">
                      Reschedule
                    </f-button>
                    <f-button 
                      theme="blue"
                      variant="solid"
                      size="sm"
                      @click.stop="startFocusBlock(b)"
                      :aria-label="'Start session for ' + (b.task_subject || b.deliverable_notes || 'Work Block')">
                      ▶ Start Session
                    </f-button>
                  </div>
                </div>

              </f-card>
            </div>
          </div>

          <!-- Category: Past / Completed Focus Blocks (Daily Accomplishments & Debrief) -->
          <div v-if="pastFocusBlocks.length > 0" class="space-y-3">
            <!-- Accomplishment Header & Executive Tally -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
              <div class="flex items-center gap-2.5">
                <span class="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div>
                  <h4 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{{ pastBlocksHeading }}</span>
                  </h4>
                </div>
              </div>

              <!-- Executive Accomplishment Tally (Frappe UI FBadge) -->
              <div class="flex items-center gap-2 flex-wrap text-xs">
                <f-badge theme="green" variant="subtle" size="sm">
                  ✓ {{ pastDeliverablesStats.completedCount }} Completed
                </f-badge>
                <f-badge v-if="pastDeliverablesStats.cancelledCount > 0" theme="red" variant="subtle" size="sm">
                  🚫 {{ pastDeliverablesStats.cancelledCount }} Cancelled
                </f-badge>
                <f-badge theme="gray" variant="subtle" size="sm">
                  ⏱️ {{ pastDeliverablesStats.totalLogged }}h Logged
                </f-badge>
                <f-badge v-if="pastDeliverablesStats.totalPlanned > 0" theme="blue" variant="subtle" size="sm">
                  {{ pastDeliverablesStats.adherencePct }}% Adherence
                </f-badge>
              </div>
            </div>

            <!-- List of Completed / Concluded Blocks (Frappe UI FCard) -->
            <div 
              role="grid" 
              class="space-y-3.5"
              :aria-rowcount="visiblePastFocusBlocks.length"
              aria-colcount="4"
              aria-label="Daily accomplishments and concluded deliverables. Use arrow keys to navigate between cards and actions.">
              <f-card 
                v-for="(b, rIdx) in visiblePastFocusBlocks" 
                :key="b.name"
                role="row"
                :aria-rowindex="rIdx + 1"
                :accent="getBlockCardAccent(b)"
                :padded="true"
                @click="openBlockDrawer(b)"
                class="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500/30">
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="space-y-1.5 flex-1 min-w-0">
                    <!-- Badges & Taxonomy Row -->
                    <div class="flex items-center gap-2 flex-wrap">
                      <f-badge theme="gray" variant="outline" size="xs">
                        <span v-if="b.work_date && selectedDashboardDate && b.work_date !== selectedDashboardDate" class="text-blue-500 font-bold mr-1">↩ (cont.)</span>
                        {{ formatBlockRange(b) }}
                      </f-badge>

                      <!-- Dynamic Status Pill -->
                      <f-badge :theme="getBlockBadgeTheme(b)" variant="subtle" size="xs">
                        {{ getBlockTimingInfo(b).label }}
                      </f-badge>

                      <f-badge v-if="b.task_nature" theme="gray" variant="outline" size="xs">
                        {{ getNatureBadge(b.task_nature).label }}
                      </f-badge>

                      <f-badge v-if="b.project_name || b.project" theme="blue" variant="subtle" size="xs">
                        📁 {{ b.project_name || b.project }}
                      </f-badge>
                    </div>

                    <!-- Block Title (Column 0 in Roving Tabindex) -->
                    <h4 class="text-base sm:text-lg font-bold leading-snug">
                      <button
                        type="button"
                        @click.stop="openBlockDrawer(b)"
                        :title="'View audit details for ' + (b.task_subject || b.deliverable_notes || 'Focus Work Block')"
                        :tabindex="concludedTabindex(rIdx, 0)"
                        :data-concluded-row="rIdx"
                        :data-concluded-col="0"
                        @focus="setConcludedRoving(rIdx, 0)"
                        @keydown="onConcludedGridKey($event, rIdx, 0)"
                        class="text-left font-bold hover:underline hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer text-gray-900 dark:text-white">
                        <span>{{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}</span>
                        <span class="text-xs font-normal text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">View audit →</span>
                      </button>
                    </h4>

                    <!-- Plan vs Actual Metadata Metrics -->
                    <div class="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <f-badge v-if="b.task" theme="blue" variant="outline" size="xs">
                        📋 Task: {{ b.task }}
                      </f-badge>
                      <span>👤 {{ b.associate_name || b.employee }}</span>
                      <span aria-hidden="true">·</span>
                      <span>Planned: <strong class="font-mono font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
                      <span aria-hidden="true">·</span>
                      <span v-if="b.status === 'Cancelled'" class="font-bold text-rose-500">
                        Cancelled ({{ b.cancel_reason || 'Client No-Show' }})
                      </span>
                      <span v-else-if="blockLogState(b) === 'none'" class="font-bold text-amber-500">
                        Nothing logged
                      </span>
                      <span v-else>
                        Logged: <strong class="font-mono font-bold" :class="blockLogState(b) === 'over' ? 'text-purple-500' : (isDarkMode ? 'text-gray-200' : 'text-gray-800')">{{ Number(b.actual_hours || 0).toFixed(1) }}h</strong>
                      </span>
                      <!-- Variance Chip -->
                      <f-badge v-if="getBlockVarianceBadge(b)" :theme="getBlockVarianceBadge(b).theme" variant="subtle" size="xs">
                        {{ getBlockVarianceBadge(b).label }}
                      </f-badge>
                    </div>
                  </div>

                  <!-- Actions Cluster (Frappe UI FButton) -->
                  <div class="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <!-- 1-Click Plan-to-Actuals Catch-Up Action (Pillar 1) -->
                    <f-button
                      v-if="blockLogState(b) === 'none' && b.status !== 'Cancelled'"
                      theme="green"
                      variant="solid"
                      size="sm"
                      @click.stop="quickConvertPlanToActual(b)"
                      :tabindex="concludedTabindex(rIdx, 1)"
                      :data-concluded-row="rIdx"
                      :data-concluded-col="1"
                      @focus="setConcludedRoving(rIdx, 1)"
                      @keydown="onConcludedGridKey($event, rIdx, 1)"
                      :aria-label="'Log planned duration ' + Number(b.duration_hours || 0).toFixed(1) + 'h as completed timesheet'"
                      title="1-Click convert planned commitment to actual logged timesheet">
                      ⚡ Convert ({{ Number(b.duration_hours || 0).toFixed(1) }}h)
                    </f-button>
                    <!-- Column 1: View Audit & Notes -->
                    <f-button
                      theme="gray"
                      variant="outline"
                      size="sm"
                      @click.stop="openBlockDrawer(b)"
                      :tabindex="concludedTabindex(rIdx, 2)"
                      :data-concluded-row="rIdx"
                      :data-concluded-col="2"
                      @focus="setConcludedRoving(rIdx, 2)"
                      @keydown="onConcludedGridKey($event, rIdx, 2)"
                      :aria-label="'View audit details for ' + (b.task_subject || b.deliverable_notes || 'Block')">
                      View Audit & Notes
                    </f-button>
                    <!-- Column 2: Re-open (if permitted) -->
                    <f-button
                      v-if="b.status !== 'Cancelled' && b.status !== 'Rescheduled'"
                      theme="blue"
                      variant="ghost"
                      size="sm"
                      @click.stop="startFocusBlock(b)"
                      :tabindex="concludedTabindex(rIdx, 3)"
                      :data-concluded-row="rIdx"
                      :data-concluded-col="3"
                      @focus="setConcludedRoving(rIdx, 3)"
                      @keydown="onConcludedGridKey($event, rIdx, 3)"
                      :aria-label="'Re-open focus session for ' + (b.task_subject || b.deliverable_notes || 'Focus Work Block')"
                      title="Re-open or append time to this completed block">
                      ↺ Re-open
                    </f-button>
                  </div>
                </div>

                <!-- Structured Cancellation Audit Callout -->
                <div v-if="b.status === 'Cancelled'" class="mt-3.5 p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs">
                  <div class="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold mb-1">
                    <svg class="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <span>Cancellation Reason: {{ b.cancel_reason || 'Client No-Show / Cancelled' }}</span>
                  </div>
                  <p v-if="b.deliverable_notes" class="text-rose-900/80 dark:text-rose-200/80 whitespace-pre-line leading-relaxed font-sans"
                    :style="!isBlockNotesExpanded(b.name) && isLongNote(b.deliverable_notes) ? '-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;' : ''">
                    {{ b.deliverable_notes }}
                  </p>
                  <div v-if="isLongNote(b.deliverable_notes)" class="pt-1">
                    <f-button
                      theme="gray"
                      variant="ghost"
                      size="xs"
                      @click.stop="toggleBlockNotes(b.name)"
                      :tabindex="concludedTabindex(rIdx, getConcludedNotesCol(b))"
                      :data-concluded-row="rIdx"
                      :data-concluded-col="getConcludedNotesCol(b)"
                      @focus="setConcludedRoving(rIdx, getConcludedNotesCol(b))"
                      @keydown="onConcludedGridKey($event, rIdx, getConcludedNotesCol(b))"
                      :aria-expanded="isBlockNotesExpanded(b.name) ? 'true' : 'false'">
                      <span v-if="!isBlockNotesExpanded(b.name)" class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <span>Show full notes</span>
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                      </span>
                      <span v-else class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <span>Show less</span>
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                      </span>
                    </f-button>
                  </div>
                  <!-- Wait time sessions -->
                  <div v-if="b.sessions && b.sessions.length" class="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-[11px] text-rose-700 dark:text-rose-300">
                    <span class="font-mono">Logged wait window: {{ hhmm(b.sessions[0].from_time) }}–{{ hhmm(b.sessions[0].to_time) }}</span>
                    <f-badge theme="red" variant="subtle" size="xs">{{ fmtHrs(b.sessions[0].hours) }}h wait</f-badge>
                  </div>
                </div>

                <!-- Accomplishment & Deliverable Notes Showcase (Non-Cancelled) -->
                <div v-else class="mt-3.5 space-y-2.5">
                  <div v-if="b.deliverable_notes || (b.sessions && b.sessions.some(s => s.notes))" 
                    class="rounded-2xl p-3.5 border transition-colors"
                    :class="isDarkMode ? 'bg-[#25272B] border-gray-800' : 'bg-gray-50/70 border-gray-200/80'">
                    
                    <div class="flex items-center justify-between gap-2 mb-1.5">
                      <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                        <svg class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Deliverables & Accomplished Outcomes</span>
                      </div>
                      <f-badge theme="gray" variant="outline" size="xs">
                        {{ (b.sessions && b.sessions.length) ? (b.sessions.length + ' session' + (b.sessions.length > 1 ? 's' : '')) : 'Verified' }}
                      </f-badge>
                    </div>

                    <!-- The actual deliverable note displayed with truncation toggle if long -->
                    <p v-if="b.deliverable_notes" 
                      class="text-xs sm:text-[13px] leading-relaxed whitespace-pre-line text-gray-800 dark:text-gray-100 font-sans"
                      :style="!isBlockNotesExpanded(b.name) && isLongNote(b.deliverable_notes) ? '-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;' : ''">
                      {{ b.deliverable_notes }}
                    </p>

                    <!-- Expand / Collapse Note Details Button (Frappe UI FButton) -->
                    <div v-if="isLongNote(b.deliverable_notes) || (b.sessions && b.sessions.length > 1)" class="pt-1">
                      <f-button
                        theme="gray"
                        variant="ghost"
                        size="xs"
                        @click.stop="toggleBlockNotes(b.name)"
                        :tabindex="concludedTabindex(rIdx, getConcludedNotesCol(b))"
                        :data-concluded-row="rIdx"
                        :data-concluded-col="getConcludedNotesCol(b)"
                        @focus="setConcludedRoving(rIdx, getConcludedNotesCol(b))"
                        @keydown="onConcludedGridKey($event, rIdx, getConcludedNotesCol(b))"
                        :aria-expanded="isBlockNotesExpanded(b.name) ? 'true' : 'false'">
                        <span v-if="!isBlockNotesExpanded(b.name)" class="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <span>Show full details & breakdown</span>
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                        <span v-else class="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <span>Show less</span>
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                        </span>
                      </f-button>
                    </div>

                    <!-- Detailed Child Sessions (shown if expanded, or if single session with distinct notes) -->
                    <div v-if="b.sessions && b.sessions.length && (isBlockNotesExpanded(b.name) || b.sessions.length === 1) && (b.sessions.length > 1 || (b.sessions[0].notes && b.sessions[0].notes !== b.deliverable_notes))" class="mt-2.5 pt-2.5 border-t space-y-1.5 border-gray-200/60 dark:border-gray-800">
                      <div v-for="(s, i) in b.sessions" :key="i"
                        class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] rounded-xl px-2.5 py-1.5 bg-white border border-gray-200/60 dark:bg-[#1E1F22] dark:border-gray-800">
                        <div class="flex items-center gap-2 min-w-0">
                          <span v-if="s.from_time" class="font-mono text-gray-500 font-medium shrink-0">{{ hhmm(s.from_time) }}–{{ hhmm(s.to_time) }}</span>
                          <span v-if="s.notes" class="text-gray-700 dark:text-gray-300 break-words">· {{ s.notes }}</span>
                        </div>
                        <f-badge theme="gray" variant="subtle" size="xs">{{ fmtHrs(s.hours) }}h</f-badge>
                      </div>
                    </div>
                  </div>

                  <!-- Warning if nothing was logged -->
                  <div v-else-if="blockLogState(b) === 'none'" class="rounded-xl p-2.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>No timesheet sessions were recorded against this planned block.</span>
                  </div>
                </div>

              </f-card>
            </div>

            <!-- Show More / Show Less Toggle (Frappe UI FButton) -->
            <div v-if="pastFocusBlocks.length > 2" class="pt-2 flex justify-center">
              <f-button
                theme="gray"
                variant="outline"
                size="sm"
                @click="toggleShowAllPastBlocks"
                :aria-expanded="showAllPastBlocks ? 'true' : 'false'"
                :aria-label="showAllPastBlocks ? 'Show fewer completed deliverables' : ('Show ' + remainingPastBlocksCount + ' more completed deliverables')">
                <span v-if="!showAllPastBlocks" class="inline-flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                  <span>Show {{ remainingPastBlocksCount }} more deliverables</span>
                </span>
                <span v-else class="inline-flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                  <span>Show less</span>
                </span>
              </f-button>
            </div>
          </div>

          <!-- Category: Away / Leave Events -->
          <div v-if="awayFocusBlocks.length > 0" class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-amber-500">Time Away</h4>
            <div class="space-y-2">
              <div 
                v-for="b in awayFocusBlocks" 
                :key="b.name"
                class="rounded-2xl p-3.5 border flex items-center justify-between gap-3 text-xs"
                :class="isDarkMode ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50/70 border-amber-200 text-amber-900'">
                <div class="flex items-center gap-2">
                  <span class="text-base">🌴</span>
                  <div>
                    <span class="font-bold">{{ b.task_nature || 'Out-of-Office' }}</span>
                    <span v-if="b.deliverable_notes" class="ml-2 font-normal text-amber-600 dark:text-amber-400">({{ b.deliverable_notes }})</span>
                  </div>
                </div>
                <span class="font-mono font-bold">{{ b.start_time ? formatBlockRange(b) : 'All Day' }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Google Meet Empty State -->
        <div v-else class="rounded-3xl p-10 sm:p-14 border text-center space-y-4" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-blue-500/10 text-blue-500 text-2xl">
            📅
          </div>
          <div class="space-y-1">
            <h3 class="text-lg font-extrabold">No focus blocks scheduled for {{ selectedDashboardDateLabel }}</h3>
            <p class="text-xs text-gray-400 max-w-sm mx-auto">
              Schedule focus blocks just like meetings to protect your time and maintain high plan adherence.
            </p>
          </div>
          <div class="flex items-center justify-center gap-3 pt-2">
            <button 
              @click="openNewTaskModal"
              class="px-5 py-2.5 rounded-full text-xs font-bold bg-[#1B64DA] hover:bg-blue-600 text-white transition-all shadow-md cursor-pointer active:scale-95">
              + Plan Focus Block
            </button>
            <button 
              @click="activeTab = 'planner'"
              class="px-5 py-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer"
              :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
              Open Week Planner →
            </button>
          </div>
        </div>

      </div>

      <!-- Pillar 5: End-of-Day (EOD) Wrap-Up Ritual Card (visible after 16:30 or when logged < 8.0h) -->
      <div v-if="eodSummary && (eodSummary.remaining_to_target > 0 || eodSummary.is_eod_time)" class="rounded-3xl p-4 sm:p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
        :class="isDarkMode ? 'bg-[#1E1F22] border-amber-800/60' : 'bg-gradient-to-r from-amber-50/80 to-blue-50/50 border-amber-200'">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-xs"
            :class="eodSummary.remaining_to_target === 0 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'">
            {{ eodSummary.remaining_to_target === 0 ? '🎉' : '🏁' }}
          </div>
          <div class="space-y-0.5 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">EOD Timesheet Reconciliation</span>
              <f-badge :theme="eodSummary.remaining_to_target === 0 ? 'green' : 'amber'" variant="subtle" size="xs">
                {{ eodSummary.remaining_to_target === 0 ? 'Goal Met: 8.0h Logged' : eodSummary.remaining_to_target + 'h remaining to 8.0h target' }}
              </f-badge>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-300 font-medium">
              Today: <strong class="font-bold">{{ eodSummary.total_actual_hours }}h</strong> logged of 8.0h target across <strong class="font-bold">{{ eodSummary.blocks_count }}</strong> session{{ eodSummary.blocks_count === 1 ? '' : 's' }}.
              <span v-if="eodSummary.unconverted_count > 0" class="text-amber-600 dark:text-amber-400 font-bold ml-1">({{ eodSummary.unconverted_count }} unlogged planned blocks pending).</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <f-button
            v-if="eodSummary.unconverted_count > 0"
            variant="solid"
            theme="green"
            size="sm"
            @click="convertAllPendingPlannedBlocks"
            title="Convert all unlogged planned blocks to logged actuals"
            class="font-bold">
            ⚡ Convert All ({{ eodSummary.unconverted_hours }}h)
          </f-button>
          <f-button
            variant="outline"
            theme="blue"
            size="sm"
            @click="openEODWrapUpDrawer"
            class="font-bold">
            <span>Review & Close Day →</span>
          </f-button>
        </div>
      </div>

      <!-- 4. Statistics last: the day's numbers, after the things you act on -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        
        <!-- Today Card: Today's Hours & Commitment -->
        <div class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div>
            <div class="flex items-center justify-between gap-2 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50"></span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Today's Hours & Commitment</h3>
              </div>
              <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full" :class="dashboardKPIs.today.todo_completed_pct >= 100 ? (isDarkMode ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (dashboardKPIs.today.todo_completed_pct > 0 ? (isDarkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-blue-700') : (isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'))">
                {{ dashboardKPIs.today.todo_completed_pct }}% ToDo Done
              </span>
            </div>

            <!-- Big Primary Metric: Worked Hours -->
            <div class="mt-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Worked Hours</div>
              <div class="flex items-baseline gap-1.5 mt-0.5">
                <span class="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-gray-900 dark:text-white">{{ Number(dashboardKPIs.today.actual_hours || 0).toFixed(1) }}h</span>
              </div>
            </div>

            <!-- Progress Bar towards Planned or Target -->
            <div class="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-3" title="Daily ToDo Completion Progress">
              <div class="h-full rounded-full transition-all duration-500"
                :class="dashboardKPIs.today.todo_completed_pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'"
                :style="{ width: Math.min(100, Math.round(dashboardKPIs.today.todo_completed_pct || ((dashboardKPIs.today.actual_hours || 0) / (dashboardKPIs.today.planned_hours || dashboardKPIs.today.target_hours || 8)) * 100)) + '%' }"></div>
            </div>

            <!-- Secondary Metrics: Planned, Target & Variance Pill Grid -->
            <div class="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t text-center text-[10.5px]" :class="isDarkMode ? 'border-gray-800/80' : 'border-gray-100'">
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Planned</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.today.planned_hours || 0).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Target</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.today.target_hours || 8).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="dashboardKPIs.today.variance_hours >= 0 ? (isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-amber-950/40 text-amber-300' : 'bg-amber-50 text-amber-700')">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Variance</div>
                <div class="font-mono font-bold mt-0.5">{{ dashboardKPIs.today.variance_hours >= 0 ? '+' : '' }}{{ Number(dashboardKPIs.today.variance_hours || 0).toFixed(1) }}h</div>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between text-[11px] font-medium pt-3 text-gray-500 dark:text-gray-400 border-t mt-3" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <span class="flex items-center gap-1">
              <span>🎯</span>
              <span>{{ dashboardKPIs.today.completed_count }}/{{ dashboardKPIs.today.block_count }} Sessions</span>
            </span>
            <span v-if="dashboardKPIs.today.non_working_hours > 0" class="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold">
              <span>☕</span>
              <span>{{ Number(dashboardKPIs.today.non_working_hours || 0).toFixed(1) }}h Non-Working</span>
            </span>
            <span v-else class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <span>⚡</span>
              <span>Standard Day</span>
            </span>
          </div>
        </div>

        <!-- This Week Card: Weekly Velocity -->
        <div class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div>
            <div class="flex items-center justify-between gap-2 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-xs shadow-indigo-500/50"></span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Weekly Velocity</h3>
              </div>
              <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {{ dashboardKPIs.week.adherence_pct }}% Adherence
              </span>
            </div>

            <!-- Big Primary Metric: Worked Hours -->
            <div class="mt-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Worked Hours</div>
              <div class="flex items-baseline gap-1.5 mt-0.5">
                <span class="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-gray-900 dark:text-white">{{ Number(dashboardKPIs.week.actual_hours || 0).toFixed(1) }}h</span>
              </div>
            </div>

            <!-- Progress Bar towards Weekly Adherence -->
            <div class="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-3" title="Weekly Velocity Adherence">
              <div class="bg-indigo-500 h-full rounded-full transition-all duration-500"
                :style="{ width: Math.min(100, dashboardKPIs.week.adherence_pct || 0) + '%' }"></div>
            </div>

            <!-- Secondary Metrics: Planned, Target & Variance Grid -->
            <div class="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t text-center text-[10.5px]" :class="isDarkMode ? 'border-gray-800/80' : 'border-gray-100'">
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Planned</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.week.planned_hours || 0).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Target</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.week.target_hours || 40).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="dashboardKPIs.week.variance_hours >= 0 ? (isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-amber-950/40 text-amber-300' : 'bg-amber-50 text-amber-700')">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Variance</div>
                <div class="font-mono font-bold mt-0.5">{{ dashboardKPIs.week.variance_hours >= 0 ? '+' : '' }}{{ Number(dashboardKPIs.week.variance_hours || 0).toFixed(1) }}h</div>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between text-[11px] font-medium pt-3 text-gray-500 dark:text-gray-400 border-t mt-3" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <span class="flex items-center gap-1">
              <span>⚖️</span>
              <span>{{ dashboardKPIs.week.block_count }} Active Blocks</span>
            </span>
            <span v-if="dashboardKPIs.week.non_working_hours > 0" class="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold">
              <span>🌴</span>
              <span>{{ Number(dashboardKPIs.week.non_working_hours || 0).toFixed(1) }}h Non-Working</span>
            </span>
            <span v-else class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <span>📅</span>
              <span>Full Work Week</span>
            </span>
          </div>
        </div>

        <!-- This Month Card: Monthly Capacity -->
        <div class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div>
            <div class="flex items-center justify-between gap-2 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50"></span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monthly Capacity</h3>
              </div>
              <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {{ dashboardKPIs.month.capacity_pct }}% Utilized
              </span>
            </div>

            <!-- Big Primary Metric: Worked Hours -->
            <div class="mt-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Worked Hours</div>
              <div class="flex items-baseline gap-1.5 mt-0.5">
                <span class="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-gray-900 dark:text-white">{{ Number(dashboardKPIs.month.actual_hours || 0).toFixed(1) }}h</span>
              </div>
            </div>

            <!-- Progress Bar towards Target Capacity -->
            <div class="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-3" title="Capacity Utilization against Target">
              <div class="bg-emerald-500 h-full rounded-full transition-all duration-500"
                :style="{ width: Math.min(100, dashboardKPIs.month.capacity_pct || 0) + '%' }"></div>
            </div>

            <!-- Secondary Metrics: Planned, Target & Variance Grid -->
            <div class="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t text-center text-[10.5px]" :class="isDarkMode ? 'border-gray-800/80' : 'border-gray-100'">
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Planned</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.month.planned_hours || 0).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Target</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.month.target_hours || dashboardKPIs.month.capacity_hours || 160).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="(dashboardKPIs.month.actual_hours - dashboardKPIs.month.planned_hours) >= 0 ? (isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-amber-950/40 text-amber-300' : 'bg-amber-50 text-amber-700')">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Variance</div>
                <div class="font-mono font-bold mt-0.5">{{ (dashboardKPIs.month.actual_hours - dashboardKPIs.month.planned_hours) >= 0 ? '+' : '' }}{{ Number((dashboardKPIs.month.actual_hours || 0) - (dashboardKPIs.month.planned_hours || 0)).toFixed(1) }}h</div>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between text-[11px] font-medium pt-3 text-gray-500 dark:text-gray-400 border-t mt-3" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <span class="flex items-center gap-1">
              <span>📋</span>
              <span>{{ dashboardKPIs.month.month || 'This Month' }}</span>
            </span>
            <span v-if="dashboardKPIs.month.non_working_hours > 0" class="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold">
              <span>🌴</span>
              <span>{{ Number(dashboardKPIs.month.non_working_hours || 0).toFixed(1) }}h Non-Working</span>
            </span>
            <span v-else class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <span>🎯</span>
              <span>Full Capacity</span>
            </span>
          </div>
        </div>

      </div>

    </div>

  </div>  <!-- /TAB 1: DASHBOARD -->


    <!-- ======================================== -->
    <!-- TAB 2: SUMMARIZED TIMESHEETS             -->
    <!-- ======================================== -->
    <div v-if="activeTab === 'timesheets'" class="space-y-4 sm:space-y-6">
      
      <div class="rounded-3xl border shadow-xs overflow-hidden transition-colors" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
        
        <div class="p-4 border-b flex items-center justify-between gap-3 flex-wrap transition-colors" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-800' : 'bg-gray-50/60 border-gray-200'">
          <div class="flex items-center gap-3 flex-wrap">
            <div>
              <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">Invoice-Verifiable Timesheet Summary</h3>
              <p class="text-xs mt-0.5" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
                Filtered for <strong class="text-blue-500">{{ selectedEmployee === 'All' ? 'All Team Members' : selectedEmployee }}</strong>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <!-- Horizon Filter Buttons (Day / Week / Month / All) -->
            <div class="inline-flex items-center rounded-xl border p-0.5 shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-white border-gray-300'" role="group" aria-label="Timesheet review horizon">
              <f-button
                v-for="hz in [['day', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['all', 'All Logs']]"
                :key="hz[0]"
                size="xs"
                :variant="timesheetHorizon === hz[0] ? 'solid' : 'ghost'"
                :theme="timesheetHorizon === hz[0] ? 'blue' : 'gray'"
                @click="timesheetHorizon = hz[0]"
                class="!text-xs font-semibold"
              >
                {{ hz[1] }}
              </f-button>
            </div>

            <!-- Member Filter Dropdown -->
            <f-dropdown-menu
              v-if="isManager"
              :items="employeeMenuItems"
              align="right"
              aria-label="Filter timesheets by team member"
            >
              <template #trigger="{ isOpen }">
                <f-button
                  variant="outline"
                  theme="gray"
                  size="sm"
                  class="!text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  :aria-expanded="isOpen ? 'true' : 'false'"
                >
                  <template #prefix>
                    <span>👤</span>
                  </template>
                  <span>{{ selectedEmployee === 'All' ? 'All Members' : selectedEmployee }}</span>
                  <template #suffix>
                    <svg class="w-3.5 h-3.5 opacity-60 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </template>
                </f-button>
              </template>
            </f-dropdown-menu>

            <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
              Total Hours: {{ totalFilteredHours }} hrs
            </span>
          </div>
        </div>

        <!-- Mobile Card List View -->
        <div class="block md:hidden divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-100'">
          <div v-for="b in filteredWorkBlocks" :key="b.name" class="p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs font-bold text-blue-500">{{ b.name }}</span>
              <span class="font-mono font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ Number(b.duration_hours).toFixed(2) }} hrs</span>
            </div>
            <h4 class="font-bold text-xs" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">{{ b.deliverable_notes || b.task_subject || 'General Task' }}</h4>
            <div class="flex items-center justify-between text-[11px] text-gray-500 pt-1">
              <span>👤 {{ b.associate_name || b.employee }}</span>
              <span>📁 {{ b.project_name || 'General' }}</span>
              <span>📅 {{ b.work_date }}</span>
            </div>
          </div>

          <div v-if="filteredWorkBlocks.length === 0" class="p-8 text-center text-xs text-gray-400">
            No timesheet logs for {{ selectedEmployee }}.
          </div>
        </div>

        <!-- Desktop Full Table View -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="font-bold text-xs border-b" :class="isDarkMode ? 'bg-[#252528] text-gray-400 border-gray-800' : 'bg-gray-100/70 text-gray-600 border-gray-200'">
                <th class="py-3.5 px-4">Block ID</th>
                <th class="py-3.5 px-4">Work Date</th>
                <th class="py-3.5 px-4">Assignee</th>
                <th class="py-3.5 px-4">Deliverable Notes</th>
                <th class="py-3.5 px-4">Project</th>
                <th class="py-3.5 px-4">Nature</th>
                <th class="py-3.5 px-4">Duration</th>
                <th class="py-3.5 px-4">Approval Status</th>
                <th class="py-3.5 px-4 text-right" v-if="isManager">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">
              <tr v-for="b in filteredWorkBlocks" :key="b.name" class="transition-colors" :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50/80'">
                <td class="py-3.5 px-4 font-mono font-semibold" :class="isDarkMode ? 'text-blue-400' : 'text-blue-600'">{{ b.name }}</td>
                <td class="py-3.5 px-4" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ b.work_date }}</td>
                <td class="py-3.5 px-4 font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ b.associate_name || b.employee }}</td>
                <td class="py-3.5 px-4 max-w-xs truncate" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
                  <div>{{ b.deliverable_notes || b.task_subject }}</div>
                  <div v-if="b.flagged_reason" class="text-[10px] text-amber-500 font-medium mt-0.5 truncate" :title="b.flagged_reason">
                    🚩 Flag: {{ b.flagged_reason }}
                  </div>
                </td>
                <td class="py-3.5 px-4 font-medium" :class="isDarkMode ? 'text-gray-300' : 'text-gray-600'">{{ b.project_name || 'General Work' }}</td>
                <td class="py-3.5 px-4">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" :class="b.task_nature && b.task_nature.includes('Unplanned') ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'">
                    {{ b.task_nature || '🎯 Planned' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-mono font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                  <div>{{ Number(b.actual_hours || b.duration_hours).toFixed(2) }} hrs</div>
                  <div v-if="b.actual_hours && b.duration_hours" class="text-[10px] text-gray-400">plan: {{ Number(b.duration_hours).toFixed(2) }}h</div>
                </td>
                <td class="py-3.5 px-4">
                  <span v-if="b.approval_status === 'Approved'" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    ✓ Approved
                  </span>
                  <span v-else-if="b.approval_status === 'Flagged'" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    🚩 Flagged
                  </span>
                  <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {{ b.approval_status || 'Draft' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right" v-if="isManager">
                  <div class="flex items-center justify-end gap-1.5" v-if="b.actual_hours > 0 && b.approval_status !== 'Approved'">
                    <f-button
                      variant="solid"
                      theme="blue"
                      size="xs"
                      @click="quickApproveBlock(b)"
                      title="Approve timesheet"
                    >
                      ✓ Approve
                    </f-button>
                    <f-button
                      variant="outline"
                      theme="gray"
                      size="xs"
                      @click="quickFlagBlock(b)"
                      title="Flag for clarification"
                    >
                      🚩 Flag
                    </f-button>
                  </div>
                  <span v-else-if="b.approval_status === 'Approved'" class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Locked
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>



    <!-- ======================================== -->
    <!-- TAB 5: ATTENDANCE ENGINE                 -->
    <!-- ======================================== -->
    <div v-if="activeTab === 'attendance'" class="space-y-4 sm:space-y-6">
      
      <!-- TEAM WORK BLOCK & TIMESHEET APPROVALS (Manager Governance) -->
      <div v-if="isManager" class="rounded-3xl border shadow-xs overflow-hidden transition-colors" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
        <div class="p-4 border-b flex flex-wrap items-center justify-between gap-3 transition-colors" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-800' : 'bg-gray-50/60 border-gray-200'">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">Team Work Block &amp; Timesheet Approvals</h3>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">Review logged team actuals, deliverables, and grant official timesheet approval.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Member Filter Dropdown in Team Tab -->
            <f-dropdown-menu
              :items="employeeMenuItems"
              align="right"
              aria-label="Filter approvals by team member"
            >
              <template #trigger="{ isOpen }">
                <f-button
                  variant="outline"
                  theme="gray"
                  size="sm"
                  class="!text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  :aria-expanded="isOpen ? 'true' : 'false'"
                >
                  <template #prefix>
                    <span>👤</span>
                  </template>
                  <span>{{ selectedEmployee === 'All' ? 'All Members' : selectedEmployee }}</span>
                  <template #suffix>
                    <svg class="w-3.5 h-3.5 opacity-60 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </template>
                </f-button>
              </template>
            </f-dropdown-menu>

            <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold" :class="isDarkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-blue-700'">
              {{ pendingApprovals.length }} Pending
            </span>
            <f-button
              v-if="pendingApprovals.length > 0"
              variant="solid"
              theme="blue"
              size="sm"
              :disabled="loadingApprovals"
              @click="approveAllPending"
            >
              Approve All ({{ pendingApprovals.length }})
            </f-button>
            <f-button
              variant="ghost"
              theme="gray"
              size="sm"
              :disabled="loadingApprovals"
              @click="fetchPendingApprovals"
            >
              Refresh
            </f-button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="font-bold text-xs border-b" :class="isDarkMode ? 'bg-[#252528] text-gray-400 border-gray-800' : 'bg-gray-100/70 text-gray-600 border-gray-200'">
                <th class="py-3.5 px-4">Teammate</th>
                <th class="py-3.5 px-4">Date &amp; Time Window</th>
                <th class="py-3.5 px-4">Work Item &amp; Project</th>
                <th class="py-3.5 px-4">Logged Actuals</th>
                <th class="py-3.5 px-4">Collaboration</th>
                <th class="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">
              <tr v-for="b in pendingApprovals" :key="b.name" class="transition-colors" :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50/80'">
                <td class="py-3.5 px-4 font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                  <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {{ (b.associate_name || b.employee || '?').substring(0, 1).toUpperCase() }}
                    </div>
                    <div>
                      <div class="leading-tight">{{ b.associate_name || b.employee }}</div>
                      <div class="text-[10px] text-gray-400 font-mono">{{ b.employee }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3.5 px-4" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
                  <div class="font-semibold">{{ b.work_date }}</div>
                  <div class="text-[11px] text-gray-400 font-mono">{{ hhmm(b.start_time) }} – {{ hhmm(b.end_time) }}</div>
                </td>
                <td class="py-3.5 px-4">
                  <div class="font-bold leading-snug line-clamp-1" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
                    {{ b.work_item_label || b.deliverable_notes || b.name }}
                  </div>
                  <div class="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <span v-if="b.project">📁 {{ b.project }}</span>
                    <span>· {{ b.task_nature || '🎯 Planned' }}</span>
                  </div>
                </td>
                <td class="py-3.5 px-4 font-mono">
                  <div class="font-extrabold text-emerald-500">{{ fmtHrs(b.actual_hours) }} hrs</div>
                  <div class="text-[10px] text-gray-400">plan: {{ fmtHrs(b.duration_hours) }}h</div>
                </td>
                <td class="py-3.5 px-4">
                  <span v-if="b.pairing_partner" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                    👥 {{ b.pairing_partner_name || b.pairing_partner }}
                  </span>
                  <span v-else class="text-[11px] text-gray-400">— Solo —</span>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <f-button
                    variant="solid"
                    theme="blue"
                    size="xs"
                    :disabled="loadingApprovals"
                    @click="approveWorkBlockSingle(b)"
                  >
                    ✓ Approve
                  </f-button>
                </td>
              </tr>
              <tr v-if="pendingApprovals.length === 0">
                <td colspan="6" class="py-12 text-center text-xs" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
                  <div class="text-xl mb-1">🎉</div>
                  <div class="font-bold">All team work blocks and timesheets are up to date!</div>
                  <div class="text-[11px] text-gray-400 mt-0.5">No logged sessions are currently awaiting manager approval.</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-3xl border shadow-xs overflow-hidden transition-colors" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
        
        <div class="p-4 border-b flex items-center justify-between transition-colors" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-800' : 'bg-gray-50/60 border-gray-200'">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">Split-Shift Synthesizer Multi-Session Logs</h3>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold" :class="isDarkMode ? 'bg-purple-950 text-purple-300' : 'bg-purple-50 text-purple-700'">
            {{ synthesizerLogs.length }} Logs
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr class="font-bold text-xs border-b" :class="isDarkMode ? 'bg-[#252528] text-gray-400 border-gray-800' : 'bg-gray-100/70 text-gray-600 border-gray-200'">
                <th class="py-3.5 px-4">Log ID</th>
                <th class="py-3.5 px-4">Employee</th>
                <th class="py-3.5 px-4">Attendance Date</th>
                <th class="py-3.5 px-4">Synthesized Status</th>
                <th class="py-3.5 px-4">Total Working Hours</th>
                <th class="py-3.5 px-4">Effective Sessions</th>
              </tr>
            </thead>
            <tbody class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">
              <tr v-for="log in synthesizerLogs" :key="log.name" class="transition-colors" :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50/80'">
                <td class="py-3.5 px-4 font-mono font-semibold" :class="isDarkMode ? 'text-gray-300' : 'text-gray-800'">{{ log.name }}</td>
                <td class="py-3.5 px-4 font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ log.employee }}</td>
                <td class="py-3.5 px-4" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ log.attendance_date }}</td>
                <td class="py-3.5 px-4">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                    {{ log.synthesized_status || 'Present' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-mono font-bold" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ log.total_working_hours || '6.5' }} hrs</td>
                <td class="py-3.5 px-4 font-mono" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ log.effective_sessions_completed || '2' }} Sessions</td>
              </tr>
              <tr v-if="synthesizerLogs.length === 0">
                <td colspan="6" class="py-12 text-center text-xs" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
                  No split-shift synthesizer logs recorded.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>  <!-- /TAB 5: ATTENDANCE ENGINE -->



    <!-- ======================================== -->
    <!-- TAB 8: PLANNER (Calendar Work-Block Self-Booking) -->
    <!-- ======================================== -->
    <div v-if="activeTab === 'planner'" class="space-y-4 sm:space-y-5 lg:space-y-0 lg:flex-1 lg:min-h-0 lg:h-full lg:flex lg:flex-col">

      <!-- 3-Column Responsive Grid on Big Large Screens: Left Assigned Work · Center Calendar · Right Stats -->
      <div class="grid grid-cols-1 lg:grid-cols-[240px_1fr_220px] xl:grid-cols-[280px_1fr_260px] gap-3.5 sm:gap-4 items-stretch lg:h-full lg:min-h-0 flex-1">

        <!-- Left rail: assigned tasks (Frappe UI FCard) -->
        <f-card :padded="true" class="w-full flex flex-col space-y-2.5 !p-3.5 min-h-0 overflow-hidden max-h-[500px] lg:max-h-full lg:h-full lg:min-h-0 order-2 lg:order-1">
          <!-- Teammate Switcher for Managers (Dynamically updates Assigned Work, Calendar, and Stats) -->
          <div v-if="isManager" class="space-y-1 pb-2 border-b shrink-0" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>👤 Team Teammate</span>
              <span class="text-blue-500 font-normal">Active Cockpit</span>
            </label>
            <f-dropdown-menu
              :items="employeeMenuItems"
              align="left"
              class="w-full"
              aria-label="Filter entire workspace by teammate"
            >
              <template #trigger="{ isOpen }">
                <f-button
                  variant="outline"
                  theme="gray"
                  size="sm"
                  class="w-full !justify-between !text-xs font-semibold cursor-pointer"
                  :aria-expanded="isOpen ? 'true' : 'false'"
                >
                  <span class="truncate flex items-center gap-1.5">
                    <span>👤</span>
                    <span>{{ selectedEmployee === 'All' ? 'All Team Members' : selectedEmployee }}</span>
                  </span>
                  <template #suffix>
                    <svg class="w-3.5 h-3.5 opacity-60 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </template>
                </f-button>
              </template>
            </f-dropdown-menu>
          </div>

          <div class="flex items-center justify-between shrink-0">
            <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
              {{ isManager && selectedEmployee !== 'All' ? 'Assigned to ' + (selectedEmployee.split('@')[0]) : 'My Assigned Work' }}
            </h3>
            <f-badge theme="gray" variant="subtle" size="xs">{{ filteredPlannerTasks.length }}</f-badge>
          </div>
          
          <!-- Quick Search & Filter in Planner Rail -->
          <div class="space-y-1.5 shrink-0">
            <f-input
              size="sm"
              v-model="plannerTaskSearch"
              placeholder="Search assigned tasks..."
              aria-label="Search assigned tasks"
            >
              <template #prefix>
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </template>
              <template #suffix>
                <button v-if="plannerTaskSearch" @click="plannerTaskSearch = ''" type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs cursor-pointer p-0.5" aria-label="Clear search">✕</button>
              </template>
            </f-input>
            
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5" role="tablist" aria-label="Filter assigned work tasks" @keydown="onPlannerTaskTabKeydown">
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'all' ? 'solid' : 'subtle'"
                theme="gray"
                :aria-selected="plannerTaskFilter === 'all'"
                :tabindex="plannerTaskFilter === 'all' ? 0 : -1"
                data-planner-tab="all"
                @click="setPlannerTaskFilter('all')"
              >
                All
              </f-button>
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'underplanned' ? 'solid' : 'subtle'"
                theme="amber"
                :aria-selected="plannerTaskFilter === 'underplanned'"
                :tabindex="plannerTaskFilter === 'underplanned' ? 0 : -1"
                data-planner-tab="underplanned"
                @click="setPlannerTaskFilter('underplanned')"
              >
                <template #prefix><span aria-hidden="true">⏱️</span></template>
                Underplanned
              </f-button>
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'overdue' ? 'solid' : 'subtle'"
                theme="red"
                :aria-selected="plannerTaskFilter === 'overdue'"
                :tabindex="plannerTaskFilter === 'overdue' ? 0 : -1"
                data-planner-tab="overdue"
                @click="setPlannerTaskFilter('overdue')"
              >
                <template #prefix><span aria-hidden="true">⚠️</span></template>
                Overdue
              </f-button>
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'high' ? 'solid' : 'subtle'"
                theme="purple"
                :aria-selected="plannerTaskFilter === 'high'"
                :tabindex="plannerTaskFilter === 'high' ? 0 : -1"
                data-planner-tab="high"
                @click="setPlannerTaskFilter('high')"
              >
                <template #prefix><span aria-hidden="true">⭐</span></template>
                High
              </f-button>
            </div>
          </div>

          <div v-if="!filteredPlannerTasks.length" class="text-xs text-gray-400 py-6 text-center flex-1 flex flex-col items-center justify-center">
            <span>No matching tasks found.</span>
            <button v-if="plannerTaskFilter !== 'all' || plannerTaskSearch" type="button" 
              class="text-blue-500 font-bold hover:underline mt-1 text-[11px]" 
              @click="setPlannerTaskFilter('all'); plannerTaskSearch = ''">
              Clear filters
            </button>
          </div>
          <ul v-else class="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
            <li v-for="t in filteredPlannerTasks" :key="t.ref" class="rounded-2xl border transition-all overflow-hidden"
              :class="pickedTask && pickedTask.ref === t.ref
                ? (isDarkMode ? 'bg-blue-950/70 border-blue-600 ring-2 ring-blue-500/30' : 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20')
                : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 hover:border-gray-600' : 'bg-gray-50 border-gray-200 hover:border-gray-300')">
              <button type="button"
                @click="pickTask(t)"
                class="w-full text-left p-3 cursor-pointer">
                <div class="text-xs font-bold leading-snug" :class="isDarkMode ? 'text-gray-100' : 'text-gray-800'">{{ t.subject }}</div>
                <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <f-badge v-if="t.project_name" theme="gray" variant="outline" size="xs">{{ t.project_name }}</f-badge>
                  <f-badge v-if="t.priority" :theme="t.priority === 'High' || t.priority === 'Urgent' ? 'red' : 'amber'" variant="subtle" size="xs">{{ t.priority }}</f-badge>
                  <span v-if="t.due_date" class="text-[10px] text-gray-400 font-mono">due {{ t.due_date }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                  <span>planned <b :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ fmtHrs(t.booked_hours) }}h</b></span>
                  <span>·</span>
                  <span>logged <b class="text-emerald-500">{{ fmtHrs(t.logged_hours) }}h</b></span>
                  <span>·</span>
                  <span>expected <b :class="t.estimate_hours ? (isDarkMode ? 'text-gray-200' : 'text-gray-700') : 'text-gray-400'">{{ fmtHrs(t.estimate_hours) }}h</b></span>
                </div>
              </button>
              <div class="px-3 py-1.5 border-t flex items-center justify-between" :class="isDarkMode ? 'border-gray-700/60 bg-black/10' : 'border-gray-200/60 bg-white/50'">
                <button type="button" @click.stop="openTaskDetails(t)" class="text-[10px] text-gray-400 font-mono truncate max-w-[120px] hover:text-blue-500 hover:underline cursor-pointer" title="View details in sidebar drawer">
                  #{{ t.name || t.ref }}
                </button>
                <div class="flex items-center gap-2">
                  <button type="button" @click.stop="openTaskDetails(t)" class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer" title="Open full details panel">
                    <span>Details</span>
                  </button>
                  <button type="button" @click.stop="openTaskRavenDrawer(t)" class="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 cursor-pointer" title="Discuss in Raven channel">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>Discuss</span>
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </f-card>

        <!-- Calendar (Frappe UI FCard Container) -->
        <f-card :padded="false" class="-mx-3 sm:mx-0 rounded-none sm:rounded-3xl border-x-0 sm:border-x overflow-hidden flex flex-col min-h-0 h-[640px] lg:h-full lg:max-h-full lg:min-h-0 order-1 lg:order-2">
          <!-- toolbar (Frappe UI Controls) -->
          <div class="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 border-b transition-colors" :class="isDarkMode ? 'border-gray-800 bg-[#25262A]' : 'border-gray-200 bg-gray-50/60'">
            
            <!-- Left: Today Button, Period Navigation Chevrons, Date Range -->
            <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <!-- Jump to Today Button -->
              <f-button 
                variant="subtle" 
                theme="gray" 
                size="sm" 
                @click="plannerToday" 
                aria-label="Jump to current date in calendar"
              >
                Today
              </f-button>

              <!-- Grouped Navigation Chevrons -->
              <div class="inline-flex items-center rounded-xl border p-0.5 shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-white border-gray-300'" role="group" aria-label="Calendar period navigation">
                <f-button 
                  variant="ghost" 
                  theme="gray" 
                  size="sm" 
                  class="!w-7 !h-7 !p-0"
                  @click="plannerShift(-1)" 
                  :aria-label="'Previous ' + (plannerView === 'day' ? 'day' : (plannerView === '4days' ? '4 days' : 'week'))"
                >
                  <template #prefix>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </template>
                </f-button>

                <div class="w-[1px] h-4 mx-1" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" aria-hidden="true"></div>

                <h3 class="text-xs sm:text-sm font-extrabold tracking-tight text-center px-2 tabular-nums whitespace-nowrap flex-1 sm:flex-none sm:w-[168px]" :class="isDarkMode ? 'text-white' : 'text-gray-900'" aria-live="polite">
                  {{ plannerRangeLabel }}
                </h3>

                <div class="w-[1px] h-4 mx-1" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" aria-hidden="true"></div>

                <f-button 
                  variant="ghost" 
                  theme="gray" 
                  size="sm" 
                  class="!w-7 !h-7 !p-0"
                  @click="plannerShift(1)" 
                  :aria-label="'Next ' + (plannerView === 'day' ? 'day' : (plannerView === '4days' ? '4 days' : 'week'))"
                >
                  <template #prefix>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </template>
                </f-button>
              </div>

            </div>

            <!-- Right: Nature Filter & View Switcher (Day / 4 Days / Week) -->
            <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">

              <!-- Nature filter (Frappe UI FDropdownMenu) -->
              <f-dropdown-menu :items="plannerNatureMenuItems" align="right" :aria-label="'Filter calendar events by nature: ' + natureFilterLabel">
                <template #trigger="{ toggle, isOpen }">
                  <f-button
                    variant="outline"
                    :theme="natureFilter.length ? 'blue' : 'gray'"
                    size="sm"
                    class="min-w-[130px] max-w-[200px] !justify-between text-xs font-bold transition-all"
                    :class="natureFilter.length ? (isDarkMode ? 'bg-blue-950/40 border-blue-600 text-blue-300 font-extrabold ring-1 ring-blue-500/30' : 'bg-blue-50 border-blue-300 text-blue-800 font-extrabold ring-1 ring-blue-500/20') : ''"
                    :aria-expanded="isOpen"
                    :aria-label="'Filter calendar events by nature. Current filter: ' + natureFilterLabel"
                    @click="toggle"
                  >
                    <span class="truncate flex items-center gap-1.5">
                      <span v-if="natureFilter.length" class="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden="true"></span>
                      <span>{{ natureFilterLabel }}</span>
                    </span>
                    <template #suffix>
                      <svg class="w-3.5 h-3.5 opacity-60 ml-1 shrink-0 transition-transform" :class="isOpen ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.5 7.5l4.5 4.5 4.5-4.5z"></path></svg>
                    </template>
                  </f-button>
                </template>
              </f-dropdown-menu>


              <!-- View Switcher: Day / 4 Days / Week (Frappe UI Button Group) -->
              <div class="inline-flex items-center rounded-xl p-0.5 border shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-gray-100 border-gray-300'" role="radiogroup" aria-label="Calendar view density" @keydown="onPlannerViewKey">
                <f-button 
                  size="sm"
                  :variant="plannerView === 'day' ? 'solid' : 'ghost'"
                  :theme="plannerView === 'day' ? 'blue' : 'gray'"
                  class="!px-2.5 !py-1 !text-xs font-bold"
                  role="radio" 
                  data-planner-view
                  :tabindex="plannerView === 'day' ? 0 : -1"
                  :aria-checked="plannerView === 'day'"
                  @click="setUserPlannerView('day')"
                >
                  Day
                </f-button>
                <f-button 
                  size="sm"
                  :variant="plannerView === '4days' ? 'solid' : 'ghost'"
                  :theme="plannerView === '4days' ? 'blue' : 'gray'"
                  class="!px-2.5 !py-1 !text-xs font-bold"
                  role="radio" 
                  data-planner-view
                  :tabindex="plannerView === '4days' ? 0 : -1"
                  :aria-checked="plannerView === '4days'"
                  @click="setUserPlannerView('4days')"
                >
                  4 Days
                </f-button>
                <f-button 
                  size="sm"
                  :variant="plannerView === 'week' ? 'solid' : 'ghost'"
                  :theme="plannerView === 'week' ? 'blue' : 'gray'"
                  class="!px-2.5 !py-1 !text-xs font-bold"
                  role="radio" 
                  data-planner-view
                  :tabindex="plannerView === 'week' ? 0 : -1"
                  :aria-checked="plannerView === 'week'"
                  @click="setUserPlannerView('week')"
                >
                  Week
                </f-button>
              </div>
            </div>
          </div>

          <!-- Banners & Feedback -->
          <div v-if="pastBookingHint" class="px-3 py-2 text-[11px] font-semibold flex items-center gap-2 border-b" :class="isDarkMode ? 'bg-amber-950/60 text-amber-200 border-amber-900/50' : 'bg-amber-50 text-amber-800 border-amber-200'" role="status">
            <f-badge theme="amber" variant="solid" size="xs">🔒</f-badge>
            <span>{{ pastBookingHint }}</span>
          </div>
          <div v-if="pickedTask" class="px-3 py-2 text-[11px] flex items-center justify-between gap-2 border-b" :class="isDarkMode ? 'bg-blue-950/50 text-blue-200 border-blue-900/50' : 'bg-blue-50 text-blue-700 border-blue-200'">
            <div class="flex items-center gap-2">
              <f-badge theme="blue" variant="solid" size="xs">📌 Booking</f-badge>
              <span><b>{{ pickedTask.subject }}</b> — click a time slot to place it.</span>
            </div>
            <f-button variant="ghost" theme="blue" size="xs" @click="pickedTask = null">Clear</f-button>
          </div>

          <!-- grid -->
          <div class="overflow-x-auto flex-1 min-h-0 flex flex-col">
            <div class="flex-1 min-h-0 flex flex-col" :class="plannerView === 'day' ? 'w-full min-w-0' : (plannerView === '4days' ? 'w-full min-w-[500px]' : 'min-w-[640px]')">
              <!-- day headers -->
              <div class="grid border-b shrink-0" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
                <div></div>
                <div v-for="d in plannerDays" :key="d" class="text-center py-2">
                  <div class="text-[10px] uppercase font-bold text-gray-400">{{ dowLabel(d) }}</div>
                  <div class="text-sm font-bold" :class="d === todayDate ? 'text-blue-500' : (isDarkMode ? 'text-gray-200' : 'text-gray-800')">{{ domLabel(d) }}</div>
                </div>
              </div>
              <!-- all-day / away row -->
              <div v-if="hasAwayBlocksInView" class="grid border-b text-[11px] shrink-0" :class="isDarkMode ? 'border-gray-800 bg-[#161719]' : 'border-gray-200 bg-gray-50/80'" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
                <div class="flex items-center justify-end pr-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">All Day</div>
                <div v-for="d in plannerDays" :key="'away-' + d" class="border-l p-1 min-h-[34px] min-w-0 flex flex-col gap-1 overflow-hidden" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
                  <button type="button" v-for="b in awayBlocksForDay(d)" :key="b.name"
                    @click="openBlockDrawer(b)"
                    class="w-full text-left rounded-md px-2 py-1 text-[10px] font-semibold truncate border cursor-pointer transition-transform hover:scale-[1.01] shadow-2xs flex items-center justify-between gap-1"
                    :class="b.task_nature && b.task_nature.includes('Absent')
                      ? (isDarkMode ? 'bg-rose-950/60 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-800')
                      : (isDarkMode ? 'bg-amber-950/60 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-800')">
                    <span class="truncate">
                      <span>{{ b.task_nature || '🌴 Away' }}</span>
                      <span v-if="b.deliverable_notes && b.deliverable_notes !== b.task_nature" class="opacity-80 ml-1">· {{ b.deliverable_notes }}</span>
                    </span>
                    <span class="shrink-0 text-[8px] font-bold px-1 rounded uppercase tracking-wider bg-black/10 dark:bg-white/20">Non-Paid</span>
                  </button>
                </div>
              </div>
              <!-- hour rows (full 24h, scrollable; opens scrolled to ~7a) -->
              <div ref="plannerGridScroll" class="overflow-y-auto overscroll-contain flex-1 min-h-0"
                @touchstart="onPlannerTouchStart" @touchend="onPlannerTouchEnd"
                style="scrollbar-gutter: stable;">
              <div class="relative" :style="{ height: (plannerHours.length * 44) + 'px' }">
                <div class="absolute inset-0 grid" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
                  <!-- hour gutter -->
                  <div class="relative">
                    <div v-for="(h, i) in plannerHours" :key="h" class="absolute left-0 right-1 text-[10px] text-right -translate-y-1/2" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'" :style="{ top: (i * 44) + 'px' }">{{ hourLabel(h) }}</div>
                    <div v-for="m in officeMarks" :key="'oml-' + m.kind" class="absolute left-0 right-1 text-[8px] font-bold text-right -translate-y-1/2 text-emerald-600 dark:text-emerald-400" :style="{ top: m.top }" :title="m.title">🏢</div>
                  </div>
                  <!-- day columns -->
                  <div v-for="d in plannerDays" :key="d" data-day-col class="relative border-l" :class="isDarkMode ? 'border-gray-700' : 'border-gray-300'">
                    <!-- away day: stretch the all-day record across office hours -->
                    <div v-for="b in awayBlocksForDay(d)" :key="'awayband-' + b.name"
                      class="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed pointer-events-none z-0 flex items-center justify-center"
                      :class="b.task_nature && b.task_nature.includes('Absent')
                        ? (isDarkMode ? 'bg-rose-950/40 border-rose-800/70' : 'bg-rose-100/70 border-rose-300')
                        : (isDarkMode ? 'bg-amber-950/40 border-amber-800/70' : 'bg-amber-100/70 border-amber-300')"
                      :style="officeBandStyle" aria-hidden="true">
                      <span class="text-[10px] font-bold uppercase tracking-wider"
                        :class="b.task_nature && b.task_nature.includes('Absent')
                          ? (isDarkMode ? 'text-rose-300' : 'text-rose-700')
                          : (isDarkMode ? 'text-amber-300' : 'text-amber-700')">{{ b.task_nature || '🌴 Away' }}</span>
                    </div>
                    <!-- past time is shaded, so the eye avoids booking behind the now-line -->
                    <div class="absolute left-0 right-0 pointer-events-none z-0" :class="isDarkMode ? 'bg-black/35' : 'bg-gray-900/[0.07]'" :style="pastShadeStyle(d)" aria-hidden="true"></div>
                    <!-- office start/end: two hairlines instead of a banner above the grid -->
                    <div v-for="m in officeMarks" :key="'om-' + d + m.kind"
                      class="absolute left-0 right-0 border-t-2 pointer-events-none z-0"
                      :class="isDarkMode ? 'border-emerald-500/40' : 'border-emerald-500/50'"
                      :style="{ top: m.top }" :aria-hidden="true"></div>
                    <div v-for="(h, i) in plannerHours" :key="h"
                      class="absolute left-0 right-0 border-t cursor-cell transition-colors touch-pan-y"
                      :class="[isDarkMode ? 'border-gray-700 hover:bg-blue-950/30' : 'border-gray-300 hover:bg-blue-50/60']"
                      :style="{ top: (i * 44) + 'px', height: '44px' }"
                      role="button"
                      :aria-label="'Book work on ' + d + ' at ' + hourLabel(h) + ' — drag to cover more hours'"
                      tabindex="0"
                      @pointerdown="startSlotSelect($event, d)"
                      @click="openBookModal(d, h)"
                      @keydown.enter.prevent="openBookModal(d, h)"
                      @keydown.space.prevent="openBookModal(d, h)">
                      <!-- half-hour tick: faint, so the 30-min mark is readable -->
                      <div class="absolute left-0 right-0 top-1/2 border-t border-dashed pointer-events-none"
                        :class="isDarkMode ? 'border-gray-800/70' : 'border-gray-200'" aria-hidden="true"></div>
                    </div>
                    <!-- drag-to-select ghost -->
                    <div v-if="slotSel && slotSel.iso === d" class="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed pointer-events-none z-10 flex items-start justify-center pt-0.5"
                      :class="isDarkMode ? 'border-blue-500 bg-blue-500/20' : 'border-blue-500 bg-blue-500/10'"
                      :style="slotSelStyle">
                      <span class="text-[9px] font-bold text-blue-600 dark:text-blue-300">{{ slotSelLabel }}</span>
                    </div>
                    <!-- current-time line (today only), like Google Calendar -->
                    <div v-if="isTodayCol(d)" class="absolute left-0 right-0 pointer-events-none z-20" :style="{ top: nowLineTop + 'px' }" aria-hidden="true">
                      <div class="relative h-0 border-t-2 border-red-500">
                        <span class="absolute -left-1 -top-[5px] w-2.5 h-2.5 rounded-full bg-red-500 shadow"></span>
                        <span class="absolute right-0.5 -top-[9px] text-[9px] font-bold font-mono px-1 rounded bg-red-500 text-white">{{ nowLineLabel }}</span>
                      </div>
                    </div>
                    <!-- timed blocks with smart overlapping sub-lanes and midnight continuation -->
                    <div role="button" tabindex="0" v-for="seg in timedSegmentsForDay(d)" :key="seg.key"
                      @pointerdown="startBlockDrag($event, seg.block, 'move')"
                      @click.stop="onBlockClick(seg.block)"
                      @keydown.enter.prevent="openBlockDrawer(seg.block)"
                      @keydown.space.prevent="openBlockDrawer(seg.block)"
                      @pointerenter="showBlockHover($event, seg)"
                      @pointerleave="hideBlockHover"
                      @focus="showBlockHover($event, seg)"
                      @blur="hideBlockHover"
                      :aria-label="(seg.block.task_subject || seg.block.work_item_label || seg.block.deliverable_notes || 'Work block') + ' ' + segTimeTitle(seg)"
                      class="absolute rounded-lg px-2 py-1 text-left overflow-hidden border touch-pan-y select-none hover:z-20 transition-[left,width] duration-75"
                      :class="[blockClass(seg.block), isBlockLocked(seg.block) ? 'cursor-pointer' : ((plannerDrag && plannerDrag.name === seg.block.name) ? 'cursor-grabbing' : 'cursor-grab'), holdArmed === seg.block.name ? 'ring-2 ring-blue-500 ring-offset-1 z-30 scale-[1.02]' : '']"
                      :style="segStyle(seg)">
                      <!-- recorded (timesheet) time filling up from the bottom of the planned block -->
                      <div v-if="seg.block.actual_hours > 0 && seg.block.status !== 'Cancelled' && !seg.block.is_away"
                        class="absolute left-0 right-0 bottom-0 pointer-events-none rounded-b-lg"
                        :class="seg.block.actual_hours > seg.block.duration_hours ? 'bg-rose-500/25 border-t-2 border-rose-500' : 'bg-emerald-500/30 border-t-2 border-emerald-500'"
                        :style="{ height: Math.min(100, (seg.block.actual_hours / (parseFloat(seg.block.duration_hours) || seg.block.actual_hours) * 100)) + '%' }"
                        :title="fmtHrs(seg.block.actual_hours) + 'h recorded of ' + fmtHrs(seg.block.duration_hours) + 'h planned'"></div>
                      <!-- Live recording fill bar when session is actively tracking on this block -->
                      <div v-if="isTracking && (trackerBlockName === seg.block.name || seg.block.is_live_active)"
                        class="absolute left-0 right-0 bottom-0 pointer-events-none rounded-b-lg bg-red-500/25 border-t-2 border-red-500"
                        :style="{ height: Math.min(100, Math.max(8, ((trackerSeconds / 3600) / (parseFloat(seg.block.duration_hours) || 1) * 100))) + '%' }"
                        :title="'Live Recording: ' + formattedTime + ' elapsed'"></div>
                      <div class="relative text-[10px] font-bold leading-tight flex items-center justify-between gap-1">
                        <div class="truncate flex items-center gap-1 min-w-0">
                          <span v-if="isTracking && (trackerBlockName === seg.block.name || seg.block.is_live_active)" class="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-600 text-white shrink-0 shadow-xs animate-pulse">
                            <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            <span>REC {{ formattedTime }}</span>
                          </span>
                          <span v-if="seg.is_segment && seg.segment_type === 'head'" class="text-[9px] opacity-75 font-normal mr-1">↩ (cont.)</span>
                          <span class="truncate">{{ seg.block.task_subject || seg.block.work_item_label || seg.block.deliverable_notes || 'Work block' }}</span>
                          <span v-if="seg.block.pairing_partner" class="text-[9px] px-1 py-0.2 rounded bg-purple-500/30 text-purple-100 border border-purple-400/40 shrink-0 font-normal" :title="'Paired with ' + (seg.block.pairing_partner_name || seg.block.pairing_partner)">👥</span>
                          <span v-if="seg.is_segment && seg.segment_type === 'tail'" class="text-[9px] opacity-75 font-normal ml-1">↪</span>
                        </div>

                        <!-- In-Calendar Approval & Governance Controls for Reporting Officer / Manager -->
                        <div class="flex items-center gap-1 shrink-0 z-30" v-if="isManager && (seg.block.actual_hours > 0 || seg.block.approval_status === 'Approved' || seg.block.approval_status === 'Flagged')">
                          <!-- Approved Lock Badge -->
                          <span v-if="seg.block.approval_status === 'Approved'"
                            class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white shadow-xs"
                            title="Approved & Locked by Reporting Officer">
                            ✓
                          </span>
                          <!-- Flagged Indicator Badge -->
                          <button v-else-if="seg.block.approval_status === 'Flagged'"
                            type="button"
                            @click.stop="quickFlagBlock(seg.block)"
                            class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-black hover:bg-amber-400 cursor-pointer shadow-xs"
                            title="Flagged for clarification. Click to re-flag or inspect notes.">
                            🚩
                          </button>
                          <!-- Pending Quick Actions: Approve (✓) or Flag (🚩) -->
                          <template v-else>
                            <button
                              type="button"
                              @click.stop="quickApproveBlock(seg.block)"
                              class="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-[10px] shadow-xs cursor-pointer transition-transform"
                              title="One-click Approve & Lock timesheet">
                              ✓
                            </button>
                            <button
                              type="button"
                              @click.stop="quickFlagBlock(seg.block)"
                              class="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[9px] shadow-xs cursor-pointer transition-transform"
                              title="Flag for clarification">
                              🚩
                            </button>
                          </template>
                        </div>
                      </div>
                      <div class="relative text-[9px] opacity-80">{{ dragTimeLabel(seg) }}</div>
                      <div class="relative text-[9px] opacity-80" v-if="segHeight(seg) > 44">
                        <template v-if="isTracking && (trackerBlockName === seg.block.name || seg.block.is_live_active)">
                          <span class="text-red-500 font-extrabold">{{ fmtHrs(trackerSeconds / 3600) }}h running</span> / {{ fmtHrs(seg.block.duration_hours) }}h
                        </template>
                        <template v-else>
                          {{ fmtHrs(seg.block.actual_hours) }}/{{ fmtHrs(seg.block.duration_hours) }}h
                          <span v-if="seg.block.variance_hours" :class="seg.block.variance_hours < 0 ? 'text-amber-200' : 'text-rose-200'">({{ seg.block.variance_hours > 0 ? '+' : '' }}{{ fmtHrs(seg.block.variance_hours) }})</span>
                        </template>
                      </div>
                      <div v-if="!isBlockLocked(seg.block)" @pointerdown.stop="startBlockDrag($event, seg.block, 'resize-start')"
                        class="absolute left-0 right-0 top-0 h-2 cursor-ns-resize" aria-hidden="true"
                        title="Drag to change the start time"></div>
                      <div v-if="!isBlockLocked(seg.block)" @pointerdown.stop="startBlockDrag($event, seg.block, 'resize')"
                        class="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize" aria-hidden="true"
                        title="Drag to change the end time"></div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>  <!-- /overflow-x-auto -->
        </f-card>  <!-- /planner calendar card -->

        <!-- Right side rail: Statistical Counts Cards (Right side panel on big screens) -->
        <div class="order-3 lg:col-span-1 xl:col-span-1 flex flex-col space-y-2.5 w-full min-h-0 lg:h-full lg:max-h-full overflow-hidden">
          <div class="flex items-center justify-between px-1 shrink-0">
            <h3 class="font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Week Performance</h3>
            <span class="text-[10px] font-mono text-gray-400 font-semibold" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">Overview</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 content-start items-start gap-2 sm:gap-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
            <!-- Card 1: Planned this week -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="flex items-center justify-between">
                <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Planned this week</div>
                <f-badge v-if="plannerData.totals && plannerData.totals.away_count" theme="amber" variant="subtle" size="xs">
                  🌴 {{ plannerData.totals.away_count }} away
                </f-badge>
              </div>
              <div class="text-lg xl:text-xl font-extrabold mt-0.5" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                {{ fmtHrs(plannerData.totals.planned_hours) }}<span class="text-xs font-normal text-gray-400">h</span>
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5">
                {{ plannerData.totals.block_count }} work block{{ plannerData.totals.block_count === 1 ? '' : 's' }}
              </div>
            </f-card>

            <!-- Card 2: Actually logged -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Actually logged</div>
              <div class="text-lg xl:text-xl font-extrabold text-emerald-500 mt-0.5">
                {{ fmtHrs(plannerData.totals.actual_hours) }}<span class="text-xs font-normal text-gray-400">h</span>
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5">across real sessions</div>
            </f-card>

            <!-- Card 3: Plan vs actual -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Plan vs actual</div>
              <div class="text-lg xl:text-xl font-extrabold mt-0.5" :class="plannerData.totals.variance_hours < 0 ? 'text-amber-500' : (plannerData.totals.variance_hours > 0 ? 'text-rose-500' : 'text-gray-400')">
                {{ plannerData.totals.variance_hours > 0 ? '+' : '' }}{{ fmtHrs(plannerData.totals.variance_hours) }}<span class="text-xs font-normal text-gray-400">h</span>
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5">
                {{ plannerData.totals.variance_hours < 0 ? 'under-logged vs plan' : (plannerData.totals.variance_hours > 0 ? 'overran the plan' : 'on plan') }}
              </div>
            </f-card>

            <!-- Card 4: Adherence -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Adherence</div>
              <div class="text-lg xl:text-xl font-extrabold text-blue-500 mt-0.5">
                {{ plannerData.totals.adherence_pct }}<span class="text-xs font-normal text-gray-400">%</span>
              </div>
              <div class="mt-1 h-1.5 rounded-full overflow-hidden" :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'">
                <div class="h-full bg-blue-500 rounded-full transition-all duration-300" :style="{ width: Math.min(100, plannerData.totals.adherence_pct) + '%' }"></div>
              </div>
            </f-card>
          </div>
        </div>
      </div>  <!-- /planner three-column grid -->
    </div>  <!-- /TAB 8: PLANNER -->
    <!-- The live tracker lives in the header pill only — no floating HUD (duplicate UI). -->

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
  <!-- PLANNER: BOOK WORK BLOCK MODAL             -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showBookModal"
    :title="bookForm.mode === 'work' ? 'Book a work block' : 'Mark time away'"
    size="sm"
    z-index="z-[60]"
  >
    <div class="space-y-3">
      <div class="flex gap-1.5">
        <button v-for="m in [['work','🎯 Work'],['🌴 Leave','🌴 Leave'],['🤒 Absent','🤒 Absent']]" :key="m[0]" type="button"
          @click="bookForm.mode = m[0]"
          class="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer transition-colors"
          :class="bookForm.mode === m[0] ? (isDarkMode ? 'bg-blue-950/80 border-blue-600 text-blue-200' : 'bg-blue-50 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600')">
          {{ m[1] }}
        </button>
      </div>
      <!-- Assign To Employee (Managers / Reporting Officers) -->
      <div v-if="isManager" class="block space-y-1">
        <label class="text-[11px] font-bold text-gray-500 flex items-center justify-between">
          <span>👤 Assign To Employee</span>
          <span class="text-[10px] font-normal text-blue-500">Direct Manager Scheduling</span>
        </label>
        <f-combobox
          v-model="bookForm.assigned_employee"
          :options="comboboxAssigneeOptions"
          placeholder="— Assign to Myself —"
          search-placeholder="Search teammate..."
          aria-label="Assign to Employee"
        ></f-combobox>
      </div>

      <div v-if="bookForm.mode === 'work'" class="block space-y-1">
        <label class="text-[11px] font-bold text-gray-500">Task / work item</label>
        <f-combobox
          v-model="bookForm.work_item"
          :options="comboboxBookTaskOptions"
          placeholder="— Ad-hoc (no linked task) —"
          search-placeholder="Search task by title or project..."
          aria-label="Task or work item"
        ></f-combobox>
      </div>
      <!-- Collaborative Pairing Partner (Reciprocal Mirroring) -->
      <div v-if="bookForm.mode === 'work'" class="block space-y-1">
        <label class="text-[11px] font-bold text-gray-500 flex items-center justify-between">
          <span>👥 Collaborative Pairing Partner (optional)</span>
          <span class="text-[10px] font-normal text-blue-500">Auto-mirrors block &amp; session</span>
        </label>
        <f-combobox
          v-model="bookForm.pairing_partner"
          :options="comboboxPairingPartnerOptions"
          placeholder="— Solo Session (No pairing) —"
          search-placeholder="Search teammate..."
          aria-label="Pairing partner"
        ></f-combobox>
      </div>
      <!-- full detail of the picked task -->
      <div v-if="bookForm.mode === 'work' && bookFormTask" class="rounded-xl border px-3 py-2 space-y-1"
        :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
        <div class="text-xs font-bold leading-snug break-words" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ bookFormTask.subject }}</div>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
          <span v-if="bookFormTask.project_name || bookFormTask.project">📁 {{ bookFormTask.project_name || bookFormTask.project }}</span>
          <span v-if="bookFormTask.priority">· {{ bookFormTask.priority }}</span>
          <span v-if="bookFormTask.due_date">· due {{ bookFormTask.due_date }}</span>
          <span v-if="bookFormTask.status">· {{ bookFormTask.status }}</span>
        </div>
        <!-- Task KPI Progress (if defined on Task) -->
        <div v-if="bookFormTask.kpi_target" class="py-1">
          <div class="flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span>🎯 KPI Target: {{ bookFormTask.kpi_name || 'Deliverable' }}</span>
            <span>{{ bookFormTask.kpi_completed || 0 }} / {{ bookFormTask.kpi_target }} {{ bookFormTask.kpi_unit }} ({{ bookFormTask.kpi_progress || 0 }}%)</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
            <div class="bg-emerald-500 h-full rounded-full transition-all" :style="{ width: Math.min(bookFormTask.kpi_progress || 0, 100) + '%' }"></div>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-x-2 text-[11px]" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
          <span>planned <b :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ fmtHrs(bookFormTask.booked_hours) }}h</b></span>
          <span>· logged <b class="text-emerald-500">{{ fmtHrs(bookFormTask.logged_hours) }}h</b></span>
          <span>· expected <b :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ fmtHrs(bookFormTask.estimate_hours) }}h</b></span>
        </div>
        <div v-if="bookFormTask.description" class="text-[11px] leading-snug break-words max-h-24 overflow-y-auto" :class="isDarkMode ? 'text-gray-400' : 'text-gray-600'">{{ bookFormTask.description }}</div>
      </div>
      <!-- Date & Time: when work, show Start & End; when away, show Date only (All-Day) -->
      <div v-if="bookForm.mode === 'work'" class="grid grid-cols-3 gap-2">
        <label class="block col-span-1"><span class="text-[11px] font-bold text-gray-500">Date</span>
          <input type="date" v-model="bookForm.work_date" class="mt-1 w-full text-sm rounded-xl px-2 py-2 border outline-none" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
        <label class="block col-span-1"><span class="text-[11px] font-bold text-gray-500">Start</span>
          <input type="time" v-model="bookForm.start_time" class="mt-1 w-full text-sm rounded-xl px-2 py-2 border outline-none" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
        <label class="block col-span-1"><span class="text-[11px] font-bold text-gray-500">End</span>
          <input type="time" v-model="bookForm.end_time" class="mt-1 w-full text-sm rounded-xl px-2 py-2 border outline-none" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
      </div>
      <div v-else class="space-y-1">
        <label class="block"><span class="text-[11px] font-bold text-gray-500">Date</span>
          <input type="date" v-model="bookForm.work_date" class="mt-1 w-full text-sm rounded-xl px-3 py-2 border outline-none" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
        <div class="text-[11px] text-gray-400 pl-0.5">Recorded as an all-day away event on the calendar banner.</div>
      </div>
      <label class="block"><span class="text-[11px] font-bold text-gray-500">Notes (optional)</span>
        <input type="text" v-model="bookForm.deliverable_notes" :placeholder="bookForm.mode === 'work' ? 'What will you get done?' : 'Reason / coverage details'" class="mt-1 w-full text-sm rounded-xl px-3 py-2 border outline-none" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showBookModal = false">Cancel</f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="submitBooking" :disabled="plannerBusy">{{ bookForm.mode === 'work' ? 'Book block' : 'Mark away' }}</f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- WORKSTATION: EMPTY STOP CONFIRMATION MODAL -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showEmptyStopModal"
    title="End Focus Session"
    subtitle="No bullet notes recorded yet"
    size="sm"
    z-index="z-[60]"
  >
    <div class="space-y-3 py-1">
      <p class="text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-600'">
        You haven't added any bullet notes to this session. What would you like to do with this elapsed time?
      </p>
      <div class="block space-y-1">
        <label class="text-[11px] font-bold" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">Quick Note (used for Timesheet description):</label>
        <input
          v-model="emptyStopQuickNote"
          type="text"
          placeholder="e.g. Focus work session"
          class="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900'"
          @keydown.enter.prevent="confirmEmptyStopSave"
        />
      </div>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <f-button
          variant="outline"
          theme="gray"
          size="sm"
          @click="confirmEmptyStopDiscard"
        >
          Discard (No Timesheet)
        </f-button>
        <f-button
          variant="solid"
          theme="blue"
          size="sm"
          @click="confirmEmptyStopSave"
        >
          Save &amp; Log ({{ fmtHrs(emptyStopElapsedHrs) }}h)
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ============================================== -->
  <!-- WORKSTATION: START TIME CHOICE MODAL (On-Time) -->
  <!-- ============================================== -->
  <f-dialog
    v-model="showStartTimeChoiceModal"
    title="Choose Session Start Time"
    :dismissable="true"
    size="sm"
    z-index="z-[60]"
    @close="showStartTimeChoiceModal = false; pendingStartBlock = null"
  >
    <div class="space-y-3 py-2">
      <div class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        You are starting work on
        <span class="font-bold text-gray-900 dark:text-white">{{ pendingStartBlock && (pendingStartBlock.task_subject || pendingStartBlock.work_item_label || pendingStartBlock.name) }}</span>,
        which was scheduled earlier today. How would you like to anchor your session start?
      </div>

      <div class="space-y-2 mt-2">
        <button
          v-for="opt in pendingStartTimeOptions"
          :key="opt.label"
          type="button"
          @click="selectStartTimeChoice(opt.epoch)"
          class="w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer group"
          :class="opt.isOntime
            ? (isDarkMode ? 'bg-emerald-950/40 border-emerald-800 hover:bg-emerald-950/70 hover:border-emerald-700' : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300')
            : (isDarkMode ? 'bg-[#252528] border-gray-700 hover:bg-[#2b2b2f]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100')"
        >
          <div
            class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            :class="opt.isOntime ? 'bg-emerald-500 text-white shadow-xs' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
          >
            <span v-if="opt.isOntime" class="text-sm">🎯</span>
            <span v-else class="text-sm">⏱️</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold leading-tight" :class="opt.isOntime ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-200'">
              {{ opt.label }}
            </div>
            <div class="text-[11px] mt-0.5 text-gray-500 dark:text-gray-400">
              {{ opt.sublabel }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showStartTimeChoiceModal = false; pendingStartBlock = null">Cancel</f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- 30-MINUTE INACTIVITY GOVERNOR MODAL        -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showInactivityModal"
    :title="inactivityMinutes >= 60 ? 'Prolonged Inactivity Detected' : 'Are you still working?'"
    :subtitle="inactivityMinutes >= 60 ? 'Active timer left running unattended' : '30 minutes without activity or notes'"
    size="md"
    z-index="z-[60]"
  >
    <div class="space-y-3.5 py-1 text-xs">
      <div class="p-3.5 rounded-2xl border flex items-start gap-3 transition-colors"
        :class="inactivityMinutes >= 60 ? (isDarkMode ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50/70 border-amber-200 text-amber-900') : (isDarkMode ? 'bg-blue-950/20 border-blue-800/40 text-blue-200' : 'bg-blue-50/70 border-blue-200 text-blue-900')">
        <span class="text-base select-none shrink-0" aria-hidden="true">{{ inactivityMinutes >= 60 ? '⚠️' : '⏱️' }}</span>
        <div class="space-y-1">
          <div class="font-bold text-[13px] leading-snug">
            {{ inactivityMinutes >= 60 ? ('No notes logged for ' + Math.floor(inactivityMinutes / 60) + 'h ' + (inactivityMinutes % 60) + 'm') : ('No notes logged for ' + inactivityMinutes + ' minutes') }}
          </div>
          <p class="text-xs leading-relaxed opacity-90">
            {{ inactivityMinutes >= 60 ? 'This session appears to have been left running without updates. You can continue working, cap the timesheet at your last edit, or discard this session.' : 'You normally log bullet updates every 10–15 minutes on active work.' }}
          </p>
        </div>
      </div>

      <div class="rounded-2xl border p-4 space-y-2.5 transition-colors"
        :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-gray-200' : 'bg-gray-50/80 border-gray-200 text-gray-700'">
        <div class="flex items-start justify-between text-xs gap-3">
          <span class="text-gray-400 font-medium shrink-0">Active Task:</span>
          <span class="font-bold text-right break-words line-clamp-2 text-gray-900 dark:text-white">{{ trackerNotes || (trackerBoundBlock ? (trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label) : 'Active Work') }}</span>
        </div>
        <div v-if="sessionStart" class="flex items-center justify-between text-xs">
          <span class="text-gray-400 font-medium">Session started:</span>
          <span class="font-mono font-medium">{{ sessionStart.date }} · {{ sessionStart.time }}</span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-400 font-medium">Last edit recorded:</span>
          <span class="font-mono font-bold">{{ lastActivityTimeHHMM }}</span>
        </div>
        <div class="flex items-center justify-between text-xs pt-1 border-t border-gray-200/50 dark:border-gray-800">
          <span class="text-gray-400 font-medium">Current elapsed timer:</span>
          <span class="font-mono font-black text-sm text-blue-600 dark:text-blue-400">{{ formattedTime }}</span>
        </div>
      </div>
    </div>

    <template #actions>
      <div class="flex flex-col gap-3 w-full">
        <!-- Primary & Completion Actions Row -->
        <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 w-full">
          <f-button
            variant="ghost"
            theme="gray"
            size="sm"
            @click="stopInactivitySessionNow"
          >
            Stop Now
          </f-button>
          <f-button
            variant="outline"
            theme="gray"
            size="sm"
            @click="stopInactivitySessionAtLastEditPlus15"
            :title="'Log timesheet up to ' + suggestedStopHHMM"
          >
            Stop at {{ suggestedStopHHMM }} (+15m)
          </f-button>
          <f-button
            variant="solid"
            theme="blue"
            size="sm"
            autofocus
            data-autofocus
            data-confirm-working
            @click="confirmStillWorking"
            class="font-bold shadow-sm"
          >
            Yes, Still Working
          </f-button>
        </div>

        <!-- Danger Zone: Isolated Discard Session with Safety Note -->
        <div v-if="inactivityMinutes >= 60" class="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
          <span>Stepped away or forgot to stop?</span>
          <f-button
            variant="ghost"
            theme="red"
            size="xs"
            data-destructive
            @click="discardInactivitySession"
            title="Discard this unattended session without creating a timesheet"
          >
            Discard Session
          </f-button>
        </div>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- TASK WORKFLOW ACTION CONFIRMATION MODAL    -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showWorkflowModal"
    :title="(workflowTargetAction ? workflowTargetAction.action : 'Workflow Action')"
    :subtitle="workflowTargetTask ? workflowTargetTask.subject : ''"
    size="md"
    z-index="z-[60]"
  >
    <div class="space-y-3.5 text-xs py-1">
      <div class="p-3 rounded-xl border flex items-start gap-3"
        :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
          :class="isDarkMode ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'">
          {{ workflowTargetAction ? getWorkflowActionIcon(workflowTargetAction.action) : '→' }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>{{ workflowTargetAction ? workflowTargetAction.action : '' }}</span>
            <f-badge v-if="workflowTargetAction && workflowTargetAction.next_state" theme="blue" variant="subtle" size="xs">
              Target: {{ workflowTargetAction.next_state }}
            </f-badge>
          </div>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Apply workflow transition to <strong class="text-gray-800 dark:text-gray-200">{{ workflowTargetTask ? (workflowTargetTask.doctype || 'Task') : 'Task' }}</strong>:
            <code class="font-mono text-[11px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">{{ workflowTargetTask ? (workflowTargetTask.docname || workflowTargetTask.id) : '' }}</code>
          </p>
        </div>
      </div>

      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
          Handoff / Transition Comment (optional)
        </label>
        <f-input
          v-model="workflowComment"
          placeholder="Add any context, completion notes, or reason for this status change..."
          size="md"
        ></f-input>
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showWorkflowModal = false" :disabled="workflowBusy">
          Cancel
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="submitWorkflowAction" :disabled="workflowBusy">
          Confirm {{ workflowTargetAction ? workflowTargetAction.action : 'Action' }}
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- PLANNER: BLOCK DETAIL / SESSION LOG DRAWER -->
  <!-- ========================================== -->
  <!-- Backdrop for Block Detail Drawer -->
  <div v-if="showBlockDrawer && activeBlock" @click="showBlockDrawer = false" class="fixed inset-0 z-[59] bg-black/40 backdrop-blur-xs transition-opacity" aria-hidden="true"></div>

  <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
    <div v-if="showBlockDrawer && activeBlock" class="fixed inset-y-0 right-0 z-[60] w-full max-w-md shadow-2xl overflow-y-auto" :class="isDarkMode ? 'bg-[#1E1F22] border-l border-gray-800' : 'bg-white'" role="dialog" aria-modal="true" aria-label="Work block detail">
      <div class="p-5 space-y-4">
        
        <!-- Header -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-[11px] font-bold uppercase text-gray-400">{{ activeBlock.work_date }} · {{ hhmm(activeBlock.start_time) }}–{{ hhmm(activeBlock.end_time) }}</div>
            <h3 class="font-extrabold text-base mt-0.5 leading-snug break-words" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ activeBlock.task_subject || activeBlock.work_item_label || activeBlock.deliverable_notes || 'Work block' }}</h3>
            <div class="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <f-badge :theme="isBlockCompleted(activeBlock) ? 'green' : (isTracking && trackerBlockName === activeBlock.name ? 'red' : (activeBlock.status === 'Cancelled' ? 'red' : (activeBlock.status === 'Rescheduled' ? 'gray' : 'blue')))" variant="subtle" size="xs">
                {{ isTracking && trackerBlockName === activeBlock.name ? '● Recording' : (activeBlock.status === 'Cancelled' ? (activeBlock.cancel_reason ? 'Cancelled (' + activeBlock.cancel_reason + ')' : 'Cancelled') : (isBlockCompleted(activeBlock) ? '✓ ' + (activeBlock.status || 'Completed') : activeBlock.status)) }}
              </f-badge>
              <f-badge v-if="activeBlock.rescheduled_to" theme="gray" variant="outline" size="xs">↷ to {{ activeBlock.rescheduled_to }}</f-badge>
              <f-badge v-if="activeBlock.rescheduled_from" theme="gray" variant="outline" size="xs">↶ from {{ activeBlock.rescheduled_from }}</f-badge>
              <f-badge v-if="activeBlock.task_nature" theme="gray" variant="outline" size="xs">{{ activeBlock.task_nature }}</f-badge>
              <f-badge v-if="activeBlock.pairing_partner" theme="purple" variant="subtle" size="xs">
                👥 Paired with {{ activeBlock.pairing_partner_name || activeBlock.pairing_partner }}
              </f-badge>
              <f-badge v-if="activeBlock.approval_status === 'Approved'" theme="green" variant="subtle" size="xs">
                ✓ Approved
              </f-badge>
              <f-badge v-else-if="activeBlock.actual_hours > 0" theme="amber" variant="subtle" size="xs">
                ⏳ Pending Approval
              </f-badge>
              <span v-if="activeBlock.project_name || activeBlock.project" class="text-gray-400 truncate max-w-[150px]">📁 {{ activeBlock.project_name || activeBlock.project }}</span>
            </div>
          </div>
          <f-button variant="ghost" theme="gray" size="sm" class="!w-8 !h-8 !p-0 shrink-0" @click="showBlockDrawer = false" aria-label="Close">
            <template #prefix>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </template>
          </f-button>
        </div>

        <!-- Planned vs Actual Progress Card -->
        <div class="rounded-2xl p-3.5 border space-y-2" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-gray-500">Planned {{ fmtHrs(activeBlock.duration_hours) }}h</span>
            <span :class="activeBlock.actual_hours > 0 ? 'text-emerald-500' : 'text-gray-400'">Actual {{ fmtHrs(activeBlock.actual_hours) }}h</span>
          </div>
          <div class="h-2 rounded-full overflow-hidden" :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-200'">
            <div class="h-full rounded-full transition-all duration-300" :class="activeBlock.actual_hours > activeBlock.duration_hours ? 'bg-rose-500' : 'bg-emerald-500'"
              :style="{ width: Math.min(100, activeBlock.duration_hours ? (activeBlock.actual_hours / activeBlock.duration_hours * 100) : 0) + '%' }"></div>
          </div>
          <div class="flex items-center justify-between text-[11px] pt-0.5">
            <span :class="activeBlock.variance_hours < 0 ? 'text-amber-500' : (activeBlock.variance_hours > 0 ? 'text-rose-500' : 'text-emerald-500 font-semibold')">
              {{ activeBlock.variance_hours === 0 ? '✓ On plan' : (activeBlock.variance_hours > 0 ? '+' + fmtHrs(activeBlock.variance_hours) + 'h overrun' : fmtHrs(Math.abs(activeBlock.variance_hours)) + 'h remaining') }}
            </span>
            <span v-if="activeBlock.timesheet" class="font-mono text-blue-500 hover:underline">
              <a :href="'/app/timesheet/' + activeBlock.timesheet" target="_blank">TS: {{ activeBlock.timesheet }} ↗</a>
            </span>
            <button type="button" v-else-if="isBlockCompleted(activeBlock)" class="text-blue-500 hover:underline text-[11px] font-semibold cursor-pointer" @click="generateTimesheet(activeBlock)">
              Generate Timesheet ↗
            </button>
          </div>
        </div>

        <!-- Deliverable Output Metrics / KPIs -->
        <div v-if="activeBlock.output_metrics && activeBlock.output_metrics.length" class="rounded-2xl p-3.5 border space-y-2" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
          <div class="flex items-center justify-between text-xs font-bold">
            <span class="text-gray-500 uppercase tracking-wider text-[10px]">Produced Deliverables &amp; Output KPIs</span>
            <span class="text-emerald-500 font-mono text-[11px]">{{ activeBlock.output_metrics.length }} logged</span>
          </div>
          <div class="space-y-1.5 pt-1">
            <div v-for="(m, mi) in activeBlock.output_metrics" :key="mi" class="flex items-center justify-between p-2 rounded-xl border text-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
              <div class="flex items-center gap-2">
                <span class="text-emerald-500">🎯</span>
                <div>
                  <div class="font-bold leading-tight" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">{{ m.metric_type || 'Output' }}</div>
                  <div v-if="m.notes" class="text-[10px] text-gray-400">{{ m.notes }}</div>
                </div>
              </div>
              <div class="font-mono font-black text-emerald-600 dark:text-emerald-400">
                +{{ m.quantity }} {{ m.unit || '' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Focus Tasks & Deliverables Section -->
        <div class="rounded-2xl p-3.5 border space-y-3" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Focus Tasks & Deliverables</span>
              <span v-if="activeBlock.connected_tasks && activeBlock.connected_tasks.length" 
                class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                :class="isBlockTasksAllCompleted(activeBlock) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'">
                {{ getBlockTasksDoneCount(activeBlock) }}/{{ activeBlock.connected_tasks.length }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" class="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                @click="showAttachTasksBox = !showAttachTasksBox">
                {{ showAttachTasksBox ? 'Cancel' : '+ Attach / Paste' }}
              </button>
            </div>
          </div>

          <!-- Attach / Quick-Paste Box -->
          <div v-if="showAttachTasksBox" class="p-3 rounded-xl border space-y-2.5 transition-all"
            :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-white border-gray-200 shadow-xs'">
            <div class="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
              Paste action items (one per line) from Gmail, WhatsApp, or Meeting notes:
            </div>
            <textarea v-model="newTaskPasteText" rows="3"
              class="w-full text-xs p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'"
              placeholder="create the articulation A12345 and reply status&#10;invite all users of OTC&#10;review onboarding data mapping"></textarea>

            <!-- Option to pick from assigned work (Searchable Combobox) -->
            <div v-if="availableUnattachedTasks.length" class="space-y-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Or pick from assigned work:</div>
              <f-combobox
                v-model="selectedTaskToAttach"
                :options="comboboxTaskOptions"
                placeholder="Search assigned task or to-do to attach..."
                search-placeholder="Filter by title, kind, or project..."
                aria-label="Pick assigned task or to-do"
                size="sm"
              ></f-combobox>
            </div>

            <div class="flex items-center justify-end gap-2 pt-1">
              <f-button variant="ghost" theme="gray" size="xs" @click="showAttachTasksBox = false; newTaskPasteText = ''; selectedTaskToAttach = ''">
                Cancel
              </f-button>
              <f-button variant="solid" theme="blue" size="xs" :disabled="!newTaskPasteText.trim() && !selectedTaskToAttach" :loading="isAttachingTasks" @click="submitAttachTasks(activeBlock)">
                Attach to Block
              </f-button>
            </div>
          </div>

          <!-- Connected Task Items Checklist -->
          <div v-if="activeBlock.connected_tasks && activeBlock.connected_tasks.length" class="space-y-1.5">
            <div v-for="(item, idx) in activeBlock.connected_tasks" :key="item.id || item.ref || idx"
              class="flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors group"
              :class="isTaskDone(item) ? (isDarkMode ? 'bg-emerald-950/10 border-emerald-900/30' : 'bg-emerald-50/40 border-emerald-100') : (isDarkMode ? 'bg-[#1E1F22] border-gray-700/80' : 'bg-white border-gray-200/80')">
              
              <input type="checkbox" :checked="isTaskDone(item)" @change="toggleTaskDone(activeBlock, item)"
                class="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer shrink-0">

              <div class="min-w-0 flex-1">
                <div class="text-xs leading-snug break-words"
                  :class="isTaskDone(item) ? 'line-through text-gray-400 dark:text-gray-500' : (isDarkMode ? 'text-gray-100' : 'text-gray-900')">
                  {{ item.subject || item.title || item.task }}
                </div>
                
                <div class="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400">
                  <span class="px-1.5 py-0.2 rounded font-medium text-[9px]"
                    :class="item.doctype === 'Task' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : (item.doctype === 'ToDo' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300')">
                    {{ item.doctype || 'Item' }}
                  </span>
                  <span v-if="item.status === 'Rescheduled'" class="text-amber-500 font-semibold">↷ Rescheduled</span>
                  <span v-else-if="isTaskDone(item)" class="text-emerald-500 font-semibold">✓ Completed</span>
                  <span v-if="item.completed_at" class="font-mono text-gray-400">{{ formatTaskTime(item.completed_at) }}</span>
                  <a v-if="item.doctype === 'Task' && item.id" :href="'/app/task/' + item.id" target="_blank" class="hover:underline text-blue-500 ml-auto">View ↗</a>
                </div>
              </div>
            </div>

            <!-- Reschedule / Carry Forward Unfinished Banner -->
            <div v-if="getUnfinishedTasksCount(activeBlock) > 0" class="pt-1">
              <button type="button" 
                class="w-full py-2 px-3 rounded-xl border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-between hover:bg-amber-100/90 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                :disabled="isReschedulingTasks"
                @click="carryForwardUnfinished(activeBlock)">
                <span class="flex items-center gap-1.5">
                  <span>↷</span>
                  <span>Carry forward {{ getUnfinishedTasksCount(activeBlock) }} unfinished item{{ getUnfinishedTasksCount(activeBlock) === 1 ? '' : 's' }} to next session</span>
                </span>
                <span class="text-[11px] font-bold underline">Schedule ↗</span>
              </button>
            </div>
          </div>
          <div v-else class="text-center py-3 text-xs text-gray-400 border border-dashed rounded-xl"
            :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
            <span>No connected tasks yet. </span>
            <button type="button" class="text-blue-500 font-semibold hover:underline cursor-pointer" @click="showAttachTasksBox = true">Attach or paste action items</button>
          </div>
        </div>

        <!-- Logged Work Sessions -->
        <div v-if="activeBlock.sessions && activeBlock.sessions.length" class="space-y-2">
          <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider">Logged Work Sessions ({{ activeBlock.sessions.length }})</h4>
          <ul class="space-y-2">
            <li v-for="(s, i) in activeBlock.sessions" :key="i" class="p-3 rounded-xl border text-xs space-y-1.5"
              :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
              <div class="flex items-center justify-between">
                <span class="font-mono text-[11px] text-gray-400">{{ s.session_date }}<span v-if="s.from_time"> · {{ hhmm(s.from_time) }}–{{ hhmm(s.to_time) }}</span></span>
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-emerald-500">{{ fmtHrs(s.hours) }}h</span>
                  <button type="button" class="p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Edit session timing and notes"
                    @click="openEditSessionModal(activeBlock, s)">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button type="button" class="p-1 rounded-md text-gray-400 hover:text-rose-500 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Delete this work session"
                    @click="confirmDeleteSession(activeBlock, s)">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <p v-if="s.notes" class="text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed text-[11px]">{{ s.notes }}</p>
              <div v-if="s.logged_via" class="text-[10px] text-gray-400">via {{ s.logged_via }}</div>
            </li>
          </ul>
        </div>
        <div v-else class="text-center py-4 text-xs text-gray-400 rounded-xl border border-dashed" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
          No work sessions recorded yet against this block.
        </div>

        <!-- Raven Task Discussion Row -->
        <div class="rounded-xl p-3 border flex items-center justify-between" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm">💬</span>
            <div class="min-w-0">
              <div class="text-xs font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">Raven Discussion</div>
              <div class="text-[11px] text-gray-400 truncate">{{ drawerChatMessages && drawerChatMessages.length ? drawerChatMessages.length + ' message(s)' : 'Specs & thread' }}</div>
            </div>
          </div>
          <f-button variant="subtle" theme="purple" size="xs" @click="openTaskRavenDrawer({ name: activeBlock.task || activeBlock.name, ref: activeBlock.task || activeBlock.name, subject: activeBlock.task_subject || activeBlock.work_item_label, project: activeBlock.project, project_name: activeBlock.project_name })">
            Open Chat ↗
          </f-button>
        </div>

        <!-- Contextual Actions & Controls -->
        <!-- Client View: Clean commitment audit status -->
        <div v-if="isClient" class="p-3.5 rounded-2xl border text-xs" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'">
          <div class="flex items-center gap-2 font-bold text-gray-900 dark:text-white mb-1">
            <span>🛡 Operational Commitment Audit</span>
          </div>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            This work block is managed under OmmNoMi Automation LLP delivery standards. Engineering timesheets and task deliverables are verified and non-destructive.
          </p>
        </div>

        <!-- Internal Team Actions (Engineers / Managers) -->
        <div v-else class="space-y-3">
          <!-- 1. ACTIVELY RECORDING SESSION ON THIS BLOCK -->
          <div v-if="isTracking && trackerBlockName === activeBlock.name" 
            class="rounded-2xl p-4 border space-y-3"
            :class="isDarkMode ? 'bg-red-950/20 border-red-800/80 text-white' : 'bg-red-50/70 border-red-200 text-gray-900'">
            <div class="flex items-center justify-between">
              <span class="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                Live Session Active
              </span>
              <span class="font-mono font-black text-base text-red-600 dark:text-red-400 tabular-nums">{{ formattedTime }}</span>
            </div>

            <div class="text-xs text-gray-600 dark:text-gray-300">
              You are actively recording time for this block. Notes and timesheet sync automatically.
            </div>

            <!-- Quick Actions -->
            <div class="flex items-center gap-2 pt-1">
              <f-button variant="solid" theme="red" size="sm" class="flex-1 !font-bold" @click="requestStopFocusBlock(activeBlock)">
                <template #prefix>
                  <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                </template>
                <span>{{ stopConfirmName === activeBlock.name ? 'Stop anyway' : 'Stop & save' }}</span>
              </f-button>
              <f-button variant="outline" theme="gray" size="sm" @click="openAdjustModal" title="Adjust session timing">
                Adjust
              </f-button>
              <f-button variant="ghost" theme="gray" size="sm" @click="discardSession" title="Discard session without saving">
                Discard
              </f-button>
            </div>
          </div>

          <!-- 2. PLANNED BLOCK (NOT TRACKING & NOT COMPLETED & NOT PAST) -->
          <div v-else-if="!isBlockCompleted(activeBlock) && !isPastBlock(activeBlock)" class="space-y-3 pt-1">
            <f-button variant="solid" theme="blue" size="md" class="w-full !font-bold shadow-md" @click="startFocusBlock(activeBlock)" :disabled="isTracking">
              <template #prefix>
                <span class="mr-1">▶</span>
              </template>
              <span>{{ isTracking ? 'Another session is running' : 'Start Focus Session' }}</span>
            </f-button>

            <!-- Secondary Action Bar -->
            <div class="flex items-center justify-between gap-2 pt-1">
              <f-button variant="subtle" size="xs" @click="showBlockReschedule = !showBlockReschedule">
                {{ showBlockReschedule ? 'Hide Reschedule' : 'Reschedule' }}
              </f-button>
              <f-button variant="subtle" size="xs" @click="showBlockManualLog = !showBlockManualLog">
                {{ showBlockManualLog ? 'Hide Log' : '+ Add Time' }}
              </f-button>
              <f-button variant="ghost" theme="red" size="xs" @click="openCancelModal(activeBlock)">
                Cancel Block
              </f-button>
            </div>
          </div>

          <!-- 3. COMPLETED BLOCK -->
          <div v-else-if="isBlockCompleted(activeBlock)" class="pt-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
            <span class="text-emerald-600 dark:text-emerald-400 font-medium">✓ Block completed</span>
            <button v-if="canLogTimesheet(activeBlock)" type="button" @click="showBlockManualLog = !showBlockManualLog" class="text-blue-500 hover:underline cursor-pointer text-xs">
              {{ showBlockManualLog ? 'Hide Form' : '+ Add another session' }}
            </button>
          </div>

          <!-- 4. PAST IMMUTABLE BLOCK -->
          <div v-else-if="isPastBlock(activeBlock)" class="text-xs text-gray-400 text-center py-2">
            🔒 Past planned blocks are immutable commitments.
          </div>
        </div>

        <!-- Collapsible Reschedule Form -->
        <div v-if="showBlockReschedule && !isPastBlock(activeBlock)" class="rounded-2xl p-3.5 border space-y-2 transition-all" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
          <h4 class="text-xs font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">Reschedule this block</h4>
          <div class="grid grid-cols-3 gap-2">
            <label class="block"><span class="text-[10px] font-bold text-gray-500">Date</span>
              <input type="date" v-model="rescheduleForm.work_date" aria-label="New date" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            <label class="block"><span class="text-[10px] font-bold text-gray-500">Start</span>
              <input type="time" v-model="rescheduleForm.start_time" aria-label="New start time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            <label class="block"><span class="text-[10px] font-bold text-gray-500">End</span>
              <input type="time" v-model="rescheduleForm.end_time" aria-label="New end time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
          </div>
          <f-button variant="solid" theme="blue" size="sm" class="w-full !font-bold" @click="submitReschedule" :disabled="plannerBusy">Save new time</f-button>
        </div>

        <!-- Collapsible Manual Session Form -->
        <div v-if="showBlockManualLog && canLogTimesheet(activeBlock)" class="rounded-2xl p-3.5 border space-y-2 transition-all" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
          <h4 class="text-xs font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">Log a work session manually</h4>
          <div class="grid grid-cols-3 gap-2">
            <label class="block"><span class="text-[10px] font-bold text-gray-500">Date</span>
              <input type="date" v-model="sessionForm.session_date" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            <label class="block"><span class="text-[10px] font-bold text-gray-500">From</span>
              <input type="time" v-model="sessionForm.from_time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            <label class="block"><span class="text-[10px] font-bold text-gray-500">To</span>
              <input type="time" v-model="sessionForm.to_time" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
          </div>
          <div class="flex items-center gap-2">
            <label class="block flex-1"><span class="text-[10px] font-bold text-gray-500">or hours</span>
              <input type="number" step="0.25" min="0" v-model="sessionForm.hours" placeholder="e.g. 1.5" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
            <label class="block flex-[2]"><span class="text-[10px] font-bold text-gray-500">Notes (required)</span>
              <input type="text" v-model="sessionForm.notes" placeholder="What did you get done?" class="mt-1 w-full text-xs rounded-lg px-2 py-1.5 border outline-none" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
          </div>
          <f-button variant="solid" theme="green" size="sm" class="w-full !font-bold" @click="submitSession" :disabled="plannerBusy">Add session</f-button>
        </div>

      </div>
    </div>
  </transition>


  <!-- ==================================================== -->
  <!-- TASK RAVEN COLLABORATION & LIVING SPECS DRAWER       -->
  <!-- ==================================================== -->
  <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
    <div v-if="showTaskRavenDrawer && ravenTask" class="fixed inset-y-0 right-0 z-[70] w-full max-w-lg shadow-2xl overflow-y-auto flex flex-col" :class="isDarkMode ? 'bg-[#1E1F22] border-l border-gray-800 text-gray-100' : 'bg-white border-l border-gray-200 text-gray-900'" role="dialog" aria-modal="true" aria-label="Task Raven Collaboration">
      
      <!-- Drawer Header -->
      <div class="p-4 border-b shrink-0 flex items-start justify-between gap-3" :class="isDarkMode ? 'border-gray-800 bg-[#25262A]' : 'border-gray-200 bg-gray-50/70'">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Raven Collaboration
            </span>
            <span v-if="ravenTask.project_name || ravenTask.project" class="text-[10px] font-semibold text-gray-400">
              {{ ravenTask.project_name || ravenTask.project }}
            </span>
            <span class="text-[10px] font-mono text-gray-400">#{{ ravenTask.name || ravenTask.ref }}</span>
          </div>
          <h3 class="font-extrabold text-base leading-snug truncate" :title="ravenTask.subject">{{ ravenTask.subject }}</h3>
        </div>
        
        <div class="flex items-center gap-1.5 shrink-0">
          <a href="/raven" target="_blank" class="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors" title="Open Full Raven App ↗" aria-label="Open Full Raven App">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <a :href="'/app/task/' + (ravenTask.name || ravenTask.ref)" target="_blank" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Open Task in Desk ↗" aria-label="Open Task in Desk">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </a>
          <button type="button" @click="closeTaskRavenDrawer" aria-label="Close" class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>
      </div>

      <!-- Tab Switcher: Details vs Chat Stream vs Living Specs vs Sprint Activity -->
      <div class="flex items-center border-b px-4 shrink-0 text-xs font-bold overflow-x-auto no-scrollbar" :class="isDarkMode ? 'border-gray-800 bg-[#1E1F22]' : 'border-gray-200 bg-white'">
        <button type="button" @click="ravenActiveTab = 'details'" class="py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0" :class="ravenActiveTab === 'details' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'">
          <span>📋 Details & Plan</span>
        </button>
        <button type="button" @click="ravenActiveTab = 'chat'" class="py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0" :class="ravenActiveTab === 'chat' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'">
          <span>💬 Live Discussion</span>
          <span v-if="ravenMessages && ravenMessages.length" class="text-[10px] font-mono px-1.5 py-0.2 rounded-full" :class="ravenActiveTab === 'chat' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'">{{ ravenMessages.length }}</span>
        </button>
        <button type="button" @click="ravenActiveTab = 'specs'" class="py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0" :class="ravenActiveTab === 'specs' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'">
          <span>📌 Living Specs & Decisions</span>
        </button>
        <button type="button" @click="ravenActiveTab = 'activity'" class="py-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0" :class="ravenActiveTab === 'activity' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'">
          <span>⏱️ Sprint Recaps</span>
        </button>
      </div>

      <!-- Tab Content: Task Details & Planning -->
      <div v-show="ravenActiveTab === 'details'" class="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        
        <!-- Status, Priority, Due Date Badges -->
        <div class="flex items-center gap-2 flex-wrap">
          <f-badge v-if="ravenTask.status" theme="blue" variant="subtle" size="sm">
            Status: {{ ravenTask.status }}
          </f-badge>
          <f-badge v-if="ravenTask.priority" :theme="ravenTask.priority === 'High' || ravenTask.priority === 'Urgent' ? 'red' : 'amber'" variant="subtle" size="sm">
            {{ ravenTask.priority }} Priority
          </f-badge>
          <f-badge v-if="ravenTask.days_overdue > 0" theme="red" variant="solid" size="sm">
            ⚠️ Overdue by {{ ravenTask.days_overdue }}d
          </f-badge>
          <f-badge v-else-if="ravenTask.due_date" theme="gray" variant="outline" size="sm">
            📅 Due {{ ravenTask.due_date }}
          </f-badge>
          <f-badge v-if="ravenTask.project_name || ravenTask.project" theme="gray" variant="subtle" size="sm">
            📁 {{ ravenTask.project_name || ravenTask.project }}
          </f-badge>
        </div>

        <!-- Primary Action Buttons directly inside Drawer -->
        <div class="p-3 rounded-2xl border flex items-center gap-2 flex-wrap"
          :class="isDarkMode ? 'bg-[#25262A] border-gray-800' : 'bg-gray-50 border-gray-200'">
          <f-button 
            variant="solid" 
            theme="blue" 
            size="sm" 
            @click="startTaskImmediately(ravenTask); closeTaskRavenDrawer()"
            aria-label="Start focus session right now">
            <template #prefix>
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </template>
            <span>Start Session Now</span>
          </f-button>
          <f-button 
            variant="subtle" 
            theme="blue" 
            size="sm" 
            @click="planAttentionTask(ravenTask); closeTaskRavenDrawer()"
            aria-label="Plan task in planner calendar">
            <template #prefix>
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </template>
            <span>Plan in Calendar</span>
          </f-button>
          <a 
            :href="getTaskDeskUrl(ravenTask)" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            <span>Open in Desk</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>

        <!-- Planning vs Actual Meter Card -->
        <div class="rounded-2xl p-4 border space-y-3"
          :class="isDarkMode ? 'bg-[#25262A] border-gray-800' : 'bg-white border-gray-200 shadow-xs'">
          <h4 class="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Time & Commitment Budget</span>
          </h4>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="p-2.5 rounded-xl border" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-gray-50 border-gray-200'">
              <div class="text-[10px] text-gray-400 font-bold uppercase">Estimated</div>
              <div class="text-sm sm:text-base font-extrabold font-mono text-gray-700 dark:text-gray-200">{{ Number(ravenTask.estimate_hours || ravenTask.expected_time || 0).toFixed(1) }}h</div>
            </div>
            <div class="p-2.5 rounded-xl border" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-blue-50/50 border-blue-200'">
              <div class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Planned / Booked</div>
              <div class="text-sm sm:text-base font-extrabold font-mono text-blue-600 dark:text-blue-400">{{ Number(ravenTask.booked_hours || 0).toFixed(1) }}h</div>
            </div>
            <div class="p-2.5 rounded-xl border" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-emerald-50/50 border-emerald-200'">
              <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Logged</div>
              <div class="text-sm sm:text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{{ Number(ravenTask.logged_hours || 0).toFixed(1) }}h</div>
            </div>
          </div>
          <div v-if="ravenTask.deficit_hours > 0" class="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 font-semibold">
            <span>⚠️ Deficit: Need to plan {{ Number(ravenTask.deficit_hours).toFixed(1) }}h more to cover the estimate.</span>
          </div>
        </div>

        <!-- Task Description / Scope -->
        <div class="rounded-2xl p-4 border space-y-2"
          :class="isDarkMode ? 'bg-[#25262A] border-gray-800' : 'bg-white border-gray-200 shadow-xs'">
          <h4 class="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Task Scope & Description</h4>
          <div v-if="ravenTask.description" class="text-xs leading-relaxed whitespace-pre-line text-gray-700 dark:text-gray-200" v-html="ravenTask.description"></div>
          <div v-else class="text-xs text-gray-400 italic">No description provided for this task in Frappe.</div>
        </div>

        <!-- Scheduled Work Blocks on Calendar -->
        <div class="rounded-2xl p-4 border space-y-3"
          :class="isDarkMode ? 'bg-[#25262A] border-gray-800' : 'bg-white border-gray-200 shadow-xs'">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <svg class="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Scheduled Focus Blocks</span>
            </h4>
            <button type="button" @click="planAttentionTask(ravenTask); closeTaskRavenDrawer()" class="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
              + Schedule Block
            </button>
          </div>
          <div v-if="taskConnectedBlocks(ravenTask).length === 0" class="text-xs text-gray-400 italic py-2">
            No calendar blocks scheduled yet for this task.
          </div>
          <ul v-else class="space-y-2">
            <li v-for="b in taskConnectedBlocks(ravenTask)" :key="b.name" class="p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2"
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-gray-50 border-gray-200'">
              <div class="min-w-0">
                <div class="font-bold flex items-center gap-1.5">
                  <span>📅 {{ b.work_date }}</span>
                  <span class="font-mono text-[11px] opacity-75">({{ (b.start_time || '').slice(0, 5) }} - {{ (b.end_time || '').slice(0, 5) }})</span>
                </div>
                <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {{ b.task_nature || 'Focus Block' }} · {{ Number(b.duration_hours || 0).toFixed(1) }}h
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <f-badge :theme="b.status === 'Completed' ? 'green' : 'blue'" size="xs">{{ b.status || 'Planned' }}</f-badge>
                <button type="button" @click="openBlockDrawer(b); closeTaskRavenDrawer()" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline p-1">View →</button>
              </div>
            </li>
          </ul>
        </div>

      </div>

      <!-- Tab Content: Live Chat -->
      <div v-show="ravenActiveTab === 'chat'" class="flex-1 flex flex-col min-h-0">
        <!-- Message list -->
        <div class="flex-1 p-4 overflow-y-auto space-y-3">
          <div v-if="ravenLoading" class="text-xs text-gray-400 py-8 text-center flex flex-col items-center gap-2">
            <svg class="animate-spin w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
            <span>Loading Raven channel for this task…</span>
          </div>
          <div v-else-if="!ravenMessages || !ravenMessages.length" class="text-xs text-gray-400 py-12 text-center flex flex-col items-center gap-2">
            <span class="text-3xl">💬</span>
            <span class="font-bold text-gray-600 dark:text-gray-300">No messages yet</span>
            <span class="text-[11px] max-w-xs text-gray-500">Start the conversation with your team. Updates here sync directly to Raven and Task timelines!</span>
          </div>
          <div v-else v-for="m in ravenMessages" :key="m.name" class="flex gap-2.5 text-xs group" :class="m.is_self ? 'flex-row-reverse' : 'flex-row'">
            <!-- User Avatar -->
            <div class="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-[10px] shrink-0 uppercase border border-purple-200 dark:border-purple-800">
              {{ (m.sender_name || 'U').slice(0, 1) }}
            </div>
            
            <div class="max-w-[80%] flex flex-col" :class="m.is_self ? 'items-end' : 'items-start'">
              <div class="flex items-center gap-1.5 mb-1 text-[10px]">
                <span class="font-bold truncate" :class="m.is_self ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'">{{ m.sender_name }}</span>
                <span v-if="m.is_bot_message || m.message_type === 'System'" class="px-1 py-0.2 rounded text-[9px] font-black uppercase bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">SYSTEM</span>
                <span class="font-mono text-gray-400">{{ (m.creation || '').slice(11, 16) }}</span>
              </div>

              <!-- Message Bubble -->
              <div class="rounded-2xl px-3.5 py-2.5 border leading-relaxed shadow-xs" :class="m.is_self ? 'bg-blue-600 border-blue-600 text-white rounded-tr-none' : (m.is_bot_message || m.message_type === 'System' ? 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60 text-gray-800 dark:text-gray-200 rounded-tl-none' : 'bg-white border-gray-200 dark:bg-[#2B2D30] dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none')">
                <div class="whitespace-pre-line break-words">{{ m.content || m.text }}</div>
                
                <!-- File Attachment Link if present -->
                <div v-if="m.file" class="mt-2 pt-1.5 border-t" :class="m.is_self ? 'border-blue-400/50' : 'border-gray-200 dark:border-gray-700'">
                  <a :href="m.file" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-semibold underline hover:opacity-80">
                    <span>📎 Attachment</span>
                  </a>
                </div>
              </div>

              <!-- Action Bar (Pin to Spec) -->
              <div class="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                <button type="button" @click="pinRavenMessage(m)" class="hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-0.5 cursor-pointer text-gray-400" title="Pin this decision into the living Task Specification">
                  <span>📌 Pin to Spec</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Input Bar -->
        <div class="p-3 border-t shrink-0" :class="isDarkMode ? 'border-gray-800 bg-[#25262A]' : 'border-gray-200 bg-gray-50/60'">
          <div class="flex items-end gap-2">
            <textarea
              v-model="ravenChatInput"
              @keydown.enter.exact.prevent="sendRavenChatMessage"
              rows="2"
              placeholder="Message team on this task… (Enter to send, Shift+Enter for newline)"
              class="flex-1 text-xs rounded-xl p-2.5 border outline-none resize-none"
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100 placeholder-gray-500 focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'">
            </textarea>
            <button
              type="button"
              @click="sendRavenChatMessage"
              :disabled="!ravenChatInput.trim() || ravenChatSending"
              class="text-xs font-bold px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white cursor-pointer disabled:opacity-50 shrink-0 shadow-xs flex items-center gap-1.5 transition-colors">
              <svg v-if="!ravenChatSending" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              <svg v-else class="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Content: Living Specs & Decisions -->
      <div v-show="ravenActiveTab === 'specs'" class="flex-1 p-4 overflow-y-auto space-y-3">
        <div class="rounded-xl p-3 border text-xs" :class="isDarkMode ? 'bg-purple-950/30 border-purple-900 text-purple-200' : 'bg-purple-50 border-purple-200 text-purple-800'">
          <div class="font-bold flex items-center gap-1 mb-1">
            <span>📌 Living Technical Specification</span>
          </div>
          <p class="text-[11px] leading-relaxed">
            This specification is directly linked to the Task document. You can pin key decisions directly from the Raven chat stream, or author technical contracts and acceptance criteria here.
          </p>
        </div>

        <div class="space-y-1.5">
          <label class="block text-xs font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">
            Specification & Architecture Notes
          </label>
          <textarea
            v-model="ravenTaskSpec"
            rows="14"
            placeholder="Write technical specs, acceptance criteria, or architectural decisions..."
            class="w-full text-xs font-mono rounded-xl p-3 border outline-none resize-y"
            :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100 placeholder-gray-500 focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'">
          </textarea>
        </div>

        <div class="flex items-center justify-between pt-2">
          <span class="text-[11px] text-gray-400">Updates sync directly to Task.description</span>
          <button
            type="button"
            @click="saveRavenTaskSpec"
            :disabled="ravenSavingSpec"
            class="text-xs font-bold px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1.5">
            <svg v-if="!ravenSavingSpec" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Save Specification</span>
          </button>
        </div>
      </div>

      <!-- Tab Content: Sprint Recaps -->
      <div v-show="ravenActiveTab === 'activity'" class="flex-1 p-4 overflow-y-auto space-y-3">
        <div class="text-xs text-gray-500 mb-2">Automated focus session recaps & accomplishments captured by OmniTrack stopwatch on this task.</div>
        <div v-if="!ravenSprintRecaps || !ravenSprintRecaps.length" class="text-xs text-gray-400 py-8 text-center">
          No focus session recaps yet for this task.
        </div>
        <div v-else v-for="r in ravenSprintRecaps" :key="r.name" class="p-3 rounded-xl border text-xs" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
          <div class="flex items-center justify-between font-bold text-[11px] text-gray-500 mb-1">
            <span>{{ r.sender_name }}</span>
            <span class="font-mono text-gray-400">{{ (r.creation || '').slice(0, 16) }}</span>
          </div>
          <div class="whitespace-pre-line text-gray-800 dark:text-gray-200">{{ r.content || r.text }}</div>
        </div>
      </div>

    </div>
  </transition>

  <!-- Backdrop for Task Raven Drawer -->
  <div v-if="showTaskRavenDrawer" @click="closeTaskRavenDrawer" class="fixed inset-0 z-[65] bg-black/40 backdrop-blur-xs transition-opacity" aria-hidden="true"></div>

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
  <!-- ========================================== -->
  <!-- PLAN FOCUS BLOCK MODAL DIALOG              -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showNewTaskModal"
    title="Plan Focus Block"
    subtitle="Schedule dedicated time to protect your focus and deliver results"
    size="md"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- What will you focus on -->
      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
          What will you focus on? <span class="text-rose-500">*</span>
        </label>
        <f-input
          size="md"
          v-model="newTaskForm.notes"
          placeholder="e.g. Website Timetable & Dynamic Branch Configuration"
          aria-label="What will you focus on"
        ></f-input>
      </div>

      <!-- Project & Task Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Project</label>
          <f-combobox
            v-model="newTaskForm.project"
            :options="comboboxProjectOptions"
            placeholder="Select project..."
            search-placeholder="Search projects..."
            aria-label="Project"
          ></f-combobox>
        </div>

        <div>
          <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Task (Optional)</label>
          <f-combobox
            v-model="newTaskForm.task"
            :options="comboboxTaskOptions"
            placeholder="Link to task (optional)..."
            search-placeholder="Search tasks..."
            aria-label="Task"
          ></f-combobox>
        </div>
      </div>

      <!-- Schedule & Time Window Card -->
      <div class="p-3.5 rounded-2xl border" :class="isDarkMode ? 'bg-[#25272B] border-gray-800' : 'bg-gray-50/80 border-gray-200'">
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <span class="font-bold text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Schedule & Time Window</span>
          <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
            {{ newTaskForm.duration ? newTaskForm.duration.toFixed(1) : '1.0' }}h duration
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label class="block text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">Date</label>
            <input 
              type="date" 
              v-model="newTaskForm.date" 
              class="w-full rounded-xl px-2.5 py-2 outline-none border transition-colors text-xs font-mono" 
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'">
          </div>

          <div>
            <label class="block text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">Start Time</label>
            <input 
              type="time" 
              v-model="newTaskForm.startTime" 
              @change="onNewTaskTimeChange"
              class="w-full rounded-xl px-2.5 py-2 outline-none border transition-colors text-xs font-mono" 
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'">
          </div>

          <div>
            <label class="block text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">End Time</label>
            <input 
              type="time" 
              v-model="newTaskForm.endTime" 
              @change="onNewTaskTimeChange"
              class="w-full rounded-xl px-2.5 py-2 outline-none border transition-colors text-xs font-mono" 
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-white focus:border-blue-500' : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500'">
          </div>
        </div>

        <!-- Quick Duration Chips -->
        <div class="flex items-center gap-1.5 pt-2.5 flex-wrap">
          <span class="text-[10px] text-gray-400 mr-1">Quick presets:</span>
          <button
            v-for="dur in [0.5, 1, 1.5, 2, 3, 4]"
            :key="dur"
            type="button"
            @click="setNewTaskDurationPreset(dur)"
            class="px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer select-none active:scale-95"
            :class="newTaskForm.duration === dur ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : (isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100')">
            {{ dur >= 1 ? (dur % 1 === 0 ? dur + 'h' : dur + 'h') : '30m' }}
          </button>
        </div>
      </div>

      <!-- Work Nature Chips -->
      <div>
        <label class="block font-bold mb-1.5" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Work Nature</label>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button 
            v-for="opt in natureOptions" 
            :key="opt.id"
            type="button"
            @click="newTaskForm.nature = opt.label"
            class="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer select-none active:scale-95"
            :class="newTaskForm.nature === opt.label ? (isDarkMode ? opt.darkActiveClass : opt.lightActiveClass) : (isDarkMode ? 'bg-[#2A2A2A] border-[#3A3A3A] text-gray-400 hover:bg-[#333333]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100')">
            <span v-html="opt.svgIcon" class="w-3.5 h-3.5 flex items-center justify-center"></span>
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </div>

      <!-- Assignee / Team Member (if multiple members) -->
      <div v-if="teamMembers && teamMembers.length > 1">
        <label class="block font-bold mb-1 flex items-center justify-between" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
          <span>Assignee (Team Member)</span>
          <span class="text-[10px] text-gray-400">Defaults to you</span>
        </label>
        <f-combobox
          v-model="newTaskForm.assignee"
          :options="comboboxAssigneeOptions"
          placeholder="Select team member..."
          search-placeholder="Search team member..."
          aria-label="Assign To Team Member"
        ></f-combobox>
      </div>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-3 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showNewTaskModal = false">
          Cancel
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="saveNewPlannedTask">
          <template #prefix>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          </template>
          Schedule Focus Block
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- ADJUST TIMESHEET TIMING MODAL DIALOG       -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showAdjustModal"
    title="Adjust Timesheet Timing"
    :subtitle="isTracking ? 'Fine-tune ongoing session start time or conclude and log to timesheet' : 'Backdate or record a past focus session window'"
    size="md"
    z-index="z-[75]"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </template>

    <!-- Mode Selector Tabs (only when actively tracking) -->
    <div v-if="isTracking" class="p-1 rounded-2xl bg-gray-100 dark:bg-[#161618] border border-gray-200/80 dark:border-gray-800 flex items-center gap-1">
      <button 
        type="button" 
        @click="adjustMode = 'keep_running'"
        class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        :class="adjustMode === 'keep_running' ? 'bg-white dark:bg-[#25272B] text-blue-600 dark:text-blue-400 shadow-xs font-black' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>Fix Start Time (Keep Running)</span>
      </button>
      <button 
        type="button" 
        @click="adjustMode = 'stop_and_log'"
        class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        :class="adjustMode === 'stop_and_log' ? 'bg-white dark:bg-[#25272B] text-emerald-600 dark:text-emerald-400 shadow-xs font-black' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
        <span>Stop & Log to Timesheet</span>
      </button>
    </div>

    <!-- MODE A: FIX START TIME (KEEP RUNNING) -->
    <div v-if="isTracking && adjustMode === 'keep_running'" class="space-y-4 text-xs">
      <!-- Live Preview Stat Card -->
      <div class="p-4 rounded-2xl border flex items-center justify-between transition-colors"
        :class="isDarkMode ? 'bg-blue-950/20 border-blue-900/50' : 'bg-blue-50/60 border-blue-100'">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span class="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">Live Stopwatch Preview</span>
          </div>
          <div class="text-xl sm:text-2xl font-black text-gray-900 dark:text-white font-mono tracking-tight">
            {{ keepRunningElapsedFormatted }}
          </div>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">
            Stopwatch will seamlessly continue ticking up with this adjusted duration.
          </p>
        </div>
        <f-badge theme="blue" variant="subtle" size="sm">
          ▶ Active
        </f-badge>
      </div>

      <!-- Start Date (Only if needed) -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="font-bold text-gray-700 dark:text-gray-300">Session Start Date *</label>
          <span v-if="!isManager" class="text-[10px] text-gray-400">Allowed: Today & Yesterday</span>
        </div>
        <div class="relative flex items-center">
          <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <input
            type="date"
            v-model="adjustForm.work_date"
            :min="minTimesheetDate"
            :max="todayDate"
            class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
          />
        </div>
      </div>

      <!-- Start Time (From) + Quick Nudge Chips -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-gray-700 dark:text-gray-300">Corrected Start Time (From) *</label>
          <span v-if="originalStartTimeFormatted" class="text-[11px] font-mono text-gray-400">Originally recorded: {{ originalStartTimeFormatted }}</span>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="relative flex-1 flex items-center">
            <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              step="60"
              v-model="adjustForm.from_time"
              class="w-full pl-10 pr-3.5 py-2 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
            />
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <f-button size="xs" variant="subtle" theme="gray" @click="nudgeAdjustTime('from', -30)" title="Started 30m earlier">-30m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="nudgeAdjustTime('from', -15)" title="Started 15m earlier">-15m</f-button>
            <f-button size="xs" variant="subtle" theme="blue" @click="nudgeAdjustTime('from', -5)" title="Started 5m earlier">-5m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="nudgeAdjustTime('from', 5)" title="Started 5m later">+5m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="nudgeAdjustTime('from', 15)" title="Started 15m later">+15m</f-button>
          </div>
        </div>
      </div>

      <!-- Notes / Activity Log (Optional update) -->
      <div class="space-y-1.5">
        <label class="block font-bold text-gray-700 dark:text-gray-300">Live Notes / Activity Description</label>
        <textarea
          v-model="adjustForm.notes"
          rows="3"
          placeholder="Update or add bullets to your current session notes..."
          class="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
        ></textarea>
      </div>
    </div>

    <!-- MODE B: STOP & LOG TO TIMESHEET (OR WHEN NOT TRACKING) -->
    <div v-else class="space-y-4 text-xs">
      <!-- Calculated Duration Hero Card -->
      <div class="p-4 rounded-2xl border flex items-center justify-between transition-colors"
        :class="adjustDurationMinutes > 0 ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50/60 border-emerald-100') : (isDarkMode ? 'bg-rose-950/20 border-rose-900/50' : 'bg-rose-50/60 border-rose-100')">
        <div class="space-y-0.5">
          <div class="text-[10px] uppercase font-bold tracking-wider" :class="adjustDurationMinutes > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
            Calculated Duration
          </div>
          <div class="text-xl sm:text-2xl font-black font-mono tracking-tight" :class="adjustDurationMinutes > 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'">
            {{ adjustDurationFormatted }}
          </div>
          <div class="text-[11px] text-gray-500 dark:text-gray-400">
            {{ isTracking ? 'Clock will stop and write this window directly to your timesheet.' : 'Will be recorded to your timesheet.' }}
          </div>
        </div>
        <f-badge :theme="adjustDurationMinutes > 0 ? 'green' : 'red'" variant="subtle" size="sm">
          {{ adjustDurationMinutes > 0 ? '✓ Valid Duration' : 'Invalid Range' }}
        </f-badge>
      </div>

      <!-- Session Date -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="font-bold text-gray-700 dark:text-gray-300">Session Date *</label>
          <span v-if="!isManager" class="text-[10px] text-gray-400">Allowed: Today & Yesterday</span>
        </div>
        <div class="relative flex items-center">
          <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <input
            type="date"
            v-model="adjustForm.work_date"
            :min="minTimesheetDate"
            :max="todayDate"
            class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
          />
        </div>
      </div>

      <!-- Start Time (From) + Quick Nudge Chips -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-gray-700 dark:text-gray-300">Start Time (From) *</label>
          <span class="text-[10px] text-gray-400 font-semibold">Quick adjust</span>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="relative flex-1 flex items-center">
            <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              step="60"
              v-model="adjustForm.from_time"
              class="w-full pl-10 pr-3.5 py-2 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
            />
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <f-button size="xs" variant="subtle" theme="gray" @click="nudgeAdjustTime('from', -15)" title="Started 15m earlier">-15m</f-button>
            <f-button size="xs" variant="subtle" theme="blue" @click="nudgeAdjustTime('from', -5)" title="Started 5m earlier">-5m</f-button>
            <f-button size="xs" variant="subtle" theme="gray" @click="nudgeAdjustTime('from', 5)" title="Started 5m later">+5m</f-button>
          </div>
        </div>
      </div>

      <!-- End Time (To) + Quick Nudge Chips -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="font-bold text-gray-700 dark:text-gray-300">End Time (To) *</label>
          <span class="text-[10px] text-gray-400 font-semibold">Quick adjust</span>
        </div>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div class="relative flex-1 flex items-center">
            <svg class="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              step="60"
              v-model="adjustForm.to_time"
              class="w-full pl-10 pr-3.5 py-2 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white' : 'bg-white border-gray-300 text-gray-900'"
            />
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <f-button size="xs" variant="subtle" theme="gray" @click="nudgeAdjustTime('to', -5)" title="Finished 5m earlier">-5m</f-button>
            <f-button size="xs" variant="subtle" theme="blue" @click="nudgeAdjustTime('to', 5)" title="Finished 5m later">+5m</f-button>
            <f-button size="xs" variant="subtle" theme="green" @click="setAdjustEndNow" title="Set End Time to Right Now">Now</f-button>
          </div>
        </div>
      </div>

      <!-- Notes / Activity Log -->
      <div class="space-y-1.5">
        <label class="block font-bold text-gray-700 dark:text-gray-300">Notes / Activity Log *</label>
        <textarea
          v-model="adjustForm.notes"
          rows="3"
          placeholder="What did you work on during this period? (bullets recommended)"
          class="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
        ></textarea>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #actions>
      <div class="flex items-center justify-between gap-3 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showAdjustModal = false">
          Cancel
        </f-button>
        
        <!-- Mode A Footer: Fix start & continue tracking -->
        <f-button
          v-if="isTracking && adjustMode === 'keep_running'"
          variant="solid"
          theme="blue"
          size="sm"
          @click="applyAdjustedStartTime"
          title="Update the session start time and keep timing">
          <template #prefix>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </template>
          <span>Update Start Time & Keep Running</span>
        </f-button>

        <!-- Mode B Footer: Stop and log to timesheet -->
        <f-button
          v-else
          variant="solid"
          theme="blue"
          size="sm"
          @click="submitAdjustedTimesheet"
          :disabled="adjustDurationMinutes <= 0"
          :title="isTracking ? 'Stop the live stopwatch and write this duration to your timesheet' : 'Write this duration to your timesheet'">
          <template #prefix>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          </template>
          <span>{{ isTracking ? 'Stop & Log ' + adjustDurationShort + ' to Timesheet' : 'Log ' + adjustDurationShort + ' to Timesheet' }}</span>
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- PILLAR 3: RUNAWAY TIMER ALERT DIALOG        -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showRunawayAlertModal"
    title="Timer Overflow Check"
    subtitle="Your stopwatch has been running for an unusually long duration."
    size="md"
    z-index="z-[85]"
  >
    <template #header-icon>
      <span class="text-xl">⚠️</span>
    </template>
    <div class="space-y-4 py-1 text-xs">
      <div class="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
        <p class="font-bold">Elapsed: {{ runawayGuardData.elapsed_hours }} hours (Started at {{ runawayGuardData.started_at_str || 'earlier' }})</p>
        <p class="mt-1 text-gray-600 dark:text-gray-300">{{ runawayGuardData.reason || 'Did you work continuously on this block, or did you finish earlier?' }}</p>
      </div>

      <div class="space-y-2">
        <label class="block font-bold text-gray-700 dark:text-gray-300">Choose Resolution:</label>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" @click="resolveRunawayOption('keep')"
            class="p-3 rounded-xl border text-center transition-all cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="runawayChoice === 'keep' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-600' : 'border-gray-200 dark:border-gray-700'">
            <div>Keep Full</div>
            <div class="text-[10px] text-gray-500 font-normal mt-0.5">{{ runawayGuardData.elapsed_hours }}h elapsed</div>
          </button>
          <button type="button" @click="resolveRunawayOption('cap')"
            class="p-3 rounded-xl border text-center transition-all cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="runawayChoice === 'cap' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' : 'border-gray-200 dark:border-gray-700'">
            <div>Cap at Schedule</div>
            <div class="text-[10px] text-gray-500 font-normal mt-0.5">{{ runawayGuardData.suggested_cap_hours }}h planned</div>
          </button>
          <button type="button" @click="resolveRunawayOption('custom')"
            class="p-3 rounded-xl border text-center transition-all cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="runawayChoice === 'custom' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-600' : 'border-gray-200 dark:border-gray-700'">
            <div>Adjust & Stop</div>
            <div class="text-[10px] text-gray-500 font-normal mt-0.5">Open Slider</div>
          </button>
        </div>
      </div>
    </div>
    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <f-button variant="solid" theme="blue" size="sm" @click="confirmRunawayResolution">
          Apply Resolution
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- PILLAR 5: EOD WRAP-UP RECONCILIATION MODAL -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showEODModal"
    title="End of Day Reconciliation Ritual"
    subtitle="Review today's accomplishments, unallocated gaps, and finalize your timesheet."
    size="lg"
    z-index="z-[85]"
  >
    <template #header-icon>
      <span class="text-xl">🏁</span>
    </template>
    <div class="space-y-4 py-2 text-xs">
      <!-- Target vs Logged Bar -->
      <div class="p-4 rounded-2xl bg-gray-50 dark:bg-[#1E1F22] border border-gray-200 dark:border-gray-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-gray-700 dark:text-gray-300">Daily Target: 8.0 Hours</span>
          <span class="font-mono font-extrabold text-sm" :class="eodSummary && eodSummary.total_actual_hours >= 8.0 ? 'text-emerald-500' : 'text-amber-500'">
            {{ eodSummary ? eodSummary.total_actual_hours : 0 }}h / 8.0h ({{ eodSummary ? (8.0 - eodSummary.total_actual_hours <= 0 ? 'Goal Met' : (8.0 - eodSummary.total_actual_hours).toFixed(1) + 'h remaining') : '' }})
          </span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
          <div class="h-full bg-emerald-500 rounded-full transition-all duration-300"
            :style="{ width: Math.min(100, ((eodSummary ? eodSummary.total_actual_hours : 0) / 8.0) * 100) + '%' }"></div>
        </div>
      </div>

      <!-- Pending unlogged blocks list -->
      <div v-if="eodPendingBlocks && eodPendingBlocks.length" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="font-bold text-gray-700 dark:text-gray-300">Unlogged Planned Commitments ({{ eodPendingBlocks.length }})</span>
          <button type="button" @click="convertAllPendingPlannedBlocks" class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer">
            ⚡ Convert All ({{ eodSummary.unconverted_hours }}h)
          </button>
        </div>
        <div class="space-y-1.5 max-h-48 overflow-y-auto">
          <div v-for="b in eodPendingBlocks" :key="b.name"
            class="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161618]">
            <div>
              <div class="font-bold">{{ b.task_subject || b.deliverable_notes || 'Focus Block' }}</div>
              <div class="text-[11px] text-gray-500">{{ b.start_time }}–{{ b.end_time }} ({{ Number(b.duration_hours || 0).toFixed(1) }}h)</div>
            </div>
            <f-button size="xs" variant="solid" theme="green" @click="quickConvertPlanToActual(b)">
              Convert ({{ Number(b.duration_hours || 0).toFixed(1) }}h)
            </f-button>
          </div>
        </div>
      </div>
      <div v-else class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
        <span>✓ All planned blocks for today have been logged or addressed.</span>
      </div>
    </div>
    <template #actions>
      <div class="flex items-center justify-between w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showEODModal = false">
          Close
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="showEODModal = false; showToast('EOD review complete! Great work today.', 'success');">
          Complete EOD Ritual ✓
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- SWITCH ACTIVE TASK MODAL DIALOG            -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showSwitchTaskModal"
    title="Switch Active Task"
    subtitle="Log time on current work block and transition to another immediately"
    size="md"
    z-index="z-[80]"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- Current Session Summary & Wrap-Up Note -->
      <div class="p-3 rounded-2xl bg-gray-50 dark:bg-[#18191B] border border-gray-200 dark:border-gray-800 space-y-2">
        <div class="flex items-center justify-between text-gray-600 dark:text-gray-300 font-medium">
          <span>Active Clock: <strong class="font-mono text-gray-900 dark:text-white">{{ formattedTime }}</strong></span>
          <span class="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
            {{ trackerBoundBlock ? 'Bound to Block' : 'Unbound Focus' }}
          </span>
        </div>
        <div>
          <label for="switch-wrap-note" class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Current Session Wrap-Up Note (Saved to timesheet)
          </label>
          <input
            id="switch-wrap-note"
            type="text"
            v-model="switchWrapUpNote"
            class="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#25272A] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What did you wrap up before switching?"
          />
        </div>
      </div>

      <!-- Search Candidate Blocks & Tasks -->
      <div class="space-y-2">
        <label for="switch-target-search" class="block font-bold text-gray-800 dark:text-gray-200">
          Select Target Task to Switch To:
        </label>
        <div class="relative">
          <input
            id="switch-target-search"
            type="search"
            v-model="switchSearchQuery"
            class="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#25272A] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search today's planned blocks or assigned tasks..."
            autocomplete="off"
          />
          <svg class="w-4 h-4 absolute left-3 top-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
      </div>

      <!-- Candidate Selection List -->
      <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
        <div v-if="switchCandidates.length === 0" class="py-6 text-center text-gray-400 italic">
          No matching work blocks or tasks found for today.
        </div>
        <button
          v-for="item in switchCandidates"
          :key="item.id || item.name"
          type="button"
          @click="executeSwitchTask(item)"
          class="w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white dark:bg-[#222427] border-gray-200 dark:border-gray-700/80 hover:border-blue-400 dark:hover:border-blue-500"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                :class="item.is_block ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'">
                {{ item.is_block ? 'Planned Block' : 'Open Task' }}
              </span>
              <span class="font-bold text-gray-900 dark:text-white truncate text-xs">{{ item.label }}</span>
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {{ item.sublabel || item.project || 'General' }}
            </div>
          </div>
          <span class="shrink-0 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            Switch →
          </span>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showSwitchTaskModal = false">
          Cancel
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- WRAP & START NEXT SESSION CONFIRMATION     -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showSwitchConfirmModal"
    title="Wrap & Start Next Session"
    subtitle="Save your running session and transition immediately"
    size="md"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- 1. Current Running Session Card -->
      <div class="p-3.5 rounded-2xl border bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/60 space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span class="text-[10px] uppercase font-bold tracking-wider text-amber-800 dark:text-amber-200">Current Session to Wrap</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-white/80 dark:bg-black/40 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700">
            ⏱ {{ formattedTime }}
          </span>
        </div>
        <div class="font-extrabold text-sm text-gray-900 dark:text-white">
          {{ (trackerBoundBlock && (trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label || trackerBoundBlock.deliverable_notes)) || trackerNotes || 'Active Work Session' }}
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-3">
          <span v-if="selectedProject">📁 {{ selectedProject }}</span>
          <span>🏷 {{ selectedNature }}</span>
        </div>

        <!-- Session Summary Notes -->
        <div class="pt-1">
          <label for="switch-confirm-notes" class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
            Session Summary & Work Logged (will be saved to timesheet) *
          </label>
          <textarea
            id="switch-confirm-notes"
            v-model="switchWrapUpNote"
            rows="3"
            class="w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
            :class="isDarkMode ? 'bg-[#121212] border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
            placeholder="Review or add notes for this completed session..."
          ></textarea>
        </div>
      </div>

      <!-- Transition Indicator -->
      <div class="flex items-center justify-center gap-2 text-gray-400 text-xs font-bold">
        <span>↓</span>
        <span>Transitioning to</span>
        <span>↓</span>
      </div>

      <!-- 2. Target Block to Start Immediately Card -->
      <div v-if="switchTargetItem" class="p-3.5 rounded-2xl border bg-blue-50/70 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/60 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-300">
            {{ switchTargetItem.is_block ? 'Next Planned Block' : 'Next Task' }}
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Starts Immediately
          </span>
        </div>
        <div class="font-extrabold text-sm text-gray-900 dark:text-white">
          {{ switchTargetItem.label }}
        </div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-3">
          <span v-if="switchTargetItem.sublabel">{{ switchTargetItem.sublabel }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <template #actions>
      <div class="flex items-center justify-between gap-3 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showSwitchConfirmModal = false">
          Cancel (Keep Current)
        </f-button>
        <f-button
          variant="solid"
          theme="blue"
          size="sm"
          class="!font-bold shadow-md"
          :loading="isSwitchingSession"
          :disabled="isSwitchingSession"
          @click="confirmSwitchAndStart"
        >
          <template #prefix>
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </template>
          <span>Save & Start Next Session</span>
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- CANCEL WORK BLOCK MODAL DIALOG             -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showCancelModal"
    title="Cancel Work Block"
    subtitle="Audit reason for schedule variance"
    size="sm"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
    </template>

    <div v-if="cancelTargetBlock" class="space-y-4 text-xs">
      <!-- Target Block Summary Card -->
      <div class="p-3 rounded-2xl border" :class="isDarkMode ? 'bg-[#161618] border-[#2E2E32]' : 'bg-gray-50 border-gray-200'">
        <div class="text-[10px] uppercase font-bold tracking-wider text-gray-400">Target Block</div>
        <div class="font-extrabold text-sm text-gray-900 dark:text-white mt-0.5">{{ cancelTargetBlock.task_subject || cancelTargetBlock.work_item_label || cancelTargetBlock.deliverable_notes || 'Work block' }}</div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
          <span>📅 {{ cancelTargetBlock.work_date }}</span>
          <span>⏱ {{ hhmm(cancelTargetBlock.start_time) }}–{{ hhmm(cancelTargetBlock.end_time) }} ({{ fmtHrs(cancelTargetBlock.duration_hours) }}h planned)</span>
        </div>
      </div>

      <!-- Structured Reason Dropdown -->
      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Cancellation Reason *</label>
        <f-combobox
          v-model="cancelForm.reason"
          :options="cancelReasons"
          placeholder="Select cancellation reason..."
          search-placeholder="Filter cancellation reason..."
          aria-label="Cancellation reason"
        ></f-combobox>
      </div>

      <!-- Notes / Context -->
      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Context / Notes (Optional)</label>
        <textarea
          v-model="cancelForm.notes"
          rows="2"
          placeholder="e.g. Waited 10m on call with Arthurton Musgrave. Rescheduling needed."
          class="w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          :class="isDarkMode ? 'bg-[#121212] border-[#2A2A2A] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'"
        ></textarea>
      </div>

      <!-- Log Elapsed Time Checkbox (if active session running on this block) -->
      <div v-if="isTracking && trackerBlockName === cancelTargetBlock.name"
        class="p-3 rounded-xl border bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 space-y-1">
        <label class="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            v-model="cancelForm.log_elapsed"
            class="mt-0.5 rounded text-red-600 focus:ring-red-500"
          >
          <div class="text-xs">
            <span class="font-bold text-amber-900 dark:text-amber-200">Log elapsed wait time ({{ formattedTime }})</span>
            <p class="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
              Record this wait time as a timesheet session on the block before cancelling. Frees your tracker immediately.
            </p>
          </div>
        </label>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #actions>
      <div class="flex items-center justify-between gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showCancelModal = false">
          Keep Block
        </f-button>
        <f-button
          variant="solid"
          theme="red"
          size="sm"
          :disabled="plannerBusy"
          :loading="plannerBusy"
          @click="submitCancelBlock"
        >
          Confirm Cancellation
        </f-button>
      </div>
    </template>
  </f-dialog>

  <!-- ========================================== -->
  <!-- EDIT LOGGED WORK SESSION MODAL DIALOG       -->
  <!-- ========================================== -->
  <f-dialog
    v-model="showEditSessionModal"
    title="Edit Logged Work Session"
    subtitle="Fine-tune start/end times and deliverable notes"
    size="sm"
  >
    <template #header-icon>
      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </template>

    <div class="space-y-4 text-xs">
      <!-- Session Date -->
      <div>
        <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Session Date</label>
        <input type="date" v-model="editSessionForm.session_date"
          class="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-blue-500"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'">
      </div>

      <!-- Start and End Time -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
          <input type="time" v-model="editSessionForm.from_time"
            class="w-full px-3 py-2 rounded-xl border font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">End Time</label>
          <input type="time" v-model="editSessionForm.to_time"
            class="w-full px-3 py-2 rounded-xl border font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
            :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'">
        </div>
      </div>

      <!-- Calculated Duration Badge -->
      <div class="flex items-center justify-between p-2.5 rounded-xl border"
        :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-gray-50 border-gray-200'">
        <span class="text-gray-500 dark:text-gray-400 font-medium">Calculated Duration</span>
        <span class="font-mono font-bold text-emerald-500 text-sm">{{ editSessionDuration }}h</span>
      </div>

      <!-- Notes / Bullets -->
      <div>
        <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Session Deliverables & Notes</label>
        <textarea v-model="editSessionForm.notes" rows="4"
          placeholder="Update deliverables or bullet notes for this session..."
          class="w-full p-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'"></textarea>
      </div>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="showEditSessionModal = false">
          Cancel
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" :loading="isSavingEditSession" @click="saveEditSession">
          Save Changes
        </f-button>
      </div>
    </template>
  </f-dialog>

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
