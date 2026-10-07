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
// Dark mode reads as well as light. Two ways a grey went faint on the dark page: the dark branch
// of `isDarkMode ? '…' : '…'` named a dark grey (the timeline's labels), or a grey had no dark:
// colour at all and stayed gray-600 on #1E1F22 (calendar stats, attendance, client portal).
const darkGrey = /(?<![\w:-])text-gray-(500|600|700|800|900)(?![\w-])/;
for (const f of walk(root)) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const at = `${path.relative(root, f)}:${i + 1}`;
    for (const m of line.matchAll(/isDarkMode \? '([^']*)'/g)) {
      if (darkGrey.test(m[1])) bad.push(`${at}: the dark branch of isDarkMode names a dark grey (use gray-300 or lighter): ${line.trim().slice(0, 90)}`);
    }
    const rest = line.replace(/isDarkMode \? '[^']*' : '[^']*'/g, '');
    if (/class="/.test(line) && !/isDarkMode/.test(line) && darkGrey.test(rest) && !/dark:text-/.test(rest)) bad.push(`${at}: a grey text with no dark: colour stays dark on the dark page: ${line.trim().slice(0, 90)}`);
  });
}
// frappe-ui's solid Button text turns near-black in dark mode, since its own solid background
// turns light. Ours stays blue-700, so its text has to stay white (Start session and Plan read 3.8:1).
for (const f of walk(root)) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/enabled:!bg-blue-700/.test(line) && !/enabled:!text-white/.test(line)) bad.push(`${path.relative(root, f)}:${i + 1}: a blue-700 Button keeps enabled:!text-white, or its label goes dark in dark mode`);
  });
}
// A coloured ghost or subtle Button: frappe-ui's blue text is 4.1:1 on white, and its red and blue
// keep their light-mode text on the dark page (the Overdue chip read 2.6:1). Each one names its own
// text colour for both themes, and a theme picked at run time cannot be checked, so it is grey.
for (const f of walk(root)) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<Button\b(?:"[^"]*"|[^>"])*>/g)) {
    const tag = m[0];
    if (!/variant="(ghost|subtle)"|'(ghost|subtle)'/.test(tag)) continue;
    const at = `${path.relative(root, f)}:${src.slice(0, m.index).split('\n').length}`;
    const theme = (tag.match(/\stheme="(\w+)"/) || [])[1];
    const runTheme = tag.match(/\s:theme="(.+?) \? '(\w+)' : 'gray'"/);
    const runVariant = tag.match(/\s:variant="(.+?) \? 'solid' :/);
    // A theme picked at run time is fine when its colour only ever comes with solid (a selected
    // tab, a confirm press); otherwise the Button names its own text colour
    if (/\s:theme="/.test(tag)) {
      if (!(runTheme && runVariant && runTheme[1] === runVariant[1]) && !/!text-/.test(tag)) bad.push(`${at}: a ghost or subtle Button whose theme can turn coloured names its own !text- colour`);
    }
    else if (theme === 'blue' && !/!text-blue-700/.test(tag)) bad.push(`${at}: a ghost or subtle blue Button needs !text-blue-700 (frappe-ui's blue reads 4.1:1)`);
    else if (theme && theme !== 'gray' && !/dark:!text-/.test(tag)) bad.push(`${at}: a ghost or subtle ${theme} Button needs a dark:!text- colour, or it keeps light-mode text on the dark page`);
  }
}
// A primary Button is blue-700 (frappe-ui's own blue fails AA), but only while it can be pressed:
// a bare !bg-blue-700 beats frappe-ui's disabled style, so a button that does nothing looks ready.
for (const f of walk(root)) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/(?<!enabled:)(?<!enabled:hover:)!bg-blue-[78]00/.test(line)) bad.push(`${path.relative(root, f)}:${i + 1}: primary blue without enabled: (a disabled button looks pressable): ${line.trim().slice(0, 90)}`);
  });
}
// Dark mode is two switches: .dark for the app's own dark: classes, data-theme="dark" for
// frappe-ui's ink/surface/outline tokens. With .dark alone every frappe-ui control kept its light
// colours on a dark page (dark-grey icons on near-black, white chips glaring). Both set it.
const appDir = path.resolve(__dirname, '..');
const shell = fs.readFileSync(path.join(appDir, 'src/composables/useWorkstationShell.js'), 'utf8');
const page = fs.readFileSync(path.join(appDir, 'omnitrack/www/omnitrack.html'), 'utf8');
if (!/const applyTheme = \(dark\) => \{\s*document\.documentElement\.setAttribute\('data-theme', dark \? 'dark' : 'light'\);/.test(shell)) bad.push('composables/useWorkstationShell.js: applyTheme sets data-theme for frappe-ui as well as .dark');
if (!/document\.documentElement\.setAttribute\('data-theme', isDark \? 'dark' : 'light'\);/.test(page)) bad.push('omnitrack/www/omnitrack.html: the first-paint script sets data-theme for frappe-ui as well as .dark');
if (bad.length) {
  console.error(`Low-contrast text colours (${bad.length}):\n  ` + bad.slice(0, 40).join('\n  '));
  process.exit(1);
}
console.log('contrast tokens OK (no light text-gray-300/400/500, no dark text-gray-500+, every grey has a dark colour, primary blue only when enabled)');
