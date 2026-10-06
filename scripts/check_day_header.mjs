#!/usr/bin/env node
// The dashboard names its day once. Line 1 holds the day's name, its block count and the Plan
// action, labelled; line 2 holds the week strip on its own, so on a phone nothing collides.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const problems = [];
const need = (ok, what) => { if (!ok) problems.push(what); };

const sel = read("src/views/dashboard/DashboardDateSelector.vue");
const iSection = sel.indexOf("data-day-section"), iStrip = sel.indexOf("data-day-strip");
need(iSection > 0 && iStrip > iSection, "DashboardDateSelector.vue: the day line comes first, the strip on its own line after it");
const section = sel.slice(iSection, iStrip);
need(/\{\{ dashboardDayTitle \}\}/.test(section), "the day line shows dashboardDayTitle");
need(/<Button[^>]*label="Plan"[^>]*>Plan<\/Button>/.test(section), "the Plan action sits on the day line with a visible label");
need(!/<Button[^>]*label="Plan"/.test(sel.slice(iStrip)), "Plan is not repeated in the strip");
need(/aria-keyshortcuts="Shift\+D"/.test(sel.slice(iStrip)), "the strip keeps its Shift+D shortcut");

const dash = read("src/composables/useWorkstationDashboard.js");
const summary = dash.slice(dash.indexOf("const dashboardDaySummary"), dash.indexOf("});", dash.indexOf("const dashboardDaySummary")));
need(summary.length > 0 && !/toLocaleDateString|weekday|selectedDashboardDate/.test(summary), "the summary under the title never repeats the date");
need(!/selectedDashboardDateLabel/.test(read("src/views/DashboardView.vue")), "DashboardView.vue: the empty state does not name the date again");

if (problems.length) {
  console.error("FAIL: day header\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: the day is named once, Plan sits beside it, and the strip has its own line.");
