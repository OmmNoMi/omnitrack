import { lazy } from "./workstationBag.js";
import { ref, computed, nextTick } from "vue";
import { WORK } from "../utils/activity.js";
import { blockTitle } from '../utils/blockTitle.js';

// Attention rows: subject, Plan, Start Session (the task form holds the rest)
const ATTENTION_LAST_COL = 2;

/**
 * Tracker state, permission-scoped user/filters and the data stores.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationIdentity(w) {
  const { activeTab, getLocalTodayISO, getNatureBadge, session, triggerHaptic } = w;
  const showToast = (...args) => w.showToast(...args);
  const ATTENTION_TASKS_COLLAPSED_LIMIT = lazy(w, 'ATTENTION_TASKS_COLLAPSED_LIMIT');
  const attentionFilter = lazy(w, 'attentionFilter');
  const filteredOpenTodos = lazy(w, 'filteredOpenTodos');
  const filteredPlannedBlocks = lazy(w, 'filteredPlannedBlocks');
  const plannerTaskFilter = lazy(w, 'plannerTaskFilter');
  const selectCustomTitle = lazy(w, 'selectCustomTitle');
  const selectTodoToAutofill = lazy(w, 'selectTodoToAutofill');
  const showAllAttentionTasks = lazy(w, 'showAllAttentionTasks');
  const showCustomOption = lazy(w, 'showCustomOption');
  const syncActiveSession = lazy(w, 'syncActiveSession');
  const todoDropdownOpen = lazy(w, 'todoDropdownOpen');
  const todoSearchQuery = lazy(w, 'todoSearchQuery');
  const visibleAttentionTasks = lazy(w, 'visibleAttentionTasks');

  // 2. Stopwatch Tracker State
  const showTrackerPopup = ref(false);
  const isTracking = ref(false);
  const trackerSeconds = ref(0);
  const trackerTimer = ref(null);
  const trackerNotes = ref('');
  const selectedNature = ref(WORK);
  const selectedProject = ref('');
  const trackerProject = selectedProject;
  const trackerNature = selectedNature;
  // When the tracker was started from a Planner block, its logged time is
  // recorded as a real Work Session against that block (feeds actual_hours).
  const trackerBlockName = ref(null);
  const startTime = ref(null);
  const currentUser = ref(session.user || 'hardiksharma80912@gmail.com');
  const currentUserFullName = ref(session.user_fullname || 'Hardik Sharma');
  const isClient = ref(session.is_client || false);
  const csrfToken = session.csrf_token || (window.OMNITRACK_SESSION && window.OMNITRACK_SESSION.csrf_token) || '';
  // Frappe hides the real reason inside _server_messages, a JSON array of JSON.
  const _errText = (err) => {
    let raw = (err && err.message) || String(err || '');
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) {
        const first = typeof list[0] === 'string' ? JSON.parse(list[0]) : list[0];
        raw = (first && first.message) || raw;
      }
    } catch (e) {}
    return String(raw).replace(/<[^>]*>/g, '').trim() || 'Request failed';
  };
  const flt = (v) => parseFloat(v) || 0;
  const extractErrorMessage = (err, fallback) => {
    const msg = err && typeof err.message === 'string' ? _errText(err) : '';
    return msg && msg !== 'Request failed' ? msg : fallback;
  };
  const postJSON = async (method, body) => {
    const res = await fetch('/api/method/omnitrack.api.' + method, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken
      },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // `_server_messages` is a JSON list of JSON objects with HTML in them; toasts need the text
      let msg = (data && data.message) || 'Request failed';
      try {
        msg = JSON.parse(data._server_messages).map((m) => { try { return JSON.parse(m).message; } catch { return m; } }).join(' ');
      } catch {}
      throw new Error(String(msg).replace(/<[^>]+>/g, ''));
    }
    return data.message;
  };
  // Default directly to the logged-in user's profile
  const selectedEmployee = ref(session.user_fullname || 'Hardik Sharma');
  const filterNature = ref('');
  const filterEmployee = ref('');
  const filterStatus = ref('');
  const timesheetHorizon = ref('week');
const todayDate = ref(getLocalTodayISO());
  // 4. Data Stores
  const workBlocks = ref([]);
  const _explicitBoundBlock = ref(null);
  const trackerBoundBlock = computed(() => {
    const nm = trackerBlockName.value;
    if (!nm) return null;
    if (_explicitBoundBlock.value && _explicitBoundBlock.value.name === nm) {
      return _explicitBoundBlock.value;
    }
    return (workBlocks.value || []).find((b) => b.name === nm) || null;
  });
  const projects = ref([]);
  const tasks = ref([]);
const assignedTasks = ref([]);
const attentionTasks = ref([]);
  // Attention & Planner Task filter state and computeds delegated to assignmentStore
  const openPlannerWithFilter = (filterType) => {
    if (filterType && filterType !== 'all') {
      plannerTaskFilter.value = filterType;
    }
    activeTab.value = 'planner';
  };
  const onAttentionTabKeydown = (e) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    const tablist = e.currentTarget;
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    const currentIdx = tabs.findIndex(t => t === document.activeElement);
    let nextIdx = 0;
    if (k === 'ArrowRight') {
      nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % tabs.length;
    } else if (k === 'ArrowLeft') {
      nextIdx = currentIdx < 0 ? tabs.length - 1 : (currentIdx - 1 + tabs.length) % tabs.length;
    } else if (k === 'Home') {
      nextIdx = 0;
    } else if (k === 'End') {
      nextIdx = tabs.length - 1;
    }
    const targetTab = tabs[nextIdx];
    if (targetTab) {
      targetTab.focus();
      const key = targetTab.getAttribute('data-attention-tab');
      if (key) attentionFilter.value = key;
    }
  };
  const onPlannerTaskTabKeydown = (e) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    const tablist = e.currentTarget;
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    const currentIdx = tabs.findIndex(t => t === document.activeElement);
    let nextIdx = 0;
    if (k === 'ArrowRight') {
      nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % tabs.length;
    } else if (k === 'ArrowLeft') {
      nextIdx = currentIdx < 0 ? tabs.length - 1 : (currentIdx - 1 + tabs.length) % tabs.length;
    } else if (k === 'Home') {
      nextIdx = 0;
    } else if (k === 'End') {
      nextIdx = tabs.length - 1;
    }
    const targetTab = tabs[nextIdx];
    if (targetTab) {
      targetTab.focus();
      const key = targetTab.getAttribute('data-planner-tab');
      if (key) plannerTaskFilter.value = key;
    }
  };
  // Roving Tabindex Grid Navigation for Attention Tasks (WCAG 2.2 AA)
  const attentionRovingRow = ref(0);
  const attentionRovingCol = ref(0);
  const setAttentionRoving = (r, c) => {
    attentionRovingRow.value = r;
    attentionRovingCol.value = c;
  };
  const attentionTabindex = (r, c) => {
    return (attentionRovingRow.value === r && attentionRovingCol.value === c) ? 0 : -1;
  };
  const focusAttentionCell = (targetRow, targetCol) => {
    const rows = visibleAttentionTasks.value || [];
    if (!rows.length) return;
    const r = Math.max(0, Math.min(targetRow, rows.length - 1));
    const c = Math.max(0, Math.min(targetCol, ATTENTION_LAST_COL));

    setAttentionRoving(r, c);
    nextTick(() => {
      const el = document.querySelector(`[data-attention-row="${r}"][data-attention-col="${c}"]`);
      if (el) {
        el.focus();
        if (el.scrollIntoView) {
          const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });
        }
      }
    });
  };
  const toggleShowAllAttentionTasks = () => {
    const wasCollapsed = !showAllAttentionTasks.value;
    showAllAttentionTasks.value = !showAllAttentionTasks.value;
    nextTick(() => {
      const rows = visibleAttentionTasks.value || [];
      if (!rows.length) return;
      // When clicking show more or show less, focus the last element that was visible in the collapsed view
      // so the user can immediately keep scrolling down with ArrowDown!
      const targetIndex = Math.min(ATTENTION_TASKS_COLLAPSED_LIMIT - 1, rows.length - 1);
      focusAttentionCell(Math.max(0, targetIndex), 0);
    });
  };
  const onAttentionGridKey = (ev, r, c) => {
    // Menu keys belong to the menu. The frappe-ui Dropdown portals its content,
    // so this guard only matters for an open trigger or a nested menu.
    if (ev.target && ev.target.closest && ev.target.closest('[role="menu"]')) return;
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute('aria-expanded') === 'true') return;

    const k = ev.key;
    if (k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') {
      return;
    }

    ev.preventDefault();

    const rows = visibleAttentionTasks.value || [];
    if (!rows.length) return;

    if (k === 'ArrowDown') {
      focusAttentionCell(r + 1, c);
    } else if (k === 'ArrowUp') {
      focusAttentionCell(r - 1, c);
    } else if (k === 'ArrowRight') {
      focusAttentionCell(r, c + 1);
    } else if (k === 'ArrowLeft') {
      focusAttentionCell(r, c - 1);
    } else if (k === 'Home') {
      if (ev.ctrlKey || ev.metaKey) {
        focusAttentionCell(0, 0);
      } else {
        focusAttentionCell(r, 0);
      }
    } else if (k === 'End') {
      const maxC = ATTENTION_LAST_COL;
      if (ev.ctrlKey || ev.metaKey) {
        focusAttentionCell(rows.length - 1, maxC);
      } else {
        focusAttentionCell(r, maxC);
      }
    }
  };
  const todayPlannedBlocks = computed(() => {
    return (workBlocks.value || []).filter(b => {
      const st = (b.status || '').toLowerCase();
      return st !== 'completed' && st !== 'cancelled';
    });
  });
  // ToDo Picker & Search actions delegated to assignmentStore
  const selectPlannedBlock = (b) => {
    bindSessionToBlock(b);
    todoDropdownOpen.value = false;
    todoSearchQuery.value = '';
  };
  const onTodoSearchEnter = () => {
    if (filteredOpenTodos.value.length > 0) {
      selectTodoToAutofill(filteredOpenTodos.value[0]);
    } else if (filteredPlannedBlocks.value.length > 0) {
      selectPlannedBlock(filteredPlannedBlocks.value[0]);
    } else if (showCustomOption.value) {
      selectCustomTitle();
    }
  };
  const clearSelectedTodo = () => {
    _explicitBoundBlock.value = null;
    trackerBlockName.value = null;
    trackerNotes.value = '';
    syncActiveSession();
    triggerHaptic([20]);
  };
  const bindSessionToBlock = (b) => {
    if (!b) {
      _explicitBoundBlock.value = null;
      trackerBlockName.value = null;
      syncActiveSession();
      triggerHaptic([20]);
      showToast('Unbound session from work block', 'info');
      return;
    }
    _explicitBoundBlock.value = b;
    trackerBlockName.value = b.name;
    const taskTitle = blockTitle(b, '');
    if (taskTitle) trackerNotes.value = taskTitle;
    if (b.project) {
      selectedProject.value = b.project;
      trackerProject.value = b.project;
    }
    if (b.task_nature) {
      const nat = getNatureBadge(b.task_nature).label;
      selectedNature.value = nat;
      trackerNature.value = nat;
    }
    syncActiveSession();
    triggerHaptic([25]);
    showToast(`Bound session to Work Block ${b.name}`, 'info');
  };
        const teamMembers = ref([
    { name: 'hardiksharma80912@gmail.com', full_name: 'Hardik Sharma', role: 'Lead Architect / Founder' },
    { name: 'Devoted NoMi', full_name: 'Nomeshwer Sharma', role: 'Operations Manager' },
    { name: 'Meenaxi Maxi', full_name: 'Meenaxi Maxi', role: 'Logistics & Field Lead' },
    { name: 'Misha Sharma', full_name: 'Misha Sharma', role: 'Admin & Finance Specialist' },
    { name: 'Alex Vance', full_name: 'Alex Vance', role: 'Principal Engineer' },
    { name: 'Tariq Nomi', full_name: 'Tariq Nomi', role: 'Operations Lead' },
    { name: 'Elena Rostova', full_name: 'Elena Rostova', role: 'Full-Stack Dev' },
    { name: 'Amara Okafor', full_name: 'Amara Okafor', role: 'Logistics Dispatcher' },
    { name: 'Sophia Patel', full_name: 'Sophia Patel', role: 'Backend Engineer' },
    { name: 'Administrator', full_name: 'Administrator', role: 'System Admin' }
  ]);
  const filteredTeamMembers = computed(() => {
    return teamMembers.value.filter(m => 
      (m.full_name || '').toLowerCase() !== (currentUserFullName.value || '').toLowerCase() &&
      (m.name || '').toLowerCase() !== (currentUser.value || '').toLowerCase()
    );
  });
  const synthesizerLogs = ref([]);
  const hourlyPresence = ref([0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 4, 3, 2, 5, 5, 6, 4, 1, 1, 1, 3, 3, 2, 0]);

  Object.assign(w, {
    showTrackerPopup,
    isTracking,
    trackerSeconds,
    trackerTimer,
    trackerNotes,
    selectedNature,
    selectedProject,
    trackerProject,
    trackerNature,
    trackerBlockName,
    startTime,
    currentUser,
    currentUserFullName,
    isClient,
    csrfToken,
    _errText,
    flt,
    extractErrorMessage,
    postJSON,
    selectedEmployee,
    filterNature,
    filterEmployee,
    filterStatus,
    timesheetHorizon,
    todayDate,
    workBlocks,
    _explicitBoundBlock,
    trackerBoundBlock,
    projects,
    tasks,
    assignedTasks,
    attentionTasks,
    openPlannerWithFilter,
    onAttentionTabKeydown,
    onPlannerTaskTabKeydown,
    attentionRovingRow,
    attentionRovingCol,
    setAttentionRoving,
    attentionTabindex,
    focusAttentionCell,
    toggleShowAllAttentionTasks,
    onAttentionGridKey,
    todayPlannedBlocks,
    selectPlannedBlock,
    onTodoSearchEnter,
    clearSelectedTodo,
    bindSessionToBlock,
    teamMembers,
    filteredTeamMembers,
    synthesizerLogs,
    hourlyPresence,
  });
}
