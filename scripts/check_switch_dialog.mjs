#!/usr/bin/env node
// Switching to the next block is one decision, laid out as a route: what ends and is saved, then
// what starts. The log already says what was done, so the dialog never prefills a box that repeats
// it; it takes one last line. Times read as a clock ("7:00 pm"), never "19:00:00".
// It is the only switch dialog: the Switch button opens it asking what comes next, picked in place
// (a frappe-ui Combobox), never a list of rows that switched on one click with a second dialog to
// confirm it. Switch waits for a target and a log long enough to save, and the dialog closes only
// once the switch is made: refused, it says why in place and the session runs on.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeWrapNote } from "../src/utils/wrapNote.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const problems = [];
const eq = (got, want, what) => { if (got !== want) problems.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };

// The saved notes are the same as before the redesign when no last line is added.
eq(composeWrapNote("Fix login", ["read logs", " ", "patched"], ""), "Fix login\n\n• read logs\n• patched", "title and log lines");
eq(composeWrapNote("Fix login", [], ""), "Fix login", "title alone");
eq(composeWrapNote("", ["one"], ""), "• one", "log alone");
eq(composeWrapNote("Fix login", ["read logs"], "  sent to QA "), "Fix login\n\n• read logs\n• sent to QA", "the last line joins the log");
eq(composeWrapNote("", [], ""), "", "nothing");

const modal = read("src/components/dialogs/WrapAndStartNextModal.vue");
const tpl = modal.slice(0, modal.indexOf("<script"));
if (/<Textarea\b/.test(tpl)) problems.push("WrapAndStartNextModal.vue: no prefilled notes box; one optional last line (TextInput)");
if (!/<TextInput\b[\s\S]*?id="wrap-last-line"/.test(tpl) || !/<label for="wrap-last-line"/.test(tpl)) problems.push("WrapAndStartNextModal.vue: the last line is a labelled TextInput");
if (/sublabel/.test(modal)) problems.push("WrapAndStartNextModal.vue: no raw sublabel (it carried 19:00:00 times); format the plan with clock()");
if (!/clock\(toMin\(t\.start_time\)\)/.test(modal)) problems.push("WrapAndStartNextModal.vue: the planned time reads as a clock");
if (!/<ol\b[^>]*aria-label=/.test(tpl)) problems.push("WrapAndStartNextModal.vue: the two stops are an ordered, labelled list");
if (/Active Work Session|Wrap & Start/.test(modal + read("src/App.vue"))) problems.push("no placeholder session names");

const att = read("src/composables/useWorkstationAttendance.js");
const opener = (att.match(/const openSwitch = [\s\S]*?\n  };/) || [""])[0];
if (!/switchWrapUpNote\.value = '';/.test(opener)) problems.push("useWorkstationAttendance.js: the switch dialog opens with the last line empty, it does not copy the log into it");
if (!/const wrapNote = composeWrapNote\(trackerNotes\.value, sessionNotesList\.value, switchWrapUpNote\.value\)/.test(att)) problems.push("useWorkstationAttendance.js: executeSwitchTask saves the log plus the last line (composeWrapNote)");
if (!/:current-log-count=/.test(read("src/App.vue"))) problems.push("App.vue: the dialog is told how many lines the log holds");

