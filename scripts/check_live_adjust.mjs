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

function setup({ tracking = true, tab = "planner" } = {}) {
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
    fetchPlannerData: () => {}
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

if (problems.length) {
  console.error("FAIL: live adjust:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: the running session is adjusted in its own box, and a short log is asked for in place.");
process.exit(0);
