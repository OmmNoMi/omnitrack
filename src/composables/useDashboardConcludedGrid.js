import { ref, watch, nextTick } from "vue";

/**
 * Roving-tabindex grid of the "Done today" list (WCAG 2.2 AA).
 */
export function useDashboardConcludedGrid({ selectedDashboardDate, showAllPastBlocks, visiblePastFocusBlocks }) {
  const concludedRovingRow = ref(0);
  const concludedRovingCol = ref(0);

  const canBlockReopen = (b) => b && b.status !== 'Cancelled' && b.status !== 'Rescheduled';

  // Columns: 0 title, 1 re-open. Re-open exists only on some rows,
  // so arrow keys move between the cells that are actually rendered in the row.

  const setConcludedRoving = (r, c) => {
    concludedRovingRow.value = r;
    concludedRovingCol.value = c;
  };

  const concludedTabindex = (r, c) => (concludedRovingRow.value === r && concludedRovingCol.value === c) ? 0 : -1;

  const rowCells = (r) => [...document.querySelectorAll(`[data-concluded-row="${r}"]`)]
    .sort((x, y) => Number(x.dataset.concludedCol) - Number(y.dataset.concludedCol));

  const focusEl = (r, el) => {
    if (!el) return;
    setConcludedRoving(r, Number(el.dataset.concludedCol));
    el.focus();
    if (el.scrollIntoView) {
      const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });
    }
  };

  // The rendered cell nearest to column c at or before it, else the first one.
  const cellNear = (r, c) => {
    const cells = rowCells(r);
    const before = cells.filter((el) => Number(el.dataset.concludedCol) <= c);
    return before.length ? before[before.length - 1] : cells[0];
  };

  const focusConcludedCell = (targetRow, targetCol) => {
    const rows = visiblePastFocusBlocks.value || [];
    if (!rows.length) return;
    const r = Math.max(0, Math.min(targetRow, rows.length - 1));
    setConcludedRoving(r, Math.max(0, targetCol));
    nextTick(() => focusEl(r, cellNear(r, targetCol)));
  };

  const onConcludedGridKey = (ev, r, c) => {
    if (ev.target && (ev.target.closest('[role="menu"]') || ev.target.closest('[role="dialog"]'))) return;
    const k = ev.key;
    if (k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;

    ev.preventDefault();
    ev.stopPropagation();

    const rows = visiblePastFocusBlocks.value || [];
    if (!rows.length) return;
    const cells = rowCells(r);
    const i = cells.findIndex((el) => Number(el.dataset.concludedCol) === c);
    const ctrl = ev.ctrlKey || ev.metaKey;

    if (k === 'ArrowRight') focusEl(r, cells[Math.min(cells.length - 1, i + 1)]);
    else if (k === 'ArrowLeft') focusEl(r, cells[Math.max(0, i - 1)]);
    else if (k === 'ArrowDown' && r < rows.length - 1) focusEl(r + 1, cellNear(r + 1, c));
    else if (k === 'ArrowUp' && r > 0) focusEl(r - 1, cellNear(r - 1, c));
    else if (k === 'Home') focusEl(ctrl ? 0 : r, rowCells(ctrl ? 0 : r)[0]);
    else if (k === 'End') {
      const last = ctrl ? rows.length - 1 : r;
      const lastCells = rowCells(last);
      focusEl(last, lastCells[lastCells.length - 1]);
    }
  };

  const toggleShowAllPastBlocks = () => {
    showAllPastBlocks.value = !showAllPastBlocks.value;
    nextTick(() => {
      const rows = visiblePastFocusBlocks.value || [];
      if (!rows.length) return;
      const targetIndex = Math.min(1, rows.length - 1);
      focusConcludedCell(Math.max(0, targetIndex), 0);
    });
  };

  watch(selectedDashboardDate, () => {
    showAllPastBlocks.value = false;
    concludedRovingRow.value = 0;
    concludedRovingCol.value = 0;
  });

  return {
    concludedRovingRow,
    concludedRovingCol,
    canBlockReopen,
    setConcludedRoving,
    concludedTabindex,
    focusConcludedCell,
    onConcludedGridKey,
    toggleShowAllPastBlocks
  };
}
