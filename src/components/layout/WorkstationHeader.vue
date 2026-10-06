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
        <span class="font-semibold text-lg sm:text-xl tracking-tight truncate" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
          OmniTrack
        </span>
        <Badge v-if="isClient" theme="blue" variant="subtle">Client Portal</Badge>
      </div>
    </div>

    <!-- Header Controls: Stopwatch & Menu (Pure Frappe UI) -->
    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <!-- Header stopwatch: click (or Shift+S) elevates to the session timesheet in full focus -->
      <Button
        v-if="!isClient"
        :variant="isTracking && isSessionElevated ? 'solid' : 'subtle'"
        :theme="isTracking ? (isSessionElevated ? 'blue' : 'red') : 'gray'"
        class="font-mono tabular-nums"
        :icon-right="isTracking && !isSessionElevated ? 'maximize-2' : undefined"
        :label="stopwatchHint"
        :tooltip="stopwatchTip"
        @click="$emit('toggle-focus')"
      >
        <template #prefix>
          <span
            class="w-2 h-2 rounded-full inline-block"
            :class="isTracking ? (isSessionElevated ? 'bg-white animate-pulse' : 'bg-red-500 pulse-record') : 'bg-gray-500'"
            aria-hidden="true"
          ></span>
        </template>
        {{ formattedTime }}
      </Button>

      <!-- Notifications: one quiet icon until the user decides; "blocked" lives in the menu -->
      <Button
        v-if="notificationPermission === 'default'"
        variant="ghost"
        icon="bell"
        label="Enable alerts"
        tooltip="Enable alerts"
        @click="$emit('enable-notifications')"
      />

      <!-- App menu -->
      <Dropdown :options="menuItems" align="end">
        <Button variant="ghost" icon="menu" label="Menu" />
      </Dropdown>
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
  emits: ["go-dashboard", "toggle-focus", "open-raven", "enable-notifications"],
  computed: {
    // Raven is reached from the menu, keeping the header to the clock and the menu
    menuItems() {
      return [
        { label: "Raven chat", icon: "message-circle", onClick: () => this.$emit("open-raven") },
        // Desk is where the rest of Frappe lives; client-portal users have no Desk access
        ...(this.isClient ? [] : [{ label: "OmniTrack Desk", icon: "grid", onClick: () => { window.location.href = "/desk/omnitrack"; } }]),
        ...this.headerMenuItems
      ];
    },
    stopwatchHint() {
      if (!this.isTracking) return "Start session (Shift+S)";
      return this.isSessionElevated ? "Minimize full focus (Shift+S / Esc)" : "Full focus (Shift+S)";
    },
    // Tooltips stay a few words: the action plus its shortcut, nothing the button already shows.
    stopwatchTip() {
      if (!this.isTracking) return "Start · Shift+S";
      return this.isSessionElevated ? "Minimize · Esc" : "Full focus · Shift+S";
    }
  }
};
</script>
