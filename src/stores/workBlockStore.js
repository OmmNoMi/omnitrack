import * as Vue from "vue";
const { ref, computed } = Vue;

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
  discardSession
}) {
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
  const bookForm = ref({
    mode: 'work',
    work_item: '',
    work_date: '',
    start_time: '',
    end_time: '',
    deliverable_notes: '',
    pairing_partner: '',
    assigned_employee: ''
  });
  const bookFormTask = ref(null);
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

  const openBookModal = (iso, hour) => {
    const hh = String(hour).padStart(2, '0');
    const defaultAssignee = (isManager && isManager.value && selectedEmployee && selectedEmployee.value && selectedEmployee.value !== 'All') ? selectedEmployee.value : '';
    bookForm.value = {
      mode: 'work',
      work_item: '',
      work_date: iso,
      start_time: hh + ':00',
      end_time: String(Math.min(23, hour + 1)).padStart(2, '0') + ':00',
      deliverable_notes: '',
      pairing_partner: '',
      assigned_employee: defaultAssignee
    };
    showBookModal.value = true;
  };

  const submitBooking = async () => {
    const mode = bookForm.value.mode || 'work';
    const isAway = mode === '🌴 Leave';
    const isBreak = mode === 'break';
    if (!isAway && (!bookForm.value.start_time || !bookForm.value.end_time)) {
      showToast('Set a start and end time', 'danger');
      return;
    }
    plannerBusy.value = true;
    try {
      const picked = isAway ? null : (plannerData.value.assigned_tasks || []).find(t => t.ref === bookForm.value.work_item);
      const targetEmp = (isManager && isManager.value && bookForm.value.assigned_employee) ? bookForm.value.assigned_employee : (selectedEmployee && selectedEmployee.value !== 'All' ? selectedEmployee.value : null);
      const natureLabel = isAway ? '🌴 Leave' : (isBreak ? '☕ Break' : '🎯 Work');
      await postJSON('book_work_block', {
        work_date: bookForm.value.work_date,
        start_time: isAway ? '09:00' : bookForm.value.start_time,
        end_time: isAway ? '18:00' : bookForm.value.end_time,
        work_item: isAway ? null : (bookForm.value.work_item || null),
        task: picked && (picked.kind === 'Task' || !picked.ref.startsWith('todo:')) ? picked.ref : null,
        project: picked ? picked.project : null,
        work_item_label: picked ? picked.subject : (isAway ? '🌴 Leave' : (isBreak ? '☕ Break' : '🎯 Work')),
        task_nature: natureLabel,
        deliverable_notes: bookForm.value.deliverable_notes || natureLabel,
        pairing_partner: isAway ? null : (bookForm.value.pairing_partner || null),
        employee: targetEmp
      });
      showBookModal.value = false;
      showToast(isAway ? 'Leave marked' : (isBreak ? 'Break scheduled' : (bookForm.value.pairing_partner ? 'Collaborative work block paired & booked' : 'Work block booked')), 'success');
      if (fetchPlannerData) await fetchPlannerData();
      if (fetchWorkstationData) await fetchWorkstationData(selectedEmployee ? selectedEmployee.value : null);
    } catch (e) {
      showToast('Could not book block: ' + (e && e.message || e), 'danger');
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
    if (f.end_time <= f.start_time) {
      showToast('End time must be after the start time', 'danger');
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
    bookFormTask,
    showCancelModal,
    cancelTargetBlock,
    cancelForm,
    cancelReasons,
    plannerBusy,
    openBlockDrawer,
    closeBlockDrawer,
    openBookModal,
    submitBooking,
    submitReschedule,
    submitCancelBlock,
    openCancelModal,
    cancelActiveBlock
  };
}
