#!/usr/bin/env node
// The FAC (MCP) tools keep the page's rules. An assistant drives the same Work Sessions and
// Planned Work Blocks a person does, so it is held to what the page holds them to:
//   - the log window and the payroll lock (permissions.check_timesheet_date_permission), told to
//     the assistant up front in get_my_workspace's log_rules;
//   - nothing is assumed: no invented length, start time, next work or cancel reason;
//   - a session is saved as the page saves it (composeWrapNote: title, log lines, last line),
//     on the day it started, and never thrown away by starting another over it;
//   - a block is cancelled only for one of its DocType's reasons, never in the past and never
//     while a session records on it (planner._check_cancellable, shared with the page);
//   - deleting, discarding and cancelling are asked of the person first;
//   - every refusal says why and changes nothing.
// Each rule below was broken in fac.py once; the comment by each names how.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeWrapNote } from "../src/utils/wrapNote.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const problems = [];
const FAC = "omnitrack/fac.py";
const fac = read(FAC);
// A top-level Python function or class, up to the next one
const pyBlock = (src, head) => {
  const i = src.indexOf(head);
  if (i < 0) return "";
  const rest = src.slice(i + head.length);
  const m = rest.match(/\n(?:@frappe\.whitelist\(\)\n)?(?:def |class )/);
  return head + (m ? rest.slice(0, m.index) : rest);
};
const need = (where, body, re, what) => { if (!re.test(body)) problems.push(`${where}: ${what}`); };
const forbid = (where, body, re, what) => { if (re.test(body)) problems.push(`${where}: ${what}`); };

// 1. The page and the server compose a session's notes alike (Python: test_session_lines)
for (const c of JSON.parse(read("omnitrack/tests/fixtures/wrap_notes.json"))) {
  const got = composeWrapNote(c.title, c.lines, c.last);
  if (got !== c.want) problems.push(`src/utils/wrapNote.js: composeWrapNote(${JSON.stringify(c.title)}, ...) gave ${JSON.stringify(got)}, wants ${JSON.stringify(c.want)} as compose_wrap_note does`);
}

// 2. The log window and the payroll lock, told up front
const rules = pyBlock(fac, "def get_log_rules(");
need(FAC, fac, /"log_rules": get_log_rules\(\)/, "get_my_workspace returns log_rules");
for (const key of ["log_days_back", "payroll_closed_through", "can_log_from", "min_session_words", "min_log_line_chars"]) {
  need(FAC, rules, new RegExp(`"${key}":`), `log_rules tells the assistant ${key}`);
}
const log = pyBlock(fac, "def log_work_session(");
need(FAC, log, /check_timesheet_date_permission\(target_date, frappe\.session\.user\)/, "log_work_session checks the day for whoever is asking");

