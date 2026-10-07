#!/usr/bin/env node
// A running session is the person's work. Opening a page never ends it: a long or overnight
// session is restored and the "still working?" dialog asks whether to stop at the last note,
// keep it running, or discard it. Only that choice (or Stop) clears the stored copy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (ok, what) => { if (!ok) problems.push(what); };

const sync = read("src/composables/useWorkstationSessionSync.js");
const start = sync.indexOf("const restoreActiveSession = (sessionData) => {");
const restore = sync.slice(start, sync.indexOf("\n  };\n", start));
need(start > 0, "useWorkstationSessionSync.js: restoreActiveSession exists");
need(!/sync_active_session/.test(restore), "restoreActiveSession: never clears the server's session; loading a page is not the person's choice");
need(!/elapsed\s*>=?\s*[\d(]/.test(restore), "restoreActiveSession: no age limit drops a session; a long one is restored and asked about");
need(!/sessionStartDate !== todayStr/.test(restore), "restoreActiveSession: a session from yesterday is restored and asked about, not evicted");

const api = read("omnitrack/api/stopwatch.py");
const g = api.slice(api.indexOf("def get_active_session("), api.indexOf("def check_runaway_timer_guard"));
need(g.length > 0, "stopwatch.py: get_active_session exists");
need(!/DELETE FROM|hdel\(|clear_default\(|set_default\(/.test(g), "stopwatch.py get_active_session: reading the session never deletes it");

const clock = read("src/composables/useWorkstationSessionClock.js");
need(/if \(daysAgo === 1\) return hhmm \+ ' yesterday';/.test(clock), "useWorkstationSessionClock.js: a time from yesterday says so");
need((clock.match(/return clockLabel\((act|targetMs)\);/g) || []).length === 2, "useWorkstationSessionClock.js: the dialog's last-note time and its Stop at time both name the day");
need(/const INACTIVITY_MS = 30 \* 60 \* 1000;/.test(clock) && /showInactivityModal\.value = true;/.test(clock), "useWorkstationSessionClock.js: an old last note opens the still-working dialog");

const modal = read("src/components/dialogs/InactivityGovernorModal.vue");
for (const [ev, what] of [["stop-at-last-edit", "stop at the last note"], ["confirm-working", "keep it running"], ["discard", "discard it"]]) {
  need(modal.includes(`$emit('${ev}')`), `InactivityGovernorModal.vue: offers to ${what}`);
}

if (problems.length) {
  console.error("FAIL: a running session is kept until its person decides\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: a long or overnight session is restored and asked about, never ended by a page load.");
