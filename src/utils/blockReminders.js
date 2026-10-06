// Which planned blocks are due a reminder, from the clock alone. The open app checks this
// itself, so a reminder does not depend on the server's minute job or the realtime socket
// reaching the tab. The server sends the same two alerts; a shared key lets only one through.
import { toMin } from './clockTime.js';

export const LEAD_MIN = 10;
// A start reminder still goes out this many minutes late (a sleeping laptop, a throttled tab).
export const START_GRACE_MIN = 5;
const WAITING = new Set(['Draft', 'Planned']);

export function dueReminders(blocks, { date, minute, user, runningBlock } = {}) {
  const due = [];
  for (const b of blocks || []) {
    if (!b || !b.name || b.work_date !== date || !b.start_time) continue;
    if (!WAITING.has(b.status || 'Planned')) continue;
    if (user && b.employee && b.employee !== user) continue;
    if (runningBlock && b.name === runningBlock) continue;
    const until = toMin(b.start_time) - minute;
    if (until <= 0 && until >= -START_GRACE_MIN) due.push({ block: b, kind: 'start_on_time', until });
    else if (until > 0 && until <= LEAD_MIN) due.push({ block: b, kind: 'upcoming_10m', until });
  }
  return due;
}

export const reminderKey = (date, blockName, kind) => `omnitrack:alerted:${date}:${blockName}:${kind}`;
