#!/usr/bin/env node
// A work session is time already worked. Adding one used to accept any time today, so time not
// worked yet could be logged, sent to a Timesheet and charged before it happened. The entry
// sheet will not save an entry that ends after now and says why, the save path refuses it, and
// the server refuses it too (a browser is not the last word on a bill).
// The entry is the session box the timer uses, so a person sees it is a session they are adding;
// it closes on Esc, keeps Tab inside, and hands focus back.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];

// 1. The rule itself, measured as a moment (past midnight counts as the next day)
const { entryEndMs } = await import(pathToFileURL(path.join(root, "src/utils/timesheetEntry.js")).href);
const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi).getTime();
if (entryEndMs("2026-10-07", "13:15", 60) !== at(2026, 10, 7, 14, 15)) problems.push("src/utils/timesheetEntry.js: entryEndMs puts 1:15 pm plus an hour at 2:15 pm that day");
if (entryEndMs("2026-10-07", "23:00", 120) !== at(2026, 10, 8, 1, 0)) problems.push("src/utils/timesheetEntry.js: entryEndMs carries an overnight entry into the next day");
if (entryEndMs("", "10:00", 60) !== null) problems.push("src/utils/timesheetEntry.js: entryEndMs has no end without a day");

// 2. The entry: nothing after now, said out loud. Adding or editing a work session by hand is the
//    session box the timer uses (SessionBox mode="entry", hosted by WorkSessionEntry), so it reads
//    as the session it will become. The running session's own correction (Adjust) is still the
//    sheet in TimesheetEntryDialog, and keeps the same rule.
const FILES = {
  "src/session/useSessionEntry.js": [
    [/const entryAhead = computed\(\(\) => \{\s*const end = entryEndMs\(entry\.value\.session_date, entry\.value\.from_time, entryMins\.value\);\s*return end != null && entryMins\.value > 0 && end > now\.value \+ 60000;/, "an entry ending after now is ahead"],
    [/return !props\.isSaving && !!entry\.value\.session_date && entryMins\.value > 0 && !entryAhead\.value && said;/, "an entry ending after now cannot be saved"],
    [/tick = setInterval\(\(\) => \{ now\.value = Date\.now\(\); \}, 30000\);/, "now moves on while the entry is open"],
    [/const said = \(props\.sessionNotesList \|\| \[\]\)\.length > 0 \|\| draftReady\.value;/, "a session needs a line, as when it is stopped"],
  ],
  "src/session/SessionControlsPane.vue": [
    [/<p v-if="entryAhead" class="text-sm text-red-700 dark:text-red-200" role="alert">\{\{ entryAheadText \}\}<\/p>/, "says why it cannot be saved"],
    [/:disabled="!entryCanSave"/, "Add session waits until it can be saved"],
    [/:tabindex="activeToolIndex === 0 \|\| !entryCanSave \? 0 : -1"/, "Cancel stays reachable by Tab while Add session is disabled"],
  ],
  "src/components/dialogs/WorkSessionEntry.vue": [
    [/role="dialog"\s+aria-modal="true"\s+aria-labelledby="entry-session-title"/, "is a named modal popup"],
    [/if \(e\.defaultPrevented \|\| popover\) return;/, "an Escape for an open list closes the list, not the entry"],
    [/if \(e\.shiftKey && document\.activeElement === first\) \{ e\.preventDefault\(\); last\.focus\(\); \}/, "Tab stays inside the entry"],
    [/if \(lost && opener && document\.contains\(opener\)\) opener\.focus\(\);/, "focus goes back to what opened it"],
    [/setScrollLock\("work-session-entry", false\);/, "lets the page scroll again on close"],
    // Opened from a menu (the block's More), focus is on a menu item that is about to go
    [/this\.opener = menuTrigger\(document\.activeElement\);/, "focus goes back to the menu's button, not to an item that is gone"],
    [/if \(this\.\$refs\.sheet && !this\.\$refs\.sheet\.contains\(e\.target\)\) setTimeout\(\(\) => this\.toLine\(\)\);/, "focus a menu hands back to its button comes back to the Log's field"],
    [/document\.addEventListener\("focusin", back, true\);\s*setTimeout\(\(\) => document\.removeEventListener\("focusin", back, true\), 600\);/, "takes focus back only while the menu closes, not for good"],
    // The app's shortcuts act on the running session (Cmd+S stops it); never from inside an entry
    [/if \(e\.metaKey \|\| e\.ctrlKey \|\| e\.altKey \|\| e\.key === "\/" \|\| \(e\.shiftKey && e\.key\.length === 1\)\) e\.stopPropagation\(\);/, "keeps the app's shortcuts from acting on the running session behind it"],
    [/if \(\(e\.metaKey \|\| e\.ctrlKey\) && e\.key === "Enter"\) \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*if \(this\.\$refs\.box\) this\.\$refs\.box\.entrySave\(\);/, "Cmd/Ctrl+Enter saves"],
  ],
  "src/components/dialogs/TimesheetEntryDialog.vue": [
    [/ahead\(\) \{\s*const end = entryEndMs\(this\.form\.session_date, this\.form\.from_time, this\.mins\);\s*return end != null && this\.mins > 0 && end > this\.now \+ 60000;/, "an end after now is ahead"],
    [/return !this\.isSaving && !!f\.session_date && this\.mins > 0 && !this\.ahead && said;/, "an end after now cannot be saved"],
    [/<p v-if="ahead" class="text-sm" :class="lateText" role="alert">\{\{ aheadText \}\}<\/p>/, "says why it cannot be saved"],
  ],
};
for (const [f, need] of Object.entries(FILES)) {
  const src = read(f);
  for (const [re, what] of need) if (!re.test(src)) problems.push(`${f}: ${what}`);
}
// Only the running session opens the sheet; every other entry is the session box
const coord = read("src/components/dialogs/DialogCoordinator.vue");
if (!/<WorkSessionEntry\s+:model-value="showEditSessionModal && editSessionForm\.mode !== 'live'"/.test(coord) || !/<TimesheetEntryDialog\s+:model-value="showEditSessionModal && editSessionForm\.mode === 'live'"/.test(coord)) problems.push("src/components/dialogs/DialogCoordinator.vue: add, edit and free open WorkSessionEntry; only the running session opens TimesheetEntryDialog");

// The Log's lines are saved as a stopped session saves them, and read back the same way to edit
const { composeWrapNote, logLines } = await import(pathToFileURL(path.join(root, "src/utils/wrapNote.js")).href);
const saved = composeWrapNote("Fix the export", ["Found the bad row", "Shipped the fix"]);
if (saved !== "Fix the export\n\n\u2022 Found the bad row\n\u2022 Shipped the fix") problems.push(`src/utils/wrapNote.js: composeWrapNote writes the heading, then a bullet a line (got ${JSON.stringify(saved)})`);
if (JSON.stringify(logLines(saved, "Fix the export")) !== JSON.stringify(["Found the bad row", "Shipped the fix"])) problems.push("src/utils/wrapNote.js: logLines reads saved notes back as the lines they were written as, without the heading");
if (JSON.stringify(logLines("- one\n\n* two\nthree", "")) !== JSON.stringify(["one", "two", "three"])) problems.push("src/utils/wrapNote.js: logLines drops bullets and blank lines");

// A menu item's button is found through the menu that names it
const { menuTrigger } = await import(pathToFileURL(path.join(root, "src/utils/popover.js")).href);
const button = { id: "more" };
globalThis.document = { getElementById: (id) => (id === "more" ? button : null) };
const item = { closest: (sel) => (sel === '[role="menu"]' ? { getAttribute: (n) => (n === "aria-labelledby" ? "more" : null) } : null) };
const plain = { closest: () => null };
if (menuTrigger(item) !== button) problems.push("src/utils/popover.js: menuTrigger finds the button a menu item belongs to");
if (menuTrigger(plain) !== plain) problems.push("src/utils/popover.js: menuTrigger keeps an element that is not in a menu");
delete globalThis.document;

// 3. The save path and the server refuse it as well. The end is measured from the start with
//    spanMins, so an entry past midnight (23:30 to 00:30) is an hour, not refused as backwards.
const modals = read("src/composables/useWorkstationSessionModals.js");
if (!/const mins = f\.from_time && f\.to_time \? spanMins\(f\.from_time, f\.to_time\) : 0;\s*if \(!\(mins > 0\)\)/.test(modals) || /toMinutes/.test(modals)) problems.push("src/composables/useWorkstationSessionModals.js: saveEditSession measures the entry with spanMins, so one past midnight is not refused");
if (!/if \(entryEndMs\(f\.session_date, f\.from_time, mins\) > Date\.now\(\) \+ 60000\) \{ showToast\(/.test(modals)) problems.push("src/composables/useWorkstationSessionModals.js: saveEditSession refuses an entry ending after now");
if (!/if \(!\(f\.log \|\| \[\]\)\.length\) \{ showToast\(/.test(modals)) problems.push("src/composables/useWorkstationSessionModals.js: saveEditSession refuses an entry with no line");
if (!/const notes = composeWrapNote\(f\.block_title, f\.log\);/.test(modals)) problems.push("src/composables/useWorkstationSessionModals.js: writeEntry saves the Log's lines with composeWrapNote");
if (!/log: logLines\(session\.notes \|\| '', /.test(modals)) problems.push("src/composables/useWorkstationSessionModals.js: editing a session opens its notes as Log lines");
// A free entry files under its own Project and Activity, never the running session's
const write = (modals.match(/const writeEntry = async[\s\S]*?\n  \};/) || [""])[0];
if (/selectedProject|selectedNature/.test(write) || !/project: f\.project \|\| null/.test(write) || !/task_nature: f\.nature \|\| 'Work'/.test(write)) problems.push("src/composables/useWorkstationSessionModals.js: writeEntry files a free entry under the entry's own Project and Activity");
const api = read("omnitrack/api/timesheet.py");
if (!/if end > now_datetime\(\) \+ FUTURE_SLACK:\n\t\tfrappe\.throw/.test(api)) problems.push("omnitrack/api/timesheet.py: _require_worked refuses an end after now");
if (!/end_day = add_days\(end_day, 1\)/.test(api)) problems.push("omnitrack/api/timesheet.py: _require_worked carries an overnight entry into the next day");
if (!/def log_work_session[\s\S]*?_require_worked\(base_date, from_time, to_time\)[\s\S]*?doc\.save\(\)/.test(api)) problems.push("omnitrack/api/timesheet.py: log_work_session checks the entry was worked before saving");
if (!/def update_work_session[\s\S]*?_require_worked\(sess_row\.session_date, sess_row\.from_time, sess_row\.to_time\)[\s\S]*?doc\.save\(\)/.test(api)) problems.push("omnitrack/api/timesheet.py: update_work_session checks the edited entry was worked before saving");

if (problems.length) {
  console.error("FAIL: a work session is time already worked:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK: no work session can end after now; adding or editing one is the timer's session box");
