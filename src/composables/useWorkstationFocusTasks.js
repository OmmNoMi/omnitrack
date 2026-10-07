import { ref, computed } from "vue";
import { spanMins } from "../utils/clockTime.js";

/**
 * Focus tasks, deliverables and block cancellation.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationFocusTasks(w) {
  const { activeBlock, activeTab, assignedTasks, cancelTargetBlock, fetchPlannerData, fetchWorkstationData, hhmm, hideBlockHover, plannerBusy, plannerData, postJSON, projects, rescheduleForm, sessionNotesList, showBlockDrawer, showBlockReschedule, showToast, syncActiveSession, teamMembers, trackerBlockName, trackerBoundBlock, workBlockStore } = w;

  // ---- Focus Tasks & Connected Deliverables ----
  const showAttachTasksBox = ref(false);
  const newTaskPasteText = ref('');
  const selectedTaskToAttach = ref('');
  const isAttachingTasks = ref(false);
  const isReschedulingTasks = ref(false);
  const isTaskDone = (t) => {
    return Boolean(t && (t.status === 'Completed' || t.status === 'Closed'));
  };
  const getBlockTasksDoneCount = (b) => {
    if (!b || !b.tasks || !Array.isArray(b.tasks)) return 0;
    return b.tasks.filter(isTaskDone).length;
  };
  const isBlockTasksAllCompleted = (b) => {
    if (!b || !b.tasks || !b.tasks.length) return false;
    return b.tasks.every(isTaskDone);
  };
  const getUnfinishedTasksCount = (b) => {
    if (!b || !b.tasks || !Array.isArray(b.tasks)) return 0;
    return b.tasks.filter(t => !isTaskDone(t) && t.status !== 'Rescheduled').length;
  };
  const availableUnattachedTasks = computed(() => {
    if (!activeBlock.value) return [];
    const attachedRefs = new Set((activeBlock.value.tasks || []).map(t => t.ref || t.id));
    const allAssigned = assignedTasks.value || [];
    return allAssigned.filter(t => !attachedRefs.has(t.ref || t.id));
  });
  // Plan dialog task list: the planner's rows once loaded, else the dashboard's (same API rows)
  const comboboxBookTaskOptions = computed(() => {
    const fromPlanner = (plannerData.value && plannerData.value.assigned_tasks) || [];
    const list = fromPlanner.length ? fromPlanner : (assignedTasks.value || []);
    return list.filter(t => t.ref).map(t => ({
      value: t.ref,
      label: t.subject || t.ref,
      description: [t.project_name || t.project, t.due_date && 'due ' + t.due_date].filter(Boolean).join(' · '),
      project: t.project_name || t.project || '',
      due_date: t.due_date,
      is_overdue: !!t.is_overdue,
      is_due_today: !!t.is_due_today,
      days_overdue: t.days_overdue || 0,
      status: t.status || '',
      priority: t.priority || '',
      booked_hours: t.booked_hours,
      logged_hours: t.logged_hours,
      estimate_hours: t.estimate_hours
    }));
  });
  const comboboxAssigneeOptions = computed(() => {
    return (teamMembers.value || []).map(m => ({
      value: m.name || m.full_name,
      label: m.full_name,
      description: m.role || 'Team Member'
    }));
  });
  const comboboxProjectOptions = computed(() => {
    const list = (projects.value || []).map(p => ({
      value: p.name,
      label: p.project_name || p.name
    }));
    return [{ value: '', label: 'General Work' }, ...list];
  });
  const formatTaskTime = (dtStr) => {
    if (!dtStr) return '';
    try {
      const parts = dtStr.split(' ');
      if (parts.length > 1) {
        return parts[1].substring(0, 5);
      }
      return dtStr;
    } catch (e) {
      return dtStr;
    }
  };
  // A live session's log picks up what got done: one line, in the log only. trackerNotes is
  // the session's title, so nothing is appended to it.
  const logDone = (item) => {
    if (!(w.isTracking && w.isTracking.value)) return;
    const line = `Completed: ${item.subject || item.title || item.task}`;
    if (!sessionNotesList.value.includes(line)) {
      sessionNotesList.value.push(line);
      syncActiveSession();
    }
  };

  // ---- A running session's own tasks (before it has a block) ----
  // Shown with the same list as a block's tasks (BlockTasksSection), so it reads like a block
  const sessionTasks = w.sessionTasks;
  const liveSessionBlock = computed(() => ({
    name: 'live_active_session',
    is_live_active: true,
    is_session_tasks: true,
    employee: w.currentUser && w.currentUser.value,
    work_date: w.todayISO ? w.todayISO() : '',
    status: 'In Progress',
    task_subject: 'This session',
    tasks: sessionTasks.value,
  }));
  const sessionRow = (o) => ({
    id: String(o.ref).replace(/^todo:/, ''),
    ref: o.ref,
    doctype: String(o.ref).startsWith('todo:') ? 'ToDo' : (o.doctype || 'Task'),
    subject: o.subject || o.label || o.ref,
    project: o.project || null,
    status: 'Open',
    completed_at: null,
  });
  // Picked refs come from the task list; typed names become real ToDos at once, so each
  // one opens in the task form like any other
  const addSessionTasks = async (refs, newSubject) => {
    const have = new Set(sessionTasks.value.map((t) => t.ref));
    const opts = new Map((comboboxBookTaskOptions.value || []).map((o) => [o.value, o]));
    const rows = (refs || []).filter((r) => r && !have.has(r)).map((r) => sessionRow({ ref: r, ...(opts.get(r) || {}), subject: (opts.get(r) || {}).label }));
    const subject = String(newSubject || '').trim();
    if (subject) {
      const res = await postJSON('create_session_todos', { new_task_subjects: subject, project: w.selectedProject.value || null });
      for (const t of (res && res.tasks) || []) rows.push(sessionRow(t));
    }
    if (!rows.length) return 0;
    sessionTasks.value = [...sessionTasks.value, ...rows];
    // An untitled session takes its first task's name and project
    if (!String(w.trackerNotes.value || '').trim()) w.trackerNotes.value = rows[0].subject;
    if (!w.selectedProject.value && rows[0].project) {
      w.selectedProject.value = rows[0].project;
      if (w.trackerProject) w.trackerProject.value = rows[0].project;
    }
    syncActiveSession(true);
    return rows.length;
  };
  const removeSessionTask = (task) => {
    const ref = task && (task.ref || task.id);
    sessionTasks.value = sessionTasks.value.filter((t) => t.ref !== ref);
    syncActiveSession(true);
  };
  // The task form saved or moved a session task: keep its name and done state in step
  const onSessionTaskChange = (d) => {
    const ref = d.doctype === 'ToDo' ? 'todo:' + d.name : d.name;
    const row = sessionTasks.value.find((t) => t.ref === ref);
    if (!row) return;
    if (d.subject) row.subject = d.subject;
    const done = ['Completed', 'Closed', 'Done', 'Cancelled'].includes(d.status);
    if (done !== isTaskDone(row)) {
      row.status = done ? 'Completed' : 'Open';
      row.completed_at = done ? new Date().toISOString() : null;
      if (done) logDone(row);
    }
    syncActiveSession();
  };

  // The drawer's checkbox passes the state it shows (done); older callers just flip it.
  // Optimistic, and put back if the server refuses.
  const toggleTaskDone = async (block, item, done) => {
    if (!block || !item) return;
    const willBeDone = typeof done === 'boolean' ? done : !isTaskDone(item);
    // A running session with no block yet keeps the tick; Stop saves it on the new block
    if (block.is_session_tasks) {
      item.status = willBeDone ? 'Completed' : 'Open';
      item.completed_at = willBeDone ? new Date().toISOString() : null;
      if (willBeDone) logDone(item);
      syncActiveSession();
      return;
    }
    const before = { status: item.status, completed_at: item.completed_at };
    item.status = willBeDone ? (item.doctype === 'ToDo' ? 'Closed' : 'Completed') : 'Open';
    item.completed_at = willBeDone ? new Date().toISOString() : null;
    try {
      const res = await postJSON('complete_block_task', {
        block_name: block.name,
        task_ref: item.ref || item.id,
        completed: willBeDone ? 1 : 0
      });
      if (res && res.tasks) block.tasks = res.tasks;
      if (willBeDone) logDone(item);
      showToast(willBeDone ? 'Task marked done' : 'Task reopened', 'success');
    } catch (e) {
      Object.assign(item, before);
      showToast('Could not update task: ' + (e && e.message || e), 'danger');
    }
  };
  const submitAttachTasks = async (block) => {
    if (!block) return;
    isAttachingTasks.value = true;
    try {
      const taskRefs = selectedTaskToAttach.value ? [selectedTaskToAttach.value] : [];
      const res = await postJSON('attach_tasks_to_block', {
        block_name: block.name,
        task_refs: taskRefs.length ? taskRefs : null,
        new_task_subjects: newTaskPasteText.value.trim() ? newTaskPasteText.value.trim() : null
      });
      if (res && res.tasks) {
        block.tasks = res.tasks;
      }
      showToast('Tasks attached to block', 'success');
      newTaskPasteText.value = '';
      selectedTaskToAttach.value = '';
      showAttachTasksBox.value = false;
    } catch (e) {
      showToast('Could not attach tasks: ' + (e && e.message || e), 'danger');
    } finally {
      isAttachingTasks.value = false;
    }
  };
  const carryForwardUnfinished = async (block) => {
    if (!block) return;
    isReschedulingTasks.value = true;
    try {
      const res = await postJSON('reschedule_unfinished_tasks', {
        block_name: block.name
      });
      if (res && res.status === 'success') {
        showToast(`Carried forward ${res.rescheduled_count} items to next block (${res.new_block})`, 'success');
        await fetchWorkstationData();
        if (activeTab.value === 'planner') await fetchPlannerData();
        if (block.tasks) {
          block.tasks.forEach(t => {
            if (!isTaskDone(t)) {
              t.status = 'Rescheduled';
              t.rescheduled_to = res.new_block;
            }
          });
        }
      } else {
        showToast((res && res.message) || 'No unfinished items to carry forward', 'info');
      }
    } catch (e) {
      showToast('Could not carry forward tasks: ' + (e && e.message || e), 'danger');
    } finally {
      isReschedulingTasks.value = false;
    }
  };
  const openBlockDrawer = (b) => {
    hideBlockHover();
    activeBlock.value = b;
    showBlockReschedule.value = false;
    showAttachTasksBox.value = false;
    newTaskPasteText.value = '';
    selectedTaskToAttach.value = '';
    rescheduleForm.value = { work_date: b.work_date || '', start_time: hhmm(b.start_time) || '', end_time: hhmm(b.end_time) || '' };
    showBlockDrawer.value = true;
  };
  // One logged entry's details (the timeline's logged bar). The sheet fetches the rest itself.
  const showSessionDrawer = ref(false);
  const sessionEntry = ref(null);
  const openSessionDrawer = (block, session) => {
    hideBlockHover();
    sessionEntry.value = { block, session };
    showSessionDrawer.value = true;
  };
  // Same endpoint the planner drag uses, typed instead of dragged. The drawer's Reschedule
  // dialog sends its own form; the block is the drawer's (workBlockStore keeps a separate
  // activeBlock that the drawer never sets, so its submitReschedule was a silent no-op).
  const submitReschedule = async (form) => {
    const b = activeBlock.value;
    const f = form || rescheduleForm.value;
    if (!b || !f || !f.work_date || !f.start_time || !f.end_time) return false;
    if (spanMins(f.start_time, f.end_time) <= 0) { showToast('Set an end time that differs from the start', 'danger'); return false; }
    plannerBusy.value = true;
    try {
      await postJSON('reschedule_work_block', {
        block_name: b.name,
        new_date: f.work_date,
        new_start_time: f.start_time,
        new_end_time: f.end_time
      });
      const live = !!(w.isTracking && w.isTracking.value) && trackerBlockName.value === b.name;
      showToast(live ? 'Plan moved. Your session keeps running here until you stop it.' : 'Block rescheduled', 'success');
      showBlockDrawer.value = false;
      fetchPlannerData();
      fetchWorkstationData(w.selectedEmployee ? w.selectedEmployee.value : undefined);
      return true;
    } catch (e) {
      showToast('Could not reschedule block: ' + (e && e.message || e), 'danger');
      return false;
    } finally {
      plannerBusy.value = false;
    }
  };
  // Structured Block Cancellation & No-Show delegated to workBlockStore
  const openCancelModal = (block) => {
    workBlockStore.openCancelModal(block);
  };
  const openCancelModalForActive = () => {
    if (trackerBoundBlock.value) {
      openCancelModal(trackerBoundBlock.value);
    } else if (trackerBlockName.value) {
      const b = (plannerData.value.blocks || []).find(x => x.name === trackerBlockName.value);
      if (b) openCancelModal(b);
    }
  };
  const submitCancelBlock = async () => {
    await workBlockStore.submitCancelBlock();
    if (trackerBlockName.value && cancelTargetBlock.value && trackerBlockName.value === cancelTargetBlock.value.name) {
      trackerBlockName.value = '';
      trackerBoundBlock.value = null;
    }
  };
  const cancelActiveBlock = async () => {
    workBlockStore.cancelActiveBlock();
  };

  Object.assign(w, {
    showAttachTasksBox,
    newTaskPasteText,
    selectedTaskToAttach,
    isAttachingTasks,
    isReschedulingTasks,
    isTaskDone,
    getBlockTasksDoneCount,
    isBlockTasksAllCompleted,
    getUnfinishedTasksCount,
    availableUnattachedTasks,
    comboboxBookTaskOptions,
    comboboxAssigneeOptions,
    comboboxProjectOptions,
    formatTaskTime,
    toggleTaskDone,
    liveSessionBlock,
    addSessionTasks,
    removeSessionTask,
    onSessionTaskChange,
    submitAttachTasks,
    carryForwardUnfinished,
    openBlockDrawer,
    showSessionDrawer,
    sessionEntry,
    openSessionDrawer,
    submitReschedule,
    openCancelModal,
    openCancelModalForActive,
    submitCancelBlock,
    cancelActiveBlock,
  });
}
