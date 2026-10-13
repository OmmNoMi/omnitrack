#!/usr/bin/env node
// Fields that open their own popup are named, start closed, and fill their width.
// - A DatePicker given `label` rendered no label, and one given aria-label or aria-haspopup
//   dropped them too: frappe-ui's DatePicker sets inheritAttrs: false and passes on only class
//   and style. The input had no accessible name. The element around it carries
//   v-input-attrs, which puts aria-label and aria-haspopup on the input itself.
// - FDialog focused the first field when a dialog opened; on a DatePicker that opened its
//   calendar over the form at once (Reschedule). A field marked aria-haspopup is skipped.
// - Escape closed a day calendar, reka gave focus back to its field, and the field opened the
//   calendar again on focus: from the keyboard it could not be closed. While a popover takes an
//   Escape, a field that opens on focus takes focus without opening (quietReopenOnEscape).
// - Outside a dialog, Escape on a day calendar or a time list left focus on the page. The field
//   it belongs to gets focus back (quietReopenOnEscape notes it as it takes focus or is pressed).
// - A TimePicker list is a fixed w-44 and cut "4:45 pm next day (17.5 hrs)" short. It grows.
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
  for (const m of src.matchAll(/<div v-input-attrs="([^"]*)"[^>]*>\s*<(DatePicker|DateTimePicker|DateRangePicker)\b([^>]*)>|<(DatePicker|DateTimePicker|DateRangePicker)\b([^>]*)>/g)) {
    pickers++;
    const rel = path.relative(root, file);
    const name = m[2] || m[4], own = m[3] || m[5] || "", wrap = m[1] || "";
    if (!m[1]) { problems.push(`${rel}: <${name}> sits directly inside <div v-input-attrs="{ 'aria-label': ..., 'aria-haspopup': 'dialog' }">: it drops every attribute but class and style`); continue; }
    if (!/'aria-label': /.test(wrap)) problems.push(`${rel}: <${name}> has no aria-label on its input (v-input-attrs), so it has no name`);
    if (!/'aria-haspopup': 'dialog'/.test(wrap)) problems.push(`${rel}: <${name}> needs 'aria-haspopup': 'dialog' on its input (v-input-attrs), so a dialog does not focus it (and open its calendar) on open`);
    if (/\s:?(aria-label|aria-haspopup|label)=/.test(own)) problems.push(`${rel}: <${name}> drops aria-label, aria-haspopup and label; put them in v-input-attrs`);
  }
  if (/<(DatePicker|DateTimePicker|DateRangePicker)\b/.test(src) && !/directives: \{ inputAttrs: vInputAttrs \}/.test(src)) problems.push(`${path.relative(root, file)}: registers v-input-attrs (directives: { inputAttrs: vInputAttrs })`);
}

const dialog = read("src/components/common/FDialog.vue");
const pop = read("src/utils/popover.js");
if (!/export const opensOnFocus = \(el\) => !!el && el\.tagName === "INPUT" && el\.hasAttribute\("aria-haspopup"\);/.test(pop)) problems.push("src/utils/popover.js: opensOnFocus finds a field that opens a popup when focused");
if (!/const applyInputAttrs = \(el, \{ value \}\) => \{\s*const input = el\.querySelector\("input"\);[\s\S]*?input\.setAttribute\(k, String\(v\)\);[\s\S]*?export const vInputAttrs = \{ mounted: applyInputAttrs, updated: applyInputAttrs \};/.test(pop)) problems.push("src/utils/popover.js: v-input-attrs puts its attributes on the input, on mount and on every update");
if (!/const hushOpener = \(e\) => \{ if \(opensOnFocus\(e\.target\)\) e\.stopImmediatePropagation\(\); \};/.test(pop)) problems.push("src/utils/popover.js: a field that opens on focus can take focus without opening (hushOpener)");
if (!/if \(e\.key !== "Escape" \|\| !popoverOpen\(\)\) return;\s*const field = lastField, from = document\.activeElement;\s*const ours = !!field && \(from === field \|\| !!\(from && from\.closest && from\.closest\(POPUP\)\)\);\s*window\.addEventListener\("focus", hushOpener, true\);/.test(pop)) problems.push("src/utils/popover.js: while a popover takes an Escape, focus coming back to a day field does not open its calendar again");
// Outside a dialog nothing gave focus back: a calendar's Escape left it on the page. The field the
// popup belongs to is noted as it takes focus (capturing focus: a DatePicker's calendar takes focus
// inside the field's own focus handler, before focusin) or is pressed, never from inside a popup.
if (!/const noteField = \(e\) => \{\s*const t = e\.target;\s*if \(!t \|\| !t\.closest \|\| t\.closest\(POPUP\)\) return;\s*const el = t\.closest\(FIELD\);\s*if \(el\) lastField = el;/.test(pop)) problems.push("src/utils/popover.js: noteField keeps the last field pressed or focused outside a popup");
if (!/window\.addEventListener\("focus", noteField, true\);\s*document\.addEventListener\("pointerdown", noteField, true\);/.test(pop)) problems.push("src/utils/popover.js: a field is noted as it takes focus (capturing focus, not focusin) and as it is pressed");
if (!/const now = document\.activeElement;\s*if \(ours && field\.isConnected && \(!now \|\| now === document\.body\)\) focusBack\(field\);/.test(pop)) problems.push("src/utils/popover.js: after Escape closed a list or calendar and focus fell to the page, its field gets focus back");
if (!/setTimeout\(\(\) => \{\s*window\.removeEventListener\("focus", hushOpener, true\);[\s\S]*?if \(ours && now && now\.closest && now\.closest\(POPUP\)\) now\.addEventListener\("focusout", \(\) => setTimeout\(settle\), \{ once: true \}\);\s*else settle\(\);/.test(pop)) problems.push("src/utils/popover.js: focus is given back only once the calendar has let go of it");
if (!/\}, true\);\s*\};\s*\n\/\/ frappe-ui's DatePicker/.test(pop)) problems.push("src/utils/popover.js: quietReopenOnEscape listens in the capture phase, before the calendar closes");
if (!/\nquietReopenOnEscape\(\);\n/.test(read("src/main.js"))) problems.push("src/main.js: quietReopenOnEscape is installed when the app loads");
if (!/import \{ popoverOpen, markDialogEscape, focusBack, opensOnFocus \} from '\.\.\/\.\.\/utils\/popover\.js';/.test(dialog)) problems.push("src/components/common/FDialog.vue: opensOnFocus and focusBack come from utils/popover.js");
if (!/items\.find\(\(el\) => !isClose\(el\) && !isDestructive\(el\) && !opensOnFocus\(el\)\)/.test(dialog)) problems.push("src/components/common/FDialog.vue focusSafe: the first focus skips a field that opens a popup");

const css = read("src/styles/main.css");
if (!/\[data-reka-popper-content-wrapper\] \[role="listbox"\]\.w-44 \{\s*width: max-content;\s*min-width: 11rem;\s*max-width: calc\(100vw - 1\.5rem\);/.test(css)) problems.push("src/styles/main.css: a TimePicker list grows to its longest option, so an end time's length is never cut off");
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
