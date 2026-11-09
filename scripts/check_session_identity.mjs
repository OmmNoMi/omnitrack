#!/usr/bin/env node
// A copy of the running session from before its own last change is that session, out of date:
// never "another session from the cloud". Lines added in the first minutes of a session vanished,
// with "Switched to active session from cloud". Keep running (the "still working?" box, or Adjust)
// had moved the start; a poll that left before that save landed brought the copy with the old
// start, was taken for a different session, and its start and empty log replaced the ones here.
// A block bound here, a copy without a block field, and a save the server refused (dropped
// without a word) went down the same path. Drives the real useWorkstationSessionSync against a
// fake server that keeps the stored log the way omnitrack/utils/session_lines.py does:
//   1. The start moved here; an older copy keeps this start and these lines, and goes back up.
//   2. The same, with every save refused: it says so, once a minute, and keeps the lines.
//   3. A block bound here; a copy from before, with no block, is this session's own.
//   4. A copy with no block field is the same block as none, not another session.
//   5. An older copy never puts back an older title.
//   6. A session with a start this page never had is still taken, and said so.
//   7. After a session ends, its starts are forgotten: the next one's older copies are not its.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const { ref } = await import("vue");
globalThis.document = { visibilityState: "visible", activeElement: null };
const { useWorkstationSessionSync } = await import(pathToFileURL(path.join(root, "src/composables/useWorkstationSessionSync.js")).href);
const problems = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HOUR = 3600000;
const SWITCHED = "Switched to active session from cloud";

function rig({ refuse = false } = {}) {
  for (const k of Object.keys(store)) delete store[k];
  let server = null;
  const s = {
    isTracking: ref(false), showInactivityModal: ref(false), startTime: ref(null), trackerSeconds: ref(0), trackerTimer: ref(null),
    trackerNotes: ref(""), selectedNature: ref("Work"), trackerNature: ref("Work"), selectedProject: ref(""), trackerProject: ref(""),
    trackerBlockName: ref(null), sessionNotesList: ref([]), sessionTasks: ref([]), sessionNotesScroll: ref(null), workBlocks: ref([]),
    workFocusBlocks: ref([]), lastActivityTime: ref(0), lastInactivityAlertTime: ref(0), selectedEmployee: ref(""), activeTab: ref("dashboard"),
  };
  const toasts = [];
  const posts = [];
  const sync = useWorkstationSessionSync({
    ...s,
    showToast: (m, kind) => toasts.push({ m, kind }),
    postJSON: async (method, body) => {
      posts.push(body.session_data && JSON.parse(JSON.stringify(body.session_data)));
      if (refuse) throw Object.assign(new Error("Not permitted"), { status: 417 });
      const inc = { ...body.session_data, lastUpdated: Date.now() };
      if (server && server.startTime === inc.startTime && (server.linesRev || 0) > (inc.linesRev || 0)) {
        for (const f of ["trackerNotes", "sessionNotesList", "sessionTasks", "linesRev"]) inc[f] = server[f];
      }
      server = JSON.parse(JSON.stringify(inc));
      return { status: "success" };
    },
    fetchWorkstationData() {}, fetchPlannerData() {}, checkInactivity() {}, checkBlockOverrun() {}, getLocalTodayISO: () => "",
  });
  const start = (ms) => { s.isTracking.value = true; s.startTime.value = ms; sync.setLastLocalUpdate(Date.now()); sync.syncActiveSession(true); };
  const add = (t) => { s.sessionNotesList.value.push(t); sync.syncActiveSession(true); };
  const copy = () => JSON.parse(JSON.stringify(server));
  const switched = () => toasts.some((t) => t.m === SWITCHED);
  const stop = () => { if (s.trackerTimer.value) clearInterval(s.trackerTimer.value); };
  return { s, sync, start, add, copy, toasts, posts, switched, stop, setServer: (v) => { server = v; } };
}
const LINES = ["first point written", "second point written", "third point written"];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. The start moved here (Keep running); a poll from before the lines and the move comes back
{
  const r = rig(); const t0 = Date.now() - 60000;
  r.start(t0); const before = r.copy(); await wait(5);
  LINES.forEach(r.add);
  r.s.startTime.value = t0 - HOUR; r.sync.syncActiveSession(true);
  const sent = r.posts.length;
  r.sync.reconcileActiveSession(before); await wait(5);
  if (!same(r.s.sessionNotesList.value, LINES)) problems.push(`1. the start moved, then an older copy of this session came back: the lines added here must stay (got ${JSON.stringify(r.s.sessionNotesList.value)})`);
  if (r.s.startTime.value !== t0 - HOUR) problems.push("1. an older copy of this session must not put its older start back");
  if (r.switched()) problems.push(`1. an older copy of this session is not "${SWITCHED}"`);
  const last = r.posts[r.posts.length - 1];
  if (r.posts.length === sent || !last || last.startTime !== t0 - HOUR || !same(last.sessionNotesList, LINES)) problems.push("1. this session goes back up when an older copy of it comes in");
  r.sync.restoreActiveSession(before);
  if (!same(r.s.sessionNotesList.value, LINES) || r.s.startTime.value !== t0 - HOUR) problems.push("1. a restore of an older copy of this session (page load path, another tab) keeps the lines and the start here");
  r.stop();
}

