import { ref, computed } from "vue";
import { openTaskDetail } from "./useTaskForm.js";
import { snapMin, minuteAtX, pickedRange, rangeIntent, rangeHHMM } from "../utils/pickTimeRange.js";

/**
 * Range selection and collaboration drawer actions.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationPlannerSelect(w) {
  const { _armOnHold, _minToHHMM, activeBlock, bookForm, csrfToken, fetchPlannerData, isManager, isPastSlot, pickedTask, plannerBusy, plannerData, plannerHours, plannerRange, postJSON, ravenSavingSpec, ravenTask, ravenTaskSpec, selectedEmployee, showBookModal, showToast, slotSel, triggerHaptic, workBlockStore } = w;

  // --- drag across the grid to select a multi-hour range -------------------
  // A plain click still books a single hour; dragging sets the whole span.
  const SLOT_SNAP_MIN = 15;
  let _slotSelEndedAt = 0;
  const _snapMin = (m) => Math.round(m / SLOT_SNAP_MIN) * SLOT_SNAP_MIN;
  const _minFromPointer = (colEl, clientY) => {
    const r = colEl.getBoundingClientRect();
    const span = plannerHours.value.length * 60;
    const lo = plannerRange.value.lo * 60;
    const raw = lo + ((clientY - r.top) / (r.height || 1)) * span;
    return Math.max(lo, Math.min(lo + span, raw));
  };
  const slotSelRange = computed(() => {
    const s = slotSel.value;
    if (!s) return null;
    let a = Math.min(s.startMin, s.curMin);
    let b = Math.max(s.startMin, s.curMin);
    if (b - a < SLOT_SNAP_MIN) b = a + SLOT_SNAP_MIN;
    return { start: a, end: b };
  });
  const slotSelStyle = computed(() => {
    const r = slotSelRange.value;
    if (!r) return {};
    const lo = plannerRange.value.lo * 60;
    return { top: ((r.start - lo) / 60 * 44) + 'px', height: (((r.end - r.start) / 60) * 44) + 'px' };
  });
  const slotSelLabel = computed(() => {
    const r = slotSelRange.value;
    if (!r) return '';
    return _minToHHMM(r.start) + '–' + _minToHHMM(r.end);
  });
  const onSlotSelectMove = (ev) => {
    const s = slotSel.value;
    if (!s) return;
    if (Math.abs(ev.clientY - s.y0) > 4) s.moved = true;
    slotSel.value = { ...s, curMin: _snapMin(_minFromPointer(s.colEl, ev.clientY)) };
  };
  // Same rule as endBlockDrag: a cancelled pointer discards the range, it does
  // not open the booking modal behind the user's back.
  const endSlotSelect = (ev) => {
    window.removeEventListener('pointermove', onSlotSelectMove);
    window.removeEventListener('pointerup', endSlotSelect);
    window.removeEventListener('pointercancel', endSlotSelect);
    const s = slotSel.value;
    if (s && s.rowEl && s.rowEl.style) s.rowEl.style.touchAction = '';
    const range = slotSelRange.value;
    slotSel.value = null;
    if (ev && ev.type === 'pointercancel') return;
    if (!s || !s.moved || !range) return;   // no drag → let @click book the single hour
    _slotSelEndedAt = Date.now();
    openBookModalRange(s.iso, range.start, range.end);
  };
  const startSlotSelect = (ev, iso) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    const row = ev.currentTarget;
    const colEl = row.closest && row.closest('[data-day-col]');
    if (!colEl) return;
    const begin = (x, y) => {
      const m = _snapMin(_minFromPointer(colEl, y));
      if (row && row.style) row.style.touchAction = 'none';
      slotSel.value = { iso, colEl, rowEl: row, startMin: m, curMin: m, moved: false, y0: y };
      window.addEventListener('pointermove', onSlotSelectMove);
      window.addEventListener('pointerup', endSlotSelect, { once: true });
      window.addEventListener('pointercancel', endSlotSelect, { once: true });
    };
    // A mouse cannot scroll by dragging, so it draws a range straight away. The
    // old 200 ms hold cancelled itself when the mouse moved 8 px first, and the
    // browser's native text-drag ghost took over: drag "worked sometimes".
    // preventDefault stops that text selection; @click still books one hour.
    if (ev.pointerType === 'mouse') {
      ev.preventDefault();
      begin(ev.clientX, ev.clientY);
      return;
    }
    // Touch and pen: a swipe scrolls the grid, a held finger draws a range.
    _armOnHold(ev, (x, y) => { triggerHaptic([25]); begin(x, y); });
  };
  // A range picked on the calendar or on Day at a glance: time that has passed opens a log
  // entry for it, time still to come opens the Plan dialog (a plan never starts in the past).
  const PICK_REFUSED = {
    past: 'That time has passed. Drag on Logged to log it.',
    future: 'That time is still to come. Drag on Planned to plan it.'
  };
  const openPickedRange = (want, iso, range) => {
    const r = rangeIntent(want, range, iso, w.todayDate.value || w.todayISO(), w.nowMinute.value);
    if (r.refuse) { showToast(PICK_REFUSED[r.refuse], 'warning'); return; }
    if (r.kind === 'log') {
      w.quickLogTimelineGap({ session_date: iso, from_time: rangeHHMM(r.start), to_time: rangeHHMM(r.end) });
      return;
    }
    workBlockStore.openPlanDialog({ date: iso, start: rangeHHMM(r.start), end: rangeHHMM(r.end), work_item: pickedTask.value ? pickedTask.value.ref : '', askTask: true });
  };
  const openBookModalRange = (iso, startMin, endMin) => openPickedRange('auto', iso, { start: startMin, end: endMin });
  const openBookModal = (iso, hour) => {
    if (Date.now() - _slotSelEndedAt < 300) return; // a range drag just ended
    openPickedRange('auto', iso, { start: hour * 60, end: (hour + 1) * 60 });
  };
  // The ghost says which one letting go opens
  const slotSelIsLog = computed(() => {
    const s = slotSel.value;
    const r = slotSelRange.value;
    return !!(s && r && isPastSlot(s.iso, r.end));
  });

  // --- Day at a glance: press and drag along a lane to pick a stretch of the day -----------
  // The same gesture as the calendar grid. A mouse draws at once; a finger has to be held
  // still first, so a swipe still scrolls the page and the timeline as it always did.
  // Planned plans the stretch, Logged logs it. A click on an empty Planned lane plans that
  // hour, and a gap's own click still logs the whole gap.
  const timelineSel = ref(null);
  let _timelineSelEndedAt = 0;
  const _timelineDay = () => w.selectedDashboardDate.value || w.todayDate.value || w.todayISO();
  const _laneMin = (laneEl, x) => minuteAtX(x, laneEl.getBoundingClientRect());
  // Near either edge of the timeline, the day scrolls on under the pointer
  const _timelineEdgeScroll = (x) => {
    const sc = w.timelineScroller && w.timelineScroller.value;
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    if (x < r.left + 32) sc.scrollLeft -= 16;
    else if (x > r.right - 32) sc.scrollLeft += 16;
  };
  const timelineSelRange = computed(() => {
    const s = timelineSel.value;
    return s ? pickedRange(s.startMin, s.curMin) : null;
  });
  const timelineSelStyle = computed(() => {
    const r = timelineSelRange.value;
    if (!r) return {};
    return { left: (r.start / 1440 * 100) + '%', width: ((r.end - r.start) / 1440 * 100) + '%' };
  });
  const timelineSelLabel = computed(() => {
    const r = timelineSelRange.value;
    return r ? rangeHHMM(r.start) + '–' + (r.end >= 1440 ? '24:00' : rangeHHMM(r.end)) : '';
  });
  const onTimelineSelMove = (ev) => {
    const s = timelineSel.value;
    if (!s) return;
    _timelineEdgeScroll(ev.clientX);
    timelineSel.value = { ...s, moved: s.moved || Math.abs(ev.clientX - s.x0) > 4, curMin: snapMin(_laneMin(s.laneEl, ev.clientX)) };
  };
  // A cancelled pointer (the browser took the gesture for a scroll) discards the range
  const endTimelineSel = (ev) => {
    window.removeEventListener('pointermove', onTimelineSelMove);
    window.removeEventListener('pointerup', endTimelineSel);
    window.removeEventListener('pointercancel', endTimelineSel);
    const s = timelineSel.value;
    const range = timelineSelRange.value;
    timelineSel.value = null;
    if (ev && ev.type === 'pointercancel') return;
    if (!s || !s.moved || !range) return;
    _timelineSelEndedAt = Date.now();
    openPickedRange(s.lane === 'planned' ? 'plan' : 'log', s.iso, range);
  };
  const startTimelineSel = (ev, lane) => {
    if (ev.button !== undefined && ev.button !== 0) return;
    if (ev.target && ev.target.closest && ev.target.closest('[data-tl-bar]')) return; // a bar opens itself
    const laneEl = ev.currentTarget;
    const iso = _timelineDay();
    const begin = (x) => {
      const m = snapMin(_laneMin(laneEl, x));
      timelineSel.value = { lane, iso, laneEl, startMin: m, curMin: m, moved: false, x0: x };
      window.addEventListener('pointermove', onTimelineSelMove);
      window.addEventListener('pointerup', endTimelineSel, { once: true });
      window.addEventListener('pointercancel', endTimelineSel, { once: true });
    };
    if (ev.pointerType === 'mouse') {
      ev.preventDefault();
      begin(ev.clientX);
      return;
    }
    _armOnHold(ev, (x) => { triggerHaptic([25]); begin(x); });
  };
  // Once a held finger is drawing, its moves draw instead of scrolling. Until then this does
  // nothing, so a swipe that starts on the timeline scrolls exactly as before.
  const onTimelineTouchMove = (ev) => {
    if (timelineSel.value && ev.cancelable) ev.preventDefault();
  };
  // The calendar grid: a held finger drawing a range or moving a block draws, it does not scroll
  const onPlannerTouchMove = (ev) => {
    if ((slotSel.value || w.plannerDrag.value) && ev.cancelable) ev.preventDefault();
  };
  const onTimelineContextMenu = (ev) => {
    if (timelineSel.value) ev.preventDefault();
  };
  const _timelineSelJustEnded = () => Date.now() - _timelineSelEndedAt < 300;
  const clickTimelineGap = (g) => {
    if (_timelineSelJustEnded()) return;
    w.quickLogTimelineGap(g);
  };
  const clickPlannedLane = (ev) => {
    if (_timelineSelJustEnded() || ev.target !== ev.currentTarget) return;
    const h = Math.min(23, Math.floor(_laneMin(ev.currentTarget, ev.clientX) / 60));
    openPickedRange('plan', _timelineDay(), { start: h * 60, end: (h + 1) * 60 });
  };
  const submitBooking = async () => {
    await workBlockStore.submitBooking();
    if (!showBookModal.value) {
      pickedTask.value = null;
    }
  };
  const generateTimesheet = async (block) => {
    if (!block || !block.name) return;
    plannerBusy.value = true;
    try {
      const res = await postJSON('create_timesheet_from_work_block', { block_name: block.name, force: true });
      const tsName = res && (res.message || res.name || res);
      showToast(`ERPNext Timesheet ${tsName || ''} created for Project ${block.project_name || block.project || ''}`, 'success');
      await fetchPlannerData();
      const refreshed = (plannerData.value.blocks || []).find(x => x.name === block.name);
      if (refreshed) activeBlock.value = refreshed;
    } catch (e) {
      showToast('Could not create the ERPNext Timesheet: ' + (e && e.message || e), 'danger');
    } finally {
      plannerBusy.value = false;
    }
  };
  const rescheduleForm = ref({ work_date: '', start_time: '', end_time: '' });
  // Collaboration Drawer actions delegated to collaborationStore
  // A task opens its details panel first; its Edit opens the one task form
  const openTaskDetails = (task) => {
    openTaskDetail(task);
  };
  const taskConnectedBlocks = (task) => {
    if (!task) return [];
    const taskId = task.name || task.ref || task.id;
    const blocks = (plannerData.value && plannerData.value.blocks) || [];
    const found = blocks.filter(b => b.task === taskId || (b.task_subject && b.task_subject === task.subject));
    if (task.connected_blocks && Array.isArray(task.connected_blocks)) {
      task.connected_blocks.forEach(cb => {
        if (!found.some(f => f.name === cb.name)) found.push(cb);
      });
    }
    return found;
  };
  const pinRavenMessage = async (m) => {
    const taskId = ravenTask.value && (ravenTask.value.name || ravenTask.value.ref || ravenTask.value.id);
    if (!m || !taskId) return;
    try {
      const res = await postJSON('pin_task_spec', { task_id: taskId, message_id: m.name });
      if (res && res.status === 'success') {
        showToast('Pinned to living specification!', 'success');
        if (res.spec) {
          ravenTaskSpec.value = res.spec;
        }
      }
    } catch (e) {
      showToast('Failed to pin to spec: ' + (e && e.message || e), 'danger');
    }
  };
  const saveRavenTaskSpec = async () => {
    const taskId = ravenTask.value && (ravenTask.value.name || ravenTask.value.ref || ravenTask.value.id);
    if (!taskId || ravenSavingSpec.value) return;
    ravenSavingSpec.value = true;
    try {
      const res = await fetch('/api/method/frappe.client.set_value', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          doctype: 'Task',
          name: taskId,
          fieldname: 'description',
          value: ravenTaskSpec.value
        })
      });
      if (res.ok) {
        showToast('Specification saved successfully!', 'success');
        if (ravenTask.value) {
          ravenTask.value.description = ravenTaskSpec.value;
        }
      } else {
        throw new Error('Save failed');
      }
    } catch (e) {
      showToast('Failed to save spec: ' + (e && e.message || e), 'danger');
    } finally {
      ravenSavingSpec.value = false;
    }
  };

  Object.assign(w, {
    slotSelStyle,
    slotSelLabel,
    startSlotSelect,
    slotSelIsLog,
    openBookModalRange,
    timelineSel,
    timelineSelStyle,
    timelineSelLabel,
    startTimelineSel,
    onTimelineTouchMove,
    onPlannerTouchMove,
    onTimelineContextMenu,
    clickTimelineGap,
    clickPlannedLane,
    openBookModal,
    submitBooking,
    generateTimesheet,
    rescheduleForm,
    openTaskDetails,
    taskConnectedBlocks,
    pinRavenMessage,
    saveRavenTaskSpec,
  });
}
