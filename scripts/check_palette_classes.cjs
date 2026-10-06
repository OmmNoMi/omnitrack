#!/usr/bin/env node
/**
 * Static check: every colour utility in src/ names a colour + shade that exists in the
 * resolved Tailwind theme. The frappe-ui preset replaces Tailwind's palette, so classes
 * like `bg-indigo-50` or `bg-blue-950` compile to NOTHING and the element silently
 * renders unstyled (a "chip" with no background, a badge with default text colour).
 * Fix by using a palette colour (blue, purple, violet…) or extend `colors` in tailwind.config.cjs.
 */
const fs = require('node:fs');
const path = require('node:path');
const resolveConfig = require('tailwindcss/resolveConfig');

const root = path.resolve(__dirname, '..');
// loadConfig goes through jiti, which handles the ESM frappe-ui preset that a plain require() cannot
const loadConfig = require('tailwindcss/loadConfig');
const theme = resolveConfig(loadConfig(path.join(root, 'tailwind.config.cjs'))).theme;
const colors = theme.colors;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(vue|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

const PREFIX = '(?:bg|text|border|border-[trblxy]|ring|ring-offset|from|via|to|divide|outline|fill|stroke|decoration|accent|caret|placeholder|shadow)';
const re = new RegExp(`(?<![\\w-])${PREFIX}-([a-z]+)-(\\d{2,3})(?:\\/\\d+)?(?![\\w-])`, 'g');

const problems = [];
let seen = 0;
for (const file of walk(path.join(root, 'src'))) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(re)) {
      const [cls, name, shade] = m;
      seen++;
      const scale = colors[name];
      if (scale === undefined) problems.push(`${path.relative(root, file)}:${i + 1} ${cls} (no "${name}" colour in the theme)`);
      else if (typeof scale === 'object' && scale[shade] === undefined) problems.push(`${path.relative(root, file)}:${i + 1} ${cls} ("${name}" has no ${shade} shade)`);
    }
  });
}

// Radius too: the preset's scale stops at 2xl, so `rounded-3xl` compiled to nothing and the
// recording dialog rendered as a square card among rounded ones.
const radii = theme.borderRadius;
const radiusRe = /(?<![\w-])rounded(?:-(?:[trblse]|tl|tr|bl|br|ss|se|es|ee))?-([a-z0-9]+)(?![\w-])/g;
for (const file of walk(path.join(root, 'src'))) {
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(radiusRe)) {
      seen++;
      if (radii[m[1]] === undefined) problems.push(`${path.relative(root, file)}:${i + 1} ${m[0]} (no "${m[1]}" radius in the theme)`);
    }
  });
}

if (problems.length) {
  console.error('FAIL: colour or radius classes that do not exist in the frappe-ui/Tailwind theme (they compile to nothing):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`SUCCESS: all ${seen} colour and radius classes resolve to the theme.`);
