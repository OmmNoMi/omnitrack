import { localISO } from './clockTime.js';

// One-click due days counted on the browser's own calendar from `now` (a local date, never UTC).
// Three look-ahead days only: with "Pick a date…" and Clear the menu stays at five entries, and
// the calendar behind "Pick a date…" has its own Today and Tomorrow.
const plus = (now, n) => localISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
export const deadlinePresets = (now = new Date()) => {
  const day = now.getDay();
  const toFri = (5 - day + 7) % 7 || 7;
  const fri = day >= 1 && day <= 4 ? 'This Fri' : 'Next Fri';
  return [
    { id: 'tomorrow', label: 'Tomorrow', iso: plus(now, 1), tooltip: 'Due tomorrow' },
    { id: 'friday', label: fri, iso: plus(now, toFri), tooltip: 'Due ' + fri },
    { id: 'nextweek', label: 'Next week', iso: plus(now, 7), tooltip: 'Due in 7 days' },
  ];
};
