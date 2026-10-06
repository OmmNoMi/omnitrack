// "Done today" is a list that says only what is off. Runs the real row rules, then checks the
// view still uses them and has not grown back the card's chip row, accent stripe and repeats.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { concludedRowStatus, concludedRowHours, concludedRowNote, concludedTally } from "../src/utils/concludedRow.js";
import { countedHours } from "../src/utils/countedHours.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const onPlan = { status: "Logged (Full)", actual_hours: 1.5, duration_hours: 1.5, task_subject: "Ship it" };
eq(concludedRowStatus(onPlan), null, "logged to plan: no chip, the hours say it");
eq(concludedRowStatus({ actual_hours: 1, duration_hours: 1.5 }), { label: "0.5h short", theme: "orange" }, "under plan");
eq(concludedRowStatus({ actual_hours: 2, duration_hours: 1.5 }), { label: "0.5h over", theme: "blue" }, "over plan");
eq(concludedRowStatus({ status: "Missed", actual_hours: 0, duration_hours: 1 }), { label: "Not logged", theme: "orange" }, "nothing logged");
eq(concludedRowStatus({ status: "Cancelled", actual_hours: 0.2 }), { label: "Cancelled", theme: "red" }, "cancelled");
eq(concludedRowStatus({ status: "Rescheduled", actual_hours: 0 }), { label: "Rescheduled", theme: "gray" }, "rescheduled is not 'not logged'");

eq(concludedRowHours(onPlan), "1.5h", "hours logged");
eq(concludedRowHours({ actual_hours: 0 }), "", "no hours when nothing was logged");

eq(concludedRowNote({ task_subject: "Ship it", deliverable_notes: "Ship it", sessions: [{ notes: "Ship it" }] }), "", "notes never repeat the title");
eq(concludedRowNote({ task_subject: "Ship it", deliverable_notes: "", sessions: [{ notes: "a" }, { notes: "b\nmore" }] }), "b", "the latest session note, first line");
eq(concludedRowNote({ status: "Cancelled", task_subject: "X", cancel_reason: "Client no-show" }), "Client no-show", "a cancelled row says why");

// Counted hours: only time after the block starts that has already happened (PWB-2026-00320
// was logged into its own 7:30 PM slot at 5 PM and showed as Done).
const evening = { work_date: "2026-10-06", start_time: "19:30:00", duration_hours: 1.5, actual_hours: 1.5,
  sessions: [{ session_date: "2026-10-06", from_time: "19:30:00", to_time: "21:00:00", hours: 1.5 }] };
eq(countedHours(evening, { date: "2026-10-06", minute: 17 * 60 }), 0, "a slot still ahead counts nothing");
eq(countedHours(evening, { date: "2026-10-06", minute: 20 * 60 + 15 }), 0.75, "a slot part-way through counts the part that happened");
eq(countedHours(evening, { date: "2026-10-07", minute: 0 }), 1.5, "a slot that has passed counts in full");
eq(countedHours({ ...evening, sessions: [{ session_date: "2026-10-06", from_time: "17:00:00", to_time: "18:00:00", hours: 1 }] }, { date: "2026-10-07", minute: 0 }), 0, "time before the block starts does not count");
eq(countedHours({ ...evening, sessions: [{ session_date: "2026-10-08", hours: 2 }] }, { date: "2026-10-06", minute: 600 }), 0, "a session with no times counts only once its day has come");
eq(concludedRowStatus(evening, { date: "2026-10-06", minute: 17 * 60 }), { label: "Not logged", theme: "orange" }, "a block logged ahead is not on plan");
eq(countedHours({ actual_hours: 1.2 }, { date: "2026-10-06", minute: 0 }), 1.2, "a block without its sessions keeps its stored hours");

eq(concludedTally([onPlan, { status: "Missed", actual_hours: 0 }, { status: "Rescheduled" }, { status: "Cancelled" }]),
  "1 done · 1 not logged · 1 rescheduled · 1 cancelled", "the tally counts, it does not repeat hours");
