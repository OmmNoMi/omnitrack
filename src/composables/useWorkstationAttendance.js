import { ref, computed, watch } from "vue";
import { WORK, toKind } from "../utils/activity.js";
import { blockTitle } from '../utils/blockTitle.js';
import { composeWrapNote } from '../utils/wrapNote.js';
import { countSessionWords } from '../utils/sessionWords.js';
import { hoursMinutes } from '../utils/clockTime.js';

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
  // A block left unlogged is logged in its own entry box, where the person says what they did:
  // never the plan written in as the work under a stock note
  const logPendingBlock = (block) => {
    if (!block) return;
    showEODModal.value = false;
    w.openEditSessionModal(block);
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
  // 2c. Switch: one dialog, a route from what ends to what starts. A block's own Start knows what
  //     comes next and the dialog confirms it; the Switch button opens the same dialog asking
  //     what comes next. It closes only once the switch is made: refused, it says why in place
  //     and the session runs on, with the person's last line still in the field.
  const showSwitchConfirmModal = ref(false);
  const switchTargetItem = ref(null);
  const switchPick = ref(false);
  const switchError = ref('');
  const isSwitchingSession = ref(false);
  const switchWrapUpNote = ref('');
  const openSwitch = (target, pick) => {
    switchTargetItem.value = target;
    switchPick.value = pick;
    // The log is saved as it stands; this is only a last line for it
    switchWrapUpNote.value = '';
    switchError.value = '';
    showSwitchConfirmModal.value = true;
  };
  const promptSwitchSession = (target) => {
    if (!target) return;
    triggerHaptic([20]);
    openSwitch(target, false);
  };
  const openSwitchPicker = () => {
    if (isSessionElevated.value) isSessionElevated.value = false;
    openSwitch(null, true);
  };
  // A refusal is about what was there when Switch was pressed; an edit answers it
  watch([switchWrapUpNote, switchTargetItem], () => { switchError.value = ''; });
  // Words the session is saved with before the last line: its title and its log, as the server counts them
  const switchLogWords = computed(() => countSessionWords(composeWrapNote(trackerNotes.value, sessionNotesList.value)));
  const confirmSwitchAndStart = async () => {
    if (!switchTargetItem.value || isSwitchingSession.value) return;
    isSwitchingSession.value = true;
    try {
      if (await executeSwitchTask(switchTargetItem.value)) {
        showSwitchConfirmModal.value = false;
        switchTargetItem.value = null;
      }
    } finally {
      isSwitchingSession.value = false;
    }
  };
  // What the session can switch to: today's blocks not done yet, then the person's open tasks
  const switchCandidates = computed(() => {
    const curBlock = trackerBlockName.value;
    const blocks = ((plannerData.value && plannerData.value.blocks) || [])
      .filter(b => b.name !== curBlock && b.status !== 'Cancelled' && b.status !== 'Logged (Full)')
      .map(b => ({
        id: b.name,
        name: b.name,
        label: blockTitle(b, b.name),
        start_time: b.start_time,
        end_time: b.end_time,
        project: b.project,
        project_name: b.project_name,
        is_block: true,
        task_nature: b.task_nature
      }));
    const taskItems = (assignedTasks.value || []).map(t => ({
      id: t.name || t.id,
      name: t.name || t.id,
      label: t.subject || t.title || t.name,
      project: t.project,
      project_name: t.project_name,
      is_block: false,
      task_nature: WORK
    }));
    return [...blocks, ...taskItems];
  });
  // True once switched. A refusal leaves everything running and says why in switchError.
  const executeSwitchTask = async (target) => {
    triggerHaptic([30, 40]);
    const isBlock = !!target.is_block;
    const targetBlock = isBlock ? target.name : null;
    const targetTask = !isBlock ? target.name : null;
    const wrapNote = composeWrapNote(trackerNotes.value, sessionNotesList.value, switchWrapUpNote.value);
    switchError.value = '';
    let res;
    try {
      res = await postJSON('switch_active_session', {
        target_block: targetBlock,
        target_task: targetTask,
        current_session_notes: wrapNote,
        previous_block: trackerBlockName.value || null,
        start_time_ms: startTime.value || null,
        session_tasks: JSON.stringify(w.sessionTasks ? w.sessionTasks.value || [] : [])
      });
    } catch (err) {
      switchError.value = String((err && err.message) || err || '');
      return false;
    }
    const savedMin = Math.round(flt(res && res.elapsed_hours) * 60);
    showToast(savedMin ? `Saved ${hoursMinutes(savedMin)}. ${target.label} has started.` : `${target.label} has started.`, 'success');
    trackerSeconds.value = 0;
    startTime.value = Date.now();
    lastActivityTime.value = Date.now();
    lastInactivityAlertTime.value = 0;
    trackerBlockName.value = targetBlock;
    trackerNotes.value = target.label || '';
    sessionNotesList.value = [];
    if (w.sessionTasks) w.sessionTasks.value = [];
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
    return true;
  };
  Object.assign(w, {
    attendancePresence,
    fetchAttendancePresence,
    showEODModal,
    eodSummary,
    eodPendingBlocks,
    openEODWrapUpDrawer,
    logPendingBlock,
    trackBlock,
    showSwitchConfirmModal,
    switchTargetItem,
    switchPick,
    switchError,
    isSwitchingSession,
    switchWrapUpNote,
    switchLogWords,
    promptSwitchSession,
    confirmSwitchAndStart,
    openSwitchPicker,
    switchCandidates,
    executeSwitchTask,
  });
}