// One switch dialog, the target picked in it
const srcFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? srcFiles(path.join(dir, e.name)) : /\.(vue|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
for (const f of srcFiles("src")) {
  if (/SwitchTaskModal|Switch Active Task|Active Clock|Bound to Block|switchSearchQuery/.test(read(f))) problems.push(`${f}: the list that switched on one click is gone; the Switch button opens the one switch dialog to pick in`);
}
if (!/<Combobox\b[\s\S]*?id="switch-to"/.test(tpl) || !/<label for="switch-to"/.test(tpl)) problems.push("WrapAndStartNextModal.vue: what starts is picked in a labelled frappe-ui Combobox");
if (!/@click\.stop="openSwitchPicker"/.test(read("src/views/dashboard/DashboardHappeningNow.vue"))) problems.push("DashboardHappeningNow.vue: the Switch button opens the switch dialog to pick in");
if (!/<Button v-if="switchCandidates\.length"[^>]*@click\.stop="openSwitchPicker"/.test(read("src/views/dashboard/DashboardHappeningNow.vue"))) problems.push("DashboardHappeningNow.vue: the Switch button is offered only when there is something to switch to, never a question with no answer");

// The dialog's own rules, run from its script: Switch waits for a target and enough words, and
// focus starts on what is still to answer.
const script = modal.slice(modal.indexOf("<script>") + 8, modal.indexOf("</script>"))
  .replace(/from "\.\.\/\.\.\/utils\/([^"]+)"/g, (_, f) => `from "${new URL("../src/utils/" + f, import.meta.url).href}"`);
const def = (await import("data:text/javascript," + encodeURIComponent(script))).default;
const view = (props) => {
  const vm = { ...Object.fromEntries(Object.entries(def.props).map(([k, v]) => [k, typeof v.default === "function" ? v.default() : v.default])), ...props, emitted: [] };
  vm.$emit = (...a) => vm.emitted.push(a);
  for (const [k, fn] of Object.entries(def.methods)) vm[k] = fn.bind(vm);
  for (const [k, c] of Object.entries(def.computed)) Object.defineProperty(vm, k, { get: () => (c.get || c).call(vm) });
  return vm;
};
const block = { name: "PWB-2", label: "Invoice export", is_block: true, start_time: "19:00:00", end_time: "20:30:00", project: "PROJ-1", project_name: "Billing" };
const task = { name: "TASK-9", label: "Review the PR", is_block: false, project: "PROJ-1" };
let v = view({ pick: true, candidates: [block, task], logWords: 20, minWords: 15 });
eq(v.title, "What are you switching to?", "picking: the title is the question");
eq(v.canSwitch, false, "picking: Switch waits for a target");
eq(v.focusOn, "pick", "picking: focus starts on what starts next");
eq(JSON.stringify(v.pickOptions.map((g) => [g.group, g.options.map((o) => o.value)])), JSON.stringify([["Planned today", ["block:PWB-2"]], ["Your tasks", ["task:TASK-9"]]]), "picking: today's blocks, then the person's tasks");
eq(v.pickOptions[0].options[0].description, "7:00 pm – 8:30 pm · Billing", "picking: a block says when, as a clock, and for which project");
v.onPick("task:TASK-9");
eq(v.emitted[0] && v.emitted[0][0] === "pick" && v.emitted[0][1], task, "picking an option hands back its item");
v = view({ pick: true, candidates: [block], targetItem: block, logWords: 20, minWords: 15 });
eq(v.title, "What are you switching to?", "picked: the title stays put");
eq(v.canSwitch, true, "picked, log long enough: Switch is ready");
eq(v.focusOn, "switch", "picked, log long enough: focus on Switch");
v = view({ targetItem: block, logWords: 6, minWords: 15 });
eq(v.title, "Start the next block?", "known target: the title asks about it");
eq(v.canSwitch, false, "a log too short to save: Switch waits");
eq(v.focusOn, "line", "a log too short to save: focus starts on the last line");
v = view({ targetItem: block, logWords: 6, minWords: 15, wrapUpNote: "read the export, fixed the tax rounding, added a test" });
eq(v.canSwitch, true, "the last line's words count toward the log");
eq(view({ targetItem: block, logWords: 20, isSwitching: true }).canSwitch, false, "Switch cannot be pressed twice");
if (!/:disabled="!canSwitch"/.test(tpl)) problems.push("WrapAndStartNextModal.vue: Switch is disabled until it can be pressed");
if (!/role="alert"[^>]*>[^<]*\{\{ error \}\}/.test(tpl)) problems.push("WrapAndStartNextModal.vue: a refusal is said in place, as an alert");

