#!/usr/bin/env node
// Switching to the next block is one decision, laid out as a route: what ends and is saved, then
// what starts. The log already says what was done, so the dialog never prefills a box that repeats
// it; it takes one optional last line. Times read as a clock ("7:00 pm"), never "19:00:00".
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
const prompt = (att.match(/const promptSwitchSession = [\s\S]*?\n  };/) || [""])[0];
if (!/switchWrapUpNote\.value = '';/.test(prompt)) problems.push("useWorkstationAttendance.js: promptSwitchSession starts the last line empty, it does not copy the log into it");
if (!/const wrapNote = composeWrapNote\(trackerNotes\.value, sessionNotesList\.value, switchWrapUpNote\.value\)/.test(att)) problems.push("useWorkstationAttendance.js: executeSwitchTask saves the log plus the last line (composeWrapNote)");
if (!/:current-log-count=/.test(read("src/App.vue"))) problems.push("App.vue: the dialog is told how many lines the log holds");

if (problems.length) {
  console.error("FAIL: switch dialog\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: the switch dialog reads as a route, keeps the log as it is, and shows clock times.");
