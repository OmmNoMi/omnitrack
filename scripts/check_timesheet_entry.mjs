// A timesheet entry records time already worked. Guards its defaults and the two bugs
// that once hid behind it: a logged entry reported as failed, and a drawer Reschedule
// that moved nothing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { entryDayOffsets, newEntryTimes } from "../src/utils/timesheetEntry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// Quick-day chips reach exactly as far back as the server's horizon (round(hours / 24) days)
eq(entryDayOffsets(48, false), [0, -1], "48h horizon: today and yesterday");
eq(entryDayOffsets(72, false), [0, -1, -2], "72h horizon: three days");
eq(entryDayOffsets(12, false), [0], "under a day: today only");
eq(entryDayOffsets(undefined, false), [0, -1], "no setting: the 48h default");
eq(entryDayOffsets(48, true), [0, -1, -2, -3, -4, -5, -6], "managers: a week");
eq(entryDayOffsets(24 * 30, false), [0, -1, -2, -3, -4, -5, -6], "never more than a week of chips");

// Defaults stay on the past side of now
const at = (d, h, m) => new Date(2026, 9, d, h, m);
const block = (day, s, e) => ({ work_date: `2026-10-${String(day).padStart(2, "0")}`, start_time: s, end_time: e });
eq(newEntryTimes(block(5, "15:00:00", "16:00:00"), at(6, 10, 7)), { date: "2026-10-05", from: "15:00", to: "16:00" }, "a past block: its own slot");
eq(newEntryTimes(block(6, "09:00:00", "11:00:00"), at(6, 10, 7)), { date: "2026-10-06", from: "09:00", to: "10:00" }, "a running block: start until now");
eq(newEntryTimes(block(6, "09:00:00", "10:00:00"), at(6, 10, 7)), { date: "2026-10-06", from: "09:00", to: "10:00" }, "ended today: its own slot");
eq(newEntryTimes(block(8, "15:00:00", "16:30:00"), at(6, 10, 7)), { date: "2026-10-06", from: "08:30", to: "10:00" }, "a future block: its length, ending now");
eq(newEntryTimes(block(8, "09:00:00", "11:00:00"), at(6, 10, 7)), { date: "2026-10-06", from: "08:00", to: "10:00" }, "a future block earlier in its day: still never a future date");
eq(newEntryTimes(null, at(6, 10, 7)), { date: "2026-10-06", from: "09:00", to: "10:00" }, "no block: the last hour");

// Bug: logNewSession tested an undefined `res` and said "Could not log" after logging.
// Adding against a block now hands log_work_session's result straight to afterSave.
const modals = read("src/composables/useWorkstationSessionModals.js");
const writeEntry = (modals.match(/const writeEntry = async[\s\S]*?\n  };/) || [""])[0];
if (!/afterSave\('Work session added', await postJSON\('log_work_session'/.test(writeEntry)) problems.push("useWorkstationSessionModals.js: adding an entry must use log_work_session's result (afterSave(..., await postJSON(...)))");
if (!/newEntryTimes\(block\)/.test(modals)) problems.push("useWorkstationSessionModals.js: a new entry takes its times from newEntryTimes");
if (/minTimesheetDate/.test(modals)) problems.push("useWorkstationSessionModals.js: the day limit is the server's horizon, not a client minTimesheetDate");

// Bug: the drawer's Reschedule used workBlockStore's own activeBlock, which it never sets
const focus = read("src/composables/useWorkstationFocusTasks.js");
const resched = (focus.match(/const submitReschedule = async[\s\S]*?\n  };/) || [""])[0];
if (!/const b = activeBlock\.value;/.test(resched) || /workBlockStore/.test(resched)) problems.push("useWorkstationFocusTasks.js: submitReschedule must move the drawer's block (w.activeBlock)");
if (!/const f = form \|\| rescheduleForm\.value;/.test(resched)) problems.push("useWorkstationFocusTasks.js: submitReschedule takes the Reschedule dialog's form");

// Ticking a task is optimistic and puts it back if the server refuses
const toggle = (focus.match(/const toggleTaskDone = async[\s\S]*?\n  };/) || [""])[0];
if (!/const before = \{/.test(toggle) || !/Object\.assign\(item, before\)/.test(toggle)) problems.push("useWorkstationFocusTasks.js: toggleTaskDone must restore the task when the server refuses");
if (/✓/.test(toggle)) problems.push("useWorkstationFocusTasks.js: no glyphs in session notes");

if (problems.length) {
  console.error("FAIL: timesheet entry guard:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: timesheet entries default to time worked, inside the horizon; drawer reschedule and ticks are wired.");
