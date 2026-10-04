<template>
  <header
    class="sticky top-0 z-40 border-b px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 transition-colors duration-200 shrink-0"
    :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200 shadow-xs'"
  >
    <!-- Authentic Brand Identity -->
    <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
      <img
        src="/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg"
        alt="OmniTrack"
        class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl shadow-xs object-contain cursor-pointer shrink-0"
        @click="$emit('go-dashboard')"
      />
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-bold text-sm sm:text-base tracking-tight truncate" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
          OmniTrack
        </span>
        <span
          v-if="isClient"
          class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800 flex items-center gap-1 shrink-0"
        >
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
        @click="$emit('toggle-focus')"
      >
        <template #prefix>
          <span
            class="w-2 h-2 rounded-full mr-1 inline-block"
            :class="isTracking ? (isSessionElevated ? 'bg-white animate-pulse' : 'bg-red-500 pulse-record') : 'bg-gray-400'"
          ></span>
        </template>
        <span>{{ formattedTime }}</span>
        <template #suffix>
          <svg
            v-if="isTracking && !isSessionElevated"
            class="w-3 h-3 ml-1 text-red-500 dark:text-red-400"
            view0="0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
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
        @click="$emit('open-raven')"
      >
        <template #prefix>
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
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
        @click="$emit('enable-notifications')"
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
</template>

<script>
export default {
  name: "WorkstationHeader",
  props: {
    isDarkMode: { type: Boolean, default: false },
    isClient: { type: Boolean, default: false },
    isTracking: { type: Boolean, default: false },
    isSessionElevated: { type: Boolean, default: false },
    formattedTime: { type: String, default: "00:00:00" },
    notificationPermission: { type: String, default: "default" },
    headerMenuItems: { type: Array, default: () => [] }
  },
  emits: ["go-dashboard", "toggle-focus", "open-raven", "enable-notifications"]
};
</script>
