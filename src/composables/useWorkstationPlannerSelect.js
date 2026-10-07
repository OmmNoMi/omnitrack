import { ref, computed } from "vue";
import { openTaskDetail } from "./useTaskForm.js";

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
  const pastBookingHint = ref('');
  const _rejectPast = (iso, endMin) => {
    if (!isPastSlot(iso, endMin)) return false;
    pastBookingHint.value = 'That slot is in the past — work blocks can only be booked from now on.';
    setTimeout(() => { pastBookingHint.value = ''; }, 3500);
    return true;
  };
  const openBookModalRange = (iso, startMin, endMin) => {
    if (_rejectPast(iso, endMin)) return;
    workBlockStore.openPlanDialog({ date: iso, start: _minToHHMM(startMin), end: _minToHHMM(endMin), work_item: pickedTask.value ? pickedTask.value.ref : '', askTask: true });
  };
  const openBookModal = (iso, hour) => {
    if (Date.now() - _slotSelEndedAt < 300) return; // a range drag just ended
    if (_rejectPast(iso, (hour + 1) * 60)) return;
    workBlockStore.openPlanDialog({ date: iso, start: _minToHHMM(hour * 60), end: _minToHHMM(Math.min(23 * 60 + 59, (hour + 1) * 60)), work_item: pickedTask.value ? pickedTask.value.ref : '', askTask: true });
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
    pastBookingHint,
    openBookModalRange,
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
