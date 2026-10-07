#!/usr/bin/env node
// Time away is planned like any other block: it keeps the start and end the person picked and
// sits on the calendar at those times, where it can be clicked and edited. It used to be saved as
// 09:00-18:00 whatever was picked, drawn in an "All day" row above the grid, and shaded across
// office hours with a band clicks fell through, so 11:00-15:00 away read as a whole day off.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const problems = [];

// Saving sends the picked times, for every kind of time, and checks them the same way.
const store = read("src/stores/workBlockStore.js");
const submit = store.slice(store.indexOf("const submitBooking"), store.indexOf("showBookModal.value = false", store.indexOf("const submitBooking")));
if (!/\bstart_time:\s*f\.start_time\s*,/.test(submit) || !/\bend_time:\s*f\.end_time\s*,/.test(submit))
  problems.push("src/stores/workBlockStore.js submitBooking: send start_time: f.start_time and end_time: f.end_time, never fixed hours");
if (/\d\d:\d\d['"]/.test(submit)) problems.push("src/stores/workBlockStore.js submitBooking: a fixed clock time is sent; use the times the person picked");
if (/!isAway\s*&&\s*(?:\(\s*!f\.start_time|f\.end_time\s*<=|spanMins)/.test(submit)) problems.push("src/stores/workBlockStore.js submitBooking: away skips the start/end checks; check its times like any block");

// The dialog asks for times for away too, and will not save away without them.
const dialog = read("src/components/dialogs/PlanWorkBlockDialog.vue");
if (/all-?day/i.test(dialog)) problems.push("src/components/dialogs/PlanWorkBlockDialog.vue: away hides the times; it must ask for them");
const canSave = dialog.slice(dialog.indexOf("canSave()"), dialog.indexOf("},", dialog.indexOf("canSave()")));
if (/mode\s*===\s*["']away["']\)\s*return\s+true/.test(canSave) || !/durationMins\s*<=\s*0\)\s*return\s+false/.test(canSave))
  problems.push("src/components/dialogs/PlanWorkBlockDialog.vue canSave: every kind of time needs an end after its start");
if (/allDay|All day/.test(read("src/components/common/DayTimeFields.vue")))
  problems.push("src/components/common/DayTimeFields.vue: no all-day mode; every plan has a start and an end");

// The calendar draws away at its own times, as a block, with nothing above the grid.
const layout = read("src/composables/useWorkstationPlannerLayout.js");
const timed = layout.slice(layout.indexOf("const timedSegmentsForDay"), layout.indexOf("for (const b of blocks)", layout.indexOf("const timedSegmentsForDay")) + 400);
if (/is_away\b[^\n]*continue/.test(timed)) problems.push("src/composables/useWorkstationPlannerLayout.js timedSegmentsForDay: away blocks are skipped; draw them at their times");
const grid = read("src/views/calendar/CalendarPlannerGrid.vue");
if (/All day|awayBlocksForDay|officeBandStyle/.test(grid))
  problems.push("src/views/calendar/CalendarPlannerGrid.vue: away is drawn as an all-day row or office-hours band; it is a timed block");

// Away is not work: its sheet and card offer no tasks, sessions or hours worked.
const sheet = read("src/drawers/BlockDetailDrawer.vue");
if (!/<BlockTasksSection v-if="!inline && !block\.is_away"/.test(sheet)) problems.push("src/drawers/BlockDetailDrawer.vue: time away lists no tasks");
if (!/<section v-if="!block\.is_away \|\| sessions\.length"[^>]*aria-labelledby="block-drawer-time"/.test(sheet)) problems.push("src/drawers/BlockDetailDrawer.vue: time away shows no Time section unless something was logged on it");
if (!/if \(!b\.is_away && this\.canLogTimesheet\(b\)\)/.test(sheet)) problems.push("src/drawers/BlockDetailDrawer.vue: time away offers no Add work session");
if (!/return !b\.is_away && !this\.isBlockCompleted\(b\)/.test(sheet)) problems.push("src/drawers/BlockDetailDrawer.vue: time away offers no Start session");
if (!/const hours = time && lines >= 4 && !seg\.block\.is_away;/.test(grid)) problems.push("src/views/calendar/CalendarPlannerGrid.vue: an away card shows no hours-worked line");

if (problems.length) {
  console.error("FAIL: away is timed\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: away keeps its picked times and sits on the calendar at them as a clickable block.");
