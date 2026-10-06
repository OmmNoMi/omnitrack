#!/usr/bin/env node
/**
 * Static check: a native `title` never wraps an element that has its own tooltip.
 * `title` is inherited by every descendant, so hovering a child Button shows the
 * frappe-ui tooltip AND the wrapper's native tooltip stacked on top of each other
 * (the dashboard day strip did this with "Next week" / "Shift+D, then ← →").
 * Put the title on the leaf that needs it, or use aria-keyshortcuts for a shortcut.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@vue/compiler-sfc');

const src = path.resolve(__dirname, '..', 'src');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.vue') ? [path.join(dir, e.name)] : []);
}

const ELEMENT = 1;
const ATTR = 6;
const DIRECTIVE = 7;
const propName = (p) => (p.type === ATTR ? p.name : (p.type === DIRECTIVE && p.name === 'bind' && p.arg && p.arg.content) || null);
const has = (node, name) => (node.props || []).some((p) => propName(p) === name);
const ownsTooltip = (node) => has(node, 'title') || has(node, 'tooltip') || node.tag === 'Tooltip';

const problems = [];
function visit(node, file, titledAncestor) {
  if (node.type !== ELEMENT) { (node.children || []).forEach((c) => visit(c, file, titledAncestor)); return; }
  if (titledAncestor && ownsTooltip(node)) {
    problems.push(`${path.relative(src, file)}:${node.loc.start.line} <${node.tag}> has its own tooltip inside <${titledAncestor.tag}> (line ${titledAncestor.loc.start.line}) that carries a native title`);
  }
  // Only a native element's title is inherited; a component's `title` is a prop (e.g. a dialog heading)
  const next = node.tagType === 0 && has(node, 'title') ? node : titledAncestor;
  (node.children || []).forEach((c) => visit(c, file, next));
}

let checked = 0;
for (const file of walk(src)) {
  const d = parse(fs.readFileSync(file, 'utf8')).descriptor;
  if (!d.template || !d.template.ast) continue;
  checked++;
  visit(d.template.ast, file, null);
}

if (problems.length) {
  console.error('FAIL: native title wraps an element with its own tooltip (they stack on hover):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`SUCCESS: no stacked tooltips across ${checked} templates.`);
