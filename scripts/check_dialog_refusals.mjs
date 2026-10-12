#!/usr/bin/env node
// A dialog that is refused says why inside itself and stays open as filled in. Never a toast
// behind it, never the browser's confirm() or alert(): they cannot say which entry, freeze the
// page and look like nothing else here. Each question reads as one ("Cancel this block?") and
// its buttons are the answers.
// Cancelling a block: the reason is the person's to pick (nothing preset), from the server's own
// list, with an optional note that goes on the block's activity. A recording block is never
// offered Cancel (App.vue isBlockCancellable), so cancelling stops, discards or writes into no
// session; the old path that did was dead code that wrote "Cancelled (reason)" into the log.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const problems = [];
const need = (file, re, what) => { if (!re.test(read(file))) problems.push(`${file}: ${what}`); };
const forbid = (file, re, what) => { if (re.test(read(file))) problems.push(`${file}: ${what}`); };
// The catch block of a function, by the text that starts it
const catchOf = (file, start) => {
  const src = read(file);
  const i = src.indexOf(start);
  if (i < 0) { problems.push(`${file}: ${start} not found`); return ""; }
  const c = src.indexOf("} catch (e) {", i);
  // Up to its finally, or the end of the function when it has none
  const ends = ["} finally {", "\n    },\n", "\n  };"].map((t) => src.indexOf(t, c)).filter((n) => n > c);
  return c < 0 || !ends.length ? "" : src.slice(c, Math.min(...ends));
};
const inPlace = (file, start, re, what) => {
  const body = catchOf(file, start);
  if (/showToast\(/.test(body)) problems.push(`${file}: ${what} says why in the dialog, never a toast`);
  if (!re.test(body)) problems.push(`${file}: ${what} keeps the refusal for the dialog to show`);
};
const alertLine = (file, re, what) => need(file, re, `${what}: the refusal shows as role="alert" inside the dialog`);

// 1. Cancel a block
const CAN = "src/components/dialogs/CancelWorkBlockModal.vue";
need(CAN, /title="Cancel this block\?"/, "the title is the question");
need(CAN, /<Textarea\s[^>]*id="cancel-note"/, "the note is a frappe-ui Textarea");
forbid(CAN, /type="checkbox"|<Checkbox\b|<textarea\b/, "no checkbox, no native textarea");
alertLine(CAN, /<p v-if="error" role="alert"[^>]*>Not cancelled\. \{\{ error \}\}<\/p>/, "cancel");
need(CAN, /label="Cancel block"[\s\S]{0,80}:disabled="!cancelForm\.reason \|\| busy"/, "Cancel block waits until a reason is picked");
need(CAN, /label="Keep block"/, "the other answer is Keep block");
forbid(CAN, /isTrackingThisBlock|formattedTime/, "no running-session branch (Cancel is never offered on a recording block)");
const WBS = "src/stores/workBlockStore.js";
const store = read(WBS);
if ((store.match(/cancelForm(?:\.value)? = (?:ref\()?\{ reason: '', notes: '' \}/g) || []).length !== 2) problems.push(`${WBS}: the cancel form starts with no reason, at setup and on every open`);
const listed = ((store.match(/const cancelReasons = ref\(\[([\s\S]*?)\]\)/) || [])[1] || "").match(/'[^']*'/g)?.map((s) => s.slice(1, -1)) || [];
const PWB = JSON.parse(read("omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.json"));
const options = (PWB.fields.find((f) => f.fieldname === "cancel_reason") || {}).options.split("\n").filter(Boolean);
if (JSON.stringify(listed) !== JSON.stringify(options)) problems.push(`${WBS}: cancelReasons ${JSON.stringify(listed)} must be Planned Work Block.cancel_reason's options ${JSON.stringify(options)}`);
if (/discardSession|stopSessionRemote|log_elapsed|Cancelled \(/.test(store)) problems.push(`${WBS}: cancelling stops, discards or writes into no session`);
inPlace(WBS, "const submitCancelBlock = async", /cancelError\.value = /, "submitCancelBlock");
need(WBS, /cancel_note: \(cancelForm\.value\.notes \|\| ''\)\.trim\(\)/, "the note goes to the server");
need("src/components/dialogs/DialogCoordinator.vue", /<CancelWorkBlockModal[\s\S]*?:error="cancelError"/, "the cancel dialog gets the refusal");
need("src/App.vue", /:cancel-error="cancelError"/, "App hands cancelError to the dialogs");
need("omnitrack/api/planner.py", /def update_work_block\([\s\S]*?cancel_note=None\):/, "update_work_block takes cancel_note");
need("omnitrack/api/planner.py", /if status == "Cancelled" and note:\n\t\tdoc\.add_comment\("Comment", text=frappe\.utils\.escape_html\(note\)\)/, "the note goes on the block's activity, escaped");

// 2. Delete a logged entry
const MOD = "src/composables/useWorkstationSessionModals.js";
const ask = (read(MOD).match(/const confirmDeleteSession = [\s\S]*?\n  \};/) || [""])[0];
if (!/deleteEntry\.value = \{ block: block \|\| null, session \};/.test(ask) || /postJSON/.test(ask)) problems.push(`${MOD}: confirmDeleteSession only opens DeleteEntryDialog`);
inPlace(MOD, "const deleteSessionEntry = async", /deleteEntryError\.value = extractErrorMessage\(e, /, "deleteSessionEntry");
const DEL = "src/components/dialogs/DeleteEntryDialog.vue";
need(DEL, /title="Delete this entry\?"/, "the title is the question");
need(DEL, /<Button variant="ghost" label="Keep entry" data-autofocus/, "focus starts on Keep entry, so Enter never deletes");
forbid(DEL, /theme="red"[^>]*data-autofocus|data-autofocus[^>]*theme="red"/, "focus never starts on Delete");
alertLine(DEL, /<p v-if="deleteEntryError" role="alert"[^>]*>Not deleted\. \{\{ deleteEntryError \}\}<\/p>/, "delete");
need("src/App.vue", /<DeleteEntryDialog \/>/, "App mounts DeleteEntryDialog");

// 3. The task form
const TF = "src/components/dialogs/TaskFormDialog.vue";
inPlace(TF, "async save()", /this\.error = 'Not saved\. ' \+ this\.extractErrorMessage\(e, /, "save");
inPlace(TF, "async move()", /this\.error = 'Not moved\. ' \+ this\.extractErrorMessage\(e, /, "a workflow move");
inPlace(TF, "async remove()", /this\.error = 'Not taken off\. ' \+ this\.extractErrorMessage\(e, /, "remove");
const load = catchOf(TF, "async load()");
if (/closeTaskForm\(\)|showToast\(/.test(load)) problems.push(`${TF}: a task that will not open says so in the form, with Try again, not a toast and a closed form`);
need(TF, /<p v-if="error" role="alert"[^>]*>\{\{ error \}\}<\/p>/, "a refused move shows in its confirm box");
need(TF, /<div v-if="error && !confirming"[\s\S]*?<p role="alert"[^>]*>\{\{ error \}\}<\/p>\s*<Button v-if="!loaded"[^>]*label="Try again" @click="load"/, "other refusals show in the form, and a failed open offers Try again");

// 4. Edit block, Add tasks, Reschedule, Plan time
inPlace("src/drawers/EditBlockDialog.vue", "async save()", /this\.error = this\.extractErrorMessage\(e, /, "Edit block");
alertLine("src/drawers/EditBlockDialog.vue", /<p v-if="error" role="alert"[^>]*>Not saved\. \{\{ error \}\}<\/p>/, "Edit block");
inPlace("src/drawers/AddBlockTasksDialog.vue", "async add(", /this\.error = this\.extractErrorMessage\(e, /, "Add tasks");
alertLine("src/drawers/AddBlockTasksDialog.vue", /<p v-if="error" role="alert"[^>]*>Not added\. \{\{ error \}\}<\/p>/, "Add tasks");
const FT = "src/composables/useWorkstationFocusTasks.js";
inPlace(FT, "const submitReschedule = async", /return w\.extractErrorMessage\(e, /, "submitReschedule");
need("src/drawers/RescheduleBlockDialog.vue", /this\.error = await this\.submitReschedule\(\{ \.\.\.this\.form \}\);/, "Reschedule keeps what submitReschedule says");
alertLine("src/drawers/RescheduleBlockDialog.vue", /<p v-if="error" role="alert"[^>]*>Not moved\. \{\{ error \}\}<\/p>/, "Reschedule");
const book = (store.match(/const submitBooking = async[\s\S]*?\n  \};/) || [""])[0];
// Its own checks too: no toast of any kind before the plan is saved
if (/showToast\([^;]*'(danger|warning)'/.test(book)) problems.push(`${WBS}: submitBooking says why in the Plan dialog, never a toast`);
inPlace(WBS, "const submitBooking = async", /bookError\.value = /, "submitBooking");
need(WBS, /bookError\.value = '';\s*showBookModal\.value = true;/, "a newly opened Plan dialog starts with no old refusal");
need("src/components/dialogs/DialogCoordinator.vue", /<PlanWorkBlockDialog[\s\S]*?:error="bookError"/, "the Plan dialog gets the refusal");
need("src/App.vue", /:book-error="bookError"/, "App hands bookError to the dialogs");
alertLine("src/components/dialogs/PlanWorkBlockDialog.vue", /<p v-if="error" role="alert"[^>]*>Not planned\. \{\{ error \}\}<\/p>/, "Plan time");

// 5. No browser confirm() or alert() anywhere in the app
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(dir, d.name)) : /\.(vue|js)$/.test(d.name) ? [path.join(dir, d.name)] : []);
for (const file of walk("src")) {
  const code = read(file).replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"])\/\/[^\n]*/g, "$1");
  if (/(^|[^.\w$])(window\.)?(confirm|alert)\(/m.test(code)) problems.push(`${file}: no browser confirm() or alert(); ask in a dialog, say why in place`);
}

if (problems.length) {
  console.error("FAIL: dialog refusals:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK: refused dialogs say why inside themselves; cancel asks for a real reason and never touches a session; no browser confirm()");
