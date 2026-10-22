#!/usr/bin/env node
/**
 * Back navigation invariants (issue #15), src/utils/backNavigation.js
 *
 * 1. Back closes the top drawer or dialog first, one per press (LIFO).
 * 2. Back from any tab returns to Dashboard, however many tabs were visited; Dashboard is the root.
 * 3. A tab change is never taken for Back: an open drawer stays open.
 * 4. Closing a drawer after a tab change keeps the tab (no step back across it).
 * 5. A drawer swapped for another in one handler leaves one entry for it, and Back closes it.
 * 6. After a reload on a drawer's entry, the entry is dropped (no dead Back press).
 * 7. An overlay that refuses to close (non-dismissible) gets its entry back.
 * Static: every component with aria-modal, and FDialog, registers via useOverlayHistory; only
 * backNavigation.js writes the history or listens for popstate.
 *
 * The runtime part uses jsdom's real history (popstate arrives asynchronously, as in a browser);
 * nothing is mocked.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

console.log('--- Back navigation invariants (issue #15) ---');

const appDir = path.resolve(__dirname, '..');
const srcDir = path.join(appDir, 'src');
const rel = (f) => path.relative(appDir, f);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const sources = walk(srcDir).filter((f) => /\.(vue|js)$/.test(f));
const read = (f) => fs.readFileSync(f, 'utf8');
const navModule = path.join(srcDir, 'utils', 'backNavigation.js');

// Static 1: every overlay registers itself
const overlays = sources.filter((f) => f.endsWith('.vue') && /aria-modal/.test(read(f)));
overlays.push(path.join(srcDir, 'components', 'common', 'FDialog.vue'));
const unregistered = overlays.filter((f) => !/useOverlayHistory\(/.test(read(f)));
assert.deepStrictEqual(unregistered.map(rel), [],
  'FAIL: these drawers or dialogs do not call useOverlayHistory, so Back leaves the tab or the app while they are open');
console.log(`✓ ${overlays.length} drawers and dialogs register with Back navigation.`);

// Static 2: one owner of the history
const HISTORY_WRITE = /history\.(pushState|replaceState|back|go|forward)\s*\(|location\.hash\s*=[^=]|addEventListener\(\s*['"]popstate/;
const writers = sources.filter((f) => f !== navModule && HISTORY_WRITE.test(read(f)));
assert.deepStrictEqual(writers.map(rel), [],
  'FAIL: only src/utils/backNavigation.js may write the history or listen for popstate; anything else desyncs Back');
const shell = read(path.join(srcDir, 'composables', 'useWorkstationShell.js'));
assert.ok(/const handleHashSync = \(\) => \{\s*if \(isManagedEntry\(\)\) return;/.test(shell),
  'FAIL: handleHashSync must skip entries backNavigation wrote, or a step it takes switches the tab back');
console.log('✓ Only backNavigation writes the history.');

// Runtime
const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms));

async function fresh(url = 'http://localhost/omnitrack#/dashboard', before) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url });
  global.window = dom.window;
  global.document = dom.window.document;
  if (before) before(dom.window);
  const nav = await import('../src/utils/backNavigation.js');
  nav.resetBackNavigation();
  const app = { tab: (url.split('#/')[1] || 'dashboard') };
  // As useWorkstationShell: the activeTab watcher calls syncTab, a typed hash sets the tab
  nav.initBackNavigation({ getTab: () => app.tab, setTab: (t) => { app.tab = t; nav.syncTab(); } });
  dom.window.addEventListener('hashchange', () => {
    if (!nav.isManagedEntry()) { app.tab = dom.window.location.hash.slice(2); nav.syncTab(); }
  });
  app.go = (t) => { app.tab = t; nav.syncTab(); };
  // As a component: open pushes, close removes (its watcher), Back calls close
  app.closed = [];
  app.open = (id, refuse) => nav.pushOverlay(id, () => { if (!refuse) { app.closed.push(id); nav.removeOverlay(id); } });
  app.back = async () => { dom.window.history.back(); await settle(); };
  app.layers = () => (dom.window.history.state && dom.window.history.state.omnitrack || {}).layers;
  app.hash = () => dom.window.location.hash;
  await settle();
  return { nav, app, win: dom.window };
}

(async () => {
  // 2. Back from a tab returns to Dashboard
  {
    const { app, win } = await fresh();
    assert.deepStrictEqual(app.layers(), [], 'FAIL: the first entry must become the Dashboard root');
    const start = win.history.length;
    app.go('planner'); await settle();
    app.go('timesheets'); await settle();
    app.go('tasks'); await settle();
    assert.strictEqual(win.history.length, start + 1, 'FAIL: Dashboard and a tab take two entries (root, tab), however many tabs were switched');
    assert.strictEqual(app.hash(), '#/tasks', 'FAIL: switching tabs must move the URL to the new tab');
    await app.back();
    assert.strictEqual(app.tab, 'dashboard', 'FAIL: Back from a tab must return to Dashboard');
    assert.deepStrictEqual(app.layers(), [], 'FAIL: Back from a tab must land on the Dashboard root');
    app.go('planner'); await settle();
    app.go('dashboard'); await settle();
    assert.deepStrictEqual(app.layers(), [], 'FAIL: opening Dashboard must step back to the root, not stack an entry');
    assert.strictEqual(app.hash(), '#/dashboard');
    console.log('✓ Back from any tab returns to Dashboard; Dashboard is the root.');
  }
  // 2b. A deep link gets a Dashboard root under it
  {
    const { app } = await fresh('http://localhost/omnitrack#/planner');
    assert.deepStrictEqual(app.layers(), ['tab:planner']);
    await app.back();
    assert.strictEqual(app.tab, 'dashboard', 'FAIL: Back from a tab opened by link must return to Dashboard');
    console.log('✓ A tab opened by link has Dashboard under it.');
  }
  // 1. LIFO
  {
    const { app } = await fresh();
    app.go('planner'); app.open('drawer'); await settle();
    app.open('dialog'); await settle();
    await app.back();
    assert.deepStrictEqual(app.closed, ['dialog'], 'FAIL: the first Back must close only the top dialog');
    await app.back();
    assert.deepStrictEqual(app.closed, ['dialog', 'drawer'], 'FAIL: the second Back must close the drawer');
    assert.strictEqual(app.tab, 'planner', 'FAIL: closing overlays must not leave the tab');
    await app.back();
    assert.strictEqual(app.tab, 'dashboard');
    console.log('✓ Back closes the top overlay first, then leaves the tab.');
  }
  // 3 and 4. A tab change with a drawer open
  {
    const { nav, app } = await fresh();
    app.go('planner'); app.open('drawer'); await settle();
    app.go('tasks'); await settle();
    assert.deepStrictEqual(app.closed, [], 'FAIL: a tab change must not close the open drawer');
    assert.strictEqual(app.hash(), '#/tasks', 'FAIL: a tab change with a drawer open must move the URL to the new tab');
    nav.removeOverlay('drawer'); await settle(); // its X
    assert.strictEqual(app.tab, 'tasks', 'FAIL: closing a drawer after a tab change must keep the tab');
    assert.strictEqual(app.hash(), '#/tasks', 'FAIL: closing a drawer after a tab change must keep the URL');
    await app.back();
    assert.strictEqual(app.tab, 'dashboard', 'FAIL: Back after that must return to Dashboard');
    console.log('✓ A tab change keeps the drawer open, and closing it keeps the tab.');
  }
  // 3b. A hash typed into the address bar is a tab change, not Back
  {
    const { app, win } = await fresh();
    app.open('drawer'); await settle();
    win.location.hash = '#/timesheets'; await settle();
    assert.deepStrictEqual(app.closed, [], 'FAIL: a typed hash must not close the open drawer');
    assert.strictEqual(app.tab, 'timesheets');
    console.log('✓ A typed hash changes the tab and keeps the drawer.');
  }
  // 5. Swap in one handler
  {
    const { nav, app, win } = await fresh();
    app.open('session'); await settle();
    const len = win.history.length;
    nav.removeOverlay('session'); app.open('block'); await settle();
    assert.strictEqual(win.history.length, len, 'FAIL: a drawer swap must rewrite the entry in place');
    assert.deepStrictEqual(app.layers(), ['ov:block']);
    await app.back();
    assert.deepStrictEqual(app.closed, ['block'], 'FAIL: Back after a swap must close the new drawer');
    assert.deepStrictEqual(app.layers(), [], 'FAIL: Back after a swap must land on the root');
    console.log('✓ A drawer swap leaves one entry, and Back closes it.');
  }
  // 6. Reload on a drawer's entry
  {
    const { app } = await fresh('http://localhost/omnitrack#/planner', (w) => {
      w.history.replaceState({ omnitrack: { layers: [] } }, '', '/omnitrack#/dashboard');
      w.history.pushState({ omnitrack: { layers: ['tab:planner'] } }, '', '/omnitrack#/planner');
      w.history.pushState({ omnitrack: { layers: ['tab:planner', 'ov:drawer-1'] } }, '', '/omnitrack#/planner');
    });
    assert.deepStrictEqual(app.layers(), ['tab:planner'], 'FAIL: after a reload the closed drawer\'s entry must be dropped');
    await app.back();
    assert.strictEqual(app.tab, 'dashboard', 'FAIL: after a reload one Back must return to Dashboard');
    console.log('✓ After a reload, one Back press is enough.');
  }
  // 7. A close that is refused
  {
    const { nav, app } = await fresh();
    app.open('locked', true); await settle();
    await app.back(); await settle();
    assert.deepStrictEqual(nav.getOverlayStack(), ['locked'], 'FAIL: a dialog that stays open must get its entry back (it left the stack)');
    assert.deepStrictEqual(app.layers(), ['ov:locked'], 'FAIL: a dialog that stays open must get its entry back');
    console.log('✓ A dialog that refuses to close keeps its entry.');
  }
  console.log('\nSUCCESS: Back navigation invariants hold.\n');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
