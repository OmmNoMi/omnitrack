// Which days time can be logged on. Two settings in OmniTrack Settings decide it, and the
// client and the server must agree:
// - log_days_back (default 15): an employee logs, changes or deletes time on the last N days,
//   today counted as day 1. A manager reaches any day.
// - payroll_closed_through: HR sets it after running payroll. Nobody, managers included, touches
//   time on or before it.
// Bug this guards: the old window was 48 hours by default, so an employee who missed two days
// could never log them, and nothing stopped anyone changing time payroll had already paid.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logDayRefusal } from "../src/utils/timesheetEntry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (file, re, what) => { if (!re.test(read(file))) problems.push(`${file}: ${what}`); };
const forbid = (file, re, what) => { if (re.test(read(file))) problems.push(`${file}: ${what}`); };

// 1. The client's rule, at 12 Oct 2026
const now = new Date(2026, 9, 12, 10, 0);
const ok = (day, opts, what) => { const r = logDayRefusal(day, opts, now); if (r) problems.push(`logDayRefusal ${what}: refused (${r})`); };
const no = (day, opts, has, what) => { const r = logDayRefusal(day, opts, now); if (!r.includes(has)) problems.push(`logDayRefusal ${what}: got "${r}", want it to say "${has}"`); };
const emp = { daysBack: 15, isManager: false };
ok("2026-10-12", emp, "today, 15 days back");
ok("2026-09-28", emp, "the 15th day back (today is day 1)");
no("2026-09-27", emp, "last 15 days, from 28 Sept", "the 16th day back");
no("2026-09-27", { isManager: false }, "last 15 days", "no setting: the 15-day default");
no("2026-09-27", { daysBack: 0, isManager: false }, "last 15 days", "0 is unset: the 15-day default");
ok("2026-10-11", { daysBack: 2, isManager: false }, "yesterday, 2 days back");
no("2026-10-10", { daysBack: 2, isManager: false }, "last 2 days", "two days ago, 2 days back");
ok("2026-01-05", { daysBack: 15, isManager: true }, "a manager, any open day");
const paid = { daysBack: 15, payrollClosedThrough: "2026-09-30", isManager: false };
no("2026-09-30", paid, "Payroll is closed through 30 Sept", "the day payroll is closed through");
ok("2026-10-01", paid, "the day after payroll closed");
no("2026-09-29", { ...paid, isManager: true }, "Payroll is closed", "a manager on a closed day");
no("2025-12-31", { payrollClosedThrough: "2026-09-30", isManager: true }, "Payroll is closed", "a manager long before payroll closed");
ok("", emp, "no day yet");

