#!/usr/bin/env node
/**
 * Static check: no emoji or pictographic glyphs in anything a person reads.
 *
 * Design rule (OmniSkill product_design_philosophy): icons are FeatherIcon / Frappe sprite
 * icons with a text label, never emoji or Unicode pictographs. Glyphs render differently on
 * every OS, read out as noise to screen readers ("rocket", "black right-pointing triangle"),
 * and cannot be coloured to meet contrast.
 *
 * Scanned: the SPA (src/**.vue, src/**.js), the Desk script, the service worker, and the
 * Python that writes notification, Raven and API text. Comments and Python docstrings are
 * skipped. CLI output (importer, commands), patches and tests are out of scope.
 *
 * Allowed typography: · • – — … ⌘ (none fall in the banned ranges).
 * Legacy stored data that still holds an emoji is matched with an escape ('\u{1F3C1}'),
 * which this check does not see. Read old values that way; never write a new one.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const BANNED = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{2317}\u{2319}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;

function walk(dir, re) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['node_modules', 'dist', 'tests', 'patches', '__pycache__'].includes(e.name) ? [] : walk(p, re);
    return re.test(e.name) ? [p] : [];
  });
}

// Blank out comments but keep line numbers, so a report points at the right line.
const blank = (s) => s.replace(/[^\n]/g, ' ');
function stripJs(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:\\'"`\w])\/\/[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)));
}
function stripPy(src) {
  return src
    .replace(/("""|''')[\s\S]*?\1/g, blank)
    .replace(/(^|\s)#[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)));
}

const files = [
  ...walk(path.join(root, 'src'), /\.(vue|js)$/),
  ...walk(path.join(root, 'omnitrack', 'public', 'js'), /\.js$/),
  path.join(root, 'omnitrack', 'public', 'sw.js'),
  path.join(root, 'omnitrack', 'notifications.py'),
  path.join(root, 'omnitrack', 'raven_bridge.py'),
  ...walk(path.join(root, 'omnitrack', 'api'), /\.py$/),
].filter((f) => fs.existsSync(f));

const problems = [];
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const code = file.endsWith('.py') ? stripPy(raw) : stripJs(raw);
  code.split('\n').forEach((line, i) => {
    const m = line.match(BANNED);
    if (m) {
      const cp = m[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      problems.push(`${path.relative(root, file)}:${i + 1} U+${cp} in: ${raw.split('\n')[i].trim().slice(0, 100)}`);
    }
  });
}

if (problems.length) {
  console.error('FAIL: emoji or pictographic glyphs in user-facing code (use a FeatherIcon and words):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`SUCCESS: no emoji or pictographic glyphs in ${files.length} user-facing files.`);
