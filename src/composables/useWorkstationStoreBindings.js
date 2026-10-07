import { lazy } from "./workstationBag.js";
import { ref, computed } from "vue";
import { isNonWorking, toKind } from '../utils/activity.js';
import { useWorkBlockStore } from "../stores/workBlockStore.js";
import { useAssignmentStore } from "../stores/assignmentStore.js";
import { useCollaborationStore } from "../stores/collaborationStore.js";

/**
 * Toasts and the collaboration/assignment/work-block store bindings.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationStoreBindings(w) {
  const { addDays, assignedTasks, attentionTasks, filterEmployee, filterNature, filterStatus, getLocalTodayISO, isManager, isTracking, postJSON, selectedEmployee, sessionNotesList, timesheetHorizon, todayDate, todayISO, todayPlannedBlocks, trackerBlockName, trackerSeconds, triggerHaptic, workBlocks } = w;
  const discardSession = (...args) => w.discardSession(...args);
  const fetchPlannerData = (...args) => w.fetchPlannerData(...args);
  const fetchWorkstationData = (...args) => w.fetchWorkstationData(...args);
  const isBlockLocked = (...args) => w.isBlockLocked(...args);
  const isPastBlock = (...args) => w.isPastBlock(...args);
  const toggleTrack = (...args) => w.toggleTrack(...args);
  const syncActiveSession = lazy(w, 'syncActiveSession');

  // 5. Toast Notifications
  // One toast at a time. `action` ({ label, onClick }) adds a button such as Undo; the timer
  // waits while the pointer or keyboard focus is on the toast, so the button stays reachable.
  const toast = ref({ show: false, message: '', type: 'info', action: null });
  let toastTimer = null;
  let toastLeft = 0;
  let toastSince = 0;
  const runToastTimer = (ms) => {
    clearTimeout(toastTimer);
    toastLeft = ms;
    toastSince = Date.now();
    toastTimer = setTimeout(() => { toast.value.show = false; }, ms);
  };
  const showToast = (message, type = 'info', { action = null, duration = 3500 } = {}) => {
    toast.value = { show: true, message, type, action };
    runToastTimer(duration);
  };
  const holdToast = () => {
    if (!toastTimer) return;
    clearTimeout(toastTimer);
    toastTimer = null;
    toastLeft = Math.max(0, toastLeft - (Date.now() - toastSince));
  };
  const releaseToast = () => { if (!toastTimer && toast.value.show) runToastTimer(Math.max(toastLeft, 1500)); };
  const runToastAction = () => {
    const a = toast.value.action;
    clearTimeout(toastTimer);
    toastTimer = null;
    toast.value.show = false;
    if (a && typeof a.onClick === 'function') a.onClick();
  };
  // Collaboration Domain Store Integration
  const collaborationStore = useCollaborationStore({ postJSON, showToast });
  const {
    showTaskRavenDrawer,
    ravenTask,
    ravenChannel,
    ravenMessages,
    ravenLoading,
    ravenChatSending,
    ravenChatInput,
    ravenActiveTab,
    ravenTaskSpec,
    ravenSavingSpec,
    ravenSprintRecaps,
    openTaskRavenDrawer,
    closeTaskRavenDrawer,
    openRavenApp,
    fetchTaskRavenDetails,
    sendRavenChatMessage,
  } = collaborationStore;
  // Assignment Domain Store Integration
  const assignmentStore = useAssignmentStore({
    assignedTasks,
    attentionTasks,
    todayDate,
    postJSON,
    showToast,
    fetchWorkstationData: (emp) => fetchWorkstationData(emp),
    selectedEmployee,
    todayPlannedBlocks,
    syncActiveSession: (force) => { if (typeof syncActiveSession === 'function') syncActiveSession(force); },
    triggerHaptic: (pattern) => { if (typeof triggerHaptic === 'function') triggerHaptic(pattern); },
    sessionStore: null
  });
  const {
    showAllAttentionTasks,
    ATTENTION_TASKS_COLLAPSED_LIMIT,
    attentionFilter,
    attentionSearch,
    plannerTaskFilter,
    plannerTaskSearch,
    overdueTasksCount,
    underplannedTasksCount,
    dueSoonTasksCount,
    filteredAttentionTasks,
    visibleAttentionTasks,
    remainingAttentionTasksCount,
    filteredPlannerTasks,
            setAttentionFilter,
    setPlannerTaskFilter,
    openTodos,
    todoDropdownOpen,
    todoSearchQuery,
    todoSearchInput,
    toggleTodoPicker,
    filteredOpenTodos,
    filteredPlannedBlocks,
    showCustomOption,
    selectTodoToAutofill,
    selectCustomTitle
  } = assignmentStore;
  const yesterdayDate = computed(() => addDays(todayDate.value || todayISO(), -1));
  // Work Block Domain Store Integration
  const workBlockStore = useWorkBlockStore({
    postJSON,
    showToast,
    fetchWorkstationData: (emp) => fetchWorkstationData(emp),
    fetchPlannerData: async () => { if (typeof fetchPlannerData === 'function') await fetchPlannerData(); },
    selectedEmployee,
    todayDate,
    yesterdayDate,
    isManager,
    sessionStore: null,
    isBlockLocked: (b) => { return typeof isBlockLocked === 'function' ? isBlockLocked(b) : false; },
    isPastBlock: (b) => { return typeof isPastBlock === 'function' ? isPastBlock(b) : false; },
    isTracking,
    trackerBlockName,
    currentElapsedSeconds: trackerSeconds,
    sessionNotesList,
    stopSessionRemote: async () => { if (typeof toggleTrack === 'function') await toggleTrack(); },
    discardSession: () => { if (typeof discardSession === 'function') discardSession(); },
    assignedTasks
  });
  const {
    calendarViewMode,
    plannerDate,
    plannerDateDisplay,
    calendarDays,
    showBookModal,
    bookForm,
    showCancelModal,
    cancelTargetBlock,
    cancelForm,
    cancelReasons
  } = workBlockStore;
  // Declarations hoisted above the first composable call (const TDZ: composables read these eagerly)
  // Dynamic Filtering of Work Blocks based on employee, nature, and status
  const filteredWorkBlocks = computed(() => {
    return workBlocks.value.filter(b => {
      // Employee / Permission Filter
      if (selectedEmployee.value !== 'All') {
        const empTarget = selectedEmployee.value.toLowerCase();
        const bEmp = (b.employee || '').toLowerCase();
        const bAssoc = (b.associate_name || '').toLowerCase();
        const bFull = (b.employee_full_name || '').toLowerCase();
        const targetFirst = empTarget.split(' ')[0];
        const targetMail = empTarget.split('@')[0];

        let match = false;
        if (empTarget.includes('hardik')) {
          match = bEmp.includes('hardik') || bAssoc.includes('hardik') || bEmp.includes('admin') || bAssoc.includes('eager');
        } else if (empTarget.includes('meenaxi')) {
          match = bEmp.includes('meenaxi') || bAssoc.includes('meenaxi');
        } else if (empTarget.includes('nomeshwer') || empTarget.includes('devoted')) {
          match = bEmp.includes('nomeshwer') || bAssoc.includes('devoted');
        } else {
          match = bEmp.includes(targetFirst) || bEmp.includes(targetMail) || 
                  bAssoc.includes(targetFirst) || bAssoc.includes(targetMail) ||
                  bFull.includes(targetFirst);
        }
        if (!match) return false;
      }

                // Toolbar filters
      if (filterNature.value) {
        // Planned or not is the block's flag; anything else names an activity
        const fNat = filterNature.value.toLowerCase();
        if (fNat === 'planned') { if (b.unplanned || isNonWorking(b.task_nature)) return false; }
        else if (fNat === 'unplanned') { if (!b.unplanned) return false; }
        else if (toKind(b.task_nature) !== toKind(fNat)) return false;
      }

      if (filterEmployee.value) {
        const fTarget = filterEmployee.value.toLowerCase().split(' ')[0];
        const bAssoc = (b.associate_name || b.employee || '').toLowerCase();
        if (!bAssoc.includes(fTarget)) return false;
      }

      if (filterStatus.value && b.status !== filterStatus.value) {
        return false;
      }

      // Timesheet Horizon Review Filter (Day / Week / Month / All)
      if (timesheetHorizon.value && timesheetHorizon.value !== 'all' && b.work_date) {
        const todayStr = getLocalTodayISO();
        if (timesheetHorizon.value === 'day') {
          if (b.work_date !== todayStr) return false;
        } else if (timesheetHorizon.value === 'week') {
          // Current week (Monday to Sunday)
          const nowD = new Date();
          const dayOfWeek = (nowD.getDay() + 6) % 7; // Monday = 0
          const mondayD = new Date(nowD);
          mondayD.setDate(nowD.getDate() - dayOfWeek);
          const sundayD = new Date(mondayD);
          sundayD.setDate(mondayD.getDate() + 6);
          const mStr = mondayD.toISOString().split('T')[0];
          const sStr = sundayD.toISOString().split('T')[0];
          if (b.work_date < mStr || b.work_date > sStr) return false;
        } else if (timesheetHorizon.value === 'month') {
          // Current calendar month YYYY-MM
          const ym = todayStr.substring(0, 7);
          if (!b.work_date.startsWith(ym)) return false;
        }
      }

      return true;
    });
  });
  const _minsOf = (t) => { if (!t) return -1; const p = String(t).split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); };
  const sessionNotesScroll = ref(null);
  const stopConfirmName = ref('');
  const discardConfirm = ref(false);
  const activeBlock = ref(null);
  const fmtHrs = (n) => {
    const v = Math.round((parseFloat(n) || 0) * 100) / 100;
    return (Math.abs(v % 1) < 0.005) ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, '');
  };
  const hhmm = (t) => {
    if (!t) return '';
    const p = String(t).split(':');
    const h = parseInt(p[0], 10);
    if (Number.isNaN(h)) return '';
    const m = parseInt(p[1], 10) || 0;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  Object.assign(w, {
    toast,
    showToast,
    holdToast,
    releaseToast,
    runToastAction,
    showTaskRavenDrawer,
    ravenTask,
    ravenChannel,
    ravenMessages,
    ravenLoading,
    ravenChatSending,
    ravenChatInput,
    ravenActiveTab,
    ravenTaskSpec,
    ravenSavingSpec,
    ravenSprintRecaps,
    openTaskRavenDrawer,
    closeTaskRavenDrawer,
    openRavenApp,
    fetchTaskRavenDetails,
    sendRavenChatMessage,
    showAllAttentionTasks,
    ATTENTION_TASKS_COLLAPSED_LIMIT,
    attentionFilter,
    attentionSearch,
    plannerTaskFilter,
    plannerTaskSearch,
    overdueTasksCount,
    underplannedTasksCount,
    dueSoonTasksCount,
    filteredAttentionTasks,
    visibleAttentionTasks,
    remainingAttentionTasksCount,
    filteredPlannerTasks,
    setAttentionFilter,
    setPlannerTaskFilter,
    openTodos,
    todoDropdownOpen,
    todoSearchQuery,
    todoSearchInput,
    toggleTodoPicker,
    filteredOpenTodos,
    filteredPlannedBlocks,
    showCustomOption,
    selectTodoToAutofill,
    selectCustomTitle,
    yesterdayDate,
    workBlockStore,
    calendarViewMode,
    plannerDate,
    plannerDateDisplay,
    calendarDays,
    showBookModal,
    bookForm,
    showCancelModal,
    cancelTargetBlock,
    cancelForm,
    cancelReasons,
    filteredWorkBlocks,
    _minsOf,
    sessionNotesScroll,
    stopConfirmName,
    discardConfirm,
    activeBlock,
    fmtHrs,
    hhmm,
  });
}
