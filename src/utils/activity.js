// What kind of time a work block or session is: its activity (Planned Work Block.task_nature).
//
// Whether the time was planned is not an activity. A block that was planned is planned; time
// logged with no block for it lands on a new block the server marks `unplanned`. Older values
// mixed the two ("🎯 Planned", "⚠️ Unplanned", "Planned Work", "Unplanned Ops"), so every stored
// or remembered value goes through toKind. Mirrors omnitrack/utils/activity.py;
// scripts/check_activity_kinds.cjs keeps the two and the DocType options in step.

export const WORK = 'Work';
export const BREAK = 'Break';
export const AWAY = ['Away'];

// Value and label are the same plain word, so a picker never has to map one to the other
export const ACTIVITY_OPTIONS = [
  { id: 'work', value: 'Work', label: 'Work', is_working: true },
  { id: 'break', value: 'Break', label: 'Break', is_working: false },
  { id: 'away', value: 'Away', label: 'Away', is_working: false },
];
export const KINDS = ACTIVITY_OPTIONS.map((o) => o.value);

// First match wins. Anything else is Work: meetings and reviews are work, and so are the old
// Planned / Unplanned values. Leave, absence and out-of-office are all Away.
const MARKERS = [
  ['Break', ['break']],
  ['Away', ['away', 'leave', 'absent', 'out-of-office', 'out of office', 'ooo']],
];

export function toKind(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  const hit = MARKERS.find(([, marks]) => marks.some((m) => text.includes(m)));
  return hit ? hit[0] : WORK;
}

export const activityOption = (value) => ACTIVITY_OPTIONS.find((o) => o.value === toKind(value));
export const isNonWorking = (value) => !activityOption(value).is_working;