// 3. Nothing is assumed
// A half hour was once logged, and paid, on nobody's word
forbid(FAC, log, /\b0\.5\b/, "log_work_session invents no length");
need(FAC, log, /if dur_hours <= 0:\n\t\tfrappe\.throw\(_\("Not logged\. Say how long/, "log_work_session refuses a missing length");
// Blocks were made at 09:00 (logging) and 10:00 for an hour (a booked task)
for (const [fn, body] of [["log_work_session", log], ["quick_create_task", pyBlock(fac, "def quick_create_task(")]]) {
  forbid(FAC, body, /["'](09|10):00/, `${fn}: no block is put at 09:00 or 10:00 by default`);
}
need(FAC, log, /if not from_time:\n\t\t\t\tfrappe\.throw\(_\("Not logged\. Say when it started/, "a new block for logged time needs its start");
// With no task or project, the time once went on the day's first block, whatever it was
need(FAC, log, /if match_existing_block and \(task or project\):/, "logged time joins a block only by its task or project");
need(FAC, log, /"status": \["not in", \("Cancelled", "Rescheduled"\)\]/, "logged time never joins a cancelled or rescheduled block");
const qct = pyBlock(fac, "def quick_create_task(");
need(FAC, qct, /if not block_start:\n\t\t\tfrappe\.throw/, "booking a task's block needs its start");
need(FAC, qct, /if not block_end and flt\(expected_time\) <= 0:\n\t\t\tfrappe\.throw/, "booking a task's block needs its end or length");
const sw = pyBlock(fac, "def switch_timer(");
need(FAC, sw, /if not \(target_block or target_task\):\n\t\tfrappe\.throw/, "switch needs what comes next");

// 4. A session is saved as the page saves it
const qta = pyBlock(fac, "def quick_timer_action(");
const branch = (name) => (qta.match(new RegExp(`elif action ${name}:[\\s\\S]*?(?=\\n\\telif |\\n\\telse:)`)) || [""])[0];
// Starting over a running session once threw it away, unsaved
need(FAC, branch('== "start"'), /if running and running\.get\("status"\) == "active":\n[\s\S]*?frappe\.throw\(_\("Not started\. A session is already running/, "start refuses while a session runs");
need(FAC, branch('== "start"'), /"trackerNotes": title,/, "start keeps the title apart from the log lines (it was saved twice)");
need(FAC, branch('== "start"'), /frappe\.throw\(_\("Not started\. \{0\} is not a time/, "an unreadable start_time is refused, not read as now");
const stop = branch('== "stop"');
// Only the notes sent with stop were once saved; the session's own log was lost
need(FAC, stop, /compose_wrap_note\(active\.get\("trackerNotes"\), active\.get\("sessionNotesList"\), notes\)/, "stop saves the title, the log lines and the last line");
need(FAC, stop, /session_date=start_dt\.strftime\("%Y-%m-%d"\)/, "stop saves on the day the session started");
need(FAC, stop, /match_existing_block=False/, "stop never moves the time onto another block");
need(FAC, sw, /compose_wrap_note\(active\.get\("trackerNotes"\), active\.get\("sessionNotesList"\), current_session_notes\)/, "switch saves the title, the log lines and the last line");
const add = branch('in \\("add_line", "add_note"\\)');
need(FAC, add, /get_min_log_line_chars\(\)/, "a log line is held to Minimum Characters per Log Line");
need(FAC, add, /active\["linesRev"\] = /, "a new log line is stamped newest (keep_newer_lines)");
forbid(FAC, add, /active\["trackerNotes"\] =/, "a log line never replaces the title");
need(FAC, branch('== "discard"'), /frappe\.throw\(_\("Nothing to discard/, "discard with nothing running says so");
// adjust once moved every session it touched to today
const adj = pyBlock(fac, "def adjust_work_session(");
need(FAC, adj, /session_date=session_date or None,/, "adjust keeps the session's day unless told to move it");
forbid(FAC, adj, /nowdate\(\)/, "adjust never assumes today");

// 5. Cancelling a block
const PWB = JSON.parse(read("omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.json"));
const options = PWB.fields.find((f) => f.fieldname === "cancel_reason").options.split("\n").filter(Boolean);
need(FAC, fac, /def _cancel_reasons_from_doctype\(\):[\s\S]*?planned_work_block\.json/, "the cancel reasons are read from the DocType");
const enums = fac.match(/"cancel_reason": \{"type": "string", "enum": CANCEL_REASONS,/g) || [];
if (enums.length !== 3) problems.push(`${FAC}: cancel_reason is the DocType's options in the update, cancel and schedule tools (found ${enums.length})`);
need(FAC, pyBlock(fac, "def update_work_block("), /cancel_note=cancel_note\n/, "update_work_block passes the note on");
const sched = pyBlock(fac, "def omnitrack_schedule(");
need(FAC, sched, /elif act == "cancel":\n\t\treturn cancel_work_block\(\n\t\t\tblock_name=block_name,\n\t\t\tcancel_reason=cancel_reason,\n\t\t\tcancel_note=cancel_note,/, "omnitrack_schedule cancels with the person's reason and note");
need(FAC, pyBlock(fac, "class OmniTrackScheduleTool("), /"enum": \["plan", "reschedule", "extend", "approve", "update", "get_block", "cancel"\]/, "the schedule tool offers every action it dispatches");
need(FAC, pyBlock(fac, "class OmniTrackCancelWorkBlockTool("), /"required": \["block_name", "cancel_reason"\]/, "the cancel tool needs a block and a reason");
need("omnitrack/hooks.py", read("omnitrack/hooks.py"), /"omnitrack\.fac\.OmniTrackCancelWorkBlockTool"/, "the cancel tool is registered");
need(FAC, pyBlock(fac, "def get_fac_tools("), /OmniTrackCancelWorkBlockTool,/, "get_fac_tools lists the cancel tool");
const PL = "omnitrack/api/planner.py";
const planner = read(PL);
const check = pyBlock(planner, "def _check_cancellable(");
need(PL, check, /if block_date < today:\n\t\tfrappe\.throw/, "a past block is not cancelled");
need(PL, check, /if cancel_reason not in reasons:\n\t\tfrappe\.throw/, "only the DocType's reasons are taken");
need(PL, check, /active\.get\("status"\) == "active" and active\.get\("trackerBlockName"\) == doc\.name:\n\t\tfrappe\.throw/, "a block a session records on is not cancelled");
need(PL, pyBlock(planner, "def update_work_block("), /if status == "Cancelled":\n\t\t_check_cancellable\(doc, cancel_reason\)/, "update_work_block checks every cancel");
if (JSON.stringify(options) !== JSON.stringify(["Client No-Show", "Client Requested Reschedule", "Dependency Blocked", "Internal Priority Shift", "Meeting Cancelled", "Other"])) {
  problems.push("planned_work_block.json: cancel_reason's options changed; check workBlockStore's cancelReasons and this list");
}

// 6. Asked first
for (const cls of ["OmniTrackDeleteWorkSessionTool", "OmniTrackDiscardTimerTool", "OmniTrackCancelWorkBlockTool"]) {
  need(FAC, pyBlock(fac, `class ${cls}(`), /[Aa]sk the person first/, `${cls} tells the assistant to ask the person first`);
}
need(FAC, pyBlock(fac, "class OmniTrackSessionTool("), /'discard' \([^)]*ask the person first\)[\s\S]*'delete' \([^)]*ask the person first/, "the session tool asks first before discard and delete");

// 7. No old rule is told to the assistant
const stale = /3 char|today and yesterday|today\/yesterday|configured horizon|8h target|8\.0-hour target|logged timesheets/i;
forbid(FAC, fac, stale, "no outdated rule in a tool's text (3 characters, today and yesterday, the horizon)");
forbid("docs/OMNITRACK_FAC_INTEGRATION.md", read("docs/OMNITRACK_FAC_INTEGRATION.md"), stale, "no outdated rule in the FAC guide");

if (problems.length) {
  console.error("FAIL: FAC tools:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK: the FAC tools keep the log window, assume nothing, save sessions as the page does, cancel only for a real reason and ask first");
