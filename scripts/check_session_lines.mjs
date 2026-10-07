#!/usr/bin/env node
// A refused Stop never loses a session, and an older copy of its log never replaces a newer one.
// A session from 23:45 to 00:35 was lost: Stop cleared it on the server before saving, the save was
// refused for having 6 words, and the lines written during it had already been overwritten by an
// older copy of the log coming back from a poll. Now:
//  - Stop counts the words the way the server does, before the clock stops, and asks for more;
//  - a line typed but not added yet is saved with the session, never dropped;
//  - the server copy stays until a save succeeds (both saves clear it themselves), and a refused
//    save puts the session back as it was;
//  - every copy of the log carries linesRev, and an older copy never wins, here or on the server.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];

// 1. Words counted exactly as omnitrack/utils/validators.py counts them (the same cases)
const { countSessionWords, minSessionWords } = await import(pathToFileURL(path.join(root, "src/utils/sessionWords.js")).href);
for (const [text, expected] of JSON.parse(read("omnitrack/tests/fixtures/session_words.json"))) {
  if (countSessionWords(text) !== expected) problems.push(`src/utils/sessionWords.js: ${JSON.stringify(text)} is ${expected} words, as the server counts (got ${countSessionWords(text)})`);
}
if (minSessionWords(undefined) !== 15 || minSessionWords({ min_session_words: 0 }) !== 15) problems.push("src/utils/sessionWords.js: the minimum is 15 when the setting is not given, as on the server");
if (minSessionWords({ min_session_words: 20 }) !== 20) problems.push("src/utils/sessionWords.js: the minimum follows OmniTrack Settings");

// 2. An older copy of the log never wins
const { remoteLinesWin } = await import(pathToFileURL(path.join(root, "src/utils/sessionLines.js")).href);
if (remoteLinesWin(100, 200)) problems.push("src/utils/sessionLines.js: an older copy of the log must not replace a newer one");
if (!remoteLinesWin(300, 200) || !remoteLinesWin(200, 200)) problems.push("src/utils/sessionLines.js: a newer (or the same) copy is taken");
if (remoteLinesWin(undefined, 5)) problems.push("src/utils/sessionLines.js: a copy with no revision is older than one with a revision");

