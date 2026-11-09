#!/usr/bin/env node
// Hours is the one page for logged time: everyone's hours for a period, and, for a reviewer,
// each entry approved or flagged in place. The Team page it replaced must not come back, and
// an old link to it lands on Hours. The server sends each entry's own times and review state.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (ok, what) => { if (!ok) problems.push(what); };

// One page: no Team tab, and its old address goes to Hours
need(!fs.existsSync(path.join(root, "src/views/AttendanceView.vue")), "AttendanceView.vue is gone: Hours is the review page");
for (const f of ["src/main.js", "src/App.vue", "src/router/index.js", "src/components/layout/WorkstationBottomNav.vue"]) {
  need(!/AttendanceView|'attendance'\)|activeTab === 'attendance'/.test(read(f)), `${f}: no Team tab`);
}
need(/\{ path: '\/attendance', redirect: '\/timesheets' \}/.test(read("src/router/index.js")), "router: /attendance redirects to /timesheets");
need(/if \(raw === 'attendance'\) return 'timesheets';/.test(read("src/composables/useWorkstationShell.js")), "useWorkstationShell: #/attendance opens Hours");
// TimeLog is built from what the app already has: ChoiceChips for the period, frappe-ui's
// DatePicker for a range, and the entry sheet (SessionDetailDrawer) for approve, flag, edit and
// delete. It never grows its own copy of those (a radiogroup, a native date input, an inline form).
const view = read("src/views/TimesheetsView.vue");
// What the view works out without itself (its days, its plan, its waiting range)
const tl = read("src/utils/timeLog.js");
need(/this\.approveBlocks\(list,/.test(view), "TimesheetsView: Approve all uses approveBlocks, so one Undo covers them");
need(/reviewRev\(\) \{ this\.loadHours\(\); \}/.test(view), "TimesheetsView: an approve, flag or undo reloads the hours");
need(/canReview\(e\) \{ return this\.hours && this\.hours\.can_review_team && e\.review !== 'approved' && !e\.recording; \}/.test(view), "TimesheetsView: only a reviewer approves, never approved or running entries");
need(!/flagged_reason|window\.prompt/.test(view), "TimesheetsView: the flag reason is approval_notes, never a prompt()");
need(!/quickFlagBlock|update_work_session|type="time"|data-flag-btn|data-edit-btn/.test(view), "TimesheetsView: no inline flag or time-edit form; the entry sheet has them");
need(/@click="openEntry\(p, r\)"/.test(view), "TimesheetsView: an entry's row opens it");
need(/this\.openSessionDrawer\(this\.sheetBlock\(p, r\.e\), \{ name: s\.name, session_date: s\.date, from_time: s\.from_time, to_time: s\.to_time, hours: s\.hours \}\);/.test(view), "TimesheetsView: a row opens the entry sheet on that session");
need(/approval_status: REVIEW_STATUS\[e\.review\] \|\| ''/.test(tl) && /employee: p\.user,/.test(tl) && /work_date: e\.work_date,/.test(tl), "TimesheetsView: the sheet is handed the block's owner, day and approval, so its Approve and Edit show right");
// An edit or a delete in the sheet does not bump reviewRev (afterSave only refreshes the planner)
need(/sheetOpen\(\) \{ return !!\(this\.showSessionDrawer \|\| this\.showEditSessionModal \|\| this\.deleteEntry \|\| this\.showBlockDrawer\); \}/.test(view), "TimesheetsView: knows when any of the entry's sheets or dialogs is open");
need(/sheetOpen\(open\) \{\s*if \(open \|\| !this\.sheetFrom\) return;\s*this\.sheetFrom = false;\s*this\.loadHours\(\);/.test(view), "TimesheetsView: reads the hours again once the sheet it opened closes");
need(/openEntry\(p, r\) \{\s*this\.sheetFrom = true;/.test(view), "TimesheetsView: remembers it opened the sheet");
for (const n of ["openSessionDrawer", "showSessionDrawer", "showEditSessionModal", "showBlockDrawer", "deleteEntry"]) need(view.includes(`'${n}'`), `TimesheetsView: reads ${n} from the workstation`);
// The rows are one tab stop; arrows move
need(/:tabindex="r\.i === rowStop\(p\) \? 0 : -1"/.test(view), "TimesheetsView: only one entry row per person is a tab stop");
need(/ev\.key === 'ArrowDown'/.test(view) && /ev\.key === 'ArrowUp'/.test(view) && /ev\.key === 'Home'/.test(view) && /ev\.key === 'End'/.test(view) && /rows\[to\]\.focus\(\);/.test(view), "TimesheetsView: Up, Down, Home and End move between entries");
need(/placeFocus\(\) \{[\s\S]*?if \(!want \|\| this\.sheetOpen\) return;[\s\S]*?\[data-session="\$\{CSS\.escape\(want\.session\)\}"\]/.test(view) && /:data-session="r\.s\.name"/.test(view), "TimesheetsView: after a reload, focus goes back to the entry's row");

// Periods: Today, Week, Month, or a Range (last month by default, for payroll on the 1st).
// No "All": thousands of entries in one read. A range the server would refuse is never sent.
need(!/\{ id: 'all'/.test(view) && /\{ id: 'range', label: 'Range' \}/.test(view), "TimesheetsView: a Range replaces All");
need(/from: ymd\(new Date\(now\.getFullYear\(\), now\.getMonth\(\) - 1, 1\)\),\s*to: ymd\(new Date\(now\.getFullYear\(\), now\.getMonth\(\), 0\)\)/.test(tl), "TimesheetsView: a Range opens on last month");
need(/rangeFrom: lastMonth\(\)\.from,/.test(view) && /rangeTo: lastMonth\(\)\.to,/.test(view), "TimesheetsView: the range starts as last month");
need(/if \(from > to\) return/.test(tl), "TimesheetsView: a backwards range is explained, not sent");
need(/if \(days > maxDays\) return/.test(tl), "TimesheetsView: a range over the server's limit is explained, not sent");
need(/if \(this\.rangeError\) \{ this\.hours = null;/.test(view), "TimesheetsView: nothing is asked of the server for a range it would refuse");
need(/rangeFrom\(\) \{ this\.loadHours\(\); \},/.test(view) && /rangeTo\(\) \{ this\.loadHours\(\); \},/.test(view), "TimesheetsView: changing a date reads the hours again");
need(/<ChoiceChips :options="periodOptions" :model-value="timesheetHorizon" aria-label="Period"/.test(view) && /components: \{ ChoiceChips \}/.test(view), "TimesheetsView: the period is the app's ChoiceChips (arrows, Home and End are its own)");
need(!/role="radiogroup"|onPeriodKey/.test(view), "TimesheetsView: no second radiogroup of its own");
need(!/<input[^>]*type="date"|v-model\.lazy="range/.test(view) && /<DatePicker variant="outline" :model-value="\$data\[f\.key\]"/.test(view), "TimesheetsView: the range uses frappe-ui's DatePicker, not the browser's date input");
need(/\{ key: 'rangeFrom', label: 'From' \}, \{ key: 'rangeTo', label: 'To' \}/.test(view) && /aria-hidden="true">\{\{ f\.label \}\}<\/span>/.test(view), "TimesheetsView: each date has a visible label, From and To");
need(/'aria-invalid': rangeError \? 'true' : null, 'aria-describedby': rangeError \? 'hours-range-error' : null/.test(view) && /id="hours-range-error" role="alert"/.test(view), "TimesheetsView: the range problem is announced and tied to the dates");
const maxView = (view.match(/maxDays: (\d+)/) || [])[1];
const maxServer = (read("omnitrack/api/team_hours.py").match(/MAX_DAYS = (\d+)/) || [])[1];
need(maxView && maxView === maxServer, `TimesheetsView: maxDays (${maxView}) matches team_hours.MAX_DAYS (${maxServer})`);

// The page is called TimeLog. Sessions sit under one heading per day, so a date is said once,
// and each session's time is said once, in its own row
need(/id="timesheets-heading"[^>]*>TimeLog<\/h2>/.test(view), "TimesheetsView: the page is called TimeLog");
need(/v-for="g in layout\[p\.user\]"/.test(view) && /v-for="r in g\.rows"/.test(view), "TimesheetsView: entries are listed under their day");
need(!/(shortDate|longDay)\([\w.]*work_date\)|spans\(/.test(view), "TimesheetsView: an entry repeats neither its day's date nor all its times");
need(/<h4 :id="dayId\(p, g\.date\)"/.test(view) && /:aria-labelledby="dayId\(p, g\.date\)"/.test(view), "TimesheetsView: each day's list is named by its date heading");
need(/e\.sessions\.forEach\(\(s\) => add\(s\.date,/.test(tl) && /\[\.\.\.byDate\.keys\(\)\]\.sort\(\)\.reverse\(\)/.test(tl), "TimesheetsView: a session sits on the day it was worked, newest day first");
need(/\.sort\(\(a, b\) => \(a\.from < b\.from \? -1/.test(tl), "TimesheetsView: within a day, as the day went");
// Quiet by default: the state is a dot and a word, not a coloured pill
need(!/<Badge/.test(view) && /\{\{ status\(r\.e\)\.label \}\}/.test(view), "TimesheetsView: an entry's state is a dot and a word, not a pill");


const eod = read("src/composables/useWorkstationEod.js");
need(!/window\.prompt/.test(eod), "useWorkstationEod: no prompt() for a flag reason");
need(/reviewRev\.value \+= 1/.test(eod.slice(eod.indexOf("const refreshReviews"), eod.indexOf("const UNDO_APPROVAL_MS"))), "useWorkstationEod: every review bumps reviewRev");

// The server sends each entry with its times and review state
const py = read("omnitrack/api/team_hours.py");
need(/"from_time": time_str\(/.test(py) && /"to_time": time_str\(/.test(py), "team_hours: each entry carries its session times");
need(/"approval_notes": \(b\.approval_notes or ""\) if review == "flagged" else ""/.test(py), "team_hours: a flag's reason is sent only on a flagged entry");
need(/e\["recording"\] = bool\(running\) and e\["name"\] == running/.test(py), "team_hours: the running block is marked, so it is not offered for approval");
// Every field an entry sends is read: a field get_all was not asked for comes back None
const blockFields = (py.match(/"Planned Work Block",\s*filters=filters,\s*fields=\[([\s\S]*?)\],/) || [])[1] || "";
for (const f of ["work_item_label", "deliverable_notes", "approval_notes"]) need(blockFields.includes(`"${f}"`), `team_hours: blocks are read with ${f}`);
const sessionFields = (py.match(/"OmniTrack Work Session",[\s\S]*?fields=\[([^\]]*)\]/) || [])[1] || "";
for (const f of ["name", "from_time", "to_time", "notes"]) need(sessionFields.includes(`"${f}"`), `team_hours: sessions are read with ${f}`);
// Each row says what was done in that time, not only the entry's title
need(/"notes": \(s\.notes or ""\)\[:NOTES_CHARS\]/.test(py), "team_hours: each session carries its notes");
need(/noteOf\(s, e\) \{ return noteLines\(s\.notes, blockTitle\(e\)\)/.test(view) && /noteOf: this\.noteOf/.test(view) && /note: noteOf\(s, e\)/.test(tl), "TimesheetsView: a row's description is its session's notes, read with noteLines");
need(/<span v-if="r\.note" data-note class="[^"]*line-clamp-2[^"]*"[^>]*>\{\{ r\.note \}\}<\/span>/.test(view), "TimesheetsView: the row shows its description, two lines at most");
need(/\{\s*"name": s\.name, "date": d,/.test(py), "team_hours: each session carries its name, so it can be edited");
need(/"can_edit_times": can_change_others_time\(user\),/.test(py), "team_hours: says whether this person may change times, as update_work_session decides");
need(/if approval_status in \("Flagged", "Rejected"\):\s*return "flagged"/.test(py), "team_hours: Rejected counts as flagged");
const ts = read("omnitrack/api/timesheet.py");
const updateSession = ts.slice(ts.indexOf("def update_work_session"), ts.indexOf("def delete_work_session"));
need(/_require_time_owner\(doc\)/.test(updateSession) && /if doc\.employee != frappe\.session\.user and not can_change_others_time\(\):/.test(ts), "update_work_session: only the owner or an OmniTrack Manager or Admin changes a session");
const pending = ts.slice(ts.indexOf("def get_pending_team_approvals"), ts.indexOf("\ndef ", ts.indexOf("def get_pending_team_approvals") + 10));
need(/filters\["employee"\] = _resolve_planner_user\(employee\)/.test(pending), "get_pending_team_approvals: a name is resolved to the person's email");

// Who is waiting, on any day: a manager sees the team, anyone else only their own time
const waiting = py.slice(py.indexOf("def _waiting("), py.indexOf("@frappe.whitelist()", py.indexOf("def _waiting(")));
need(/"waiting": _waiting\(user, everyone[^)]*\),/.test(py), "team_hours: the reply says what is waiting, on any day");
need(/if not everyone:\n\t\tq = q\.where\(pwb\.employee == user\)/.test(waiting), "team_hours: someone who does not review sees only their own waiting time");
need(/Coalesce\(pwb\.approval_status, ""\) != "Approved"/.test(waiting) && /pwb\.actual_hours > 0/.test(waiting), "team_hours: waiting is logged time not approved yet");
need(/if is_away\(r\.task_nature\):\n\t\t\tcontinue/.test(waiting), "team_hours: break and away time is never waiting for approval");
need(/out\.sort\(key=lambda w: \(not w\["flagged"\], w\["oldest"\]/.test(waiting), "team_hours: flagged time is listed first, then whoever waited longest");
need(/out\.sort\(key=lambda p: \(not \(p\["awaiting"\] or p\["flagged"\]\), -p\["worked"\]/.test(py), "team_hours: people with time to review come first");
need(/<div v-if="hours && hours\.waiting" data-waiting/.test(view), "TimesheetsView: the page says what is waiting");
need(/hours\.can_review_team \? 'Nothing is waiting for your review\.' : 'All your logged time is approved\.'/.test(view), "TimesheetsView: an empty waiting list is said for who is reading");
need(/mine \? ' flagged for you to fix' : ' flagged'/.test(tl) && /mine \? ' waiting for approval' : ' to review'/.test(tl) && /waitingMarks\(w, !this\.hours\.can_review_team\)/.test(view), "TimesheetsView: waiting time is worded for its owner or for the manager");
need(/<Button v-if="!hours\.can_review_team && waitingOutside"[^>]*@click="showWaiting\(\)"/.test(view), "TimesheetsView: waiting time outside the period can be shown");
need(/this\.focusAfterLoad = \{ person, open: true \};[\s\S]*?this\.timesheetHorizon = 'range';\s*this\.rangeFrom = w\.from;\s*this\.rangeTo = w\.to;/.test(view), "TimesheetsView: showing waiting time reads its days and opens whoever comes first");
need(/if \(want && people\.some\(\(p\) => p\.user === want\)\) this\.openPerson = want;/.test(view), "TimesheetsView: the person asked for is opened once read");
need(/end\.getDate\(\) - \(maxDays - 1\)/.test(tl) && /spanOf\(ws, this\.maxDays\)/.test(view), "TimesheetsView: the waiting range stays within the longest period the server reads");

// A sheet that closes itself says why, or a click looks like it did nothing
const drawer = read("src/drawers/SessionDetailDrawer.vue");
need(/this\.\$emit\('close'\);\s*this\.showToast\('This entry no longer exists\./.test(drawer), "SessionDetailDrawer: closing on a missing entry says why");

// Days not logged, planned against worked, what to look at twice, approving by day or by pick
need(/for \(const d of p\.not_logged \|\| \[\]\) if \(!byDate\.has\(d\)\) byDate\.set\(d, \[\]\);/.test(tl), "TimeLog: a working day with nothing logged is a day of its own");
need(/<div v-if="g\.missing" data-not-logged/.test(view) && /<ul v-else :aria-labelledby="dayId\(p, g\.date\)">/.test(view), "TimeLog: a day with nothing logged says so instead of an empty list");
need(/return p\.user === this\.currentUser && !logDayRefusal\(d, \{ daysBack: h\.log_days_back, payrollClosedThrough: h\.payroll_closed_through, isManager: h\.log_any_day \}\);/.test(view), "TimeLog: Log time is offered only on the viewer's own day, and only a day the entry box would take");
need(/<Button v-if="canLogDay\(p, g\.date\)"[^>]*@click="logDay\(p, g\.date\)"/.test(view) && /this\.quickLogTimelineGap\(logDayTimes\(d\)\);/.test(view), "TimeLog: Log time opens the one entry box on that day");
need(/planned: Number\(plannedOn\[date\] \|\| 0\),/.test(tl) && /fmt\(g\.total\) \+ 'h of ' \+ fmt\(g\.planned\) \+ 'h planned' \+ off/.test(tl), "TimeLog: a day says its worked time against what was planned ahead");
need(/fmt\(p\.planned\) \+ 'h planned ahead'/.test(tl) && /if \(p\.unplanned\) parts\.push/.test(tl), "TimeLog: a person's line says planned-ahead and unplanned time apart");
need(/if work_date in in_range and not b\.unplanned and b\.status not in NOT_PLANNED and not is_away\(b\.task_nature\):\n\t\t\tp\["planned"\] \+= flt\(b\.duration_hours\)\n\t\t\tp\["planned_by_day"\]\[work_date\]/.test(py) && /if b\.unplanned:\n\t\t\tp\["unplanned"\] \+= hours/.test(py), "team_hours: planned-ahead time is counted per day, apart from unplanned");
need(/if \(end > from\) r\.checks\.push\('Overlaps the entry before'\);/.test(tl) && /> 10\) r\.checks\.push\('Over 10 hours'\);/.test(tl) && /r\.checks\.push\('No description'\);/.test(tl), "TimeLog: overlapping, over-10-hour and undescribed sessions are marked");
need(/<span v-if="r\.checks\.length" data-check/.test(view), "TimeLog: a row says what to check on it");
need(/v-if="hours\.can_review_team && dayApprovable\(g\)\.length"[^>]*@click="approveDay\(p, g\)"/.test(view), "TimeLog: a reviewer approves a day at once");
need(/else if \(ev\.key === ' ' \|\| ev\.key === 'Spacebar'\) \{[\s\S]*?if \(!r \|\| !this\.pickable\(r\)\) return;\s*ev\.preventDefault\(\);\s*this\.togglePick\(r\.e\);/.test(view), "TimeLog: Space on a row picks it to approve with others");
need(/@click="approveSelected\(p\)"/.test(view) && /approveSelected\(p\) \{ return this\.approve\(p, this\.picked\(p\),/.test(view), "TimeLog: the picked entries are approved together");
need(/pickable\(r\) \{ return !!\(r\.s && this\.canReview\(r\.e\)\); \}/.test(view), "TimeLog: only entries still to approve can be picked");
need(/closed: !!closedThrough && date <= closedThrough,/.test(tl) && /v-if="g\.closed"[^>]*>\{\{ ' ' \}\}· Payroll closed/.test(view), "TimeLog: a day payroll has closed says so");
need(/if \(w\.closed\) out\.push/.test(tl) && /closed_hours|"closed":/.test(py), "TimeLog: waiting time on a closed payroll day is warned about");
need(/v-if="hours && hours\.can_review_team && hours\.totals/.test(view) && /fmt\(t\.approved\) \+ 'h approved', fmt\(waiting\) \+ 'h waiting'/.test(tl), "TimeLog: a reviewer sees the team's totals, approved against waiting");
need(/<button\s+v-if="hours\.can_review_team"\s+type="button"\s+:data-wait="i"[\s\S]*?@click="showWaiting\(w\)"/.test(view), "TimeLog: a waiting name opens that person");
need(/w\.awaiting_entries != null/.test(tl), "TimeLog: the waiting list counts entries, so its numbers are not the person line's hours again");

// Changing someone's time is an OmniTrack Manager's or Admin's; HR reviews only
const perms = read("omnitrack/permissions.py");
need(/TIME_EDITOR_ROLES = \{"OmniTrack Manager", "OmniTrack Admin"\}/.test(perms), "permissions: only OmniTrack Manager and Admin change someone else's times");
need(/mayChange\(\) \{ return this\.mine \|\| !!this\.canChangeTimes; \}/.test(drawer) && /this\.mayChange && this\.canLogTimesheet\(b\)/.test(drawer), "SessionDetailDrawer: Edit is offered on someone else's entry only to who may change times");
need(/<p v-if="othersLocked" data-times-locked/.test(drawer), "SessionDetailDrawer: a reviewer who may not change times is told so");

// A flagged entry, fixed, goes back for review
const sendBack = ts.slice(ts.indexOf("def send_back_for_review"), ts.indexOf("@frappe.whitelist()", ts.indexOf("def send_back_for_review")));
need(/_require_time_owner\(b_doc\)/.test(sendBack) && /if b_doc\.approval_status not in \("Flagged", "Rejected"\):/.test(sendBack) && /b_doc\.approval_status = "Pending Approval"/.test(sendBack), "send_back_for_review: only a flagged entry, by who may change it, goes back to waiting");
need(/canSendBack\(\) \{ return !!this\.session\.name && this\.mayChange && \['Flagged', 'Rejected'\]\.includes/.test(drawer) && /postJSON\('send_back_for_review'/.test(read("src/composables/useWorkstationEod.js")), "SessionDetailDrawer: a flagged entry can be sent back for review");

if (problems.length) {
  console.error("FAIL: Hours review\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: TimeLog is the one review page, built on ChoiceChips, the DatePicker and the entry sheet; Team redirects there, a Range replaces All, and sessions are grouped by day.");
