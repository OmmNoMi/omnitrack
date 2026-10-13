// A stretch of the day picked by pressing and dragging, on the calendar or on Day at a glance.
// Time that has passed is logged, time still to come is planned: the same rule in both views.

export const RANGE_SNAP_MIN = 15;

export const snapMin = (m) => Math.round(m / RANGE_SNAP_MIN) * RANGE_SNAP_MIN;

// The minute of the day under the pointer, on a lane that draws the whole day across its width.
export function minuteAtX(clientX, rect) {
  const raw = ((clientX - rect.left) / (rect.width || 1)) * 1440;
  return Math.max(0, Math.min(1440, raw));
}

// Either end can be where the drag started; a range is never shorter than one snap.
export function pickedRange(a, b) {
  let start = Math.min(a, b);
  let end = Math.max(a, b);
  if (end - start < RANGE_SNAP_MIN) end = start + RANGE_SNAP_MIN;
  if (end > 1440) { end = 1440; start = Math.min(start, 1440 - RANGE_SNAP_MIN); }
  return { start, end };
}

// What a picked range opens. want: 'plan' (the Planned lane), 'log' (the Logged lane), or 'auto'
// (the calendar: a range that has fully passed is logged, anything else is planned).
// A plan never starts in the past, and a log never ends in the future.
export function rangeIntent(want, range, iso, today, nowMin) {
  const isToday = iso === today;
  const endsByNow = iso < today || (isToday && range.end <= nowMin);
  const startsAfterNow = iso > today || (isToday && range.start >= nowMin);
  const kind = want === 'auto' ? (endsByNow ? 'log' : 'plan') : want;
  if (kind === 'plan') {
    if (endsByNow) return { refuse: 'past' };
    const next = Math.ceil(nowMin / RANGE_SNAP_MIN) * RANGE_SNAP_MIN;
    const start = isToday && range.start < nowMin ? (next < range.end ? next : nowMin) : range.start;
    return { kind, start, end: range.end };
  }
  if (startsAfterNow) return { refuse: 'future' };
  return { kind: 'log', start: range.start, end: isToday ? Math.min(range.end, nowMin) : range.end };
}

// HH:MM for a minute of the day; the end of the day is 23:59, never 00:00 of the same day.
export function rangeHHMM(m) {
  const mm = Math.max(0, Math.min(1439, Math.round(m)));
  return String(Math.floor(mm / 60)).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
}