// 3. Stop: asks before teardown, keeps the server copy, puts the session back on a refusal
const api = read("src/composables/useWorkstationApi.js");
const stopAt = api.indexOf("      // A line typed but not added yet is part of the log");
const stop = stopAt === -1 ? "" : api.slice(stopAt, api.indexOf("  // Start the header stopwatch bound to a specific Planner block."));
if (!stop) problems.push("src/composables/useWorkstationApi.js: Stop folds a line typed but not added into the log");
else {
  const check = stop.indexOf("countSessionWords(notesNow) < minSessionWords(window.OMNITRACK_SESSION)) { refuseEmptySession(); return; }");
  const teardown = stop.indexOf("isTracking.value = false;");
  if (check === -1 || teardown === -1 || check > teardown) problems.push("src/composables/useWorkstationApi.js: Stop checks the word minimum before the clock is torn down");
  if (!/if \(draft\) \{ sessionNotesList\.value\.push\(draft\); newSessionPoint\.value = ''; syncActiveSession\(true\); \}/.test(stop) || stop.indexOf("if (draft)") > check) problems.push("src/composables/useWorkstationApi.js: the unsent line joins the log before the words are counted");
  if (/sync_active_session/.test(stop)) problems.push("src/composables/useWorkstationApi.js: Stop must not clear the server copy before the save succeeds (both saves clear it themselves)");
  const ok = stop.match(/broadcastSessionCleared\(\);/g) || [];
  if (ok.length !== 2) problems.push("src/composables/useWorkstationApi.js: other tabs hear the session ended only after each save succeeds");
  if ((stop.match(/\} catch \(err\) \{\s*keepSession\(err\);/g) || []).length !== 2) problems.push("src/composables/useWorkstationApi.js: a refused save (block or free entry) puts the session back");
  if (!/unmarkSessionEnded\(keptSession\.startTime\);\s*restoreActiveSession\(keptSession\);\s*syncActiveSession\(true\);/.test(stop)) problems.push("src/composables/useWorkstationApi.js: keepSession restores the session and sends it back up");
  if (!/sessionNotesList: \[\.\.\.\(sessionNotesList\.value \|\| \[\]\)\]/.test(stop)) problems.push("src/composables/useWorkstationApi.js: the kept session holds the log as it was");
  if (/Add it again from Log|Focus session \(|Tracked Focus \(/.test(stop)) problems.push("src/composables/useWorkstationApi.js: no invented notes and no 'add it again'; the session is kept");
}

// 4. The sync keeps the newer log
const sync = read("src/composables/useWorkstationSessionSync.js");
for (const [re, why] of [
  [/watch\(\[sessionNotesList, trackerNotes, sessionTasks\], \(\) => \{\s*if \(!_applyingRemote\) _linesRev = Date\.now\(\);\s*\}, \{ deep: true, flush: 'sync' \}\);/, "an edit here stamps the log"],
  [/linesRev: _linesRev,/, "every sync carries the log's revision"],
  [/const keepLocalLines = sameSession && !remoteLinesWin\(sessionData\.linesRev, _linesRev\);\s*if \(!keepLocalLines\) adoptRemoteLines\(/, "a restore keeps a newer log here"],
  [/if \(keepLocalLines\) syncActiveSession\(true\);/, "a restore that kept the log sends it back up"],
  [/const keptLocal = !remoteLinesWin\(remote\.linesRev, _linesRev\);\s*if \(!keptLocal\) \{/, "a poll or push keeps a newer log here"],
  [/if \(keptLocal\) syncActiveSession\(true\);\s*else localStorage\.setItem/, "a kept log goes back up and is not overwritten in storage"],
]) if (!re.test(sync)) problems.push(`src/composables/useWorkstationSessionSync.js: ${why}`);
if (/sessionNotesList\.value = \[\.\.\.remoteLines\];/.test(sync) && !/adoptRemoteLines\(\(\) => \{\s*if \(linesChanged\) sessionNotesList\.value = \[\.\.\.remoteLines\];/.test(sync)) problems.push("src/composables/useWorkstationSessionSync.js: remote lines only arrive through adoptRemoteLines");

// 5. The dialog asks for words; it never fills them in
const modals = read("src/composables/useWorkstationSessionModals.js");
if (/Focus work session/.test(modals)) problems.push("src/composables/useWorkstationSessionModals.js: no invented note when a session is short");
if (!/if \(emptyStopLoggedWords\.value \+ countSessionWords\(note\) < sessionMinWords\) return;/.test(modals)) problems.push("src/composables/useWorkstationSessionModals.js: Save from the dialog needs enough words");
const dialog = read("src/components/dialogs/EmptyStopModal.vue");
if (!/:disabled="!enough"/.test(dialog) || !/aria-describedby="empty-stop-count"/.test(dialog) || !/id="empty-stop-count"[^>]*aria-live="polite"/.test(dialog)) problems.push("src/components/dialogs/EmptyStopModal.vue: Save waits for enough words, and the count is announced and tied to the field");
if (!/label="Keep running" @click="\$emit\('update:modelValue', false\)"/.test(dialog)) problems.push("src/components/dialogs/EmptyStopModal.vue: Keep running closes the dialog and leaves the session running");
if (!/<Button v-if="!loggedWords"[^>]*label="Discard session"/.test(dialog)) problems.push("src/components/dialogs/EmptyStopModal.vue: only a session with nothing written can be discarded here");
if (!/min_session_words: \{\{ min_session_words \| int \}\},/.test(read("omnitrack/www/omnitrack.html"))) problems.push("omnitrack/www/omnitrack.html: the page gets the word minimum from OmniTrack Settings");

if (problems.length) {
  console.error("check_session_lines: " + problems.length + " problem(s)\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("check_session_lines: Stop keeps a refused session, and an older log never replaces a newer one");
