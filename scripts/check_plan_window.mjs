// A plan is for time still to come. Planning or moving a block lands today or later, never on a
// day payroll has closed, and today never in a slot that has already ended. Time already worked
// is logged, not planned, so the blocks made to hold logged time are left out.
// Bug this guards: the Plan and Reschedule dialogs offered any past day, the server's own past
// check missed earlier today and moves (a 24-hour grace let a block land on yesterday), and no
// planning path looked at payroll_closed_through at all.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planRefusal, PLAN_PAST, PLAN_OVER } from "../src/utils/planWindow.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (file, re, what) => { if (!re.test(read(file))) problems.push(`${file}: ${what}`); };
const bodyOf = (file, name) => {
  const src = read(file);
  const at = src.indexOf(`def ${name}(`);
  if (at < 0) return "";
  const next = src.slice(at + 4).search(/\n(?:def |@frappe)/);
  return next < 0 ? src.slice(at) : src.slice(at, at + 4 + next);
};

// 1. The client's rule, at 10:00 on 12 Oct 2026
const now = new Date(2026, 9, 12, 10, 0);
const ok = (day, s, e, opts, what) => { const r = planRefusal(day, s, e, opts, now); if (r) problems.push(`planRefusal ${what}: refused (${r})`); };
const no = (day, s, e, opts, has, what) => { const r = planRefusal(day, s, e, opts, now); if (!r.includes(has)) problems.push(`planRefusal ${what}: got "${r}", want it to say "${has}"`); };
no("2026-10-11", "14:00", "15:00", {}, "plan from today on", "yesterday");
no("2025-01-05", "", "", {}, "plan from today on", "a day long ago, no times yet");
ok("2026-10-12", "10:00", "11:00", {}, "today from now");
ok("2026-10-12", "09:00", "10:15", {}, "today, under way");
no("2026-10-12", "08:00", "10:00", {}, "That time is over", "today, ended at now");
ok("2026-10-12", "09:00", "01:00", {}, "today, ending the next morning");
ok("2026-10-13", "08:00", "09:00", {}, "tomorrow");
const paid = { payrollClosedThrough: "2026-10-13" };
no("2026-10-13", "10:00", "11:00", paid, "Payroll is closed through 13 Oct. Plan from 14 Oct on.", "the day payroll is closed through");
no("2026-10-12", "11:00", "12:00", paid, "Payroll is closed", "today, payroll closed past it");
ok("2026-10-14", "10:00", "11:00", paid, "the day after payroll closed");
ok("", "10:00", "11:00", {}, "no day yet");

// 2. The server says the same words
const perms = read("omnitrack/permissions.py");
for (const words of [PLAN_PAST, PLAN_OVER, "Payroll is closed through {0}. Plan from {1} on."]) {
  if (!perms.includes(`_("${words}")`)) problems.push(`omnitrack/permissions.py plan_refusal: say "${words}", as src/utils/planWindow.js does`);
}
const refusal = bodyOf("omnitrack/permissions.py", "plan_refusal");
if (!/if day < today:/.test(refusal)) problems.push("omnitrack/permissions.py plan_refusal: an earlier day is refused");
if (!/if closed and day <= closed:/.test(refusal)) problems.push("omnitrack/permissions.py plan_refusal: the payroll day itself is closed (<=)");
if (!/if end <= start:\s*end \+= 24 \* 60/.test(refusal)) problems.push("omnitrack/permissions.py plan_refusal: an end before its start is the next morning");
if (!/if end <= now\.hour \* 60 \+ now\.minute:/.test(refusal)) problems.push("omnitrack/permissions.py plan_refusal: today, a slot already over is refused");

// 3. Every path that plans or moves a block asks
const PL = "omnitrack/api/planner.py";
const book = bodyOf(PL, "book_work_block");
if (!/if not frappe\.flags\.omnitrack_block_for_logged_time:\s*from omnitrack\.permissions import check_plan_date\s*check_plan_date\(work_date or nowdate\(\), start_time, end_time\)/.test(book))
  problems.push(`${PL} book_work_block: check_plan_date, unless it holds logged time`);
if (!/check_plan_date\(doc\.work_date, doc\.start_time, doc\.end_time\)/.test(bodyOf(PL, "create_planned_work_block")))
  problems.push(`${PL} create_planned_work_block: check_plan_date`);
if (!/if work_date or start_time or end_time:\s*check_plan_date\(work_date or doc\.work_date, start_time or doc\.start_time, end_time or doc\.end_time\)/.test(bodyOf(PL, "update_work_block")))
  problems.push(`${PL} update_work_block: a move or resize is checked with check_plan_date`);
if (!/check_plan_date\(target_date, target_start, target_end\)/.test(bodyOf(PL, "reschedule_work_block")))
  problems.push(`${PL} reschedule_work_block: where it goes is checked with check_plan_date`);
