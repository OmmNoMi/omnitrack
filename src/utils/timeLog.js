// TimeLog: what the page reads off get_team_hours, worked out without the page itself,
// so the rules (a day's plan, what a reviewer looks at twice, which days to read) live in one place.
import { toMin } from './clockTime.js';

export const pad = (n) => String(n).padStart(2, '0');
// Local calendar date; toISOString() is UTC and gives yesterday before 05:30 in IST
export const ymd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
export const fmt = (v) => Number(v || 0).toFixed(2);
const asDate = (d) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
export const longDay = (d) => asDate(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
export const shortDate = (d) => (d ? asDate(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');

export const lastMonth = (now = new Date()) => ({
  from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
});

// The days a period chip covers, `offset` periods back (negative) or ahead
export function periodFor(horizon, offset, range, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (horizon === 'day') { const day = new Date(y, m, d + offset); return { from: ymd(day), to: ymd(day) }; }
  if (horizon === 'week') {
    const mon = new Date(y, m, d - ((now.getDay() + 6) % 7) + 7 * offset);
    return { from: ymd(mon), to: ymd(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)) };
  }
  if (horizon === 'month') return { from: ymd(new Date(y, m + offset, 1)), to: ymd(new Date(y, m + offset + 1, 0)) };
  return { from: range.from, to: range.to };
}

// Said in place, and nothing is asked of the server, until a range can be read
export function rangeRefusal(from, to, maxDays) {
  if (!from || !to) return 'Pick both a start and an end date.';
  if (from > to) return 'The start date is after the end date.';
  const days = Math.round((asDate(to) - asDate(from)) / 86400000) + 1;
  if (days > maxDays) return `Pick at most ${maxDays} days (this range is ${days}).`;
  return '';
}

// What a reviewer should look at twice: two sessions at once, a very long one, one with nothing written
export function markRows(rows) {
  let end = -1;
  for (const r of rows) {
    r.checks = [];
    if (!r.s) continue;
    const from = toMin(r.s.from_time), to0 = toMin(r.s.to_time);
    const to = to0 > from ? to0 : 1440;
    if (end > from) r.checks.push('Overlaps the entry before');
    if (Number(r.s.hours || 0) > 10) r.checks.push('Over 10 hours');
    if (!String(r.s.notes || '').trim() && !r.e.deliverable_notes) r.checks.push('No description');
    end = Math.max(end, to);
  }
  return rows;
}

// One person's days, newest first, a date said once. Each session is one row on the day it was
// worked, in the order the day went; a working day with nothing logged is a day of its own.
export function personDays(p, { closedThrough = '', span, noteOf }) {
  const byDate = new Map();
  const add = (date, row) => {
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  };
  for (const e of p.entries) {
    if (e.sessions.length) e.sessions.forEach((s) => add(s.date, { key: s.name, e, s, hours: s.hours, span: span(s), from: s.from_time, note: noteOf(s, e) }));
    // Logged before sessions existed: hours only, nothing to open a session sheet on
    else add(e.work_date, { key: e.name, e, s: null, hours: e.hours, span: '', from: '~' });
  }
  for (const d of p.not_logged || []) if (!byDate.has(d)) byDate.set(d, []);
  const plannedOn = p.planned_by_day || {};
  let i = 0;
  return [...byDate.keys()].sort().reverse().map((date) => {
    const rows = byDate.get(date).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    rows.forEach((r) => { r.i = r.s ? i++ : -1; });
    markRows(rows);
    return {
      date,
      rows,
      missing: !rows.length,
      total: rows.reduce((t, r) => t + Number(r.hours || 0), 0),
      planned: Number(plannedOn[date] || 0),
      closed: !!closedThrough && date <= closedThrough,
    };
  });
}

// Planned ahead is what was booked before the work; unplanned is time logged with no plan
export function planLine(p) {
  const parts = [fmt(p.worked) + 'h worked', fmt(p.planned) + 'h planned ahead'];
  if (p.unplanned) parts.push(fmt(p.unplanned) + 'h unplanned');
  return parts.join(' · ');
}

// A day's worked time against its plan, and by how much it differs
export function dayLine(g) {
  if (g.missing) return g.planned ? fmt(g.planned) + 'h planned' : '';
  if (!g.planned) return fmt(g.total) + 'h · not planned';
  const diff = Math.round((g.total - g.planned) * 100) / 100;
  const off = Math.abs(diff) >= 0.01 ? ' (' + (diff > 0 ? '+' : '−') + fmt(Math.abs(diff)) + 'h)' : '';
  return fmt(g.total) + 'h of ' + fmt(g.planned) + 'h planned' + off;
}

export function totalsLine(t) {
  const waiting = Number(t.awaiting || 0) + Number(t.flagged || 0);
  return ['Team: ' + fmt(t.worked) + 'h worked', fmt(t.planned) + 'h planned ahead', t.unplanned ? fmt(t.unplanned) + 'h unplanned' : '', fmt(t.approved) + 'h approved', fmt(waiting) + 'h waiting']
    .filter(Boolean).join(' · ');
}

// One person's waiting time, said for who is reading (a manager reviews it, its owner waits on it),
// in entries so it does not repeat the hours on the person's line
export function waitingMarks(w, mine) {
  const n = (k) => k + ' ' + (k === 1 ? 'entry' : 'entries');
  const out = [];
  const flagged = w.flagged_entries != null ? w.flagged_entries : (w.flagged ? 1 : 0);
  const awaiting = w.awaiting_entries != null ? w.awaiting_entries : (w.awaiting ? 1 : 0);
  if (flagged) out.push({ tone: 'flagged', label: n(flagged) + (mine ? ' flagged for you to fix' : ' flagged') });
  if (awaiting) out.push({ tone: 'awaiting', label: n(awaiting) + (mine ? ' waiting for approval' : ' to review') });
  // Payroll has run over it: it is paid as it stands, so it needs a word with HR
  if (w.closed) out.push({ tone: 'flagged', label: fmt(w.closed) + 'h on days payroll has closed' });
  return out;
}

// The days some waiting time falls on, at most maxDays (the newest end kept)
export function spanOf(ws, maxDays) {
  const to = ws.map((w) => w.newest).sort().pop();
  const end = asDate(to);
  const earliest = ymd(new Date(end.getFullYear(), end.getMonth(), end.getDate() - (maxDays - 1)));
  const oldest = ws.map((w) => w.oldest).sort()[0];
  return { from: oldest < earliest ? earliest : oldest, to };
}

// An hour to start a day's entry on: up to now on today, otherwise 09:00-10:00
export function logDayTimes(d, now = new Date()) {
  let to = 600;
  if (d === ymd(now)) to = Math.max(15, Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
  const from = Math.max(0, to - 60);
  const hm = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  return { session_date: d, from_time: hm(from), to_time: hm(to) };
}

// What is left to do for a person, said once on their line
export function personMarks(p, days = []) {
  const out = [];
  if (p.flagged) out.push({ tone: 'flagged', label: fmt(p.flagged) + 'h flagged' });
  if (p.awaiting) out.push({ tone: 'awaiting', label: fmt(p.awaiting) + 'h awaiting' });
  if (!out.length && p.approved) out.push({ tone: 'approved', label: 'Approved' });
  const missing = (p.not_logged || []).length;
  if (missing) out.push({ tone: 'missing', label: missing + (missing === 1 ? ' day' : ' days') + ' not logged' });
  const check = days.reduce((t, g) => t + g.rows.filter((r) => r.checks && r.checks.length).length, 0);
  if (check) out.push({ tone: 'check', label: check + ' to check' });
  return out;
}

// What the entry sheet reads off a block; it fetches the rest itself
const REVIEW_STATUS = { approved: 'Approved', flagged: 'Flagged' };
export function sheetBlock(p, e) {
  return {
    name: e.name,
    work_date: e.work_date,
    employee: p.user,
    project: e.project,
    work_item_label: e.work_item_label,
    deliverable_notes: e.deliverable_notes,
    approval_status: REVIEW_STATUS[e.review] || '',
    approval_notes: e.approval_notes,
    actual_hours: e.hours,
  };
}
