// A frappe-ui (reka) Dialog gives focus back to whatever had it when the dialog opened, once
// its close animation has ended: later than nextTick and later than setTimeout(0). So when a
// dialog's answer opens work elsewhere ("Adjust times" opens the session box), focus went to the
// box and then straight back to the page behind (the week strip's Next week button).
//
// handFocus focuses the target now and, if focus is taken away without the person doing
// anything (no pointer or key press), focuses it again. It lets go after `ms`, on the first
// press, or once focus has come back to the target after a move.
export function handFocus(getTarget, ms = 1500) {
  const target = () => {
    const el = getTarget();
    // A hidden copy of the box (the other session pane) cannot take focus
    return el && el.isConnected && el.getClientRects().length ? el : null;
  };
  const go = () => {
    const el = target();
    if (el && document.activeElement !== el) el.focus();
    return !!el;
  };
  if (!go()) return;
  let timer = 0;
  const stop = () => {
    clearTimeout(timer);
    document.removeEventListener('focusin', onFocus, true);
    document.removeEventListener('pointerdown', stop, true);
    document.removeEventListener('keydown', stop, true);
  };
  function onFocus(e) {
    const el = target();
    if (!el) return stop();
    // Focus moved inside the dialog that is still closing is not the hand-back yet
    if (e.target === el || (e.target.closest && e.target.closest('[role="dialog"]'))) return;
    stop();
    go();
  }
  document.addEventListener('focusin', onFocus, true);
  document.addEventListener('pointerdown', stop, true);
  document.addEventListener('keydown', stop, true);
  timer = setTimeout(stop, ms);
}
