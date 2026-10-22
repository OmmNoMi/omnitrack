import { watch, onBeforeUnmount } from 'vue';
import { pushOverlay, removeOverlay } from '../utils/backNavigation.js';

let seq = 0;

/**
 * Registers a drawer or dialog with Back navigation (src/utils/backNavigation.js): while
 * `isOpen()` is true, Back calls `close()` instead of leaving the tab or the app. Every
 * component with aria-modal (and FDialog) calls this in setup;
 * scripts/test_overlay_back_navigation.cjs checks that none is missed.
 */
export function useOverlayHistory(name, isOpen, close) {
  const id = `${name}-${++seq}`;
  watch(isOpen, (open) => (open ? pushOverlay(id, close) : removeOverlay(id)), { immediate: true });
  onBeforeUnmount(() => removeOverlay(id));
}
