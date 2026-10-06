import { ref, watch, nextTick } from "vue";

/**
 * Roving-tabindex grid of concluded deliverables (WCAG 2.2 AA) plus the
 * expand/collapse state of long notes.
 */
export function useDashboardConcludedGrid({ selectedDashboardDate, showAllPastBlocks, visiblePastFocusBlocks }) {
  const concludedRovingRow = ref(0);
  const concludedRovingCol = ref(0);

  const canBlockReopen = (b) => b && b.status !== 'Cancelled' && b.status !== 'Rescheduled';
  const hasBlockExpandableNotes = (b) => b && (isLongNote(b.deliverable_notes) || (b.sessions && b.sessions.length > 1));

  const getConcludedNotesCol = (b) => canBlockReopen(b) ? 3 : 2;

  const getMaxConcludedCol = (b) => {
    if (!b) return 1;
    const hasReopen = canBlockReopen(b);
    const hasNotes = hasBlockExpandableNotes(b);
    if (hasReopen && hasNotes) return 3;
    if (hasReopen || hasNotes) return 2;
    return 1;
  };

  const setConcludedRoving = (r, c) => {
    concludedRovingRow.value = r;
    concludedRovingCol.value = c;
  };

  const concludedTabindex = (r, c) => (concludedRovingRow.value === r && concludedRovingCol.value === c) ? 0 : -1;

  const focusConcludedCell = (targetRow, targetCol) => {
    const rows = visiblePastFocusBlocks.value || [];
    if (!rows.length) return;
    const r = Math.max(0, Math.min(targetRow, rows.length - 1));
    const b = rows[r];
    const maxCol = getMaxConcludedCol(b);
    const c = Math.max(0, Math.min(targetCol, maxCol));

    setConcludedRoving(r, c);
    nextTick(() => {
      let el = document.querySelector(`[data-concluded-row="${r}"][data-concluded-col="${c}"]`);
      if (!el) {
        el = document.querySelector(`[data-concluded-row="${r}"][data-concluded-col="0"]`);
        if (el) setConcludedRoving(r, 0);
      }
      if (el) {
        el.focus();
        if (el.scrollIntoView) {
          const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });
        }
      }
    });
  };

  const onConcludedGridKey = (ev, r, c) => {
    if (ev.target && (ev.target.closest('[role="menu"]') || ev.target.closest('[role="dialog"]'))) return;
    const k = ev.key;
    if (k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;

    ev.preventDefault();
    ev.stopPropagation();

    const rows = visiblePastFocusBlocks.value || [];
    if (!rows.length) return;

    if (k === 'ArrowDown') {
      focusConcludedCell(r + 1, c);
    } else if (k === 'ArrowUp') {
      focusConcludedCell(r - 1, c);
    } else if (k === 'ArrowRight') {
      focusConcludedCell(r, c + 1);
    } else if (k === 'ArrowLeft') {
      focusConcludedCell(r, c - 1);
    } else if (k === 'Home') {
      if (ev.ctrlKey || ev.metaKey) focusConcludedCell(0, 0);
      else focusConcludedCell(r, 0);
    } else if (k === 'End') {
      if (ev.ctrlKey || ev.metaKey) {
        const lastRow = rows.length - 1;
        focusConcludedCell(lastRow, getMaxConcludedCol(rows[lastRow]));
      } else {
        focusConcludedCell(r, getMaxConcludedCol(rows[r]));
      }
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

  const expandedBlockNotes = ref(new Set());
  const isBlockNotesExpanded = (name) => expandedBlockNotes.value.has(name);
  const toggleBlockNotes = (name) => {
    const next = new Set(expandedBlockNotes.value);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    expandedBlockNotes.value = next;
  };
  const isLongNote = (notes) => {
    if (!notes) return false;
    return notes.length > 110 || notes.includes('\n');
  };

  watch(selectedDashboardDate, () => {
    showAllPastBlocks.value = false;
    expandedBlockNotes.value = new Set();
    concludedRovingRow.value = 0;
    concludedRovingCol.value = 0;
  });

  return {
    concludedRovingRow,
    concludedRovingCol,
    canBlockReopen,
    hasBlockExpandableNotes,
    getConcludedNotesCol,
    getMaxConcludedCol,
    setConcludedRoving,
    concludedTabindex,
    focusConcludedCell,
    onConcludedGridKey,
    toggleShowAllPastBlocks,
    expandedBlockNotes,
    isBlockNotesExpanded,
    toggleBlockNotes,
    isLongNote
  };
}
