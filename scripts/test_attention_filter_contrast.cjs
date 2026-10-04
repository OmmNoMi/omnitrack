#!/usr/bin/env node
/**
 * Test Attention and Planner Filter Contrast & Palette Invariants (TDD++)
 *
 * Requirements:
 * 1. tailwind.config.cjs MUST extend the color palette with standard Tailwind colors
 *    (rose, emerald, slate) so that rose-based alert styling and emerald/slate badges
 *    do not get stripped by Frappe UI's restrictive preset.
 * 2. When attentionFilter === 'overdue' is active, the button MUST have high-contrast styling
 *    and its active background classes (`bg-rose-600` or `bg-rose-700`) MUST be compiled into
 *    `omnitrack/public/dist/omnitrack.bundle.css`.
 * 3. White text (`text-white`) MUST NEVER be rendered on an uncompiled/transparent or light background.
 *    The active overdue button must be paired with an active background that exists in the CSS bundle.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('--- Running Attention Filter Contrast & Palette Invariants Suite ---');

const omnitrackDir = path.resolve(__dirname, '..');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');
const tailwindConfigPath = path.resolve(omnitrackDir, 'tailwind.config.cjs');
const bundleCssPath = path.resolve(omnitrackDir, 'omnitrack', 'public', 'dist', 'omnitrack.bundle.css');

assert.ok(fs.existsSync(htmlPath), 'FAIL: omnitrack.html does not exist');
assert.ok(fs.existsSync(tailwindConfigPath), 'FAIL: tailwind.config.cjs does not exist');
assert.ok(fs.existsSync(bundleCssPath), 'FAIL: omnitrack.bundle.css does not exist');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const tailwindConfigContent = fs.readFileSync(tailwindConfigPath, 'utf8');
const bundleCssContent = fs.readFileSync(bundleCssPath, 'utf8');

// Test 1: tailwind.config.cjs MUST explicitly include rose palette
const hasRoseConfig = tailwindConfigContent.includes('rose: require("tailwindcss/colors").rose') ||
  tailwindConfigContent.includes('rose: colors.rose');
assert.ok(
  hasRoseConfig,
  'FAIL: tailwind.config.cjs does not include rose color palette. Frappe UI preset wipes standard Tailwind colors!'
);
console.log('✓ Test 1: tailwind.config.cjs extends the required color palettes.');

// Test 2: omnitrack.bundle.css MUST contain compiled `bg-rose-600` and `bg-rose-50`
const hasBgRose600 = bundleCssContent.includes('bg-rose-600');
const hasBgRose50 = bundleCssContent.includes('bg-rose-50');
assert.ok(
  hasBgRose600,
  'FAIL: omnitrack.bundle.css is missing .bg-rose-600! Overdue button renders transparent with white text.'
);
assert.ok(
  hasBgRose50,
  'FAIL: omnitrack.bundle.css is missing .bg-rose-50! Inactive overdue button lacks light background.'
);
console.log('✓ Test 2: omnitrack.bundle.css contains compiled rose background utility classes.');

const dashboardViewPath = path.resolve(omnitrackDir, 'src', 'views', 'DashboardView.vue');
const dashboardViewContent = fs.existsSync(dashboardViewPath) ? fs.readFileSync(dashboardViewPath, 'utf8') : '';
const targetTemplateContent = dashboardViewContent || htmlContent;

// Test 3: Attention tab buttons have accessible contrast definitions
const overdueIdx = targetTemplateContent.indexOf("setAttentionFilter('overdue')");
assert.ok(overdueIdx !== -1, 'FAIL: Overdue attention filter button not found');
const startBtn = Math.max(
  targetTemplateContent.lastIndexOf('<f-button', overdueIdx),
  targetTemplateContent.lastIndexOf('<button', overdueIdx)
);
const endBtn = targetTemplateContent.indexOf('>', overdueIdx) + 1;
const overdueBtnHtml = targetTemplateContent.slice(startBtn, endBtn);

const isFrappeUIOverdue = overdueBtnHtml.includes('<f-button') &&
  overdueBtnHtml.includes('theme="red"');
const isCustomOverdue = (overdueBtnHtml.includes('bg-rose-600') || overdueBtnHtml.includes('bg-rose-700')) &&
  overdueBtnHtml.includes('text-white');

assert.ok(
  isFrappeUIOverdue || isCustomOverdue,
  'FAIL: Active overdue button must use genuine Frappe UI <f-button theme="red"> or solid high-contrast background'
);
console.log('✓ Test 3: Active and inactive overdue button classes are properly configured for contrast.');

console.log('\nSUCCESS: All Attention Filter Contrast Invariants passed cleanly!\n');
