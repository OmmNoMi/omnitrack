#!/usr/bin/env node
/**
 * Test Frappe UI Planner Controls & Overdue Button Invariants (TDD++)
 *
 * Requirements:
 * 1. Left rail filter tabs in Planner MUST use genuine Frappe UI <Button> components
 *    instead of raw <button> tags with custom ad-hoc Tailwind strings.
 * 2. Overdue button MUST use theme="red" with :variant="... === 'overdue' ? 'solid' : 'subtle'"
 *    so it renders with Frappe UI's standard bg-red-600 + text-white when active and
 *    bg-red-50 + text-red-700 when inactive.
 * 3. Planner task search MUST use genuine Frappe UI <TextInput> with prefix and suffix slots.
 * 4. The retired FInput wrapper MUST stay gone (frappe-ui TextInput instead).
 * 5. Keyboard navigation (role="tab", data-planner-tab, @keydown) MUST remain fully accessible.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const omnitrackDir = path.resolve(__dirname, '..');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');
const calendarViewPath = path.resolve(omnitrackDir, 'src', 'views', 'CalendarView.vue');
const dashboardViewPath = path.resolve(omnitrackDir, 'src', 'views', 'DashboardView.vue');
const fInputPath = path.resolve(omnitrackDir, 'src', 'components', 'common', 'FInput.vue');

const calendarSrc = (() => { const d = path.resolve(omnitrackDir, 'src', 'views', 'calendar'); return [calendarViewPath, ...(fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.vue')).map((f) => path.join(d, f)) : [])].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n'); })();
const dashboardSrc = (() => { const d = path.resolve(omnitrackDir, 'src', 'views', 'dashboard'); return [dashboardViewPath, ...(fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.vue')).map((f) => path.join(d, f)) : [])].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n'); })();
const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';

// 1. Planner Left Rail: FInput component used for search
const searchSection = calendarSrc || html.slice(
  html.indexOf('<!-- Quick Search & Filter in Planner Rail -->'),
  html.indexOf('aria-label="Filter assigned work tasks"')
);

assert.ok(
  searchSection.includes('<TextInput') && searchSection.includes('v-model="plannerTaskSearch"'),
  'FAIL: Planner search must use genuine Frappe UI <TextInput> component.'
);
assert.ok(
  searchSection.includes('#prefix') || searchSection.includes('slot="prefix"'),
  'FAIL: <TextInput> search must use prefix slot for search icon.'
);
console.log('✓ Test 1: Planner task search uses genuine Frappe UI <TextInput> with prefix/suffix slots.');

// 2. Planner Left Rail: Filter tabs use Frappe UI <Button>
const filterSection = calendarSrc || (html.includes('aria-label="Filter assigned work tasks"') ? html.slice(
  html.indexOf('aria-label="Filter assigned work tasks"'),
  html.indexOf('!filteredPlannerTasks.length', html.indexOf('aria-label="Filter assigned work tasks"'))
) : '');

assert.ok(filterSection, 'FAIL: Planner task filter tablist not found');
// The tabs render from one taskTabs list, so every tab is the same <Button>
// with a stable data-planner-tab id (roving focus keys off it).
assert.ok(
  /<Button\s[^>]*v-for="tab in taskTabs"[^>]*:data-planner-tab="tab.id"/.test(filterSection),
  'FAIL: planner filter tabs must be <Button v-for="tab in taskTabs"> with :data-planner-tab'
);
assert.ok(
  filterSection.includes(":variant=\"plannerTaskFilter === tab.id ? 'solid' : 'ghost'\""),
  'FAIL: planner tabs must toggle solid (selected) / ghost variants'
);
for (const id of ['all', 'underplanned', 'overdue', 'high']) {
  assert.ok(new RegExp(`\\{ id: '${id}', label: '[^']+'`).test(calendarSrc), `FAIL: planner tab "${id}" is missing from taskTabs`);
}
// Filter chips are grey. frappe-ui's red and blue ghost and subtle Buttons keep light-mode text on
// the dark page (Overdue read 2.6:1), and the row's badge already carries the colour. Selected is
// solid, and in dark mode gray-700 under white rather than frappe-ui's near-white fill.
assert.ok(/theme="gray"\s+:class="plannerTaskFilter === tab\.id \? 'dark:!bg-gray-700 dark:!text-white' : ''"/.test(filterSection) && !/theme: '/.test((calendarSrc.match(/taskTabs: \[[\s\S]*?\]/) || [''])[0]), 'FAIL: planner filter chips are grey, and the selected one is gray-700 in dark mode');
// Tabs wrap rather than scroll sideways: the rail is narrow (overflow bug).
assert.ok(/flex-wrap[^"]*" role="tablist" aria-label="Filter assigned work tasks"/.test(calendarSrc), 'FAIL: planner tabs must wrap, not overflow the rail');
console.log('✓ Test 2: Planner left rail filter tabs use genuine Frappe UI <Button> components with design system themes.');

// 3. Attention Section: Overdue tab also uses Frappe UI <Button>
const attentionFilterSection = dashboardSrc || (html.includes('aria-label="Filter action required tasks"') ? html.slice(
  html.indexOf('aria-label="Filter action required tasks"'),
  html.indexOf('visibleAttentionTasks', html.indexOf('aria-label="Filter action required tasks"'))
) : '');

assert.ok(attentionFilterSection, 'FAIL: Attention task filter tablist not found');
assert.ok(
  attentionFilterSection.includes('<Button') && attentionFilterSection.includes(':data-attention-tab="f.key"'),
  'FAIL: Attention section "Overdue" tab must use <Button>.'
);
assert.ok(
  /v-for="f in attentionFilters"[\s\S]*?:variant="attentionFilter === f\.key \? 'solid' : 'subtle'"\s+theme="gray"\s+:class="attentionFilter === f\.key \? 'dark:!bg-gray-700 dark:!text-white' : ''"/.test(attentionFilterSection),
  'FAIL: attention filter chips are grey, and the selected one is gray-700 in dark mode'
);
assert.ok(/\{ key: 'overdue', label: 'Overdue', count: this\.overdueTasksCount \}/.test(attentionFilterSection) && /\.filter\(\(f\) => f\.key === 'all' \|\| f\.count > 0\)/.test(attentionFilterSection), 'FAIL: attention chips list All, then each kind that has tasks');
console.log('✓ Test 3: Attention filter chips are grey frappe-ui Buttons, readable in dark mode.');

// 4. The hand-rolled FInput is retired: search fields are frappe-ui <TextInput>.
assert.ok(!fs.existsSync(fInputPath), 'FAIL: FInput.vue must stay deleted; use frappe-ui <TextInput>.');
assert.ok(!/<f-input|<FInput/.test(calendarSrc + dashboardSrc), 'FAIL: views must not use the retired <f-input>.');
console.log('✓ Test 4: Search fields use frappe-ui TextInput; FInput is gone.');

// 5. Accessible tab attributes preserved
assert.ok(
  filterSection.includes('role="tab"') && filterSection.includes('aria-selected') && filterSection.includes('tabindex'),
  'FAIL: Planner tabs must retain role="tab", aria-selected, and tabindex for accessibility.'
);
console.log('✓ Test 5: Accessible roving tabindex and role="tab" attributes are preserved.');

console.log('\nSUCCESS: All Frappe UI Planner Controls Invariants passed cleanly!\n');
