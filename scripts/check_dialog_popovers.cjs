#!/usr/bin/env node
/**
 * Static check: popovers opened from inside a dialog stay usable.
 *
 * 1. Every frappe-ui popover (TimePicker list, DatePicker calendar, Dropdown, Combobox)
 *    is portalled to <body>. Once `.dialog-overlay` was lifted to z-50 they opened
 *    *behind* their dialog. The reka popper wrapper must sit above the overlay, with
 *    !important because reka writes the content's own `z-index: auto` inline on it.
 * 2. Escape inside an open popover closes the popover only. A popover that handles
 *    Escape calls preventDefault, so every document-level Escape handler that closes a
 *    dialog must bail out on `e.defaultPrevented`, or one Escape closes both.
 * 3. FDialog keeps its own guard for the frappe-ui Dialog's escape-key-down path.
 * 4. ChoiceChips is a real radio group: role=radiogroup/radio, aria-checked, one tab
 *    stop (roving tabindex) and arrow / Home / End keys.
 * 5. The plan dialog's End picker lists lengths ("2:30 pm (1.5 hrs)"), which only works
 *    while it is fed `endOptions` instead of a bare interval.
 * 6. A popover whose focus stays on its trigger (MultiSelect) closes on Escape before the
 *    key bubbles to the document, so the dialog handler must note `popoverOpen()` in the
 *    capture phase and skip that Escape.
 * 7. The plan dialog's task list is readable: names wrap instead of truncating, each row
 *    says how due it is, there is no separate Change control (remove and add instead),
 *    and "Whose calendar" names the person rather than saying "Your calendar".
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const problems = [];

// 1. layering
const css = read('src/styles/main.css');
const overlay = css.match(/\.dialog-overlay\s*\{[^}]*z-index:\s*(\d+)/);
const popper = css.match(/\[data-reka-popper-content-wrapper\]\s*\{[^}]*z-index:\s*(\d+)\s*(!important)?/);
if (!overlay) problems.push('main.css: .dialog-overlay has no z-index (page chrome paints over dialogs)');
if (!/\[data-reka-popper-content-wrapper\]\s*\{\s*will-change:\s*auto\s*!important/.test(css)) {
  problems.push('main.css: popper wrapper needs will-change: auto !important (reka\'s inline will-change: transform blurs list text)');
}
if (!popper) problems.push('main.css: [data-reka-popper-content-wrapper] has no z-index (popovers open behind dialogs)');
else {
  if (!popper[2]) problems.push('main.css: popper wrapper z-index needs !important (reka sets z-index inline)');
  if (overlay && Number(popper[1]) <= Number(overlay[1])) {
    problems.push(`main.css: popper wrapper z-index ${popper[1]} must be above .dialog-overlay ${overlay[1]}`);
  }
}

// 2. document Escape handlers that close dialogs
function walkVue(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkVue(path.join(dir, e.name)) : e.name.endsWith('.vue') ? [path.join(dir, e.name)] : []);
}
const eod = read('src/composables/useWorkstationEod.js');
const handler = eod.match(/onPlannerKeydown\s*=\s*\(e\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/) ||
  eod.match(/function onPlannerKeydown\s*\(e\)\s*\{([\s\S]*?)\n\s{2}\}/);
if (!handler) problems.push('useWorkstationEod.js: onPlannerKeydown not found (update this check if it moved)');
else if (!/if\s*\(\s*e\.defaultPrevented\s*\)\s*return/.test(handler[1])) {
  problems.push('useWorkstationEod.js: onPlannerKeydown must `if (e.defaultPrevented) return;` so Escape in a popover does not close the dialog');
}

// 6. Escape for a popover whose trigger keeps focus
if (!/notePopoverEscape\s*=\s*\(e\)\s*=>\s*\{[^}]*popoverOpen\(\)/.test(eod)) {
  problems.push('useWorkstationEod.js: notePopoverEscape must record popoverOpen() for each Escape');
}
if (!/addEventListener\(\s*['"]keydown['"]\s*,\s*notePopoverEscape\s*,\s*true\s*\)/.test(eod)) {
  problems.push('useWorkstationEod.js: notePopoverEscape must listen in the capture phase (reka closes the list before the key bubbles)');
}
if (handler && !/if\s*\(\s*escForPopover\s*\)/.test(handler[1])) {
  problems.push('useWorkstationEod.js: onPlannerKeydown must skip an Escape that closed a popover (escForPopover)');
}

// 3. FDialog guard
const fdialog = read('src/components/common/FDialog.vue');
if (!/if\s*\(\s*!v\s*&&\s*this\.escOwnedByPopover\s*\)\s*return/.test(fdialog)) {
  problems.push('FDialog.vue: open setter must ignore a close while escOwnedByPopover');
}
if (!/addEventListener\(\s*['"]keydown['"]\s*,\s*this\.noteEscape\s*,\s*true\s*\)/.test(fdialog)) {
  problems.push('FDialog.vue: noteEscape must listen in the capture phase (before the dialog sees Escape)');
}

// 4. ChoiceChips radio group
const chips = read('src/components/common/ChoiceChips.vue');
const need = [
  [/role="radiogroup"/, 'role="radiogroup" on the group'],
  [/role="radio"/, 'role="radio" on each chip'],
  [/:aria-checked=/, ':aria-checked on each chip'],
  [/:tabindex="i === focusIndex \? 0 : -1"/, 'roving tabindex (one tab stop)'],
  [/ArrowRight:\s*1[\s\S]*ArrowLeft:\s*-1/, 'ArrowLeft/ArrowRight move the choice'],
  [/["']Home["'][\s\S]*["']End["']/, 'Home/End keys'],
  [/\.focus\(\)/, 'focus follows the new choice'],
];
for (const [re, what] of need) if (!re.test(chips)) problems.push(`ChoiceChips.vue: missing ${what}`);

// 5. End picker shows lengths (it lives in the shared DayTimeFields)
const plan = read('src/components/dialogs/PlanWorkBlockDialog.vue');
const dayTime = read('src/components/common/DayTimeFields.vue');
const endPicker = dayTime.match(/<TimePicker[^>]*placeholder="End"[^>]*>/);
if (!endPicker) problems.push('DayTimeFields.vue: End TimePicker not found');
else if (!/:options="endOptions"/.test(endPicker[0])) {
  problems.push('DayTimeFields.vue: End TimePicker must use :options="endOptions" (times with lengths)');
}

// 8. One "when" form: planning, a timesheet entry and rescheduling all use DayTimeFields,
//    and none of them falls back to a native date/time input.
const whenForms = {
  'src/components/dialogs/PlanWorkBlockDialog.vue': plan,
  'src/components/dialogs/TimesheetEntryDialog.vue': read('src/components/dialogs/TimesheetEntryDialog.vue'),
  'src/drawers/RescheduleBlockDialog.vue': read('src/drawers/RescheduleBlockDialog.vue'),
};
for (const [file, src] of Object.entries(whenForms)) {
  if (!/<DayTimeFields\b/.test(src)) problems.push(`${file}: day and time must come from the shared DayTimeFields`);
  if (/<input[^>]*type="(date|time|number)"/.test(src)) problems.push(`${file}: no native date/time/number inputs; use DayTimeFields`);
}

// 9. The block drawer: Start/Stop and Reschedule up front, the rarer actions behind More,
//    rescheduling in its own titled dialog, and its tasks ticked and edited in place.
const drawer = read('src/drawers/BlockDetailDrawer.vue');
const tasksSection = read('src/drawers/BlockTasksSection.vue');
const addDialog = read('src/drawers/AddBlockTasksDialog.vue');
const resched = whenForms['src/drawers/RescheduleBlockDialog.vue'];
if (/<DayTimeFields\b|<form[^>]*aria-label="Reschedule"/.test(drawer)) problems.push('BlockDetailDrawer.vue: no inline reschedule form; Reschedule opens RescheduleBlockDialog');
if (!/<RescheduleBlockDialog\b[^>]*v-model="showReschedule"/.test(drawer) || !/@click="showReschedule = true"/.test(drawer)) problems.push('BlockDetailDrawer.vue: Reschedule must open RescheduleBlockDialog');
if (!/title="Reschedule"/.test(resched) || !/\$emit\('submit', \{ \.\.\.this\.form \}\)/.test(resched)) problems.push('RescheduleBlockDialog.vue: a dialog titled Reschedule that submits its own form');
if (!/<Dropdown v-if="moreActions\.length"[\s\S]*?label="More"[^>]*>More<\/Button>/.test(drawer)) problems.push('BlockDetailDrawer.vue: rarer actions live in a menu behind a visible "More" button, not an unlabelled "..." icon');
const more = (drawer.match(/moreActions\(\)\s*\{[\s\S]*?return [^;]*;/) || [''])[0];
if (!/'Add work session'[\s\S]*?\$emit\('log-session'/.test(more)) problems.push('BlockDetailDrawer.vue: More actions must hold "Add work session" (log-session)');
if (!/'Cancel block'[\s\S]*?\$emit\('open-cancel-modal'/.test(more)) problems.push('BlockDetailDrawer.vue: More actions must hold "Cancel block"');
if (/label="Log work"|label="Cancel block" @click/.test(drawer)) problems.push('BlockDetailDrawer.vue: Log work / Cancel must not sit beside the primary actions');
if (!/<BlockTasksSection\b/.test(drawer)) problems.push('BlockDetailDrawer.vue: must list the block\'s tasks (BlockTasksSection)');
// A session runs now: Start session on an Oct 5 block would log today's work against Oct 5
if (!/<Button v-if="canStart"[^>]*label="Start session"/.test(drawer) || !/canStart\(\) \{[^}]*b\.work_date === this\.todayDate/.test(drawer)) problems.push('BlockDetailDrawer.vue: Start session shows only on today\'s block (canStart)');
if (!/block\.tasks/.test(tasksSection) || !/v-for="\(t, i\) in rows"/.test(tasksSection)) problems.push('BlockTasksSection.vue: must list every task linked to the block (block.tasks)');
const tick = (tasksSection.match(/<Button[^>]*role="checkbox"[\s\S]*?\/>/) || [''])[0];
if (!tick || !/:aria-checked=/.test(tick) || !/toggle\(t, !t\.done\)/.test(tick)) problems.push('BlockTasksSection.vue: each task needs a role=checkbox Button with aria-checked that marks it done');
if (/<Checkbox\b/.test(tasksSection)) problems.push('BlockTasksSection.vue: frappe-ui Checkbox puts a second tab stop on its wrapper; use the role=checkbox Button');
if (!/tabStop\(i, 0\)/.test(tasksSection) || !/ArrowDown/.test(tasksSection)) problems.push('BlockTasksSection.vue: task rows rove focus (one tab stop, arrows move)');
if (!/<AddBlockTasksDialog\b/.test(tasksSection)) problems.push('BlockTasksSection.vue: tasks are added in AddBlockTasksDialog');
if (!/'attach_tasks_to_block'/.test(addDialog) || !/<PlanTaskStep\b/.test(addDialog) || !/!have\.has\(o\.value\)/.test(addDialog)) problems.push('AddBlockTasksDialog.vue: adds through attach_tasks_to_block with the planning task list, less the block\'s own');

// 10. Escape in a dialog opened over the drawer closes that dialog only
if (!/markDialogEscape\(e\)/.test(fdialog)) problems.push('FDialog.vue: an open dialog must claim its Escape (markDialogEscape)');
if (!/else if \(dialogEsc\) return;\s*else if \(showSessionDrawer\.value\)[^\n]*\n\s*else if \(showBlockDrawer\.value\)/.test(eod)) problems.push('useWorkstationEod.js: Escape a dialog took must not also close the entry sheet or the block drawer');

// 7. Readable task list (the list itself is PlanTaskStep.vue; the details come from utils/taskMeta.js)
const taskStep = read('src/components/dialogs/PlanTaskStep.vue');
const metaJs = read('src/utils/taskMeta.js');
const optionRow = taskStep.match(/role="option"[\s\S]*?<\/li>/);
if (!optionRow) problems.push('PlanTaskStep.vue: task option row not found');
else {
  if (/\btruncate\b/.test(optionRow[0])) problems.push('PlanTaskStep.vue: task names in the list must wrap (line-clamp), not truncate');
  if (!/line-clamp-\d/.test(optionRow[0])) problems.push('PlanTaskStep.vue: task names in the list need line-clamp so long names stay readable');
  if (!/row\.meta/.test(optionRow[0])) problems.push('PlanTaskStep.vue: each task row must show its details (row.meta: project, due, priority, hours)');
}
if (!/function taskMeta\(t\)\s*\{[\s\S]*?is_overdue[\s\S]*?is_due_today/.test(metaJs)) {
  problems.push('utils/taskMeta.js: taskMeta must say overdue / due today');
}
if (/label="Change"|'Change '\s*\+/.test(plan)) problems.push('PlanWorkBlockDialog.vue: no Change control on a picked task (remove it and add another)');
if (/label:\s*["']Your calendar["']/.test(plan) || !/user_fullname/.test(plan)) {
  problems.push('PlanWorkBlockDialog.vue: "Whose calendar" must name the person (user_fullname), not say "Your calendar"');
}

// 11. One task form. A block's task row, the calendar's assigned work and the dashboard
//     all open TaskFormDialog (mounted once in App.vue) through openTaskForm. It shows where
//     the task stands in its workflow and applies a move only after a second, confirming step.
const taskForm = read('src/components/dialogs/TaskFormDialog.vue');
const appVue = read('src/App.vue');
const plannerSelect = read('src/composables/useWorkstationPlannerSelect.js');
if ((appVue.match(/<TaskFormDialog\b/g) || []).length !== 1) problems.push('App.vue: mount TaskFormDialog exactly once');
if (fs.existsSync(path.join(root, 'src/drawers/BlockTaskDialog.vue'))) problems.push('src/drawers/BlockTaskDialog.vue: a second task form; use TaskFormDialog');
if (!/openTaskDetail\(row, \{ block: this\.block, canRemove: this\.canAdd \}\)/.test(tasksSection)) problems.push('BlockTasksSection.vue: a task row opens its details, whose Edit opens the one task form with its block');
if (!/const openTaskDetails = \(task\) => \{\s*openTaskDetail\(task\);/.test(plannerSelect)) problems.push('useWorkstationPlannerSelect.js: openTaskDetails opens the task details panel');
if (!/'update_block_task'/.test(taskForm) || !/'update_task'/.test(taskForm) || (taskForm.match(/\.\.\.this\.changes/g) || []).length !== 2) problems.push('TaskFormDialog.vue: saves only what changed (update_block_task / update_task)');
if (!/'remove_block_task'/.test(taskForm)) problems.push('TaskFormDialog.vue: can take a task off its block (remove_block_task)');
if ((taskForm.match(/>\{\{ detail\.state \|\| 'Open' \}\}<\/(Button|Badge)>/g) || []).length !== 2) problems.push('TaskFormDialog.vue: must show where the task stands (detail.state)');
if (!/detail\.actions\.map\(\(a\) => \(\{[\s\S]*?onClick: \(\) => this\.ask\(a\)/.test(taskForm) || !/<Dropdown v-if="statusMenu\.length" :options="statusMenu"/.test(taskForm) || !/'execute_task_workflow_action'/.test(taskForm)) problems.push('TaskFormDialog.vue: workflow moves ask first, then apply (execute_task_workflow_action)');
if (!/:esc-back="!!confirming"/.test(taskForm) || !/this\.\$emit\('back'\)/.test(fdialog)) problems.push('TaskFormDialog.vue: Escape steps back out of a move\'s confirm before it closes the form');
for (const f of walkVue(path.join(root, 'src'))) {
  const rel = path.relative(root, f);
  if (rel.endsWith('TaskFormDialog.vue')) continue;
  const src = fs.readFileSync(f, 'utf8');
  if (/getTaskWorkflowMenuItems\(|<BlockTaskDialog\b|<TaskFormDialog\b/.test(src) && !rel.endsWith('App.vue')) problems.push(`${rel}: tasks are edited and moved through their workflow only in TaskFormDialog`);
}

// 12. A block's own title and notes are edited in EditBlockDialog, opened from the drawer's
//     More actions by the people update_work_block allows, and only while the block's day is open.
//     Its chips carry AA colour pairs (frappe-ui's subtle blue / amber / red miss 4.5:1).
const editBlock = read('src/drawers/EditBlockDialog.vue');
if (!/<EditBlockDialog\b[^>]*v-model="showEdit"/.test(drawer) || !/if \(this\.canEditBlock\) out\.push\(\{ label: 'Edit block'[^\n]*this\.showEdit = true/.test(more)) problems.push('BlockDetailDrawer.vue: Edit block sits in More actions and opens EditBlockDialog');
if (/label="Edit block"/.test(drawer)) problems.push('BlockDetailDrawer.vue: Edit block lives in More actions, not as a header button');
// A running session is not a timesheet: no Approve / Flag and no "Awaiting approval" until it ends
const hasLogged = (drawer.match(/hasLoggedTime\(\)\s*\{[\s\S]*?\n    \}/) || [''])[0];
if (!/!this\.isRecording/.test(hasLogged) || !/<section v-if="canReview && hasLoggedTime/.test(drawer)) problems.push('BlockDetailDrawer.vue: review (Approve / Flag) only for logged time, never while a session is recording');
if (!/isRecording\(\)\s*\{[^}]*this\.block\.is_live_active/.test(drawer)) problems.push('BlockDetailDrawer.vue: an unplanned live session (is_live_active) counts as recording');
// Reschedule moves a recording block's plan (the session stays); Cancel never runs on one
// (appVue is read above)
const reschedGate = (appVue.match(/const isBlockReschedulable = [^\n]*/) || [''])[0];
const cancelGate = (appVue.match(/const isBlockCancellable = [^\n]*/) || [''])[0];
if (/isRecordingOn|trackerBlockName/.test(reschedGate) || !/is_live_active/.test(reschedGate)) problems.push('App.vue: Reschedule stays offered while a session records on the block (the plan moves, the session stays)');
if (!/!isRecordingOn\(b\)/.test(cancelGate) || !/isBlockCancellable,/.test(appVue)) problems.push('App.vue: never offer Cancel on a block whose session is recording');
// An unplanned live session has no block: nothing to edit, log against or add tasks to,
// and its ticked-off tasks read as a list, not raw "Completed:" lines
if (!/return b\.is_live_active \? \[\] : out;/.test(more)) problems.push('BlockDetailDrawer.vue: More actions stays empty for an unplanned live session (is_live_active)');
if (!/canAdd\(\)\s*\{\s*return \(this\.block\.is_session_tasks \|\| !this\.block\.is_live_active\) && this\.canChange/.test(tasksSection)) problems.push('BlockTasksSection.vue: no Add tasks on an unplanned live session (is_live_active) unless it is the session\'s own list (is_session_tasks)');
if (/\{\{ block\.deliverable_notes \}\}/.test(drawer) || !/v-for="d in notes\.done"/.test(drawer)) problems.push('BlockDetailDrawer.vue: notes show ticked-off tasks as a list, never raw "Completed:" lines');
// The live session's notes are what got done, never its title
const layout = read('src/composables/useWorkstationPlannerLayout.js');
{
  const tl = read('src/composables/useWorkstationTimeline.js');
  const wrap = read('src/utils/wrapNote.js');
  if (/task_subject: trackerNotes|work_item_label: trackerNotes/.test(layout + tl) || !/const heading = noteHeading\(notes\) \|\| 'Live session';/.test(layout) || !/const heading = noteHeading\(trackerNotes\.value\) \|\| 'Live session';/.test(tl) || !/Completed:/.test((wrap.match(/export function noteHeading[\s\S]*?\n}/) || [''])[0])) problems.push('useWorkstationPlannerLayout.js / useWorkstationTimeline.js: the live block is titled by a notes line that is not a ticked-off task (wrapNote.noteHeading)');
  if (/Recording\.\.\./.test(tl)) problems.push('useWorkstationTimeline.js: the live bar is named by its notes, not by notes with "(Recording...)" stuck on; the Live chip says it runs');
}
if (/✓|\\u2713/.test(read('omnitrack/api/tasks.py'))) problems.push('omnitrack/api/tasks.py: no glyphs in session notes; write "Completed: <task>" as the client does');
const canEditBlock = (drawer.match(/canEditBlock\(\)\s*\{[\s\S]*?\n    \}/) || [''])[0];
if (!/isManager/.test(canEditBlock) || !/b\.employee === this\.currentUser/.test(canEditBlock) || !/!this\.isPastBlock\(b\)/.test(canEditBlock) || !/'Cancelled'/.test(canEditBlock)) problems.push('BlockDetailDrawer.vue: Edit block only for its owner or a manager, and never on a past or cancelled block');
if (!/'update_work_block', \{ block_name: b\.name, \.\.\.changes \}/.test(editBlock) || !/out\.work_item_label = title/.test(editBlock)) problems.push('EditBlockDialog.vue: saves only what changed (update_work_block with work_item_label / deliverable_notes)');
if (!/maxlength="140"/.test(editBlock)) problems.push('EditBlockDialog.vue: the title is capped at 140 characters, as the server keeps it');
for (const m of drawer.matchAll(/<Badge\b[^>]*>/g)) {
  if (!/:class="chip\(/.test(m[0])) problems.push(`BlockDetailDrawer.vue: ${m[0]} needs an AA chip class (chip(tone)), not a frappe-ui subtle theme`);
}
if (/text-ink-(red|green|amber|blue)-[1-4]\b/.test(drawer + tasksSection)) problems.push('BlockDetailDrawer.vue / BlockTasksSection.vue: ink-red/green 1-4 miss AA on white; use the -700/-800 text pairs');

// 9. Drawers sit above the sticky header (z-40) and BELOW dialogs (.dialog-overlay z-50),
//    or a dialog opened from a drawer (Log work, Edit session) appears behind it.
for (const f of fs.readdirSync(path.join(root, 'src/drawers')).filter((n) => n.endsWith('.vue'))) {
  const src = read('src/drawers/' + f);
  for (const m of src.matchAll(/\bz-\[(\d+)\]|\bz-(\d+)\b/g)) {
    const z = Number(m[1] || m[2]);
    if (z >= 50 || z <= 40) problems.push(`src/drawers/${f}: ${m[0]} must be between 40 and 50 (dialogs are z-50 and open over drawers)`);
  }
}

// 10. One timesheet panel. Adding, editing, logging a free window and correcting or stopping
//     the running session are the same form (TimesheetEntryDialog, form.mode). A second
//     dialog for any of them is the duplicate the owner asked to be rid of.
for (const gone of ['AdjustTimingModal.vue', 'EditSessionModal.vue']) {
  if (fs.existsSync(path.join(root, 'src/components/dialogs', gone))) problems.push(`src/components/dialogs/${gone}: removed; the one timesheet panel is TimesheetEntryDialog.vue`);
}
for (const file of walkVue(path.join(root, 'src'))) {
  if (file.endsWith('TimesheetEntryDialog.vue')) continue;
  const src = fs.readFileSync(file, 'utf8');
  if (/<(f-dialog|Dialog)\b[^>]*\btitle="[^"]*(timesheet|adjust)[^"]*"/i.test(src)) problems.push(`${path.relative(root, file)}: a timesheet dialog of its own; open TimesheetEntryDialog (openEditSessionModal / openAdjustModal) instead`);
}
if ((appVue.match(/<TimesheetEntryDialog\b/g) || []).length + (read('src/components/dialogs/DialogCoordinator.vue').match(/<TimesheetEntryDialog\b/g) || []).length !== 1) problems.push('DialogCoordinator.vue: renders TimesheetEntryDialog exactly once');
const modals = read('src/composables/useWorkstationSessionModals.js');
const fnBody = (name) => (modals.match(new RegExp(`const ${name} = [\\s\\S]*?\\n  };`)) || [''])[0];
if (!/startTime\.value = ms;/.test(fnBody('restartClockAt'))) problems.push('useWorkstationSessionModals.js: restartClockAt sets startTime itself (syncActiveSession writes startTime back over a start kept only in localStorage)');
if (!/await toggleTrack\(/.test(fnBody('stopAndLogSession'))) problems.push('useWorkstationSessionModals.js: Stop and log goes through the one stop path (toggleTrack)');
if (/tracker|startTime|syncActiveSession|toggleTrack/.test(fnBody('writeEntry'))) problems.push('useWorkstationSessionModals.js: a saved entry never touches the running session');
if (!/notes: notesWithoutLines\(trackerNotes\.value \|\| '', lines\)/.test(fnBody('openAdjustModal'))) problems.push('useWorkstationSessionModals.js: the running session panel edits its notes only; its lines are added once, when it is logged');

{
  const helper = (modals.match(/const bare = [^\n]*\n  const notesWithoutLines = [\s\S]*?\n  };/) || [''])[0];
  let got = null;
  try { got = new Function(helper + '\nreturn notesWithoutLines;')()('Fixed the export\n\u2713 Completed: Review OTC\n\u2022 Called Sam', ['Completed: Review OTC', 'Called Sam']); } catch (e) { got = String(e); }
  if (got !== 'Fixed the export') problems.push(`useWorkstationSessionModals.js: notesWithoutLines must drop notes that repeat a session line (got ${JSON.stringify(got)})`);
}

// 12c. A solid button that waits for input greys out legibly (DISABLED_SOLID), never frappe-ui's
//      pale blue under white text: the entry's Add session and the Log's Add
const frame = read('src/utils/sessionFrame.js');
if (!/export const DISABLED_SOLID = 'disabled:!bg-gray-100 disabled:!text-gray-700 /.test(frame)) problems.push('utils/sessionFrame.js: DISABLED_SOLID greys a waiting button with dark text');
if (!/:class="\[DISABLED_SOLID, 'enabled:!bg-blue-700/.test(read('src/session/SessionControlsPane.vue'))) problems.push('SessionControlsPane.vue: Add session waits in DISABLED_SOLID, not pale blue');
if (!/:class="\[DISABLED_SOLID, '!h-auto self-stretch/.test(read('src/session/SessionLogPane.vue'))) problems.push('SessionLogPane.vue: the Log\'s Add waits in DISABLED_SOLID, not pale blue');

// 13. What a session is for is the same task list a block shows (BlockTasksSection), never a
//     Combobox of its own: bound, the block's tasks; unbound, the session's own list
//     (w.sessionTasks), which travels with the live session and lands on the block Stop makes.
const pane = read('src/session/SessionControlsPane.vue');
if (!/<BlockTasksSection v-if="!isEntry" :block="trackerBoundBlock \|\| liveSessionBlock"/.test(pane)) problems.push('SessionControlsPane.vue: the session lists its tasks with BlockTasksSection (bound block, else liveSessionBlock)');
// An entry lists its own block's tasks under its Log, never the running session's tasks
if (!/<BlockTasksSection v-if="isEntry && trackerBoundBlock" :block="trackerBoundBlock"/.test(read('src/session/SessionLogPane.vue'))) problems.push('SessionLogPane.vue: an entry lists its block\'s tasks under the Log (its own block only, never the running session\'s tasks)');
if (/workingOn|pickWorkingOn/.test(pane) || /useSessionTodoPicker/.test(read('src/session/SessionBox.vue'))) problems.push('SessionControlsPane.vue / SessionBox.vue: no "Working on" Combobox beside the task list (a second component for the same job)');
if (!/if \(this\.block\.is_session_tasks\) \{\s*openTaskForm\(row, \{ onRemove: this\.removeSessionTask, onChange: this\.onSessionTaskChange \}\)/.test(tasksSection)) problems.push('BlockTasksSection.vue: a session task opens the one task form, removing it from the session and keeping the list in step');
if (!/typeof taskForm\.onChange === 'function'/.test(taskForm) || !/taskForm\.onRemove\(this\.task\)/.test(taskForm)) problems.push('TaskFormDialog.vue: honours onRemove / onChange for a list that is not a block');
if (!/if \(this\.block\.is_session_tasks\) \{\s*const n = await this\.addSessionTasks\(list, subject\)/.test(addDialog)) problems.push('AddBlockTasksDialog.vue: tasks for a session with no block go to addSessionTasks, not attach_tasks_to_block');
const sync = read('src/composables/useWorkstationSessionSync.js');
if (!/sessionTasks: sessionTasks\.value/.test(sync) || !/sessionTasks\.value = Array\.isArray\(sessionData\.sessionTasks\)/.test(sync)) problems.push('useWorkstationSessionSync.js: the session\'s tasks are synced with it and restored from it');
const api = read('src/composables/useWorkstationApi.js');
if (!/session_tasks: JSON\.stringify\(doneTasks\)/.test(api)) problems.push('useWorkstationApi.js: Stop sends the session\'s tasks to quick_timer_punch (session_tasks)');
const stopwatch = read('omnitrack/api/stopwatch.py');
if (!/attach_session_tasks\(block, session_tasks\)[\s\S]{0,200}block\.insert\(\)/.test(stopwatch) || !/"sessionTasks": clean_session_tasks\(/.test(stopwatch)) problems.push('omnitrack/api/stopwatch.py: quick_timer_punch puts session_tasks on its new block; sync_active_session keeps sessionTasks cleaned');
const completeTask = (read('omnitrack/api/tasks.py').match(/def complete_block_task[\s\S]*?\n\ndef /) || [''])[0];
if (!completeTask || /trackerNotes/.test(completeTask.replace(/#[^\n]*/g, ''))) problems.push('omnitrack/api/tasks.py: complete_block_task logs a ticked task in sessionNotesList only; trackerNotes is the session\'s title');
{
  // clean_session_tasks, run for real: dedupes by ref, caps text, derives id, two statuses only
  const blockTasksPy = read('omnitrack/utils/block_tasks.py');
  const fn = (blockTasksPy.match(/SESSION_TASK_KEYS = [^\n]*\n\n\ndef clean_session_tasks[\s\S]*?\n\treturn out\n/) || [''])[0];
  let got = '';
  try {
    got = require('node:child_process').execFileSync('python3', ['-c', fn.replace(/\t/g, '    ') + `
import json
r = clean_session_tasks(json.dumps([{"ref": "todo:T1", "subject": "x" * 300, "status": "Completed"}, {"ref": "todo:T1"}, {"ref": "TASK-9", "status": "Rescheduled"}, {"subject": "no ref"}, "junk"]))
print(json.dumps([[t["id"], t["ref"], len(t["subject"] or ""), t["status"]] for t in r]))
print(json.dumps(clean_session_tasks("not json")))`]).toString().trim();
  } catch (e) { got = String(e.stderr || e); }
  if (got !== '[["T1", "todo:T1", 200, "Completed"], ["TASK-9", "TASK-9", 0, "Open"]]\n[]') problems.push(`omnitrack/utils/block_tasks.py: clean_session_tasks must dedupe by ref, cap text at 200, derive id and keep only Completed/Open (got ${JSON.stringify(got)})`);
}

// 14. The session clock's toolbar is icon-only below 480px. frappe-ui keeps the hidden
//     label's wrapper and its gap, which pushed each icon off centre: every tool is squared
//     at the same breakpoint the label hides at.
const toolSquare = (pane.match(/const TOOL_SQUARE = '([^']*)'/) || [])[1] || '';
const clockSection = pane.slice(pane.indexOf('aria-label="Session clock"'));
const tools = [...clockSection.matchAll(/<Button\s+data-session-tool[\s\S]*?<\/Button>/g)].map((m) => m[0]);
if (!/max-\[479px\]:w-7/.test(toolSquare) || !/max-\[479px\]:px-0/.test(toolSquare) || !/max-\[479px\]:gap-0/.test(toolSquare)) problems.push('SessionControlsPane.vue: TOOL_SQUARE squares the icon-only tools below 480px (w-7, px-0, gap-0)');
if (tools.length !== 3 || tools.some((t) => !/:class="TOOL_SQUARE"/.test(t) || !/class="hidden min-\[480px\]:inline"/.test(t))) problems.push('SessionControlsPane.vue: each of the 3 session tools is squared (TOOL_SQUARE) and hides its label below 480px');

// 15. The Escape that closes an FDialog stops there. Page-level handlers (minimise the session
//     popup, close a drawer) never see it, so one Escape never closes two layers.
const keep = (fdialog.match(/keepEscape\(e\)\s*\{[\s\S]*?\n    \}/) || [''])[0];
if (!/<div ref="panel"[^>]*@keydown\.esc="keepEscape"/.test(fdialog) || !/if \(this\.escOwnedByPopover\) return;/.test(keep) || !/e\.stopPropagation\(\);/.test(keep) || !/this\.open = false;/.test(keep)) problems.push('FDialog.vue: an Escape the dialog closes on stops at its panel (keepEscape), so the session popup under it stays open');

// 16. The session popup minimises on Escape only when nothing inside it took that Escape. An open
//     Activity or Project list closes itself first (reka's Combobox does not preventDefault, so an
//     open list is checked too), so one Escape closes the list and the popup stays.
const slash = (read('src/composables/useWorkstationShortcuts.js').match(/const _slashFocus = \(ev\) => \{[\s\S]*?isSessionElevated\.value = false;/) || [''])[0];
if (!/if \(ev\.key === 'Escape' && isSessionElevated\.value\) \{\s*if \(ev\.defaultPrevented \|\| popoverOpen\(\)\) return;/.test(slash) || !/import \{ popoverOpen \} from "\.\.\/utils\/popover\.js"/.test(read('src/composables/useWorkstationShortcuts.js'))) problems.push('useWorkstationShortcuts.js: _slashFocus skips an Escape while a list is open or one already handled it (ev.defaultPrevented || popoverOpen()), so closing a list does not also minimise the session popup');

// 17. Inline (the session popup's Details tab) the block drawer is facts only: no sheet, title,
//     actions, task list or activity, which the popup already has. Open block brings the sheet.
for (const [what, re] of [
  ['the scrim', /<div v-if="show && block && !inline" @click="\$emit\('close'\)"/],
  ['the title row', /<template v-if="!inline">\s*<div class="flex items-center gap-1">\s*<DetailKind id="block-drawer-kind"[^>]*>[\s\S]*?<\/div>\s*<h2 id="block-drawer-title"/],
  ['the action row', /<div v-if="!inline" class="flex items-center gap-2">\s*<Button v-if="canStart"/],
  ['the task list', /<BlockTasksSection v-if="!inline(?: && !block\.is_away)?"/],
  ['the activity', /<DocActivity v-if="!inline && hasDoc"/],
  ['Open block', /<Button v-if="inline && !block\.is_session_tasks"[^>]*@click="\$emit\('open-full', block\)"/],
]) if (!re.test(drawer)) problems.push(`BlockDetailDrawer.vue: inline, ${what} follows the inline rule (hidden, or Open block shown)`);

// 18. Session pane tabs are Material primary tabs: a padded target whose keyboard focus ring is
//     inset (an outer ring was clipped by the bar into a broken box round "Log 5"), with a 3px
//     indicator under the active tab instead of a border on the label.
const logPane = read('src/session/SessionLogPane.vue');
// The look lives once, in utils/materialTab.js, and every tab bar imports it.
const tabMod = read('src/utils/materialTab.js');
const tabCls = (tabMod.match(/export const TAB = '([^']*)'/) || ['', ''])[1];
if (!/\bpx-3\b/.test(tabCls) || !/focus-visible:ring-inset/.test(tabCls) || /border-b-2|-mb-px/.test(tabCls)) problems.push('utils/materialTab.js: TAB is a padded Material tab with an inset focus ring and no border underline (the outer ring was clipped)');
for (const f of ['src/session/SessionLogPane.vue', 'src/views/ProjectsView.vue']) {
  const src = read(f);
  if (!/from '\.\.\/utils\/materialTab\.js'/.test(src) || /const (TAB|INDICATOR) = '/.test(src)) problems.push(`${f}: tab bars import TAB and INDICATOR from utils/materialTab.js instead of keeping a copy`);
}
if ((logPane.match(/:class="INDICATOR" aria-hidden="true"/g) || []).length !== 3) problems.push('SessionLogPane.vue: each of the three tabs draws the shared INDICATOR when active');

// 19. One frame. Inside the session popup the popup is the frame, so the session card draws no
//     ring or border of its own (a "flash" ring once boxed the popup's contents in blue).
const sessionBox = read('src/session/SessionBox.vue');
if (/\bring-\d|CardFlash/.test(sessionBox) || !/:class="isElevated \|\| mode === 'entry' \? '' :/.test(sessionBox)) problems.push('SessionBox.vue: the elevated session card (and the entry, which has its own popup) has no ring or border of its own; the popup is the frame');
// 19b. A work session added or edited by hand is the timer's own box in the timer's own popup:
//     one frame (utils/sessionFrame.js) for both, and the entry is SessionBox mode="entry"
for (const f of ['src/components/layout/SessionOverlay.vue', 'src/components/dialogs/WorkSessionEntry.vue']) {
  const src = read(f);
  if (!/from "\.\.\/\.\.\/utils\/sessionFrame\.js"|from '\.\.\/\.\.\/utils\/sessionFrame\.js'/.test(src) || !/SESSION_BACKDROP/.test(src) || !/SESSION_PANEL/.test(src)) problems.push(`${f}: the session popup and the entry share one frame (SESSION_BACKDROP, SESSION_PANEL from utils/sessionFrame.js)`);
}
{
  const entryHost = read('src/components/dialogs/WorkSessionEntry.vue');
  if (!/<SessionBox[^>]*\bmode="entry"/.test(entryHost)) problems.push('WorkSessionEntry.vue: a work session is added and edited in SessionBox mode="entry", the box the timer uses');
}

// Across src: a menu of further actions is a visible "More" button, never an unlabelled "..." icon.
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(vue|js)$/.test(e.name)) {
      const src = fs.readFileSync(f, 'utf8');
      if (/icon=["']more-(horizontal|vertical)["']/.test(src)) problems.push(path.relative(root, f) + ': a menu trigger is a labelled "More" button, not a "..." icon');
    }
  }
})(path.join(root, 'src'));

if (problems.length) {
  console.error('FAIL: dialog popover guard:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('SUCCESS: dialog popovers layer above dialogs, own their Escape, and chips rove.');
