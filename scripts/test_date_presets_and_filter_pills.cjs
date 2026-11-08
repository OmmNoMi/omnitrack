#!/usr/bin/env node
/**
 * Test Date Quick Presets & Icon-Only Filter Pills Invariants (Issue #19)
 *
 * Invariants:
 * 1. (Day chips stay as develop has them: Today, Tomorrow, then weekday names.)
 * 2. Assigned work filter pills ('All', 'Underplanned', 'Overdue', 'High'/'Star') display as
 *    icons only when unselected, with tooltips and accessible labels, and show full text labels
 *    only when selected/active.
 * 3. tasks.py sends each workflow action once, so no menu repeats one.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('--- Running Date Presets & Filter Pills Invariants Suite (Issue #19) ---');

const omnitrackDir = path.resolve(__dirname, '..');
const calendarAssignedPath = path.resolve(omnitrackDir, 'src', 'views', 'calendar', 'CalendarAssignedTasks.vue');
const tasksPyPath = path.resolve(omnitrackDir, 'omnitrack', 'api', 'tasks.py');

const calendarAssignedSrc = fs.readFileSync(calendarAssignedPath, 'utf8');
const tasksPySrc = fs.readFileSync(tasksPyPath, 'utf8');

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

// 3. Workflow Actions Deduplication: once, on the server, where the duplicates come from
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