// The composable: a refusal keeps the dialog open with the reason; a switch closes it.
globalThis.window = { OMNITRACK_SESSION: { min_session_words: 15 } };
const { ref } = await import("vue");
const { useWorkstationAttendance } = await import("../src/composables/useWorkstationAttendance.js");
let reply;
const posted = [];
const w = new Proxy({
  _explicitBoundBlock: ref(null), assignedTasks: ref([]), plannerData: ref({ blocks: [{ name: "PWB-1" }, { name: "PWB-2", status: "Planned" }] }),
  sessionNotesList: ref(["read the export"]), trackerNotes: ref("Invoice bug"), trackerBlockName: ref("PWB-1"), startTime: ref(Date.now() - 600000),
  sessionTasks: ref([{ ref: "T-1", done: true }]), isSessionElevated: ref(true),
  postJSON: async (m, body) => { posted.push([m, body]); return reply(); }, flt: (x) => parseFloat(x) || 0,
  showToast: () => {}, triggerHaptic: () => {}, fetchWorkstationData: () => {}, fetchPlannerData: () => {},
}, { get: (t, k) => (k in t ? t[k] : typeof k === "string" && /^(show|is|selected|tracker|last)/.test(k) ? (t[k] = ref(null)) : t[k]) });
useWorkstationAttendance(w);
w.openSwitchPicker();
eq(w.showSwitchConfirmModal.value && w.switchPick.value && w.switchTargetItem.value === null, true, "Switch opens the one dialog, picking");
eq(w.isSessionElevated.value, false, "Switch closes the session popup under it");
eq(w.switchCandidates.value.map((c) => c.name).join(), "PWB-2", "the running block is not offered");
await w.confirmSwitchAndStart();
eq(posted.length, 0, "nothing is sent without a target");
w.switchTargetItem.value = w.switchCandidates.value[0];
w.switchWrapUpNote.value = "fixed it";
reply = () => { throw new Error("Describe what you did in at least 15 words (you wrote 6)."); };
await w.confirmSwitchAndStart();
eq(w.showSwitchConfirmModal.value, true, "refused: the dialog stays open");
eq(w.switchError.value, "Describe what you did in at least 15 words (you wrote 6).", "refused: it says why");
eq(w.switchWrapUpNote.value, "fixed it", "refused: the last line is kept");
eq(w.trackerBlockName.value, "PWB-1", "refused: the session runs on");
eq(posted[0][1].session_tasks, JSON.stringify([{ ref: "T-1", done: true }]), "the session's tasks go with it");
w.switchWrapUpNote.value = "fixed it, then wrote the test for the rounding case";
await Promise.resolve();
eq(w.switchError.value, "", "an edit clears the refusal");
reply = () => ({ elapsed_hours: 0.17 });
await w.confirmSwitchAndStart();
eq(w.showSwitchConfirmModal.value, false, "switched: the dialog closes");
eq(w.trackerBlockName.value, "PWB-2", "switched: the next block runs");
eq(w.sessionTasks.value.length, 0, "switched: the next session starts with no tasks");

// The server saves what ends in the person's own words, and saves it even with no block under it
// (omnitrack/tests/test_stopwatch.py runs both on a test site).
const py = read("omnitrack/api/stopwatch.py");
const sw = py.slice(py.indexOf("def switch_active_session("), py.indexOf("\n@frappe.whitelist()", py.indexOf("def switch_active_session(")));
if (!/log_work_session\((?:(?!\n\t\t\))[\s\S])*?\n\t\t\tnotes=current_session_notes,\n/.test(sw)) problems.push("stopwatch.py: switch_active_session saves the log as written, never an invented note");
if (!/\n\telif start_ms > 0:[\s\S]*?quick_timer_punch\([\s\S]*?notes=current_session_notes,[\s\S]*?session_tasks=session_tasks,/.test(sw)) problems.push("stopwatch.py: a session on no block is saved when it is switched, as Stop saves it, with its tasks");

if (problems.length) {
  console.error("FAIL: switch dialog\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: one switch dialog: a route, the target picked in place, Switch waits for a target and enough words, and a refusal keeps the session and says why.");
