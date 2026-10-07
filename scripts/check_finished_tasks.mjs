#!/usr/bin/env node
// A finished task is never listed as work to do, or flagged Overdue. Ticking a task done in a
// session sets the Task to Completed but leaves its assignment (a ToDo) open, so the list read
// the open ToDo, found the Task, and showed it under "Needs your attention" as Overdue. A ToDo
// moved to a finished state of a ToDo workflow was listed the same way.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const py = fs.readFileSync(path.join(root, "omnitrack/api/tasks.py"), "utf8");
const problems = [];
const at = py.indexOf("def get_assigned_tasks(");
const fn = at < 0 ? "" : py.slice(at, py.indexOf("\n@frappe.whitelist", at));

if (!/^from omnitrack\.api\.projects import CLOSED_TASK$/m.test(py)) problems.push("import CLOSED_TASK (Completed, Cancelled, Template) from omnitrack.api.projects");
if (!/"reference_type": "Task", "status": "Open"\}/.test(fn)) problems.push("get_assigned_tasks: only an open assignment points at a Task");
const closed = fn.match(/"status": \["not in", list\(CLOSED_TASK\)\]/g) || [];
if (closed.length < 2) problems.push(`get_assigned_tasks: both Task queries (by _assign and by name) leave out ${"CLOSED_TASK"}; found ${closed.length}`);
if (!/if has_task and td\.reference_type == "Task":\s*\n\s*continue/.test(fn)) problems.push("get_assigned_tasks: a ToDo on a Task is never listed as a to-do (a finished Task's assignment stays open)");
if (!/finished = _finished_todo_states\(\)/.test(fn) || !/if wf_st in finished:\s*\n\s*continue/.test(fn)) problems.push("get_assigned_tasks: a ToDo in a finished workflow state is left out");
const states = py.slice(py.indexOf("def _finished_todo_states("), py.indexOf("@frappe.whitelist()\ndef get_assigned_tasks("));
if (!/"document_type": "ToDo", "is_active": 1/.test(states) || !/"update_field": "status", "update_value": \["in", \["Closed", "Cancelled"\]\]/.test(states)) problems.push("_finished_todo_states: a state is finished when the active ToDo workflow sets status to Closed or Cancelled there");
for (const n of ["Cancelled", "Closed", "Completed", "Done"]) if (!new RegExp(`FINISHED_STATE_NAMES = \\{[^}]*"${n}"`).test(py)) problems.push(`FINISHED_STATE_NAMES: ${n} is a finished state by its name`);

if (problems.length) {
  console.error("FAIL: finished tasks\n  omnitrack/api/tasks.py " + problems.join("\n  omnitrack/api/tasks.py "));
  process.exit(1);
}
console.log("SUCCESS: a Completed Task or a finished to-do is never listed as work to do.");
