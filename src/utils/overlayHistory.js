/**
 * Overlay History Controller
 *
 * Manages history states for modals and slide-over drawers so that mobile Back
 * gestures (e.g. edge swipe on Android/Nothing Phone 3a, or browser Back button)
 * close the topmost overlay in LIFO order instead of navigating away or exiting
 * the PWA prematurely.
 */

let overlayStack = [];
let ignorePopstateCount = 0;
let popstateListenerAttached = false;

function onPopstate(event) {
  if (ignorePopstateCount > 0) {
    ignorePopstateCount--;
    return;
  }
  if (overlayStack.length > 0) {
    const top = overlayStack.pop();
    if (top && typeof top.close === 'function') {
      top.close();
    }
  }
}

export function pushOverlay(id, close) {
  if (typeof window === 'undefined' || !window.history) return;
  if (!popstateListenerAttached) {
    window.addEventListener('popstate', onPopstate);
    popstateListenerAttached = true;
  }
  overlayStack = overlayStack.filter((item) => item.id !== id);
  overlayStack.push({ id, close });
  window.history.pushState({ omnitrack_overlay: true, id }, '', window.location.href);
}

export function removeOverlay(id) {
  if (typeof window === 'undefined' || !window.history) return;
  const index = overlayStack.findIndex((item) => item.id === id);
  if (index !== -1) {
    overlayStack.splice(index, 1);
    ignorePopstateCount++;
    window.history.back();
  }
}

export function getOverlayStack() {
  return overlayStack;
}

export function resetOverlayHistory() {
  overlayStack = [];
  ignorePopstateCount = 0;
}
