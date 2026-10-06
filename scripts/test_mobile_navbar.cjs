#!/usr/bin/env node
/**
 * Test Mobile Navbar Viewport & Responsiveness Invariants (Issue #12)
 *
 * Invariants:
 * 1. The redundant 'Production' / 'Local Dev' badge is completely removed from <header>.
 * 2. Raven is an app-menu item, not a header button.
 * 3. Brand group and header controls accommodate narrow viewports (< 480px / 360px-412px)
 *    without overflowing or forcing horizontal scrollbars.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('--- Running Mobile Navbar Responsiveness Invariants Suite (Issue #12) ---');

const omnitrackDir = path.resolve(__dirname, '..');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');
const headerVuePath = path.resolve(omnitrackDir, 'src', 'components', 'layout', 'WorkstationHeader.vue');

const targetPath = fs.existsSync(headerVuePath) ? headerVuePath : (fs.existsSync(appVuePath) ? appVuePath : htmlPath);
assert.ok(fs.existsSync(targetPath), 'FAIL: Component file does not exist');
const htmlContent = fs.readFileSync(targetPath, 'utf8');

// Extract <header>...</header>
const headerMatch = htmlContent.match(/<header[\s\S]*?<\/header>/);
assert.ok(headerMatch, `FAIL: <header> tag not found in ${path.basename(targetPath)}`);
const headerHtml = headerMatch[0];

// Test 1: Production / Local Dev badge MUST NOT exist in <header>
const hasEnvBadge = headerHtml.includes('isProductionEnv');
assert.strictEqual(
  hasEnvBadge,
  false,
  'FAIL: Header must NOT contain the redundant isProductionEnv badge (takes up ~80px and overflows on mobile)'
);
console.log('✓ Test 1: Redundant isProductionEnv badge is completely removed from header.');

// Test 2: Raven lives in the app menu, never as a header button (owner's call: keep the 375px header to clock + menu)
assert.ok(!/<Button[^>]*>\s*Raven\s*<\/Button>/.test(headerHtml), 'FAIL: Raven must not be a header button; it belongs in the app menu');
assert.ok(/label:\s*"Raven chat"[^}]*\$emit\("open-raven"\)/.test(htmlContent), 'FAIL: app menu must carry a "Raven chat" item that emits open-raven');
assert.ok(/<Dropdown :options="menuItems"/.test(headerHtml), 'FAIL: header Dropdown must use menuItems (Raven + shared menu)');
assert.ok(/label:\s*"OmniTrack Desk"[^}]*\/desk\/omnitrack/.test(htmlContent), 'FAIL: app menu must offer "OmniTrack Desk" (/desk/omnitrack) for moving to the Desk interface');
assert.ok(/this\.isClient \? \[\]/.test(htmlContent), 'FAIL: the Desk link must be hidden from client-portal users');
const collab = fs.readFileSync(path.resolve(omnitrackDir, 'src', 'stores', 'collaborationStore.js'), 'utf8');
assert.ok(!/window\.open\('\/app\/raven'/.test(collab), 'FAIL: /app/raven is the Raven Desk workspace, not the chat; open /raven');
console.log('✓ Test 2: Raven and OmniTrack Desk are reached from the app menu, not the header.');

// Test 3: Header and its containers do not prevent fluid shrinking
// Brand group container (containing the logo and OmniTrack title)
assert.ok(
  !headerHtml.includes('gap-2.5 sm:gap-3 flex-shrink-0') || headerHtml.includes('min-w-0'),
  'FAIL: Brand group should allow fluid shrinking on narrow screens'
);
console.log('✓ Test 3: Fluid shrink responsiveness invariants verified.');

console.log('\nSUCCESS: All Mobile Navbar Invariants passed cleanly!\n');
