import { ref, computed } from "vue";
import { WORK, toKind } from "../utils/activity.js";
import { blockTitle } from '../utils/blockTitle.js';
import { composeWrapNote } from '../utils/wrapNote.js';

/**
 * Attendance presence and block tracking.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationAttendance(w) {
  const { _explicitBoundBlock, assignedTasks, blockLogState, fetchWorkstationData, flt, getLocalTodayISO, getNatureBadge, isSessionElevated, isTracking, lastActivityTime, lastInactivityAlertTime, plannerData, postJSON, selectedDashboardDate, selectedEmployee, selectedNature, selectedProject, session, sessionNotesList, showToast, startTime, tasks, teamMembers, toggleTrack, trackerBlockName, trackerNature, trackerNotes, trackerProject, trackerSeconds, triggerHaptic, workFocusBlocks } = w;
  const fetchPlannerData = (...args) => w.fetchPlannerData(...args);

  // ==========================================
  // TIMESHEET CAPTURE PERFECTION SUITE (PILLARS 1-5)
  // ==========================================

  // Pillar 1: 1-Click Plan-to-Actuals Catch-Up
  const quickConvertPlanToActual = async (block) => {
    if (!block || !block.name) return;
    try {
      const res = await postJSON('convert_plan_to_actual', {
        block_name: block.name,
        session_notes: block.deliverable_notes || 'Completed as scheduled.'
      });
      showToast(`Logged ${res.actual_hours}h from the plan`, 'success');
      fetchWorkstationData(selectedEmployee.value);
      if (typeof fetchPlannerData === 'function') fetchPlannerData();
    } catch (err) {
      showToast('Failed to convert plan: ' + (err && err.message || err), 'danger');
    }
  };
  // Pillar 2: Attendance Presence Reconciliation
  const attendancePresence = ref(null);
  const fetchAttendancePresence = async () => {
    try {
      const emp = selectedEmployee.value || session.user;
      const dt = selectedDashboardDate.value || getLocalTodayISO();
      const res = await postJSON('get_attendance_presence_variance', {
        employee: emp,
        work_date: dt
      });
      if (res) attendancePresence.value = res;
    } catch (err) {}
  };
  // Pillar 5: EOD Wrap-Up Ritual & Reconciliation
  // A block is waiting to be logged only once it is over: one still ahead (or running) is not
  // "not logged", and logging its plan would claim time that has not happened.
  const isPendingLog = (b) => blockLogState(b) === 'none'
    && b.status !== 'Cancelled' && b.status !== 'Rescheduled'
    && w.isBlockConcluded(b);
  const showEODModal = ref(false);
  const eodSummary = computed(() => {
    const blocks = workFocusBlocks.value || [];
    const actualH = blocks.reduce((acc, b) => acc + flt(b.actual_hours || 0), 0);
    const unloggedBlocks = blocks.filter(isPendingLog);
    const unloggedH = unloggedBlocks.reduce((acc, b) => acc + flt(b.duration_hours || 0), 0);
    const curH = new Date().getHours();
    return {
      total_actual_hours: Math.round(actualH * 10) / 10,
      remaining_to_target: Math.max(0, Math.round((8.0 - actualH) * 10) / 10),
      blocks_count: blocks.length,
      unconverted_count: unloggedBlocks.length,
      unconverted_hours: Math.round(unloggedH * 10) / 10,
      is_eod_time: curH >= 16 // 4 PM or later
    };
  });
  const eodPendingBlocks = computed(() => {
    const blocks = workFocusBlocks.value || [];
    return blocks.filter(isPendingLog);
  });
  const openEODWrapUpDrawer = () => {
    showEODModal.value = true;
  };
  const convertAllPendingPlannedBlocks = async () => {
    const pending = eodPendingBlocks.value || [];
    if (!pending.length) {
      showToast('No unlogged planned blocks to convert.', 'info');
      return;
    }
    let converted = 0;
    for (const b of pending) {
      try {
        await postJSON('convert_plan_to_actual', {
          block_name: b.name,
          session_notes: b.deliverable_notes || 'Completed as scheduled.'
        });
        converted++;
      } catch (e) {}
    }
    showToast(`Logged ${converted} planned ${converted === 1 ? 'block' : 'blocks'}`, 'success');
    fetchWorkstationData(selectedEmployee.value);
    if (typeof fetchPlannerData === 'function') fetchPlannerData();
  };
  const trackBlock = (block, customStartMs = null) => {
    if (!block) return;
    if (isTracking.value && trackerBlockName.value !== block.name) {
      promptSwitchSession({
        id: block.name,
        name: block.name,
        label: blockTitle(block, block.name),
        project: block.project,
        project_name: block.project_name,
        is_block: true,
        task_nature: block.task_nature,
        work_date: block.work_date,
        start_time: block.start_time,
        end_time: block.end_time,
      });
      return;
    }
    _explicitBoundBlock.value = block;
    trackerBlockName.value = block.name;
    if (block.status === 'Completed' || block.status === 'Logged (Full)') {
      block.status = 'In Progress';
    }
    let rawN = blockTitle(block, '');
    if (rawN.includes('•')) {
      const parts = rawN.split('•').map(s => s.trim()).filter(Boolean);
      trackerNotes.value = parts[0] || '';
      sessionNotesList.value = parts.slice(1);
    } else {
      trackerNotes.value = rawN;
      sessionNotesList.value = [];
    }
    const proj = block.project || '';
    selectedProject.value = proj;
    trackerProject.value = proj;
    const nat = getNatureBadge(block.task_nature).label;
    selectedNature.value = nat;
    trackerNature.value = nat;
    toggleTrack(null, customStartMs);
  };
  // 2c. 1-Click Atomic Switch Task Action (WCAG 2.2 AA)
  const showSwitchTaskModal = ref(false);
  const showSwitchConfirmModal = ref(false);
  const switchTargetItem = ref(null);
  const isSwitchingSession = ref(false);
  const switchSearchQuery = ref('');
  const switchWrapUpNote = ref('');
  const promptSwitchSession = (target) => {
    if (!target) return;
    triggerHaptic([20]);
    switchTargetItem.value = target;
    // The log is saved as it stands; this is only an optional last line for it
    switchWrapUpNote.value = '';
    showSwitchConfirmModal.value = true;
  };
  const confirmSwitchAndStart = async () => {
    if (!switchTargetItem.value) return;
    const target = switchTargetItem.value;
    isSwitchingSession.value = true;
    try {
      await executeSwitchTask(target);
      showSwitchConfirmModal.value = false;
      switchTargetItem.value = null;
    } finally {
      isSwitchingSession.value = false;
    }
  };
  const openSwitchTaskModal = () => {
    if (isSessionElevated.value) isSessionElevated.value = false;
    switchSearchQuery.value = '';
    switchWrapUpNote.value = '';
    showSwitchTaskModal.value = true;
  };
  const switchCandidates = computed(() => {
    const q = (switchSearchQuery.value || '').toLowerCase().trim();
    const curBlock = trackerBlockName.value;
    const list = [];

    // 1. Candidate Planned Work Blocks for today
    const blocks = (plannerData.value && plannerData.value.blocks) || [];
    blocks.forEach(b => {
      if (b.name === curBlock) return;
      if (b.status === 'Cancelled' || b.status === 'Logged (Full)') return;
      const label = blockTitle(b, b.name);
      const sublabel = `${b.start_time || ''} – ${b.end_time || ''} · ${b.project || 'General'}`;
      if (!q || label.toLowerCase().includes(q) || (b.project || '').toLowerCase().includes(q)) {
        list.push({
          id: b.name,
          name: b.name,
          label,
          sublabel,
          project: b.project,
          is_block: true,
          task_nature: b.task_nature
        });
      }
    });

    // 2. Candidate Open Tasks
    const tasks = assignedTasks.value || [];
    tasks.forEach(t => {
      const label = t.subject || t.title || t.name;
      const sublabel = `Task · ${t.project || 'General'}`;
      if (!q || label.toLowerCase().includes(q) || (t.project || '').toLowerCase().includes(q)) {
        list.push({
          id: t.name || t.id,
          name: t.name || t.id,
          label,
          sublabel,
          project: t.project,
          is_block: false,
          task_nature: WORK
        });
      }
    });

    return list;
  });
  const executeSwitchTask = async (target) => {
    triggerHaptic([30, 40]);
    const isBlock = !!target.is_block;
    const targetBlock = isBlock ? target.name : null;
    const targetTask = !isBlock ? target.name : null;
    const wrapNote = composeWrapNote(trackerNotes.value, sessionNotesList.value, switchWrapUpNote.value);

    showSwitchTaskModal.value = false;
    showSwitchConfirmModal.value = false;
    try {
      const res = await postJSON('switch_active_session', {
        target_block: targetBlock,
        target_task: targetTask,
        current_session_notes: wrapNote,
        previous_block: trackerBlockName.value || null,
        start_time_ms: startTime.value || null
      });
      const loggedH = (res && res.elapsed_hours) ? `${res.elapsed_hours}h` : 'time';
      showToast(`Switched session! Logged ${loggedH} on previous session.`, 'success');
      trackerSeconds.value = 0;
      startTime.value = Date.now();
      lastActivityTime.value = Date.now();
      lastInactivityAlertTime.value = 0;
      trackerBlockName.value = targetBlock;
      trackerNotes.value = target.label || '';
      sessionNotesList.value = [];
      if (isBlock && targetBlock) {
        const foundB = (plannerData.value?.blocks || []).find(b => b.name === targetBlock);
        if (foundB) {
          _explicitBoundBlock.value = foundB;
          selectedProject.value = foundB.project || '';
          trackerProject.value = foundB.project || '';
          selectedNature.value = toKind(foundB.task_nature);
          trackerNature.value = toKind(foundB.task_nature);
        }
      }
      fetchWorkstationData(selectedEmployee.value);
      if (typeof fetchPlannerData === 'function') fetchPlannerData();
    } catch (err) {
      showToast('Failed to switch task: ' + (err && err.message || err), 'danger');
    }
  };
  Object.assign(w, {
    quickConvertPlanToActual,
    attendancePresence,
    fetchAttendancePresence,
    showEODModal,
    eodSummary,
    eodPendingBlocks,
    openEODWrapUpDrawer,
    convertAllPendingPlannedBlocks,
    trackBlock,
    showSwitchTaskModal,
    showSwitchConfirmModal,
    switchTargetItem,
    isSwitchingSession,
    switchSearchQuery,
    switchWrapUpNote,
    promptSwitchSession,
    confirmSwitchAndStart,
    openSwitchTaskModal,
    switchCandidates,
    executeSwitchTask,
  });
}
