#!/usr/bin/env node
/**
 * Test Mobile Overlay Back Navigation Invariants (Issue #15)
 *
 * Invariants:
 * 1. Edge-swipe back or Back button with a drawer or modal open closes the topmost
 *    overlay without leaving the app or navigating away from current tab.
 * 2. Nested overlays (e.g. dialog opened from within a drawer) close in LIFO order
 *    on consecutive Back actions.
 * 3. Programmatic close (X button, backdrop click, cancel, form submit) removes the
 *    overlay and cleans up history without triggering unrequested popstate closures.
 * 4. When no overlays are open, back navigation passes through cleanly to router / browser.
 * 5. FDialog, DrawerCoordinator, and TaskDetailDrawer are correctly wired to overlayHistory.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

console.log('--- Running Mobile Overlay Back Navigation Invariants Suite (Issue #15) ---');

const omnitrackDir = path.resolve(__dirname, '..');

// --------------------------------------------------------------------------
// Part 1: Static Wire Invariants
// --------------------------------------------------------------------------
const fdialogPath = path.resolve(omnitrackDir, 'src', 'components', 'common', 'FDialog.vue');
const drawerCoordPath = path.resolve(omnitrackDir, 'src', 'drawers', 'DrawerCoordinator.vue');
const taskDrawerPath = path.resolve(omnitrackDir, 'src', 'drawers', 'TaskDetailDrawer.vue');

const fdialogSrc = fs.readFileSync(fdialogPath, 'utf8');
const drawerCoordSrc = fs.readFileSync(drawerCoordPath, 'utf8');
const taskDrawerSrc = fs.readFileSync(taskDrawerPath, 'utf8');

// FDialog
assert.ok(
  fdialogSrc.includes("import { pushOverlay, removeOverlay } from '../../utils/overlayHistory.js'"),
  'FAIL: FDialog.vue must import pushOverlay and removeOverlay from overlayHistory.js'
);
assert.ok(
  /pushOverlay\(this\.dialogOverlayId,\s*\(\)\s*=>\s*\{\s*this\.open\s*=\s*false;\s*\}\)/.test(fdialogSrc),
  'FAIL: FDialog.vue must push overlay with close callback setting open = false'
);
assert.ok(
  /removeOverlay\(this\.dialogOverlayId\)/.test(fdialogSrc),
  'FAIL: FDialog.vue must remove overlay when modelValue becomes false or component unmounts'
);
console.log('✓ Invariant 1: FDialog.vue is wired to overlayHistory.');

// DrawerCoordinator
assert.ok(
  drawerCoordSrc.includes("import { pushOverlay, removeOverlay } from '../utils/overlayHistory.js'"),
  'FAIL: DrawerCoordinator.vue must import pushOverlay and removeOverlay from overlayHistory.js'
);
assert.ok(
  /pushOverlay\('drawer-block',\s*\(\)\s*=>\s*this\.\$emit\('close-block-drawer'\)\)/.test(drawerCoordSrc),
  'FAIL: DrawerCoordinator.vue must push drawer-block overlay on showBlockDrawer'
);
assert.ok(
  /pushOverlay\('drawer-session',\s*\(\)\s*=>\s*this\.\$emit\('close-session-drawer'\)\)/.test(drawerCoordSrc),
  'FAIL: DrawerCoordinator.vue must push drawer-session overlay on showSessionDrawer'
);
assert.ok(
  /pushOverlay\('drawer-raven',\s*\(\)\s*=>\s*this\.\$emit\('close-raven-drawer'\)\)/.test(drawerCoordSrc),
  'FAIL: DrawerCoordinator.vue must push drawer-raven overlay on showTaskRavenDrawer'
);
assert.ok(
  /removeOverlay\('drawer-block'\)/.test(drawerCoordSrc) &&
  /removeOverlay\('drawer-session'\)/.test(drawerCoordSrc) &&
  /removeOverlay\('drawer-raven'\)/.test(drawerCoordSrc),
  'FAIL: DrawerCoordinator.vue must remove drawer overlays on close / unmount'
);
console.log('✓ Invariant 2: DrawerCoordinator.vue is wired to overlayHistory.');

// TaskDetailDrawer
assert.ok(
  taskDrawerSrc.includes("import { pushOverlay, removeOverlay } from '../utils/overlayHistory.js'"),
  'FAIL: TaskDetailDrawer.vue must import pushOverlay and removeOverlay from overlayHistory.js'
);
assert.ok(
  /pushOverlay\('drawer-task-detail',\s*closeTaskDetail\)/.test(taskDrawerSrc),
  'FAIL: TaskDetailDrawer.vue must push drawer-task-detail overlay with closeTaskDetail'
);
assert.ok(
  /removeOverlay\('drawer-task-detail'\)/.test(taskDrawerSrc),
  'FAIL: TaskDetailDrawer.vue must remove drawer-task-detail overlay on close / unmount'
);
console.log('✓ Invariant 3: TaskDetailDrawer.vue is wired to overlayHistory.');

// --------------------------------------------------------------------------
// Part 2: Runtime JSDOM Stack & Back Navigation Lifecycle
// --------------------------------------------------------------------------
async function runRuntimeTests() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost:8000/#/dashboard'
  });
  global.window = dom.window;
  global.document = dom.window.document;

  const { pushOverlay, removeOverlay, getOverlayStack, resetOverlayHistory } = await import('../src/utils/overlayHistory.js');

  resetOverlayHistory();
  assert.strictEqual(getOverlayStack().length, 0, 'Stack should be initially empty');

  // Test A: Single overlay back gesture closes overlay
  let drawerClosed = false;
  pushOverlay('drawer-block', () => { drawerClosed = true; });

  assert.strictEqual(getOverlayStack().length, 1);
  assert.strictEqual(getOverlayStack()[0].id, 'drawer-block');

  // Simulate Back button / edge swipe -> window popstate event
  const popEvent = new dom.window.PopStateEvent('popstate', { state: null });
  dom.window.dispatchEvent(popEvent);

  assert.strictEqual(drawerClosed, true, 'FAIL: Back gesture must invoke overlay close callback');
  assert.strictEqual(getOverlayStack().length, 0, 'FAIL: Stack must be empty after popping overlay');
  console.log('✓ Invariant 4: Single overlay closes on back gesture.');

  // Test B: Nested overlays close in LIFO order
  resetOverlayHistory();
  let blockClosed = false;
  let dialogClosed = false;

  pushOverlay('drawer-block', () => { blockClosed = true; });
  pushOverlay('dialog-reschedule', () => { dialogClosed = true; });

  assert.strictEqual(getOverlayStack().length, 2);
  assert.strictEqual(getOverlayStack()[1].id, 'dialog-reschedule');

  // 1st Back gesture -> closes top modal only
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate', { state: null }));
  assert.strictEqual(dialogClosed, true, 'FAIL: 1st back gesture must close top dialog');
  assert.strictEqual(blockClosed, false, 'FAIL: Drawer behind dialog must remain open');
  assert.strictEqual(getOverlayStack().length, 1);

  // 2nd Back gesture -> closes drawer
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate', { state: null }));
  assert.strictEqual(blockClosed, true, 'FAIL: 2nd back gesture must close underlying drawer');
  assert.strictEqual(getOverlayStack().length, 0);
  console.log('✓ Invariant 5: Nested overlays close in strict LIFO order on consecutive Back gestures.');

  // Test C: Programmatic close removes overlay and cleans up history
  resetOverlayHistory();
  let modalClosedByUI = false;
  pushOverlay('dialog-test', () => { modalClosedByUI = true; });

  assert.strictEqual(getOverlayStack().length, 1);
  let backCalled = false;
  const originalBack = dom.window.history.back;
  dom.window.history.back = () => {
    backCalled = true;
    // Dispatch synthetic popstate as real browser does
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate', { state: null }));
  };

  removeOverlay('dialog-test');
  assert.strictEqual(getOverlayStack().length, 0, 'FAIL: removeOverlay must remove overlay from stack');
  assert.strictEqual(backCalled, true, 'FAIL: removeOverlay must call window.history.back() to revert pushed state');
  assert.strictEqual(modalClosedByUI, false, 'FAIL: synthetic popstate from programmatic close must be ignored');

  dom.window.history.back = originalBack;
  console.log('✓ Invariant 6: Programmatic close suppresses synthetic popstate and keeps stack in sync.');

  // Test D: Popstate with empty overlay stack passes through
  let passThrough = true;
  try {
    dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate', { state: null }));
  } catch (e) {
    passThrough = false;
  }
  assert.ok(passThrough, 'FAIL: Popstate on empty overlay stack must not throw');
  console.log('✓ Invariant 7: Popstate on empty stack passes through cleanly.');

  console.log('\nSUCCESS: All Mobile Overlay Back Navigation Invariants passed cleanly!\n');
}

runRuntimeTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
