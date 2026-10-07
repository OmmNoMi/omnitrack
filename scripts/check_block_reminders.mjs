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
import { noteLines, noteHeading } from "../src/utils/wrapNote.js";

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
need(/role="dialog" aria-modal="true" aria-labelledby="session-drawer-kind session-drawer-title"/.test(sheet) && /id="session-drawer-title"/.test(sheet), "SessionDetailDrawer.vue: a modal dialog named by its kind and title");
need(/postJSON\('get_work_session'/.test(sheet), "SessionDetailDrawer.vue: reads the entry with get_work_session");
need(/v-if="moves\.length"/.test(sheet) && /task_moves/.test(sheet), "SessionDetailDrawer.vue: shows the task moves made while the entry ran");
need(/\$emit\('edit-session', session, entry\.block\)/.test(sheet) && !/<Textarea|<DayTimeFields|<TimePicker/.test(sheet), "SessionDetailDrawer.vue: no inputs of its own; Edit opens the one entry form");
need(/v-if="!block\.unplanned"/.test(sheet) && /v-if="tasks\.length"/.test(sheet), "SessionDetailDrawer.vue: an unplanned entry shows no plan, an entry with no tasks no task list");
need(/\$emit\('approve-block', entry\.block\)/.test(sheet) && /\$emit\('flag-block', this\.entry\.block, reason\)/.test(sheet), "SessionDetailDrawer.vue: a manager approves or flags the entry here");
// A task row shows its workflow state, and every move it offers goes through the one task form
need(/taskState\(t\) \{ return t\.state \|\| t\.status/.test(sheet) && !/taskMoves/.test(sheet), "SessionDetailDrawer.vue: a task row shows its workflow state; its steps live in the task panel's action bar, not a menu on the row");
need(/openTask\(t\) \{\s*openTaskDetail\(t, /.test(sheet) && !/openTaskForm|execute_task_workflow_action/.test(sheet), "SessionDetailDrawer.vue: a task opens its details panel, never the form or a move straight away");
need(/ArrowDown: Math\.min\(last, r \+ 1\), ArrowUp: Math\.max\(0, r - 1\)/.test(sheet) && /clampCell\(\);/.test(sheet), "SessionDetailDrawer.vue: the task list is one tab stop, Up/Down between tasks");
need(/sheet\.querySelector\('\[data-sheet-close\]'\)/.test(sheet) && /if \(lost && opener && document\.contains\(opener\)\) opener\.focus\(\);/.test(sheet), "SessionDetailDrawer.vue: focus moves into the sheet and back to its opener on close");
// The block sheet is a modal too: Escape once dropped focus on <body>
const blockSheet = read("src/drawers/BlockDetailDrawer.vue");
need(/ref="sheet"/.test(blockSheet) && /label="Close" data-sheet-close/.test(blockSheet) && /openKey\(key\) \{ if \(key\) this\.open\(\); else this\.closed\(\); \}/.test(blockSheet) && /sheet\.querySelector\('\[data-sheet-close\]'\)/.test(blockSheet) && /if \(lost && opener && document\.contains\(opener\)\) opener\.focus\(\);/.test(blockSheet), "BlockDetailDrawer.vue: focus moves into the sheet and back to its opener on close");
need(/openKey\(\) \{ return !this\.inline && /.test(blockSheet), "BlockDetailDrawer.vue: the inline details never take or move focus");
// The bottom bar: Tasks for everyone, Team on top for managers. "New task" opened the plan
// dialog under a task's name, so it is gone; planning starts from a task, a day or the calendar.
// It is a navigation landmark (aria-current), not a tablist: it also holds the session button.
const navSrc = read("src/components/layout/WorkstationBottomNav.vue");
need(/<Button\n        variant="ghost"\n        :theme="activeTab === 'tasks' \? 'blue' : 'gray'"[\s\S]*?:aria-current="activeTab === 'tasks' \? 'page' : null"\n        label="Tasks"/.test(navSrc), "WorkstationBottomNav.vue: Tasks is a page in the bar, for everyone");
need(!/New task|open-new-task/i.test(navSrc) && !/open-new-task/.test(read("src/App.vue")), "WorkstationBottomNav.vue: no New task button (it opened the plan dialog)");
need(/label: 'Plan a block'/.test(read("src/composables/useWorkstationPickers.js")) && !/'New Task'/.test(read("src/composables/useWorkstationPickers.js")), "useWorkstationPickers.js: the header menu names what it opens: Plan a block");
// The Tasks page: every open task grouped by what to do next, one tab stop, and the shared
// task form, plan dialog and start flow. It never applies a workflow move itself.
const tasksView = read("src/views/TasksView.vue");
need(/id: 'overdue'[\s\S]*?id: 'today'[\s\S]*?id: 'unplanned'[\s\S]*?id: 'planned'/.test(tasksView), "TasksView.vue: groups run Overdue, Due today, Not planned yet, Planned");
need(/for \(const t of items\) left\.splice/.test(tasksView), "TasksView.vue: a task sits in one group only");
need(/tabindex\(t, col\) \{ return this\.current\[0\] === t\.ref && this\.current\[1\] === col \? 0 : -1; \}/.test(tasksView) && /e\.key === 'ArrowDown'/.test(tasksView) && /e\.key === 'ArrowRight'/.test(tasksView) && /e\.key === 'Home'/.test(tasksView), "TasksView.vue: one tab stop, arrows rove rows and actions");
need(/openTaskDetail\(t, \{ onChange:/.test(tasksView) && /@click="planAttentionTask\(t\)"/.test(tasksView) && /@click="startTaskImmediately\(t\)"/.test(tasksView) && !/execute_task_workflow_action|<Dialog|<FDialog/.test(tasksView), "TasksView.vue: rows open the task details panel (its Edit the one task form), Plan the one plan dialog, play the one start flow");
need(/<Combobox[^>]*aria-label="Show tasks for project"/.test(tasksView) && /<Combobox[^>]*aria-label="Show tasks for"/.test(tasksView), "TasksView.vue: project and person filters are searchable Comboboxes");
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
// A Flag's reason is kept in approval_notes. Every feed that draws an approval sends both fields,
// and no screen reads the flagged_reason field the block does not have.
need(/"approval_status", "approval_notes",/.test(planner), "planner.py: the calendar's blocks carry approval_status and approval_notes, or every logged block reads as awaiting approval");
need((ws.match(/approval_status, approval_notes\n|"approval_status", "approval_notes"/g) || []).length === 3, "workstation.py: all three block queries send approval_notes");
need(/"approval_status", "approval_notes", "pairing_partner"/.test(tsPy), "timesheet.py: pending approvals send approval_notes");
for (const f of ["src/utils/approval.js", "src/components/common/BlockHoverCard.vue", "src/views/calendar/CalendarPlannerGrid.vue", "src/drawers/BlockDetailDrawer.vue", "src/views/TimesheetsView.vue", "src/composables/useWorkstationEod.js"]) {
  need(!/flagged_reason/.test(read(f)), `${f}: reads flagged_reason, which the block does not have (use approval_notes)`);
}
// A details surface shows names in full: the hover card and the drawers' task lists never clamp a title.
for (const f of ["src/components/common/BlockHoverCard.vue", "src/drawers/BlockTasksSection.vue", "src/drawers/SessionDetailDrawer.vue"]) {
  need(!/line-clamp|class="truncate"[^>]*>\s*\{\{\s*(t\.subject|blockTitle|project|person|hoverCard\.block\.project)/.test(read(f)), `${f}: a name is clamped where its details are meant to be read in full`);
}
const plannerState = read("src/composables/useWorkstationPlannerState.js");
need(/placeHoverCard\(r, card\.offsetHeight\)/.test(plannerState) && /nav\[aria-label="Workstation navigation"\]/.test(plannerState), "useWorkstationPlannerState.js: the hover card is placed by its measured height and kept clear of the bottom bar");
// The dot alone is aria-hidden and takes no pointer, so the words must be on the block's name and its hover card.
need(/\{\{ approval\.label \}\}/.test(read("src/components/common/BlockHoverCard.vue")), "BlockHoverCard.vue: the hover card says where the entry stands in review");
// The hover card names a block once and lists what got done under it. Session notes start with
// the title, so a title made of the notes says the name twice and runs every line together.
const card = read("src/components/common/BlockHoverCard.vue");
need(!/seg\.notes\)?\s*\|\|/.test(card) && /<div class="text-sm font-semibold leading-snug break-words">\{\{ title \}\}<\/div>/.test(card) && /title\(\) \{\n\s*return blockTitle\(this\.hoverCard\.block,/.test(card), "BlockHoverCard.vue: the card's title is the block's name, never its notes");
need(/return noteLines\(raw, this\.title\);/.test(card) && /v-for="\(line, i\) in notes\.slice\(0, NOTE_LINES\)"/.test(card) && /^const NOTE_LINES = 3;$/m.test(card), "BlockHoverCard.vue: the notes show as a short list of lines under the title");
need(/durationLabel\(Math\.max\(1, Math\.round\(hours \* 60\)\)\) \+ ' logged'/.test(card) && !/h logged/.test(card), "BlockHoverCard.vue: logged time reads in minutes under an hour (2m, not 0.03h)");
need(/w-72 /.test(card) && /window\.innerWidth - 298\)/.test(plannerState), "BlockHoverCard.vue: the card is 18rem wide and kept that far from the right edge");
need(/<span class="truncate">\{\{ loggedName\(r\) \}\}<\/span>/.test(tl) && /return blockTitle\(r\.block, ''\) \|\| noteHeading\(r\.notes\) \|\|/.test(tl) && /:aria-label="'Logged: ' \+ loggedName\(r\) \+ ', ' \+ loggedLength\(r\)/.test(tl), "DashboardTimeline.vue: a logged bar is named like its block, never by its whole notes");
need(/durationLabel\(Math\.max\(1, Math\.round\(\(Number\(r\.hours\) \|\| 0\) \* 60\)\)\)/.test(tl) && !/fmtHrs|REC /.test(tl), "DashboardTimeline.vue: a logged bar's length reads in minutes under an hour, with no REC tag");
const heads = [noteHeading("• Completed: A\nFix the boiler\n• Called Sam"), noteHeading("Completed: A\n- B"), noteHeading("")];
need(JSON.stringify(heads) === JSON.stringify(["Fix the boiler", "", ""]), "wrapNote.noteHeading: a session is named by its first line that is not a logged step (got " + JSON.stringify(heads) + ")");
const lines = noteLines("Fix the boiler\n\n• Completed: Order parts\n* Called Sam\n- Completed:  Fix the boiler\n", "Fix the boiler");
need(JSON.stringify(lines) === JSON.stringify([{ text: "Completed", done: true }, { text: "Order parts", done: true }, { text: "Called Sam", done: false }]), "wrapNote.noteLines: notes read back one per entry, bullets dropped, ticked tasks marked done, and the title's own task as \"Completed\" first, never its name again (got " + JSON.stringify(lines) + ")");
need(JSON.stringify(noteLines("Fix the boiler", "FIX the Boiler ")) === "[]", "wrapNote.noteLines: a note that only repeats the title adds nothing");
need(/<FeatherIcon v-if="line\.done" name="check-circle"[^>]*aria-hidden="true" \/>/.test(card) && /class="sr-only">Done: <\/span>\{\{ line\.text \}\}/.test(card), "BlockHoverCard.vue: a ticked task shows a check, and says Done to screen readers");
need(/:aria-label="\[blockTitle\(seg\.block\), segTimeTitle\(seg\), approvalLabel\(seg\.block\)\]/.test(gridSrc), "CalendarPlannerGrid.vue: a calendar block's name says where it stands in review");
// The dot is aria-hidden and pointer-events-none, so a title on it can never show
// The entry sheet words its review through approvalState too, so the screens cannot drift apart
need(/approval\(\) \{\n\s*const s = approvalState\(this\.block\);/.test(sheet) && !/label: 'Awaiting approval'/.test(sheet), "SessionDetailDrawer.vue: the sheet's approval chip comes from approvalState, not its own wording");
// The dashboard refreshes on a timer: the sheet re-reads only when its own block changed,
// and when a task it opened in the task form was saved or moved
need(!/\n    workBlocks\(\) \{/.test(sheet) && /blockStamp\(now, before\) \{ if \(now !== before/.test(sheet), "SessionDetailDrawer.vue: the sheet re-reads only when its block changed, not on every dashboard refresh");
need(/openTaskDetail\(t, \{ block: this\.entry && this\.entry\.block, onChange: \(\) => this\.load\(\) \}\)/.test(sheet), "SessionDetailDrawer.vue: a task saved or moved from the sheet reads the sheet again");
need(!/approvalDot\(seg\.block\)[^>]*:title=/.test(gridSrc), "CalendarPlannerGrid.vue: the approval dot carries no title nobody can see");

if (problems.length) {
  console.error("FAIL: block reminders and timeline lanes\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: block reminders go out once, from the server or the app, and each timeline lane opens its own thing.");
