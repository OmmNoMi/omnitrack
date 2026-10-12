// A timesheet entry records time already worked. These keep its dialog on the past side of
// "now", and inside the days the server accepts (permissions.check_timesheet_date_permission).
import { toMin, toHHMM, localISO } from "./clockTime.js";

// Quick-day chips, today first and back as far as the server allows: round(hours / 24)
// days, today included. Managers have no limit; a week of chips is enough to reach.
export function entryDayOffsets(horizonHours, isManager) {
  const days = isManager ? 7 : Math.max(1, Math.round((Number(horizonHours) || 48) / 24));
  return Array.from({ length: Math.min(days, 7) }, (_, i) => -i);
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
