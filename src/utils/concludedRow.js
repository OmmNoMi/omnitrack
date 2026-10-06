// One row of "Done today" / "What happened": a list item that says only what is off.
// A block logged to plan gets no chip; its hours say it. Anything else gets one chip.
// Hours are counted hours (countedHours.js): time logged before the block or still ahead is not done.
import { countedHours } from './countedHours.js';
import { blockTitle } from './blockTitle.js';

const hrs = (n) => (Math.round(n * 10) / 10).toFixed(1) + 'h';

export function concludedRowStatus(b, now) {
  if (!b) return null;
  if (b.status === 'Cancelled') return { label: 'Cancelled', theme: 'red' };
  if (b.status === 'Rescheduled') return { label: 'Rescheduled', theme: 'gray' };
  const act = countedHours(b, now);
  const dur = parseFloat(b.duration_hours) || 0;
  if (act <= 0) return { label: 'Not logged', theme: 'orange' };
  const diff = act - dur;
  if (diff < -0.05) return { label: hrs(-diff) + ' short', theme: 'orange' };
  if (diff > 0.05) return { label: hrs(diff) + ' over', theme: 'blue' };
  return null;
}

// Hours logged, shown at the row's end. Nothing when nothing was logged: the chip says so.
export function concludedRowHours(b, now) {
  const act = countedHours(b, now);
  return act > 0 ? hrs(act) : '';
}

// The one line of notes worth showing: never the title again.
export function concludedRowNote(b) {
  if (!b) return '';
  const title = blockTitle(b, '');
  if (b.status === 'Cancelled') return (b.cancel_reason || '').trim();
  const sessionNotes = (b.sessions || []).map((s) => (s.notes || '').trim()).filter((n) => n && n !== title);
  const plan = (b.deliverable_notes || '').trim();
  const first = plan && plan !== title ? plan : (sessionNotes[sessionNotes.length - 1] || '');
  return first.split('\n')[0];
}

// "2 done · 1 not logged". Hours are left to the timeline legend and the Today card.
export function concludedTally(blocks, now) {
  const n = { done: 0, notLogged: 0, rescheduled: 0, cancelled: 0 };
  (blocks || []).forEach((b) => {
    if (b.status === 'Cancelled') n.cancelled++;
    else if (b.status === 'Rescheduled') n.rescheduled++;
    else if (countedHours(b, now) > 0) n.done++;
    else n.notLogged++;
  });
  return [
    n.done && n.done + ' done',
    n.notLogged && n.notLogged + ' not logged',
    n.rescheduled && n.rescheduled + ' rescheduled',
    n.cancelled && n.cancelled + ' cancelled',
  ].filter(Boolean).join(' · ');
}
