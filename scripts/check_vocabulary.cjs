#!/usr/bin/env node
/**
 * Static check: the app never says a bare "timesheet" to a person.
 *
 * docs/DOMAIN_MODEL.md section 9: "timesheet" is ambiguous. Say Work Session (one
 * recorded run), Planned Work Block (the commitment) or ERPNext Timesheet (the
 * billing document). Copy once said "Add timesheet entry", "Approve this timesheet"
 * and "Discard (No Timesheet)" for three different things.
 *
 * Scanned: the SPA (src/**.vue, src/**.js) with comments blanked. Identifiers
 * (timesheet_name, canLogTimesheet, r.timesheet, can-log-timesheet), the route id
 * 'timesheets' and "ERPNext Timesheet" are allowed.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return /\.(vue|js)$/.test(e.name) ? [p] : [];
  });
}

// Blank out comments but keep line numbers, so a report points at the right line.
const blank = (s) => s.replace(/[^\n]/g, ' ');
const stripComments = (src) => src
  .replace(/<!--[\s\S]*?-->/g, blank)
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/(^|[^:\\'"`\w])\/\/[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)));

// A word "timesheet(s)" that is not part of an identifier, a property, a kebab
// name, an object key or the route id, and is not "ERPNext Timesheet".
const BARE = /(?<![\w.\-/$])(?<!ERPNext )timesheets?(?![\w\-:])/gi;
const ROUTE_ID = /(['"])timesheets\1|path: '\/timesheets'|name: 'Timesheets'/g;

const problems = [];
for (const file of walk(path.join(root, 'src'))) {
  const raw = fs.readFileSync(file, 'utf8');
  stripComments(raw).split('\n').forEach((line, i) => {
    if (BARE.test(line.replace(ROUTE_ID, ''))) {
      problems.push(`${path.relative(root, file)}:${i + 1}: ${raw.split('\n')[i].trim().slice(0, 110)}`);
    }
    BARE.lastIndex = 0;
  });
}

if (problems.length) {
  console.error('FAIL: bare "timesheet" in user-facing copy (say work session, block or ERPNext Timesheet):\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('SUCCESS: no bare "timesheet" in user-facing copy.');
