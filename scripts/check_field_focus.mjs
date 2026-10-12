#!/usr/bin/env node
// Fields that open their own popup are named, start closed, and fill their width.
// - A DatePicker given `label` rendered no label: the prop fell through as an attribute, so
//   the input had no accessible name. It takes aria-label (the visible label stays as text).
// - FDialog focused the first field when a dialog opened; on a DatePicker that opened its
//   calendar over the form at once (Reschedule). A field marked aria-haspopup is skipped.
// - frappe-ui's Combobox trigger is inline-flex, so it shrank to its text and cut a long
//   name short ("Nomeshwer Sharma (") inside a wider column. It fills its container.
// - A component's $el is not always an element: frappe-ui's Button can root on a text or
//   fragment node, so `this.$refs.keepBtn.$el.focus()` threw "e.focus is not a function" and
//   focus fell to <body>. Focus an element found by querySelector (a data- attribute), never $el.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const walk = (d, o = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (e.name.endsWith(".vue")) o.push(p);
  }
  return o;
};
const problems = [];

let pickers = 0;
for (const file of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/<(DatePicker|DateTimePicker|DateRangePicker)\b([^>]*)>/g)) {
    pickers++;
    const rel = path.relative(root, file);
    if (!/\s:?aria-label=/.test(m[2])) problems.push(`${rel}: <${m[1]}> has no aria-label, so its input has no name`);
    if (/\s:?label=/.test(m[2])) problems.push(`${rel}: <${m[1]}> label is not rendered; use aria-label and a visible label beside it`);
    if (!/\saria-haspopup="dialog"/.test(m[2])) problems.push(`${rel}: <${m[1]}> needs aria-haspopup="dialog", so a dialog does not focus it (and open its calendar) on open`);
  }
}

const dialog = read("src/components/common/FDialog.vue");
if (!/const opensOnFocus = \(el\) => el\.tagName === 'INPUT' && el\.hasAttribute\('aria-haspopup'\);/.test(dialog)) problems.push("src/components/common/FDialog.vue: opensOnFocus finds a field that opens a popup when focused");
if (!/items\.find\(\(el\) => !isClose\(el\) && !isDestructive\(el\) && !opensOnFocus\(el\)\)/.test(dialog)) problems.push("src/components/common/FDialog.vue focusSafe: the first focus skips a field that opens a popup");

const css = read("src/styles/main.css");
if (!/\[data-slot="trigger"\]:has\(> input\[role="combobox"\]\) \{ display: flex; width: 100%; \}/.test(css)) problems.push("src/styles/main.css: a Combobox trigger fills its container (display: flex; width: 100%)");

// A $el is never focused itself, directly or through a variable it was put in
const sources = [];
const walkAll = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walkAll(p); else if (/\.(vue|js)$/.test(e.name)) sources.push(p); } };
walkAll(path.join(root, "src"));
for (const file of sources) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  if (/\.\$el\??\.focus\(/.test(src)) problems.push(`${rel}: focuses a component's $el; focus the element itself (querySelector a data- attribute)`);
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*[^;\n]*\.\$el\b[^;\n]*;([\s\S]{0,240})/g)) {
    if (/querySelector/.test(m[0].slice(0, m[0].indexOf(";")))) continue; // an element found inside it
    if (new RegExp(`\\b${m[1]}\\??\\.focus\\(`).test(m[2])) problems.push(`${rel}: focuses a component's $el (${m[1]}); focus the element itself (querySelector a data- attribute)`);
  }
}

if (problems.length) {
  console.error("FAIL: field focus and width\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`SUCCESS: ${pickers} date pickers are named and start closed; Combobox triggers fill their width.`);
