<template>
  <!-- The pages used every day, around the session button. Projects and Logged time are in
       the header's menu (WorkstationHeader "Go to"): seven targets crowded the bar. -->
  <nav
    class="fixed bottom-0 left-0 right-0 z-40 border-t flex items-center justify-around px-3 py-2 transition-colors pb-safe backdrop-blur-md"
    :class="isDarkMode ? 'bg-[#1E1F22]/95 border-gray-800 shadow-2xl' : 'bg-white/95 border-gray-200 shadow-lg'"
    aria-label="Workstation navigation"
  >
    <div class="w-full max-w-xl mx-auto flex items-center justify-around">
      <!-- Dashboard Tab -->
      <Button
        variant="ghost"
        :theme="activeTab === 'dashboard' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'dashboard' ? (isDarkMode ? '!text-blue-300 font-bold' : '!text-blue-700 font-bold') : (isDarkMode ? '!text-gray-300 font-medium' : '!text-gray-700 font-medium')"
        :aria-current="activeTab === 'dashboard' ? 'page' : null"
        label="Dashboard"
        @click="$emit('update:activeTab', 'dashboard')"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
            <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
            <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
          </svg>
        </template>
        <span class="text-[10px] mt-0.5">Dashboard</span>
      </Button>

      <!-- Calendar Tab -->
      <Button
        variant="ghost"
        :theme="activeTab === 'planner' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'planner' ? (isDarkMode ? '!text-blue-300 font-bold' : '!text-blue-700 font-bold') : (isDarkMode ? '!text-gray-300 font-medium' : '!text-gray-700 font-medium')"
        :aria-current="activeTab === 'planner' ? 'page' : null"
        label="Calendar"
        @click="$emit('update:activeTab', 'planner')"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <line x1="8" y1="14" x2="10" y2="14"></line>
            <line x1="14" y1="14" x2="16" y2="14"></line>
          </svg>
        </template>
        <span class="text-[10px] mt-0.5">Calendar</span>
      </Button>

      <!-- Floating Quick Start/Stop Timer Button in Center -->
      <Button
        variant="solid"
        :theme="isTracking ? 'red' : 'blue'"
        size="lg"
        class="relative shrink-0 !h-14 !flex !flex-col !items-center !justify-center shadow-xl active:scale-90 transition-all -mt-6 ring-4 cursor-pointer !p-0"
        :class="[
          isDarkMode ? 'ring-[#1E1F22]' : 'ring-white',
          (isTracking && bottomBarTimer.isHours) ? '!w-auto !min-w-[4.75rem] !px-3 !rounded-full shadow-2xl' : '!w-14 !rounded-full'
        ]"
        label="Open the current session"
        :title="isTracking ? 'Recording ' + formattedTime : null"
        @click="$emit('open-session')"
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
      </Button>

      <!-- Tasks: everyone's open Tasks and to-dos, grouped by what to do next -->
      <Button
        variant="ghost"
        :theme="activeTab === 'tasks' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'tasks' ? (isDarkMode ? '!text-blue-300 font-bold' : '!text-blue-700 font-bold') : (isDarkMode ? '!text-gray-300 font-medium' : '!text-gray-700 font-medium')"
        :aria-current="activeTab === 'tasks' ? 'page' : null"
        label="Tasks"
        @click="$emit('update:activeTab', 'tasks')"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
        </template>
        <span class="text-[10px] mt-0.5">Tasks</span>
      </Button>

      <!-- Team: managers only -->
      <Button
        v-if="isManager"
        variant="ghost"
        :theme="activeTab === 'attendance' ? 'blue' : 'gray'"
        size="sm"
        class="flex-1 basis-0 !flex-col !h-auto !py-1 !px-1 !rounded-2xl transition-all cursor-pointer"
        :class="activeTab === 'attendance' ? (isDarkMode ? '!text-blue-300 font-bold' : '!text-blue-700 font-bold') : (isDarkMode ? '!text-gray-300 font-medium' : '!text-gray-700 font-medium')"
        :aria-current="activeTab === 'attendance' ? 'page' : null"
        label="Team"
        @click="$emit('update:activeTab', 'attendance')"
      >
        <template #prefix>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
        </template>
        <span class="text-[10px] mt-0.5">Team</span>
      </Button>

    </div>
  </nav>
</template>

<script>
export default {
  name: "WorkstationBottomNav",
  props: {
    isDarkMode: { type: Boolean, default: false },
    activeTab: { type: String, default: "dashboard" },
    isManager: { type: Boolean, default: false },
    isTracking: { type: Boolean, default: false },
    bottomBarTimer: { type: Object, default: () => ({ isHours: false, primary: "00:00", hours: "0", minutes: "00", seconds: "00" }) },
    formattedTime: { type: String, default: "00:00:00" }
  },
  emits: ["update:activeTab", "open-session"]
};
</script>
