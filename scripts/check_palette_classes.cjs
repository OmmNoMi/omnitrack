#!/usr/bin/env node
/**
 * Static check: every colour utility in src/ names a colour + shade that exists in the
 * resolved Tailwind theme (and every radius and breakpoint variant, below). The frappe-ui preset replaces Tailwind's palette, so classes
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

// Breakpoints too: the preset's screens stop at xl, so every `2xl:` class compiled to nothing and
// the planner rails never widened past 240px/220px. Looks like a screen variant (xs, sm, md, lg,
// xl, 2xl…, with an optional max-) directly followed by a utility, so `{ lg: '2xl' }` is skipped.
// Stacked variants count too: `dark:2xl:p-3` drops the same way.
const screens = theme.screens;
const screenRe = /(?<![\w-])(?:max-)?(xs|sm|md|lg|\d?xl):(?=[!\[a-z-])/g;
for (const file of walk(path.join(root, 'src'))) {
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(screenRe)) {
      seen++;
      if (screens[m[1]] === undefined) problems.push(`${path.relative(root, file)}:${i + 1} ${m[0]} (no "${m[1]}" screen in the theme)`);
    }
  });
}

// Font weight under a breakpoint: every frappe-ui text size sets its own font-weight (400/420), and a
// breakpoint rule sits after `.font-bold` in the CSS. So `text-lg sm:text-xl font-bold` drops to
// regular weight from sm up. The breakpoint needs its own weight: `sm:font-bold`.
const sizes = theme.fontSize;
const WEIGHTS = 'thin|extralight|light|normal|medium|semibold|bold|extrabold|black';
const weightRe = new RegExp(`(?<![\\w:-])font-(${WEIGHTS})(?![\\w-])`);
const sizeRe = /(?<![\w-])((?:[\w-]+:)*(?:max-)?(?:xs|sm|md|lg|\d?xl)):text-([\w-]+)(?![\w-])/g;
for (const file of walk(path.join(root, 'src'))) {
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const attr of line.matchAll(/(?<![\w:-])class="([^"]*)"/g)) {
      const weight = attr[1].match(weightRe);
      if (!weight) continue;
      for (const m of attr[1].matchAll(sizeRe)) {
        const size = sizes[m[2]];
        if (!Array.isArray(size) || size[1]?.fontWeight === undefined) continue;
        seen++;
        if (!new RegExp(`(?<![\\w-])${m[1]}:font-(${WEIGHTS})(?![\\w-])`).test(attr[1])) {
          problems.push(`${path.relative(root, file)}:${i + 1} ${m[0]} resets ${weight[0]} to ${size[1].fontWeight} (add ${m[1]}:${weight[0]})`);
        }
      }
    }
  });
}

if (problems.length) {
  console.error('FAIL: colour, radius or breakpoint classes that do not exist in the frappe-ui/Tailwind theme (they compile to nothing), or a breakpoint text size that resets the font weight:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`SUCCESS: all ${seen} colour, radius and breakpoint classes resolve to the theme.`);
