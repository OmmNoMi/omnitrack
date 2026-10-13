// The part of a logged session that falls on one day, in minutes since that day's midnight.
// A session past midnight is stored as two rows, one on each day (MidnightSplitter): 20:21-23:59:59
// on the 12th and 00:00-00:11 on the 13th. A row belongs to its own session_date, never to every
// day its block is shown on. An older single row that runs past midnight (00:11 before 20:21) is
// split here the same way.
// Bug this guards: Day at a glance drew both rows of a night block on both days, so the 13th showed
// the 12th's 8:21 pm-midnight again at 8:21 pm, and counted its hours twice.

const minsOf = (t) => {
  if (!t) return null;
  const [h, m, s] = String(t).split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  // 23:59:59 is how a split row says "to midnight"
  return h === 23 && m === 59 && s === 59 ? 1440 : h * 60 + (m || 0);
};

const nextDay = (iso) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

export function sessionSpanOn(session, block, iso) {
  if (!session || !iso) return null;
  const day = session.session_date || (block && block.work_date) || "";
  const s = minsOf(session.from_time), e = minsOf(session.to_time);
  if (!day || s === null || e === null) return null;
  const overnight = e < s;
  if (day === iso) {
    if (overnight) return s < 1440 ? { s, e: 1440 } : null;
    return e > s ? { s, e } : null;
  }
  if (overnight && nextDay(day) === iso && e > 0) return { s: 0, e };
  return null;
}

// A block's logged hours that fall on one day. Its counted figure (actual_hours) is shared out
// by how much of its sessions' time lands on that day, so a night block is not counted twice.
export function blockHoursOn(block, iso) {
  if (!block) return 0;
  const actual = parseFloat(block.actual_hours) || 0;
  const sessions = Array.isArray(block.sessions) ? block.sessions : [];
  if (!sessions.length) return block.work_date === iso ? actual : 0;
  const len = (span) => (span ? span.e - span.s : 0);
  let onDay = 0, total = 0;
  for (const x of sessions) {
    const day = x.session_date || block.work_date;
    total += len(sessionSpanOn(x, block, day)) + len(sessionSpanOn(x, block, nextDay(day)));
    onDay += len(sessionSpanOn(x, block, iso));
  }
  if (!total) return block.work_date === iso ? actual : 0;
  return Math.round(actual * onDay / total * 100) / 100;
}
