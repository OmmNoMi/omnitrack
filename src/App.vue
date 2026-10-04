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
        <button v-for="m in [['work','🎯 Work'],['break','☕ Break'],['🌴 Leave','🌴 Leave']]" :key="m[0]" type="button"
          @click="bookForm.mode = m[0]"
          class="flex-1 text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer transition-colors"
          :class="bookForm.mode === m[0] ? (isDarkMode ? 'bg-blue-950/80 border-blue-600 text-blue-200' : 'bg-blue-50 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600')">
          {{ m[1] }}
        </button>
      </div>
      <!-- Quick Date Presets -->
      <div class="flex items-center justify-between gap-1 pt-1">
        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Date:</span>
        <div class="flex items-center gap-1">
          <button
            type="button"
            @click="setDatePreset(0)"
            class="text-[10px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors"
            :class="isDateActive(0) ? (isDarkMode ? 'bg-blue-900 border-blue-600 text-white' : 'bg-blue-100 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700')">
            Today
          </button>
          <button
            type="button"
            @click="setDatePreset(1)"
            class="text-[10px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors"
            :class="isDateActive(1) ? (isDarkMode ? 'bg-blue-900 border-blue-600 text-white' : 'bg-blue-100 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700')">
            Tomorrow
          </button>
          <button
            type="button"
            @click="setDatePreset(2)"
            class="text-[10px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors"
            :class="isDateActive(2) ? (isDarkMode ? 'bg-blue-900 border-blue-600 text-white' : 'bg-blue-100 border-blue-400 text-blue-800') : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700')">
            +2 Days
          </button>
        </div>
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
      <!-- Date & Time: when work or break, show Start & End; when leave, show Date only (All-Day) -->
      <div v-if="bookForm.mode === 'work' || bookForm.mode === 'break'" class="grid grid-cols-3 gap-2">
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
        <div class="text-[11px] text-gray-400 pl-0.5">Recorded as an all-day leave event on the calendar banner.</div>
      </div>
      <label class="block"><span class="text-[11px] font-bold text-gray-500">Notes (optional)</span>
        <input type="text" v-model="bookForm.deliverable_notes" :placeholder="bookForm.mode === 'work' ? 'What will you get done?' : (bookForm.mode === 'break' ? 'Short break details' : 'Reason / coverage details')" class="mt-1 w-full text-sm rounded-xl px-3 py-2 border outline-none" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'"></label>
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
