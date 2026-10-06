#!/usr/bin/env node
/**
 * Static check: every component a template resolves at runtime is registered.
 * A production Vue build renders an unregistered <f-button> as an inert custom
 * element with NO warning, so this is the only place that regression is caught
 * deterministically (the jsdom smoke test only sees what its fixtures render).
 * Resolution sources: app.component(...) in src/main.js, the SFC's own
 * `components: {}` option, or a <script setup> import.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parse, compileTemplate } = require('@vue/compiler-sfc');

const src = path.resolve(__dirname, '..', 'src');
const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const pascal = (s) => { const c = camel(s); return c[0].toUpperCase() + c.slice(1); };

const main = fs.readFileSync(path.join(src, 'main.js'), 'utf8');
const globals = new Set([...main.matchAll(/\.component\(\s*["']([^"']+)["']/g)].map((m) => pascal(m[1])));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.vue') ? [path.join(dir, e.name)] : []);
}

// frappe-ui components count only when registerFrappeUIComponents() lists
// them: the FrappeUI plugin itself registers none (an allow-list here once hid
// 100+ unstyled <Button>/<Badge> tags).
const fui = fs.readFileSync(path.join(src, 'frappeUiComponents.js'), 'utf8');
const FRAPPE_UI = new Set((fui.match(/FRAPPE_UI_COMPONENTS\s*=\s*\{([^}]*)\}/) || ['', ''])[1].split(',').map((n) => n.trim()).filter(Boolean));
if (!/registerFrappeUIComponents\(app\)/.test(main)) { console.error('main.js must call registerFrappeUIComponents(app)'); process.exit(1); }
const problems = [];
let checked = 0;
for (const file of walk(src)) {
  const d = parse(fs.readFileSync(file, 'utf8')).descriptor;
  if (!d.template) continue;
  const code = compileTemplate({ source: d.template.content, filename: file, id: 'x' }).code;
  const used = new Set([...code.matchAll(/_resolveComponent\("([^"]+)"/g)].map((m) => m[1]));
  const script = (d.script && d.script.content) || '';
  const local = new Set();
  const block = script.match(/components:\s*\{([\s\S]*?)\}/);
  if (block) for (const m of block[1].matchAll(/([A-Za-z][\w-]*|["'][^"']+["'])\s*(?:[:,]|$)/g)) local.add(pascal(m[1].replace(/["']/g, '')));
  const setup = (d.scriptSetup && d.scriptSetup.content) || '';
  for (const m of setup.matchAll(/^import\s+([A-Za-z_$][\w$]*)\s+from/gm)) local.add(pascal(m[1]));
  for (const m of setup.matchAll(/^import\s*\{([^}]*)\}\s*from/gm)) for (const n of m[1].split(',')) if (n.trim()) local.add(pascal(n.trim().split(/\s+as\s+/).pop()));
  const selfName = script.match(/name:\s*['"]([^'"]+)['"]/);
  if (selfName) local.add(pascal(selfName[1]));
  for (const n of used) {
    checked++;
    if (!globals.has(pascal(n)) && !FRAPPE_UI.has(pascal(n)) && !local.has(pascal(n))) problems.push(`${path.relative(src, file)}: <${n}> is not registered (main.js or local components)`);
  }
}
if (problems.length) {
  console.error('Unregistered components:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`component registry OK (${checked} component uses resolve to a registration)`);
