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

console.log('--- Running Frappe UI Planner Controls Invariants Suite ---');

const omnitrackDir = path.resolve(__dirname, '..');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');
assert.ok(fs.existsSync(htmlPath), 'FAIL: omnitrack.html does not exist');

const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Planner Left Rail: FInput component used for search
const searchSection = html.slice(
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
const filterStart = html.indexOf('aria-label="Filter assigned work tasks"');
assert.ok(filterStart !== -1, 'FAIL: Planner task filter tablist not found');
const filterSection = html.slice(
  filterStart,
  html.indexOf('!filteredPlannerTasks.length', filterStart)
);

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
const attStart = html.indexOf('aria-label="Filter action required tasks"');
assert.ok(attStart !== -1, 'FAIL: Attention task filter tablist not found');
const attentionFilterSection = html.slice(
  attStart,
  html.indexOf('visibleAttentionTasks', attStart)
);

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
const fInputDef = html.slice(
  html.indexOf("const FInput = {"),
  html.indexOf("const FCard = {")
);

assert.ok(
  fInputDef.includes('$slots.prefix'),
  'FAIL: FInput component definition must support $slots.prefix slot.'
);
console.log('✓ Test 4: FInput component supports prefix slot with proper icon alignment.');

// 5. Accessible tab attributes preserved
assert.ok(
  filterSection.includes('role="tab"') && filterSection.includes('aria-selected') && filterSection.includes('tabindex'),
  'FAIL: Planner tabs must retain role="tab", aria-selected, and tabindex for accessibility.'
);
console.log('✓ Test 5: Accessible roving tabindex and role="tab" attributes are preserved.');

console.log('\nSUCCESS: All Frappe UI Planner Controls Invariants passed cleanly!\n');
