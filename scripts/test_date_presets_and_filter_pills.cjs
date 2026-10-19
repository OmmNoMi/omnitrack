#!/usr/bin/env node
/**
 * Test Date Quick Presets & Icon-Only Filter Pills Invariants (Issue #19)
 *
 * Invariants:
 * 1. DayTimeFields provides quick day presets: Today (0), Tomorrow (+1), +2d (+2).
 * 2. Assigned work filter pills ('All', 'Underplanned', 'Overdue', 'High'/'Star') display as
 *    icons only when unselected, with tooltips and accessible labels, and show full text labels
 *    only when selected/active.
 * 3. Task Detail Drawer (and TaskFormDialog, tasks.py) deduplicate workflow actions so no action
 *    appears multiple times.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('--- Running Date Presets & Filter Pills Invariants Suite (Issue #19) ---');

const omnitrackDir = path.resolve(__dirname, '..');
const dayTimePath = path.resolve(omnitrackDir, 'src', 'components', 'common', 'DayTimeFields.vue');
const calendarAssignedPath = path.resolve(omnitrackDir, 'src', 'views', 'calendar', 'CalendarAssignedTasks.vue');
const taskDrawerPath = path.resolve(omnitrackDir, 'src', 'drawers', 'TaskDetailDrawer.vue');
const taskFormPath = path.resolve(omnitrackDir, 'src', 'components', 'dialogs', 'TaskFormDialog.vue');
const tasksPyPath = path.resolve(omnitrackDir, 'omnitrack', 'api', 'tasks.py');

const dayTimeSrc = fs.readFileSync(dayTimePath, 'utf8');
const calendarAssignedSrc = fs.readFileSync(calendarAssignedPath, 'utf8');
const taskDrawerSrc = fs.readFileSync(taskDrawerPath, 'utf8');
const taskFormSrc = fs.readFileSync(taskFormPath, 'utf8');
const tasksPySrc = fs.readFileSync(tasksPyPath, 'utf8');

// 1. DayTimeFields Date Presets
assert.ok(
  /dayOffsets:\s*\{\s*type:\s*Array,\s*default:\s*\(\)\s*=>\s*\[0,\s*1,\s*2\]\s*\}/.test(dayTimeSrc),
  'FAIL: DayTimeFields default dayOffsets must be [0, 1, 2] for Today, Tomorrow, +2d presets'
);
assert.ok(
  /2:\s*"\+2d"/.test(dayTimeSrc),
  'FAIL: DayTimeFields named day mapping must name offset 2 as "+2d"'
);
assert.ok(
  /0:\s*"Today"/.test(dayTimeSrc) && /1:\s*"Tomorrow"/.test(dayTimeSrc),
  'FAIL: DayTimeFields named day mapping must name offset 0 as "Today" and 1 as "Tomorrow"'
);
console.log('✓ Invariant 1: DayTimeFields provides Today, Tomorrow, +2d quick presets.');

// 2. Assigned Work Filter Pills: icon-only when unselected, full label when selected
assert.ok(
  /:icon="plannerTaskFilter !== tab\.id \? tab\.icon : undefined"/.test(calendarAssignedSrc),
  'FAIL: Unselected filter buttons must render icon only'
);
assert.ok(
  /:icon-left="plannerTaskFilter === tab\.id \? tab\.icon : undefined"/.test(calendarAssignedSrc),
  'FAIL: Selected filter button must render icon-left'
);
assert.ok(
  /<span v-if="plannerTaskFilter === tab\.id">\{\{\s*tab\.label\s*\}\}<\/span>/.test(calendarAssignedSrc),
  'FAIL: Filter pill text label must render only when selected'
);
assert.ok(
  /:tooltip="plannerTaskFilter !== tab\.id \? tab\.label : undefined"/.test(calendarAssignedSrc),
  'FAIL: Unselected icon-only filter button must provide tooltip with its full label'
);
assert.ok(
  calendarAssignedSrc.includes("icon: 'list'") &&
  calendarAssignedSrc.includes("icon: 'clock'") &&
  calendarAssignedSrc.includes("icon: 'alert-triangle'") &&
  calendarAssignedSrc.includes("icon: 'star'"),
  'FAIL: taskTabs must define icons list, clock, alert-triangle, and star'
);
console.log('✓ Invariant 2: Assigned work filter pills display icon-only when unselected with tooltip and label when selected.');

// 3. Workflow Actions Deduplication
assert.ok(
  /const seen = new Set\(\);[\s\S]*?\.filter\(\(a\) => \{\s*if \(!a \|\| !a\.action \|\| seen\.has\(a\.action\)\) return false;\s*seen\.add\(a\.action\);\s*return true;\s*\}\)/.test(taskDrawerSrc),
  'FAIL: TaskDetailDrawer stateMoves must deduplicate actions by action name'
);
assert.ok(
  tasksPySrc.includes('seen_actions = set()') && tasksPySrc.includes('if act in seen_actions:'),
  'FAIL: omnitrack/api/tasks.py get_task_workflow_actions must deduplicate transitions by action'
);
assert.ok(
  tasksPySrc.includes('seen = set()') && tasksPySrc.includes('if t.action not in seen:'),
  'FAIL: omnitrack/api/tasks.py _workflow_of must deduplicate transitions by action'
);
console.log('✓ Invariant 3: Workflow actions in Task Detail Drawer and tasks.py are deduplicated.');

console.log('\nSUCCESS: All Date Presets & Filter Pills Invariants passed cleanly!\n');
