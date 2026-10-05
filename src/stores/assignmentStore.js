import * as Vue from "vue";
const { ref, computed } = Vue;

export function useAssignmentStore({
  assignedTasks,
  attentionTasks,
  todayDate,
  openBookModal,
  postJSON,
  showToast,
  fetchWorkstationData,
  selectedEmployee,
  todayPlannedBlocks,
  syncActiveSession,
  triggerHaptic,
  sessionStore
}) {
  const showAllAttentionTasks = ref(false);
  const ATTENTION_TASKS_COLLAPSED_LIMIT = 3;
  const attentionFilter = ref('all'); // 'all', 'overdue', 'underplanned', 'due_soon'
  const attentionSearch = ref('');
  const plannerTaskFilter = ref('all');
  const plannerTaskSearch = ref('');

  const overdueTasksCount = computed(() => {
    return (attentionTasks.value || []).filter(t => t.days_overdue > 0 || (t.due_date && t.due_date < (todayDate ? todayDate.value : ''))).length;
  });

  const underplannedTasksCount = computed(() => {
    return (attentionTasks.value || []).filter(t => t.deficit_hours > 0 || t.is_underplanned || t.is_unplanned || (t.estimate_hours > 0 && t.booked_hours < t.estimate_hours) || (!t.booked_hours)).length;
  });

  const dueSoonTasksCount = computed(() => {
    return (attentionTasks.value || []).filter(t => t.is_due_today || t.is_due_tomorrow).length;
  });

  const filteredAttentionTasks = computed(() => {
    let list = attentionTasks.value || [];
    if (attentionFilter.value === 'overdue') {
      list = list.filter(t => t.days_overdue > 0 || (t.due_date && t.due_date < (todayDate ? todayDate.value : '')));
    } else if (attentionFilter.value === 'underplanned') {
      list = list.filter(t => t.deficit_hours > 0 || t.is_underplanned || t.is_unplanned || (t.estimate_hours > 0 && t.booked_hours < t.estimate_hours) || (!t.booked_hours));
    } else if (attentionFilter.value === 'due_soon') {
      list = list.filter(t => t.is_due_today || t.is_due_tomorrow);
    }

    if (attentionSearch.value.trim()) {
      const q = attentionSearch.value.trim().toLowerCase();
      list = list.filter(t =>
        (t.subject && t.subject.toLowerCase().includes(q)) ||
        (t.project_name && t.project_name.toLowerCase().includes(q)) ||
        (t.project && t.project.toLowerCase().includes(q)) ||
        (t.ref && t.ref.toLowerCase().includes(q))
      );
    }
    return list;
  });

  const visibleAttentionTasks = computed(() => {
    const list = filteredAttentionTasks.value;
    if (showAllAttentionTasks.value || list.length <= ATTENTION_TASKS_COLLAPSED_LIMIT) {
      return list;
    }
    return list.slice(0, ATTENTION_TASKS_COLLAPSED_LIMIT);
  });

  const remainingAttentionTasksCount = computed(() => {
    const total = filteredAttentionTasks.value.length;
    return Math.max(0, total - ATTENTION_TASKS_COLLAPSED_LIMIT);
  });

  const toggleShowAllAttentionTasks = () => {
    showAllAttentionTasks.value = !showAllAttentionTasks.value;
  };

  const setAttentionFilter = (val) => {
    attentionFilter.value = val;
  };

  const setPlannerTaskFilter = (val) => {
    plannerTaskFilter.value = val;
  };

  const filteredPlannerTasks = computed(() => {
    let list = assignedTasks.value || [];
    if (plannerTaskFilter.value === 'underplanned') {
      list = list.filter(t => t.is_underplanned || t.deficit_hours > 0 || (t.estimate_hours > 0 && t.booked_hours < t.estimate_hours) || (!t.booked_hours));
    } else if (plannerTaskFilter.value === 'overdue') {
      list = list.filter(t => t.days_overdue > 0 || (t.due_date && t.due_date < (todayDate ? todayDate.value : '')));
    } else if (plannerTaskFilter.value === 'high') {
      list = list.filter(t => t.priority === 'High' || t.priority === 'Urgent');
    }

    if (plannerTaskSearch.value.trim()) {
      const q = plannerTaskSearch.value.trim().toLowerCase();
      list = list.filter(t =>
        (t.subject && t.subject.toLowerCase().includes(q)) ||
        (t.project_name && t.project_name.toLowerCase().includes(q)) ||
        (t.ref && t.ref.toLowerCase().includes(q))
      );
    }
    return list;
  });

  // ToDos and ToDo Autofill Engine
  const openTodos = computed(() => {
    return (assignedTasks.value || []).filter(t => {
      if (t.is_todo || t.doctype === 'ToDo' || (t.ref && t.ref.startsWith('TD-'))) return true;
      if (t.type === 'ToDo' || t.item_type === 'todo') return true;
      return false;
    });
  });

  const todoDropdownOpen = ref(false);
  const todoSearchQuery = ref('');
  const todoSearchInput = ref(null);

  const toggleTodoPicker = () => {
    todoDropdownOpen.value = !todoDropdownOpen.value;
    if (todoDropdownOpen.value) {
      todoSearchQuery.value = '';
      Vue.nextTick(() => {
        if (todoSearchInput.value && todoSearchInput.value.focus) {
          todoSearchInput.value.focus();
        }
      });
    }
  };

  const filteredOpenTodos = computed(() => {
    const q = (todoSearchQuery.value || '').trim().toLowerCase();
    if (!q) return openTodos.value;
    return openTodos.value.filter(t => {
      const subj = (t.subject || t.title || t.name || '').toLowerCase();
      const proj = (t.project_name || t.project || '').toLowerCase();
      const prio = (t.priority || '').toLowerCase();
      return subj.includes(q) || proj.includes(q) || prio.includes(q);
    });
  });

  const filteredPlannedBlocks = computed(() => {
    const q = (todoSearchQuery.value || '').trim().toLowerCase();
    const blocks = todayPlannedBlocks ? todayPlannedBlocks.value : [];
    if (!q) return blocks;
    return blocks.filter(b => {
      const title = (b.task_subject || b.work_item_label || b.task || b.deliverable_notes || b.name || '').toLowerCase();
      const proj = (b.project_name || b.project || '').toLowerCase();
      return title.includes(q) || proj.includes(q);
    });
  });

  const showCustomOption = computed(() => {
    const q = (todoSearchQuery.value || '').trim();
    if (!q) return false;
    const qLower = q.toLowerCase();
    const matchesTodo = openTodos.value.some(t => (t.subject || t.title || t.name || '').toLowerCase() === qLower);
    const blocks = todayPlannedBlocks ? todayPlannedBlocks.value : [];
    const matchesBlock = blocks.some(b => (b.task_subject || b.work_item_label || b.task || '').toLowerCase() === qLower);
    return !matchesTodo && !matchesBlock;
  });

  const selectTodoToAutofill = (t) => {
    if (!t) return;
    if (sessionStore) {
      sessionStore.trackerBlockName.value = null;
      sessionStore.trackerNotes.value = t.subject || t.title || t.name || '';
      if (t.project) {
        sessionStore.selectedProject.value = t.project;
        sessionStore.trackerProject.value = t.project;
      }
      sessionStore.selectedNature.value = 'Planned Work';
      sessionStore.trackerNature.value = 'Planned Work';
      if (syncActiveSession) syncActiveSession();
    }
    todoDropdownOpen.value = false;
    todoSearchQuery.value = '';
    if (triggerHaptic) triggerHaptic([20]);
    if (showToast) showToast('Selected ToDo & auto-filled details', 'info');
  };

  const selectCustomTitle = () => {
    const q = (todoSearchQuery.value || '').trim();
    if (!q) return;
    if (sessionStore) {
      sessionStore.trackerBlockName.value = null;
      sessionStore.trackerNotes.value = q;
      if (syncActiveSession) syncActiveSession();
    }
    todoDropdownOpen.value = false;
    todoSearchQuery.value = '';
    if (triggerHaptic) triggerHaptic([20]);
  };

  const planAttentionTask = (task) => {
    if (openBookModal) {
      openBookModal(task);
    }
  };

  return {
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
    toggleShowAllAttentionTasks,
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
    planAttentionTask
  };
}
