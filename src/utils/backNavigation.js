/**
 * Back navigation (issue #15)
 *
 * The phone's Back button and edge swipe go through the browser's history, so the history is
 * made to mirror what the user has on screen, as a stack of layers:
 *
 *   Dashboard (the root)  >  the tab, unless it is Dashboard  >  each open drawer or dialog
 *
 * One history entry per layer. Back closes the top drawer or dialog, then returns from a tab to
 * Dashboard; only Back on Dashboard with nothing open leaves the app. Switching between tabs
 * rewrites the tab layer in place, so Back never walks through every tab visited.
 *
 * This module is the only code that writes the history. Each entry records the layers it stands
 * for (state.omnitrack.layers). After any change, `reconcile` compares the current entry with the
 * layers on screen and pushes, rewrites or steps back to match. When the user goes Back or
 * Forward, the entry they land on says what should be open, and the app is made to match it.
 * A hash change is never mistaken for Back, and closing a drawer never steps back across a tab.
 *
 * Drawers and dialogs register through useOverlayHistory (src/composables), never directly.
 */

const HOME = 'dashboard';

let getTab = null;
let setTab = null;
let overlays = [];
let scheduled = false;
let traversing = false;
let traverseTimer = null;

const isBrowser = () => typeof window !== 'undefined' && !!window.history;

function entryLayers(state) {
  const own = state && state.omnitrack;
  return own && Array.isArray(own.layers) ? own.layers : null;
}

/** The current entry was written here (a hash typed into the address bar is not). */
export function isManagedEntry() {
  return isBrowser() && entryLayers(window.history.state) !== null;
}

function wantedLayers() {
  const tab = getTab();
  const layers = tab && tab !== HOME ? ['tab:' + tab] : [];
  return layers.concat(overlays.map((o) => 'ov:' + o.id));
}

function tabOf(layers) {
  const t = layers.find((l) => l.startsWith('tab:'));
  return t ? t.slice(4) : HOME;
}

function write(method, layers) {
  const { pathname, search } = window.location;
  window.history[method]({ omnitrack: { layers } }, '', `${pathname}${search}#/${tabOf(layers)}`);
}

function reconcile() {
  scheduled = false;
  if (!getTab || traversing) return;
  const want = wantedLayers();
  let cur = entryLayers(window.history.state);
  if (!cur) {
    // The first load, or an entry this module did not write: it becomes the Dashboard root
    write('replaceState', []);
    cur = [];
  }
  let same = 0;
  while (same < cur.length && same < want.length && cur[same] === want[same]) same++;
  let back = cur.length - same;
  // The lowest entry that differs is rewritten in place rather than stepped off and pushed again
  if (back > 0 && want.length > same) back--;
  if (back > 0) {
    // Only entries written here are stepped over: each layer's entry sits right on its parent's
    traversing = true;
    clearTimeout(traverseTimer);
    traverseTimer = setTimeout(() => { traversing = false; schedule(); }, 1500);
    window.history.go(-back);
    return; // carries on when the step lands (onPopstate)
  }
  if (cur.length > same) write('replaceState', want.slice(0, ++same));
  for (let i = same; i < want.length; i++) write('pushState', want.slice(0, i + 1));
}

// Coalesced: a drawer swapped for another in one handler (close one, open the other) is one
// rewrite of the top entry, never a step back racing a push.
function schedule() {
  if (scheduled || !isBrowser()) return;
  scheduled = true;
  setTimeout(reconcile, 0);
}

function onPopstate(event) {
  if (traversing) {
    // A step this module asked for has landed
    traversing = false;
    clearTimeout(traverseTimer);
    reconcile();
    return;
  }
  const landed = entryLayers(event.state);
  // Not ours: a hash typed into the address bar. useWorkstationShell picks the tab from the URL.
  if (!landed) return;
  // The user went Back or Forward: close what the entry they landed on does not have, top first.
  // An overlay is only dropped once it has really closed (its watcher calls removeOverlay); one
  // that refuses to close is pushed back on by the next reconcile.
  const keep = new Set(landed.filter((l) => l.startsWith('ov:')).map((l) => l.slice(3)));
  [...overlays].reverse().forEach((o) => { if (!keep.has(o.id)) o.close(); });
  const tab = tabOf(landed);
  if (getTab() !== tab) setTab(tab);
  schedule();
}

/** Wire the tab layer. Called once, by useWorkstationShell. */
export function initBackNavigation(options) {
  if (!isBrowser()) return;
  getTab = options.getTab;
  setTab = options.setTab;
  window.addEventListener('popstate', onPopstate);
  schedule();
}

/** The tab changed: the history follows. */
export function syncTab() {
  schedule();
}

export function pushOverlay(id, close) {
  overlays = overlays.filter((o) => o.id !== id);
  overlays.push({ id, close });
  schedule();
}

export function removeOverlay(id) {
  const before = overlays.length;
  overlays = overlays.filter((o) => o.id !== id);
  if (overlays.length !== before) schedule();
}

/** Drop the query string (a push notification's ?action=) and keep the entry's layers. */
export function dropUrlQuery() {
  if (!isBrowser()) return;
  const { pathname, hash } = window.location;
  window.history.replaceState(window.history.state, document.title, pathname + hash);
}

export function getOverlayStack() {
  return overlays.map((o) => o.id);
}

export function resetBackNavigation() {
  if (isBrowser()) window.removeEventListener('popstate', onPopstate);
  clearTimeout(traverseTimer);
  getTab = setTab = null;
  overlays = [];
  scheduled = traversing = false;
}
