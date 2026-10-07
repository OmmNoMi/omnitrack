#!/usr/bin/env node
// One product, configured per customer: what a person may see of a project comes from one rule
// (permissions.projects_for), never from a customer's name written into the code. The Projects
// page reads ERPNext Projects through that rule, shows clients only shared deliverables, and is
// keyboard-first like every list in the app.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (ok, what) => { if (!ok) problems.push(what); };

// No customer is special. Walks the app's own source, not the built bundle or fixtures.
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", "dist", "fixtures", "tests", "patches"].includes(e.name)) walk(rel, out); }
    else if (/\.(py|vue|js|mjs|html)$/.test(e.name) && e.name !== "importer.py") out.push(rel);
  }
  return out;
};
for (const f of [...walk("src"), ...walk("omnitrack")]) {
  if (/omnitrack\/public\//.test(f)) continue;
  need(!/CampusCredit|CATMA/.test(read(f)), `${f}: no customer's name in the code; who sees a project comes from projects_for`);
}

// Frappe 16 refuses an expression in get_all's order_by ("Invalid field format in Order By"), which
// made opening any project fail. Order by plain fields and sort the rest in Python.
for (const f of walk("omnitrack").filter((f) => f.endsWith(".py"))) {
  for (const m of read(f).matchAll(/order_by\s*=\s*["']([^"']*)["']/g)) {
    need(!/\bis\s+(not\s+)?null\b|\(|\bcase\b/i.test(m[1]), `${f}: order_by "${m[1]}" is an expression; Frappe 16 accepts only fields`);
  }
}

// permissions.py: values reach SQL escaped, and a client sees blocks only on projects shared with them
const perms = read("omnitrack/permissions.py");
need(!/f["'][^\n]*'[^'\n]*\{user\}[^'\n]*'/.test(perms), "permissions.py: no user id pasted into SQL in quotes; use frappe.db.escape");
need(/_assign LIKE \{frappe\.db\.escape\(_assigned_like\(user\)\)\}/.test(perms), "permissions.py: the Task query escapes the assignee pattern");
need(!/IS NOT NULL/i.test(perms.slice(perms.indexOf("def client_block_condition"))), "permissions.py: a block query never shows every block with a project");
need(/projects_for\(user, include_assigned=False\)/.test(perms.slice(perms.indexOf("def get_work_block_permission_query_conditions"))), "permissions.py: the block query lists projects through projects_for");
need(/return bool\(doc\.project\) and doc\.project in \(projects_for\(user, include_assigned=False\) or \[\]\)/.test(perms), "permissions.py: opening one block checks the same projects_for rule");

// A client sees a person's work only when that person is visible to clients, and a task only when it is shared
const fn = (src, name) => { const i = src.indexOf("def " + name); return i < 0 ? "" : src.slice(i, src.indexOf("\ndef ", i + 1)); };
const people = fn(perms, "client_visible_people");
need(/has_column\("OmniTrack User Entitlement", "visible_to_clients"\):\n\t\treturn set\(\)/.test(people), "permissions.py: nobody is visible to clients until the field exists");
need(/WHERE visible_to_clients = 1/.test(people) && /`tabHas Role`/.test(people), "permissions.py: people are visible to clients by user or by role");
const cond = fn(perms, "client_block_condition");
need(/if not projects or not people:\n\t\treturn "1=0"/.test(cond), "permissions.py: no shared project or no visible person means no blocks for a client");
need(/`employee` IN \(\{persons\}\)/.test(cond) && /`project` IN \(\{listed\}\)/.test(cond), "permissions.py: a client's blocks are limited to shared projects AND visible people");
need(/IFNULL\(\{t\}\.`task`, ''\) = ''" \+ \(f" OR \{t\}\.`task` IN \(\{shared\}\)" if shared else ""\)/.test(cond), "permissions.py: a client's block with a task needs that task shared");
need(/escape\(p\) for p in sorted\(people\)/.test(cond), "permissions.py: visible people reach SQL escaped");
need(/custom_is_public_deliverable = 1/.test(fn(perms, "_shared_tasks_sql")) && /exists\("DocType", "Task"\)/.test(fn(perms, "_shared_tasks_sql")), "permissions.py: shared tasks need the Task DocType and the shared flag");
const blockQ = fn(perms, "get_work_block_permission_query_conditions");
need(/if is_project_client\(user\):\n\t\tconditions\.append\(client_block_condition\(user\)\)\n\t\treturn/.test(blockQ), "permissions.py: the block list query gives a client only client_block_condition");
need(/if is_project_client\(user\):\n\t\treturn client_may_see_block\(doc, user\)/.test(fn(perms, "has_work_block_permission")), "permissions.py: opening one block applies the client rule");
const mayDoc = fn(perms, "client_may_see_block");
need(/not in client_visible_people\(\)/.test(mayDoc) && /custom_is_public_deliverable/.test(mayDoc), "permissions.py: one block checks the person and the task");

// The workstation and the page's boot never hand a client someone else's blocks
const ws = read("omnitrack/api/workstation.py");
need(/allowed_projects = \(projects_for\(session_user, include_assigned=False\) or \[\]\) if is_client else \[\]/.test(ws), "workstation.py: a client's blocks come from projects_for");
need(/where_clause = client_block_condition\(session_user\) if allowed_projects else "1=0"/.test(ws), "workstation.py: a client's feed uses the same client rule, and nothing without a shared project");
const boot = read("omnitrack/www/omnitrack.py");
need(!/get_all\(\s*["']Planned Work Block|get_list\(\s*["']Planned Work Block|get_workstation_data\(/.test(boot), "www/omnitrack.py: the page boot loads no blocks; the app asks for them through the API");
need(/has_projects/.test(boot) && /has_projects: \{\{/.test(read("omnitrack/www/omnitrack.html")), "www/omnitrack: the page tells the app whether the site has Projects");

// projects.py: both endpoints gate on projects_for; clients see shared deliverables and no planned time
const api = read("omnitrack/api/projects.py");
const getProjects = api.slice(api.indexOf("def get_projects"), api.indexOf("def _names"));
const getProject = api.slice(api.indexOf("def get_project("));
need(/allowed = projects_for\(user\)/.test(getProjects) && /"name": \["in", allowed\]/.test(getProjects), "projects.py: the list holds only the projects projects_for allows");
need(/if allowed is not None and name not in allowed:\n\t\tfrappe\.throw\([^\n]*frappe\.PermissionError\)/.test(getProject), "projects.py: opening a project not shared with you is refused");
for (const [name, body] of [["get_projects", getProjects], ["get_project", getProject]]) {
  need(/custom_is_public_deliverable"\] = 1/.test(body) && /if not frappe\.db\.has_column\("Task", "custom_is_public_deliverable"\):/.test(body), `projects.py ${name}: a client sees only tasks marked as shared deliverables, and none when the field is missing`);
}
need(/"planned_hours": None if client else/.test(api) && (api.match(/"planned_hours": None if client else/g) || []).length === 2, "projects.py: a client never sees planned hours");
need(/visible = client_visible_people\(\) if client else None/.test(getProject) && /"assignees": _names\(t\._assign, only=visible\)/.test(getProject), "projects.py: a client sees only visible people named on a shared task");
need(/"logged_hours": None if hide_logged else/.test(api), "projects.py: a project member set to hide timesheets sees no logged hours");
need(/not t\.get\("is_group"\)/.test(api), "projects.py: a group task is a heading, not open work");

// The switches exist: a task or to-do can be shared, a person can be made visible to clients
const install = read("omnitrack/install.py");
need((install.match(/"fieldname": "custom_is_public_deliverable"/g) || []).length === 2, "install.py: Task and ToDo both get the Shared with Client field");
need(/"fieldname": "visible_to_clients"/.test(read("omnitrack/omnitrack/doctype/omnitrack_user_entitlement/omnitrack_user_entitlement.json")), "OmniTrack User Entitlement: has Visible to Clients");

// The page: shown only where Projects exist, reachable, one tab stop per list and per tab bar
const nav = read("src/components/layout/WorkstationBottomNav.vue");
// Projects and Logged time live in the header's menu ("Go to"): seven targets crowded the bar
const header = read("src/components/layout/WorkstationHeader.vue");
need(/\.\.\.\(this\.hasProjects \? \[\{ label: "Projects", icon: "briefcase", onClick: \(\) => this\.\$emit\("navigate", "projects"\) \}\] : \[\]\)/.test(header), "WorkstationHeader.vue: the menu offers Projects only on a site that has Projects");
need(/\{ label: "Logged time", icon: "clock", onClick: \(\) => this\.\$emit\("navigate", "timesheets"\) \}/.test(header) && /\{ group: "Go to", hideLabel: true, items: pages \}/.test(header), "WorkstationHeader.vue: the menu opens with Projects and Logged time, apart from its actions");
need(!/activeTab === 'projects'|activeTab === 'timesheets'/.test(nav), "WorkstationBottomNav.vue: Projects and Logged time are not back in the bottom bar (they are in the header's menu)");
need(!/'!text-blue-500|'!text-gray-600 font-medium'/.test(nav), "WorkstationBottomNav.vue: 10px labels keep 4.5:1 contrast (no blue-500 on white, no gray-600 on the dark bar)");
need(/:has-projects="hasProjects"\n    @go-dashboard="activeTab = 'dashboard'"\n    @navigate="activeTab = \$event"/.test(read("src/App.vue")) && /<ProjectsView v-else-if="activeTab === 'projects'" \/>/.test(read("src/App.vue")), "App.vue: the header's menu hears whether Projects exist and moves between pages, and the Projects page renders");
need(/path: '\/projects'/.test(read("src/router/index.js")) && /'projects'/.test(read("src/composables/useWorkstationShell.js")), "router + shell: #/projects is a page");
const view = read("src/views/ProjectsView.vue");
need(/:tabindex="p\.name === currentRow \? 0 : -1"/.test(view), "ProjectsView.vue: the project list is one tab stop (roving)");
need(/:tabindex="t\.name === currentTask \? 0 : -1"/.test(view), "ProjectsView.vue: a project's task list is one tab stop (roving)");
need(!/<component\s[^>]*:is="[^"]*'button'/.test(view), "ProjectsView.vue: no <component is=\"button\">; it resolves to frappe-ui's global Button");
need(/role="tablist"/.test(view) && /:tabindex="status === s\.id \? 0 : -1"/.test(view) && /:aria-selected="status === s\.id/.test(view), "ProjectsView.vue: the status bar is a tablist with one tab stop");
need(/'ArrowDown'/.test(view) && /'Home'/.test(view) && /'End'/.test(view) && /'ArrowRight'/.test(view), "ProjectsView.vue: arrows, Home and End move through the lists and tabs");
need(/role="progressbar" :aria-valuenow/.test(view), "ProjectsView.vue: percent complete is a labelled progressbar");
need(/if \(!this\.detail \|\| this\.detail\.is_client\) return;/.test(view), "ProjectsView.vue: a client reads tasks; only the team opens the task form");
need(/openTaskDetail\(\n\s*\{ doctype: 'Task'/.test(view), "ProjectsView.vue: a task opens its details panel (Edit there opens the one task form)");

if (problems.length) {
  console.error("FAIL: projects and client visibility\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: projects come from one visibility rule, clients see only what is shared, and the Projects page is keyboard-first.");
