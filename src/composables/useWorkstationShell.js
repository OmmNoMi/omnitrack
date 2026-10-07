import { lazy } from "./workstationBag.js";
import { ACTIVITY_OPTIONS, activityOption, isNonWorking } from "../utils/activity.js";
import { ref, watch, onMounted } from "vue";

/**
 * Navigation, theme and static option tables.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationShell(w) {
  const syncActiveSession = lazy(w, 'syncActiveSession');
  const totalFilteredHours = lazy(w, 'totalFilteredHours');

const getInitialTabFromHash = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
      if (['dashboard', 'projects', 'planner', 'tasks', 'timesheets', 'attendance'].includes(raw)) {
        return raw;
      }
    }
    return 'dashboard';
  };
  const activeTab = ref(getInitialTabFromHash());
  if (typeof window !== 'undefined') {
    const handleHashSync = () => {
      const tab = getInitialTabFromHash();
      if (tab && activeTab.value !== tab) {
        activeTab.value = tab;
      }
    };
    window.addEventListener('hashchange', handleHashSync);
    window.addEventListener('popstate', handleHashSync);
  }
  watch(activeTab, (newTab) => {
    if (typeof window !== 'undefined' && newTab) {
      const currentHash = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
      if (currentHash !== newTab) {
        window.location.hash = `#/${newTab}`;
      }
    }
  });
  const initialDark = localStorage.getItem('omnitrack_theme') === 'dark' || (!localStorage.getItem('omnitrack_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isDarkMode = ref(initialDark);
  const hasFrappeUI = ref(typeof window !== 'undefined' && Boolean(window.OmniTrackSessionBox && window.OmniTrackSessionBox.mount));
  onMounted(() => {
    if (typeof window !== 'undefined' && window.OmniTrackSessionBox && window.OmniTrackSessionBox.mount) {
      hasFrappeUI.value = true;
    }
  });
  const appendSessionLine = (text) => {
    const pt = (text || '').trim();
    if (!pt) return;
    sessionNotesList.value.push(pt);
    syncActiveSession(true);
    triggerHaptic([25]);
  };
  // Two switches, one theme: .dark drives the app's own dark: classes (tailwind.config darkMode
  // "class"), data-theme drives frappe-ui's ink/surface/outline tokens. With only .dark, every
  // frappe-ui control stayed light on a dark page.
  const applyTheme = (dark) => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#121212';
      document.body.classList.add('dark');
      document.body.style.backgroundColor = '#121212';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#F8F9FA';
      document.body.classList.remove('dark');
      document.body.style.backgroundColor = '#F8F9FA';
    }
  };
  const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value;
    localStorage.setItem('omnitrack_theme', isDarkMode.value ? 'dark' : 'light');
    applyTheme(isDarkMode.value);
  };
  watch(isDarkMode, (newVal) => {
    applyTheme(newVal);
  }, { immediate: true });
  // Helper for local calendar date YYYY-MM-DD
  const getLocalTodayISO = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayISO = () => getLocalTodayISO();
  const _minToHHMM = (m) => {
    const mm = Math.max(0, Math.min(24 * 60, Math.round(m)));
    return String(Math.floor(mm / 60) % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
  };
  const nowMinute = ref((() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })());
  const _utcDate = (iso) => { const [y, m, d] = (iso || '').split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const addDays = (iso, n) => { const d = _utcDate(iso); d.setUTCDate(d.getUTCDate() + n); return getLocalTodayISO(d); };
  // Google Meet-Style Dashboard State & Agenda extracted to useWorkstationDashboard
  // Scratchpad & Haptics State
  const sessionNotesList = ref([]);
  // Tasks of a running session that has no block yet (block_tasks row shape). Stop puts
  // them on the block the session becomes; a bound session shows its block's tasks instead.
  const sessionTasks = ref([]);
  const newSessionPoint = ref('');
  const triggerHaptic = (pattern = [30]) => {
    try {
      if (navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (e) {}
  };
  // The activity picker's options and helpers (src/utils/activity.js). The old names stay
  // because views read them from the workstation context.
  const natureOptions = ACTIVITY_OPTIONS;
  const isNonWorkingNature = isNonWorking;
  const getNatureBadge = activityOption;
const session = window.OMNITRACK_SESSION || { user: 'hardiksharma80912@gmail.com', user_fullname: 'Hardik Sharma', is_manager: true, is_client: false };
const isManager = ref(session.is_manager !== undefined ? session.is_manager : true);
// OmniTrack Settings > Minimum Characters per Session Log Line, rendered into the page at boot
const minLogLineChars = Number(session.min_log_line_chars) > 0 ? Number(session.min_log_line_chars) : 10;
const plannerData = ref({
    week_start: '', week_end: '', days: [], blocks: [], assigned_tasks: [],
    totals: { planned_hours: 0, actual_hours: 0, variance_hours: 0, adherence_pct: 0, block_count: 0 }
  });

  Object.assign(w, {
    activeTab,
    isDarkMode,
    hasFrappeUI,
    appendSessionLine,
    applyTheme,
    toggleTheme,
    getLocalTodayISO,
    todayISO,
    _minToHHMM,
    nowMinute,
    _utcDate,
    addDays,
    sessionNotesList,
    sessionTasks,
    newSessionPoint,
    triggerHaptic,
    natureOptions,
    isNonWorkingNature,
    getNatureBadge,
    session,
    isManager,
    minLogLineChars,
    plannerData,
  });
}
