<template>
  <div class="h-screen w-screen overflow-hidden flex flex-col font-sans transition-colors duration-200"
       :class="isDarkMode ? 'dark bg-[#121212] text-[#F3F4F6]' : 'bg-[#F8F9FA] text-[#111827]'">
    
    <!-- TOP NAVIGATION & HEADER BAR -->
    <header class="h-14 border-b shrink-0 flex items-center justify-between px-4 sm:px-6 transition-colors z-20"
            :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
            O
          </span>
          <span class="font-bold text-sm tracking-tight hidden sm:inline">
            <span class="text-blue-500">Omm</span><span class="text-emerald-500">No</span><span class="text-red-500">M</span><span class="text-amber-500">i</span> OmniTrack
          </span>
        </div>

        <!-- Date Context Indicator -->
        <div class="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>
        <div class="text-xs font-semibold text-gray-500 dark:text-gray-400">
          {{ currentDateDisplay }}
        </div>
      </div>

      <!-- DESKTOP NAVIGATION TABS -->
      <nav class="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200/80 dark:border-gray-700">
        <button
          v-for="tab in navTabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
          :class="activeTab === tab.id 
            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' 
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
        >
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <!-- RIGHT ACTIONS: ACTIVE TIMER PILL & THEME -->
      <div class="flex items-center gap-3">
        <!-- Live Active Stopwatch Indicator Pill -->
        <div
          v-if="isTracking"
          class="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold"
        >
          <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>{{ formattedTimer }}</span>
        </div>

        <!-- Dark / Light Mode Toggle -->
        <button
          type="button"
          @click="toggleTheme"
          class="p-2 rounded-xl border transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
          :title="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <span v-if="isDarkMode">☀️</span>
          <span v-else>🌙</span>
        </button>

        <!-- User Profile Avatar -->
        <div class="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
          {{ userInitial }}
        </div>
      </div>
    </header>

    <!-- MAIN VIEWPORT CONTAINER (FIXED HEIGHT, NO WINDOW SCROLLING) -->
    <main class="flex-1 min-h-0 overflow-hidden relative flex flex-col">
      <!-- DASHBOARD TAB -->
      <div v-show="activeTab === 'dashboard'" class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
        <!-- Persistent Session HUD -->
        <div id="omnitrack-session-hud-container" class="w-full">
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
            :is-dark-mode="isDarkMode"
            @stop="stopSession"
            @discard="discardSession"
            @add-line="addSessionLine"
            @remove-line="removeSessionLine"
          />
        </div>

        <!-- 3-Column Workstation Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left Rail: Tasks & Backlog -->
          <div class="lg:col-span-3 space-y-4">
            <div class="rounded-2xl border p-4 shadow-sm"
                 :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
              <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Assigned Tasks</h3>
                <span class="text-xs font-mono font-semibold text-gray-400">{{ assignedTasks.length }}</span>
              </div>
              <div class="space-y-2 mt-3 max-h-[400px] overflow-y-auto pr-1">
                <div
                  v-for="task in assignedTasks"
                  :key="task.name || task.id"
                  class="p-2.5 rounded-xl border text-xs cursor-pointer hover:border-blue-500/50 transition-colors"
                  :class="isDarkMode ? 'bg-gray-800/40 border-gray-700/60' : 'bg-gray-50 border-gray-200'"
                  @click="startSessionOnTask(task)"
                >
                  <div class="font-semibold truncate">{{ task.subject || task.title }}</div>
                  <div class="text-[10px] text-gray-400 mt-0.5 truncate">{{ task.project || 'General' }}</div>
                </div>
                <div v-if="assignedTasks.length === 0" class="text-center py-6 text-xs text-gray-400">
                  No assigned tasks pending
                </div>
              </div>
            </div>
          </div>

          <!-- Center: Timeline & Calendar -->
          <div class="lg:col-span-6 space-y-6">
            <!-- Day at a glance Timeline -->
            <div class="rounded-2xl border p-4 shadow-sm"
                 :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
              <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Day Timeline</h3>
                <div class="flex items-center gap-1.5 text-[11px] font-semibold text-blue-500">
                  <span>{{ workBlocks.length }} planned blocks</span>
                </div>
              </div>
              <!-- Timeline Grid Placeholder / Visual Lane -->
              <div class="mt-4 relative h-28 rounded-xl border bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col justify-around px-3 py-2">
                <div class="text-[10px] font-mono uppercase text-gray-400 flex items-center justify-between">
                  <span>08:00</span>
                  <span>12:00</span>
                  <span>16:00</span>
                  <span>20:00</span>
                </div>
                <div class="relative h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center px-2">
                  <span class="text-[10px] font-semibold text-blue-500 truncate">Planned Blocks Lane</span>
                </div>
                <div class="relative h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center px-2">
                  <span class="text-[10px] font-semibold text-emerald-500 truncate">Logged Timesheets Lane</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Rail: KPIs & Stats -->
          <div class="lg:col-span-3 space-y-4">
            <div class="rounded-2xl border p-4 shadow-sm"
                 :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
              <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Today's Focus</h3>
                <span class="text-xs font-bold text-emerald-500">{{ kpis.paciRatio || '100%' }} PACI</span>
              </div>
              <div class="grid grid-cols-2 gap-3 mt-3">
                <div class="p-3 rounded-xl border text-center"
                     :class="isDarkMode ? 'bg-gray-800/40 border-gray-700/60' : 'bg-gray-50 border-gray-200'">
                  <div class="text-[10px] uppercase font-bold text-gray-400">Planned</div>
                  <div class="text-base font-extrabold mt-0.5">{{ kpis.plannedHours || 0 }}h</div>
                </div>
                <div class="p-3 rounded-xl border text-center"
                     :class="isDarkMode ? 'bg-gray-800/40 border-gray-700/60' : 'bg-gray-50 border-gray-200'">
                  <div class="text-[10px] uppercase font-bold text-gray-400">Logged</div>
                  <div class="text-base font-extrabold mt-0.5 text-emerald-500">{{ kpis.actualHours || 0 }}h</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TIMESHEETS TAB -->
      <div v-show="activeTab === 'timesheets'" class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
        <h2 class="text-lg font-bold">Timesheet History</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400">View and audit logged work sessions for today and yesterday.</p>
      </div>

      <!-- ATTENDANCE TAB -->
      <div v-show="activeTab === 'attendance'" class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
        <h2 class="text-lg font-bold">Attendance Records</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400">Daily punch-in and punch-out check-ins.</p>
      </div>

      <!-- PLANNER TAB -->
      <div v-show="activeTab === 'planner'" class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
        <h2 class="text-lg font-bold">7-Day Rolling Workstation Planner</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400">Schedule deep focus blocks across rolling horizons.</p>
      </div>
    </main>

    <!-- MOBILE BOTTOM NAVIGATION -->
    <nav class="md:hidden h-14 border-t shrink-0 flex items-center justify-around px-2 z-20"
         :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
      <button
        v-for="tab in navTabs"
        :key="tab.id"
        type="button"
        @click="activeTab = tab.id"
        class="flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition-colors"
        :class="activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600'"
      >
        <span class="text-base">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script>
