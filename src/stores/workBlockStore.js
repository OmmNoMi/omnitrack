import * as Vue from "vue";
import { WORK, BREAK as ACTIVITY_BREAK, AWAY, toKind } from '../utils/activity.js';
// localISO, never toISOString(): that is the UTC date, a day behind in IST before 05:30
import { toMin, toHHMM, spanMins, localISO } from '../utils/clockTime.js';
const { ref, computed } = Vue;

// Planned Work Block.task_nature, the block's activity (src/utils/activity.js). PLANNED keeps
// its old name for callers; whether a block was planned is its `unplanned` flag, not this.
export const PLANNED = WORK;
export const BREAK = ACTIVITY_BREAK;
export const AWAY_NATURES = AWAY;

const isISODate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function useWorkBlockStore({
  postJSON,
  showToast,
  fetchWorkstationData,
  fetchPlannerData,
  selectedEmployee,
  todayDate,
  yesterdayDate,
  isManager,
  sessionStore,
  isBlockLocked,
  isPastBlock,
  isTracking,
  trackerBlockName,
  currentElapsedSeconds,
  sessionNotesList,
  stopSessionRemote,
  discardSession,
  assignedTasks
}) {
  // The planner's list when it has loaded, else the dashboard's (same get_assigned_tasks rows)
  const assignedWork = () => {
    const fromPlanner = (plannerData.value && plannerData.value.assigned_tasks) || [];
    return fromPlanner.length ? fromPlanner : ((assignedTasks && assignedTasks.value) || []);
  };
  const workBlocks = ref([]);
  const plannerData = ref({ totals: { block_count: 0 }, blocks: [], assigned_tasks: [], attention_tasks: [] });
  const calendarViewMode = ref('day');
  const plannerDate = ref('');
  const plannerDateDisplay = ref('');
  const calendarDays = ref([]);
  const hoverCard = ref(null);
  const activeBlock = ref(null);
  const showBlockDrawer = ref(false);
  const showBlockReschedule = ref(false);
  const showBlockManualLog = ref(false);
  const sessionForm = ref({ session_date: '', from_time: '', to_time: '', hours: '', notes: '' });
  const rescheduleForm = ref({ work_date: '', start_time: '', end_time: '' });

  const showBookModal = ref(false);
  // The ONE form for creating a Planned Work Block. Every entry point (calendar slot, drag
  // range, Dashboard "Plan", attention task) calls openPlanDialog(); nothing else assigns it.
  const blankPlanForm = () => ({
    nature: PLANNED,
    deliverable_notes: '',
    // Every task this block is for; the first is its main task (work_item mirrors it)
    work_items: [],
    work_item: '',
    work_item_label: '',
    // A task to create on save (the task step's "Create task"); book_work_block makes it
    new_task_subject: '',
    project: '',
    work_date: '',
    start_time: '',
    end_time: '',
    // A team session: everyone else whose calendar gets this block
    people: [],
    assigned_employee: '',
    // Open on the task step first (a calendar slot was picked; the time is already known)
    ask_task: false
  });
  const bookForm = ref(blankPlanForm());
  const showCancelModal = ref(false);
  const cancelTargetBlock = ref(null);
  const cancelForm = ref({
    reason: 'Client No-Show',
    notes: '',
    log_elapsed: true
  });
  const cancelReasons = ref([
    'Client No-Show',
    'Client Cancelled / Requested Reschedule',
    'Internal Priority Shift',
    'Blocked by Dependency',
    'Other'
  ]);
  const plannerBusy = ref(false);

  const openBlockDrawer = (b) => {
    activeBlock.value = b;
    showBlockReschedule.value = false;
    showBlockManualLog.value = false;
    sessionForm.value = {
      session_date: b.work_date,
      from_time: '',
      to_time: '',
      hours: '',
      notes: ''
    };
    rescheduleForm.value = {
      work_date: b.work_date || '',
      start_time: b.start_time ? String(b.start_time).substring(0, 5) : '',
      end_time: b.end_time ? String(b.end_time).substring(0, 5) : ''
    };
    showBlockDrawer.value = true;
  };

  const closeBlockDrawer = () => {
    showBlockDrawer.value = false;
    activeBlock.value = null;
  };

  /**
   * Open the plan dialog. Every field is optional:
   *   date ('YYYY-MM-DD'), start / end ('HH:MM'), hours (length when no end),
   *   work_item (assigned-work ref), notes, nature (task_nature Select value),
   *   askTask (start on the task step).
   */
  const openPlanDialog = (opts = {}) => {
    const today = (todayDate && todayDate.value) || localISO(new Date());
    const date = isISODate(opts.date) ? opts.date : today;
    let start = opts.start;
    if (!start) {
      // Today: the next quarter hour. Another day: the start of the working day.
      if (date === today) {
        const now = new Date();
        start = toHHMM(Math.min(23 * 60 + 45, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15));
      } else {
        start = '09:00';
      }
    }
    const end = opts.end || toHHMM(Math.min(24 * 60 - 1, toMin(start) + Math.round((opts.hours || 1) * 60)));
    const viewing = selectedEmployee && selectedEmployee.value;
    bookForm.value = {
      ...blankPlanForm(),
      nature: toKind(opts.nature),
      deliverable_notes: opts.notes || '',
      work_items: opts.work_item ? [opts.work_item] : [],
      work_item: opts.work_item || '',
      ask_task: !!opts.askTask && !opts.work_item,
      work_date: date,
      start_time: start,
      end_time: end,
      // A manager looking at a teammate's calendar plans for that teammate
      assigned_employee: (isManager && isManager.value && viewing && viewing !== 'All') ? viewing : ''
    };
    showBookModal.value = true;
  };

  const submitBooking = async () => {
    const f = bookForm.value;
    const nature = toKind(f.nature);
    const isAway = AWAY_NATURES.includes(nature);
    const isBreak = nature === BREAK;
    if (!f.start_time || !f.end_time) {
      showToast('Set a start and end time', 'danger');
      return;
    }
    // An end before the start is the next morning, as the server reads it
    if (spanMins(f.start_time, f.end_time) <= 0) {
      showToast('Set an end time that differs from the start', 'danger');
      return;
    }
    plannerBusy.value = true;
    try {
      const refs = isAway || isBreak ? [] : [...new Set((f.work_items || []).filter(Boolean))];
      const picked = refs.length ? (assignedWork().find(t => t.ref === refs[0]) || { ref: refs[0], subject: f.work_item_label || refs[0] }) : null;
      const people = isAway || isBreak ? [] : (f.people || []).filter(Boolean);
      const targetEmp = (isManager && isManager.value && f.assigned_employee) ? f.assigned_employee : (selectedEmployee && selectedEmployee.value !== 'All' ? selectedEmployee.value : null);
      const notes = (f.deliverable_notes || '').trim();
      const newTask = !isAway && !isBreak ? (f.new_task_subject || '').trim() : '';
      await postJSON('book_work_block', {
        work_date: f.work_date,
        start_time: f.start_time,
        end_time: f.end_time,
        work_item: picked ? picked.ref : null,
        work_items: refs,
        task: picked && !String(picked.ref).startsWith('todo:') ? picked.ref : null,
        project: picked ? (picked.project || null) : (f.project || null),
        // The Title typed here names the block; a picked task names it only when no title was typed
        work_item_label: notes || (picked ? picked.subject : newTask) || null,
        new_task_subject: newTask || null,
        task_nature: nature,
        deliverable_notes: notes || (picked && picked.subject) || newTask || nature,
        // The first person is the paired partner (linked both ways); the rest join as a team
        pairing_partner: people[0] || null,
        assignees: people.slice(1),
        employee: targetEmp
      });
      showBookModal.value = false;
      showToast(isAway ? 'Time away marked' : (isBreak ? 'Break planned' : (people.length ? `Planned for you and ${people.length === 1 ? '1 other' : people.length + ' others'}` : (newTask ? 'Task created and planned' : 'Time planned'))), 'success');
      if (fetchPlannerData) await fetchPlannerData();
      if (fetchWorkstationData) await fetchWorkstationData(selectedEmployee ? selectedEmployee.value : null);
    } catch (e) {
      showToast('Could not plan this time: ' + (e && e.message || e), 'danger');
    } finally {
      plannerBusy.value = false;
    }
  };

  const submitReschedule = async () => {
    if (!activeBlock.value) return;
    if (isBlockLocked && isBlockLocked(activeBlock.value)) {
      showToast('Planned work blocks in the past cannot be rescheduled', 'warning');
      return;
    }
    const f = rescheduleForm.value;
    if (!f.work_date || !f.start_time || !f.end_time) {
      showToast('Pick a date, a start and an end time', 'danger');
      return;
    }
    // An end before the start is the next morning, as the server reads it
    if (spanMins(f.start_time, f.end_time) <= 0) {
      showToast('Set an end time that differs from the start', 'danger');
      return;
    }
    plannerBusy.value = true;
    try {
      await postJSON('reschedule_work_block', {
        block_name: activeBlock.value.name,
        new_date: f.work_date,
        new_start_time: f.start_time,
        new_end_time: f.end_time
      });
      showToast('Block rescheduled', 'success');
      showBlockDrawer.value = false;
      if (fetchPlannerData) await fetchPlannerData();
      if (fetchWorkstationData) await fetchWorkstationData(selectedEmployee ? selectedEmployee.value : null);
    } catch (e) {
      showToast('Could not reschedule block: ' + (e && e.message || e), 'danger');
    } finally {
      plannerBusy.value = false;
    }
  };

  const openCancelModal = (block) => {
    if (!block) return;
    if (isPastBlock && isPastBlock(block)) {
      showToast('Planned work blocks in the past cannot be changed or cancelled', 'warning');
      return;
    }
    cancelTargetBlock.value = block;
    cancelForm.value = {
      reason: 'Client No-Show',
      notes: '',
      log_elapsed: isTracking && isTracking.value && trackerBlockName && trackerBlockName.value === block.name
    };
    showCancelModal.value = true;
  };

  const submitCancelBlock = async () => {
    if (!cancelTargetBlock.value) return;
    plannerBusy.value = true;
    try {
      const blk = cancelTargetBlock.value;
      const reason = cancelForm.value.reason;
      const notes = cancelForm.value.notes ? `Cancelled (${reason}): ${cancelForm.value.notes}` : `Cancelled (${reason})`;

      if (isTracking && isTracking.value && trackerBlockName && trackerBlockName.value === blk.name) {
        if (cancelForm.value.log_elapsed && currentElapsedSeconds && currentElapsedSeconds.value >= 30) {
          if (sessionNotesList && sessionNotesList.value && sessionNotesList.value.length === 0) {
            sessionNotesList.value.push(notes);
          }
          if (stopSessionRemote) await stopSessionRemote(false);
        } else {
          if (discardSession) discardSession();
        }
      }

      await postJSON('update_work_block', {
        block_name: blk.name,
        status: 'Cancelled',
        cancel_reason: reason
      });

      if (trackerBlockName && trackerBlockName.value === blk.name) {
        trackerBlockName.value = '';
      }

      showCancelModal.value = false;
      showBlockDrawer.value = false;
      showToast(`Block cancelled (${reason})`, 'info');
      if (fetchPlannerData) await fetchPlannerData();
      if (fetchWorkstationData) await fetchWorkstationData(selectedEmployee ? selectedEmployee.value : null);
    } catch (e) {
      showToast('Could not cancel block: ' + (e && e.message || e), 'danger');
    } finally {
      plannerBusy.value = false;
    }
  };

  const cancelActiveBlock = async () => {
    openCancelModal(activeBlock.value);
  };

  return {
    workBlocks,
    plannerData,
    calendarViewMode,
    plannerDate,
    plannerDateDisplay,
    calendarDays,
    hoverCard,
    activeBlock,
    showBlockDrawer,
    showBlockReschedule,
    showBlockManualLog,
    sessionForm,
    rescheduleForm,
    showBookModal,
    bookForm,
    showCancelModal,
    cancelTargetBlock,
    cancelForm,
    cancelReasons,
    plannerBusy,
    openBlockDrawer,
    closeBlockDrawer,
    openPlanDialog,
    submitBooking,
    submitReschedule,
    submitCancelBlock,
    openCancelModal,
    cancelActiveBlock
  };
}
