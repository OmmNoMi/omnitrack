#!/usr/bin/env node
// A menu's icons tell its items apart at a glance. Two items with the same picture, or two of
// Feather's near twins (edit-2 and edit-3, trash and trash-2), read as one action said twice:
// "Edit block" and "Add work session" both drew a pencil. Every item in a menu gets its own icon
// family, and adding a work session draws the Work Session kind's own icon.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const family = (icon) => icon.replace(/-\d+$/, "");

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(vue|js)$/.test(e.name)) check(p);
  }
}
// Menus live one to a file here, so a file's labelled items are one menu's items. A label that
// switches its own icon (Light Mode / Dark Mode) is one item.
function check(file) {
  const src = fs.readFileSync(file, "utf8");
  const seen = new Map();
  for (const m of src.matchAll(/label: (['"])([^'"]+)\1, icon: (['"])([\w-]+)\3/g)) {
    const [label, icon] = [m[2], m[4]];
    const f = family(icon);
    const other = seen.get(f);
    if (other && other.label !== label) problems.push(`${path.relative(root, file)}: "${other.label}" (${other.icon}) and "${label}" (${icon}) look alike; give each its own icon`);
    else seen.set(f, { label, icon });
  }
}
walk(path.join(root, "src"));

const block = fs.readFileSync(path.join(root, "src/drawers/BlockDetailDrawer.vue"), "utf8");
const kind = fs.readFileSync(path.join(root, "src/components/common/DetailKind.vue"), "utf8");
const sessionIcon = (kind.match(/session: \{ icon: '([\w-]+)'/) || [])[1];
if (!sessionIcon || !block.includes(`label: 'Add work session', icon: '${sessionIcon}'`)) problems.push("src/drawers/BlockDetailDrawer.vue: Add work session draws the Work Session kind's icon");

if (problems.length) {
  console.error("FAIL: menu icons:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("OK: every menu item has its own icon");
