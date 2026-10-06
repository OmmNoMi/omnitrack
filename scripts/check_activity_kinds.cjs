#!/usr/bin/env node
/**
 * Static check: a block's activity and whether it was planned stay two separate facts.
 *
 * `task_nature` used to mix them ("🎯 Planned", "⚠️ Unplanned", "Planned Work"), so a
 * person could pick "Planned" for time that had no plan. Now the activity is one plain kind
 * and planned-ness is the block's `unplanned` flag, set by the server.
 *
 * 1. The kinds agree everywhere: omnitrack/utils/activity.py, src/utils/activity.js and the
 *    task_nature options of Planned Work Block and OmniTrack Work Session (default Work).
 * 2. Python to_kind and JS toKind map the same inputs, legacy values included, the same way.
 * 3. Planned Work Block has a read-only `unplanned` Check, and every path that makes a block
 *    for unplanned time sets it: quick_timer_punch, its pairing partner, fac auto-create.
 * 4. Plan-vs-actual reads the flag: the dashboard KPIs, the day timeline, analytics PAI and
 *    the workstation PACI never look for "Unplanned" in the activity.
 * 5. No legacy activity value is written anywhere in the app (src/, omnitrack/), and the
 *    session's Activity picker maps what it is given through toKind.
 * 6. The data patches that split old rows and fold them into Work / Break / Away are registered.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const problems = [];
const fail = (msg) => problems.push(msg);

const PY = 'omnitrack/utils/activity.py';
const JS = 'src/utils/activity.js';
const DOCTYPES = [
  'omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.json',
  'omnitrack/omnitrack/doctype/omnitrack_work_session/omnitrack_work_session.json',
];

// 1. One list of kinds
const pyKinds = (read(PY).match(/^KINDS = \(([^)]*)\)/m) || [, ''])[1].match(/"([^"]+)"/g) || [];
const kinds = pyKinds.map((k) => k.slice(1, -1));
if (kinds.length < 2) fail(`${PY}: could not read KINDS`);
const jsSrc = read(JS);
const jsKinds = [...jsSrc.matchAll(/\{ id: '[a-z]+', value: '([^']+)', label: '([^']+)'/g)];
if (jsKinds.map((m) => m[1]).join('|') !== kinds.join('|')) {
  fail(`${JS}: ACTIVITY_OPTIONS (${jsKinds.map((m) => m[1]).join(', ')}) differ from ${PY} KINDS (${kinds.join(', ')})`);
}
for (const [, value, label] of jsKinds) {
  if (value !== label) fail(`${JS}: option "${value}" has a different label "${label}"; a picker would have to map them`);
}
for (const rel of DOCTYPES) {
  const field = (JSON.parse(read(rel)).fields || []).find((f) => f.fieldname === 'task_nature');
  if (!field) { fail(`${rel}: no task_nature field`); continue; }
  if (String(field.options || '').split('\n').join('|') !== kinds.join('|')) {
    fail(`${rel}: task_nature options are not the kinds ${kinds.join(', ')}`);
  }
  if (field.default !== 'Work') fail(`${rel}: task_nature default should be Work, is ${field.default}`);
}

// 2. Same mapping in both languages
const VECTORS = [
  null, '', 'Work', 'Meeting', 'Review', 'Break', 'Leave', 'Absent',
  '🎯 Planned', '⚠️ Unplanned', '⚠️ Unplanned Ops', 'Planned Work', 'Unplanned Ops',
  '🤝 Virtual Meeting', '🔄 Review & Sync', '☕ Break', '🌴 Leave', '🚫 Out-of-Office',
  'out of office', '🤒 Absent', 'Break (Non-Paid)', 'Away', 'something else',
];
let jsOut = null;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activity-'));
try {
  const tmp = path.join(tmpDir, 'activity.mjs');
  fs.writeFileSync(tmp, jsSrc);
  jsOut = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { toKind } from ${JSON.stringify(tmp)}; console.log(JSON.stringify(${JSON.stringify(VECTORS)}.map(toKind)));`,
  ], { encoding: 'utf8' }).trim();
} catch (e) {
  fail(`${JS}: could not run toKind (${e.message.split('\n')[0]})`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
let pyOut = null;
try {
  pyOut = execFileSync('python3', ['-c',
    'import json, sys, importlib.util as u\n'
    + `s = u.spec_from_file_location("activity", ${JSON.stringify(path.join(root, PY))}); m = u.module_from_spec(s); s.loader.exec_module(m)\n`
    + 'print(json.dumps([m.to_kind(v) for v in json.loads(sys.argv[1])]))',
    JSON.stringify(VECTORS),
  ], { encoding: 'utf8' }).trim();
} catch (e) {
  fail(`${PY}: could not run to_kind (${e.message.split('\n')[0]})`);
}
if (jsOut && pyOut) {
  const a = JSON.parse(jsOut), b = JSON.parse(pyOut);
  VECTORS.forEach((v, i) => {
    if (a[i] !== b[i]) fail(`toKind(${JSON.stringify(v)}) is "${a[i]}" in JS but "${b[i]}" in Python`);
    if (!kinds.includes(a[i])) fail(`toKind(${JSON.stringify(v)}) gave "${a[i]}", which is not a kind`);
  });
  if (a[VECTORS.indexOf('⚠️ Unplanned')] !== 'Work') fail('a legacy "Unplanned" value must read as Work');
  if (a[VECTORS.indexOf('Meeting')] !== 'Work') fail('a Meeting is Work');
  if (a[VECTORS.indexOf('Absent')] !== 'Away' || a[VECTORS.indexOf('Leave')] !== 'Away') fail('Leave and Absent are Away');
}

// 3. The flag exists and is set wherever unplanned time becomes a block
const unplannedField = (JSON.parse(read(DOCTYPES[0])).fields || []).find((f) => f.fieldname === 'unplanned');
if (!unplannedField || unplannedField.fieldtype !== 'Check' || !unplannedField.read_only) {
  fail(`${DOCTYPES[0]}: needs a read-only Check field "unplanned"`);
}
const must = (rel, re, why) => { if (!re.test(read(rel))) fail(`${rel}: ${why}`); };
must('omnitrack/api/stopwatch.py', /\bblock\.unplanned = 1\b/, 'quick_timer_punch must mark the block it makes as unplanned');
must('omnitrack/api/stopwatch.py', /\bp_doc\.unplanned = 1\b/, "the punch's pairing partner block must be unplanned too");
must('omnitrack/fac.py', /set_value\("Planned Work Block", target_block, "unplanned", 1/, 'log_work_session auto-create must mark its block unplanned');

// 4. Plan-vs-actual reads the flag
must('src/composables/useDashboardKpis.js', /&& !b\.unplanned\)/, 'planned hours must exclude b.unplanned blocks');
must('src/composables/useDashboardKpis.js', /&& b\.unplanned\)/, 'unplanned hours must count b.unplanned blocks');
must('src/composables/useWorkstationTimeline.js', /const isUnplanned = !!bk\.unplanned;/, 'the timeline must read bk.unplanned');
must('omnitrack/api/analytics.py', /for b in work if not b\.unplanned\)/, 'PAI planned hours must read b.unplanned');
must('omnitrack/api/workstation.py', /for b in work if not b\.get\("unplanned"\)\)/, 'PACI planned hours must read unplanned');
must('src/session/useSessionDisplay.js', /emit\('update:nature', toKind\(v\)\)/, 'the Activity picker must pass what it emits through toKind');

// 5. No legacy value anywhere it could be written or compared
const LEGACY = [
  /🎯|⚠️ Unplanned|🤝|🔄 Review|☕|🌴|🚫 Out|🤒/,
  /['"]Planned Work['"]/, /Unplanned Ops/, /Virtual Meeting/, /Review & Sync/,
  /includes\(\s*['"]Unplanned['"]\s*\)/, /"unplanned" in .*task_nature/,
  // Meeting / Review are Work and Leave / Absent are Away; a picker label is the plain kind
  /nature.*['"](Meeting|Review|Leave|Absent)['"]/, /includes\(\s*['"](Meeting|Review|Leave|Absent)['"]\s*\)/, /Non-Paid/,
];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'patches', 'tests', '__pycache__']);
// The shell's shortcuts file is not read by tooling; the mapping modules name legacy values on purpose
const SKIP_FILES = new Set(['useWorkstationShortcuts.js', 'activity.js', 'activity.py']);
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      // omnitrack/doctype is a stale copy of omnitrack/omnitrack/doctype (see ROADMAP)
      if (!SKIP_DIRS.has(e.name) && rel !== path.join('omnitrack', 'doctype')) walk(rel, out);
    } else if (/\.(js|vue|py|html)$/.test(e.name) && !SKIP_FILES.has(e.name) && !/^test_/.test(e.name)) {
      out.push(rel);
    }
  }
  return out;
};
for (const rel of [...walk('src'), ...walk('omnitrack')]) {
  read(rel).split('\n').forEach((line, i) => {
    const hit = LEGACY.find((re) => re.test(line));
    if (hit) fail(`${rel}:${i + 1}: legacy activity value (${hit}): ${line.trim().slice(0, 100)}`);
  });
}

// 6. Old rows are split, then folded into the kinds, by the patches
for (const patch of ['split_activity_from_planned', 'merge_activity_into_work_break_away']) {
  if (!new RegExp(`^omnitrack\\.patches\\.v1_5\\.${patch}$`, 'm').test(read('omnitrack/patches.txt'))) {
    fail(`omnitrack/patches.txt: ${patch} is not registered`);
  }
}

if (problems.length) {
  console.error(`check_activity_kinds: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`OK: activity kinds agree (${kinds.join(', ')}); planned-ness is the unplanned flag.`);
