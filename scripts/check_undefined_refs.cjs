#!/usr/bin/env node
/**
 * Static guard for the composable decomposition: reports identifiers that are
 * referenced in a src/**\/*.js file but never declared anywhere in it (no
 * import, const/let/var, function, class, parameter or catch binding) and are
 * not browser/JS globals. This is the exact failure class that extraction
 * produces (e.g. `flt is not defined`, `_livePollTimer is not defined`),
 * which only surfaces at runtime in the browser.
 *
 * Flat (file-wide) binding analysis: it cannot catch a name declared in the
 * wrong scope, but it never false-positives on valid scoping.
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const t = require('@babel/types');

const ROOT = path.join(__dirname, '..', 'src');
const GLOBALS = new Set(`undefined NaN Infinity globalThis window document navigator location history localStorage sessionStorage
console setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame fetch URL URLSearchParams
Date Math JSON Promise Object Array String Number Boolean Symbol Map Set WeakMap WeakSet RegExp Error TypeError RangeError
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI Intl Reflect Proxy BigInt
Notification AudioContext webkitAudioContext BroadcastChannel Audio Image FormData Blob File FileReader AbortController
CustomEvent Event KeyboardEvent MouseEvent MutationObserver ResizeObserver IntersectionObserver performance crypto atob btoa
structuredClone queueMicrotask frappe __VUE_OPTIONS_API__ __VUE_PROD_DEVTOOLS__ process arguments require module exports
screen getComputedStyle alert confirm prompt navigator indexedDB caches self top parent Node Element HTMLElement
Uint8Array Uint8ClampedArray Int8Array Float32Array Float64Array ArrayBuffer DataView TextEncoder TextDecoder
matchMedia open close focus WebSocket Vue io Response Request Headers Worker SharedWorker ServiceWorkerRegistration PushManager
DOMException Path2D CSS XMLHttpRequest DOMParser Selection Range ClipboardItem`.split(/\s+/));

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.js$/.test(f.name)) out.push(p);
  }
  return out;
}

function check(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const declared = new Set();
  const refs = [];
  const visit = (node, parent, key) => {
    if (!node || typeof node.type !== 'string') return;
    if (t.isVariableDeclarator(node)) Object.keys(t.getBindingIdentifiers(node.id)).forEach((n) => declared.add(n));
    else if (t.isFunction(node)) {
      if (node.id) declared.add(node.id.name);
      node.params.forEach((p) => Object.keys(t.getBindingIdentifiers(p)).forEach((n) => declared.add(n)));
    } else if (t.isClass(node) && node.id) declared.add(node.id.name);
    else if (t.isImportSpecifier(node) || t.isImportDefaultSpecifier(node) || t.isImportNamespaceSpecifier(node)) declared.add(node.local.name);
    else if (t.isCatchClause(node) && node.param) Object.keys(t.getBindingIdentifiers(node.param)).forEach((n) => declared.add(n));
    if (t.isIdentifier(node)) {
      const isProp = (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) && key === 'property' && !parent.computed;
      const isKey = (t.isObjectProperty(parent) || t.isObjectMethod(parent) || t.isClassMethod(parent) || t.isClassProperty(parent)) && key === 'key' && !parent.computed;
      const isShorthandVal = t.isObjectProperty(parent) && parent.shorthand && key === 'key';
      const isLabel = t.isLabeledStatement(parent) || t.isBreakStatement(parent) || t.isContinueStatement(parent);
      const isSpecName = t.isImportSpecifier(parent) || t.isExportSpecifier(parent);
      if (!isProp && !isLabel && !isSpecName && (!isKey || isShorthandVal)) refs.push(node);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'extra') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, node, k));
      else if (v && typeof v.type === 'string') visit(v, node, k);
    }
  };
  visit(ast.program, null, null);
  const bad = new Map();
  for (const id of refs) {
    if (declared.has(id.name) || GLOBALS.has(id.name)) continue;
    if (!bad.has(id.name)) bad.set(id.name, id.loc.start.line);
  }
  return bad;
}

let failures = 0;
for (const file of walk(ROOT)) {
  for (const [name, line] of check(file)) {
    failures++;
    console.log(`${path.relative(process.cwd(), file)}:${line}  '${name}' is used but never declared`);
  }
}
if (failures) {
  console.error(`\nFAIL: ${failures} undeclared identifier(s).`);
  process.exit(1);
}
console.log('OK: no undeclared identifiers in src/**/*.js');
