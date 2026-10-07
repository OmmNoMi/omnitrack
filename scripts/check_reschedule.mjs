#!/usr/bin/env node
// A block that was planned and missed can be moved to another day. It used to be refused twice:
// the drawer hid Reschedule for any block in the past, and the server locked anything older
// than a day, so a missed plan could only sit there. The copy it made also kept the original's
// Timesheet, approval and integrity hash, so the new plan looked approved and billed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];

// The drawer offers Reschedule for an open plan and for a missed one: past, nothing logged.
const app = read("src/App.vue");
const missed = (app.match(/const isMissedPlan = \(b\) => ([^\n]+);/) || [])[1] || "";
if (!/isPastBlock\(b\)/.test(missed) || !/actual_hours\)\s*>\s*0\)/.test(missed) || !/'Rescheduled',\s*'Cancelled'/.test(missed))
  problems.push("src/App.vue isMissedPlan: a missed plan is past, has nothing logged, and was not already moved or cancelled");
const can = (app.match(/const isBlockReschedulable = \(b\) => ([^\n]+);/) || [])[1] || "";
if (!/isOpenPlan\(b\)\s*\|\|\s*isMissedPlan\(b\)/.test(can) || !/!b\.is_live_active/.test(can))
  problems.push("src/App.vue isBlockReschedulable: offer Reschedule for an open or a missed plan, never one being recorded");

// The dialog moves a past block to today, and accepts an end past midnight.
const dlg = read("src/drawers/RescheduleBlockDialog.vue");
if (!/spanMins\(f\.start_time,\s*f\.end_time\)\s*>\s*0/.test(dlg)) problems.push("src/drawers/RescheduleBlockDialog.vue canMove: valid when start to end is more than zero minutes");
if (/isPastBlock/.test(dlg)) problems.push("src/drawers/RescheduleBlockDialog.vue: a past block is refused; move it forward instead");

// The server locks only what was logged; a missed plan is checked only where it goes.
const py = read("omnitrack/api/planner.py");
const at = py.indexOf("def reschedule_work_block(");
const fnSrc = at < 0 ? "" : py.slice(at, py.indexOf("\n@frappe.whitelist", at));
if (!/doc\.status in \("Rescheduled", "Cancelled"\)/.test(fnSrc)) problems.push("omnitrack/api/planner.py reschedule_work_block: refuse a block that was already moved or cancelled");
if (!/if flt\(doc\.actual_hours\) > 0:\s*\n\s*check_planned_block_past_lock\(doc,/.test(fnSrc)) problems.push("omnitrack/api/planner.py reschedule_work_block: lock a block by its age only when time was logged on it");
if (!/check_planned_block_past_lock\(None,\s*new_work_date=/.test(fnSrc)) problems.push("omnitrack/api/planner.py reschedule_work_block: a missed plan is checked only where it is moved to");
if (/^\tcheck_planned_block_past_lock\(doc\b/m.test(fnSrc)) problems.push("omnitrack/api/planner.py reschedule_work_block: every block is locked by its age, so a missed plan cannot move");

// The copy carries the plan, never the original's outcome.
const reset = (py.match(/RESCHEDULE_RESET_FIELDS = \{([\s\S]*?)\n\}/) || [])[1] || "";
const WANT = { timesheet: "None", approval_status: '"Draft"', approved_by: "None", approval_date: "None", approval_notes: "None",
  cryptographic_hash: "None", paired_block: "None", cancel_reason: "None", billing_status: '"Unbilled"', costing_amount: "0", billing_amount: "0" };
for (const [k, v] of Object.entries(WANT)) {
  if (!new RegExp(`"${k}":\\s*${v}(?!\\w)`).test(reset)) problems.push(`omnitrack/api/planner.py RESCHEDULE_RESET_FIELDS: the copy must set ${k} to ${v}`);
}
if (!/for field, value in RESCHEDULE_RESET_FIELDS\.items\(\):\s*\n\s*new_block\.set\(field, value\)/.test(fnSrc)) problems.push("omnitrack/api/planner.py reschedule_work_block: apply RESCHEDULE_RESET_FIELDS to the copy");
for (const line of ["new_block.sessions = []", "new_block.output_metrics = []", "new_block.actual_hours = 0", "new_block.variance_hours = 0"])
  if (!fnSrc.includes(line)) problems.push(`omnitrack/api/planner.py reschedule_work_block: the copy must start empty (${line})`);
// Every reset field exists on the DocType, so set() never writes a field that is not there.
const dt = JSON.parse(read("omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.json"));
const have = new Set(dt.fields.map((f) => f.fieldname));
for (const k of Object.keys(WANT)) if (!have.has(k)) problems.push(`planned_work_block.json has no ${k} field`);

if (problems.length) {
  console.error("FAIL: reschedule\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: a missed plan can be moved forward, and its copy starts as a fresh plan.");
