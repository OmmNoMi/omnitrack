#!/usr/bin/env node
// A planned block reminds its owner ten minutes before and at its start. Two sources send it:
// the server's minute job (over the realtime socket and the push relay) and the open app's own
// clock. Each reminder goes out once. The socket joins the site's own namespace, which bundled
// code can only learn from the page, never from Jinja.
// The day timeline opens what each lane draws: the block, or that one session of it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dueReminders, reminderKey, LEAD_MIN, START_GRACE_MIN } from "../src/utils/blockReminders.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (ok, what) => { if (!ok) problems.push(what); };

const day = "2026-10-06";
const at = (start, extra = {}) => ({ name: "PWB-" + start, work_date: day, start_time: start + ":00", status: "Planned", employee: "me@x", ...extra });
const kinds = (blocks, minute, more = {}) => dueReminders(blocks, { date: day, minute, user: "me@x", ...more }).map((d) => d.kind + "@" + d.until);

need(kinds([at("19:00")], 18 * 60 + 50).join() === "upcoming_10m@10", "ten minutes before: the early reminder");
need(kinds([at("19:00")], 18 * 60 + 49).join() === "", "eleven minutes before: nothing yet");
need(kinds([at("19:00")], 18 * 60 + 59).join() === "upcoming_10m@1", "a late tab still sends the early reminder");
need(kinds([at("19:00")], 19 * 60).join() === "start_on_time@0", "at the start: the start reminder");
need(kinds([at("19:00")], 19 * 60 + 5).join() === "start_on_time@-5", "five minutes late: still sent");
need(kinds([at("19:00")], 19 * 60 + 6).join() === "", "six minutes late: too late to remind");
need(kinds([at("19:00", { status: "In Progress" })], 19 * 60).join() === "", "a started block is not reminded");
need(kinds([at("19:00", { status: "Cancelled" })], 19 * 60).join() === "", "a cancelled block is not reminded");
need(kinds([at("19:00", { status: "Draft" })], 19 * 60).join() === "start_on_time@0", "a draft block is reminded");
need(kinds([at("19:00", { employee: "other@x" })], 19 * 60).join() === "", "someone else's block is not mine to be reminded of");
need(kinds([at("19:00", { work_date: "2026-10-07" })], 19 * 60).join() === "", "only today's blocks");
need(kinds([at("19:00")], 19 * 60, { runningBlock: "PWB-19:00" }).join() === "", "the block already running is not reminded");
need(reminderKey(day, "PWB-1", "start_on_time") !== reminderKey(day, "PWB-1", "upcoming_10m"), "each reminder has its own key");

// The server's windows are the same numbers.
const py = read("omnitrack/notifications.py");
need(new RegExp(`REMINDER_LEAD_MIN = ${LEAD_MIN}\\b`).test(py) && new RegExp(`REMINDER_START_GRACE_MIN = ${START_GRACE_MIN}\\b`).test(py),
  "notifications.py: REMINDER_LEAD_MIN / REMINDER_START_GRACE_MIN must equal blockReminders.js");
need(/kind = reminder_kind\(delta_mins\)/.test(py) && !/8 <= delta_mins <= 11|-1 <= delta_mins <= 2/.test(py),
  "notifications.py: decide with reminder_kind(), not narrow fixed windows a late job misses");
