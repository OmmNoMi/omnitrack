// The prompts that open by themselves ask one question, and the buttons are the answers:
//   1. A planned block started late asks "When did you start?": two Buttons, Just now (focus
//      starts there, it claims no time not tracked) or At the planned start. No option cards.
//      Runs the real selectStartTimeChoice: each answer starts the block from its own time.
//   2. Wrap up the day is one sentence and the blocks left; each block's Log opens its own entry
//      box. No "Log all" writing the plan in as the work, no "Finish" that does nothing.
//   3. A notification states what happened and cannot take an answer: clicking it only brings
//      the page forward, never answers the question waiting there.
//   4. The runaway "Timer Overflow Check" (options plus an Apply button) is gone: nothing ever
//      opened it, and the still-working question already asks whether the session goes on.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];
const need = (ok, msg) => { if (!ok) problems.push(msg); };
const tplOf = (src) => src.slice(src.indexOf("<template>"), src.lastIndexOf("</template>"));

// 1. When did you start?
const start = read("src/components/dialogs/StartTimeChoiceModal.vue");
const startTpl = tplOf(start);
need(/title="[^"]+\?"/.test(start), "StartTimeChoiceModal.vue: the title is the question");
need(!/v-for=/.test(startTpl), "StartTimeChoiceModal.vue: the answers are Buttons, not a list of option cards");
need((startTpl.match(/<Button\b/g) || []).length === 2, "StartTimeChoiceModal.vue: two answers, nothing else (Escape or close starts nothing)");
need(/label="Just now"\s+data-autofocus/.test(startTpl), "StartTimeChoiceModal.vue: Just now is the answer focus starts on");
need(startTpl.includes("$emit('select', null)"), "StartTimeChoiceModal.vue: Just now starts from the moment it is pressed (select null)");
need(startTpl.includes("$emit('select', plannedStartMs)"), "StartTimeChoiceModal.vue: At the planned start starts from the planned start");

globalThis.window = { OMNITRACK_SESSION: { min_session_words: 5 }, dispatchEvent: () => true };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
const { useWorkstationSessionModals } = await import("../src/composables/useWorkstationSessionModals.js");
const { ref, computed } = await import("vue");
const startedWith = [];
const s = {
  isTracking: ref(false), startTime: ref(null), trackerSeconds: ref(0), trackerTimer: ref(null),
  trackerNotes: ref(""), trackerBoundBlock: ref(null), trackerBlockName: ref(null), sessionNotesList: ref([]),
  selectedNature: ref("Work"), selectedProject: ref(""), todayDate: ref(""), isSessionElevated: ref(false),
  activeTab: ref("planner"), newSessionPoint: ref(""), selectedDashboardDate: ref(""), selectedEmployee: ref(""),
  activeBlock: ref(null), isManager: ref(false), discardConfirm: ref(false), stopConfirmName: ref("")
};
s.sessionHasLines = computed(() => false);
const m = useWorkstationSessionModals({
  ...s, showToast: () => {}, toggleTrack: async () => {}, syncActiveSession: () => {}, recordUserActivity: () => {},
  checkInactivity: () => {}, todayISO: () => "", getLocalTodayISO: () => "", hhmm: (t) => String(t || "").slice(0, 5),
  postJSON: async () => ({}), fetchWorkstationData: () => {}, fetchPlannerData: () => {},
  trackBlock: (b, epoch) => startedWith.push([b && b.name, epoch])
});
const planned = Date.now() - 25 * 60000;
for (const [answer, want, what] of [[null, null, "Just now"], [planned, planned, "At the planned start"]]) {
  startedWith.length = 0;
  m.pendingStartBlock.value = { name: "PWB-1" };
  m.pendingStartMs.value = planned;
  m.showStartTimeChoiceModal.value = true;
  m.selectStartTimeChoice(answer);
  need(startedWith.length === 1 && startedWith[0][0] === "PWB-1" && startedWith[0][1] === want,
    `${what} starts the block from ${want === null ? "now" : "its planned start"} (got ${JSON.stringify(startedWith)})`);
  need(!m.showStartTimeChoiceModal.value && m.pendingStartBlock.value === null, `${what} closes the question and forgets the block`);
}
const shortcuts = read("src/composables/useWorkstationShortcuts.js");
need(/pendingStartMs\.value = startEpoch;/.test(shortcuts), "useWorkstationShortcuts.js: the question is asked about the block's planned start");

// 2. Wrap up the day
const eod = read("src/components/dialogs/EODWrapUpModal.vue");
const eodTpl = tplOf(eod);
need(/emits:\s*\["update:modelValue", "log-block"\]/.test(eod), "EODWrapUpModal.vue: its only answers are Done and each block's Log (no Log all, no Finish)");
need(!/Log all|Finish the day|progressbar/.test(eodTpl), "EODWrapUpModal.vue: one sentence and the blocks left; no Log all, no Finish, no progress bar repeating the banner");
need((eodTpl.match(/<Button\b/g) || []).length === 2, "EODWrapUpModal.vue: a Log per block and Done, nothing else");
const att = read("src/composables/useWorkstationAttendance.js");
const logFn = att.slice(att.indexOf("const logPendingBlock"), att.indexOf("const trackBlock"));
need(/showEODModal\.value = false;[\s\S]*w\.openEditSessionModal\(block\)/.test(logFn), "useWorkstationAttendance.js: Log closes the day's review, then opens the block's own entry box (one dialog at a time)");
need(read("src/App.vue").includes('@log-pending-block="logPendingBlock"'), "App.vue: a block's Log reaches logPendingBlock");
const srcFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? srcFiles(path.join(dir, e.name)) : /\.(vue|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
for (const f of srcFiles("src")) {
  const text = read(f);
  if (/Completed as scheduled|convert_plan_to_actual/.test(text)) problems.push(`${f}: no plan written in as the work; a block is logged in its own entry box, in the person's words`);
  if (/RunawayTimerModal|Timer Overflow|Apply Resolution/.test(text)) problems.push(`${f}: the runaway options-plus-Apply dialog is gone; the still-working question asks whether the session goes on`);
}

// 3. Notifications state, never answer
const audio = read("src/composables/useWorkstationAudioSync.js");
need(!/confirmStillWorking/.test(audio), "useWorkstationAudioSync.js: clicking a notification never answers the still-working question");
const overrun = audio.slice(audio.indexOf("const checkBlockOverrun"));
const overrunMsg = (overrun.match(/const msg = `([^`]*)`/) || [])[1] || "";
need(overrunMsg && !overrunMsg.includes("?"), "useWorkstationAudioSync.js: the overrun notification says what happened, it asks nothing it cannot take an answer to");
need(/dispatchInactivityNotification\(msg, 'omnitrack-block-overrun', '[^'?]+'\)/.test(overrun), "useWorkstationAudioSync.js: the overrun notification has its own heading, not 'Are you still working?'");
const clockSrc = read("src/composables/useWorkstationSessionClock.js");
const idleMsg = (clockSrc.match(/dispatchInactivityNotification\(`([^`]*)`\)/) || [])[1] || "";
need(idleMsg && !idleMsg.includes("?"), "useWorkstationSessionClock.js: the still-working notification's body states the gap; its heading is the question");

if (problems.length) {
  console.error("FAIL: prompts:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: each prompt asks one question, its buttons are the answers, and a notification never answers one.");
process.exit(0);
