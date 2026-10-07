#!/usr/bin/env node
// Every details panel carries its document's Activity: the Frappe comments on it and the history
// Frappe keeps (changes, workflow moves, assignments), with a box to say something, so nobody has
// to open Desk to follow a Work Block, a Work Session (its block's), a Task or a To-Do.
// Raven is for Projects and their ERPNext Tasks only. A work block or a To-Do never gets a Raven
// channel again: opening a block's panel used to create one just by reading it.
// The server reads and writes only for someone Frappe lets read the document, and what a comment
// says is escaped on the way in and sanitized on the way out.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];

// 1. Each panel shows Activity, on the right document.
const PANELS = [
  ["src/drawers/TaskDetailDrawer.vue", /<DocActivity v-if="d" :doctype="doc\.doctype" :name="doc\.name" :is-dark-mode="isDarkMode" \/>/, "the task's or to-do's own Activity"],
  ["src/drawers/BlockDetailDrawer.vue", /<DocActivity v-if="!inline && hasDoc" doctype="Planned Work Block" :name="block\.name" :stamp="docStamp" :is-dark-mode="isDarkMode" \/>/, "the block's Activity, refreshed when the block changes"],
  ["src/drawers/SessionDetailDrawer.vue", /<DocActivity v-if="blockDoc" doctype="Planned Work Block" :name="blockDoc" :note="activityNote" :stamp="docStamp" :is-dark-mode="isDarkMode" \/>/, "its block's Activity, saying so when the block holds other entries"],
];
for (const [f, re, what] of PANELS) {
  const src = read(f);
  if (!re.test(src)) problems.push(`${f}: shows ${what}`);
  if (!/components: \{[^}]*\bDocActivity\b/.test(src) || !/import DocActivity from '\.\.\/components\/common\/DocActivity\.vue';/.test(src)) problems.push(`${f}: registers DocActivity`);
}
// A live session or a session's pseudo-block is not a saved document; there is nothing to read yet
if (!/hasDoc\(\) \{ const b = this\.block; return !!\(b && b\.name && !b\.is_live_active && !b\.is_session_tasks\); \}/.test(read("src/drawers/BlockDetailDrawer.vue"))) problems.push("src/drawers/BlockDetailDrawer.vue: Activity only for a saved block, not a live session");
if (!/blockDoc\(\) \{ const b = this\.block; return b\.name && !b\.is_live_active && !b\.is_session_tasks \? b\.name : ''; \}/.test(read("src/drawers/SessionDetailDrawer.vue"))) problems.push("src/drawers/SessionDetailDrawer.vue: Activity only for a saved block, not a live session");

