// The part of a running session that falls on one day, in minutes since that day's midnight.
// A session started at 6:00 pm and still running at 00:01 is 18:00-24:00 on the day it started
// and 00:00-00:01 the next day: the running bar is drawn on both, never on neither.
// Bug this guards: the dashboard and the calendar drew the running session only on "today",
// from its start time, so after midnight it fell off both days.
import { localISO } from "./clockTime.js";

export function liveSpanOn(iso, startedAt, now = new Date()) {
  if (!iso || !startedAt) return null;
  const start = new Date(startedAt);
  if (isNaN(start)) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const dayStart = new Date(y, m - 1, d);
  const dayEnd = new Date(y, m - 1, d + 1);
  if (start >= dayEnd || now <= dayStart || now <= start) return null;
  // Read off the clock, not by subtracting, so a day with a DST change still ends at 24:00
  const fromBefore = start < dayStart;
  const toAfter = now >= dayEnd;
  const s = fromBefore ? 0 : start.getHours() * 60 + start.getMinutes();
  const e = toAfter ? 1440 : now.getHours() * 60 + now.getMinutes();
  return { s, e: Math.max(s + 1, e), fromBefore, toAfter, startDay: localISO(start) };
}
