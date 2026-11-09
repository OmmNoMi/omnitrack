import { localISO } from './clockTime.js';

// One-click due days counted on the browser's own calendar from `now` (a local date, never UTC)
const plus = (now, n) => localISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
export const deadlinePresets = (now = new Date()) => {
  const day = now.getDay();
  const toFri = (5 - day + 7) % 7 || 7;
  const fri = day >= 1 && day <= 4 ? 'This Fri' : 'Next Fri';
  return [
    { id: 'today', label: 'Today', iso: plus(now, 0), tooltip: 'Due today' },
    { id: 'tomorrow', label: 'Tomorrow', iso: plus(now, 1), tooltip: 'Due tomorrow' },
    { id: 'in2days', label: 'In 2 days', iso: plus(now, 2), tooltip: 'Due in 2 days' },
    { id: 'friday', label: fri, iso: plus(now, toFri), tooltip: 'Due ' + fri },
    { id: 'nextweek', label: 'Next week', iso: plus(now, 7), tooltip: 'Due in 7 days' },
  ];
};
