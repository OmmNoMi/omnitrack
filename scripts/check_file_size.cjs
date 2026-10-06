#!/usr/bin/env node
/**
 * File-size gate: no src/** file may exceed MAX_LINES. Files that already did
 * when this gate was introduced are listed in scripts/file_size_allowlist.json
 * with their current line count as a CEILING: they may shrink but never grow.
 * When one drops under the limit (or shrinks), run with --ratchet to lower or
 * remove its entry so the improvement can't be undone.
 */
const fs = require('node:fs');
const path = require('node:path');

const MAX_LINES = 500;
const root = path.resolve(__dirname, '..');
const listPath = path.join(__dirname, 'file_size_allowlist.json');
const allow = fs.existsSync(listPath) ? JSON.parse(fs.readFileSync(listPath, 'utf8')) : {};
const ratchet = process.argv.includes('--ratchet');
const seed = process.argv.includes('--seed'); // one-off: freeze every current offender

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(vue|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

const problems = [];
const next = {};
for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n').length;
  if (lines <= MAX_LINES) {
    if (allow[rel]) console.log(`  ${rel} is now ${lines} lines; remove it from the allowlist (--ratchet)`);
    continue;
  }
  const ceiling = allow[rel];
  if (seed) next[rel] = lines;
  else if (ceiling === undefined) problems.push(`${rel}: ${lines} lines > ${MAX_LINES} (split it; do not allowlist new files)`);
  else if (lines > ceiling) problems.push(`${rel}: grew to ${lines} lines (ceiling ${ceiling})`);
  else next[rel] = lines;
}

if (ratchet || seed) {
  fs.writeFileSync(listPath, JSON.stringify(next, null, 2) + '\n');
  console.log(`allowlist ratcheted: ${Object.keys(next).length} oversized file(s)`);
} else if (problems.length) {
  console.error('File-size gate failed:\n  ' + problems.join('\n  '));
  process.exit(1);
} else {
  console.log(`file size OK (max ${MAX_LINES}; ${Object.keys(next).length} legacy file(s) frozen at their ceiling)`);
}
