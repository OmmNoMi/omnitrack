#!/usr/bin/env node
/**
 * Static guard: gray-on-gray text is the most common readability failure. Light-mode body text
 * must be gray-600 or darker (gray-700 for small text) and dark-mode text gray-300 or lighter.
 * Lines that set a permanently dark background are exempt.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.(vue|js)$/.test(e.name) ? [path.join(d, e.name)] : []);
const light = /(?<![\w:-])text-gray-(300|400|500)(?![\w-])/;
const dark = /(?<![\w-])dark:text-gray-(500|600|700)(?![\w-])/;
const darkBg = /bg-gray-[89]00|bg-black|bg-slate-[89]00|bg-zinc-[89]00/;
const bad = [];
for (const f of walk(root)) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (darkBg.test(line) || /aria-hidden/.test(line)) return;
    // the dark branch of `isDarkMode ? '…' : '…'` legitimately uses light grays
    const t = line.replace(/isDarkMode \? '[^']*'/g, 'isDarkMode ? \'\'').replace(/isDarkMode \? "[^"]*"/g, 'isDarkMode ? ""').replace(/isDarkMode \? \(([^)]*)\)/g, '');
    if (light.test(t) || dark.test(t)) bad.push(`${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 110)}`);
  });
}
if (bad.length) {
  console.error(`Low-contrast text colours (${bad.length}):\n  ` + bad.slice(0, 40).join('\n  '));
  process.exit(1);
}
console.log('contrast tokens OK (no light text-gray-300/400/500, no dark text-gray-500+)');
