import * as Vue from "vue";
const { ref, computed } = Vue;

export function useAssignmentStore({ assignedTasks, attentionTasks, todayDate, openBookModal, postJSON, showToast, fetchWorkstationData, selectedEmployee }) {
  const showAllAttentionTasks = ref(false);
  const ATTENTION_TASKS_COLLAPSED_LIMIT = 3;
  const attentionFilter = ref('all'); // 'all', 'overdue', 'underplanned', 'due_soon'
  const attentionSearch = ref('');

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
    }
  };

  const filteredOpenTodos = computed(() => {
    const q = (todoSearchQuery.value || '').trim().toLowerCase();
    if (!q) return openTodos.value;
    return openTodos.value.filter(t => {
      const subj = (t.subject || t.title || t.name || '').toLowerCase();
      const proj = (t.project_name || t.project || '').toLowerCase();
      return subj.includes(q) || proj.includes(q);
    });
  });

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
    overdueTasksCount,
    underplannedTasksCount,
    dueSoonTasksCount,
    filteredAttentionTasks,
    visibleAttentionTasks,
    remainingAttentionTasksCount,
    toggleShowAllAttentionTasks,
    setAttentionFilter,
    openTodos,
    todoDropdownOpen,
    todoSearchQuery,
    todoSearchInput,
    toggleTodoPicker,
    filteredOpenTodos,
    planAttentionTask
  };
}
