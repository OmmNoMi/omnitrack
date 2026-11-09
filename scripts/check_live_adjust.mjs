// The running session is corrected in its own box, and a Stop the log cannot carry is asked
// for in place. Drives the real useWorkstationSessionModals (not a copy of it):
//   1. Adjust on the running session opens its own box (liveAdjust), never the entry panel;
//      from the box it stays put, from elsewhere it brings the box up.
//   2. Stop and log with too few words refuses before anything moves: the start, the clock and
//      the open times stay as they were, no dialog, and the Log asks (stopNeedsWords).
//   3. A line still in the field counts toward the words, live.
//   4. Stop and log then moves the start and ends the session through toggleTrack, with the end.
//   5. An end after now is refused; Keep running moves the start and leaves the title alone.
//   6. A session that ends takes the open box and the prompt with it.
//   7. With nothing running, Adjust is the free-entry panel for the last hour.
//   8. A session past midnight stops the next morning, never on its start day.
//  10. The log's last edit is offered as the end, only between the start and now, and the
//      session boxes end with Now, +5m, +15m and +1h (pressed again to add again), no length chips.
//   9. Adjust times from the still-working question starts on the suggested end, and a closing
//      dialog does not take focus back.
import { useWorkstationSessionModals } from "../src/composables/useWorkstationSessionModals.js";
import { ref, computed, nextTick } from "vue";

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

const events = [];
globalThis.window = {
  OMNITRACK_SESSION: { min_session_words: 5 },
  dispatchEvent: (e) => { events.push(e.type); return true; }
};
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };

const pad = (n) => String(n).padStart(2, "0");
const clockOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const minuteAgo = (n) => { const d = new Date(Date.now() - n * 60000); d.setSeconds(0, 0); return d; };

function setup({ tracking = true, tab = "planner", editedAt = 0 } = {}) {
  const started = minuteAgo(90);
  const s = {
    isTracking: ref(tracking),
    startTime: ref(tracking ? started.getTime() : null),
    trackerSeconds: ref(tracking ? 90 * 60 : 0),
    trackerTimer: ref(null),
    trackerNotes: ref("Fix invoice"),
    trackerBoundBlock: ref(null),
    trackerBlockName: ref(null),
    sessionNotesList: ref([]),
    selectedNature: ref("Work"),
    selectedProject: ref(""),
    todayDate: ref(""),
    isSessionElevated: ref(false),
    activeTab: ref(tab),
    newSessionPoint: ref(""),
    selectedDashboardDate: ref(""),
    selectedEmployee: ref(""),
    activeBlock: ref(null),
    isManager: ref(false),
    discardConfirm: ref(false),
    stopConfirmName: ref(""),
    toasts: [],
    stops: [],
    syncs: 0
  };
  s.sessionHasLines = computed(() => s.sessionNotesList.value.length > 0);
  const m = useWorkstationSessionModals({
    ...s,
    showToast: (msg) => s.toasts.push(msg),
    toggleTrack: async (end) => { s.stops.push(end); s.isTracking.value = false; },
    syncActiveSession: () => { s.syncs += 1; },
    recordUserActivity: () => {},
    checkInactivity: () => {},
    todayISO: () => "",
    getLocalTodayISO: () => "",
    hhmm: (t) => String(t || "").slice(0, 5),
    postJSON: async () => ({}),
    fetchWorkstationData: () => {},
    fetchPlannerData: () => {},
    linesEditedAt: () => editedAt
  });
  return { s, m, started };
}
const stopClock = (s) => { if (s.trackerTimer.value) clearInterval(s.trackerTimer.value); };

// 1. Adjust opens the running session's own box
{
  const { s, m, started } = setup({ tab: "planner" });
  m.openAdjustModal({ inPlace: true });
  check(m.liveAdjust.value && m.liveAdjust.value.from_time === clockOf(started), "Adjust opens the running session's own box at its start");
  check(!m.showEditSessionModal.value, "Adjust on the running session never opens the entry panel");
  check(!s.isSessionElevated.value, "Adjust from the box itself leaves the box where it is");
  const { s: s2, m: m2 } = setup({ tab: "planner" });
  m2.openAdjustModal();
  check(s2.isSessionElevated.value, "Adjust from elsewhere (Cmd+E, the timeline) brings the session box up");
  check(m.liveAdjust.value.focus === "start" && m2.liveAdjust.value.focus === "start", "Adjust on its own starts on the start time");
  const { m: m3 } = setup({ tab: "dashboard" });
  m3.openAdjustModal({ endMs: Date.now() - 60000 });
  check(m3.liveAdjust.value && m3.liveAdjust.value.focus === "end", "Adjust times from the still-working question starts on the suggested end");
}