// 2. The planner and the entry box use it
const PS = "src/composables/useWorkstationPlannerState.js";
need(PS, /const canLogTimesheet = \(b\) => !!b && !logWindowRefusal\(/, "canLogTimesheet uses logWindowRefusal, the server's rule");
need(PS, /daysBack: logDaysBack\.value,\s*payrollClosedThrough: payrollClosedThrough\.value,\s*isManager: isManager\.value,/, "logWindowRefusal passes the window, the payroll date and the role");
need(PS, /return d > 0 \? d : 15;/, "logDaysBack falls back to 15 days");
need(PS, /plannerData\.value\.payroll_closed_through/, "reads payroll_closed_through from the planner payload");
const WSE = "src/components/dialogs/WorkSessionEntry.vue";
need(WSE, /dayRefusal\(\) \{ return this\.form\.session_date \? this\.logWindowRefusal\(this\.form\.session_date\) : ""; \}/, "the entry asks logWindowRefusal about its day");
need(WSE, /:day-refusal="dayRefusal"/, "the entry hands the day's refusal to the session box");
need(WSE, /:save-error="editSessionError"/, "the entry hands the server's refusal to the session box");
const USE = "src/session/useSessionEntry.js";
need(USE, /!!entry\.value\.session_date && !props\.dayRefusal &&/, "Save waits while the day cannot be logged");
need(USE, /const entryRefusal = computed\(\(\) => props\.dayRefusal \|\| \(entryAhead\.value \? entryAheadText\.value : ''\) \|\| props\.saveError \|\| ''\);/, "one reason at a time: the day, then time ahead, then the server");
need("src/session/SessionControlsPane.vue", /<p v-if="entryRefusal" class="text-sm text-red-700 dark:text-red-200" role="alert">\{\{ entryRefusal \}\}<\/p>/, "the reason shows inside the box, as an alert");

// 3. A refused save keeps the box open and says why inside it, never a toast behind it
const MOD = "src/composables/useWorkstationSessionModals.js";
const save = (read(MOD).match(/const saveEditSession = async[\s\S]*?\n  };/) || [""])[0];
if (/showToast\(/.test(save)) problems.push(`${MOD}: saveEditSession says why in the box (editSessionError), never a toast`);
if (!/\} catch \(e\) \{[\s\S]*?refuse\(extractErrorMessage\(e, /.test(save)) problems.push(`${MOD}: saveEditSession shows the server's refusal in the box`);
need(MOD, /editSessionTargetBlock\.value = block;\s*editSessionError\.value = '';/, "a newly opened entry starts with no old refusal");

// 4. The server: the same rule, in one place
const PERM = "omnitrack/permissions.py";
const check = (read(PERM).match(/def check_timesheet_date_permission[\s\S]*?\n\treturn True/) || [""])[0];
if (!/check_payroll_open\(session_date\)\n\tif is_omnitrack_manager\(user\):/.test(check)) problems.push(`${PERM}: check_timesheet_date_permission checks payroll before the manager exemption`);
if (!/if getdate\(session_date\) < get_earliest_log_date\(\):/.test(check)) problems.push(`${PERM}: check_timesheet_date_permission refuses a day before the window`);
need(PERM, /DEFAULT_LOG_DAYS_BACK = 15\n/, "the window defaults to 15 days");
need(PERM, /return getdate\(add_days\(nowdate\(\), -\(get_log_days_back\(\) - 1\)\)\)/, "today counts as day 1");
need(PERM, /if closed and target_date and getdate\(target_date\) <= closed:/, "the payroll date itself is closed");
need(PERM, /return closed if closed and closed\.year > 1 else None/, "an empty payroll date (Frappe reads it as 0001-01-01) means not set");
for (const fn of ["validate_timesheet_permission", "validate_timesheet_trash_event"]) {
  const body = (read(PERM).match(new RegExp(`def ${fn}[\\s\\S]*?\\n\\n\\n`)) || [""])[0];
  if (!/check_timesheet_date_permission\(d\)/.test(body)) problems.push(`${PERM}: ${fn} uses check_timesheet_date_permission, not its own copy of the window`);
}
const TS = "omnitrack/api/timesheet.py";
need(TS, /if sess_row\.session_date and str\(sess_row\.session_date\) != str\(base_date\):\s*check_timesheet_date_permission\(sess_row\.session_date, frappe\.session\.user\)/, "an edit checks the day the session leaves, so time cannot be moved out of a closed payroll period");
need(TS, /row = next\(\(s for s in doc\.sessions if s\.name == session_name\), None\)\s*base_date = \(row and row\.session_date\) or doc\.work_date or nowdate\(\)/, "a delete checks the session's own day");
const PWB = "omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.py";
const pwb = (read(PWB).match(/def validate_timesheet_session_horizons[\s\S]*?\n\n\tdef /) || [""])[0];
if (!/if prev is None or row\(prev\) != row\(sess\):/.test(pwb)) problems.push(`${PWB}: only added or changed sessions are checked, so a closed block can still be approved`);
if (!/touched \+= \[r\.session_date for r in old\.values\(\)\]/.test(pwb)) problems.push(`${PWB}: a removed session's day is checked`);

// 5. The settings, the payload and the patch
const SET = JSON.parse(read("omnitrack/omnitrack/doctype/omnitrack_settings/omnitrack_settings.json"));
const field = (n) => SET.fields.find((f) => f.fieldname === n) || {};
if (field("log_days_back").fieldtype !== "Int" || String(field("log_days_back").default) !== "15") problems.push("OmniTrack Settings: log_days_back is an Int defaulting to 15");
if (field("payroll_closed_through").fieldtype !== "Date" || field("payroll_closed_through").permlevel !== 1) problems.push("OmniTrack Settings: payroll_closed_through is a Date at permlevel 1");
if (field("timesheet_modification_horizon_hours").fieldname) problems.push("OmniTrack Settings: the hours field is replaced by log_days_back");
const perm = (role, lvl) => SET.permissions.find((p) => p.role === role && (p.permlevel || 0) === lvl) || {};
if (!perm("HR Manager", 1).write) problems.push("OmniTrack Settings: HR Manager sets payroll_closed_through (permlevel 1 write)");
if (!perm("HR Manager", 0).read) problems.push("OmniTrack Settings: HR Manager can open the settings (permlevel 0 read)");
if (perm("HR Manager", 0).write) problems.push("OmniTrack Settings: HR Manager changes only the payroll date, not every setting");
if (perm("OmniTrack Manager", 1).write) problems.push("OmniTrack Settings: only HR and System Manager move the payroll date");
need("omnitrack/api/planner.py", /"log_days_back": days,\s*"payroll_closed_through": str\(closed\) if closed else None,/, "the planner payload carries both settings");
need("omnitrack/api/analytics.py", /\*\*_log_window\(\),/, "the workstation payload carries both settings");
need("omnitrack/patches.txt", /^omnitrack\.patches\.v1_5\.log_days_back$/m, "the patch moving hours to days is registered");
need("omnitrack/patches/v1_5/log_days_back.py", /days = round\(hours \/ 24\) if hours > 0 and hours != 48 else 15/, "an old 48h default becomes 15 days; a chosen value keeps its reach");

if (problems.length) {
  console.error("FAIL: logging window:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK: employees log the last log_days_back days; nobody touches time payroll has closed; refusals show in the box");
