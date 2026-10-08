/**
 * useWorkstationSessionModals Composable
 * Encapsulates modal dialogs: Empty session guard, Start time choice,
 * the one timesheet panel (add / edit / adjust / stop and log), Runaway timer guard,
 * and deleting a logged entry.
 */
import * as Vue from "vue";
import { whenLine, spanMins } from "../utils/clockTime.js";
import { newEntryTimes, entryEndMs } from "../utils/timesheetEntry.js";
import { composeWrapNote, logLines } from "../utils/wrapNote.js";
import { blockTitle } from '../utils/blockTitle.js';
import { countSessionWords, minSessionWords } from '../utils/sessionWords.js';
const { ref, computed } = Vue;

export function useWorkstationSessionModals(opts) {
  const {
    postJSON, showToast, isTracking, startTime, trackerSeconds, trackerTimer,
    trackerNotes, trackerBoundBlock, trackerBlockName, sessionNotesList,
    sessionHasLines, selectedNature, selectedProject, todayDate, todayISO,
    isSessionElevated, isManager, activeBlock, selectedEmployee,
    selectedDashboardDate, newSessionPoint, stopConfirmName, discardConfirm,
    toggleTrack, discardSession, appendSessionLine, syncActiveSession,
    recordUserActivity, checkInactivity, markSessionEnded, trackBlock,
    fetchWorkstationData, fetchPlannerData, getLocalTodayISO, hhmm,
    fmtHrs, flt, extractErrorMessage, _errText
  } = opts;

  // 1. Empty Session Stop Guard
  const showEmptyStopModal = ref(false);
  const emptyStopQuickNote = ref('');
  const emptyStopElapsedHrs = ref(0);
  // Words the session's title and log already hold, and how many a saved session needs
  const emptyStopLoggedWords = ref(0);
  const sessionMinWords = minSessionWords(typeof window !== 'undefined' ? window.OMNITRACK_SESSION : null);

  const openEmptyStopModal = () => {
    const elapsedSecs = trackerSeconds.value;
    emptyStopElapsedHrs.value = Math.max(0.01, Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100);
    emptyStopLoggedWords.value = countSessionWords(composeWrapNote(trackerNotes.value, sessionNotesList.value));
    // Never an invented note: the person says what they did
    emptyStopQuickNote.value = '';
    showEmptyStopModal.value = true;
  };

  const confirmEmptyStopDiscard = () => {
    showEmptyStopModal.value = false;
    discardConfirm.value = true;
    discardSession();
  };

  const confirmEmptyStopSave = () => {
    const note = String(emptyStopQuickNote.value || '').trim();
    if (emptyStopLoggedWords.value + countSessionWords(note) < sessionMinWords) return;
    showEmptyStopModal.value = false;
    appendSessionLine(note);
    toggleTrack();
  };

  const refuseEmptySession = () => { openEmptyStopModal(); };

  // 2. Start Time Choice Modal (Early / On-Time Protection)
  const showStartTimeChoiceModal = ref(false);
  const pendingStartBlock = ref(null);
  const pendingStartTimeOptions = ref([]);

  const parseBlockStartEpoch = (b) => {
    if (!b || !b.start_time) return null;
    const todayStr = getLocalTodayISO() || todayDate.value || new Date().toISOString().split('T')[0];
    if ((b.work_date || todayStr) !== todayStr) return null;
    const timeParts = String(b.start_time).split(':');
    if (timeParts.length < 2) return null;
    const d = new Date();
    d.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), parseInt(timeParts[2] || '0', 10), 0);
    return d.getTime();
  };

  const selectStartTimeChoice = (epoch) => {
    showStartTimeChoiceModal.value = false;
    if (pendingStartBlock.value) {
      const blk = pendingStartBlock.value;
      pendingStartBlock.value = null;
      if (typeof trackBlock === 'function') trackBlock(blk, epoch);
    }
  };

  // 3. Writing time by hand. add, edit and free open the session box people know from the timer
  //    (WorkSessionEntry), with its Log lines in form.log; live opens TimesheetEntryDialog:
  //    'add'  an entry against a block, for time already worked (never the block's future slot)
  //    'edit' a logged entry
  //    'free' a window with no block (a timeline gap, or Adjust with no clock running)
  //    'live' the running session: correct its start and keep going, or stop and log it
  const showEditSessionModal = ref(false);
  const isSavingEditSession = ref(false);
  const editSessionTargetBlock = ref(null);
  const editSessionForm = ref({ mode: 'add', name: '', session_date: '', from_time: '', to_time: '', notes: '' });

  const pad = (n) => String(n).padStart(2, '0');
  const clockOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const msOf = (day, hm) => {
    const [y, m, d] = String(day).split('-').map(Number);
    const [h, mi] = String(hm).split(':').map(Number);
    return new Date(y, m - 1, d, h, mi, 0).getTime();
  };
  const withSeconds = (t) => (t && t.length === 5 ? t + ':00' : t);
  // The old Adjust dialog saved the session's lines back into its notes (with a bullet or a
  // tick), so the stop path logged them twice. Notes never repeat a line.
  const bare = (l) => String(l).replace(/^[\s•\u2713*-]+/, '').trim();
  const notesWithoutLines = (notes, lines) => {
    const known = new Set(lines.map(bare));
    return String(notes).split('\n').filter(l => bare(l) && !known.has(bare(l))).join('\n');
  };

  const openPanel = (form, block = null) => {
    // The elevated session card sits above dialogs; lower it so the panel is never covered
    if (isSessionElevated.value) {
      isSessionElevated.value = false;
    }
    editSessionTargetBlock.value = block;
    editSessionForm.value = {
      mode: 'add', name: '', block_title: '', block_when: '', started_at: '', lines: 0, notes: '',
      // A free entry starts from the last Project and Activity picked, unless a session is
      // running: then those are the running session's, and this entry is not that session
      log: [], project: isTracking.value ? '' : (selectedProject.value || ''),
      nature: isTracking.value ? 'Work' : (selectedNature.value || 'Work'), ...form
    };
    showEditSessionModal.value = true;
  };

  const openEditSessionModal = (block, session = {}) => {
    const fresh = session.name ? null : newEntryTimes(block);
    openPanel({
      mode: session.name ? 'edit' : 'add',
      name: session.name || '',
      block_title: block ? blockTitle(block, '') : '',
      block_when: block ? whenLine(block.work_date, block.start_time, block.end_time) : '',
      session_date: fresh ? fresh.date : (session.session_date || todayISO()),
      from_time: fresh ? fresh.from : hhmm(session.from_time || ''),
      to_time: fresh ? fresh.to : hhmm(session.to_time || ''),
      // The saved notes back as the Log lines they were written as (composeWrapNote on save)
      log: logLines(session.notes || '', block ? blockTitle(block, '') : '')
    }, block);
  };

  // The session box's Adjust: the running session, or the last hour when nothing runs.
  // capMinutes (the runaway guard) proposes an end that many minutes after the start.
  const openAdjustModal = (opt = {}) => {
    const now = new Date();
    if (!isTracking.value) {
      const from = new Date(now.getTime() - 3600 * 1000);
      openPanel({ mode: 'free', session_date: dayOf(from), from_time: clockOf(from), to_time: clockOf(now) });
      return;
    }
    const start = new Date(Number(startTime.value) || (Date.now() - trackerSeconds.value * 1000));
    const cap = opt && opt.capMinutes ? new Date(Math.min(now.getTime(), start.getTime() + opt.capMinutes * 60000)) : now;
    const block = trackerBoundBlock.value;
    const lines = (sessionNotesList.value || []).filter(p => String(p).trim());
    openPanel({
      mode: 'live',
      block_title: block ? blockTitle(block, '') : '',
      started_at: clockOf(start),
      session_date: dayOf(start),
      from_time: clockOf(start),
      to_time: clockOf(cap),
      // The session's own lines stay as they are and are added when it is logged
      notes: notesWithoutLines(trackerNotes.value || '', lines),
      lines: lines.length
    }, block);
  };

  const quickLogTimelineGap = (gap) => {
    if (!gap) return;
    openPanel({
      mode: 'free',
      session_date: selectedDashboardDate.value || getLocalTodayISO(),
      from_time: gap.from_time.substring(0, 5),
      to_time: gap.to_time.substring(0, 5)
    });
  };

  // Moves the running clock's start (and its notes) without stopping it. The start goes on
  // startTime itself: syncActiveSession writes startTime back, so a start set only in
  // localStorage was overwritten by the very sync that followed it.
  const restartClockAt = (f) => {
    const ms = msOf(f.session_date, f.from_time);
    if (!(ms <= Date.now())) { showToast('The start cannot be in the future', 'warning'); return null; }
    startTime.value = ms;
    trackerSeconds.value = Math.floor((Date.now() - ms) / 1000);
    if (trackerTimer.value) clearInterval(trackerTimer.value);
    trackerTimer.value = setInterval(() => {
      trackerSeconds.value = Math.max(0, Math.floor((Date.now() - ms) / 1000));
      checkInactivity();
    }, 1000);
    trackerNotes.value = String(f.notes || '').trim();
    recordUserActivity();
    syncActiveSession(true);
    return ms;
  };

  const keepSessionRunning = () => {
    const f = editSessionForm.value;
    if (f.mode !== 'live' || !isTracking.value) return;
    if (restartClockAt(f) == null) return;
    showEditSessionModal.value = false;
    showToast(`Start set to ${f.from_time}. The clock keeps running.`, 'success');
  };

  // Stopping goes through the one stop path (toggleTrack), which logs against the bound
  // block or as a free entry, with the session's lines.
  const stopAndLogSession = async (f) => {
    if (!isTracking.value) return;
    if (restartClockAt(f) == null) return;
    const mins = spanMins(f.from_time, f.to_time);
    const end = entryEndMs(f.session_date, f.from_time, mins);
    showEditSessionModal.value = false;
    await toggleTrack(end < Date.now() ? end : null);
  };

  const applyBlockTotals = (res) => {
    if (!res || !activeBlock.value || res.name !== activeBlock.value.name) return;
    activeBlock.value.actual_hours = res.actual_hours;
    activeBlock.value.variance_hours = res.variance_hours;
    activeBlock.value.status = res.block_status;
    if (res.sessions) activeBlock.value.sessions = res.sessions;
  };
  const afterSave = (message, res) => {
    showToast(message, 'success');
    showEditSessionModal.value = false;
    applyBlockTotals(res);
    if (fetchPlannerData) fetchPlannerData();
    fetchWorkstationData(selectedEmployee.value);
  };
  // How far back is the server's call (its horizon is configurable); its refusal says why
  const writeEntry = async (f) => {
    const block = editSessionTargetBlock.value;
    // The Log's lines saved the way a stopped session saves them: its heading, then a bullet each
    const notes = composeWrapNote(f.block_title, f.log);
    const times = { session_date: f.session_date, from_time: withSeconds(f.from_time), to_time: withSeconds(f.to_time), notes };
    if (f.mode === 'edit') {
      const res = await postJSON('update_work_session', { session_name: f.name, block_name: block ? block.name : null, ...times });
      if (!res || res.status !== 'success') throw res;
      return afterSave('Work session saved', res);
    }
    if (f.mode === 'add' && block) {
      return afterSave('Work session added', await postJSON('log_work_session', { block_name: block.name, ...times }));
    }
    const mins = spanMins(f.from_time, f.to_time);
    // A free entry is filed under the Project and Activity picked in its own box, never the
    // running session's
    await postJSON('quick_timer_punch', {
      action: 'stop',
      work_date: f.session_date,
      from_time: times.from_time,
      to_time: times.to_time,
      duration_seconds: mins * 60,
      duration_hours: Math.round((mins / 60) * 100) / 100,
      work_nature: f.nature || 'Work',
      task_nature: f.nature || 'Work',
      deliverable_notes: notes,
      notes,
      project: f.project || null
    });
    afterSave('Work session added');
  };
  const saveEditSession = async () => {
    const f = editSessionForm.value;
    if (!f.session_date) { showToast('Pick the day you worked', 'warning'); return; }
    // A span past midnight is one session (23:30 to 00:30 is an hour), as spanMins reads it
    const mins = f.from_time && f.to_time ? spanMins(f.from_time, f.to_time) : 0;
    if (!(mins > 0)) { showToast('The end must be after the start', 'warning'); return; }
    // Time not worked yet is not a work session: it would be charged before it happened
    if (entryEndMs(f.session_date, f.from_time, mins) > Date.now() + 60000) { showToast('A work session cannot end after now. Start a session when the work begins.', 'warning'); return; }
    if (f.mode === 'live') return stopAndLogSession(f);
    if (!(f.log || []).length) { showToast('Add a line about what you got done', 'warning'); return; }
    isSavingEditSession.value = true;
    try {
      await writeEntry(f);
    } catch (e) {
      showToast(extractErrorMessage(e, 'Could not save this work session'), 'danger');
    } finally {
      isSavingEditSession.value = false;
    }
  };

  // 4. Runaway Timer Guard
  const showRunawayAlertModal = ref(false);
  const runawayGuardData = ref({ elapsed_hours: 0, suggested_cap_hours: 0, reason: '', started_at_str: '' });
  const runawayChoice = ref('keep'); // 'keep' | 'cap' | 'custom'

  const checkRunawayStopwatch = async () => {
    if (!isTracking.value || !startTime.value) return;
    try {
      const res = await postJSON('check_runaway_timer_guard', {
        start_ms: startTime.value,
        scheduled_duration_hours: trackerBoundBlock.value ? flt(trackerBoundBlock.value.duration_hours) : 0
      });
      if (res && res.is_runaway) {
        runawayGuardData.value = {
          elapsed_hours: res.elapsed_hours,
          suggested_cap_hours: res.suggested_cap_hours,
          reason: res.reason,
          started_at_str: new Date(res.start_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        runawayChoice.value = 'cap';
        showRunawayAlertModal.value = true;
      }
    } catch (err) {}
  };

  const resolveRunawayOption = (choice) => { runawayChoice.value = choice; };

  const confirmRunawayResolution = () => {
    showRunawayAlertModal.value = false;
    if (runawayChoice.value === 'keep') {
      showToast('Timer kept running. Remember to stop when done!', 'info');
    } else if (runawayChoice.value === 'cap') {
      // The panel opens on the running session with its end at the suggested cap
      openAdjustModal({ capMinutes: Math.round(flt(runawayGuardData.value.suggested_cap_hours || 2.0) * 60) });
    } else if (runawayChoice.value === 'custom') {
      openAdjustModal();
    }
  };


  // 5. Delete a logged entry
  const confirmDeleteSession = async (block, session) => {
    if (!session || !session.name) return;
    const timeLabel = session.from_time ? hhmm(session.from_time) + '–' + hhmm(session.to_time) : fmtHrs(session.hours) + 'h';
    if (!confirm(`Delete work session (${timeLabel})? This will update actual hours on this block.`)) return;
    try {
      const res = await postJSON('delete_work_session', {
        session_name: session.name,
        block_name: block ? block.name : null
      });
      if (res && res.status === 'success') {
        showToast('Work session deleted', 'info');
        fetchWorkstationData(selectedEmployee.value);
        applyBlockTotals(res);
      } else {
        showToast(extractErrorMessage(res, 'Failed to delete work session'), 'danger');
      }
    } catch (e) {
      showToast(extractErrorMessage(e, 'Failed to delete work session'), 'danger');
    }
  };

  return {
    showEmptyStopModal,
    emptyStopQuickNote,
    emptyStopElapsedHrs,
    emptyStopLoggedWords,
    sessionMinWords,
    openEmptyStopModal,
    confirmEmptyStopDiscard,
    confirmEmptyStopSave,
    refuseEmptySession,
    showStartTimeChoiceModal,
    pendingStartBlock,
    pendingStartTimeOptions,
    parseBlockStartEpoch,
    selectStartTimeChoice,
    showRunawayAlertModal,
    runawayGuardData,
    runawayChoice,
    checkRunawayStopwatch,
    resolveRunawayOption,
    confirmRunawayResolution,
    showEditSessionModal,
    isSavingEditSession,
    editSessionTargetBlock,
    editSessionForm,
    openEditSessionModal,
    openAdjustModal,
    quickLogTimelineGap,
    keepSessionRunning,
    saveEditSession,
    // Older names for the same panel, kept for callers outside this file
    showAdjustModal: showEditSessionModal,
    adjustForm: editSessionForm,
    applyAdjustedStartTime: keepSessionRunning,
    submitAdjustedTimesheet: saveEditSession,
    confirmDeleteSession
  };
}