eq(concludedTally([onPlan]), "1 done", "zeroes are left out");

const view = fs.readFileSync(path.join(root, "src/views/dashboard/DashboardPastBlocks.vue"), "utf8");
const tpl = view.slice(0, view.indexOf("<script"));
if (/omni-card--'\s*\+|getBlockCardAccent/.test(tpl)) problems.push("DashboardPastBlocks.vue: no coloured accent stripe; the chip carries the status");
if (/getBlockTimingInfo|getNatureBadge|associate_name/.test(tpl)) problems.push("DashboardPastBlocks.vue: no status pill, Work chip or owner name; one chip, only when something is off");
if (/line-clamp|toggleBlockNotes/.test(tpl)) problems.push("DashboardPastBlocks.vue: notes are one truncated line with the full text on hover, not an expander");
if ((tpl.match(/<Badge\b/g) || []).length !== 1) problems.push("DashboardPastBlocks.vue: a row has exactly one Badge, from concludedRowStatus");
if (!/v-if="concludedRowStatus\(b\)"/.test(tpl)) problems.push("DashboardPastBlocks.vue: the chip must come from concludedRowStatus(b)");
if (/quickConvertPlanToActual|'Log '/.test(view)) problems.push("DashboardPastBlocks.vue: no one-click Log on a row; logging happens in a session or the day review");
if (/svg/.test(tpl)) problems.push("DashboardPastBlocks.vue: no decorative inline SVG; use FeatherIcon where an icon earns its place");
if (/role="row"[\s\S]*?role="gridcell"/.test(tpl) === false) problems.push("DashboardPastBlocks.vue: grid rows must hold gridcells");

// No blind one-click log anywhere on the dashboard: it filled blocks from the plan unseen, even
// one that had not happened yet. The day review lists each block before it logs it.
const dash = path.join(root, "src/views/dashboard");
for (const f of fs.readdirSync(dash).filter((n) => n.endsWith(".vue"))) {
  if (/convertAllPendingPlannedBlocks|quickConvertPlanToActual/.test(fs.readFileSync(path.join(dash, f), "utf8"))) problems.push(`views/dashboard/${f}: no one-click log of planned blocks on the dashboard`);
}
// "Not logged" waits until a block is over: one still ahead or running is not pending.
const att = fs.readFileSync(path.join(root, "src/composables/useWorkstationAttendance.js"), "utf8");
const pending = (att.match(/const isPendingLog = [\s\S]*?;\n/) || [""])[0];
if (!/w\.isBlockConcluded\(b\)/.test(pending)) problems.push("useWorkstationAttendance.js: isPendingLog must only take blocks that are over (w.isBlockConcluded)");
if (!/blocks\.filter\(isPendingLog\)[\s\S]*blocks\.filter\(isPendingLog\)/.test(att)) problems.push("useWorkstationAttendance.js: the banner count and the review list both use isPendingLog");
// A block card's title is the way into its details; no icon pretending to be something else.
for (const f of ["DashboardHeroAgenda.vue", "DashboardHappeningNow.vue"]) {
  const src = fs.readFileSync(path.join(dash, f), "utf8");
  if (!/<h3[^>]*>\s*<button[^>]*@click(?:\.stop)?="openBlockDrawer\(/.test(src)) problems.push(`views/dashboard/${f}: the block title must be a button that opens its details`);
  if (/icon="calendar"[^>]*openBlockDrawer|openBlockDrawer[^>]*icon="calendar"/.test(src) || /'Reschedule ' \+/.test(src)) problems.push(`views/dashboard/${f}: no "Reschedule" icon that opens the details panel`);
}

if (problems.length) {
  console.error("FAIL: Done today rows\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: Done today says only what is off, counts only time that happened, never logs blind, and block titles open details.");
