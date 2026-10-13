// A session running past midnight is drawn on every day it covers, and an open page moves
// "today" on at midnight.
// Bug this guards: a session started at 6:00 pm and still running at 00:01 vanished from Day at
// a glance and the calendar on both days. Both drew the running bar only on "today", from its
// start time (the calendar also only on the day it started), and the page kept yesterday as
// today until it was reloaded, with the now line at 12a on it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { liveSpanOn } from "../src/utils/liveSpan.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (file, re, what) => { if (!re.test(read(file))) problems.push(`${file}: ${what}`); };

// 1. The rule: started 12 Oct 6:00 pm, now 13 Oct 00:01
const started = new Date(2026, 9, 12, 18, 0).toISOString();
const now = new Date(2026, 9, 13, 0, 1);
const span = (iso, at = now, from = started) => JSON.stringify(liveSpanOn(iso, from, at));
const want = (got, exp, what) => { if (got !== JSON.stringify(exp)) problems.push(`liveSpanOn ${what}: got ${got}, want ${JSON.stringify(exp)}`); };
want(span("2026-10-12"), { s: 1080, e: 1440, fromBefore: false, toAfter: true, startDay: "2026-10-12" }, "the day it started runs to midnight");
want(span("2026-10-13"), { s: 0, e: 1, fromBefore: true, toAfter: false, startDay: "2026-10-12" }, "the next day runs from midnight to now");
want(span("2026-10-11"), null, "the day before it started");
want(span("2026-10-14"), null, "a day still to come");
want(span("2026-10-12", new Date(2026, 9, 12, 18, 30)), { s: 1080, e: 1110, fromBefore: false, toAfter: false, startDay: "2026-10-12" }, "the same day");
want(span("2026-10-12", new Date(2026, 9, 12, 17, 0)), null, "a clock behind the start");
want(span("", now), null, "no day");

// 2. Day at a glance and the calendar ask it for the day they show
const TL = "src/composables/useWorkstationTimeline.js";
need(TL, /const live = liveSpanOn\(selectedDashboardDate\.value \|\| todayDate\.value \|\| todayISO\(\), startTime\.value\);\s*if \(live\) \{\s*const ss = live\.s;/, "the running bar is the part of the session on the day shown (liveSpanOn), not only today's");
need(TL, /const ee = live\.toAfter \? 1440 : Math\.max\(ss \+ 1, nowMinute\.value\);/, "on its start day, a session still running past midnight runs to the end of the day");
if (/isViewingToday/.test(read(TL))) problems.push(`${TL}: the running bar is not limited to today`);
need("src/views/dashboard/DashboardTimeline.vue", /r\.from_before \? 'rounded-none z-10' : 'rounded-r-none z-10'/, "a bar carried over from last night is square at midnight");
const PL = "src/composables/useWorkstationPlannerLayout.js";
need(PL, /const live = isTracking\.value && startTime\.value && trackerSeconds\.value >= 0 \? liveSpanOn\(iso, startTime\.value\) : null;/, "every day column asks liveSpanOn, not only today's, and not only the day it started");
if (/startISO === iso/.test(read(PL))) problems.push(`${PL}: the running bar is not limited to the day it started`);
need(PL, /segment_type: live\.fromBefore \? 'head' : live\.toAfter \? 'tail' : 'full',/, "past midnight it reads as a night block does: (cont.) and spans midnight");

// 3. An open page moves today on at midnight
need("src/composables/useWorkstationEod.js", /watch\(nowMinute, \(\) => \{\s*const was = todayDate\.value;\s*const now = getLocalTodayISO\(\);\s*if \(!was \|\| now === was\) return;\s*todayDate\.value = now;\s*if \(selectedDashboardDate\.value === was\) selectedDashboardDate\.value = now;\s*fetchWorkstationData\(selectedEmployee\.value\);/, "at midnight today moves on, a dashboard on today follows, and the blocks are fetched again");

if (problems.length) {
  console.error("FAIL: live session across midnight:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: a session past midnight is drawn on both days, and today moves on at midnight.");