const carry = bodyOf("omnitrack/api/tasks.py", "reschedule_unfinished_tasks");
if (!/check_plan_date\(target_date, start_at, end_at\)/.test(carry)) problems.push("omnitrack/api/tasks.py reschedule_unfinished_tasks: check_plan_date");
if (!/if plan_refusal\(target_date, start_at, end_at\):\s*target_date = getdate\(frappe\.utils\.add_days\(nowdate\(\), 1\)\)/.test(carry))
  problems.push("omnitrack/api/tasks.py reschedule_unfinished_tasks: a default day whose slot is over carries to tomorrow");

if (!/for _day, s_time, e_time in slots:\s*check_plan_date\(target_date, s_time, e_time\)/.test(bodyOf("omnitrack/fac.py", "plan_work_blocks")))
  problems.push("omnitrack/fac.py plan_work_blocks: every block is checked with check_plan_date before any is booked");
if (!/A plan is for time still to come: refused for an earlier day, a day on or before Payroll Closed Through, or a slot today that has already ended\./.test(read("omnitrack/fac.py"))) problems.push("omnitrack/fac.py: the plan tool tells the assistant the rule");

// 4. Only the assistant's logging books a block for time already worked, and lets go after
const flagged = [];
for (const f of ["omnitrack/fac.py", "omnitrack/api/planner.py", "omnitrack/api/stopwatch.py", "omnitrack/api/timesheet.py", "omnitrack/api/tasks.py"]) {
  if (fs.existsSync(path.join(root, f)) && /omnitrack_block_for_logged_time = True/.test(read(f))) flagged.push(f);
}
if (flagged.join() !== "omnitrack/fac.py") problems.push(`only fac.log_work_session books a block for logged time (set in: ${flagged.join(", ") || "nowhere"})`);
if (!/frappe\.flags\.omnitrack_block_for_logged_time = True\s*try:\s*bk_res = book_work_block\([\s\S]*?\)\s*finally:\s*frappe\.flags\.omnitrack_block_for_logged_time = False/.test(bodyOf("omnitrack/fac.py", "log_work_session")))
  problems.push("omnitrack/fac.py log_work_session: the logged-time flag wraps only its book_work_block, and is cleared in finally");

// 5. The dialogs and the drag say why before anything is sent, with Save waiting
const plan = "src/components/dialogs/PlanWorkBlockDialog.vue";
need(plan, /dayRefusal\(\) \{\s*return planRefusal\(this\.form\.work_date, this\.form\.start_time, this\.form\.end_time, \{ payrollClosedThrough: this\.payrollClosedThrough \}\);/, "dayRefusal asks planRefusal with the payroll date");
need(plan, /canSave\(\) \{[^}]*if \(this\.dayRefusal\) return false;/, "Save waits while the day or slot is refused");
need(plan, /<p v-if="dayRefusal" role="alert"[^>]*>\{\{ dayRefusal \}\}<\/p>/, "says why, as an alert, in the dialog");
need("src/components/dialogs/DialogCoordinator.vue", /<PlanWorkBlockDialog[\s\S]*?:payroll-closed-through="payrollClosedThrough"/, "the Plan dialog gets the payroll date");
need("src/App.vue", /<DialogCoordinator[\s\S]*?:payroll-closed-through="payrollClosedThrough"/, "DialogCoordinator gets the payroll date");
const res = "src/drawers/RescheduleBlockDialog.vue";
need(res, /useWorkstationContext\(\[[^\]]*'payrollClosedThrough'/, "reads the payroll date");
need(res, /return planRefusal\(f\.work_date, f\.start_time, f\.end_time, \{ payrollClosedThrough: this\.payrollClosedThrough \}\);/, "dayRefusal asks planRefusal");
need(res, /return !this\.busy && valid && moved && !this\.dayRefusal;/, "Move block waits while the day or slot is refused");
need(res, /<p v-if="dayRefusal" role="alert"[^>]*>\{\{ dayRefusal \}\}<\/p>/, "says why, as an alert, in the dialog");
const store = "src/stores/workBlockStore.js";
need(store, /const refused = planRefusal\(f\.work_date, f\.start_time, f\.end_time, \{ payrollClosedThrough: plannerData\.value && plannerData\.value\.payroll_closed_through \}\);\s*if \(refused\) \{\s*bookError\.value = refused;\s*return;/, "submitBooking refuses before it posts");
need(store, /const date = isISODate\(opts\.date\) && opts\.date >= today \? opts\.date : today;/, "a past day (the dashboard looking back) opens the dialog on today");
const drag = "src/composables/useWorkstationPlannerDrag.js";
need(drag, /const refused = planRefusal\(move\.new_date, move\.new_start_time, move\.new_end_time, \{ payrollClosedThrough: plannerData\.value && plannerData\.value\.payroll_closed_through \}\);\s*if \(refused\) \{\s*await fetchPlannerData\(\);\s*showToast\('Not moved\. ' \+ refused, 'danger'\);\s*return;\s*\}\s*try \{\s*await postJSON\('reschedule_work_block', move\);/, "a drop on a refused day or slot springs back and says why, before it posts");

if (problems.length) {
  console.error("FAIL: plan window:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: plans land today or later, never on a closed payroll day or a slot already over; logged time is left out.");
