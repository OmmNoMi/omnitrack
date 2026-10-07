#!/usr/bin/env node
// Every details panel says what it is open on. A Work Block, Time Away, a Work Session, a Task and
// a To-Do all open the same side sheet: a title, a when line, a project and chips, so a person
// could not tell a session from the block it sits in. Each sheet starts with DetailKind (one
// icon, one colour and one name per kind) and is named by it for a screen reader too.
// Clicking a task opens its details, not the edit form, and those details are read only by
// someone who may read the task.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];

// 1. One entry per kind, each with its own icon, colour and name.
const kindSrc = read("src/components/common/DetailKind.vue");
const kinds = [...kindSrc.matchAll(/^\s+(\w+): \{ icon: '([\w-]+)', label: '([^']+)', tone: '(\w+)' \},$/gm)].map((m) => ({ kind: m[1], icon: m[2], label: m[3], tone: m[4] }));
const WANT = ["block", "away", "session", "task", "todo"];
for (const k of WANT) if (!kinds.some((x) => x.kind === k)) problems.push(`DetailKind.vue: no entry for the ${k} kind`);
for (const field of ["icon", "label", "tone"]) {
  const seen = kinds.map((k) => k[field]);
  if (new Set(seen).size !== seen.length) problems.push(`DetailKind.vue: two kinds share a ${field} (${seen.join(", ")}); each must look different`);
}
if (!/toneChipClass\(this\.meta\.tone, this\.isDarkMode\)/.test(kindSrc)) problems.push("DetailKind.vue: the icon tile takes its colours from toneChipClass (AA in both themes)");
for (const k of kinds) {
  if (!new RegExp(`${k.tone}: 'text-${k.tone}-800'`).test(kindSrc) && !(k.tone === "gray" && /gray: 'text-gray-800'/.test(kindSrc))) problems.push(`DetailKind.vue: the ${k.kind} label needs a dark ${k.tone} text in light mode`);
}
if (!/:title="docName"><span class="sr-only">, <\/span>\{\{ docName \}\}/.test(kindSrc)) problems.push("DetailKind.vue: a hidden comma parts the kind from the record name, or a screen reader reads them as one word");
if (!/purple: '!text-purple-800 !bg-purple-100'/.test(read("src/utils/taskState.js"))) problems.push("src/utils/taskState.js: the purple chip pair is missing, so the Task kind has no colour");

// 2. Every details sheet opens with its kind, and is named by kind and title.
const SHEETS = [
  ["src/drawers/BlockDetailDrawer.vue", "block", /:kind="block\.is_away \? 'away' : 'block'"/],
  ["src/drawers/SessionDetailDrawer.vue", "session", /kind="session"/],
  ["src/drawers/TaskDetailDrawer.vue", "task", /:kind="doc\.doctype === 'ToDo' \? 'todo' : 'task'"/],
];
for (const [file, id, kindRe] of SHEETS) {
  const src = read(file);
  if (!new RegExp(`<DetailKind id="${id}-drawer-kind"`).test(src) || !kindRe.test(src)) problems.push(`${file}: the sheet starts with <DetailKind id="${id}-drawer-kind"> for its kind`);
  if (!new RegExp(`aria-labelledby="(?:inline \\? null : ')?${id}-drawer-kind ${id}-drawer-title'?"`).test(src)) problems.push(`${file}: the dialog is named by its kind and its title (aria-labelledby="${id}-drawer-kind ${id}-drawer-title")`);
  if (!/components: \{[^}]*\bDetailKind\b/.test(src)) problems.push(`${file}: DetailKind is not registered, so it renders as nothing`);
}

// 3. A task opens its details; Edit there opens the one task form with the same options.
const taskForm = read("src/composables/useTaskForm.js");
if (!/export function openTaskDetail\(task, opts = \{\}\) \{\s*if \(!task\) return;\s*if \(!taskDocRef\(task\)\) return openTaskForm\(task, opts\);/.test(taskForm)) problems.push("src/composables/useTaskForm.js openTaskDetail: a plain checklist item (no Task or ToDo) opens the form; everything else its details");
const drawer = read("src/drawers/TaskDetailDrawer.vue");
if (!/openTaskForm\(taskDetail\.task, \{\s*\.\.\.opts,\s*ask,/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue edit: Edit and every move open the one task form with the opener's options");
if (!/postJSON\('tasks\.get_task_details'/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: reads the task from tasks.get_task_details");
if (!/v-html="d\.description_html"/.test(drawer) || /v-html="(?!d\.description_html")/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: only the server-sanitized description_html is rendered as HTML");
if (!/if \(e\.key === 'Escape'\) \{\s*if \(e\.defaultPrevented\) return;\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*closeTaskDetail\(\);/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: Escape closes this sheet only, after a list inside it has taken its own");
if (!/if \(e\.key !== 'Tab'/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: Tab stays inside the modal sheet");
if (!/setScrollLock\('task-detail', true\)/.test(drawer) || !/setScrollLock\('task-detail', false\)/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: the page behind does not scroll while the sheet is open");
const app = read("src/App.vue");
if ((app.match(/<TaskDetailDrawer\b/g) || []).length !== 1) problems.push("src/App.vue: mount TaskDetailDrawer exactly once");
if (!/app\.component\("TaskDetailDrawer", TaskDetailDrawer\)/.test(read("src/main.js"))) problems.push("src/main.js: register TaskDetailDrawer");
for (const [file, re] of [
  ["src/composables/useWorkstationPlannerSelect.js", /openTaskDetail\(task\)/],
  ["src/views/TasksView.vue", /openTaskDetail\(t, \{/],
  ["src/views/ProjectsView.vue", /openTaskDetail\(\n/],
  ["src/drawers/SessionDetailDrawer.vue", /openTask\(t\) \{\s*openTaskDetail\(t, \{/],
]) if (!re.test(read(file))) problems.push(`${file}: clicking a task opens its details panel`);

// 5. Each fact in the task panel is named (a bare "Open" or "High" chip said nothing), and its
// workflow steps sit in the action bar beside Edit, not behind a status chip.
for (const label of ["Status", "Due", "Priority", "Project", "Assigned to"]) {
  if (!new RegExp(`<dt :class="mutedText">${label}</dt>`).test(drawer)) problems.push(`src/drawers/TaskDetailDrawer.vue: the ${label} fact is named by a <dt>`);
}
if (/<Badge[^>]*>\{\{ d\.status \}\}<\/Badge>|priority<\/Badge>|>Overdue<\/Badge>/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: an unnamed status, priority or overdue chip is back");
if (!/<div v-if="d \|\| failed" class="flex items-center gap-2 flex-wrap" role="group" aria-label="Task actions">\s*<Button v-for="\(m, i\) in shownMoves"/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: the first workflow steps are buttons at the start of the action bar");
if (!/shownMoves\(\) \{ return this\.stateMoves\.slice\(0, 2\)/.test(drawer) || !/\.\.\.this\.stateMoves\.slice\(2\),/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: two steps show as buttons; the rest go under More");

// 6. Everything listed inside a block opens its own panel: its tasks and its logged sessions.
const tasksSec = read("src/drawers/BlockTasksSection.vue");
if (!/<button type="button"[^>]*:data-cell="i \+ ':1'"[^>]*@click="edit\(t\)">\s*<span[^>]*>\{\{ t\.subject \}\}<\/span>/.test(tasksSec)) problems.push("src/drawers/BlockTasksSection.vue: a block's task title is the button that opens its details");
if (/:label="'Edit ' \+ t\.subject"/.test(tasksSec)) problems.push("src/drawers/BlockTasksSection.vue: the hidden Edit pencil is back; the task opens its details instead");
const blockSheet = read("src/drawers/BlockDetailDrawer.vue");
if (!/<button v-if="s\.name" type="button"[^>]*@click="\$emit\('open-session', s, block\)">/.test(blockSheet) || !/'open-session',/.test(blockSheet)) problems.push("src/drawers/BlockDetailDrawer.vue: a logged session row opens that session's panel");
if (!/@open-session="\(session, block\) => \$emit\('open-block-session', session, block\)"/.test(read("src/drawers/DrawerCoordinator.vue"))) problems.push("src/drawers/DrawerCoordinator.vue: passes a block's session on to App");
if (!/const openBlockSession = \(session, block\) => \{\s*workstation\.showBlockDrawer\.value = false;\s*workstation\.openSessionDrawer\(block, session\);/.test(app) || !/@open-block-session="openBlockSession"/.test(app)) problems.push("src/App.vue: a block's session hands over to the session sheet, one sheet at a time");

if (!/<p v-if="!d && !failed"[^>]*role="status">/.test(drawer) || !/<div v-if="d \|\| failed" class="flex items-center gap-2 flex-wrap" role="group" aria-label="Task actions">/.test(drawer)) problems.push("src/drawers/TaskDetailDrawer.vue: say it is loading, and show the action bar once the task is read (its steps must not jump in)");

// 7. The session sheet reads like the task panel: named facts, then one action bar
const sessionSheet = read("src/drawers/SessionDetailDrawer.vue");
const sessionHead = sessionSheet.slice(0, sessionSheet.indexOf('<p v-if="failed"'));
for (const term of ["When", "Approval", "Activity", "Work block"]) {
  if (!new RegExp(`<dt :class="mutedText">${term}</dt>`).test(sessionHead)) problems.push(`src/drawers/SessionDetailDrawer.vue: the "${term}" fact is not named`);
}
if (/<Badge v-if=/.test(sessionHead)) problems.push("src/drawers/SessionDetailDrawer.vue: a bare chip is back in the header; name the fact in the list");
const sessionBar = (sessionHead.match(/role="group" aria-label="Session actions">[\s\S]*?<\/Dropdown>/) || [""])[0];
if (!sessionBar || /<\/div>/.test(sessionBar) || !/\$emit\('approve-block', entry\.block\)/.test(sessionBar) || !/@click="startFlag"/.test(sessionBar) || !/\$emit\('edit-session', session, entry\.block\)/.test(sessionBar) || !/<Dropdown v-if="moreMenu\.length" :options="moreMenu"/.test(sessionBar)) problems.push("src/drawers/SessionDetailDrawer.vue: Approve, Flag, Edit and More sit together in the one action bar");
if (!/moreMenu\(\) \{\s*return this\.canEdit \? \[\{ label: 'Delete entry', icon: 'trash-2', theme: 'red'/.test(sessionSheet)) problems.push("src/drawers/SessionDetailDrawer.vue: More holds Delete entry, in red, and nothing else");

// 4. The server answers only someone who may read the task, and sends safe HTML.
const py = read("omnitrack/api/tasks.py");
const at = py.indexOf("def get_task_details(");
const fn = at < 0 ? "" : py.slice(at, py.indexOf("\ndef ", at + 1));
if (!/doc = _task_doc\(doctype, task_id\)/.test(fn)) problems.push("omnitrack/api/tasks.py get_task_details: load the task through _task_doc, which checks read permission");
if (/frappe\.get_doc\(|frappe\.db\.exists\(/.test(fn)) problems.push("omnitrack/api/tasks.py get_task_details: a task is loaded without a permission check");
if (!/sanitize_html\(doc\.get\("description"\)/.test(fn)) problems.push("omnitrack/api/tasks.py get_task_details: sanitize the description before it is shown as HTML");
if (/except Exception:\s*\n\s*pass/.test(fn)) problems.push("omnitrack/api/tasks.py get_task_details: an error is swallowed");

if (problems.length) {
  console.error("FAIL: details panels name their kind\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`SUCCESS: ${SHEETS.length} details sheets name their kind (${kinds.map((k) => k.label).join(", ")}); a task opens its details, read with permission.`);
