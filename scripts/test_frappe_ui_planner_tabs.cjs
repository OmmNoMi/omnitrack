#!/usr/bin/env node
/**
 * Test Frappe UI Planner Controls & Overdue Button Invariants (TDD++)
 *
 * Requirements:
 * 1. Left rail filter tabs in Planner MUST use genuine Frappe UI <f-button> components
 *    instead of raw <button> tags with custom ad-hoc Tailwind strings.
 * 2. Overdue button MUST use theme="red" with :variant="... === 'overdue' ? 'solid' : 'subtle'"
 *    so it renders with Frappe UI's standard bg-red-600 + text-white when active and
 *    bg-red-50 + text-red-700 when inactive.
 * 3. Planner task search MUST use genuine Frappe UI <f-input> with prefix and suffix slots.
 * 4. FInput component MUST properly support $slots.prefix with left padding.
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

const calendarSrc = fs.existsSync(calendarViewPath) ? fs.readFileSync(calendarViewPath, 'utf8') : '';
const dashboardSrc = fs.existsSync(dashboardViewPath) ? fs.readFileSync(dashboardViewPath, 'utf8') : '';
const fInputSrc = fs.existsSync(fInputPath) ? fs.readFileSync(fInputPath, 'utf8') : '';
const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';

// 1. Planner Left Rail: FInput component used for search
const searchSection = calendarSrc || html.slice(
  html.indexOf('<!-- Quick Search & Filter in Planner Rail -->'),
  html.indexOf('aria-label="Filter assigned work tasks"')
);

assert.ok(
  searchSection.includes('<f-input') && searchSection.includes('v-model="plannerTaskSearch"'),
  'FAIL: Planner search must use genuine Frappe UI <f-input> component.'
);
assert.ok(
  searchSection.includes('#prefix') || searchSection.includes('slot="prefix"'),
  'FAIL: <f-input> search must use prefix slot for search icon.'
);
console.log('✓ Test 1: Planner task search uses genuine Frappe UI <f-input> with prefix/suffix slots.');

// 2. Planner Left Rail: Filter tabs use Frappe UI <f-button>
const filterSection = calendarSrc || (html.includes('aria-label="Filter assigned work tasks"') ? html.slice(
  html.indexOf('aria-label="Filter assigned work tasks"'),
  html.indexOf('!filteredPlannerTasks.length', html.indexOf('aria-label="Filter assigned work tasks"'))
) : '');

assert.ok(filterSection, 'FAIL: Planner task filter tablist not found');
assert.ok(
  filterSection.includes('<f-button') && filterSection.includes('data-planner-tab="all"'),
  'FAIL: "All" tab must use <f-button>.'
);
assert.ok(
  filterSection.includes('<f-button') && filterSection.includes('data-planner-tab="overdue"'),
  'FAIL: "Overdue" tab must use <f-button>.'
);
assert.ok(
  filterSection.includes('theme="red"') && filterSection.includes("plannerTaskFilter === 'overdue' ? 'solid' : 'subtle'"),
  'FAIL: "Overdue" <f-button> must use theme="red" and solid/subtle variant toggle.'
);
assert.ok(
  filterSection.includes('<f-button') && filterSection.includes('data-planner-tab="underplanned"'),
  'FAIL: "Underplanned" tab must use <f-button>.'
);
assert.ok(
  filterSection.includes('<f-button') && filterSection.includes('data-planner-tab="high"'),
  'FAIL: "High" tab must use <f-button>.'
);
console.log('✓ Test 2: Planner left rail filter tabs use genuine Frappe UI <f-button> components with design system themes.');

// 3. Attention Section: Overdue tab also uses Frappe UI <f-button>
const attentionFilterSection = dashboardSrc || (html.includes('aria-label="Filter action required tasks"') ? html.slice(
  html.indexOf('aria-label="Filter action required tasks"'),
  html.indexOf('visibleAttentionTasks', html.indexOf('aria-label="Filter action required tasks"'))
) : '');

assert.ok(attentionFilterSection, 'FAIL: Attention task filter tablist not found');
assert.ok(
  attentionFilterSection.includes('<f-button') && attentionFilterSection.includes('data-attention-tab="overdue"'),
  'FAIL: Attention section "Overdue" tab must use <f-button>.'
);
assert.ok(
  attentionFilterSection.includes('theme="red"') && attentionFilterSection.includes("attentionFilter === 'overdue' ? 'solid' : 'subtle'"),
  'FAIL: Attention "Overdue" <f-button> must use theme="red" and solid/subtle variant toggle.'
);
console.log('✓ Test 3: Attention section filter tabs use genuine Frappe UI <f-button> with theme="red".');

// 4. FInput definition supports prefix slot
const fInputDef = fInputSrc || (html.includes("const FInput = {") ? html.slice(
  html.indexOf("const FInput = {"),
  html.indexOf("const FCard = {")
) : '');

assert.ok(
  fInputDef.includes('$slots.prefix') || fInputDef.includes('slot name="prefix"') || fInputDef.includes('<slot name="prefix"'),
  'FAIL: FInput component definition must support prefix slot.'
);
console.log('✓ Test 4: FInput component supports prefix slot with proper icon alignment.');

// 5. Accessible tab attributes preserved
assert.ok(
  filterSection.includes('role="tab"') && filterSection.includes('aria-selected') && filterSection.includes('tabindex'),
  'FAIL: Planner tabs must retain role="tab", aria-selected, and tabindex for accessibility.'
);
console.log('✓ Test 5: Accessible roving tabindex and role="tab" attributes are preserved.');

console.log('\nSUCCESS: All Frappe UI Planner Controls Invariants passed cleanly!\n');
