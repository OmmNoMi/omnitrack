// A logged session past midnight is drawn, and counted, only on the day each part was worked.
// Bug this guards: a block logged 8:21 pm-00:11 am on 12 Oct is stored as two rows (12th 20:21-
// 23:59:59, 13th 00:00-00:11). Day at a glance on the 13th drew both rows, so the 12th's evening
// showed again at 8:21 pm on the 13th, and "Close your day" counted the whole block on both days.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sessionSpanOn, blockHoursOn } from "../src/utils/sessionOnDay.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (file, re, what) => { if (!re.test(read(file))) problems.push(`${file}: ${what}`); };
const want = (got, exp, what) => {
  if (JSON.stringify(got) !== JSON.stringify(exp)) problems.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(exp)}`);
};

// 1. The rule
const night = {
  work_date: "2026-10-12", start_time: "20:21:00", end_time: "00:11:00", actual_hours: 3.83,
  sessions: [
    { session_date: "2026-10-12", from_time: "20:21:00", to_time: "23:59:59", hours: 3.65 },
    { session_date: "2026-10-13", from_time: "00:00:00", to_time: "00:11:00", hours: 0.18 },
  ],
};
const [pt1, pt2] = night.sessions;
want(sessionSpanOn(pt1, night, "2026-10-12"), { s: 1221, e: 1440 }, "part 1 on its own day runs to midnight");
want(sessionSpanOn(pt1, night, "2026-10-13"), null, "part 1 is not drawn on the next day");
want(sessionSpanOn(pt2, night, "2026-10-13"), { s: 0, e: 11 }, "part 2 on its own day");
want(sessionSpanOn(pt2, night, "2026-10-12"), null, "part 2 is not drawn on the day before");

// An older single row past midnight is split the same way
const oldRow = { session_date: "2026-10-12", from_time: "22:00:00", to_time: "01:30:00", hours: 3.5 };
want(sessionSpanOn(oldRow, night, "2026-10-12"), { s: 1320, e: 1440 }, "a single night row on its start day");
want(sessionSpanOn(oldRow, night, "2026-10-13"), { s: 0, e: 90 }, "a single night row on the next day");
want(sessionSpanOn(oldRow, night, "2026-10-14"), null, "a single night row two days on");

// A row with no date of its own belongs to its block's day
want(sessionSpanOn({ from_time: "09:00", to_time: "10:00" }, night, "2026-10-12"), { s: 540, e: 600 }, "an undated row on its block's day");
want(sessionSpanOn({ from_time: "09:00", to_time: "10:00" }, night, "2026-10-13"), null, "an undated row on another day");

// Hours are shared out by day, and add back up to the block's figure
const mon = blockHoursOn(night, "2026-10-12"), tue = blockHoursOn(night, "2026-10-13");
if (!(mon > 3.5 && mon < 3.83)) problems.push(`blockHoursOn the start day: got ${mon}, want about 3.67`);
if (!(tue > 0.1 && tue < 0.3)) problems.push(`blockHoursOn the next day: got ${tue}, want about 0.16`);
if (Math.abs(mon + tue - 3.83) > 0.02) problems.push(`blockHoursOn both days add to ${mon + tue}, want 3.83`);
want(blockHoursOn({ work_date: "2026-10-12", actual_hours: 2 }, "2026-10-12"), 2, "a block with no sessions on its day");
want(blockHoursOn({ work_date: "2026-10-12", actual_hours: 2 }, "2026-10-13"), 0, "a block with no sessions on another day");

// 2. Day at a glance and Close your day use it
const TL = "src/composables/useWorkstationTimeline.js";
need(TL, /const span = sessionSpanOn\(x, bk, selectedDashboardDate\.value\);\s*if \(span\) logged\.push\(\{\s*s: span\.s,\s*e: span\.e,/, "a logged bar is the part of its session on the day shown");
need("src/composables/useWorkstationAttendance.js", /blocks\.reduce\(\(acc, b\) => acc \+ blockHoursOn\(b, dt\), 0\)/, "Close your day counts only the hours worked on the day shown");

if (problems.length) {
  console.error("check_session_on_day: FAIL\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("check_session_on_day: OK");
