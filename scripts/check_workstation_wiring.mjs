#!/usr/bin/env node
// The workstation composables share one object, w: each publishes names with Object.assign(w, {...})
// or w.name = ..., and reads others with const { ... } = w. A name read but never published is
// undefined at run time, and calling it throws (an alert that never shows). Every name read from w
// must be published by some composable or by the page that creates w.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|vue)$/.test(e.name)) files.push(p); } };
walk(path.join(root, "src"));

const published = new Set();
const reads = [];
const body = (src, open) => { let depth = 0; for (let i = open; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}" && --depth === 0) return src.slice(open + 1, i); } return ""; };
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/Object\.assign\(\s*w\s*,\s*\{/g)) {
    const b = body(src, m.index + m[0].length - 1).replace(/\/\/[^\n]*/g, "");
    let depth = 0, top = "";
    for (const ch of b) { if ("{([".includes(ch)) depth++; else if ("})]".includes(ch)) depth--; else if (depth === 0) top += ch; }
    for (const part of top.split(",")) { const n = part.trim().match(/^(?:async\s+)?([A-Za-z_$][\w$]*)/); if (n) published.add(n[1]); }
  }
  for (const m of src.matchAll(/\bw\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) published.add(m[1]);
  for (const m of src.matchAll(/const\s*\{([^}]*)\}\s*=\s*w\s*;/g)) {
    for (const n of m[1].split(",").map((s) => s.trim().split(":")[0].trim()).filter(Boolean)) reads.push([path.relative(root, f), n]);
  }
}
const problems = reads.filter(([, n]) => !published.has(n)).map(([f, n]) => `${f}: reads ${n} from w, which no composable publishes`);
if (problems.length) {
  console.error("FAIL: workstation wiring\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`SUCCESS: all ${reads.length} names read from w are published (${published.size} published).`);
