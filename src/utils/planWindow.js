// A plan is for time still to come. Why a block cannot be planned or moved to this day and
// slot, or "" when it can: the same rule as the server (permissions.check_plan_date).
//   - never an earlier day: time already worked is logged, not planned;
//   - never a day payroll has closed;
//   - today, never a slot that has already ended (an end before its start is the next morning).
import { toMin, localISO } from "./clockTime.js";
import { dayWords } from "./timesheetEntry.js";

export const PLAN_PAST = "You can plan from today on. Time already worked is logged, not planned.";
export const PLAN_OVER = "That time is over. Plan from now on, or log it as time worked.";

export function planRefusal(dayISO, start, end, { payrollClosedThrough } = {}, now = new Date()) {
  const day = String(dayISO || "").slice(0, 10);
  if (!day) return "";
  const today = localISO(now);
  if (day < today) return PLAN_PAST;
  const closed = payrollClosedThrough ? String(payrollClosedThrough).slice(0, 10) : "";
  if (closed && day <= closed) {
    const next = new Date(closed + "T00:00:00");
    next.setDate(next.getDate() + 1);
    return `Payroll is closed through ${dayWords(closed, now)}. Plan from ${dayWords(localISO(next), now)} on.`;
  }
  if (day === today && start && end) {
    const s = toMin(start);
    let e = toMin(end);
    if (e <= s) e += 24 * 60;
    if (e <= now.getHours() * 60 + now.getMinutes()) return PLAN_OVER;
  }
  return "";
}
