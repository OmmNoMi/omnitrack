// "Day at a glance": the zoom choices, and the hours only its legend states.
// Every screen offers 3h to 24h; a phone opens on 3h. Runs the real rule, and checks the
// composable and the radiogroup still use it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIMELINE_ZOOM_OPTIONS, defaultTimelineZoom } from "../src/utils/timelineZoom.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

eq(TIMELINE_ZOOM_OPTIONS, [3, 6, 12, 24], "every screen offers 3h, 6h, 12h and 24h");

eq(defaultTimelineZoom(375, true), 3, "phone, today: opens on 3h");
eq(defaultTimelineZoom(375, false), 3, "phone, another day: opens on 3h");
eq(defaultTimelineZoom(800, true), 6, "tablet, today: 6h");
eq(defaultTimelineZoom(800, false), 12, "tablet, another day: 12h");
eq(defaultTimelineZoom(1280, true), 6, "laptop, today: 6h");
eq(defaultTimelineZoom(1280, false), 24, "laptop, another day: 24h");

const composable = read("src/composables/useWorkstationTimeline.js");
if (!/const timelineZoomOptions = TIMELINE_ZOOM_OPTIONS;/.test(composable)) problems.push("useWorkstationTimeline.js: the options must be TIMELINE_ZOOM_OPTIONS");
if (!/defaultTimelineZoom\(/.test(composable)) problems.push("useWorkstationTimeline.js: the default must come from defaultTimelineZoom(width, isToday)");

// The recording bar ends on the now line. dayTimeline is a computed, so a new Date() in it
// is read once and the bar froze while the line (nowMinute) kept moving.
const tl = (composable.match(/const dayTimeline = computed\([\s\S]*?\n  \}\);/) || [""])[0];
const live = tl.slice(tl.indexOf("isTracking.value && startTime.value"), tl.indexOf("logged.push", tl.indexOf("isTracking.value && startTime.value")));
if (!live) problems.push("useWorkstationTimeline.js: the live recording bar in dayTimeline not found");
else if (!/const ee = [^\n]*nowMinute\.value/.test(live)) problems.push("useWorkstationTimeline.js: the recording bar must end at nowMinute.value, the clock the now line uses");

const view = read("src/views/dashboard/DashboardTimeline.vue");
if (!/v-for="z in timelineZoomOptions"/.test(view)) problems.push("DashboardTimeline.vue: the radiogroup must list timelineZoomOptions");
const group = view.slice(view.indexOf('role="radiogroup"'), view.indexOf('role="radiogroup"') + 1200);
if (/text-\[(9|10|11)px\]/.test(group)) problems.push("DashboardTimeline.vue: zoom chips must be at least text-xs");
// The selected zoom on the dark page: gray-600 under white text read 4.2:1, and the old #1E1F22 was
// darker than its #2B2D30 track, so the choice looked like a hole. gray-700 is lighter than the
// track and holds white text at 7:1.
// The now badge's 9px time holds 4.5:1 only on red-600; on red-500 it read 4.4:1
if (!/rounded bg-red-600 text-white shadow-xs whitespace-nowrap">\s*\{\{ nowLineLabel \}\}/.test(view)) problems.push("DashboardTimeline.vue: the now badge is red-600 under white text");
if (!/timelineZoom === z \? \(isDarkMode \? 'bg-gray-700 text-white/.test(view)) problems.push("DashboardTimeline.vue: the selected zoom chip in dark mode is bg-gray-700 with white text");

// The day's planned and logged hours are stated once, in the timeline legend. The header
// subtitle summed planned blocks only and said "0.0h logged" over a legend's "Logged 5.7h".
const dash = read("src/composables/useWorkstationDashboard.js");
const summary = (dash.match(/const dashboardDaySummary = computed\([\s\S]*?\n  \}\);/) || [""])[0];
if (!summary) problems.push("useWorkstationDashboard.js: dashboardDaySummary not found");
else if (/h (planned|logged)/.test(summary.replace(/\/\/[^\n]*/g, ""))) problems.push("useWorkstationDashboard.js: the day subtitle must not repeat planned or logged hours; the timeline legend states them");

if (problems.length) {
  console.error("FAIL: timeline zoom\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: timeline zoom offers 3h-24h, phones open on 3h, the recording bar keeps up with the now line, and the day's hours are stated once.");
