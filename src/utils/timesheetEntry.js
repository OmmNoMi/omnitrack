// A timesheet entry records time already worked. These keep its dialog on the past side of
// "now", and inside the days the server accepts (permissions.check_timesheet_date_permission).
import { toMin, toHHMM, localISO } from "./clockTime.js";

// Quick-day chips: Today, and Yesterday when the person may log it. Any other day is picked
// in the date picker, so the chips stay one line at 375px however far back logging reaches.
export function entryDayOffsets(daysBack, isManager) {
  return isManager || (Number(daysBack) || 15) >= 2 ? [0, -1] : [0];
}

// "30 Sep", with the year when it is not this one
export function dayWords(dayISO, now = new Date()) {
  const d = new Date(String(dayISO).slice(0, 10) + "T00:00:00");
  const opts = { day: "numeric", month: "short" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-GB", opts);
}

// Why time on this day cannot be logged, changed or deleted, or "" when it can. The same rule
// as the server (permissions.check_timesheet_date_permission): nobody touches a day payroll has
// closed; past that, an employee reaches back daysBack days, today counted as day 1, and a
// manager reaches any day.
export function logDayRefusal(dayISO, { daysBack, payrollClosedThrough, isManager } = {}, now = new Date()) {
  const day = String(dayISO || "").slice(0, 10);
  if (!day) return "";
  const closed = payrollClosedThrough ? String(payrollClosedThrough).slice(0, 10) : "";
  if (closed && day <= closed) {
    return `Payroll is closed through ${dayWords(closed, now)}. Time on or before that day can't be logged or changed.`;
  }
  if (isManager) return "";
  const days = Math.max(1, Number(daysBack) || 15);
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const firstISO = localISO(first);
  if (day < firstISO) {
    return `You can log time for the last ${days} days, from ${dayWords(firstISO, now)}. Ask a manager to log anything earlier.`;
  }
  return "";
}

// Day and times for a new entry against a block: the block's own slot once it has
// passed, its start until now while it runs, otherwise its planned length ending now.
export function newEntryTimes(block, now = new Date()) {
  const today = localISO(now);
  const nowMin = Math.max(15, Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
  const day = block && block.work_date ? String(block.work_date).slice(0, 10) : "";
  const s = block && block.start_time ? toMin(block.start_time) : null;
  const e = block && block.end_time ? toMin(block.end_time) : null;
  const planned = s != null && e > s;
  if (planned && day && day <= today) {
    if (day < today || e <= nowMin) return { date: day, from: toHHMM(s), to: toHHMM(e) };
    if (s < nowMin) return { date: day, from: toHHMM(s), to: toHHMM(nowMin) };
  }
  const length = planned ? e - s : 60;
  return { date: today, from: toHHMM(Math.max(0, nowMin - length)), to: toHHMM(nowMin) };
}

// When an entry ends, as a moment: its day and start, plus its length (past midnight included).
// The length is clock minutes (spanMins), so it is added on the clock, never as elapsed ms: on
// the night the clocks change, 23:00 to 04:00 still ends at 04:00, not an hour off.
// An entry may not end after now; time still ahead is logged by running a session.
export function entryEndMs(date, from, mins) {
  const [y, m, d] = String(date || "").split("-").map(Number);
  if (!y || !m || !d || !from) return null;
  return new Date(y, m - 1, d, 0, toMin(from) + mins).getTime();
}