// 9. Focus lands on that field and stays there while the question's dialog closes. reka gives
// focus back to whatever had it before the dialog opened, after its close animation: the week
// strip's Next week button took it from the end time.
{
  const fs = await import("node:fs");
  const read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
  const pane = read("src/session/SessionControlsPane.vue");
  check(/const wantsEnd = ws\.liveAdjust\.value && ws\.liveAdjust\.value\.focus === 'end';/.test(pane), "SessionControlsPane: the box reads which field to start on");
  check(/handFocus\(\(\) => \{[\s\S]*?return \(wantsEnd \? inputs\[2\] : inputs\[1\]\) \|\| inputs\[0\];/.test(pane), "SessionControlsPane: focus is handed to the end (or the start), and kept there");
  const hand = read("src/utils/focusHandOff.js");
  check(/document\.addEventListener\('focusin', onFocus, true\)/.test(hand), "focusHandOff: focus taken away is put back");
  check(/document\.addEventListener\('pointerdown', stop, true\)/.test(hand) && /document\.addEventListener\('keydown', stop, true\)/.test(hand), "focusHandOff: the person's own click or key is never overridden");
  check(/timer = setTimeout\(stop, ms\)/.test(hand), "focusHandOff: it lets go after a moment");
}

// 2-4. A short log refuses in place; the draft counts; then Stop and log ends it
{
  const { s, m, started } = setup({ tab: "dashboard" });
  m.openAdjustModal({ inPlace: true });
  const newStart = minuteAgo(60);
  m.liveAdjust.value.from_time = clockOf(newStart);
  m.liveAdjust.value.to_time = clockOf(minuteAgo(10));
  await m.stopAndLogSession();
  await nextTick();
  check(s.stops.length === 0, "a short log never stops the session");
  check(s.startTime.value === started.getTime(), "a refused Stop leaves the start where it was");
  check(m.liveAdjust.value && m.liveAdjust.value.from_time === clockOf(newStart), "a refused Stop keeps the open times");
  check(m.stopNeedsWords.value === true, "a refused Stop asks in the Log (stopNeedsWords)");
  check(events.includes("omnitrack:focus-session-input"), "a refused Stop puts focus in the Log's field");
  check(!m.showEditSessionModal.value, "a refused Stop opens no dialog");

  s.newSessionPoint.value = "Reconciled the March invoices";
  check(m.stopWordsNow.value === 6, `the line still in the field counts, live (got ${m.stopWordsNow.value} words)`);
  await m.stopAndLogSession();
  check(s.stops.length === 1, "Stop and log ends the session through toggleTrack");
  check(s.startTime.value === newStart.getTime(), "Stop and log moves the start first");
  const wantEnd = minuteAgo(10).getTime();
  check(Math.abs((s.stops[0] || 0) - wantEnd) < 60000, "Stop and log ends at the end picked");
  await nextTick();
  check(m.liveAdjust.value === null && m.stopNeedsWords.value === false, "an ended session takes its open box and prompt with it");
  stopClock(s);
}

// 5. An end after now is refused; Keep running moves only the start
{
  const { s, m, started } = setup({ tab: "dashboard" });
  s.sessionNotesList.value = ["Reconciled the March invoices with finance"];
  m.openAdjustModal({ inPlace: true });
  const later = new Date(Date.now() + 30 * 60000);
  m.liveAdjust.value.to_time = clockOf(later);
  await m.stopAndLogSession();
  check(s.stops.length === 0 && s.startTime.value === started.getTime(), "an end after now never stops or moves the session");
  // Late at night "half an hour from now" is past midnight; a Stop that read it on the start day
  // ended the session and closed the box. Reported here, so the checks below still run.
  check(m.liveAdjust.value, "an end after now keeps the open times");
  if (!m.liveAdjust.value) { s.isTracking.value = true; m.openAdjustModal({ inPlace: true }); }
  const newStart = minuteAgo(45);
  m.liveAdjust.value.from_time = clockOf(newStart);
  m.keepSessionRunning();
  check(s.isTracking.value && s.stops.length === 0, "Keep running keeps the clock running");
  check(s.startTime.value === newStart.getTime(), "Keep running moves the start");
  check(s.trackerNotes.value === "Fix invoice", "Keep running never rewrites the session's title");
  check(m.liveAdjust.value === null, "Keep running closes the box");
  stopClock(s);
}

// 8. A session that crossed midnight stops the next morning, not on its start day: from 22:00
// two days ago to 00:30 ends at 00:30 yesterday (always past, whatever the hour now)
{
  const { s, m } = setup({ tab: "dashboard" });
  s.sessionNotesList.value = ["Reconciled the March invoices with finance"];
  m.openAdjustModal({ inPlace: true });
  const start = new Date(); start.setDate(start.getDate() - 2); start.setHours(22, 0, 0, 0);
  m.liveAdjust.value.session_date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  m.liveAdjust.value.from_time = "22:00";
  m.liveAdjust.value.to_time = "00:30";
  await m.stopAndLogSession();
  const want = new Date(start); want.setDate(want.getDate() + 1); want.setHours(0, 30, 0, 0);
  check(s.stops.length === 1 && s.stops[0] === want.getTime(), `an overnight Stop (22:00 to 00:30) ends at 00:30 the next morning, got ${s.stops[0] ? new Date(s.stops[0]).toString().slice(0, 21) : "no stop"}`);
  stopClock(s);
}

// 7. Nothing running: Adjust is the free panel for the last hour
{
  const { s, m } = setup({ tracking: false });
  m.openAdjustModal();
  check(m.liveAdjust.value === null && m.showEditSessionModal.value && m.editSessionForm.value.mode === "free", "with nothing running, Adjust is the free entry for the last hour");
  stopClock(s);
}

// 10. The log's last edit is a likely end: offered from the session's own edit time, never at
// the start's own minute (a fresh session's stamp) or after now
{
  const edited = minuteAgo(20);
  const { s, m } = setup({ editedAt: edited.getTime() });
  m.openAdjustModal({ inPlace: true });
  check(m.liveAdjust.value && m.liveAdjust.value.last_edit === clockOf(edited), `Adjust offers the log's last edit (${clockOf(edited)}) as the end, got "${m.liveAdjust.value && m.liveAdjust.value.last_edit}"`);
  stopClock(s);
}
for (const [what, at] of [["at the start", () => minuteAgo(90).getTime()], ["after now", () => Date.now() + 10 * 60000], ["never edited", () => 0]]) {
  const { s, m } = setup({ editedAt: at() });
  m.openAdjustModal({ inPlace: true });
  check(m.liveAdjust.value && m.liveAdjust.value.last_edit === "", `no Last edit end when the log was edited ${what}`);
  stopClock(s);
}
{
  const fs = await import("node:fs");
  const rd = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
  const dtf = rd("src/components/common/DayTimeFields.vue");
  const pane = rd("src/session/SessionControlsPane.vue");
  check(/const END_STEPS = \[5, 15, 60\];/.test(dtf), "DayTimeFields: the end steps are +5m, +15m and +1h");
  check(/<button v-for="m in endSteps"[^\n]*@click="nudgeEnd\(m\)">/.test(dtf), "DayTimeFields: each end step adds to the end");
  check(/nudgeEnd\(deltaMins\) \{\n\s*const base = this\.end\n\s*\? toMin\(this\.end\)/.test(dtf), "DayTimeFields: a step adds to the current end, so pressing again adds again");
  check(/<ChoiceChips v-if="!quickAdjust" :options="durationOptions"/.test(dtf), "DayTimeFields: the session boxes show no length chips");
  check(/<button v-if="lastEdit"[^\n]*@click="\$emit\('update:end', lastEdit\)">Last edit \{\{ lastEdit \}\}<\/button>/.test(dtf), "DayTimeFields: Last edit sets the end");
  check(/aria-label="Adjust the end">\n\s*<span[^\n]*>End<\/span>\n(?:\s*<!--[^\n]*-->\n)?\s*<button v-if="lastEdit"[^\n]*>Last edit \{\{ lastEdit \}\}<\/button>\n\s*<button[^\n]*@click="setEndNow">Now<\/button>/.test(dtf), "DayTimeFields: the End row reads Last edit, then Now (the later time)");
  check(/@pointerdown\.capture="noteTimeTap" @click\.capture="keepTapCaret"/.test(dtf), "DayTimeFields: a tap in a time field is read before TimePicker selects all of it");
  check(/this\._tap = input instanceof HTMLInputElement && document\.activeElement === input\s*\? \{ x: e\.clientX, y: e\.clientY \} : null;/.test(dtf), "DayTimeFields: the tap that focuses a time field still selects it all");
  check(/const at = caretAtPoint\(input, tap\.x, tap\.y\); input\.setSelectionRange\(at, at\);/.test(dtf) && /const dragged = to > from && !\(from === 0 && to === len\);/.test(dtf) && /if \(dragged\) input\.setSelectionRange\(from, to\);/.test(dtf), "DayTimeFields: a tap in a focused time field puts the cursor at the tap point (the selection at click time is still the old one), and a dragged range stays");
  check(/return pos && pos\.offsetNode === input \? pos\.offset : input\.value\.length;/.test(dtf) && !/measureText/.test(dtf), "DayTimeFields: the tap caret comes from the browser (caretPositionFromPoint), with no text measuring of our own");
  check(/:last-edit="liveAdjust\.last_edit \|\| ''"/.test(pane), "SessionControlsPane: the Adjust box passes the log's last edit");
  check(!/:durations=/.test(pane), "SessionControlsPane: the session boxes pass no lengths");
  const sync = rd("src/composables/useWorkstationSessionSync.js");
  check(/linesEditedAt: \(\) => _linesRev,/.test(sync), "useWorkstationSessionSync: linesEditedAt reads the lines' edit stamp");
  const sc = rd("src/composables/useWorkstationShortcuts.js");
  check(/linesEditedAt: \(\) => \(typeof linesEditedAt === 'function' \? linesEditedAt\(\) : 0\),/.test(sc) && /isTracking, linesEditedAt, markSessionEnded,/.test(sc), "useWorkstationShortcuts: hands linesEditedAt to the session modals");
  const clk = rd("src/composables/useWorkstationSessionClock.js");
  check((clk.match(/\n    linesEditedAt,?\n/g) || []).length === 2, "useWorkstationSessionClock: takes linesEditedAt from the sync store and passes it on");
}

if (problems.length) {
  console.error("FAIL: live adjust:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: the running session is adjusted in its own box, and a short log is asked for in place.");
process.exit(0);
