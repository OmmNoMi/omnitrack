import { ref, computed, watch, nextTick } from 'vue';
import { KINDS, toKind } from '../utils/activity.js';
import { noteHeading } from '../utils/wrapNote.js';

export function useWorkstationPlannerLayout(opts) {
  const {
    plannerData,
    plannerAnchor,
    todayDate,
    todayISO,
    getLocalTodayISO,
    addDays,
    _utcDate,
    _mins,
    _minToHHMM,
    nowMinute,
    isTracking,
    startTime,
    trackerBlockName,
    trackerNotes,
    trackerSeconds,
    selectedNature,
    selectedProject,
    sessionTasks,
    currentUser,
    plannerDrag,
    slotSel,
    plannerShift,
    blockStyle,
    _blockNature: customBlockNature
  } = opts;

  const PLANNER_HOUR_PX = 44;
  const plannerGridScroll = ref(null);
  const scrollPlannerToMorning = () => {
    nextTick(() => {
      if (!plannerGridScroll.value) return;
      const isToday = plannerAnchor.value === todayISO();
      if (isToday && nowMinute.value !== undefined) {
        const boxH = plannerGridScroll.value.clientHeight || (6 * PLANNER_HOUR_PX);
        const nowY = (nowMinute.value / 60) * PLANNER_HOUR_PX;
        plannerGridScroll.value.scrollTop = Math.max(0, nowY - (boxH / 2));
      } else {
        plannerGridScroll.value.scrollTop = 7 * PLANNER_HOUR_PX;
      }
    });
  };

  const userCustomizedPlannerView = ref(false);
  const getDeviceDefaultPlannerView = () => {
    if (typeof window === 'undefined') return 'week';
    const w = window.innerWidth;
    if (w < 640) return 'day';
    if (w < 1024) return '4days';
    return 'week';
  };
  const plannerView = ref(getDeviceDefaultPlannerView());
  const setUserPlannerView = (v) => {
    userCustomizedPlannerView.value = true;
    plannerView.value = v;
  };
  const handleResize = () => {
    if (!userCustomizedPlannerView.value) {
      const defaultView = getDeviceDefaultPlannerView();
      if (plannerView.value !== defaultView) {
        plannerView.value = defaultView;
      }
    }
  };

  const plannerNatureOptions = KINDS;
  const showNatureFilter = ref(false);
  const natureFilter = ref([]);
  const natureFilterLabel = computed(() =>
    natureFilter.value.length === 0 ? 'All types'
      : natureFilter.value.length === 1 ? natureFilter.value[0]
      : natureFilter.value.length + ' types');

  const setNatureFilter = (v) => { if (v === 'all') natureFilter.value = []; showNatureFilter.value = false; };
  const toggleNatureFilter = (n) => {
    const i = natureFilter.value.indexOf(n);
    if (i >= 0) natureFilter.value.splice(i, 1); else natureFilter.value.push(n);
  };
  const _blockNature = customBlockNature || ((b) => toKind(b.task_nature));

  const plannerNatureMenuItems = computed(() => [
    { label: 'All types', selected: natureFilter.value.length === 0, onClick: () => setNatureFilter('all') },
    {
      group: 'Filter by activity',
      items: plannerNatureOptions.map((n) => ({
        label: n,
        selected: natureFilter.value.includes(n),
        onClick: (e) => { if (e && e.preventDefault) e.preventDefault(); toggleNatureFilter(n); }
      }))
    }
  ]);

  const _utc = (iso) => _utcDate(iso);
  const mondayOf = (iso) => { const dow = (_utc(iso).getUTCDay() + 6) % 7; return addDays(iso, -dow); };

  const plannerRange = computed(() => ({ lo: 0, hi: 24 }));
  const plannerHours = computed(() => {
    const arr = [];
    for (let h = plannerRange.value.lo; h < plannerRange.value.hi; h++) arr.push(h);
    return arr;
  });

  const plannerDays = computed(() => {
    if (plannerView.value === 'day') return [plannerAnchor.value];
    if (plannerView.value === '4days') return Array.from({ length: 4 }, (_, i) => addDays(plannerAnchor.value, i - 1));
    return Array.from({ length: 7 }, (_, i) => addDays(plannerAnchor.value, i - 2));
  });

  const plannerRangeLabel = computed(() => {
    const optsDate = { month: 'short', day: 'numeric', timeZone: 'UTC' };
    if (plannerView.value === 'day') return _utc(plannerAnchor.value).toLocaleDateString(undefined, { weekday: 'long', ...optsDate });
    const d = plannerDays.value;
    if (plannerView.value === '4days') {
      return _utc(d[0]).toLocaleDateString(undefined, optsDate) + ' – ' + _utc(d[3] || d[d.length - 1]).toLocaleDateString(undefined, optsDate);
    }
    return _utc(d[0]).toLocaleDateString(undefined, optsDate) + ' – ' + _utc(d[6] || d[d.length - 1]).toLocaleDateString(undefined, optsDate);
  });

  const dowLabel = (iso) => _utc(iso).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  const domLabel = (iso) => _utc(iso).getUTCDate();
  const hourLabel = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p');

  const timedSegmentsForDay = (iso) => {
    const blocks = plannerData.value.blocks || [];
    const segments = [];

    for (const b of blocks) {
      if (natureFilter.value.length > 0 && !natureFilter.value.includes(_blockNature(b))) continue;

      const sMins = _mins(b.start_time);
      const eMins = _mins(b.end_time);
      const crossesMidnight = eMins < sMins;

      if (b.work_date === iso) {
        if (crossesMidnight) {
          segments.push({
            key: b.name + '_tail',
            name: b.name,
            is_segment: true,
            segment_type: 'tail',
            start_mins: sMins,
            end_mins: 1440,
            block: b
          });
        } else {
          let end = eMins;
          if (end <= sMins) end = sMins + (parseFloat(b.duration_hours) || 1) * 60;
          segments.push({
            key: b.name,
            name: b.name,
            is_segment: false,
            segment_type: 'full',
            start_mins: sMins,
            end_mins: Math.max(sMins + 15, end),
            block: b
          });
        }
      } else if (addDays(b.work_date, 1) === iso && crossesMidnight) {
        segments.push({
          key: b.name + '_head',
          name: b.name,
          is_segment: true,
          segment_type: 'head',
          start_mins: 0,
          end_mins: Math.max(15, eMins),
          block: b
        });
      }
    }

    if (iso === (todayDate.value || todayISO()) && isTracking.value && startTime.value) {
      const isBoundToExistingSeg = trackerBlockName.value && segments.some(s => s.block && s.block.name === trackerBlockName.value);
      if (!isBoundToExistingSeg) {
        const d = new Date(startTime.value);
        const startISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (startISO === iso) {
          const sMins = d.getHours() * 60 + d.getMinutes();
          const curNow = new Date();
          const curNowMins = curNow.getHours() * 60 + curNow.getMinutes();
          const eMins = Math.max(sMins + 15, curNowMins);
          // The session's notes are what got done, not a title: name it by the first line
          // that is not a ticked-off task
          const notes = String(trackerNotes.value || '').trim();
          const heading = noteHeading(notes) || 'Live session';
          const liveBlock = {
            name: trackerBlockName.value || 'live_active_session',
            is_live_active: true,
            task_subject: heading,
            work_item_label: heading,
            deliverable_notes: notes,
            start_time: _minToHHMM(sMins),
            end_time: _minToHHMM(eMins),
            duration_hours: ((eMins - sMins) / 60).toFixed(2),
            actual_hours: (trackerSeconds.value / 3600).toFixed(2),
            task_nature: toKind(selectedNature.value),
            project: selectedProject.value || '',
            status: 'In Progress',
            // An unbound session carries its own tasks until Stop makes its block
            ...(trackerBlockName.value ? {} : { is_session_tasks: true, employee: currentUser && currentUser.value, work_date: iso, tasks: sessionTasks ? sessionTasks.value : [] })
          };
          segments.push({
            key: 'live_active_session_seg',
            name: liveBlock.name,
            is_segment: false,
            segment_type: 'full',
            start_mins: sMins,
            end_mins: eMins,
            block: liveBlock
          });
        }
      }
    }

    if (!segments.length) return [];

    segments.sort((a, b) => a.start_mins - b.start_mins || (b.end_mins - b.start_mins) - (a.end_mins - a.start_mins));

    const clusters = [];
    let curCluster = [segments[0]];
    let clusterEnd = segments[0].end_mins;

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.start_mins < clusterEnd) {
        curCluster.push(seg);
        clusterEnd = Math.max(clusterEnd, seg.end_mins);
      } else {
        clusters.push(curCluster);
        curCluster = [seg];
        clusterEnd = seg.end_mins;
      }
    }
    if (curCluster.length) clusters.push(curCluster);

    for (const cluster of clusters) {
      const laneEnds = [];
      for (const seg of cluster) {
        let placed = false;
        for (let l = 0; l < laneEnds.length; l++) {
          if (laneEnds[l] <= seg.start_mins) {
            seg.laneIdx = l;
            laneEnds[l] = seg.end_mins;
            placed = true;
            break;
          }
        }
        if (!placed) {
          seg.laneIdx = laneEnds.length;
          laneEnds.push(seg.end_mins);
        }
      }
      const totalLanes = Math.max(1, laneEnds.length);
      for (const seg of cluster) {
        seg.totalLanes = totalLanes;
      }
    }

    return segments;
  };

  const blocksForDay = (iso) => (plannerData.value.blocks || []).filter(b =>
    b.work_date === iso &&
    (natureFilter.value.length === 0 || natureFilter.value.includes(_blockNature(b))));

  const _gridBottomPx = () => plannerHours.value.length * PLANNER_HOUR_PX;
  const blockTop = (b) => {
    const px = (_mins(b.start_time) - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
    return Math.min(Math.max(0, px), Math.max(0, _gridBottomPx() - 22));
  };
  const blockHeight = (b) => {
    let dur = _mins(b.end_time) - _mins(b.start_time);
    if (dur <= 0) dur = (parseFloat(b.duration_hours) || 1) * 60;
    const px = Math.max(22, dur / 60 * PLANNER_HOUR_PX);
    return Math.min(px, Math.max(22, _gridBottomPx() - blockTop(b)));
  };

  const segTop = (seg) => {
    const px = (seg.start_mins - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
    return Math.min(Math.max(0, px), Math.max(0, _gridBottomPx() - 22));
  };
  const segHeight = (seg) => {
    const dur = Math.max(15, seg.end_mins - seg.start_mins);
    const px = Math.max(22, dur / 60 * PLANNER_HOUR_PX);
    return Math.min(px, Math.max(22, _gridBottomPx() - segTop(seg)));
  };

  const segStyle = (seg) => {
    const d = plannerDrag && plannerDrag.value;
    const b = seg.block;
    const totalLanes = seg.totalLanes || 1;
    const laneIdx = seg.laneIdx || 0;
    const baseLeft = (laneIdx * 100 / totalLanes);
    const baseWidth = (100 / totalLanes);

    const bStyle = blockStyle ? blockStyle(b) : {};
    if (d && d.name === b.name && d.moved) {
      const top = (d.curStart - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
      const h = Math.max(22, (d.curEnd - d.curStart) / 60 * PLANNER_HOUR_PX);
      return Object.assign({}, bStyle, {
        top: top + 'px',
        height: h + 'px',
        left: '2px',
        width: 'calc(100% - 4px)',
        zIndex: 40,
        opacity: '0.92',
        boxShadow: '0 8px 24px rgba(0,0,0,.3)'
      });
    }
    return Object.assign({}, bStyle, {
      top: segTop(seg) + 'px',
      height: segHeight(seg) + 'px',
      left: 'calc(' + baseLeft + '% + 2px)',
      width: 'calc(' + baseWidth + '% - 4px)'
    });
  };

  let _nowTimer = null;
  const startNowClock = () => {
    if (_nowTimer) return;
    _nowTimer = setInterval(() => {
      const n = new Date();
      nowMinute.value = n.getHours() * 60 + n.getMinutes();
    }, 30000);
  };

  const stopNowClock = () => {
    if (_nowTimer) { clearInterval(_nowTimer); _nowTimer = null; }
  };

  const nowLineTop = computed(() => {
    const lo = plannerRange.value.lo * 60;
    return ((nowMinute.value - lo) / 60) * 44;
  });
  const nowLineLabel = computed(() => _minToHHMM(nowMinute.value));
  const isTodayCol = (iso) => iso === (todayDate.value || todayISO());

  const _loadOffice = (key, fallback) => {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  };
  const plannerViewOrder = ['day', '4days', 'week'];
  const onPlannerViewKey = (ev) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (keys.indexOf(ev.key) === -1) return;
    ev.preventDefault();
    const cur = Math.max(0, plannerViewOrder.indexOf(plannerView.value));
    let next = cur;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (cur + 1) % plannerViewOrder.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (cur - 1 + plannerViewOrder.length) % plannerViewOrder.length;
    else if (ev.key === 'Home') next = 0;
    else next = plannerViewOrder.length - 1;
    setUserPlannerView(plannerViewOrder[next]);
    nextTick(() => {
      const group = ev.currentTarget;
      const btns = group && group.querySelectorAll ? group.querySelectorAll('[data-planner-view]') : [];
      if (btns[next]) btns[next].focus();
    });
  };

  const officeStart = ref(_loadOffice('omnitrack_office_start', '10:00'));
  const officeEnd = ref(_loadOffice('omnitrack_office_end', '18:00'));
  watch([officeStart, officeEnd], () => {
    try {
      localStorage.setItem('omnitrack_office_start', officeStart.value);
      localStorage.setItem('omnitrack_office_end', officeEnd.value);
    } catch (e) { /* private mode */ }
  });

  const _swipe = { x: 0, y: 0, t: 0, ok: false };
  const onPlannerTouchStart = (ev) => {
    const t = ev.touches && ev.touches.length === 1 ? ev.touches[0] : null;
    _swipe.ok = !!t;
    if (!t) return;
    _swipe.x = t.clientX; _swipe.y = t.clientY; _swipe.t = Date.now();
  };
  const onPlannerTouchEnd = (ev) => {
    if (!_swipe.ok) return;
    _swipe.ok = false;
    const t = ev.changedTouches && ev.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - _swipe.x;
    const dy = t.clientY - _swipe.y;
    if (Date.now() - _swipe.t > 700) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if ((slotSel && slotSel.value) || (plannerDrag && plannerDrag.value)) return;
    if (plannerShift) plannerShift(dx < 0 ? 1 : -1);
  };

  const officeMarks = computed(() => {
    const lo = plannerRange.value.lo * 60;
    let a = _mins(officeStart.value);
    let b = _mins(officeEnd.value);
    if (!(b > a)) { a = 10 * 60; b = 18 * 60; }
    return [
      { kind: 'start', top: (((a - lo) / 60) * 44) + 'px', title: 'Office starts ' + _minToHHMM(a) },
      { kind: 'end', top: (((b - lo) / 60) * 44) + 'px', title: 'Office ends ' + _minToHHMM(b) }
    ];
  });

  const isPastCol = (iso) => iso < (todayDate.value || todayISO());
  const pastShadeStyle = (iso) => {
    const today = todayDate.value || todayISO();
    const full = plannerHours.value.length * 44;
    if (iso < today) return { top: '0px', height: full + 'px' };
    if (iso === today) return { top: '0px', height: Math.max(0, Math.min(full, nowLineTop.value)) + 'px' };
    return { display: 'none' };
  };

  return {
    PLANNER_HOUR_PX,
    plannerGridScroll,
    scrollPlannerToMorning,
    userCustomizedPlannerView,
    getDeviceDefaultPlannerView,
    plannerView,
    setUserPlannerView,
    handleResize,
    plannerNatureOptions,
    showNatureFilter,
    natureFilter,
    natureFilterLabel,
    plannerNatureMenuItems,
    setNatureFilter,
    toggleNatureFilter,
    _blockNature,
    plannerRange,
    plannerHours,
    plannerDays,
    plannerRangeLabel,
    dowLabel,
    domLabel,
    hourLabel,
    mondayOf,
    timedSegmentsForDay,
    blocksForDay,
    _gridBottomPx,
    blockTop,
    blockHeight,
    segTop,
    segHeight,
    segStyle,
    startNowClock,
    stopNowClock,
    nowLineTop,
    nowLineLabel,
    isTodayCol,
    plannerViewOrder,
    onPlannerViewKey,
    officeStart,
    officeEnd,
    onPlannerTouchStart,
    onPlannerTouchEnd,
    officeMarks,
    isPastCol,
    pastShadeStyle
  };
}
