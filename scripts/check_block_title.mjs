#!/usr/bin/env node
// A block is called by the title its owner typed, everywhere. The plan dialog's Title is saved as
// work_item_label (served as task_subject); a picked or new task only names a block that has no
// title. Every screen reads the name through src/utils/blockTitle.js, so no view can fall back to
// the first task's subject or the output notes on its own.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockTitle } from "../src/utils/blockTitle.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const eq = (got, want, what) => { if (got !== want) problems.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };

eq(blockTitle({ task_subject: "Notification test", deliverable_notes: "Check the bell" }), "Notification test", "the served title wins");
eq(blockTitle({ work_item_label: "Client call" }), "Client call", "the stored label names the block when nothing is served");
eq(blockTitle({ deliverable_notes: "\n  Write the brief \nthen send it" }), "Write the brief", "with no title, the first line of the notes");
eq(blockTitle({}), "Work block", "with nothing at all, the fallback");
eq(blockTitle({ task_subject: "   " }, "Focus block"), "Focus block", "a blank title is no title");
eq(blockTitle(null, ""), "", "no block, the given fallback");

// No screen builds its own title chain.
const chain = /\b(?:task_subject|work_item_label)\s*\|\|\s*[\w.]*\b(?:task_subject|work_item_label|deliverable_notes)\b|\bdeliverable_notes\s*\|\|\s*[\w.]*\btask_subject\b/;
const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (/\.(vue|js)$/.test(e.name)) o.push(p);
  }
  return o;
};
for (const file of walk(path.join(root, "src"))) {
  const rel = path.relative(root, file);
  if (rel === path.join("src", "utils", "blockTitle.js")) continue;
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (chain.test(line)) problems.push(`${rel}:${i + 1} builds its own block title; use blockTitle(b) from src/utils/blockTitle.js`);
  });
}

// The plan dialog: the typed Title is the block's name; the picked task only fills in for it.
const store = fs.readFileSync(path.join(root, "src/stores/workBlockStore.js"), "utf8");
if (!/work_item_label:\s*notes\s*\|\|/.test(store)) problems.push("workBlockStore.js: book the block with work_item_label = the typed Title first (notes ||)");
// The server keeps that title when a new task is created alongside it.
const planner = fs.readFileSync(path.join(root, "omnitrack/api/planner.py"), "utf8");
if (!/if not refs and not work_item_label:\s*\n\s*work_item_label = /.test(planner)) problems.push("planner.py book_work_block: a new task must not overwrite a typed title");

if (problems.length) {
  console.error("FAIL: block titles\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: every screen names a block by its typed title, through blockTitle().");
