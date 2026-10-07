#!/usr/bin/env node
/**
 * Static guard: every `_ctx.x` a compiled SFC template reads must be declared by
 * that component (props, emits-as-onX, data/computed/methods, setup return, or
 * a known global/instance property). Catches views extracted from a monolith
 * that still reference state they never received (render-time
 * "Cannot read properties of undefined").
 */
const fs = require('fs'), path = require('path');
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const babel = require('@babel/parser');
const ROOT = path.join(__dirname, '..', 'src');
const IMPLICIT = new Set(['$slots', '$attrs', '$emit', '$props', '$refs', '$el', '$parent', '$root', '$nextTick', '$forceUpdate', '$watch', '$options', '$data', '$route', '$router', '$t', '$store', 'frappe']);
function walk(d, o = []) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p, o) : /\.vue$/.test(f.name) && o.push(p); } return o; }
function declared(script) {
  const names = new Set();
  if (!script) return names;
  const ast = babel.parse(script, { sourceType: 'module', errorRecovery: true });
  const def = ast.program.body.find((n) => n.type === 'ExportDefaultDeclaration');
  const obj = def && def.declaration;
  if (!obj || obj.type !== 'ObjectExpression') return null; // unanalyzable (script setup etc.)
  for (const p of obj.properties) {
    const k = p.key && (p.key.name || p.key.value);
    if (['props', 'computed', 'methods', 'inject'].includes(k) && p.value.type === 'ObjectExpression') p.value.properties.forEach((q) => q.key && names.add(q.key.name || q.key.value));
    if (['props', 'inject'].includes(k) && p.value.type === 'ArrayExpression') p.value.elements.forEach((e) => e && names.add(e.value));
    if (k === 'setup' || k === 'data') {
      // A setup() that only forwards useWorkstationContext/useSessionContext([...]), alone or as
      // spreads beside plain keys, is analyzable: those string lists and keys are the declared
      // surface. Any other data()/setup() is opaque.
      const lists = k === 'setup' ? [...script.matchAll(/use(?:Workstation|Session)Context\(\[([\s\S]*?)\]\)/g)] : [];
      if (!lists.length) return null;
      lists.forEach((m) => [...m[1].matchAll(/'([^']+)'/g)].forEach((x) => names.add(x[1])));
      const body = p.body && p.body.body ? p.body.body : (p.value && p.value.body && p.value.body.body) || [];
      const ret = body.find((s) => s.type === 'ReturnStatement');
      if (ret && ret.argument && ret.argument.type === 'ObjectExpression') {
        for (const q of ret.argument.properties) {
          if (q.type === 'SpreadElement') {
            const callee = q.argument.type === 'CallExpression' && q.argument.callee.name;
            if (!/^use(?:Workstation|Session)Context$/.test(callee || '')) return null;
          } else if (q.key) names.add(q.key.name || q.key.value);
        }
      }
    }
  }
  return names;
}
let bad = 0;
for (const file of walk(ROOT)) {
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'));
  if (!descriptor.template || descriptor.scriptSetup) continue;
  const names = declared(descriptor.script && descriptor.script.content);
  if (!names) continue;
  const res = compileTemplate({ source: descriptor.template.content, filename: file, id: 'x', compilerOptions: { prefixIdentifiers: true } });
  const used = new Set([...res.code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  const missing = [...used].filter((n) => !names.has(n) && !IMPLICIT.has(n));
  if (missing.length) { bad += missing.length; console.log(`${path.relative(process.cwd(), file)}: ${missing.length} undeclared -> ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`); }
}
// Every name a component asks the workstation for must be one the workstation exposes. A name
// it lacks makes useWorkstationContext throw in setup, and a production build swallows that: the
// component renders with nothing from setup (WorkSessionEntry once opened with no frame, no
// block and no projects, because editSessionTargetBlock was never put on the workstation).
const CDIR = path.join(ROOT, 'composables');
const exposed = new Set();
let open = false;
for (const f of fs.readdirSync(CDIR).filter((n) => /\.js$/.test(n))) {
  const ast = babel.parse(fs.readFileSync(path.join(CDIR, f), 'utf8'), { sourceType: 'module', errorRecovery: true });
  (function visit(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Object' && n.callee.property.name === 'assign' && n.arguments[0] && n.arguments[0].name === 'w') {
      for (const arg of n.arguments.slice(1)) {
        if (arg.type !== 'ObjectExpression') { open = true; continue; }
        for (const q of arg.properties) q.type === 'SpreadElement' ? (open = true) : q.key && exposed.add(q.key.name || q.key.value);
      }
    }
    if (n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.object.name === 'w' && !n.left.computed) exposed.add(n.left.property.name);
    for (const k of Object.keys(n)) { const v = n[k]; if (k === 'loc' || k === 'start' || k === 'end') continue; Array.isArray(v) ? v.forEach(visit) : v && typeof v === 'object' && visit(v); }
  })(ast.program);
}
function allSrc(d, o = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? allSrc(p, o) : /\.(vue|js)$/.test(e.name) && o.push(p); } return o; }
if (exposed.size < 50) { console.error(`FAIL: found only ${exposed.size} workstation names; the Object.assign(w, {...}) pattern changed, update this guard`); process.exit(1); }
if (!open) {
  for (const file of allSrc(ROOT)) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/useWorkstationContext\(\[([\s\S]*?)\]\)/g)) {
      const asked = [...m[1].matchAll(/['"]([\w$]+)['"]/g)].map((x) => x[1]);
      const lacking = asked.filter((n) => !exposed.has(n));
      if (lacking.length) { bad += lacking.length; console.log(`${path.relative(process.cwd(), file)}: asks the workstation for ${lacking.join(', ')}, which it does not expose`); }
    }
  }
}
if (bad) { console.error(`\nFAIL: ${bad} template or workstation reference(s) with no declaration.`); process.exit(1); }
console.log('OK: every template reference is declared');
