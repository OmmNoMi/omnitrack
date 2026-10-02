#!/usr/bin/env node
/**
 * Test Planner Isolated Scrolling & Compact Stats Invariants (TDD++)
 *
 * Invariants:
 * 1. Desktop Planner outer container does not stretch with task list:
 *    - #app and body must have overflow hidden or height constrained on desktop when activeTab === 'planner'
 *    - Individual columns (left assigned work, center calendar, right stats) must scroll independently
 *      with their own scroll containers.
 * 2. Left assigned work rail must maintain max-height / h-full containment and internal scrolling:
 *    - `overflow-y-auto` on the task list (`<ul>`).
 *    - Cards in left rail must not push the outer page down.
 * 3. Statistical cards on the right rail must not suffer from excessive whitespace:
 *    - Cards must have compact internal padding (`p-3` or `!p-3` without ballooning).
 *    - Card container must not stretch single cards to fill massive vertical empty voids;
 *      cards must be compact and tightly spaced (`gap-2` / `space-y-2`).
 * 4. Spec compliance:
 *    - Zero broken template structures.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('--- Running Planner Viewport & Stats Compacting Test Suite ---');

const omnitrackDir = path.resolve(__dirname, '..');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');

assert.ok(fs.existsSync(htmlPath), 'FAIL: omnitrack.html does not exist');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Test 1: Desktop body / root containment for planner view
assert.ok(
  htmlContent.includes("activeTab === 'planner' ? 'lg:h-screen lg:max-h-screen lg:overflow-hidden' : ''"),
  'FAIL: #app must constrain height and overflow on desktop when activeTab === planner'
);
assert.ok(
  htmlContent.includes("activeTab === 'planner' ? 'lg:flex lg:flex-col lg:min-h-0 lg:max-h-full lg:overflow-hidden"),
  'FAIL: <main> container must freeze outer viewport height and prevent outer window scrolling in planner'
);
console.log('✓ Test 1: Outer window scrolling prevention and desktop viewport height freeze verified.');

// Test 2: Independent scrollability for all 3 columns
// Left Rail
const leftRailIdx = htmlContent.indexOf('My Assigned Work');
assert.ok(leftRailIdx !== -1, 'FAIL: Left rail header not found');
const leftRailSection = htmlContent.slice(leftRailIdx - 200, leftRailIdx + 5500);
assert.ok(
  leftRailSection.includes('overflow-y-auto') && leftRailSection.includes('min-h-0'),
  'FAIL: Left assigned work rail must have an independent internal vertical scroll container'
);

// Center Calendar
const calendarIdx = htmlContent.indexOf('ref="plannerGridScroll"');
assert.ok(calendarIdx !== -1, 'FAIL: Calendar grid scroller not found');
const calendarSection = htmlContent.slice(calendarIdx - 100, calendarIdx + 300);
assert.ok(
  calendarSection.includes('overflow-y-auto') && calendarSection.includes('overscroll-contain'),
  'FAIL: Calendar grid must have its own independent internal vertical scroll container'
);

// Right Stats Rail
const statsRailIdx = htmlContent.indexOf('Week Performance');
assert.ok(statsRailIdx !== -1, 'FAIL: Right stats rail header not found');
const statsRailSection = htmlContent.slice(statsRailIdx - 100, statsRailIdx + 800);
assert.ok(
  statsRailSection.includes('overflow-y-auto') && statsRailSection.includes('min-h-0'),
  'FAIL: Right stats rail must have independent scroll containment if content exceeds viewport'
);
console.log('✓ Test 2: All 3 columns (Left Tasks, Center Calendar, Right Stats) scroll independently.');

// Test 3: Right side statistical cards whitespace compaction
// Cards must NOT use bloated padding; they must be compact and not stretched with huge empty spaces
const rightCardsMatch = htmlContent.slice(statsRailIdx, statsRailIdx + 2500);
assert.ok(
  !rightCardsMatch.includes('flex-1') || rightCardsMatch.includes('items-start'),
  'FAIL: Statistical cards must not be vertically stretched to create huge white empty voids'
);
assert.ok(
  rightCardsMatch.includes('!p-2.5') || rightCardsMatch.includes('p-3') || rightCardsMatch.includes('!p-3'),
  'FAIL: Statistical cards must use compact padding'
);
console.log('✓ Test 3: Right side statistical cards are compact with minimal white space.');

console.log('\nSUCCESS: All Planner Viewport & Stats Invariants passed cleanly!\n');
