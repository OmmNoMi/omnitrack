/**
 * useWorkstationSessionModals Composable
 * The running session's guards and corrections, and writing time by hand: a Stop the log
 * cannot carry yet, Start time choice, the running session's Adjust, the entry panel (add /
 * edit / free), and deleting a logged entry.
 */
import * as Vue from "vue";
import { whenLine, spanMins } from "../utils/clockTime.js";
import { newEntryTimes, entryEndMs } from "../utils/timesheetEntry.js";
import { composeWrapNote, logLines } from "../utils/wrapNote.js";
import { blockTitle } from '../utils/blockTitle.js';
import { countSessionWords, minSessionWords } from '../utils/sessionWords.js';
const { ref, computed, watch, nextTick } = Vue;

export function useWorkstationSessionModals(opts) {
  const {
    postJSON, showToast, isTracking, startTime, trackerSeconds, trackerTimer,
    trackerNotes, trackerBoundBlock, trackerBlockName, sessionNotesList,
    sessionHasLines, selectedNature, selectedProject, todayDate, todayISO,
    isSessionElevated, activeTab, isManager, activeBlock, selectedEmployee,
    selectedDashboardDate, newSessionPoint, stopConfirmName, discardConfirm,
    toggleTrack, discardSession, appendSessionLine, syncActiveSession,
    recordUserActivity, checkInactivity, markSessionEnded, trackBlock,
    fetchWorkstationData, fetchPlannerData, getLocalTodayISO, hhmm,
    fmtHrs, extractErrorMessage, _errText
  } = opts;

  // 1. A Stop the log cannot carry yet. toggleTrack checks it before anything is torn down,
  //    and the session box asks for what is missing in place: its Log says how many words a
  //    saved session needs and how many there are, live, and the session keeps running until
  //    Stop is pressed again. Never a dialog over the box: one stacked on the Recording popup
  //    asked the same question the Log already asks.
  const sessionMinWords = minSessionWords(typeof window !== 'undefined' ? window.OMNITRACK_SESSION : null);
  const stopNeedsWords = ref(false);
  // Words the session holds now: its title, its lines, and a line still in the field (Stop adds it)
  const stopWordsNow = computed(() => {
    const draft = String((newSessionPoint && newSessionPoint.value) || '').trim();
    const lines = [...(sessionNotesList.value || []), ...(draft ? [draft] : [])];
    return countSessionWords(composeWrapNote(trackerNotes.value, lines));
  });
  const logIsEnough = () => {
    const draft = String((newSessionPoint && newSessionPoint.value) || '').trim();
    return (sessionHasLines.value || !!draft) && stopWordsNow.value >= sessionMinWords;
  };

  // The box is on screen inline on the dashboard and as the popup anywhere else
  const showSessionBox = () => {
    if (!isSessionElevated.value && !(activeTab && activeTab.value === 'dashboard')) isSessionElevated.value = true;
  };
  const refuseEmptySession = () => {
    stopNeedsWords.value = true;
    showSessionBox();
    // The Log tab, its field focused (and scrolled to): the words go there
    nextTick(() => {
      try { window.dispatchEvent(new CustomEvent('omnitrack:focus-session-input')); } catch (_) {}
    });
  };

  // 2. Start Time Choice Modal (Early / On-Time Protection)
  const showStartTimeChoiceModal = ref(false);
  const pendingStartBlock = ref(null);
  // The block's planned start, when the person starts it late: they say whether the session
  // runs from then or from now. Now is the default answer, it claims no time not tracked.
  const pendingStartMs = ref(0);

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

  // epoch: the planned start, or null for now (the moment the answer is given, not the moment
  // the question was asked)
  const selectStartTimeChoice = (epoch) => {
    showStartTimeChoiceModal.value = false;
    if (pendingStartBlock.value) {
      const blk = pendingStartBlock.value;
      pendingStartBlock.value = null;
      if (typeof trackBlock === 'function') trackBlock(blk, epoch);
    }
  };

  // 3. Writing time by hand opens the session box people know from the timer
  //    (WorkSessionEntry), with its Log lines in form.log:
  //    'add'  an entry against a block, for time already worked (never the block's future slot)
  //    'edit' a logged entry
  //    'free' a window with no block (a timeline gap, or Adjust with no clock running)
  //    The running session is never one of these: it is corrected in its own box (liveAdjust).
  const showEditSessionModal = ref(false);
  const isSavingEditSession = ref(false);
  const editSessionTargetBlock = ref(null);
  const editSessionForm = ref({ mode: 'add', name: '', session_date: '', from_time: '', to_time: '', notes: '' });
  // Why the last save was refused, said inside the box (role=alert) that keeps what was typed
  const editSessionError = ref('');

  const pad = (n) => String(n).padStart(2, '0');
  const clockOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const msOf = (day, hm) => {
    const [y, m, d] = String(day).split('-').map(Number);
    const [h, mi] = String(hm).split(':').map(Number);
    return new Date(y, m - 1, d, h, mi, 0).getTime();
  };
  const withSeconds = (t) => (t && t.length === 5 ? t + ':00' : t);

  const openPanel = (form, block = null) => {
    // The elevated session card sits above dialogs; lower it so the panel is never covered
    if (isSessionElevated.value) {
      isSessionElevated.value = false;
    }
    editSessionTargetBlock.value = block;
    editSessionError.value = '';
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

  // The running session's times, corrected where its clock is: Adjust turns the session box's
  // clock into the session's start and end (SessionControlsPane), with Cancel, Keep running
  // and Stop and log where Discard, Adjust and Stop sit. Never a second form: a sheet with its
  // own "What did you get done?" read as a work block's, and people took it for one.
  // { session_date, from_time, to_time, started_at } while open, null otherwise.
  const liveAdjust = ref(null);
  const cancelLiveAdjust = () => { liveAdjust.value = null; };

  // Adjust: the running session in its own box, or the last hour when nothing runs.
  // inPlace: asked from the box itself, which is already where the person is looking.
  const openAdjustModal = (opt = {}) => {
    const now = new Date();
    if (!isTracking.value) {
      const from = new Date(now.getTime() - 3600 * 1000);
      openPanel({ mode: 'free', session_date: dayOf(from), from_time: clockOf(from), to_time: clockOf(now) });
      return;
    }
    const start = new Date(Number(startTime.value) || (Date.now() - trackerSeconds.value * 1000));
    // endMs: an end already suggested (the still-working question's "15 min after your last activity")
    const cap = opt && opt.endMs ? new Date(Math.min(now.getTime(), Math.max(start.getTime(), opt.endMs))) : now;
    liveAdjust.value = {
      session_date: dayOf(start),
      from_time: clockOf(start),
      to_time: clockOf(cap),
      started_at: clockOf(start),
      // A suggested end is what the person came to check, so focus starts there
      focus: opt && opt.endMs ? 'end' : 'start'
    };
    if (!(opt && opt.inPlace)) showSessionBox();
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

  // Moves the running clock's start without stopping it. The start goes on
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
    recordUserActivity();
    syncActiveSession(true);
    return ms;
  };

  const keepSessionRunning = () => {
    const f = liveAdjust.value;
    if (!f || !isTracking.value) return;
    if (restartClockAt(f) == null) return;
    liveAdjust.value = null;
    showToast(`Start set to ${f.from_time}. The clock keeps running.`, 'success');
  };

  // Stopping goes through the one stop path (toggleTrack), which logs against the bound
  // block or as a free entry, with the session's lines. Everything that can refuse is checked
  // before the start moves, so a refusal leaves the session and the open times as they were.
  const stopAndLogSession = async () => {
    const f = liveAdjust.value;
    if (!f || !isTracking.value) return;
    const mins = f.from_time && f.to_time ? spanMins(f.from_time, f.to_time) : 0;
    if (!(mins > 0)) { showToast('The end must be after the start', 'warning'); return; }
    const end = entryEndMs(f.session_date, f.from_time, mins);
    if (end > Date.now() + 60000) { showToast('The end is after now. Keep running instead, or pick an earlier end.', 'warning'); return; }
    if (!logIsEnough()) { refuseEmptySession(); return; }
    if (restartClockAt(f) == null) return;
    liveAdjust.value = null;
    await toggleTrack(end < Date.now() ? end : null);
  };

  // A session that ends (stopped, discarded, or stopped on another device) takes its open
  // corrections with it
  watch(isTracking, (on) => {
    if (on) return;
    liveAdjust.value = null;
    stopNeedsWords.value = false;
  });

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
  // The server has the last word on which days can be logged (permissions.check_timesheet_date_permission)
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
    const refuse = (msg) => { editSessionError.value = msg; };
    editSessionError.value = '';
    if (!f.session_date) return refuse('Pick the day you worked.');
    // A span past midnight is one session (23:30 to 00:30 is an hour), as spanMins reads it
    const mins = f.from_time && f.to_time ? spanMins(f.from_time, f.to_time) : 0;
    if (!(mins > 0)) return refuse('The end must be after the start.');
    // Time not worked yet is not a work session: it would be charged before it happened
    if (entryEndMs(f.session_date, f.from_time, mins) > Date.now() + 60000) return refuse('A work session cannot end after now. Start a session when the work begins.');
    if (!(f.log || []).length) return refuse('Add a line about what you got done.');
    isSavingEditSession.value = true;
    try {
      await writeEntry(f);
    } catch (e) {
      // The box stays open with everything typed; the server's reason shows inside it
      refuse(extractErrorMessage(e, 'Not saved. Try again.'));
    } finally {
      isSavingEditSession.value = false;
    }
  };

  // 4. Delete a logged entry: one question in DeleteEntryDialog, never the browser's confirm().
  //    A refusal keeps the dialog open and says why inside it.
  const deleteEntry = ref(null);
  const deleteEntryError = ref('');
  const isDeletingEntry = ref(false);
  const confirmDeleteSession = (block, session) => {
    if (!session || !session.name) return;
    deleteEntryError.value = '';
    deleteEntry.value = { block: block || null, session };
  };
  const closeDeleteEntry = () => {
    if (isDeletingEntry.value) return;
    deleteEntry.value = null;
    deleteEntryError.value = '';
  };
  const deleteSessionEntry = async () => {
    const target = deleteEntry.value;
    if (!target || isDeletingEntry.value) return;
    isDeletingEntry.value = true;
    deleteEntryError.value = '';
    try {
      const res = await postJSON('delete_work_session', {
        session_name: target.session.name,
        block_name: target.block ? target.block.name : null
      });
      if (!res || res.status !== 'success') throw new Error((res && res.message) || 'Request failed');
      isDeletingEntry.value = false;
      closeDeleteEntry();
      showToast('Entry deleted', 'info');
      applyBlockTotals(res);
      fetchWorkstationData(selectedEmployee.value);
    } catch (e) {
      deleteEntryError.value = extractErrorMessage(e, 'Try again.');
    } finally {
      isDeletingEntry.value = false;
    }
  };

  return {
    sessionMinWords,
    stopNeedsWords,
    stopWordsNow,
    refuseEmptySession,
    showStartTimeChoiceModal,
    pendingStartBlock,
    pendingStartMs,
    parseBlockStartEpoch,
    selectStartTimeChoice,
    showEditSessionModal,
    isSavingEditSession,
    editSessionTargetBlock,
    editSessionForm,
    editSessionError,
    openEditSessionModal,
    openAdjustModal,
    liveAdjust,
    cancelLiveAdjust,
    keepSessionRunning,
    stopAndLogSession,
    quickLogTimelineGap,
    saveEditSession,
    confirmDeleteSession,
    deleteEntry,
    deleteEntryError,
    isDeletingEntry,
    closeDeleteEntry,
    deleteSessionEntry
  };
}
