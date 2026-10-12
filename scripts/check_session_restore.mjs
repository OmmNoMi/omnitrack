#!/usr/bin/env node
// A running session is the person's work. Opening a page never ends it: a long or overnight
// session is restored and the "still working?" dialog asks whether to keep it running or
// adjust its times (in the session's own box, where it can be stopped). Only Stop clears the
// stored copy.
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
need(/const INACTIVITY_MS = 30 \* 60 \* 1000;/.test(clock) && /idleSinceMs\.value = act;\s*showInactivityModal\.value = true;/.test(clock), "useWorkstationSessionClock.js: an old last note opens the still-working dialog, holding the moment it is about");
const activity = (clock.match(/const recordUserActivity = \(\) => \{[\s\S]*?\n  \};/) || [""])[0];
need(activity && !/showInactivityModal/.test(activity), "useWorkstationSessionClock.js: recordUserActivity never answers the dialog; a click or key on the page is not Keep working");
need(/const adjustInactivitySession = \(\) => \{\s*const endMs = inactivityStopAt\.value;[\s\S]*?w\.openAdjustModal\(\{ endMs \}\);/.test(clock), "useWorkstationSessionClock.js: Adjust times opens the session's own box, its end at the held suggested stop");
const modals = read("src/composables/useWorkstationSessionModals.js");
need(/const cap = opt && opt\.endMs \? new Date\(Math\.min\(now\.getTime\(\), Math\.max\(start\.getTime\(\), opt\.endMs\)\)\)/.test(modals), "useWorkstationSessionModals.js: openAdjustModal starts the end where it was asked to, between the start and now");

// The dialog's times name the day when it is not today
const times = read("src/utils/clockTime.js");
need(/if \(daysAgo === 1\) return at \+ " yesterday";/.test(times), "clockTime.js: momentLabel says a time from yesterday was yesterday");

// Two answers, and neither ends the session: the person may still be working, so stopping
// happens in the session's own box after Adjust times, never from one press here
const modal = read("src/components/dialogs/InactivityGovernorModal.vue");
for (const [ev, what] of [["confirm-working", "keep it running"], ["adjust", "adjust the times"]]) {
  need(modal.includes(`$emit('${ev}')`), `InactivityGovernorModal.vue: offers to ${what}`);
}
need(!/\$emit\('(stop|discard)/.test(modal), "InactivityGovernorModal.vue: never stops or discards the running session from one press");
need(/label="Keep working"\s+data-autofocus/.test(modal), "InactivityGovernorModal.vue: Keep working is the answer focus starts on");

if (problems.length) {
  console.error("FAIL: a running session is kept until its person decides\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: a long or overnight session is restored and asked about, never ended by a page load.");
