/**
 * useWorkstationSessionModals Composable
 * Encapsulates modal dialogs: Empty session guard, Start time choice,
 * Adjust timesheet timing, Runaway timer guard, and Edit/Delete session.
 */
import * as Vue from "vue";
const { ref, computed } = Vue;

export function useWorkstationSessionModals(opts) {
  const {
    postJSON, showToast, isTracking, trackerSeconds, trackerTimer,
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

  const openEmptyStopModal = () => {
    const elapsedSecs = trackerSeconds.value;
    emptyStopElapsedHrs.value = Math.max(0.01, Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100);
    const defaultNote = String(trackerNotes.value || '').trim() ||
      (trackerBoundBlock.value ? (trackerBoundBlock.value.work_item_label || trackerBoundBlock.value.task_subject || trackerBoundBlock.value.name) : '') ||
      'Focus work session';
    emptyStopQuickNote.value = defaultNote;
    showEmptyStopModal.value = true;
  };

  const confirmEmptyStopDiscard = () => {
    showEmptyStopModal.value = false;
    discardConfirm.value = true;
    discardSession();
  };

  const confirmEmptyStopSave = () => {
    const note = String(emptyStopQuickNote.value || '').trim() || 'Focus work session';
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

  // 3. Adjust Timesheet Timing & Backdating
  const showAdjustModal = ref(false);
  const adjustMode = ref('keep_running'); // 'keep_running' | 'stop_and_log'
  const originalStartTimeFormatted = ref('');
  const adjustForm = ref({
    work_date: getLocalTodayISO(),
    from_time: '09:00',
    to_time: '10:00',
    notes: ''
  });

  const minTimesheetDate = computed(() => {
    if (isManager.value) return '';
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  const adjustDurationMinutes = computed(() => {
    if (!adjustForm.value.from_time || !adjustForm.value.to_time) return 0;
    try {
      const [fh, fm] = adjustForm.value.from_time.split(':').map(Number);
      const [th, tm] = adjustForm.value.to_time.split(':').map(Number);
      let diff = (th * 60 + tm) - (fh * 60 + fm);
      if (diff < 0) diff += 1440;
      return diff;
    } catch (e) {
      return 0;
    }
  });

  const adjustDurationShort = computed(() => {
    const mins = adjustDurationMinutes.value;
    if (mins <= 0) return '0m';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? (m ? h + 'h ' + m + 'm' : h + 'h') : m + 'm';
  });

  const adjustDurationFormatted = computed(() => {
    const mins = adjustDurationMinutes.value;
    if (mins <= 0) return '0h 00m (0.00 hrs)';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const dec = (mins / 60).toFixed(2);
    return `${h}h ${String(m).padStart(2, '0')}m (${dec} hrs)`;
  });

  const keepRunningElapsedFormatted = computed(() => {
    if (!adjustForm.value.from_time) return '0m 00s';
    try {
      const [fh, fm] = adjustForm.value.from_time.split(':').map(Number);
      const parts = (adjustForm.value.work_date || todayDate.value).split('-').map(Number);
      const startMs = new Date(parts[0], parts[1] - 1, parts[2], fh, fm, 0).getTime();
      const diffSecs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const h = Math.floor(diffSecs / 3600), m = Math.floor((diffSecs % 3600) / 60), s = diffSecs % 60;
      const dec = (diffSecs / 3600).toFixed(2);
      if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s (${dec} hrs)`;
      return `${m}m ${String(s).padStart(2, '0')}s (${dec} hrs)`;
    } catch (e) {
      return '0m 00s';
    }
  });

  const openAdjustModal = () => {
        if (isSessionElevated.value) {
          isSessionElevated.value = false;
        }
    const pad = (n) => String(n).padStart(2, '0');
    const nowObj = new Date();
    let startObj = new Date();
    if (isTracking.value && trackerSeconds.value > 0) {
      startObj = new Date(Date.now() - (trackerSeconds.value * 1000));
      originalStartTimeFormatted.value = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())}`;
      adjustMode.value = 'keep_running';
    } else {
      startObj = new Date(Date.now() - 3600 * 1000);
      originalStartTimeFormatted.value = '';
      adjustMode.value = 'stop_and_log';
    }

    const work_date = `${startObj.getFullYear()}-${pad(startObj.getMonth() + 1)}-${pad(startObj.getDate())}`;
    const from_time = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())}`;
    const to_time = `${pad(nowObj.getHours())}:${pad(nowObj.getMinutes())}`;
    const rawTitle = (trackerNotes.value || '').trim();
    const bullets = (sessionNotesList.value || []).filter(p => p.trim()).map(p => `• ${p.trim()}`).join('\n');
    const notes = (rawTitle && bullets) ? `${rawTitle}\n\n${bullets}` : (rawTitle || bullets || '');

    adjustForm.value = { work_date, from_time, to_time, notes };
    showAdjustModal.value = true;
  };

  const nudgeAdjustTime = (field, deltaMinutes) => {
    const key = field === 'from' ? 'from_time' : 'to_time';
    const curVal = adjustForm.value[key] || '00:00';
    try {
      const [h, m] = curVal.split(':').map(Number);
      let totalMins = h * 60 + m + deltaMinutes;
      if (totalMins < 0) totalMins = (totalMins % 1440) + 1440;
      else if (totalMins >= 1440) totalMins = totalMins % 1440;
      const pad = (n) => String(n).padStart(2, '0');
      adjustForm.value[key] = `${pad(Math.floor(totalMins / 60))}:${pad(totalMins % 60)}`;
    } catch (e) {}
  };

  const setAdjustEndNow = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    adjustForm.value.to_time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const applyAdjustedStartTime = () => {
    if (!adjustForm.value.from_time) { showToast('Start time is required', 'warning'); return; }
    try {
      const [fh, fm] = adjustForm.value.from_time.split(':').map(Number);
      const parts = (adjustForm.value.work_date || todayDate.value).split('-').map(Number);
      const newStartMs = new Date(parts[0], parts[1] - 1, parts[2], fh, fm, 0).getTime();
      const nowMs = Date.now();
      if (newStartMs > nowMs) { showToast('Start time cannot be in the future for an ongoing session', 'warning'); return; }
      const newElapsedSecs = Math.max(0, Math.floor((nowMs - newStartMs) / 1000));
      trackerSeconds.value = newElapsedSecs;
      if (trackerTimer.value) clearInterval(trackerTimer.value);
      trackerTimer.value = setInterval(() => {
        trackerSeconds.value = Math.max(0, Math.floor((Date.now() - newStartMs) / 1000));
        checkInactivity();
      }, 1000);

      if (adjustForm.value.notes) trackerNotes.value = adjustForm.value.notes;
      recordUserActivity();
      const saved = localStorage.getItem('omnitrack_active_session');
      let activePayload = {};
      try { if (saved) activePayload = JSON.parse(saved); } catch (e) {}
      activePayload.startTime = newStartMs;
      activePayload.lastUpdated = Date.now();
      activePayload.lastActivityTime = Date.now();
      if (adjustForm.value.notes) activePayload.trackerNotes = adjustForm.value.notes;
      localStorage.setItem('omnitrack_active_session', JSON.stringify(activePayload));
      syncActiveSession(true);

      showAdjustModal.value = false;
      showToast(`Running clock updated: started at ${adjustForm.value.from_time} (${Math.round(newElapsedSecs / 60)}m elapsed)`, 'success');
    } catch (err) {
      showToast('Failed to adjust start time: ' + (err && err.message || err), 'danger');
    }
  };

  const submitAdjustedTimesheet = async () => {
    const targetDate = adjustForm.value.work_date || todayDate.value;
    if (!targetDate) { showToast('Session date is required', 'warning'); return; }
    if (!isManager.value && minTimesheetDate.value && targetDate < minTimesheetDate.value) {
      showToast(`Regular users can only log for today and yesterday (${minTimesheetDate.value}). Older dates require Manager role.`, 'danger');
      return;
    }
    if (adjustDurationMinutes.value <= 0) { showToast('Duration must be greater than 0 minutes', 'warning'); return; }
    if (!sessionHasLines.value && String(adjustForm.value.notes || '').trim().length < 3) {
      showToast('Describe what you did in the notes below before logging this time — an hour with no description cannot be justified to a manager or a client.', 'warning');
      return;
    }

    const hrs = Math.max(Math.round((adjustDurationMinutes.value / 60.0) * 100) / 100, 0.01);
    const fromTimeStr = adjustForm.value.from_time.length === 5 ? adjustForm.value.from_time + ':00' : adjustForm.value.from_time;
    const toTimeStr = adjustForm.value.to_time.length === 5 ? adjustForm.value.to_time + ':00' : adjustForm.value.to_time;
    const boundBlock = trackerBlockName.value;
    const finalNotes = (adjustForm.value.notes || '').trim() || `Adjusted focus session (${selectedNature.value})`;

    try {
      if (boundBlock) {
        await postJSON('log_work_session', {
          block_name: boundBlock,
          session_date: targetDate,
          from_time: fromTimeStr,
          to_time: toTimeStr,
          hours: hrs,
          notes: finalNotes,
          logged_via: 'Adjusted Stopwatch'
        });
        showToast(`Logged ${hrs.toFixed(2)}h against focus block`, 'success');
      } else {
        await postJSON('quick_timer_punch', {
          action: 'stop',
          work_date: targetDate,
          from_time: fromTimeStr,
          to_time: toTimeStr,
          duration_seconds: adjustDurationMinutes.value * 60,
          duration_hours: hrs,
          work_nature: selectedNature.value,
          task_nature: selectedNature.value,
          deliverable_notes: finalNotes,
          notes: finalNotes,
          project: selectedProject.value
        });
        showToast(`Logged ${hrs.toFixed(2)} hrs successfully!`, 'success');
      }

      isTracking.value = false;
      if (trackerTimer.value) clearInterval(trackerTimer.value);
      trackerTimer.value = null;
      trackerSeconds.value = 0;
      trackerBlockName.value = null;
      trackerNotes.value = '';
      sessionNotesList.value = [];
      newSessionPoint.value = '';
      stopConfirmName.value = '';
      markSessionEnded();
      localStorage.removeItem('omnitrack_active_session');
      postJSON('sync_active_session', { session_data: null }).catch(() => {});

      showAdjustModal.value = false;
      fetchWorkstationData(selectedEmployee.value);
      if (typeof fetchPlannerData === 'function') fetchPlannerData();
    } catch (err) {
      showToast('Not saved — the clock is still running. ' + (typeof _errText === 'function' ? _errText(err) : (err && err.message || err)), 'danger');
    }
  };

  // 4. Runaway Timer Guard & Gap Booking
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
      openAdjustModal();
      const capMins = Math.round(flt(runawayGuardData.value.suggested_cap_hours || 2.0) * 60);
      adjustDurationMinutes.value = capMins;
      adjustMode.value = 'stop_and_log';
      nudgeAdjustTime('to', 0);
    } else if (runawayChoice.value === 'custom') {
      openAdjustModal();
    }
  };

  const quickLogTimelineGap = (gap) => {
    if (!gap) return;
    adjustForm.value = {
      work_date: selectedDashboardDate.value || getLocalTodayISO(),
      from_time: gap.from_time.substring(0, 5),
      to_time: gap.to_time.substring(0, 5),
      notes: `Unplanned gap work (${gap.label})`
    };
    adjustMode.value = 'stop_and_log';
    showAdjustModal.value = true;
  };

  // 5. Edit & Delete Logged Work Sessions
  const showEditSessionModal = ref(false);
  const isSavingEditSession = ref(false);
  const editSessionTargetBlock = ref(null);
  const editSessionForm = ref({ name: '', session_date: '', from_time: '', to_time: '', notes: '' });

  const editSessionDuration = computed(() => {
    const f = editSessionForm.value.from_time;
    const t = editSessionForm.value.to_time;
    if (!f || !t) return '0.00';
    try {
      const [fh, fm] = f.split(':').map(Number);
      const [th, tm] = t.split(':').map(Number);
      let diff = (th * 60 + tm) - (fh * 60 + fm);
      if (diff < 0) diff += 1440;
      return (diff / 60).toFixed(2);
    } catch (e) {
      return '0.00';
    }
  });

  const openEditSessionModal = (block, session) => {
    editSessionTargetBlock.value = block;
    editSessionForm.value = {
      name: session.name || '',
      session_date: session.session_date || (block && block.work_date) || todayISO(),
      from_time: session.from_time ? hhmm(session.from_time) : '',
      to_time: session.to_time ? hhmm(session.to_time) : '',
      notes: session.notes || ''
    };
    showEditSessionModal.value = true;
  };

  const saveEditSession = async () => {
    if (!editSessionForm.value.name) return;
    if (!editSessionForm.value.session_date) { showToast('Session date is required', 'warning'); return; }
    if (!editSessionForm.value.from_time || !editSessionForm.value.to_time) {
      showToast('Start and end times are required', 'warning');
      return;
    }
    isSavingEditSession.value = true;
    try {
      const res = await postJSON('update_work_session', {
        session_name: editSessionForm.value.name,
        block_name: editSessionTargetBlock.value ? editSessionTargetBlock.value.name : null,
        session_date: editSessionForm.value.session_date,
        from_time: editSessionForm.value.from_time.length === 5 ? editSessionForm.value.from_time + ':00' : editSessionForm.value.from_time,
        to_time: editSessionForm.value.to_time.length === 5 ? editSessionForm.value.to_time + ':00' : editSessionForm.value.to_time,
        notes: editSessionForm.value.notes
      });
      if (res && res.status === 'success') {
        showToast('Work session updated successfully', 'success');
        showEditSessionModal.value = false;
        fetchWorkstationData(selectedEmployee.value);
        if (activeBlock.value && res.name === activeBlock.value.name) {
          activeBlock.value.actual_hours = res.actual_hours;
          activeBlock.value.variance_hours = res.variance_hours;
          activeBlock.value.status = res.block_status;
          if (res.sessions) activeBlock.value.sessions = res.sessions;
        }
      } else {
        showToast(extractErrorMessage(res, 'Failed to update work session'), 'danger');
      }
    } catch (e) {
      showToast(extractErrorMessage(e, 'Failed to update work session'), 'danger');
    } finally {
      isSavingEditSession.value = false;
    }
  };

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
        if (activeBlock.value && res.name === activeBlock.value.name) {
          activeBlock.value.actual_hours = res.actual_hours;
          activeBlock.value.variance_hours = res.variance_hours;
          activeBlock.value.status = res.block_status;
          if (res.sessions) activeBlock.value.sessions = res.sessions;
        }
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
    openEmptyStopModal,
    confirmEmptyStopDiscard,
    confirmEmptyStopSave,
    refuseEmptySession,
    showStartTimeChoiceModal,
    pendingStartBlock,
    pendingStartTimeOptions,
    parseBlockStartEpoch,
    selectStartTimeChoice,
    showAdjustModal,
    adjustMode,
    originalStartTimeFormatted,
    adjustForm,
    minTimesheetDate,
    adjustDurationMinutes,
    adjustDurationShort,
    adjustDurationFormatted,
    keepRunningElapsedFormatted,
    openAdjustModal,
    nudgeAdjustTime,
    setAdjustEndNow,
    applyAdjustedStartTime,
    submitAdjustedTimesheet,
    showRunawayAlertModal,
    runawayGuardData,
    runawayChoice,
    checkRunawayStopwatch,
    resolveRunawayOption,
    confirmRunawayResolution,
    quickLogTimelineGap,
    showEditSessionModal,
    isSavingEditSession,
    editSessionTargetBlock,
    editSessionForm,
    editSessionDuration,
    openEditSessionModal,
    saveEditSession,
    confirmDeleteSession
  };
}