// 2. No Raven for blocks, sessions or to-dos, anywhere in the client.
for (const f of ["src/drawers/BlockDetailDrawer.vue", "src/drawers/SessionDetailDrawer.vue", "src/drawers/DrawerCoordinator.vue", "src/composables/useWorkstationFocusTasks.js", "src/composables/useWorkstationEod.js", "src/stores/collaborationStore.js", "src/composables/useWorkstationStoreBindings.js"]) {
  const src = read(f);
  if (/open-raven|fetchDrawerChat|drawerChat/.test(src)) problems.push(`${f}: a block's talk is its Frappe comments, not a Raven channel (open-raven / fetchDrawerChat / drawerChat is back)`);
}
if (/open-raven/.test(read("src/App.vue").replace('@open-raven="openRavenApp"', ""))) problems.push("src/App.vue: only the header opens Raven");
if (!/\.\.\.\(this\.doc\.doctype === 'Task' \? \[\{ label: 'Raven chat'/.test(read("src/drawers/TaskDetailDrawer.vue"))) problems.push("src/drawers/TaskDetailDrawer.vue: Raven chat is offered on an ERPNext Task only");
if (!/if \(this\.linked\.doctype === 'Task'\) items\.push\(\{ label: 'Raven chat'/.test(read("src/components/dialogs/TaskFormDialog.vue"))) problems.push("src/components/dialogs/TaskFormDialog.vue: Raven chat is offered on an ERPNext Task only");

// 3. The server makes Raven channels for Tasks only, and Desk's timeline pulls Raven for Tasks only.
const bridge = read("omnitrack/raven_bridge.py");
if (!/def get_or_create_task_channel[\s\S]*?\n\tif doctype != "Task":\n\t\treturn None/.test(bridge)) problems.push("omnitrack/raven_bridge.py: get_or_create_task_channel makes a channel for a Task and nothing else");
if (/get_block_raven_timeline_content/.test(bridge)) problems.push("omnitrack/raven_bridge.py: a block has no Raven timeline");
const hooks = read("omnitrack/hooks.py");
const timeline = (hooks.match(/additional_timeline_content = \{[\s\S]*?\n\}/) || [""])[0];
if (!timeline || /Planned Work Block|ToDo/.test(timeline)) problems.push("omnitrack/hooks.py: additional_timeline_content names Task only");

// 4. The server: read rights first, a fixed list of DocTypes, POST to write, escaped in, sanitized out.
const api = read("omnitrack/api/activity.py");
if (!/DOCTYPES = \("Planned Work Block", "ToDo", "Task"\)/.test(api)) problems.push("omnitrack/api/activity.py: activity is for Planned Work Block, ToDo and Task only");
if (!/if doctype not in DOCTYPES or/.test(api)) problems.push("omnitrack/api/activity.py: _doc refuses any other DocType");
if (!/doc\.check_permission\("read"\)\n\treturn doc/.test(api)) problems.push("omnitrack/api/activity.py: _doc checks read permission before anything is read or written");
if (!/def get_activity\(doctype: str, name: str\):[\s\S]*?doc = _doc\(doctype, name\)/.test(api)) problems.push("omnitrack/api/activity.py: get_activity goes through _doc");
if (!/@frappe\.whitelist\(methods=\["POST"\]\)\ndef add_comment\(doctype: str, name: str, content: str\):[\s\S]*?doc = _doc\(doctype, name\)/.test(api)) problems.push("omnitrack/api/activity.py: add_comment is POST only and goes through _doc");
if (!/frappe\.utils\.escape_html\(p\.strip\(\)\)/.test(api)) problems.push("omnitrack/api/activity.py: typed text is escaped before it is stored as HTML");
if (!/"html": sanitize_html\(row\.content or "", always_sanitize=True\)/.test(api)) problems.push("omnitrack/api/activity.py: a comment's HTML is sanitized before the panel renders it");
if (!/len\(text\) > MAX_COMMENT/.test(api)) problems.push("omnitrack/api/activity.py: a comment has a length limit");
// Said like a person would: "added 2 tasks", and the same thing twice in a row is one line
if (/f" \(\{n\}\)"/.test(api) || !/\("a task", "\{0\} tasks"\)/.test(api) || !/_\(nouns\[0\]\) if n == 1 else _\(nouns\[1\]\)\.format\(n\)/.test(api)) problems.push('omnitrack/api/activity.py: several rows read "added 2 tasks", not "added a task (2)"');
if (!/return _fold\(items\)\[-MAX_ITEMS:\]/.test(api)) problems.push("omnitrack/api/activity.py: repeated events are folded into one line");
for (const [re, what] of [
  [/and it\["kind"\] == "event" == last\["kind"\]/, "only events fold, never comments"],
  [/and it\.get\("by"\) == last\.get\("by"\)/, "only the same person's events fold"],
  [/\.total_seconds\(\) <= FOLD_SECONDS\n\t\t\):/, "only events minutes apart fold"],
  [/^FOLD_SECONDS = 600$/m, "only events minutes apart fold (10 minutes)"],
  [/last\["at"\], last\["id"\] = it\["at"\], it\.get\("id"\)/, "a folded line shows the latest time"],
  [/_\("\{0\}, twice"\)/, "a folded line says how often"],
]) if (!re.test(api)) problems.push(`omnitrack/api/activity.py: _fold: ${what}`);

// 5. The panel: a named box, Ctrl+Enter, errors and success announced, drafts kept.
const comp = read("src/components/common/DocActivity.vue");
const NEED = [
  [/:label="'Comment on this ' \+ noun"/, "the comment box has a visible label naming the document"],
  [/@keydown\.ctrl\.enter\.prevent="post"/, "Ctrl+Enter posts"],
  [/@keydown\.meta\.enter\.prevent="post"/, "Cmd+Enter posts"],
  [/<p v-if="error"[^>]*role="alert">/, "a failed post is announced"],
  [/<p class="sr-only" role="status">\{\{ said \}\}<\/p>/, "a posted comment is announced"],
  [/catch \(e\) \{\n\s*\/\/ The words stay in the box to try again\n\s*this\.error =/, "a failed post keeps the words"],
  [/const drafts = new Map\(\);/, "unsent drafts are kept per document"],
  [/draft\(v\) \{ if \(v\.trim\(\)\) drafts\.set\(this\.key, v\); else drafts\.delete\(this\.key\); \}/, "the draft is saved as it is typed"],
  [/if \(seq === this\.seq\) this\.take\(res\);/, "a slow load for the last document never lands on the next"],
  [/<Avatar [^>]*aria-hidden="true"/, "the avatar is hidden from screen readers (the name is read)"],
  [/<time [^>]*:datetime="it\.at" :title="fullTime\(it\.at\)">/, "times carry the exact moment on hover"],
  [/:disabled="!draft\.trim\(\)"/, "an empty comment cannot be posted"],
  [/postJSON\('activity\.add_comment'/, "posts through activity.add_comment"],
  [/postJSON\('activity\.get_activity'/, "reads through activity.get_activity"],
  [/newest\(\) \{ return \[\.\.\.this\.items\]\.reverse\(\); \}/, "reads newest first (the server sends oldest first)"],
  [/shown\(\) \{ return this\.hidden \? this\.newest\.slice\(0, RECENT\) : this\.newest; \}/, "shows the newest few, older ones a click away"],
  [/:aria-label="'Activity on this ' \+ noun \+ ', newest first'"/, "tells a screen reader the order"],
  [/<span class="font-medium" :class="strongText">\{\{ it\.by \}\}<\/span>\{\{ ' ' \}\}<\/template>\{\{ it\.text \}\}/, "keeps a space between who and what (\"You added\", not \"Youadded\")"],
];
for (const [re, what] of NEED) if (!re.test(comp)) problems.push(`src/components/common/DocActivity.vue: ${what}`);
// The comment box sits on top, the newest entry right under it
if (!(comp.indexOf("<form ") > -1 && comp.indexOf("<form ") < comp.indexOf("<ol "))) problems.push("src/components/common/DocActivity.vue: the comment box comes before the list");

// Vue drops a space at the very start or end of a <template>, so words run together. Write {{ ' ' }}.
const vueFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? vueFiles(path.join(dir, e.name)) : e.name.endsWith(".vue") ? [path.join(dir, e.name)] : []);
for (const f of vueFiles("src")) {
  read(f).split("\n").forEach((line, i) => {
    if (/[^\s>]>[ \t]+<\/template>|<template\b[^>]*>[ \t]+</.test(line)) problems.push(`${f}:${i + 1}: a space at the edge of a <template> is dropped; write {{ ' ' }}`);
  });
}
if (/v-html="(?!it\.html")/.test(comp)) problems.push("src/components/common/DocActivity.vue: v-html only for a comment's sanitized html");
if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(comp)) problems.push("src/components/common/DocActivity.vue: no emoji or glyphs");

if (problems.length) {
  console.error("FAIL: Activity in the details panels:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK: every details panel shows its document's Activity; Raven is for Tasks only");
