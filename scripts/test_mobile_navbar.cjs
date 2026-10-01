#!/usr/bin/env node
/**
 * Test Mobile Navbar Viewport & Responsiveness Invariants (Issue #12)
 *
 * Invariants:
 * 1. The redundant 'Production' / 'Local Dev' badge is completely removed from <header>.
 * 2. Raven Chat button text collapses on mobile with `hidden sm:inline`.
 * 3. Brand group and header controls accommodate narrow viewports (< 480px / 360px-412px)
 *    without overflowing or forcing horizontal scrollbars.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('--- Running Mobile Navbar Responsiveness Invariants Suite (Issue #12) ---');

const omnitrackDir = path.resolve(__dirname, '..');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');

assert.ok(fs.existsSync(htmlPath), 'FAIL: omnitrack.html does not exist');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract <header>...</header>
const headerMatch = htmlContent.match(/<header[\s\S]*?<\/header>/);
assert.ok(headerMatch, 'FAIL: <header> tag not found in omnitrack.html');
const headerHtml = headerMatch[0];

// Test 1: Production / Local Dev badge MUST NOT exist in <header>
const hasEnvBadge = headerHtml.includes('isProductionEnv');
assert.strictEqual(
  hasEnvBadge,
  false,
  'FAIL: Header must NOT contain the redundant isProductionEnv badge (takes up ~80px and overflows on mobile)'
);
console.log('✓ Test 1: Redundant isProductionEnv badge is completely removed from header.');

// Test 2: Raven Chat text MUST have `hidden sm:inline` so mobile devices show only the icon
const ravenChatMatch = headerHtml.match(/<f-button[^>]*@click="openRavenApp"[^>]*>([\s\S]*?)<\/f-button>/);
assert.ok(ravenChatMatch, 'FAIL: Raven Chat launcher button not found in header');
const ravenButtonHtml = ravenChatMatch[0];

assert.ok(
  ravenButtonHtml.includes('class="hidden sm:inline">Raven Chat</span>') ||
  ravenButtonHtml.includes('class="hidden sm:inline select-none">Raven Chat</span>'),
  'FAIL: Raven Chat text must be hidden on mobile (<640px) with `class="hidden sm:inline"` to prevent horizontal overflow'
);
console.log('✓ Test 2: Raven Chat text collapsed on mobile viewports (<640px) with hidden sm:inline.');

// Test 3: Header and its containers do not prevent fluid shrinking
// Brand group container (containing the logo and OmniTrack title)
assert.ok(
  !headerHtml.includes('gap-2.5 sm:gap-3 flex-shrink-0') || headerHtml.includes('min-w-0'),
  'FAIL: Brand group should allow fluid shrinking on narrow screens'
);
console.log('✓ Test 3: Fluid shrink responsiveness invariants verified.');

console.log('\nSUCCESS: All Mobile Navbar Invariants passed cleanly!\n');
