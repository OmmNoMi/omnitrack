// Which logged time counts as doing a planned block: only time after the block starts that has
// already happened. A session logged ahead of the block stays on record, but cannot make the block
// Logged, Done or On plan. omnitrack/utils/session_time.py is the same rule on the server and must
// stay in step.
//
// `now` is { date: 'YYYY-MM-DD', minute: minutes since local midnight }, built from the nowMinute
// ref so anything computed from it moves with the clock.

const dayMin = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y && m && d ? Date.UTC(y, m - 1, d) / 60000 : null;
};
const clockMin = (t) => {
  if (!t) return null;
  const [h, m, s] = String(t).split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) + (s || 0) / 60 : null;
};
const at = (iso, t) => {
  const d = dayMin(iso);
  const c = clockMin(t);
  return d === null || c === null ? null : d + c;
};

export function countedHours(b, now) {
  if (!b) return 0;
  const sessions = b.sessions;
  // A block loaded without its sessions (an older payload, the live tracker's copy) keeps its
  // stored figure; there is nothing to place in time.
  if (!Array.isArray(sessions) || !sessions.length) return parseFloat(b.actual_hours) || 0;
  const begin = at(b.work_date, b.start_time);
  const nowAt = at(now && now.date, '00:00') + ((now && now.minute) || 0);
  let total = 0;
  for (const s of sessions) {
    const hours = parseFloat(s.hours) || 0;
    let start = at(s.session_date, s.from_time);
    let end = at(s.session_date, s.to_time);
    if (start === null || end === null) {
      // No times to place it: it counts once its day has come.
      if (!s.session_date || s.session_date <= now.date) total += hours;
      continue;
    }
    if (end <= start) end += 1440;
    const full = end - start;
    if (begin !== null && start < begin) start = begin;
    if (end > nowAt) end = nowAt;
    // The session's own hours win over its clock span (a break can be taken out),
    // so count the share of them that falls inside the window.
    if (end > start) total += hours * (end - start) / full;
  }
  return Math.round(total * 100) / 100;
}
