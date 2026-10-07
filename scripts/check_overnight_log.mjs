#!/usr/bin/env node
// Work that runs past midnight is kept, on the days it was worked, and reaches the Timesheet.
// A session from 23:00 to 04:00 used to be written as one row on the first day, its ERPNext
// time log ran from 23:00 back to 04:00 the same day, ERPNext refused it, and the refusal was
// swallowed: the night's work never reached a Timesheet. The dialogs also refused an end
// before the start, so it could not be added by hand either.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];
const fn = (src, name) => {
  const at = src.search(new RegExp(`^def ${name}\\(`, "m"));
  if (at < 0) return "";
  const next = src.slice(at + 1).search(/^(?:@frappe|def |class )/m);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
};

// 1. The time-log span rolls an earlier end into the next day (pure Python, no site needed).
const SPANS = [
  [["2026-10-06", "23:00:00", "04:00:00", 5], ["2026-10-06 23:00:00", "2026-10-07 04:00:00"]],
  [["2026-10-06", "20:38", "23:59:59", 3.35], ["2026-10-06 20:38:00", "2026-10-06 23:59:59"]],
  [["2026-10-07", "00:00:00", "04:10:00", 4.17], ["2026-10-07 00:00:00", "2026-10-07 04:10:00"]],
  [["2026-10-06", "09:00:00", "09:00:00", 2], ["2026-10-06 09:00:00", "2026-10-06 11:00:00"]],
  [["2026-10-06", "22:30:00", null, 0], ["2026-10-06 22:30:00", "2026-10-06 23:00:00"]],
];
try {
  const out = JSON.parse(execFileSync("python3", ["-c",
    "import json, sys, importlib.util as u\n"
    + `s = u.spec_from_file_location("log_span", ${JSON.stringify(path.join(root, "omnitrack/utils/log_span.py"))}); m = u.module_from_spec(s); s.loader.exec_module(m)\n`
    + "print(json.dumps([list(m.log_span(*a)) for a, _ in json.loads(sys.argv[1])]))",
    JSON.stringify(SPANS),
  ], { encoding: "utf8" }));
  SPANS.forEach(([args, want], i) => {
    if (JSON.stringify(out[i]) !== JSON.stringify(want)) problems.push(`log_span(${args.join(", ")}) is ${JSON.stringify(out[i])}, want ${JSON.stringify(want)}`);
  });
} catch (e) {
  problems.push(`omnitrack/utils/log_span.py: could not run log_span (${e.message.split("\n")[0]})`);
}

// 2. Every ERPNext time log is placed by log_span, never by pasting a time onto the start day.
const ts = read("omnitrack/api/timesheet.py");
const create = fn(ts, "create_timesheet_from_work_block");
if ((create.match(/=\s*log_span\(/g) || []).length < 2) problems.push("omnitrack/api/timesheet.py create_timesheet_from_work_block: place both the session and the block time log with log_span");
if (/f"\{base_date\} \{(?:sess\.to_time|block\.end_time)\}"/.test(create)) problems.push("omnitrack/api/timesheet.py create_timesheet_from_work_block: an end time is put on the start day; use log_span");

// 3. A punch past midnight is two sessions, one per day, for the person and their pair.
const sw = read("omnitrack/api/stopwatch.py");
const rows = fn(sw, "_punch_sessions");
if (!/MidnightSplitter\.is_overnight\(/.test(rows) || !/MidnightSplitter\.split_session_rows\(/.test(rows)) problems.push("omnitrack/api/stopwatch.py _punch_sessions: split a session past midnight with MidnightSplitter");
const punch = fn(sw, "quick_timer_punch");
if ((punch.match(/in _punch_sessions\(/g) || []).length < 2) problems.push("omnitrack/api/stopwatch.py quick_timer_punch: both the block and the pairing partner's block take their rows from _punch_sessions");
if (/\.append\("sessions",\s*\{/.test(punch)) problems.push("omnitrack/api/stopwatch.py quick_timer_punch: a session row is written by hand, so it is never split at midnight");

// 4. A Timesheet that fails is logged, never swallowed.
for (const f of ["omnitrack/api/timesheet.py", "omnitrack/api/stopwatch.py"]) {
  const src = read(f);
  if (/(?:create_timesheet_from_work_block|sync_work_block_timesheet)\([^\n]*\)\n\s*except Exception:\n\s*pass\b/.test(src))
    problems.push(`${f}: a failed Timesheet is swallowed; frappe.log_error it`);
}
// and a stop that did not save says so
if (/recorded locally/.test(read("src/composables/useWorkstationApi.js")))
  problems.push("src/composables/useWorkstationApi.js: a session that failed to save is reported as saved");

// 5. The dialogs read an end before the start as the next morning.
globalThis.window = undefined;
const { spanMins, endTimeOptions, whenLine } = await import("../src/utils/clockTime.js");
for (const [s, e, want] of [["23:00", "04:00", 300], ["09:00", "17:00", 480], ["10:00", "10:00", 0], ["", "10:00", 0]]) {
  if (spanMins(s, e) !== want) problems.push(`spanMins(${s}, ${e}) is ${spanMins(s, e)}, want ${want}`);
}
const late = endTimeOptions("22:00");
const four = late.find((o) => o.value === "04:00");
if (!four || !/next day/.test(four.label) || !/6 hrs/.test(four.label)) problems.push(`endTimeOptions("22:00") offers no "4:00 am next day (6 hrs)"; got ${four ? four.label : "nothing"}`);
if (late.some((o) => o.value === "22:00")) problems.push(`endTimeOptions("22:00") offers the start itself as an end`);
if (!/· 5h$/.test(whenLine("2026-10-06", "23:00", "04:00"))) problems.push(`whenLine of 23:00-04:00 shows no 5h: ${whenLine("2026-10-06", "23:00", "04:00")}`);
const DIALOGS = ["src/components/common/DayTimeFields.vue", "src/components/dialogs/TimesheetEntryDialog.vue", "src/components/dialogs/PlanWorkBlockDialog.vue", "src/drawers/RescheduleBlockDialog.vue", "src/stores/workBlockStore.js", "src/composables/useWorkstationFocusTasks.js"];
for (const f of DIALOGS) {
  const src = read(f);
  if (!/spanMins\(/.test(src)) problems.push(`${f}: measure start to end with spanMins`);
  if (/toMin\([^)]*(?:end|to_time)[^)]*\)\s*[->]\s*toMin\(|end_time\s*<=\s*f\.start_time/.test(src)) problems.push(`${f}: an end before the start is refused; it is the next morning`);
}

if (problems.length) {
  console.error("FAIL: overnight work\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: work past midnight is split by day, its Timesheet ends the next morning, and failures are logged.");