// 2. The same, with every save refused: polls bring the server's copy, which has the old start
{
  const r = rig({ refuse: true }); const t0 = Date.now() - 60000;
  r.start(t0); r.setServer({ startTime: t0, sessionNotesList: [], linesRev: 1, status: "active", lastUpdated: t0 });
  const old = r.copy(); await wait(5);
  LINES.slice(0, 2).forEach(r.add);
  r.s.startTime.value = t0 - HOUR; r.sync.syncActiveSession(true); await wait(5);
  r.sync.reconcileActiveSession(old); await wait(5);
  if (!same(r.s.sessionNotesList.value, LINES.slice(0, 2)) || r.s.startTime.value !== t0 - HOUR) problems.push("2. a refused save, then the server's older copy: the lines and the start here must stay");
  const failed = r.toasts.filter((t) => t.kind === "error" && /could not be saved/.test(t.m));
  if (failed.length !== 1) problems.push(`2. a refused save says so (with the server's reason), once a minute, not silently and not on every try (got ${failed.length})`);
  else if (!/Not permitted/.test(failed[0].m)) problems.push("2. the refused-save message names the server's reason");
  r.stop();
}

// 3. A block bound here; a copy from before the binding has no block
{
  const r = rig(); const t0 = Date.now() - 60000;
  r.start(t0); const before = r.copy(); await wait(5);
  r.add(LINES[0]);
  r.s.trackerBlockName.value = "WB-0001"; r.sync.syncActiveSession(true);
  r.sync.reconcileActiveSession(before);
  if (r.s.trackerBlockName.value !== "WB-0001" || !same(r.s.sessionNotesList.value, [LINES[0]]) || r.switched()) problems.push("3. a block bound here, then a copy from before it: the block and the lines here stay, and it is not another session");
  r.stop();
}

// 4. No block field at all is no block
{
  const r = rig(); const t0 = Date.now() - 60000;
  r.start(t0); await wait(5); r.add(LINES[0]); await wait(1300);
  const c = r.copy(); delete c.trackerBlockName;
  r.sync.reconcileActiveSession(c);
  if (r.switched()) problems.push(`4. a copy without a block field is the same session as one with no block, not "${SWITCHED}"`);
  r.stop();
}

// 5. An older copy never puts back an older title
{
  const r = rig(); const t0 = Date.now() - 60000;
  r.s.trackerNotes.value = "Old title"; r.start(t0); const before = r.copy(); await wait(5);
  r.s.trackerNotes.value = "New title"; r.add(LINES[0]); await wait(1300);
  r.sync.reconcileActiveSession(before);
  if (r.s.trackerNotes.value !== "New title") problems.push(`5. an older copy must not put back an older title (got "${r.s.trackerNotes.value}")`);
  r.stop();
}

// 6. A start this page never had: another device started a session, and it is taken
{
  const r = rig(); const t0 = Date.now() - 60000;
  r.start(t0); await wait(5); r.add(LINES[0]);
  const other = { startTime: t0 - 5 * HOUR, sessionNotesList: ["from the other device"], linesRev: 1, status: "active", lastUpdated: Date.now(), trackerBlockName: null };
  r.sync.reconcileActiveSession(other);
  if (r.s.startTime.value !== other.startTime || !same(r.s.sessionNotesList.value, other.sessionNotesList)) problems.push("6. a session this page never had is still taken from the server");
  if (!r.switched()) problems.push(`6. taking another session says so ("${SWITCHED}")`);
  r.stop();
}

// 7. A session ended; the next one's starts are its own, not the last one's
{
  const r = rig(); const t0 = Date.now() - 2 * HOUR;
  r.start(t0); const earlier = r.copy(); await wait(5);
  r.s.isTracking.value = false;
  const t1 = Date.now() - 60000;
  r.s.sessionNotesList.value = []; r.start(t1); await wait(5); r.add(LINES[0]);
  r.sync.reconcileActiveSession(earlier);
  if (r.s.startTime.value !== t0) problems.push("7. once a session ends its starts are forgotten: a copy with one of them is another session to the next one");
  r.stop();
}

if (problems.length) {
  console.error("check_session_identity: " + problems.length + " problem(s)\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("check_session_identity: an older copy of the running session never replaces it, and a refused save is said");
process.exit(0);
