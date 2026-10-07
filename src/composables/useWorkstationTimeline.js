import * as Vue from "vue";
import { toKind } from "../utils/activity.js";
import { noteHeading } from "../utils/wrapNote.js";
import { TIMELINE_ZOOM_OPTIONS, defaultTimelineZoom } from "../utils/timelineZoom.js";
import { countedHours } from "../utils/countedHours.js";
const { ref, computed, watch, nextTick, onMounted } = Vue;

export function useWorkstationTimeline({
  todayDate,
  selectedDashboardDate,
  workFocusBlocks,
  isTracking,
  startTime,
  trackerBlockName,
  trackerNotes,
  selectedProject,
  selectedNature,
  nowMinute,
  getLocalTodayISO,
  todayISO,
  _minToHHMM,
  _minsOf,
  hourLabel
}) {
  const timelineZoomOptions = TIMELINE_ZOOM_OPTIONS;
  const getTimelineDefaultZoom = (dateStr) =>
    defaultTimelineZoom(typeof window !== 'undefined' ? window.innerWidth : 1280, dateStr === (todayDate.value || getLocalTodayISO()));

  const timelineZoom = ref(getTimelineDefaultZoom(selectedDashboardDate.value));
  const timelineTrackWidth = computed(() => (24 / timelineZoom.value * 100) + '%');

  // Segmented control = one tab stop; ←/→ move the selection (WAI-ARIA radiogroup).
  const onTimelineZoomKey = (ev) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (keys.indexOf(ev.key) === -1) return;
    ev.preventDefault();
    const opts = timelineZoomOptions;
    const cur = Math.max(0, opts.indexOf(timelineZoom.value));
    let next = cur;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (cur + 1) % opts.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (cur - 1 + opts.length) % opts.length;
    else if (ev.key === 'Home') next = 0;
    else next = opts.length - 1;
    timelineZoom.value = opts[next];
    nextTick(() => {
      const group = ev.currentTarget;
      const btns = group && group.querySelectorAll ? group.querySelectorAll('[data-timeline-zoom]') : [];
      if (btns[next]) btns[next].focus();
    });
  };

  const timelineScroller = ref(null);
  const timelineCanScrollLeft = ref(false);
  const timelineCanScrollRight = ref(false);

  const syncTimelineEdges = () => {
    const box = timelineScroller.value;
    if (!box) { timelineCanScrollLeft.value = timelineCanScrollRight.value = false; return; }
    timelineCanScrollLeft.value = box.scrollLeft > 2;
    timelineCanScrollRight.value = box.scrollLeft + box.clientWidth < box.scrollWidth - 2;
  };

  const nudgeTimeline = (dir) => {
    const box = timelineScroller.value;
    if (!box) return;
    box.scrollBy({ left: dir * Math.max(120, box.clientWidth * 0.8), behavior: 'smooth' });
    setTimeout(syncTimelineEdges, 400);
  };

  const dayTimeline = computed(() => {
    const blocks = workFocusBlocks.value || [];
    const planned = [], logged = [];
    blocks.forEach((bk) => {
      // Unplanned time has no plan to draw, so it shows in the logged lane only
      const isUnplanned = !!bk.unplanned;
      if (!isUnplanned) {
        const s = _minsOf(bk.start_time), e = _minsOf(bk.end_time);
        const dt = selectedDashboardDate.value;
        if (bk.work_date !== dt && e < s) {
          planned.push({ s: 0, e: e, block: bk });
        } else if (s >= 0 && e > s) {
          planned.push({ s, e, block: bk });
        } else if (s >= 0 && e < s) {
          planned.push({ s, e: 1440, block: bk });
        }
      }
      (bk.sessions || []).forEach((x) => {
        const ss = _minsOf(x.from_time), ee = _minsOf(x.to_time);
        if (ss >= 0 && ee > ss) logged.push({
          s: ss,
          e: ee,
          from_time: x.from_time,
          to_time: x.to_time,
          block: bk,
          hours: x.hours,
          notes: x.notes,
          timesheet: x.timesheet || bk.timesheet,
          session: x
        });
      });
    });

    if (isTracking.value && startTime.value) {
      const isViewingToday = !selectedDashboardDate.value || selectedDashboardDate.value === (todayDate.value || todayISO());
      if (isViewingToday) {
        const d = new Date(startTime.value);
        const ss = d.getHours() * 60 + d.getMinutes();
        // nowMinute, not new Date(): a computed only re-runs when a ref it reads changes,
        // so the bar froze while the now line kept moving.
        const ee = Math.max(ss + 1, nowMinute.value);
        // Named like the planner's live block: the notes' first line that is not a ticked-off task
        const heading = noteHeading(trackerNotes.value) || 'Live session';
        const runningBlock = blocks.find(b => b.name === trackerBlockName.value) || {
          name: trackerBlockName.value || 'live_running_session',
          work_item_label: heading,
          task_subject: heading,
          project: selectedProject.value || '',
          task_nature: toKind(selectedNature.value)
        };
        logged.push({
          s: ss,
          e: ee,
          from_time: _minToHHMM(ss),
          to_time: _minToHHMM(ee),
          block: runningBlock,
          hours: (ee - ss) / 60,
          notes: trackerNotes.value || '',
          is_live_active: true
        });
      }
    }

    if (!planned.length && !logged.length) return null;
    const all = planned.concat(logged);
    const lo = 0, hi = 1440;
    const span = hi - lo;
    const firstMin = Math.min(...all.map(r => r.s));
    const place = (r) => ({ left: ((r.s - lo) / span * 100) + '%', width: (Math.max(4, r.e - r.s) / span * 100) + '%' });
    const covered = (r) => planned.some(pb => r.s < pb.e && r.e > pb.s);
    const ticks = [];
    const step = timelineZoom.value >= 24 ? 120 : 60;
    for (let m = lo; m <= hi; m += step) ticks.push({ m, left: ((m - lo) / span * 100) + '%', label: hourLabel(Math.floor(m / 60) % 24) });
    const plannedH = planned.reduce((t, r) => t + (r.e - r.s) / 60, 0);
    const loggedH = logged.reduce((t, r) => t + (r.e - r.s) / 60, 0);

    // Compute contiguous intervals in logged lane to identify unlogged gaps
    const gaps = [];
    const sortedLogged = logged.slice().sort((a, b) => a.s - b.s);
    for (let i = 0; i < sortedLogged.length - 1; i++) {
      const gStart = sortedLogged[i].e;
      const gEnd = sortedLogged[i + 1].s;
      const gDuration = gEnd - gStart;
      if (gDuration >= 15) { // minimum 15-minute gap
        const gHours = Math.round((gDuration / 60) * 10) / 10;
        gaps.push({
          s: gStart,
          e: gEnd,
          from_time: _minToHHMM(gStart),
          to_time: _minToHHMM(gEnd),
          duration_minutes: gDuration,
          duration_hours: gHours,
          label: `+ Log ${gHours}h`,
          left: ((gStart - lo) / span * 100) + '%',
          width: (Math.max(4, gEnd - gStart) / span * 100) + '%'
        });
      }
    }

    return {
      ticks,
      planned: planned.map(r => Object.assign({}, r, place(r))),
      logged: logged.map(r => Object.assign({}, r, place(r), { onPlan: covered(r) })),
      gaps,
      plannedH, loggedH,
      spanH: span / 60,
      firstMin,
      gapH: Math.max(0, plannedH - loggedH),
    };
  });

  const scrollTimelineToWork = (smooth) => {
    let tries = 0;
    const attempt = () => {
      const box = timelineScroller.value;
      syncTimelineEdges();
      const tl = dayTimeline.value;
      const track = box && box.firstElementChild;
      if (box && tl && track) {
        const todayStr = todayDate.value || getLocalTodayISO();
        const isToday = selectedDashboardDate.value === todayStr;
        let target = 0;
        if (isToday && nowMinute.value !== undefined) {
          // Current time red line ALWAYS IN CENTER of the viewport
          const nowX = (nowMinute.value / 1440) * track.offsetWidth;
          target = Math.max(0, nowX - (box.clientWidth / 2));
        } else if (tl.firstMin >= 0) {
          target = Math.max(0, (tl.firstMin / 1440) * track.offsetWidth - 24);
        }
        const reachable = Math.min(target, Math.max(0, box.scrollWidth - box.clientWidth));
        box.scrollTo({ left: reachable, behavior: smooth ? 'smooth' : 'auto' });
        syncTimelineEdges();
        if (reachable <= 1 || Math.abs(box.scrollLeft - reachable) < 2) return;
      }
      if (++tries < 8) setTimeout(attempt, 120);
    };
    attempt();
  };

  onMounted(() => {
    watch(timelineZoom, () => nextTick(() => scrollTimelineToWork(true)));
    watch(() => dayTimeline.value && dayTimeline.value.firstMin, () => nextTick(() => scrollTimelineToWork(false)));
    watch(selectedDashboardDate, (newDate) => {
      timelineZoom.value = getTimelineDefaultZoom(newDate);
      nextTick(() => scrollTimelineToWork(false));
    });
    watch(nowMinute, () => {
      const isToday = selectedDashboardDate.value === (todayDate.value || getLocalTodayISO());
      if (isToday) {
        scrollTimelineToWork(true);
      }
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => scrollTimelineToWork(false));
    }
    nextTick(() => scrollTimelineToWork(false));
  });

  // Counted hours, not actual_hours: time logged before the block or still ahead is not logged yet.
  const loggedHours = (b) => countedHours(b, { date: todayDate.value || getLocalTodayISO(), minute: nowMinute.value });

  const blockLogState = (b) => {
    const planned = Number(b.duration_hours) || 0;
    const actual = loggedHours(b);
    if (!actual) return 'none';
    if (planned && actual > planned + 0.01) return 'over';
    if (planned && actual < planned - 0.01) return 'short';
    return 'met';
  };

  const blockLogPct = (b) => {
    const planned = Number(b.duration_hours) || 0;
    const actual = loggedHours(b);
    if (!planned) return actual ? 100 : 0;
    return Math.min(100, Math.round((actual / planned) * 100));
  };

  return {
    timelineZoom,
    timelineZoomOptions,
    timelineTrackWidth,
    onTimelineZoomKey,
    timelineScroller,
    timelineCanScrollLeft,
    timelineCanScrollRight,
    syncTimelineEdges,
    nudgeTimeline,
    dayTimeline,
    scrollTimelineToWork,
    blockLogState,
    blockLogPct
  };
}
