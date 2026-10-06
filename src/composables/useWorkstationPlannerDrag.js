import { ref, computed, watch } from "vue";

/**
 * Drag to reschedule and press-and-hold.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationPlannerDrag(w) {
  const { PLANNER_HOUR_PX, _mins, _utc, addDays, assignedTasks, attentionTasks, blockHeight, blockStyle, blockTop, hhmm, hideBlockHover, isBlockLocked, pickedTask, plannerAnchor, plannerData, plannerDays, plannerDrag, plannerRange, plannerView, postJSON, selectedEmployee, todayISO, triggerHaptic } = w;
  const openBlockDrawer = (...args) => w.openBlockDrawer(...args);

  // ---- Drag to reschedule / resize a block ---------------------------------
  const SNAP_MIN = 15;
  const _blockDragEndedAt = ref(0);
  const _snap = (m) => Math.round(m / SNAP_MIN) * SNAP_MIN;
  const _minsToHHMM = (m) => {
    m = ((_snap(m) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  const dragStyle = (b) => {
    const d = plannerDrag.value;
    if (d && d.name === b.name && d.moved) {
      const top = (d.curStart - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
      const h = Math.max(22, (d.curEnd - d.curStart) / 60 * PLANNER_HOUR_PX);
      return Object.assign(blockStyle(b), { top: top + 'px', height: h + 'px', zIndex: 40, opacity: '0.9', boxShadow: '0 8px 24px rgba(0,0,0,.25)' });
    }
    return Object.assign(blockStyle(b), { top: blockTop(b) + 'px', height: blockHeight(b) + 'px' });
  };
  const dragTimeLabel = (target) => {
    const d = plannerDrag.value;
    const b = target.block || target;
    if (d && d.name === b.name && d.moved) return _minsToHHMM(d.curStart) + '–' + _minsToHHMM(d.curEnd);
    if (target.is_segment) {
      if (target.segment_type === 'tail') return hhmm(b.start_time) + '–24:00';
      if (target.segment_type === 'head') return '00:00–' + hhmm(b.end_time);
    }
    return hhmm(b.start_time) + '–' + hhmm(b.end_time);
  };
  const onBlockDragMove = (ev) => {
    const d = plannerDrag.value; if (!d) return;
    const dy = ev.clientY - d.startY;
    const dx = ev.clientX - d.startX;
    if (!d.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) d.moved = true;
    const dMin = _snap(dy / PLANNER_HOUR_PX * 60);
    const dur = d.origEnd - d.origStart;
    if (d.mode === 'move') {
      let ns = Math.max(0, Math.min(1440 - dur, d.origStart + dMin));
      d.curStart = ns; d.curEnd = ns + dur;
      if ((plannerView.value === 'week' || plannerView.value === '4days') && d.colW > 0) {
        const dCol = Math.round(dx / d.colW);
        d.curDayIdx = Math.max(0, Math.min(plannerDays.value.length - 1, d.origDayIdx + dCol));
      }
    } else if (d.mode === 'resize-start') {
      d.curStart = Math.min(d.origEnd - SNAP_MIN, Math.max(0, d.origStart + dMin));
    } else {
      d.curEnd = Math.max(d.origStart + SNAP_MIN, Math.min(1440, d.origEnd + dMin));
    }
  };
  // `ev` is the event that ended the gesture. A pointercancel means the browser
  // took the pointer away (a system gesture, a palm, the page scrolling) — that is
  // an abort, never a reschedule, so the block must snap back unsaved.
  const endBlockDrag = async (ev) => {
    window.removeEventListener('pointermove', onBlockDragMove);
    window.removeEventListener('pointerup', endBlockDrag);
    window.removeEventListener('pointercancel', endBlockDrag);
    const d = plannerDrag.value;
    plannerDrag.value = null;
    holdArmed.value = '';
    if (d && d.el && d.el.style) d.el.style.touchAction = '';
    if (ev && ev.type === 'pointercancel') return;
    if (!d || !d.moved) return;
    _blockDragEndedAt.value = Date.now();
    const changed = d.curStart !== d.origStart || d.curEnd !== d.origEnd || d.curDayIdx !== d.origDayIdx;
    if (!changed) return;
    try {
      await postJSON('reschedule_work_block', {
        block_name: d.name,
        new_date: plannerDays.value[d.curDayIdx],
        new_start_time: _minsToHHMM(d.curStart),
        new_end_time: _minsToHHMM(d.curEnd),
      });
      await fetchPlannerData();
    } catch (e) {
      await fetchPlannerData();
      alert('Could not reschedule block: ' + (e && e.message || e));
    }
  };
  // ---- Press and hold to grab -------------------------------------------
  // A finger on a block is far more often a scroll than a reschedule, and the
  // same is true of a stray mouse-down. Nothing moves until the pointer has been
  // held still for a moment; any movement before that is left to the scroller.
  const HOLD_TOUCH_MS = 400;
  const HOLD_MOUSE_MS = 200;
  const HOLD_SLOP_PX = 8;
  const holdArmed = ref('');
        // name of the block currently grabbed
  let _pendingHold = null;
  const _pendingMove = (ev) => {
    if (!_pendingHold) return;
    if (Math.abs(ev.clientX - _pendingHold.x) > HOLD_SLOP_PX ||
        Math.abs(ev.clientY - _pendingHold.y) > HOLD_SLOP_PX) _cancelHold();
  };
  const _cancelHold = () => {
    if (!_pendingHold) return;
    clearTimeout(_pendingHold.timer);
    _pendingHold = null;
    window.removeEventListener('pointermove', _pendingMove);
    window.removeEventListener('pointerup', _cancelHold);
    window.removeEventListener('pointercancel', _cancelHold);
  };
  // Arms `run` once the pointer has been held still long enough.
  const _armOnHold = (ev, run) => {
    _cancelHold();
    const hold = ev.pointerType === 'touch' ? HOLD_TOUCH_MS : HOLD_MOUSE_MS;
    const x = ev.clientX, y = ev.clientY;
    _pendingHold = { x, y, timer: null };
    _pendingHold.timer = setTimeout(() => {
      _pendingHold = null;
      window.removeEventListener('pointermove', _pendingMove);
      window.removeEventListener('pointerup', _cancelHold);
      window.removeEventListener('pointercancel', _cancelHold);
      run(x, y);
    }, hold);
    window.addEventListener('pointermove', _pendingMove);
    window.addEventListener('pointerup', _cancelHold);
    window.addEventListener('pointercancel', _cancelHold);
  };
  const startBlockDrag = (ev, b, mode) => {
    if (b.status === 'Cancelled') return;
    if (isBlockLocked(b)) return;   // the past is read-only
    if (ev.button !== undefined && ev.button !== 0) return;
    const el = ev.currentTarget;
    const col = el.closest && el.closest('[data-day-col]');
    const pid = ev.pointerId;
    // A mouse grabs at once (a plain click still opens the block: the drag only
    // counts once it moves 3 px). A hold here lost the race to the browser's
    // native drag ghost whenever the mouse moved before the timer fired.
    if (ev.pointerType === 'mouse') {
      ev.preventDefault();
      _beginBlockDrag(b, mode, ev.clientX, ev.clientY, el, col, pid);
      return;
    }
    _armOnHold(ev, (x, y) => _beginBlockDrag(b, mode, x, y, el, col, pid));
  };
  const _beginBlockDrag = (b, mode, x, y, el, col, pid) => {
    const s = _mins(b.start_time);
    let e = _mins(b.end_time);
    if (e <= s) e = s + (parseFloat(b.duration_hours) || 1) * 60;
    const idx = plannerDays.value.indexOf(b.work_date);
    hideBlockHover();
    triggerHaptic([25]);
    holdArmed.value = b.name;
    // Only now does the element stop belonging to the scroller.
    const holder = (el && el.closest && el.closest('button')) || el;
    if (holder && holder.style) holder.style.touchAction = 'none';
    try { if (holder && pid !== undefined && holder.setPointerCapture) holder.setPointerCapture(pid); } catch (err) {}
    plannerDrag.value = {
      name: b.name, mode, el: holder,
      startX: x, startY: y,
      colW: col ? col.getBoundingClientRect().width : 0,
      origStart: s, origEnd: e, origDayIdx: idx,
      curStart: s, curEnd: e, curDayIdx: idx, moved: false,
    };
    window.addEventListener('pointermove', onBlockDragMove);
    window.addEventListener('pointerup', endBlockDrag, { once: true });
    window.addEventListener('pointercancel', endBlockDrag, { once: true });
  };
  const onBlockClick = (b) => {
    if (Date.now() - _blockDragEndedAt.value < 300) return; // just finished a drag
    openBlockDrawer(b);
  };
  const fetchPlannerData = async () => {
    try {
      const days = plannerDays.value;
      const sDate = days[0] || plannerAnchor.value;
      const eDate = days[days.length - 1] || plannerAnchor.value;
      const ws = days[0] || plannerAnchor.value;
      const empParam = selectedEmployee.value ? `&employee=${encodeURIComponent(selectedEmployee.value)}` : '';
      const url = `/api/method/omnitrack.api.get_planner_data?week_start=${ws}&start_date=${sDate}&end_date=${eDate}${empParam}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.message) {
        plannerData.value = data.message;
        if (data.message.assigned_tasks) assignedTasks.value = data.message.assigned_tasks;
        if (data.message.attention_tasks) attentionTasks.value = data.message.attention_tasks;
      }
    } catch (e) { console.error('planner fetch', e); }
  };
  const plannerShift = (dir) => {
    const delta = plannerView.value === 'day' ? 1 : (plannerView.value === '4days' ? 4 : 7);
    plannerAnchor.value = addDays(plannerAnchor.value, dir * delta);
    fetchPlannerData();
  };
  const plannerToday = () => { plannerAnchor.value = todayISO(); fetchPlannerData(); };
  watch(plannerView, () => fetchPlannerData());
  // Day and 4-day views can land on an empty day while the week around them is
  // full, which reads as "the planner is broken". Say it is empty, and offer the
  // nearest day that actually has work (the fetch already returns the week).
  const visibleBlockCount = computed(() => plannerDays.value.reduce(
    (n, d) => n + (plannerData.value.blocks || []).filter(b => b.work_date === d).length, 0));
  const nearestDayWithWork = computed(() => {
    if (visibleBlockCount.value) return '';
    const dates = [...new Set((plannerData.value.blocks || []).map(b => b.work_date).filter(Boolean))];
    if (!dates.length) return '';
    const a = plannerAnchor.value;
    const dist = (d) => Math.abs(_utc(d).getTime() - _utc(a).getTime());
    return dates.sort((x, y) => dist(x) - dist(y))[0];
  });
  const nearestDayWithWorkLabel = computed(() => nearestDayWithWork.value
    ? _utc(nearestDayWithWork.value).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '');
  const jumpToDayWithWork = () => {
    if (!nearestDayWithWork.value) return;
    plannerAnchor.value = nearestDayWithWork.value;
    fetchPlannerData();
  };
  const pickTask = (t) => { pickedTask.value = (pickedTask.value && pickedTask.value.ref === t.ref) ? null : t; };

  Object.assign(w, {
    dragStyle,
    dragTimeLabel,
    holdArmed,
    _armOnHold,
    startBlockDrag,
    onBlockClick,
    fetchPlannerData,
    plannerShift,
    plannerToday,
    visibleBlockCount,
    nearestDayWithWork,
    nearestDayWithWorkLabel,
    jumpToDayWithWork,
    pickTask,
  });
}