need(!/action_url = f"\/omnitrack\?action=start_block/.test(py), "notifications.py: tapping a reminder opens the block; only its Start session button starts one");

// The app: one deduplicated path, its own clock, a system notification whenever the window is not in front.
const eod = read("src/composables/useWorkstationEod.js");
need(!/\{\{\s*frappe/.test(eod), "useWorkstationEod.js: bundled code is never rendered by Jinja; read the site from window.OMNITRACK_SESSION");
need(/const siteName = page\.site \|\| host;/.test(eod), "useWorkstationEod.js: the socket namespace is the page's site");
need(/setInterval\(checkBlockReminders,/.test(eod), "useWorkstationEod.js: the app's own reminder clock runs");
need(/localStorage\.getItem\(key\)\) return;/.test(eod), "useWorkstationEod.js: a reminder already shown is not shown again");
need(/!document\.hasFocus\(\)/.test(eod), "useWorkstationEod.js: notify when the window is not in front, not only when the tab is hidden");
const fui = read("src/frappeUiComponents.js");
need(/export const FRAPPE_UI_OPTIONS = \{ socketio: false \};/.test(fui), "frappeUiComponents.js: frappe-ui's own socket stays off (it dials port 9000 to an unset site and retries forever)");
for (const f of ["src/main.js", "src/session/main.js"]) {
  const src = read(f);
  need(/app\.use\(FrappeUI/.test(src) && !/app\.use\(FrappeUI\)/.test(src), `${f}: install FrappeUI with FRAPPE_UI_OPTIONS, never bare`);
}
const html = read("omnitrack/www/omnitrack.html");
need(/site: "\{\{ site_name \}\}"/.test(html) && /socketio_port: \{\{ socketio_port \| int \}\}/.test(html), "omnitrack.html: the page tells the app its site and socket port");
const page = read("omnitrack/www/omnitrack.py");
need(/ctx\.site_name = frappe\.local\.site/.test(page), "omnitrack.py: set ctx.site_name");

// The timeline: the logged lane opens its own entry.
const tl = read("src/views/dashboard/DashboardTimeline.vue");
const loggedLane = tl.slice(tl.indexOf("<!-- logged lane -->"), tl.indexOf("Gap Booking"));
need(/@click="openLogged\(r\)"/.test(loggedLane) && /@keydown\.enter\.prevent="openLogged\(r\)"/.test(loggedLane) && !/openBlockDrawer/.test(loggedLane),
  "DashboardTimeline.vue: a logged bar opens its session, not the block");
need(/this\.openSessionDrawer\(r\.block, r\.session\)/.test(tl) && !/openEditSessionModal/.test(tl), "DashboardTimeline.vue: a logged bar opens that entry's details sheet, never the entry form");
// One entry form: the form has no read-only mode of its own; details live in the sheet.
const entry = read("src/components/dialogs/TimesheetEntryDialog.vue");
need(!/viewing|isViewing|data-entry-view/.test(entry), "TimesheetEntryDialog.vue: the one entry form is only a form; details belong in SessionDetailDrawer");
const modals = read("src/composables/useWorkstationSessionModals.js");
need(/const openEditSessionModal = \(block, session = \{\}\) => \{/.test(modals) && !/viewing:/.test(modals), "useWorkstationSessionModals.js: openEditSessionModal only opens the form");
// The sheet: a modal dialog that reads the entry from the server, shows the task moves and
// approval, and sends edits to the one form. Block and tasks may both be missing.
const sheet = read("src/drawers/SessionDetailDrawer.vue");
need(/role="dialog" aria-modal="true" aria-labelledby="session-drawer-title"/.test(sheet) && /id="session-drawer-title"/.test(sheet), "SessionDetailDrawer.vue: a labelled modal dialog");
need(/postJSON\('get_work_session'/.test(sheet), "SessionDetailDrawer.vue: reads the entry with get_work_session");
need(/v-if="moves\.length"/.test(sheet) && /task_moves/.test(sheet), "SessionDetailDrawer.vue: shows the task moves made while the entry ran");
need(/\$emit\('edit-session', session, entry\.block\)/.test(sheet) && !/<Textarea|<DayTimeFields|<TimePicker/.test(sheet), "SessionDetailDrawer.vue: no inputs of its own; Edit opens the one entry form");
need(/v-if="!block\.unplanned"/.test(sheet) && /v-if="tasks\.length"/.test(sheet), "SessionDetailDrawer.vue: an unplanned entry shows no plan, an entry with no tasks no task list");
need(/\$emit\('approve-block', entry\.block\)/.test(sheet) && /\$emit\('flag-block', this\.entry\.block, reason\)/.test(sheet), "SessionDetailDrawer.vue: a manager approves or flags the entry here");
// A task row shows its workflow state, and every move it offers goes through the one task form
need(/taskState\(t\) \{ return t\.state \|\| t\.status/.test(sheet) && /<Dropdown v-if="taskMoves\(t\)\.length" :options="taskMoves\(t\)"/.test(sheet), "SessionDetailDrawer.vue: a task row shows its workflow state with the moves open from it");
need(/onClick: \(\) => openTaskForm\(t, \{ block: this\.entry && this\.entry\.block, ask: a\.action \}\)/.test(sheet) && !/execute_task_workflow_action/.test(sheet), "SessionDetailDrawer.vue: a move opens the task form at its confirm step, never applies itself");
need(/ArrowRight: \[r, cols\(r\)\], ArrowLeft: \[r, 0\]/.test(sheet) && /clampCell\(\);/.test(sheet), "SessionDetailDrawer.vue: the task list is one tab stop, Left/Right between a task and its status");
need(/sheet\.querySelector\('\[data-sheet-close\]'\)/.test(sheet) && /if \(lost && opener && document\.contains\(opener\)\) opener\.focus\(\);/.test(sheet), "SessionDetailDrawer.vue: focus moves into the sheet and back to its opener on close");
// The bottom bar: New task for everyone (a manager plans their own work too), Team on top for managers.
// It is a navigation landmark (aria-current), not a tablist: it also holds two actions.
const navSrc = read("src/components/layout/WorkstationBottomNav.vue");
need(/<Button\n        variant="ghost"\n        theme="gray"[\s\S]*?label="Create a new task"/.test(navSrc) && !/v-else[\s\S]{0,200}Create a new task/.test(navSrc), "WorkstationBottomNav.vue: New task shows for managers too, never as the else of Team");
need(!/role="tab/.test(navSrc) && /:aria-current="activeTab === 'attendance' \? 'page' : null"/.test(navSrc), "WorkstationBottomNav.vue: a navigation bar marks the current page with aria-current, no tab roles");
// Planner blocks: the title wraps onto the lines the block has, never one clipped line
const gridSrc = read("src/views/calendar/CalendarPlannerGrid.vue");
need(/:style="clampStyle\(titleLines\(seg\)\)"/.test(gridSrc) && /isSplit\(seg\) \? 'px-1' : 'px-2'/.test(gridSrc), "CalendarPlannerGrid.vue: a block's title wraps, and a split lane gives it its width");
need(/const time = !this\.isSplit\(seg\) && lines >= 2;/.test(gridSrc), "CalendarPlannerGrid.vue: a split lane leaves its time to the hover card");
need(/text-left text-base \[overflow-wrap:anywhere\]/.test(sheet) && !/<button type="button" class="[^"]*truncate[^"]*"[^>]*data-cell/.test(sheet), "SessionDetailDrawer.vue: a task's full name shows, wrapped, never cut off");
const taskFormSrc = read("src/components/dialogs/TaskFormDialog.vue");
need(/const wanted = taskForm\.ask;\s*taskForm\.ask = null;[\s\S]*?if \(a\) this\.ask\(a\);/.test(taskFormSrc), "TaskFormDialog.vue: opened with ask, the form goes straight to that move's confirm step");
const eodSrc = read("src/composables/useWorkstationEod.js");
need(/else if \(showSessionDrawer\.value\) showSessionDrawer\.value = false;/.test(eodSrc) && /showBlockDrawer, showSessionDrawer, showTaskRavenDrawer\]/.test(eodSrc), "useWorkstationEod.js: Escape closes the entry sheet and the page stays locked under it");
const tsPy = read("omnitrack/api/timesheet.py");
need(/_TASK_STATE_FIELDS = \("status", "workflow_state"\)/.test(tsPy), "timesheet.py: a task move is a status or a workflow_state change");
need(/def get_work_session\(session_name\):[\s\S]*?has_work_block_permission\(block, "read"\)/.test(tsPy), "timesheet.py: get_work_session checks the block's read permission");
need(/"tasks": \[_with_workflow\(t\) for t in block_tasks\(block\)\]/.test(tsPy) && /frappe\.has_permission\(doctype, "read", name\)/.test(tsPy), "timesheet.py: get_work_session sends each task's workflow state and moves, only for tasks the viewer may read");
need(/b_doc\.approval_notes = b_doc\.flagged_reason/.test(tsPy),"timesheet.py: flag_work_block keeps the reason in approval_notes (the block has no flagged_reason field)");
// An approval can be taken back by its approver, briefly, and the server keeps what it replaced
need(/before = \{f: b_doc\.get\(f\) for f in REVIEW_FIELDS\}/.test(tsPy) && /_remember_review\(b_name, approver, before\)/.test(tsPy), "timesheet.py: approve_work_blocks keeps what each approval replaced, so it can be undone");
need(/if not saved or saved\.get\("by"\) != user:/.test(tsPy) && /b_doc\.approved_by != user:/.test(tsPy), "timesheet.py: only the approver can undo an approval, and only while it stands as they left it");
need(/docstatus"\) != 0:/.test(tsPy) && /frappe\.delete_doc\("Timesheet", made/.test(tsPy), "timesheet.py: undo removes the draft Timesheet its approval made, never a submitted one");
need(/action: \{ label: 'Undo', onClick: \(\) => undoApproval\(b\) \}, duration: UNDO_APPROVAL_MS/.test(eodSrc) && /const UNDO_APPROVAL_MS = 5000;/.test(eodSrc), "useWorkstationEod.js: an approval offers Undo for 5 seconds");
const appSrc = read("src/App.vue");
const bindSrc = read("src/composables/useWorkstationStoreBindings.js");
need(/v-if="toast\.action"[^>]*@click="runToastAction"/.test(appSrc) && /@mouseenter="holdToast"[^>]*@focusin="holdToast"/.test(appSrc), "App.vue: the toast shows its action, and waits while it is hovered or focused");
need(/clearTimeout\(toastTimer\);\s*toastLeft = ms;/.test(bindSrc), "useWorkstationStoreBindings.js: a new toast restarts the timer, so an old timer cannot close it early");
const pwb = JSON.parse(read("omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.json"));
need(/\nFlagged\n/.test((pwb.fields.find((f) => f.fieldname === "approval_status") || {}).options || ""), "planned_work_block.json: approval_status allows Flagged, or every Flag is rejected");
const planner = read("omnitrack/api/planner.py");
need(/"name": s\.name,/.test(planner) && /fields=\["name", "session_date"/.test(planner), "planner.py: each served session carries its name, or it cannot be opened");
// The dashboard's own feed: without the row name the logged bar silently falls back to the block.
const ws = read("omnitrack/api/workstation.py");
need(/SELECT name, parent, session_date/.test(ws), "workstation.py: the dashboard's sessions carry their name, or the logged bar opens the block");

if (problems.length) {
  console.error("FAIL: block reminders and timeline lanes\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: block reminders go out once, from the server or the app, and each timeline lane opens its own thing.");
