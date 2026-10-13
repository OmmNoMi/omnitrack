// Press and drag picks a stretch of the day, the same way on the calendar and on Day at a glance,
// and it never takes a scroll away from a phone.
// What this guards: Day at a glance only had click-to-log gaps, while the calendar drew a range
// by dragging; and the calendar refused a range that had passed. Now Planned plans the stretch,
// Logged logs it, the calendar logs a past stretch and plans a coming one, and a finger only
// draws after it has been held still (a swipe scrolls the page and the timeline as before).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minuteAtX, pickedRange, rangeIntent, rangeHHMM } from "../src/utils/pickTimeRange.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (file, re, what) => { if (!re.test(read(file))) problems.push(`${file}: ${what}`); };
const never = (file, re, what) => { if (re.test(read(file))) problems.push(`${file}: ${what}`); };
const want = (got, exp, what) => {
  if (JSON.stringify(got) !== JSON.stringify(exp)) problems.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(exp)}`);
};

// 1. The rule. Today is 13 Oct, the clock reads 14:10 (850)
const T = "2026-10-13";
want(pickedRange(720, 600), { start: 600, end: 720 }, "a range dragged right to left");
want(pickedRange(600, 600), { start: 600, end: 615 }, "a range is never shorter than 15 minutes");
want(pickedRange(1440, 1440), { start: 1425, end: 1440 }, "a range at the very end of the day");
want(minuteAtX(150, { left: 100, width: 1440 }), 50, "the minute under the pointer");
want(minuteAtX(9999, { left: 100, width: 1440 }), 1440, "a pointer past the end of the lane");
want(rangeIntent("plan", { start: 900, end: 960 }, T, T, 850), { kind: "plan", start: 900, end: 960 }, "plan time still to come");
want(rangeIntent("plan", { start: 780, end: 960 }, T, T, 850), { kind: "plan", start: 855, end: 960 }, "a plan starts at the next quarter hour, not in the past");
want(rangeIntent("plan", { start: 780, end: 840 }, T, T, 850), { refuse: "past" }, "plan time that has passed");
want(rangeIntent("plan", { start: 600, end: 660 }, "2026-10-12", T, 850), { refuse: "past" }, "plan a past day");
want(rangeIntent("log", { start: 600, end: 660 }, T, T, 850), { kind: "log", start: 600, end: 660 }, "log time that has passed");
want(rangeIntent("log", { start: 780, end: 960 }, T, T, 850), { kind: "log", start: 780, end: 850 }, "a log ends now, not in the future");
want(rangeIntent("log", { start: 900, end: 960 }, T, T, 850), { refuse: "future" }, "log time still to come");
want(rangeIntent("log", { start: 600, end: 660 }, "2026-10-14", T, 850), { refuse: "future" }, "log a coming day");
want(rangeIntent("auto", { start: 600, end: 660 }, "2026-10-12", T, 850), { kind: "log", start: 600, end: 660 }, "the calendar logs a past day");
want(rangeIntent("auto", { start: 780, end: 840 }, T, T, 850), { kind: "log", start: 780, end: 840 }, "the calendar logs an hour that has passed");
want(rangeIntent("auto", { start: 840, end: 900 }, T, T, 850), { kind: "plan", start: 855, end: 900 }, "the calendar plans the rest of the hour now in progress");
want(rangeHHMM(1440), "23:59", "the end of the day");
want(rangeHHMM(615), "10:15", "HH:MM");

// 2. Both views open a picked range through that one rule
const SEL = "src/composables/useWorkstationPlannerSelect.js";
need(SEL, /const r = rangeIntent\(want, range, iso, w\.todayDate\.value \|\| w\.todayISO\(\), w\.nowMinute\.value\);\s*if \(r\.refuse\) \{ showToast\(PICK_REFUSED\[r\.refuse\], 'warning'\); return; \}/, "a refused range says why");
need(SEL, /if \(r\.kind === 'log'\) \{\s*w\.quickLogTimelineGap\(\{ session_date: iso, from_time: rangeHHMM\(r\.start\), to_time: rangeHHMM\(r\.end\) \}\);/, "a log opens the log entry on the day the range is on");
need("src/composables/useWorkstationSessionModals.js", /session_date: gap\.session_date \|\| selectedDashboardDate\.value/, "a picked range names its own day (a calendar column is not the dashboard's day)");
need(SEL, /const openBookModalRange = \(iso, startMin, endMin\) => openPickedRange\('auto', iso,/, "the calendar's range logs the past and plans the rest");
need(SEL, /openPickedRange\('auto', iso, \{ start: hour \* 60, end: \(hour \+ 1\) \* 60 \}\)/, "the calendar's single hour follows the same rule");
need(SEL, /openPickedRange\(s\.lane === 'planned' \? 'plan' : 'log', s\.iso, range\)/, "Planned plans the stretch, Logged logs it");

// 3. The gesture: a mouse draws at once, a finger holds first, a cancelled pointer draws nothing
need(SEL, /if \(ev\.pointerType === 'mouse'\) \{\s*ev\.preventDefault\(\);\s*begin\(ev\.clientX\);\s*return;\s*\}\s*_armOnHold\(ev,/, "on Day at a glance a mouse draws at once and a finger is held first");
need(SEL, /if \(ev\.target && ev\.target\.closest && ev\.target\.closest\('\[data-tl-bar\]'\)\) return;/, "a press on a bar opens the bar, it does not draw");
need(SEL, /if \(ev && ev\.type === 'pointercancel'\) return;\s*if \(!s \|\| !s\.moved \|\| !range\) return;\s*_timelineSelEndedAt = Date\.now\(\);/, "a cancelled or unmoved press opens nothing");
need(SEL, /const clickTimelineGap = \(g\) => \{\s*if \(_timelineSelJustEnded\(\)\) return;/, "a drag that ends on a gap does not also log the whole gap");
need(SEL, /const clickPlannedLane = \(ev\) => \{\s*if \(_timelineSelJustEnded\(\) \|\| ev\.target !== ev\.currentTarget\) return;/, "a click on an empty Planned lane plans that hour, a drag does not also do it");

// 4. Phones: nothing blocks a scroll until a held finger is drawing
need(SEL, /const onTimelineTouchMove = \(ev\) => \{\s*if \(timelineSel\.value && ev\.cancelable\) ev\.preventDefault\(\);/, "Day at a glance stops a scroll only while a held finger is drawing");
need(SEL, /const onPlannerTouchMove = \(ev\) => \{\s*if \(\(slotSel\.value \|\| w\.plannerDrag\.value\) && ev\.cancelable\) ev\.preventDefault\(\);/, "the calendar stops a scroll only while a held finger draws or moves a block");
const TLV = "src/views/dashboard/DashboardTimeline.vue";
need(TLV, /ref="timelineScroller"[^>]*@touchmove="onTimelineTouchMove" @contextmenu="onTimelineContextMenu"/, "the timeline listens for moves, so a held finger's moves can draw");
need(TLV, /@pointerdown="startTimelineSel\(\$event, 'planned'\)"\s*@click="clickPlannedLane"/, "the Planned lane draws and plans an hour on click");
need(TLV, /@pointerdown="startTimelineSel\(\$event, 'logged'\)"/, "the Logged lane draws");
need(TLV, /v-for="\(r, i\) in dayTimeline\.planned" :key="'p' \+ i" data-tl-bar/, "a planned bar is marked as a bar");
need(TLV, /v-for="\(r, i\) in dayTimeline\.logged" :key="'l' \+ i" data-tl-bar/, "a logged bar is marked as a bar");
need(TLV, /@click\.stop="clickTimelineGap\(g\)"/, "a gap's click goes through the drag check");
never(TLV, /touch-none|touch-action:\s*none|touch-pan-x/, "nothing on the timeline takes a vertical page scroll away from a finger");
need("src/views/calendar/CalendarPlannerGrid.vue", /@touchstart="onPlannerTouchStart" @touchmove="onPlannerTouchMove"/, "the calendar grid listens for moves, so a held finger's moves can draw");
need("src/views/calendar/CalendarPlannerGrid.vue", /\{\{ \(slotSelIsLog \? 'Log ' : 'Plan '\) \+ slotSelLabel \}\}/, "the calendar's ghost says whether letting go logs or plans");

if (problems.length) {
  console.error("FAIL: drag to pick a time range:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: dragging picks a stretch to plan or log in both views, and a swipe still scrolls.");