import SessionBox from "./timesheet_session/SessionBox.vue";
import FDropdownMenu from "./components/common/FDropdownMenu.vue";
import FCombobox from "./components/common/FCombobox.vue";

export default {
  name: "OmniTrackApp",
  components: {
    SessionBox,
    FDropdownMenu,
    FCombobox
  },
  data() {
    const boot = (typeof window !== "undefined" && window.omnitrack_boot) || {};
    const darkSetting = typeof localStorage !== "undefined" 
      ? localStorage.getItem("omnitrack_theme") === "dark" 
      : false;

    return {
      activeTab: "dashboard",
      isDarkMode: darkSetting,
      userFullname: boot.user_fullname || "Nomeshwer Sharma",
      todayDate: boot.today_date || new Date().toISOString().split("T")[0],
      isTracking: false,
      trackerSeconds: 0,
      trackerTimer: null,
      trackerNotes: "",
      trackerProject: "",
      trackerNature: "🎯 Planned",
      trackerBoundBlock: null,
      sessionNotesList: [],
      assignedTasks: [],
      workBlocks: boot.today_blocks || [],
      projects: [],
      natureOptions: ["🎯 Planned", "⚠️ Unplanned", "⚡ Operational"],
      kpis: {
        plannedHours: 6.5,
        actualHours: 0,
        paciRatio: "100%"
      },
      navTabs: [
        { id: "dashboard", label: "Workstation", icon: "📊" },
        { id: "planner", label: "Planner", icon: "📅" },
        { id: "timesheets", label: "Timesheets", icon: "⏱️" },
        { id: "attendance", label: "Team", icon: "👥" }
      ]
    };
  },
  computed: {
    userInitial() {
      return (this.userFullname || "O").charAt(0).toUpperCase();
    },
    currentDateDisplay() {
      return this.todayDate;
    },
    formattedTimer() {
      const s = this.trackerSeconds || 0;
      const hrs = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = s % 60;
      const pad = (n) => String(n).padStart(2, "0");
      if (hrs > 0) {
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      }
      return `${pad(mins)}:${pad(secs)}`;
    }
  },
  watch: {
    isDarkMode: {
      handler(val) {
        if (typeof document !== "undefined") {
          if (val) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
      },
      immediate: true
    }
  },
  mounted() {
    this.restoreActiveSession();
  },
  beforeUnmount() {
    if (this.trackerTimer) clearInterval(this.trackerTimer);
  },
  methods: {
    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("omnitrack_theme", this.isDarkMode ? "dark" : "light");
      }
    },
    startSessionOnTask(task) {
      this.trackerBoundBlock = task.name || null;
      this.trackerNotes = task.subject || "";
      this.trackerProject = task.project || "";
      this.startTimer();
    },
    startTimer() {
      if (this.isTracking) return;
      this.isTracking = true;
      this.trackerSeconds = 0;
      this.trackerTimer = setInterval(() => {
        this.trackerSeconds++;
      }, 1000);
    },
    stopSession() {
      if (!this.isTracking) return;
      this.isTracking = false;
      if (this.trackerTimer) clearInterval(this.trackerTimer);
      this.trackerTimer = null;
      this.trackerSeconds = 0;
    },
    discardSession() {
      this.stopSession();
      this.sessionNotesList = [];
      this.trackerNotes = "";
      this.trackerBoundBlock = null;
    },
    addSessionLine(line) {
      if (!line || !line.trim()) return;
      this.sessionNotesList.push(line.trim());
    },
    removeSessionLine(idx) {
      this.sessionNotesList.splice(idx, 1);
    },
    restoreActiveSession() {
      const boot = (typeof window !== "undefined" && window.omnitrack_boot) || {};
      if (boot.active_session && boot.active_session.startTime) {
        const sTime = Number(boot.active_session.startTime);
        this.isTracking = true;
        this.trackerSeconds = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
        this.trackerNotes = boot.active_session.notes || "";
        this.trackerProject = boot.active_session.project || "";
        this.trackerNature = boot.active_session.taskNature || "🎯 Planned";
        this.trackerBoundBlock = boot.active_session.boundBlock || null;
        this.sessionNotesList = boot.active_session.sessionNotesList || [];
        this.trackerTimer = setInterval(() => {
          this.trackerSeconds = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
        }, 1000);
      }
    }
  }
};
</script>

<style scoped>
/* Scoped layout rules */
</style>
