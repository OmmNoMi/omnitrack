#!/usr/bin/env node
// The page always scrolls again once every dialog, drawer and the session popup has closed.
// frappe-ui dialogs (reka) lock <body> and restore whatever body.style.overflow was when they
// opened, so any code of ours that writes overflow on <body> gets its "hidden" put back after it
// unlocks: the page stays frozen (Stop in the 30-minute reminder did this). Only
// src/utils/scrollLock.js touches page overflow, on <html> only, counted per owner.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

// Behaviour, against a minimal document: <html> locks while any owner holds it, <body> is never written.
const style = () => {
  const s = { overflow: "" };
  s.removeProperty = (k) => { s[k] = ""; };
  return s;
};
const html = { style: style() };
const body = { style: new Proxy(style(), { set(t, k, v) { problems.push(`scrollLock wrote body.style.${String(k)}`); t[k] = v; return true; } }) };
globalThis.document = { documentElement: html, body };
const { setScrollLock } = await import("../src/utils/scrollLock.js");
const want = (v, what) => { if (html.style.overflow !== v) problems.push(`${what}: <html> overflow is ${JSON.stringify(html.style.overflow)}, want ${JSON.stringify(v)}`); };
setScrollLock("dialogs", true); want("hidden", "a dialog opens");
setScrollLock("popup", true); want("hidden", "the session popup opens too");
setScrollLock("dialogs", false); want("hidden", "the dialog closes while the popup is still open");
setScrollLock("popup", false); want("", "everything has closed");
setScrollLock("popup", false); want("", "closing twice stays unlocked");

// Nobody else writes page overflow.
const pageOverflow = /\b(?:document\.)?(?:body|documentElement|scrollingElement)\.style\.(?:overflow\w*\s*=(?!=)|removeProperty\(\s*['"]overflow|setProperty\(\s*['"]overflow)/;
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
  if (rel === path.join("src", "utils", "scrollLock.js")) continue;
  fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (pageOverflow.test(line)) problems.push(`${rel}:${i + 1} sets page overflow itself; use setScrollLock(owner, open) from src/utils/scrollLock.js`);
  });
}

// Both lock owners go through it.
const uses = (file, owner) => {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  if (!new RegExp(`setScrollLock\\(\\s*['"]${owner}['"]`).test(src)) problems.push(`${file}: lock the page with setScrollLock('${owner}', …)`);
};
uses("src/composables/useWorkstationEod.js", "workstation-dialogs");
uses("src/composables/useWorkstationPickers.js", "session-popup");

if (problems.length) {
  console.error("FAIL: scroll lock\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("SUCCESS: only scrollLock.js locks the page, on <html>, and it unlocks when the last owner closes.");
