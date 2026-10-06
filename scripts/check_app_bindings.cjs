#!/usr/bin/env node
/**
 * Every name App.vue's template reads (props AND @event handlers) must exist:
 * either in the workstation's return object or declared in App.vue's own setup.
 * An undefined handler is a silent no-op in Vue (the drawer once shipped with
 * 40 handlers for functions that never existed), so nothing else catches it.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const babel = require('@babel/parser');

const src = path.resolve(__dirname, '..', 'src');
// The facade returns the shared bag; its surface is whatever the modules register
// with Object.assign(w, { ... }).
const composables = path.join(src, 'composables');
const exposed = new Set();
for (const f of fs.readdirSync(composables).filter((n) => /^useWorkstation\w+\.js$/.test(n))) {
  const ast = babel.parse(fs.readFileSync(path.join(composables, f), 'utf8'), { sourceType: 'module' });
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Object' && n.callee.property.name === 'assign'
      && n.arguments[0] && n.arguments[0].name === 'w' && n.arguments[1] && n.arguments[1].type === 'ObjectExpression') {
      n.arguments[1].properties.forEach((p) => p.key && exposed.add(p.key.name));
    }
    for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast.program);
}
if (exposed.size < 200) { console.error('could not find the workstation surface (' + exposed.size + ' names)'); process.exit(1); }

const file = path.join(src, 'App.vue');
const d = parse(fs.readFileSync(file, 'utf8')).descriptor;
const code = compileTemplate({ source: d.template.content, filename: file, id: 'x' }).code;
const used = [...new Set([...code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))].filter((n) => !n.startsWith('$'));
const retBlock = (d.script.content.match(/return\s*\{\s*\.\.\.workstation,([\s\S]*?)\};/) || [, ''])[1];
const local = new Set([...d.script.content.matchAll(/^\s*const\s+(\w+)\s*=/gm)].map((m) => m[1]).concat([...retBlock.matchAll(/(\w+)\s*[:,\n]/g)].map((m) => m[1])));
const missing = used.filter((n) => !exposed.has(n) && !local.has(n));
if (missing.length) {
  console.error(`App.vue uses names that nothing defines (silent no-ops at runtime):\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`OK: all ${used.length} App.vue template names are defined`);
