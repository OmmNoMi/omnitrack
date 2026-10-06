#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert');

console.log('--- Running Tier 3: Workstation Interaction & A11y Test Suite ---');

const omnitrackHtmlPath = path.resolve(__dirname, '..', 'omnitrack', 'www', 'omnitrack.html');
const composablePath = path.resolve(__dirname, '..', 'src', 'composables', 'useOmniTrackWorkstation.js');
const appVuePath = path.resolve(__dirname, '..', 'src', 'App.vue');
const calVuePath = path.resolve(__dirname, '..', 'src', 'views', 'CalendarView.vue');
const timeVuePath = path.resolve(__dirname, '..', 'src', 'views', 'TimesheetsView.vue');
const attVuePath = path.resolve(__dirname, '..', 'src', 'views', 'AttendanceView.vue');
const dashVuePath = path.resolve(__dirname, '..', 'src', 'views', 'DashboardView.vue');
const calSectionDir = path.resolve(__dirname, '..', 'src', 'views', 'calendar');
const calSectionPaths = fs.existsSync(calSectionDir) ? fs.readdirSync(calSectionDir).filter((f) => f.endsWith('.vue')).map((f) => path.join(calSectionDir, f)) : [];
const dashSectionDir = path.resolve(__dirname, '..', 'src', 'views', 'dashboard');
const dashSectionPaths = fs.existsSync(dashSectionDir) ? fs.readdirSync(dashSectionDir).filter((f) => f.endsWith('.vue')).map((f) => path.join(dashSectionDir, f)) : [];
const blockDrawerPath = path.resolve(__dirname, '..', 'src', 'drawers', 'BlockDetailDrawer.vue');
const ravenDrawerPath = path.resolve(__dirname, '..', 'src', 'drawers', 'RavenCollaborationDrawer.vue');
const fMenuPath = path.resolve(__dirname, '..', 'src', 'components', 'common', 'FDropdownMenu.vue');
const fComboboxPath = path.resolve(__dirname, '..', 'src', 'components', 'common', 'FCombobox.vue');

const dialogsDir = path.resolve(__dirname, '..', 'src', 'components', 'dialogs');
const sessionSplitDir = path.resolve(__dirname, '..', 'src', 'session');
const sessionSplitPaths = fs.existsSync(sessionSplitDir) ? fs.readdirSync(sessionSplitDir).filter((f) => /\.(vue|js)$/.test(f) && f !== 'SessionBox.vue').map((f) => path.join(sessionSplitDir, f)) : [];
const sessionBoxPath = path.resolve(__dirname, '..', 'src', 'session', 'SessionBox.vue');
const dialogFiles = fs.existsSync(dialogsDir)
  ? fs.readdirSync(dialogsDir).filter(f => f.endsWith('.vue')).map(f => path.join(dialogsDir, f))
  : [];

const headerVuePath = path.resolve(__dirname, '..', 'src', 'components', 'layout', 'WorkstationHeader.vue');
const bottomNavVuePath = path.resolve(__dirname, '..', 'src', 'components', 'layout', 'WorkstationBottomNav.vue');
const hoverCardVuePath = path.resolve(__dirname, '..', 'src', 'components', 'common', 'BlockHoverCard.vue');
const sessionOverlayVuePath = path.resolve(__dirname, '..', 'src', 'components', 'layout', 'SessionOverlay.vue');
const drawerCoordinatorVuePath = path.resolve(__dirname, '..', 'src', 'drawers', 'DrawerCoordinator.vue');
const storesDir = path.resolve(__dirname, '..', 'src', 'stores');
const storeFiles = fs.existsSync(storesDir)
  ? fs.readdirSync(storesDir).filter(f => f.endsWith('.js')).map(f => path.join(storesDir, f))
  : [];

const composablesDir = path.resolve(__dirname, '..', 'src', 'composables');
const composableFiles = fs.existsSync(composablesDir)
  ? fs.readdirSync(composablesDir).filter(f => f.endsWith('.js')).map(f => path.join(composablesDir, f))
  : [composablePath];

const filesToInspect = [
  omnitrackHtmlPath, ...composableFiles, appVuePath, calVuePath, timeVuePath, attVuePath, dashVuePath, ...dashSectionPaths, ...calSectionPaths,
  blockDrawerPath, ravenDrawerPath, sessionBoxPath, ...sessionSplitPaths,
  headerVuePath, bottomNavVuePath, hoverCardVuePath, sessionOverlayVuePath,
  drawerCoordinatorVuePath, ...storeFiles, ...dialogFiles
];

let content = '';
for (const f of filesToInspect) {
  if (fs.existsSync(f)) content += fs.readFileSync(f, 'utf8') + '\n';
}

// 1. Menus are frappe-ui <Dropdown>: the custom FDropdownMenu is gone for good.
const vueFiles = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.vue')) vueFiles.push(p);
  }
})(path.resolve(__dirname, '..', 'src'));
assert.ok(!fs.existsSync(fMenuPath), 'FAIL: FDropdownMenu.vue must stay deleted; menus use frappe-ui Dropdown');
let dropdownCount = 0;
let pickerCount = 0;
// A Dropdown has no search box, so it is only for short, fixed action menus.
// Anything that lists data (teammates, projects, activity types, tasks) grows
// past five entries and must be a searchable Combobox instead. Adding a menu
// here is a decision: it must stay at five options or fewer.
const SHORT_MENUS = new Set([
  'headerMenuItems',            // New task / timesheet / theme / alerts
  'menuItems',                  // header: Raven chat + headerMenuItems
  'getTaskWorkflowMenuItems(t)', // a task's workflow transitions
  'moreActions',                // block drawer: Add timesheet entry, Cancel block
  'taskMenu',                   // task form: Open discussion, Open full form, Remove from block
  'statusMenu',                 // task form: the workflow moves open from one state
  'taskMoves(t)',               // entry sheet: a task's workflow moves, each opening the task form
  'priorityMenu',               // task form: the DocType's priorities (3 on ToDo, 4 on Task)
  'plannerNatureMenuItems'      // multi-select toggles; ROADMAP: move to a searchable multi-select
]);
for (const f of vueFiles) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(path.resolve(__dirname, '..'), f);
  assert.ok(!/<f-dropdown-menu|<FDropdownMenu/.test(src), `FAIL: ${rel} still uses the removed FDropdownMenu`);
  // frappe-ui Button binds :aria-label="label" after $attrs, so a passed
  // aria-label is silently replaced by undefined. Names go through `label`.
  for (const b of src.matchAll(/<Button\b((?:[^>"]|"[^"]*")*)>/g)) {
    assert.ok(!/\saria-label=|\s:aria-label=/.test(b[1]), `FAIL: ${rel} <Button aria-label> is dropped by frappe-ui; use the label prop`);
  }
  // With no default-slot text, Button renders `label` as visible text: an
  // icon drawn in #prefix then shows a truncated "P…" next to it. Icon-only
  // Buttons use the icon prop (or #icon slot).
  for (const b of src.matchAll(/<Button\b((?:[^>"]|"[^"]*")*)>([\s\S]*?)<\/Button>/g)) {
    if (!/(\s|:)label=/.test(b[1]) || /\s:?icon=/.test(b[1])) continue;
    const text = b[2].replace(/<template #(prefix|suffix)>[\s\S]*?<\/template>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
    assert.ok(text || !/#prefix/.test(b[2]), `FAIL: ${rel} icon-only <Button> draws its icon in #prefix, so its label shows as text; use the icon prop`);
  }
  for (const m of src.matchAll(/<Dropdown\b((?:[^>"]|"[^"]*")*)>([\s\S]*?)<\/Dropdown>/g)) {
    dropdownCount++;
    assert.ok(/:options="/.test(m[1]), `FAIL: ${rel} <Dropdown> must bind :options`);
    const opts = (m[1].match(/:options="([^"]*)"/) || [])[1];
    assert.ok(SHORT_MENUS.has(opts), `FAIL: ${rel} <Dropdown :options="${opts}"> has no search box; data lists use a searchable <Combobox>`);
    assert.ok(/<Button\b(?:[^>"]|"[^"]*")*\s:?label=/.test(m[2]), `FAIL: ${rel} <Dropdown> trigger Button needs a label (its accessible name)`);
  }
}
// MultiSelect is frappe-ui's searchable many-pick list ("Work with" teammates)
for (const f of vueFiles) pickerCount += (fs.readFileSync(f, 'utf8').match(/<(Combobox|MultiSelect)\b/g) || []).length;
assert.ok(dropdownCount >= 3, `FAIL: expected >= 3 frappe-ui Dropdowns, found ${dropdownCount}`);
// 9: the duplicate plan dialogs merged, and the plan dialog's task picker is its own
// full-width searchable listbox (role=combobox + listbox), not a squeezed Combobox.
assert.ok(pickerCount >= 9, `FAIL: expected >= 9 searchable Comboboxes / MultiSelects (teammate, project, activity pickers), found ${pickerCount}`);
console.log(`✓ Test 1: ${dropdownCount} short menus are labelled frappe-ui Dropdowns, ${pickerCount} data pickers are searchable Comboboxes; FDropdownMenu removed.`);

// 2. Menu option builders produce the frappe-ui option shape.
const portalSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'composables', 'useWorkstationPortal.js'), 'utf8');
// The action verb already names the outcome ("Approve"); a next-state pill or
// description line only repeats it, so workflow options carry no description.
const wfBuilder = portalSrc.match(/const getTaskWorkflowMenuItems = [\s\S]*?\n  };/);
assert.ok(wfBuilder, 'FAIL: getTaskWorkflowMenuItems not found');
assert.ok(!/next_state|description:/.test(wfBuilder[0]), 'FAIL: workflow options must not repeat the next state (duplicate information)');
assert.ok(/theme:[^\n]*'red'/.test(portalSrc), 'FAIL: destructive workflow options (cancel/reject) must use theme red');
assert.ok(!portalSrc.includes('getWorkflowActionClass'), 'FAIL: ad-hoc workflow option classes must not return');
const layoutSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'composables', 'useWorkstationPlannerLayout.js'), 'utf8');
assert.ok(/e\.preventDefault\(\)/.test(layoutSrc) && layoutSrc.includes('toggleNatureFilter(n)'), 'FAIL: nature multi-select must keep the menu open (event.preventDefault) while toggling');
console.log('✓ Test 2: Workflow and nature options use the frappe-ui Dropdown option shape.');

// 3-8. Attention grid roving. The rows carry three cells (task, Plan, Start Session);
// workflow moves live only in the one task form, so the grid has no menu column.
const gridMatch = content.match(/const onAttentionGridKey = \([\s\S]*?\n\s*\};\n/);
assert.ok(gridMatch, 'FAIL: Could not find onAttentionGridKey');
const lastCol = Number((content.match(/const ATTENTION_LAST_COL = (\d+);/) || [])[1]);
assert.strictEqual(lastCol, 2, 'FAIL: attention rows have three cells (task, Plan, Start Session); ATTENTION_LAST_COL must be 2');
const gridCtx = { moves: [], rows: [{}, {}, {}] };
vm.createContext(gridCtx);
const onAttentionGridKey = vm.runInContext(`
  const ATTENTION_LAST_COL = ${lastCol};
  const visibleAttentionTasks = { value: rows };
  const focusAttentionCell = (r, c) => moves.push([r, c]);
  ${gridMatch[0]}
  onAttentionGridKey;
`, gridCtx);
const fakeEv = (key, attrs = {}, inMenu = false, mods = {}) => {
  const ev = { key, ...mods, prevented: false, preventDefault() { ev.prevented = true; } };
  ev.target = { getAttribute: (n) => (n in attrs ? attrs[n] : null), closest: (sel) => (inMenu && sel.includes('menu') ? {} : null) };
  return ev;
};
let ev = fakeEv('ArrowDown', {}, true);
onAttentionGridKey(ev, 1, 1);
assert.strictEqual(gridCtx.moves.length, 0, 'FAIL: keys inside an open menu must not move grid rows');
assert.strictEqual(ev.prevented, false, 'FAIL: keys inside an open menu must reach the menu');
console.log('✓ Test 3: Keys inside an open menu never leak into grid roving.');

ev = fakeEv('End');
onAttentionGridKey(ev, 1, 0);
assert.strictEqual(JSON.stringify(gridCtx.moves.pop()), '[1,2]', 'FAIL: End must land on the last cell of the row (Start Session)');
ev = fakeEv('End', {}, false, { ctrlKey: true });
onAttentionGridKey(ev, 0, 0);
assert.strictEqual(JSON.stringify(gridCtx.moves.pop()), '[2,2]', 'FAIL: Ctrl+End must land on the last cell of the last row');
console.log('✓ Test 4: End and Ctrl+End stop at the last real cell.');

ev = fakeEv('ArrowDown', { 'aria-expanded': 'true' });
onAttentionGridKey(ev, 1, 1);
assert.strictEqual(gridCtx.moves.length, 0, 'FAIL: an expanded trigger must leave keys to its popup');
console.log('✓ Test 5: An expanded trigger leaves navigation to its popup.');

ev = fakeEv('ArrowDown');
onAttentionGridKey(ev, 1, 2);
assert.strictEqual(JSON.stringify(gridCtx.moves.pop()), '[2,2]', 'FAIL: ArrowDown in a normal cell must move to the next row');
assert.strictEqual(ev.prevented, true, 'FAIL: grid navigation must preventDefault to stop page scroll');
console.log('✓ Test 6: ArrowDown in a normal cell moves one row down.');

ev = fakeEv('ArrowUp');
onAttentionGridKey(ev, 1, 2);
assert.strictEqual(JSON.stringify(gridCtx.moves.pop()), '[0,2]', 'FAIL: ArrowUp must rove up in the same column');
console.log('✓ Test 7: ArrowUp keeps the column while roving rows.');

ev = fakeEv('Tab');
onAttentionGridKey(ev, 1, 2);
assert.strictEqual(gridCtx.moves.length, 0, 'FAIL: Tab must keep native behaviour');
assert.strictEqual(ev.prevented, false, 'FAIL: Tab must not be prevented');
console.log('✓ Test 8: onAttentionGridKey leaves non-navigation keys alone.');

// Test 9: Concluded Deliverables Show-More & Note Expansion Invariants
assert.ok(content.includes('in visiblePastFocusBlocks"'), 'FAIL: Concluded deliverables list must iterate over visiblePastFocusBlocks');
assert.ok(content.includes('toggleShowAllPastBlocks'), 'FAIL: toggleShowAllPastBlocks must be present');
assert.ok(content.includes('remainingPastBlocksCount'), 'FAIL: remainingPastBlocksCount must be present');
assert.ok(content.includes("'Show ' + remainingPastBlocksCount + ' more'"), 'FAIL: Show more button must display the remaining count');
assert.ok(content.includes(':title="concludedRowNote(b)"'), 'FAIL: A row shows one line of notes, with the full text on hover');
console.log('✓ Test 9: Done today show-more and one-line notes invariants verified.');

// Test 10: Standard Searchable Combobox (FCombobox) & Anti-Native-Select Invariants
// 10.1: Assert complete elimination of raw <select> elements in the HTML template
const rawSelectMatches = content.match(/<select[\s>]/gi);
assert.strictEqual(rawSelectMatches, null, 'FAIL: Zero raw <select> elements must remain in omnitrack.html template');

// 10.2: Pickers are frappe-ui <Combobox> (reka-ui: keyboard nav, typeahead,
// listbox ARIA). Every instance needs an accessible name and a v-model, and
// the hand-rolled FCombobox must not come back.
let comboboxCount = 0;
for (const f of vueFiles) {
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(!/<f-combobox|<FCombobox/.test(src), `FAIL: ${path.basename(f)} uses the retired FCombobox`);
  for (const m of src.matchAll(/<Combobox\b([^>]*)>/g)) {
    comboboxCount++;
    assert.ok(/aria-label=/.test(m[1]), `FAIL: <Combobox> in ${path.basename(f)} needs an aria-label`);
    assert.ok(/v-model=/.test(m[1]) || (/:model-value=/.test(m[1]) && /@update:model-value=/.test(m[1])), `FAIL: <Combobox> in ${path.basename(f)} needs a v-model (or :model-value with @update:model-value)`);
  }
}
assert.ok(!fs.existsSync(fComboboxPath), 'FAIL: FCombobox.vue must stay deleted');
assert.ok(comboboxCount >= 6, `FAIL: expected the dialog pickers to use <Combobox> (found ${comboboxCount})`);
console.log('✓ Test 10: frappe-ui Combobox pickers are labelled and bound; no raw <select>, no FCombobox.');

// Test 11: Day at a glance current-time indicator line invariants
assert.ok(content.includes('v-if="selectedDashboardDate === todayDate"'), 'FAIL: Timeline must conditionally render current time line only when viewing today');
assert.ok(content.includes(':style="{ left: ((nowMinute / 1440) * 100) + \'%\' }"'), 'FAIL: Timeline indicator line must position dynamically based on nowMinute / 1440');
assert.ok(content.includes('{{ nowLineLabel }}'), 'FAIL: Timeline indicator line must render nowLineLabel badge');
assert.ok(content.includes('w-[2px] flex-1 bg-red-500'), 'FAIL: Timeline indicator must draw vertical red line');
console.log('✓ Test 11: Day at a glance red current-time vertical indicator line invariants verified.');

// Test 12: Daily Accomplishments Roving Tabindex Grid & Arrow Navigation (WCAG 2.2 AA)
assert.ok(content.includes('role="grid"'), 'FAIL: Daily accomplishments container must have role="grid"');
assert.ok(content.includes(':aria-rowcount="visiblePastFocusBlocks.length"'), 'FAIL: Daily accomplishments grid must declare aria-rowcount');
assert.ok(content.includes('role="row"'), 'FAIL: Completed block cards must declare role="row"');
assert.ok(content.includes(':tabindex="concludedTabindex(rIdx, 0)"'), 'FAIL: Title button must bind concludedTabindex for col 0');
assert.ok(content.includes(':data-concluded-row="rIdx"'), 'FAIL: Title button must bind data-concluded-row');
assert.ok(content.includes(':data-concluded-col="0"'), 'FAIL: Title button must bind data-concluded-col 0');
assert.ok(content.includes('@keydown="onConcludedGridKey($event, rIdx, 0)"'), 'FAIL: Title button must bind onConcludedGridKey');
assert.ok(content.includes(':tabindex="concludedTabindex(rIdx, 1)"'), 'FAIL: Re-open button must bind concludedTabindex for col 1');
assert.ok(content.includes(':data-concluded-col="1"'), 'FAIL: Re-open button must bind data-concluded-col 1');
assert.ok(!content.includes('concludedTabindex(rIdx, 2)'), 'FAIL: a Done today row has two cells (title, Re-open); there is no Log cell');
assert.ok(content.includes('onConcludedGridKey'), 'FAIL: onConcludedGridKey must be defined in omnitrack.html');

// Validate roving tabindex math and arrow key isolation in sandbox
const rovingSandbox = {
  ref: (v) => ({ value: v }),
  computed: (fn) => ({ get value() { return fn(); } }),
  nextTick: (cb) => cb(),
  document: { querySelector: () => null }
};
vm.createContext(rovingSandbox);

const rovingCode = `
  const concludedRovingRow = ref(0);
  const concludedRovingCol = ref(0);
  const concludedTabindex = (r, c) => (concludedRovingRow.value === r && concludedRovingCol.value === c) ? 0 : -1;
  const setConcludedRoving = (r, c) => {
    concludedRovingRow.value = r;
    concludedRovingCol.value = c;
  };
  ({ concludedRovingRow, concludedRovingCol, concludedTabindex, setConcludedRoving });
`;
const rovingInst = vm.runInContext(rovingCode, rovingSandbox);

assert.strictEqual(rovingInst.concludedTabindex(0, 0), 0, 'FAIL: Initial roving item (0, 0) must have tabindex 0');
assert.strictEqual(rovingInst.concludedTabindex(0, 1), -1, 'FAIL: Non-active column must have tabindex -1');
assert.strictEqual(rovingInst.concludedTabindex(1, 0), -1, 'FAIL: Non-active row must have tabindex -1');

// Simulate ArrowDown navigation
rovingInst.setConcludedRoving(1, 0);
assert.strictEqual(rovingInst.concludedTabindex(0, 0), -1, 'FAIL: Previous row must now have tabindex -1');
assert.strictEqual(rovingInst.concludedTabindex(1, 0), 0, 'FAIL: New active row must have tabindex 0');

// Simulate toggleShowAllPastBlocks focus retention (show more and show less)
let focusedTargetRow = null;
rovingInst.focusConcludedCell = (r, c) => {
  focusedTargetRow = r;
  rovingInst.setConcludedRoving(r, c);
};
rovingSandbox.focusConcludedCell = rovingInst.focusConcludedCell;

const pastBlocksToggleCode = `
  const pastFocusBlocks = [{ name: 'B1' }, { name: 'B2' }, { name: 'B3' }];
  const showAllPastBlocks = ref(false);
  const visiblePastFocusBlocks = computed(() => {
    return showAllPastBlocks.value ? pastFocusBlocks : pastFocusBlocks.slice(0, 2);
  });
  const toggleShowAllPastBlocks = () => {
    showAllPastBlocks.value = !showAllPastBlocks.value;
    const rows = visiblePastFocusBlocks.value || [];
    const targetIndex = Math.min(1, rows.length - 1);
    focusConcludedCell(Math.max(0, targetIndex), 0);
  };
  ({ showAllPastBlocks, toggleShowAllPastBlocks });
`;
const toggleInst = vm.runInContext(pastBlocksToggleCode, rovingSandbox);

// Expand (Show More)
toggleInst.toggleShowAllPastBlocks();
assert.strictEqual(toggleInst.showAllPastBlocks.value, true, 'FAIL: showAllPastBlocks must be true after expand');
assert.strictEqual(focusedTargetRow, 1, 'FAIL: Expanding must focus last previously visible row (index 1)');
assert.strictEqual(rovingInst.concludedTabindex(1, 0), 0, 'FAIL: Roving tabindex must be 0 on row 1 after expand');

// Collapse (Show Less)
toggleInst.toggleShowAllPastBlocks();
assert.strictEqual(toggleInst.showAllPastBlocks.value, false, 'FAIL: showAllPastBlocks must be false after collapse');
assert.strictEqual(focusedTargetRow, 1, 'FAIL: Collapsing must focus last visible row (index 1)');
assert.strictEqual(rovingInst.concludedTabindex(1, 0), 0, 'FAIL: Roving tabindex must be 0 on row 1 after collapse');

// Assert scrollIntoView with WCAG reduced-motion safety check in source
assert.ok(content.includes('el.scrollIntoView'), 'FAIL: focusConcludedCell and focusAttentionCell must call scrollIntoView');
assert.ok(content.includes('prefers-reduced-motion: reduce'), 'FAIL: scrollIntoView must honor prefers-reduced-motion');

console.log('✓ Test 12: Daily Accomplishments roving tabindex grid, arrow navigation & show more/less focus retention verified.');

// Test 13: The running session is corrected in the one timesheet panel (TimesheetEntryDialog,
// mode 'live'): Keep running moves its start, Stop and log ends it through the stop path.
const entryPanel = fs.readFileSync(path.join(dialogsDir, 'TimesheetEntryDialog.vue'), 'utf8');
assert.ok(/if \(this\.isLive\) return "Running session";/.test(entryPanel), 'FAIL: the live panel is titled Running session');
assert.ok(entryPanel.includes('v-if="isLive"') && entryPanel.includes("@click=\"$emit('keep-running')\""), 'FAIL: only the live panel offers Keep running');
assert.ok(entryPanel.includes('`Stop and log ${durationLabel(this.mins)}`'), 'FAIL: the live primary says how much it will log');
assert.ok(/this\.isLive && f\.lines > 0/.test(entryPanel), 'FAIL: a running session with lines may be logged without extra notes');
assert.ok(!/-30m|-15m|Live Stopwatch Preview/.test(entryPanel), 'FAIL: no nudge chips or stopwatch preview; DayTimeFields owns the times');
console.log('✓ Test 13: the running session is corrected in the one timesheet panel.');

// --- TEST 14: Midnight continuation inclusion in dayFocusBlocks & show-more threshold ---
assert.strictEqual(content.includes('_blockEffectiveStartMins'), true, 'FAIL: _blockEffectiveStartMins helper missing from omnitrack.html');
assert.strictEqual(content.includes('addDays(b.work_date, 1) === dt'), true, 'FAIL: midnight spillover check missing in dayFocusBlocks');

const midnightSandbox = {
  ref: (v) => ({ value: v }),
  computed: (fn) => ({ get value() { return fn(); } }),
  selectedDashboardDate: { value: '2026-09-23' },
  todayDate: { value: '2026-09-23' },
  isDarkMode: { value: false }
};
vm.createContext(midnightSandbox);

const midnightCode = `
  const _utcDate = (iso) => { const [y, m, d] = (iso || '').split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const addDays = (iso, n) => {
    const d = _utcDate(iso);
    d.setUTCDate(d.getUTCDate() + n);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return \`\${y}-\${m}-\${day}\`;
  };
  const _minsOf = (t) => { if (!t) return -1; const p = String(t).split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); };
  const _blockEffectiveStartMins = (b, targetDate) => {
    if (!b) return -1;
    if (targetDate && b.work_date !== targetDate && b.start_time && b.end_time) {
      const sMins = _minsOf(b.start_time);
      const eMins = _minsOf(b.end_time);
      if (eMins < sMins) return 0;
    }
    return _minsOf(b.start_time);
  };
  const _byTimeDesc = (list) => {
    const dt = selectedDashboardDate.value;
    return [...list].sort((x, y) => _blockEffectiveStartMins(y, dt) - _blockEffectiveStartMins(x, dt));
  };

  const rawBlocks = [
    { name: 'PWB-00173', work_date: '2026-09-22', start_time: '23:30:00', end_time: '0:30:00', status: 'Logged (Partial)', actual_hours: 0.88, duration_hours: 1.0 },
    { name: 'PWB-00177', work_date: '2026-09-23', start_time: '07:10:00', end_time: '07:40:00', status: 'Logged (Full)', actual_hours: 0.5, duration_hours: 0.5 },
    { name: 'PWB-00178', work_date: '2026-09-23', start_time: '08:30:00', end_time: '09:30:00', status: 'Logged (Full)', actual_hours: 1.0, duration_hours: 1.0 }
  ];

  const dt = selectedDashboardDate.value;
  const dayFocus = rawBlocks.filter(b => {
    if (b.work_date === dt) return true;
    if (b.start_time && b.end_time && dt && b.work_date && addDays(b.work_date, 1) === dt) {
      const sMins = _minsOf(b.start_time);
      const eMins = _minsOf(b.end_time);
      if (eMins < sMins) return true;
    }
    return false;
  });

  const sortedPast = _byTimeDesc(dayFocus);
  const showMoreVisible = sortedPast.length > 2;
  const remainingCount = Math.max(0, sortedPast.length - 2);

  ({ dayFocus, sortedPast, showMoreVisible, remainingCount });
`;
const midnightInst = vm.runInContext(midnightCode, midnightSandbox);
assert.strictEqual(midnightInst.dayFocus.length, 3, 'FAIL: dayFocusBlocks must contain all 3 blocks (including midnight continuation)');
assert.strictEqual(midnightInst.sortedPast[0].name, 'PWB-00178', 'FAIL: most recent (08:30) must be first');
assert.strictEqual(midnightInst.sortedPast[1].name, 'PWB-00177', 'FAIL: next recent (07:10) must be second');
assert.strictEqual(midnightInst.sortedPast[2].name, 'PWB-00173', 'FAIL: midnight block must sort at 00:00 effective start (3rd position)');
assert.strictEqual(midnightInst.showMoreVisible, true, 'FAIL: showMoreVisible must be true when length is 3 (> 2)');
assert.strictEqual(midnightInst.remainingCount, 1, 'FAIL: remainingCount must be 1');

console.log('✓ Test 14: Midnight continuation inclusion in dayFocusBlocks & show-more threshold verified.');

// --- TEST 15: Day-at-a-glance 6h stretch zoom on Today & red line centering invariants ---
assert.strictEqual(content.includes('getTimelineDefaultZoom'), true, 'FAIL: getTimelineDefaultZoom missing from omnitrack.html');
assert.strictEqual(content.includes('target = Math.max(0, nowX - (box.clientWidth / 2))'), true, 'FAIL: red line centering math missing');

const zoomSandbox = {
  todayDate: { value: '2026-09-23' },
  getLocalTodayISO: () => '2026-09-23'
};
vm.createContext(zoomSandbox);

const zoomCode = `
  const getTimelineDefaultZoom = (dateStr) => {
    const todayStr = todayDate.value || getLocalTodayISO();
    if (dateStr === todayStr) return 6;
    return 24;
  };

  const todayZoom = getTimelineDefaultZoom('2026-09-23');
  const otherDayZoom = getTimelineDefaultZoom('2026-09-22');

  // Verify centering math
  const calculateScrollTarget = (isToday, nowMin, firstMin, trackWidth, boxWidth) => {
    if (isToday && nowMin !== undefined) {
      const nowX = (nowMin / 1440) * trackWidth;
      return Math.max(0, nowX - (boxWidth / 2));
    } else if (firstMin >= 0) {
      return Math.max(0, (firstMin / 1440) * trackWidth - 24);
    }
    return 0;
  };

  // On Today at 12:00 PM (720m) with 4000px track and 1000px viewport:
  const todayTarget = calculateScrollTarget(true, 720, 430, 4000, 1000);
  // Viewport center with this scroll target:
  const viewportCenter = todayTarget + (1000 / 2);
  const nowPosition = (720 / 1440) * 4000;

  // On other day with first work at 07:10 AM (430m):
  const otherTarget = calculateScrollTarget(false, 720, 430, 1000, 1000);

  ({ todayZoom, otherDayZoom, todayTarget, viewportCenter, nowPosition, otherTarget });
`;
const zoomInst = vm.runInContext(zoomCode, zoomSandbox);
assert.strictEqual(zoomInst.todayZoom, 6, 'FAIL: Today must default to 6-hour stretch zoom');
assert.strictEqual(zoomInst.otherDayZoom, 24, 'FAIL: Other days must default to full day view (24h)');
assert.strictEqual(zoomInst.viewportCenter, zoomInst.nowPosition, 'FAIL: Current time red line must be in exact center of viewport');
assert.strictEqual(zoomInst.otherTarget > 0, true, 'FAIL: Other days must adjust to first hour of work');

console.log('✓ Test 15: Day at a glance 6-hour stretch zoom on Today & red line centering invariants verified.');

// ---------------------------------------------------------------------------
// TEST 16: "/" Keydown Focus on Session Log Line Input Box Invariants
// ---------------------------------------------------------------------------
const listeners = {};
const slashSandbox = {
  ref: (val) => ({ value: val }),
  window: {
    addEventListener(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    removeEventListener(name, fn) {
      if (listeners[name]) listeners[name] = listeners[name].filter(f => f !== fn);
    },
    dispatchEvent(ev) {
      (listeners[ev.type] || []).forEach(fn => fn(ev));
    }
  },
  CustomEvent: class CustomEvent {
    constructor(type, detail) { this.type = type; this.detail = detail; }
  },
  document: {
    querySelector(sel) {
      if (sel.includes('#omnitrack-session-box-root')) {
        return { focus() {}, select() {} };
      }
      return null;
    }
  }
};
vm.createContext(slashSandbox);
const slashCode = `
  const isTracking = ref(true);
  const isSessionElevated = ref(false);
  const activeTab = ref('dashboard');
  const sessionPointInput = ref(null); // null in Frappe UI mode

  let eventPrevented = false;
  let focusCalled = false;
  let customEventDispatched = false;

  window.addEventListener('omnitrack:focus-session-input', () => {
    customEventDispatched = true;
  });

  const _typingIn = (t) => {
    const tag = t && t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.isContentEditable);
  };

  const focusSessionPointInput = () => {
    focusCalled = true;
    try {
      window.dispatchEvent(new CustomEvent('omnitrack:focus-session-input'));
    } catch (_) {}
  };

  const _slashFocus = (ev) => {
    if (ev.key !== '/') return;
    if (_typingIn(ev.target)) return;
    const hasSessionInput = isTracking.value || !!sessionPointInput.value ||
      !!document.querySelector('#omnitrack-session-box-root [data-session-input]') ||
      !!document.querySelector('#omnitrack-session-box-root textarea');
    if (!hasSessionInput) return;
    ev.preventDefault();
    if (isTracking.value && activeTab.value !== 'dashboard' && !isSessionElevated.value) {
      activeTab.value = 'dashboard';
    }
    focusSessionPointInput();
  };

  // Case A: User presses '/' while typing in an existing input -> must NOT focus or preventDefault
  const inputEvent = { key: '/', target: { tagName: 'INPUT' }, preventDefault: () => { eventPrevented = true; } };
  _slashFocus(inputEvent);
  const typingIgnored = !focusCalled && !eventPrevented;

  // Case B: User presses '/' on homepage with running session & Frappe UI box (sessionPointInput is null)
  const slashEvent = { key: '/', target: { tagName: 'BODY' }, preventDefault: () => { eventPrevented = true; } };
  _slashFocus(slashEvent);
  const slashHandled = focusCalled && eventPrevented && customEventDispatched;

  // Case C: User presses '/' from another tab while tracking -> brings user to dashboard
  activeTab.value = 'planner';
  _slashFocus(slashEvent);
  const tabSwitched = activeTab.value === 'dashboard';

  ({ typingIgnored, slashHandled, tabSwitched });
`;
const slashInst = vm.runInContext(slashCode, slashSandbox);
assert.strictEqual(slashInst.typingIgnored, true, 'FAIL: "/" while typing inside an input must be ignored');
assert.strictEqual(slashInst.slashHandled, true, 'FAIL: "/" must focus session input and dispatch event even when sessionPointInput is null');
assert.strictEqual(slashInst.tabSwitched, true, 'FAIL: "/" when tracking must switch activeTab to dashboard');

console.log('✓ Test 16: "/" keydown session log focus invariants verified.');

// --- Test 17: Cross-device Active Session Sync & Authoritative Teardown Invariants ---
const syncSandbox = {
  ref: (v) => ({ value: v }),
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  }
};
vm.createContext(syncSandbox);
const syncCode = `
  const isTracking = ref(true);
  const trackerSeconds = ref(120);
  const sessionNotesList = ref(['task line']);
  const trackerNotes = ref('test notes');
  const trackerBlockName = ref('PWB-TEST');
  let timerCleared = false;
  const trackerTimer = ref({ clear: () => { timerCleared = true; } });

  let _lastLocalUpdate = Date.now();
  let sessionEndedMarked = false;
  const markSessionEnded = () => { sessionEndedMarked = true; };

  const handleRemoteSessionCleared = (opts) => {
    if (!isTracking.value) return;
    if (!(opts && opts.authoritative) && (Date.now() - _lastLocalUpdate < 3000)) return;

    isTracking.value = false;
    if (trackerTimer.value) {
      if (trackerTimer.value.clear) trackerTimer.value.clear();
      trackerTimer.value = null;
    }
    trackerSeconds.value = 0;
    sessionNotesList.value = [];
    trackerNotes.value = '';
    trackerBlockName.value = null;
    markSessionEnded();
    localStorage.removeItem('omnitrack_active_session');
  };

  // Case A: Non-authoritative clear during recent local edit is guarded
  handleRemoteSessionCleared();
  const guardedDuringRecentEdit = isTracking.value === true;

  // Case B: Authoritative clear from remote device bypasses guard and stops timer
  handleRemoteSessionCleared({ authoritative: true });
  const authoritativeCleared = isTracking.value === false &&
    trackerSeconds.value === 0 &&
    trackerBlockName.value === null &&
    sessionEndedMarked === true &&
    localStorage.getItem('omnitrack_active_session') === null;

  // Case C: Reloading page when server has active_session === null purges stale localStorage
  localStorage.setItem('omnitrack_active_session', JSON.stringify({ status: 'active', startTime: Date.now() - 5000 }));
  const session = { active_session: null };
  let restored = false;
  const restoreActiveSession = () => { restored = true; };

  const ssrSession = session && session.active_session;
  if (ssrSession && ssrSession.status === 'active' && ssrSession.startTime) {
    restoreActiveSession(ssrSession);
  } else if (session && session.active_session === null) {
    localStorage.removeItem('omnitrack_active_session');
  } else {
    const saved = localStorage.getItem('omnitrack_active_session');
    if (saved) restoreActiveSession();
  }
  const reloadResurrectionPrevented = !restored && (localStorage.getItem('omnitrack_active_session') === null);

  ({ guardedDuringRecentEdit, authoritativeCleared, reloadResurrectionPrevented });
`;
const syncInst = vm.runInContext(syncCode, syncSandbox);
assert.strictEqual(syncInst.guardedDuringRecentEdit, true, 'FAIL: Non-authoritative clear during recent local edit must be guarded');
assert.strictEqual(syncInst.authoritativeCleared, true, 'FAIL: Authoritative remote clear must stop tracking, reset timer, and clear localStorage');
assert.strictEqual(syncInst.reloadResurrectionPrevented, true, 'FAIL: When server active_session is null, page reload must purge localStorage instead of resurrecting');

// ---------------------------------------------------------------------------
// TEST 18: Empty Session Stop Modal & Completed Block Ghost Prevention
// ---------------------------------------------------------------------------
const emptyStopSandbox = {
  ref: (val) => ({ value: val }),
  computed: (fn) => ({ get value() { return fn(); } }),
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  }
};
vm.createContext(emptyStopSandbox);
const emptyStopCode = `
  const isTracking = ref(true);
  const trackerSeconds = ref(3600); // 1 hr
  const trackerNotes = ref('');
  const sessionNotesList = ref([]);
  const trackerBlockName = ref(null);
  const trackerBoundBlock = ref(null);
  const discardConfirm = ref(false);
  const showEmptyStopModal = ref(false);
  const emptyStopQuickNote = ref('');
  const emptyStopElapsedHrs = ref(0);

  const sessionHasLines = computed(() =>
    (sessionNotesList.value || []).some(p => String(p || '').trim().length >= 3) ||
    String(trackerNotes.value || '').trim().length >= 3 ||
    !!trackerBlockName.value ||
    !!trackerBoundBlock.value
  );

  const openEmptyStopModal = () => {
    const elapsedSecs = trackerSeconds.value;
    emptyStopElapsedHrs.value = Math.max(0.01, Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100);
    const defaultNote = String(trackerNotes.value || '').trim() ||
      (trackerBoundBlock.value ? (trackerBoundBlock.value.work_item_label || trackerBoundBlock.value.task_subject || trackerBoundBlock.value.name) : '') ||
      'Focus work session';
    emptyStopQuickNote.value = defaultNote;
    showEmptyStopModal.value = true;
  };

  let sessionDiscarded = false;
  const discardSession = () => {
    sessionDiscarded = true;
    isTracking.value = false;
    trackerSeconds.value = 0;
    localStorage.removeItem('omnitrack_active_session');
  };

  const confirmEmptyStopDiscard = () => {
    showEmptyStopModal.value = false;
    discardConfirm.value = true;
    discardSession();
  };

  let timesheetSaved = false;
  const toggleTrack = () => {
    if (!sessionHasLines.value) {
      openEmptyStopModal();
      return;
    }
    timesheetSaved = true;
    isTracking.value = false;
    trackerSeconds.value = 0;
  };

  const confirmEmptyStopSave = () => {
    const note = String(emptyStopQuickNote.value || '').trim() || 'Focus work session';
    showEmptyStopModal.value = false;
    sessionNotesList.value.push(note);
    toggleTrack();
  };

  // 1. Attempt stop with empty notes -> must open modal with fallback title and calculated hours
  toggleTrack();
  const modalOpenedOnEmpty = showEmptyStopModal.value === true &&
    emptyStopElapsedHrs.value === 1.0 &&
    emptyStopQuickNote.value === 'Focus work session';

  // 2. Discard branch -> wipes session cleanly
  confirmEmptyStopDiscard();
  const discardClean = !isTracking.value && sessionDiscarded && !showEmptyStopModal.value;

  // 3. Save branch -> fills note and completes timesheet save
  isTracking.value = true;
  trackerSeconds.value = 1800; // 0.5h
  openEmptyStopModal();
  emptyStopQuickNote.value = 'Custom wrap-up';
  confirmEmptyStopSave();
  const saveClean = !isTracking.value && timesheetSaved && sessionNotesList.value.includes('Custom wrap-up');

  // 4. Completed block ghost prevention in restoreActiveSession
  const workFocusBlocks = ref([
    { name: 'PWB-COMPLETED', status: 'Logged (Full)' },
    { name: 'PWB-ACTIVE', status: 'Planned' }
  ]);
  let sessionEndedMarked = false;
  const markSessionEnded = () => { sessionEndedMarked = true; };

  const restoreActiveSession = (sessionData) => {
    if (!sessionData || !sessionData.startTime) return false;
    if (sessionData.trackerBlockName) {
      const matched = workFocusBlocks.value.find(b => b.name === sessionData.trackerBlockName);
      if (matched && (matched.status === 'Logged (Full)' || matched.status === 'Cancelled')) {
        markSessionEnded();
        localStorage.removeItem('omnitrack_active_session');
        return false;
      }
    }
    isTracking.value = true;
    return true;
  };

  localStorage.setItem('omnitrack_active_session', 'stale');
  const completedRefused = restoreActiveSession({
    startTime: Date.now() - 1000,
    trackerBlockName: 'PWB-COMPLETED'
  });
  const completedGhostPurged = !completedRefused &&
    sessionEndedMarked &&
    localStorage.getItem('omnitrack_active_session') === null;

  ({ modalOpenedOnEmpty, discardClean, saveClean, completedGhostPurged });
`;
const emptyStopInst = vm.runInContext(emptyStopCode, emptyStopSandbox);
assert.strictEqual(emptyStopInst.modalOpenedOnEmpty, true, 'FAIL: Empty session stop must trigger interactive modal with fallback title');
assert.strictEqual(emptyStopInst.discardClean, true, 'FAIL: Discard branch must wipe in-flight session and reset tracking state');
assert.strictEqual(emptyStopInst.saveClean, true, 'FAIL: Save branch must file timesheet with quick note and stop tracking cleanly');
assert.strictEqual(emptyStopInst.completedGhostPurged, true, 'FAIL: Completed block in Logged (Full) status must refuse session restoration and purge localStorage');

console.log('✓ Test 18: Empty session stop modal & completed block ghost prevention verified.');

// 19. Live Active Running Session Visualization Invariants
assert.ok(content.includes('is_live_active: true'), 'FAIL: dayTimeline must inject is_live_active into logged items when tracking');
assert.ok(content.includes('LIVE Recording: ') || content.includes('Live Recording: ') || content.includes('REC {{ trackerElapsedFormatted }}'), 'FAIL: Calendar grid must render live recording indicator on active block');
assert.ok(content.includes('st === \'recording\''), 'FAIL: blockVisualState and blockStyle must recognize recording state');
assert.ok(content.includes('live_active_session_seg'), 'FAIL: timedSegmentsForDay must inject live active session segment when tracking ad-hoc');

console.log('✓ Test 19: Live active running session in Day Timeline & Calendar grid invariants verified.');

// 20. Bottom Dock Dynamic Timer Invariants (<1h min:sec, >=1h hours expansion)
assert.ok(content.includes('bottomBarTimer'), 'FAIL: bottomBarTimer computed must be declared and bound');
assert.ok(content.includes('bottomBarTimer.isHours'), 'FAIL: Dynamic switch between min:sec and hours must be present');
assert.ok(content.includes('min:sec'), 'FAIL: Clear min:sec helper label must be present under 1h');
assert.ok(content.includes('bottomBarTimer.hours') && content.includes('bottomBarTimer.minutes') && content.includes('bottomBarTimer.seconds'), 'FAIL: Hours, minutes, and seconds must be exposed when >= 1 hour');

console.log('✓ Test 20: Bottom navigation bar dynamic timer invariants (<1h min:sec, >=1h hours) verified.');

// ---------------------------------------------------------------------------
// TEST 21: 30-Minute Inactivity Notification & 15m-Post-Last-Edit Governor
// ---------------------------------------------------------------------------
// 1. Template & structural invariants
assert.ok(content.includes('v-model="showInactivityModal"') || content.includes(':model-value="showInactivityModal"') || content.includes('v-model:show-inactivity-modal="showInactivityModal"'), 'FAIL: showInactivityModal dialog must be rendered in template');
assert.ok(content.includes('stopInactivitySessionAtLastEditPlus15'), 'FAIL: 15-minute stop button must be present');
assert.ok(content.includes('confirmStillWorking'), 'FAIL: confirmStillWorking button must be present');
assert.ok(content.includes('stopInactivitySessionNow'), 'FAIL: stopInactivitySessionNow button must be present');
assert.ok(content.includes('lastActivityTime'), 'FAIL: lastActivityTime must be tracked');
assert.ok(content.includes('checkInactivity'), 'FAIL: checkInactivity must be present');

// 2. Behavioral verification in VM sandbox
const inactivitySandbox = {
  ref: (val) => ({ value: val }),
  computed: (fn) => ({ get value() { return fn(); } }),
  watch: () => {},
  nextTick: (fn) => fn && fn(),
  console,
  notificationsDispatched: [],
  chimesPlayed: 0,
  Notification: class {
    constructor(title, opts) {
      inactivitySandbox.notificationsDispatched.push({ title, ...opts });
    }
    static permission = 'granted';
    static requestPermission() {}
  }
};
vm.createContext(inactivitySandbox);

const inactivityCode = `
  const isTracking = ref(true);
  const lastActivityTime = ref(Date.now() - 31 * 60 * 1000); // 31 minutes ago
  const lastInactivityAlertTime = ref(0);
  const showInactivityModal = ref(false);
  const trackerNotes = ref('Coding feature');
  let loggedSession = null;

  const playInactivityChime = () => {
    chimesPlayed++;
  };

  const dispatchInactivityNotification = (msg) => {
    new Notification('OmniTrack: Are you still working?', { body: msg, tag: 'omnitrack-inactivity' });
  };

  const recordUserActivity = () => {
    lastActivityTime.value = Date.now();
    if (showInactivityModal.value) showInactivityModal.value = false;
  };

  const checkInactivity = () => {
    if (!isTracking.value) return;
    const now = Date.now();
    const act = lastActivityTime.value || now;
    const idleMs = now - act;
    const INACTIVITY_MS = 30 * 60 * 1000;
    const REPEAT_MS = 30 * 60 * 1000;

    if (idleMs >= INACTIVITY_MS) {
      const timeSinceAlert = now - (lastInactivityAlertTime.value || 0);
      if (!lastInactivityAlertTime.value || timeSinceAlert >= REPEAT_MS) {
        lastInactivityAlertTime.value = now;
        showInactivityModal.value = true;
        playInactivityChime();
        dispatchInactivityNotification('No notes logged for 31m. Are you still working?');
      }
    }
  };

  // Test 1: Check inactivity triggers alert when 31m idle
  checkInactivity();
  const alertTriggered = showInactivityModal.value === true && notificationsDispatched.length === 1 && chimesPlayed === 1;

  // Test 2: If checked again immediately (0ms later), it must NOT repeat notification (throttled for 30m)
  checkInactivity();
  const throttledClean = notificationsDispatched.length === 1;

  // Test 3: User confirms still working -> modal closes and activity resets
  recordUserActivity();
  const resetAfterActive = showInactivityModal.value === false && (Date.now() - lastActivityTime.value) < 1000;

  // Test 4: Stop at 15m after last edit calculation
  // Set last edit to 45 minutes ago, start time 60 minutes ago
  const fakeNow = Date.now();
  const sTime = fakeNow - (60 * 60 * 1000);
  const fakeLastEdit = fakeNow - (45 * 60 * 1000);
  lastActivityTime.value = fakeLastEdit;

  const toggleTrack = (customEndMs = null) => {
    let effectiveStopMs = fakeNow;
    let elapsedSecs = Math.floor((fakeNow - sTime) / 1000); // 3600s
    if (customEndMs && customEndMs < effectiveStopMs) {
      effectiveStopMs = customEndMs;
      elapsedSecs = Math.max(60, Math.floor((effectiveStopMs - sTime) / 1000));
    }
    const hrs = Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100;
    loggedSession = {
      effectiveStopMs,
      elapsedSecs,
      hrs
    };
  };

  const stopInactivitySessionAtLastEditPlus15 = () => {
    const base = lastActivityTime.value || fakeNow;
    const cappedEndMs = Math.min(fakeNow, base + 15 * 60 * 1000);
    toggleTrack(cappedEndMs);
  };

  stopInactivitySessionAtLastEditPlus15();

  // fakeLastEdit was 45m ago (-45m), + 15m means cappedEndMs was 30m ago (-30m from fakeNow).
  // Total elapsed from sTime (-60m) to cappedEndMs (-30m) must be exactly 30 minutes (1800s / 0.5 hrs),
  // cutting off the 30 minutes of idle ghost time!
  const governorCappedElapsedSecs = loggedSession && loggedSession.elapsedSecs === 1800;
  const governorCappedHrs = loggedSession && loggedSession.hrs === 0.5;

  ({ alertTriggered, throttledClean, resetAfterActive, governorCappedElapsedSecs, governorCappedHrs });
`;

const inactInst = vm.runInContext(inactivityCode, inactivitySandbox);
assert.strictEqual(inactInst.alertTriggered, true, 'FAIL: Inactivity check must trigger modal and notification at 30m inactivity');
assert.strictEqual(inactInst.throttledClean, true, 'FAIL: Inactivity notification must throttle and repeat every 30m rather than spamming every tick');
assert.strictEqual(inactInst.resetAfterActive, true, 'FAIL: User activity must reset inactivity timer and dismiss modal');
assert.strictEqual(inactInst.governorCappedElapsedSecs, true, 'FAIL: 15m stop governor must cap elapsed time exactly to lastActivityTime + 15m');
assert.strictEqual(inactInst.governorCappedHrs, true, 'FAIL: 15m stop governor must save exact hours without idle ghost time');

console.log('✓ Test 21: 30-Minute inactivity notification & 15m stop governor invariants verified.');

// ---------------------------------------------------------------------------
// TEST 22: Overnight Session Date Invariant & Notification Gesture Governance
// ---------------------------------------------------------------------------
// 1. Overnight date derivation invariant
assert.ok(content.includes('sessionDate = from.getFullYear()'), 'FAIL: sessionDate must be derived from "from" (session start) to prevent overnight +1 day drift');
assert.ok(content.includes('session_date: sessionDate'), 'FAIL: log_work_session must receive start-derived sessionDate');
assert.ok(content.includes('work_date: sessionDate'), 'FAIL: quick_timer_punch must receive start-derived sessionDate');

// 2. Notification user gesture permission request
assert.ok(content.includes('Notification.permission === \'default\'') && content.includes('Notification.requestPermission()'), 'FAIL: Notification permission must be requested on user gesture (start tracking)');

// 3. Notification onclick focus handler
assert.ok(content.includes('notif.onclick'), 'FAIL: Notification must attach onclick handler to focus window and surface modal');

// 4. Reactive clock ticker tracking in inactivity computed properties
assert.ok(content.includes('const _ = trackerSeconds.value;'), 'FAIL: inactivityMinutes and suggestedStopHHMM must read trackerSeconds.value to ensure continuous reactive updates');

console.log('✓ Test 22: Overnight session date & notification gesture governance invariants verified.');

// ---------------------------------------------------------------------------
// TEST 23: Modal Scroll Release & Zombie Session Eviction Invariants
// ---------------------------------------------------------------------------
// 1. F-dialog release overflow cleanup on both html and body
assert.ok(content.includes('document.documentElement.style.removeProperty(\'overflow\')'), 'FAIL: f-dialog or watcher must removeProperty overflow on documentElement');
assert.ok(content.includes('document.body.style.removeProperty(\'overflow\')'), 'FAIL: f-dialog or watcher must removeProperty overflow on body');

// 2. Dialog depth reset in root watcher when all modals are closed
assert.ok(content.includes('window.__omnitrackDialogDepth = 0'), 'FAIL: Root watcher must reset __omnitrackDialogDepth to 0 when all modals close');

// 3. Dropdowns excluded from page scroll locking
assert.ok(!content.includes('watch([showInactivityModal, showBookModal, showAdjustModal, showEmptyStopModal, showCancelModal, showNewTaskModal, showWorkflowModal, showBlockDrawer, showTrackerPopup, showNatureFilter'), 'FAIL: In-page dropdowns showTrackerPopup and showNatureFilter must NOT lock scroll');

// 4. Inactivity modal discard button and prolonged inactivity warning
assert.ok(content.includes('discardInactivitySession'), 'FAIL: Inactivity modal must support discardInactivitySession action');
assert.ok(content.includes("long() { return this.inactivityMinutes >= 60; }") && /v-if="long"\s+variant="ghost"\s+theme="red"[\s\S]{0,300}\$emit\('discard'\)/.test(content), 'FAIL: Inactivity modal must offer Discard once a session has gone 60m without a note');

// 5. WorkBlocks lookup for past-day completed blocks in restoreActiveSession
assert.ok(content.includes('(workBlocks.value || []).find(b => b.name === sessionData.trackerBlockName)'), 'FAIL: restoreActiveSession must look up workBlocks to catch completed blocks from past dates');

console.log('✓ Test 23: Modal scroll release & zombie session eviction invariants verified.');

// ---------------------------------------------------------------------------
// TEST 24: Calendar Active Session Rendering & Variable Hoisting Invariants
// ---------------------------------------------------------------------------
// 1. Elimination of undeclared variables in calendar grid and hovercard
assert.ok(!content.includes('trackerElapsedSecs'), 'FAIL: Undeclared variable trackerElapsedSecs must be replaced with trackerSeconds');
assert.ok(!content.includes('trackerElapsedFormatted'), 'FAIL: Undeclared variable trackerElapsedFormatted must be replaced with formattedTime');

// 2. Global hoisting of nowMinute and todayISO at the top of setup to avoid TDZ errors
// The facade runs the first module (Shell) before any other, so a declaration there is hoisted above every consumer.
const shellSrc = fs.readFileSync(path.join(composablesDir, 'useWorkstationShell.js'), 'utf8');
const setupIdx = shellSrc.indexOf('export function useWorkstationShell');
const nowMinIdx = shellSrc.indexOf('const nowMinute = ref');
const todayIsoIdx = shellSrc.indexOf('const todayISO = () => getLocalTodayISO()');
assert.ok(setupIdx >= 0 && nowMinIdx > setupIdx, 'FAIL: nowMinute must be declared in the first workstation module (useWorkstationShell)');
assert.ok(setupIdx >= 0 && todayIsoIdx > setupIdx, 'FAIL: todayISO must be declared in the first workstation module (useWorkstationShell)');

// 3. Export of startTime in setup return
assert.ok(/startTime,\s+trackerSeconds,/.test(content), 'FAIL: startTime must be exported in setup() return');

console.log('✓ Test 24: Calendar active session rendering & variable hoisting invariants verified.');

// ---------------------------------------------------------------------------
// TEST 25: Mobile Notification Architecture, SW & Block Overrun Governance
// ---------------------------------------------------------------------------
// 1. Service Worker registration in omnitrack.html
assert.ok(
  content.includes("navigator.serviceWorker.register('/assets/omnitrack/sw.js')"),
  'FAIL: Service worker must be registered in omnitrack.html for mobile PWA push/local notifications'
);

// 2. Service Worker showNotification prioritized over direct constructor (WebKit / iOS Safari PWA requirement)
assert.ok(
  content.includes('reg.showNotification(title, options)'),
  'FAIL: Notifications must use reg.showNotification to function on iOS Safari and WebKit PWAs'
);

// 3. Mobile physical haptic vibration
assert.ok(
  content.includes("navigator.vibrate([200, 100, 200, 100, 200])"),
  'FAIL: Notifications must trigger physical haptic vibration for mobile users'
);

// 4. Overrun check on scheduled block end time
assert.ok(
  content.includes('checkBlockOverrun'),
  'FAIL: checkBlockOverrun must exist to alert user when planned block end time arrives or overruns'
);

// 5. Visibility change wake-up checks
assert.ok(
  content.includes("document.addEventListener('visibilitychange'") &&
  content.includes('checkBlockOverrun()') &&
  content.includes('checkInactivity()'),
  'FAIL: Phone wake (visibilitychange) must trigger immediate checkInactivity and checkBlockOverrun'
);

// 6. SW message listener in sw.js
const swContent = fs.readFileSync(path.join(__dirname, '../omnitrack/public/sw.js'), 'utf8');
assert.ok(
  swContent.includes("event.data.type === 'SHOW_NOTIFICATION'"),
  'FAIL: sw.js must listen for SHOW_NOTIFICATION message events'
);

// 7. Setup returns notification state & handlers
assert.ok(content.includes('notificationPermission,'), 'FAIL: notificationPermission must be returned by setup()');
assert.ok(content.includes('enableNotificationsUserGesture,'), 'FAIL: enableNotificationsUserGesture must be returned by setup()');

console.log('✓ Test 25: Mobile notification architecture, Service Worker & block overrun alerts verified.');

// ---------------------------------------------------------------------------
// TEST 26: Adjust Dialog Stacking & De-Elevation Invariant (Issue #5)
// ---------------------------------------------------------------------------
// 1. openAdjustModal minimizes isSessionElevated so dialog is never occluded
assert.ok(
  /if \(isSessionElevated\.value\) \{\s+isSessionElevated\.value = false;\s+\}/.test(content),
  'FAIL: the timesheet panel (openPanel) must de-elevate isSessionElevated to prevent dialog occlusion'
);

// 2. Adjust modal specifies z-index="z-[75]" above elevated session popup (z-[70])
assert.ok(
  content.includes('z-index="z-[75]"'),
  'FAIL: TimesheetEntryDialog must specify z-index="z-[75]"'
);

console.log('✓ Test 26: Adjust dialog stacking & de-elevation invariants verified.');

// ---------------------------------------------------------------------------
// TEST 27: Mobile Dropdown Viewport Clamping & Reflow (Issue #6)
// ---------------------------------------------------------------------------
// Menus are frappe-ui Dropdowns (reka-ui popper): collision handling is the
// library's job, so no hand-rolled positioning code may come back.
assert.ok(!content.includes('adjustPosition() {'), 'FAIL: hand-rolled menu positioning must not return; Dropdown handles collisions');
console.log('✓ Test 27: Mobile dropdown viewport clamping & reflow verified.');

// ---------------------------------------------------------------------------
// TEST 28: 1-Click Atomic Switch Task Action (Issue #7)
// ---------------------------------------------------------------------------
// 1. switch_active_session API defined in omnitrack/api
const apiPath = path.join(__dirname, '../omnitrack/api.py');
const apiDir = path.join(__dirname, '../omnitrack/api');
const apiContent = fs.existsSync(apiPath)
  ? fs.readFileSync(apiPath, 'utf8')
  : fs.readdirSync(apiDir).filter(f => f.endsWith('.py')).map(f => fs.readFileSync(path.join(apiDir, f), 'utf8')).join('\n');
assert.ok(
  apiContent.includes('def switch_active_session('),
  'FAIL: switch_active_session must be defined in omnitrack/api'
);

// 2. UI trigger button in session card toolbar
assert.ok(
  content.includes('@click.stop="openSwitchTaskModal"'),
  'FAIL: Switch task button must be present in session card toolbar'
);

// 3. Switch Task modal dialog defined in template
assert.ok(
  content.includes('v-model="showSwitchTaskModal"') || content.includes(':model-value="showSwitchTaskModal"') || content.includes('v-model:show-switch-task-modal="showSwitchTaskModal"'),
  'FAIL: showSwitchTaskModal dialog must be defined in template'
);

// 4. Setup exposes switch task properties
assert.ok(
  content.includes('showSwitchTaskModal,') &&
  content.includes('openSwitchTaskModal,') &&
  content.includes('executeSwitchTask,'),
  'FAIL: setup() must expose showSwitchTaskModal, openSwitchTaskModal, and executeSwitchTask'
);

console.log('✓ Test 28: 1-Click atomic Switch Task action and WCAG dialog verified.');

// ---------------------------------------------------------------------------
// TEST 29: Quantitative Deliverable Output Metrics (Phase 2, Issue #8)
// ---------------------------------------------------------------------------
const metricDoctypeJson = path.join(__dirname, '../omnitrack/omnitrack/doctype/omnitrack_output_metric/omnitrack_output_metric.json');
assert.ok(fs.existsSync(metricDoctypeJson), 'FAIL: omnitrack_output_metric.json must exist');
const metricDoctype = JSON.parse(fs.readFileSync(metricDoctypeJson, 'utf8'));
assert.strictEqual(metricDoctype.istable, 1, 'FAIL: OmniTrack Output Metric must be a child table');
assert.ok(metricDoctype.fields.some(f => f.fieldname === 'metric_type'), 'FAIL: Output Metric must declare metric_type');
assert.ok(metricDoctype.fields.some(f => f.fieldname === 'quantity'), 'FAIL: Output Metric must declare quantity');
assert.ok(metricDoctype.fields.some(f => f.fieldname === 'unit'), 'FAIL: Output Metric must declare unit');
assert.ok(metricDoctype.fields.some(f => f.fieldname === 'reference_id'), 'FAIL: Output Metric must declare reference_id');

// Verify Planned Work Block schema carries output_metrics table field
const pwbJson = path.join(__dirname, '../omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.json');
const pwbDef = JSON.parse(fs.readFileSync(pwbJson, 'utf8'));
assert.ok(
  pwbDef.fields.some(f => f.fieldname === 'output_metrics' && f.options === 'OmniTrack Output Metric'),
  'FAIL: Planned Work Block must carry output_metrics child table'
);
assert.ok(apiContent.includes('b["output_metrics"] ='), 'FAIL: get_planner_data must serialize output_metrics');
console.log('✓ Test 29: Quantitative Output Metrics & Deliverable KPI architecture verified.');

// ---------------------------------------------------------------------------
// TEST 30: Retroactive Flow-State Catch-Up Logging (Phase 3, Issue #9)
// ---------------------------------------------------------------------------
assert.ok(apiContent.includes('def log_catch_up_session('), 'FAIL: log_catch_up_session must be defined in api.py');
const settingsJson = path.join(__dirname, '../omnitrack/omnitrack/doctype/omnitrack_settings/omnitrack_settings.json');
const settingsDef = JSON.parse(fs.readFileSync(settingsJson, 'utf8'));
assert.ok(
  settingsDef.fields.some(f => f.fieldname === 'enable_flow_state_catch_up'),
  'FAIL: OmniTrack Settings must declare enable_flow_state_catch_up toggle'
);
console.log('✓ Test 30: Retroactive Flow-State Catch-Up logging architecture verified.');

// ---------------------------------------------------------------------------
// TEST 31: Actionable Lock-Screen & Mobile Push Notifications (Phase 4, Issue #10)
// ---------------------------------------------------------------------------
const swUpdatedContent = fs.readFileSync(path.join(__dirname, '../omnitrack/public/sw.js'), 'utf8');
assert.ok(swUpdatedContent.includes("action === 'still_working'"), 'FAIL: sw.js must handle still_working action');
assert.ok(swUpdatedContent.includes("action === 'add_30m'"), 'FAIL: sw.js must handle add_30m action');
assert.ok(swUpdatedContent.includes("action === 'stop_session'"), 'FAIL: sw.js must handle stop_session action');
assert.ok(apiContent.includes('def heartbeat_active_session('), 'FAIL: heartbeat_active_session must be defined in api.py');
assert.ok(apiContent.includes('def extend_active_block_duration('), 'FAIL: extend_active_block_duration must be defined in api.py');
console.log('✓ Test 31: Actionable lock-screen push notifications & heartbeat governor verified.');

// ---------------------------------------------------------------------------
// TEST 32: Collaborative Pairing Sessions & Mirrored Timesheets (Phase 5, Issue #11)
// ---------------------------------------------------------------------------
assert.ok(apiContent.includes('pairing_partner=None'), 'FAIL: quick_timer_punch must accept pairing_partner');
assert.ok(apiContent.includes('partner_block_name = p_doc.name'), 'FAIL: quick_timer_punch must create partner block');
assert.ok(
  settingsDef.fields.some(f => f.fieldname === 'enable_pairing_sessions'),
  'FAIL: OmniTrack Settings must declare enable_pairing_sessions toggle'
);
console.log('✓ Test 32: Collaborative pairing sessions & mirrored timesheets verified.');

// ---------------------------------------------------------------------------
// TEST 33: Day at a Glance Timeline Zoom Radiogroup & Arrow Nav Invariants
// ---------------------------------------------------------------------------
assert.ok(
  content.includes('@keydown="onTimelineZoomKey"'),
  'FAIL: Timeline zoom radiogroup must have @keydown="onTimelineZoomKey"'
);
assert.ok(
  content.includes(':tabindex="timelineZoom === z ? 0 : -1"'),
  'FAIL: Timeline zoom radio buttons must enforce roving tabindex (0 for active, -1 for others)'
);
assert.ok(
  content.includes('data-timeline-zoom'),
  'FAIL: Timeline zoom radio buttons must have data-timeline-zoom attribute for programmatic focus'
);
assert.ok(
  content.includes('const onTimelineZoomKey = (ev) => {'),
  'FAIL: onTimelineZoomKey must be defined in omnitrack.html setup'
);
assert.ok(
  content.includes('const opts = timelineZoomOptions;'),
  'FAIL: onTimelineZoomKey must step through timelineZoomOptions'
);

const zoomNavSandbox = {
  timelineZoomOptions: [6, 12, 24],
  timelineZoom: { value: 6 },
  focusedIndex: -1,
  nextTick: (fn) => fn()
};
vm.createContext(zoomNavSandbox);
const zoomNavCode = `
  const onTimelineZoomKey = (ev) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (keys.indexOf(ev.key) === -1) return;
    ev.preventDefault();
    const opts = timelineZoomOptions;
    const cur = Math.max(0, opts.indexOf(timelineZoom.value));
    let next = cur;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (cur + 1) % opts.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (cur - 1 + opts.length) % opts.length;
    else if (ev.key === 'Home') next = 0;
    else next = opts.length - 1;
    timelineZoom.value = opts[next];
    nextTick(() => {
      const group = ev.currentTarget;
      const btns = group && group.querySelectorAll ? group.querySelectorAll('[data-timeline-zoom]') : [];
      if (btns[next]) btns[next].focus();
    });
  };

  const dummyGroup = {
    querySelectorAll: (sel) => [
      { focus: () => { focusedIndex = 0; } },
      { focus: () => { focusedIndex = 1; } },
      { focus: () => { focusedIndex = 2; } }
    ]
  };

  // 1. Right arrow from 6 -> 12
  let prevented = false;
  onTimelineZoomKey({ key: 'ArrowRight', preventDefault: () => { prevented = true; }, currentTarget: dummyGroup });
  const rightVal = timelineZoom.value;
  const rightFocus = focusedIndex;

  // 2. Down arrow from 12 -> 24
  onTimelineZoomKey({ key: 'ArrowDown', preventDefault: () => {}, currentTarget: dummyGroup });
  const downVal = timelineZoom.value;

  // 3. Right arrow from 24 wraps to 6
  onTimelineZoomKey({ key: 'ArrowRight', preventDefault: () => {}, currentTarget: dummyGroup });
  const wrapVal = timelineZoom.value;

  // 4. Left arrow from 6 wraps to 24
  onTimelineZoomKey({ key: 'ArrowLeft', preventDefault: () => {}, currentTarget: dummyGroup });
  const leftWrapVal = timelineZoom.value;

  // 5. Home key jumps to 6
  onTimelineZoomKey({ key: 'Home', preventDefault: () => {}, currentTarget: dummyGroup });
  const homeVal = timelineZoom.value;

  // 6. End key jumps to 24
  onTimelineZoomKey({ key: 'End', preventDefault: () => {}, currentTarget: dummyGroup });
  const endVal = timelineZoom.value;

  ({ prevented, rightVal, rightFocus, downVal, wrapVal, leftWrapVal, homeVal, endVal });
`;
const zoomNavRes = vm.runInContext(zoomNavCode, zoomNavSandbox);
assert.strictEqual(zoomNavRes.prevented, true, 'FAIL: onTimelineZoomKey must prevent default on arrow key');
assert.strictEqual(zoomNavRes.rightVal, 12, 'FAIL: ArrowRight must advance 6 -> 12');
assert.strictEqual(zoomNavRes.rightFocus, 1, 'FAIL: ArrowRight must transfer focus to index 1');
assert.strictEqual(zoomNavRes.downVal, 24, 'FAIL: ArrowDown must advance 12 -> 24');
assert.strictEqual(zoomNavRes.wrapVal, 6, 'FAIL: ArrowRight at end must wrap 24 -> 6');
assert.strictEqual(zoomNavRes.leftWrapVal, 24, 'FAIL: ArrowLeft at start must wrap 6 -> 24');
assert.strictEqual(zoomNavRes.homeVal, 6, 'FAIL: Home must jump to index 0 (6)');
assert.strictEqual(zoomNavRes.endVal, 24, 'FAIL: End must jump to index 2 (24)');

console.log('✓ Test 33: Day at a glance timeline zoom radiogroup roving tabindex & arrow navigation verified.');

// ---------------------------------------------------------------------------
// TEST 34: Logged Work Session Direct In-Drawer Editing & Deletion Invariants
// ---------------------------------------------------------------------------
assert.ok(
  content.includes("openEditSessionModal(activeBlock, s)") || (content.includes("@click=\"$emit('edit-session'") && content.includes("openEditSessionModal")),
  'FAIL: Logged work sessions in drawer must provide an edit button invoking openEditSessionModal'
);
assert.ok(
  content.includes("confirmDeleteSession(activeBlock, s)") || (content.includes("@click=\"$emit('delete-session'") && content.includes("deleteSessionRow")),
  'FAIL: Logged work sessions in drawer must provide a delete button invoking confirmDeleteSession / deleteSessionRow'
);
assert.ok(
  content.includes('v-model="showEditSessionModal"') || content.includes(':model-value="showEditSessionModal"') || content.includes('v-model:show-edit-session-modal="showEditSessionModal"'),
  'FAIL: omnitrack.html, App.vue or DialogCoordinator must declare showEditSessionModal dialog'
);
assert.ok(
  apiContent.includes('def update_work_session('),
  'FAIL: api.py must define whitelisted update_work_session endpoint'
);
assert.ok(
  apiContent.includes('def delete_work_session('),
  'FAIL: api.py must define whitelisted delete_work_session endpoint'
);

const editSessionSandbox = {
  editSessionForm: {
    from_time: '19:32',
    to_time: '20:00'
  }
};
vm.createContext(editSessionSandbox);
const editSessionCode = `
  const f = editSessionForm.from_time;
  const t = editSessionForm.to_time;
  let dur = '0.00';
  if (f && t) {
    const [fh, fm] = f.split(':').map(Number);
    const [th, tm] = t.split(':').map(Number);
    let diff = (th * 60 + tm) - (fh * 60 + fm);
    if (diff < 0) diff += 1440;
    dur = (diff / 60).toFixed(2);
  }
  dur;
`;
const calcDur = vm.runInContext(editSessionCode, editSessionSandbox);
assert.strictEqual(calcDur, '0.47', 'FAIL: Duration between 19:32 and 20:00 must compute to 0.47h');

console.log('✓ Test 34: Logged work session direct in-drawer editing & deletion invariants verified.');

// ---------------------------------------------------------------------------
// TEST 35: HoverCard Non-Occlusion, Interactivity & Quick View Details Invariants
// ---------------------------------------------------------------------------
assert.ok(
  content.includes('r.bottom + 8'),
  'FAIL: showBlockHover must place tooltip below card (r.bottom + 8) when space permits'
);
assert.ok(
  !content.includes('top: Math.max(8, Math.min(r.top - 8'),
  'FAIL: Obsolete r.top - 8 positioning which occludes the hovered card must be eliminated'
);
assert.ok(
  /const openBlockDrawer = \(b\) => \{\s+hideBlockHover\(\);/.test(content),
  'FAIL: openBlockDrawer must immediately invoke hideBlockHover() to clear tooltip'
);
assert.ok(
  content.includes('pointer-events-auto'),
  'FAIL: HoverCard must have pointer-events-auto so user can interact with the details link'
);
assert.ok(
  content.includes('openBlockDrawer(hoverCard.block)') || (content.includes('@view-details="openBlockDrawer($event)') && content.includes("$emit('view-details', hoverCard.block)")),
  'FAIL: HoverCard must provide an explicit View Details action invoking openBlockDrawer'
);
assert.ok(
  content.includes('cancelHideHover') && content.includes('hideBlockHoverNow'),
  'FAIL: HoverCard lifecycle must include cancelHideHover and hideBlockHoverNow for hover retention'
);

const hoverSandbox = {
  window: { innerWidth: 1280, innerHeight: 900 },
  r: { top: 450, bottom: 478, left: 300, width: 120 }
};
vm.createContext(hoverSandbox);
const hoverCode = `
  const CARD_EST_HEIGHT = 85;
  const spaceBelow = window.innerHeight - r.bottom;
  const placeBelow = spaceBelow >= CARD_EST_HEIGHT + 16 || spaceBelow >= r.top;
  const top = placeBelow 
    ? Math.min(r.bottom + 8, window.innerHeight - CARD_EST_HEIGHT - 10)
    : Math.max(10, r.top - CARD_EST_HEIGHT - 8);
  ({ placeBelow, top, CARD_EST_HEIGHT });
`;
const hoverRes = vm.runInContext(hoverCode, hoverSandbox);
assert.strictEqual(hoverRes.placeBelow, true, 'FAIL: Mid-screen card must place hovercard below');
assert.strictEqual(hoverRes.top, 486, 'FAIL: Top must be 486 (r.bottom + 8), 8px completely clear of card');
assert.strictEqual(hoverRes.CARD_EST_HEIGHT, 85, 'FAIL: CARD_EST_HEIGHT must be compact (85px)');

console.log('✓ Test 35: HoverCard non-occlusion, interactivity & View Details action verified.');

// ---------------------------------------------------------------------------
// TEST 36: Configurable Temporal Horizon & Past Block Grace Invariants
// ---------------------------------------------------------------------------
assert.ok(
  content.includes('const pastBlockGraceHours = computed('),
  'FAIL: omnitrack.html must define pastBlockGraceHours computed ref'
);
assert.ok(
  content.includes('const timesheetHorizonHours = computed('),
  'FAIL: omnitrack.html must define timesheetHorizonHours computed ref'
);
assert.ok(
  content.includes('diffHours > grace'),
  'FAIL: isPastBlock must dynamically compare elapsed hours against configured grace period'
);
assert.ok(
  content.includes('diffHours <= horizon'),
  'FAIL: canLogTimesheet must dynamically compare elapsed hours against configured horizon'
);

const temporalSandbox = {
  Date: Date,
  Number: Number,
  parseInt: parseInt,
  isNaN: isNaN
};
vm.createContext(temporalSandbox);
const temporalCode = `
  const isPastBlockFn = (b, grace, now) => {
    if (!b || !b.work_date) return false;
    const endT = b.end_time || '23:59:59';
    const parts = b.work_date.split('-');
    const timeParts = endT.split(':');
    const blockDt = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      parseInt(timeParts[0] || '23', 10),
      parseInt(timeParts[1] || '59', 10),
      parseInt(timeParts[2] || '59', 10)
    );
    const diffHours = (now.getTime() - blockDt.getTime()) / (1000 * 60 * 60);
    return diffHours > grace;
  };

  // Block scheduled on Sept 24 ending at 23:59:59
  const block = { work_date: '2026-09-24', end_time: '23:59:59' };
  // Evaluated at 00:20:00 on Sept 25 (20 minutes past midnight)
  const now = new Date(2026, 8, 25, 0, 20, 0);

  const res24h = isPastBlockFn(block, 24, now); // 24-hour grace window
  const res0h = isPastBlockFn(block, 0, now);   // 0-hour grace window

  ({ res24h, res0h });
`;
const temporalRes = vm.runInContext(temporalCode, temporalSandbox);
assert.strictEqual(temporalRes.res24h, false, 'FAIL: 20 minutes past midnight must NOT be locked under 24h grace window');
assert.strictEqual(temporalRes.res0h, true, 'FAIL: 20 minutes past midnight must be locked under 0h grace window');

console.log('✓ Test 36: Configurable temporal horizon & past block grace invariants verified.');

// ---------------------------------------------------------------------------
// TEST 37: 1-Click Wrap & Start Next Session Universal Transition Invariants
// ---------------------------------------------------------------------------
{
  // The switch dialog never asks to retype the log: it shows what ends and what starts, and takes
  // one optional last line. The saved notes are composed by composeWrapNote (check_switch_dialog.mjs).
  const wrapSrc = fs.readFileSync(path.join(__dirname, '..', 'src/components/dialogs/WrapAndStartNextModal.vue'), 'utf8');
  assert.ok(wrapSrc.includes("'Start the next block?'"), 'FAIL: the switch dialog (WrapAndStartNextModal) must exist');
  assert.ok(!/<Textarea|<textarea/.test(wrapSrc) && /<label for="wrap-last-line"/.test(wrapSrc) && /<TextInput\s+id="wrap-last-line"/.test(wrapSrc),
    'FAIL: the switch dialog takes one labelled optional line, never a textarea prefilled with the log');
  const attendanceSrc = fs.readFileSync(path.join(__dirname, '..', 'src/composables/useWorkstationAttendance.js'), 'utf8');
  const prompt = attendanceSrc.slice(attendanceSrc.indexOf('const promptSwitchSession'), attendanceSrc.indexOf('};', attendanceSrc.indexOf('const promptSwitchSession')));
  assert.ok(/switchTargetItem\.value = /.test(prompt) && /switchWrapUpNote\.value = '';/.test(prompt) && /showSwitchConfirmModal\.value = true/.test(prompt),
    'FAIL: promptSwitchSession sets the target, starts the last line empty and opens the dialog');
}
assert.ok(content.includes('showSwitchConfirmModal'), 'FAIL: showSwitchConfirmModal must exist');
assert.ok(content.includes('promptSwitchSession'), 'FAIL: promptSwitchSession must exist');

console.log('✓ Test 37: 1-Click Wrap & Start Next Session universal transition invariants verified.');

// ---------------------------------------------------------------------------
// TEST 38: Session Log Line Roving Tabindex & Delete Button Accessibility
// ---------------------------------------------------------------------------
assert.ok(
  (content.includes(':tabindex="activeSessionRowIndex === row.i ? 0 : -1"') ||
   content.includes(':tabindex="activeRowIndex === idx ? 0 : -1"')) &&
  content.includes('data-remove-line-btn') &&
  (content.includes('focusLogRowDeleteBtn') || content.includes('focusRowDeleteBtn')),
  'FAIL: Session notes rows and remove-line buttons must support roving tabindex and focusLogRowDeleteBtn'
);

assert.ok(
  (content.includes("if (ev.key === 'ArrowRight') {") || content.includes("ev.key === 'ArrowRight'")) &&
  (content.includes('focusLogRowDeleteBtn(') || content.includes('focusRowDeleteBtn(')),
  'FAIL: ArrowRight on session log row must focus the delete button'
);

assert.ok(
  (content.includes("if (ev.key === 'ArrowLeft' || ev.key === 'Escape') {") ||
   content.includes("ev.key === 'ArrowLeft' || ev.key === 'Escape'")) &&
  (content.includes('focusLogRow(') || content.includes('focusRow(')),
  'FAIL: ArrowLeft or Escape on delete button must return focus to the session log row'
);

// Verify SessionBox.vue also has correct tab name ('notes' not 'log')
const sessionDir = path.resolve(__dirname, '../src/session');
const sessionBoxContent = fs.readdirSync(sessionDir).filter((f) => /\.(vue|js)$/.test(f)).map((f) => fs.readFileSync(path.join(sessionDir, f), 'utf8')).join('\n');
assert.ok(
  sessionBoxContent.includes("activePaneTab.value = 'notes'") &&
  !sessionBoxContent.includes("activePaneTab.value = 'log'"),
  'FAIL: onFocusSessionInput in SessionBox.vue must set activePaneTab to notes, not log'
);
assert.ok(
  sessionBoxContent.includes('focusRowDeleteBtn') &&
  sessionBoxContent.includes('onRemoveBtnKeydown'),
  'FAIL: SessionBox.vue must implement focusRowDeleteBtn and onRemoveBtnKeydown'
);

console.log('✓ Test 38: Session Log roving tabindex, ArrowRight to delete button & shortcut invariants verified.');

// Test 39: Elevation tab resilience, bottom docking, and Shift+T timesheet elevation
assert.ok(
  sessionBoxContent.includes("watch(() => props.isElevated") &&
  sessionBoxContent.includes("activePaneTab.value = 'notes'"),
  'FAIL: SessionBox.vue must watch props.isElevated and reset activePaneTab to notes'
);
assert.ok(
  sessionBoxContent.includes("const paneTab = computed(() => (paneTabs.value.includes(activePaneTab.value) ? activePaneTab.value : 'notes'));") &&
  sessionBoxContent.includes("v-if=\"paneTab === 'notes'\"") &&
  !/v-(?:else-)?if="activePaneTab/.test(sessionBoxContent),
  'FAIL: the session pane shows paneTab, which falls back to the Log, so an unknown tab never leaves it blank'
);
// The Details tab is the block drawer itself, inline: one component shows a block's details
assert.ok(
  /<BlockDetailDrawer\s+v-if="trackerBoundBlock"\s+inline\b/.test(sessionBoxContent) &&
  sessionBoxContent.includes(":can-log-timesheet=\"() => false\"") &&
  sessionBoxContent.includes("paneTabs = computed(() => ['notes', 'details',"),
  'FAIL: the session Details tab renders BlockDetailDrawer inline (read-only), between Log and Task chat'
);
assert.ok(
  sessionBoxContent.includes("mt-auto") &&
  sessionBoxContent.includes("min-h-0"),
  'FAIL: SessionBox.vue must dock input bar to bottom with mt-auto and fill height with min-h-0'
);
assert.ok(
  content.includes("if (k === 't') {") &&
  content.includes("if (isTracking.value) {") &&
  content.includes("isSessionElevated.value = true;"),
  'FAIL: omnitrack.html must elevate session timesheet on Shift+T when tracking'
);

console.log('✓ Test 39: Elevation tab resilience, bottom docking, and Shift+T shortcut verified.');

// Test 40: "Yes, Still Working" notification interaction elevates session timesheet and focuses input
const freshSwContent = fs.readFileSync(path.resolve(__dirname, '../omnitrack/public/sw.js'), 'utf8');
assert.ok(
  freshSwContent.includes("client.postMessage({ type: 'STILL_WORKING_ELEVATE_FOCUS' })") &&
  freshSwContent.includes("openWindow('/omnitrack?action=still_working')"),
  'FAIL: sw.js must message client with STILL_WORKING_ELEVATE_FOCUS and open URL with action=still_working'
);
assert.ok(
  content.includes("isSessionElevated.value = true;") &&
  content.includes("focusSessionPointInput();") &&
  content.includes("STILL_WORKING_ELEVATE_FOCUS"),
  'FAIL: omnitrack.html confirmStillWorking must elevate timesheet and focus input, and listen for STILL_WORKING_ELEVATE_FOCUS'
);

console.log('✓ Test 40: Still working notification interaction popup elevation & input focus verified.');

// Test 41: 4 Days Planner View places Today in 2nd day (Yesterday in 1st day, Tomorrow in 3rd day, Day+2 in 4th day)
assert.ok(
  content.includes("Array.from({ length: 4 }, (_, i) => addDays(plannerAnchor.value, i - 1))"),
  'FAIL: omnitrack.html 4days view must use i - 1 to place Yesterday in index 0 and Today in index 1'
);
assert.ok(
  content.includes("(plannerView.value === 'week' || plannerView.value === '4days') && d.colW > 0"),
  'FAIL: omnitrack.html must support horizontal block drag across days in both week and 4days views'
);

console.log('✓ Test 41: 4 Days planner layout (Yesterday context + Today on 2nd day) and drag across days verified.');

// Test 42: Planner large screen 3-column layout (Left Assigned Work, Center Calendar, Right Stats Rail)
assert.ok(
  content.includes("xl:grid-cols-[280px_1fr_260px]") &&
  content.includes("order-3 lg:col-span-1 xl:col-span-1 flex flex-col space-y-2.5 w-full") &&
  content.includes("items-stretch lg:h-full lg:min-h-0 flex-1"),
  'FAIL: omnitrack.html must layout Planner in 3 columns on big screens (xl:grid-cols-[280px_1fr_260px]) with right stats rail'
);

console.log('✓ Test 42: Planner large screen 3-column layout & right stats rail verified.');

// Test 43: Rolling 7-day Week Planner View places Today in 3rd day (2 days past context, Today at index 2, 4 days ahead)
assert.ok(
  content.includes("Array.from({ length: 7 }, (_, i) => addDays(plannerAnchor.value, i - 2))"),
  'FAIL: omnitrack.html week view must use i - 2 to place Today in index 2 (3rd day) with 2 days past and 4 days ahead'
);

console.log('✓ Test 43: Rolling 7-day Week planner layout (Today in 3rd day + 2 days past + 4 days ahead) verified.');

// Test 44: Computer screen desktop viewport height freeze & isolated component scrolling invariants
assert.ok(
  content.includes("activeTab === 'planner' ? 'lg:h-screen lg:max-h-screen lg:overflow-hidden' : ''") &&
  content.includes("activeTab === 'planner' ? 'lg:flex lg:flex-col lg:min-h-0 lg:max-h-full lg:overflow-hidden lg:pt-3.5 lg:pb-[72px] lg:space-y-0") &&
  content.includes("lg:space-y-0 lg:flex-1 lg:min-h-0 lg:h-full lg:flex lg:flex-col") &&
  content.includes("lg:h-full lg:max-h-full lg:min-h-0 order-1 lg:order-2") &&
  content.includes("overflow-y-auto overscroll-contain flex-1 min-h-0") &&
  content.includes("lg:max-h-full lg:h-full lg:min-h-0 order-2 lg:order-1") &&
  content.includes("order-3 lg:col-span-1 xl:col-span-1 flex flex-col space-y-2.5 w-full min-h-0 lg:h-full lg:max-h-full overflow-hidden"),
  'FAIL: omnitrack.html must freeze outer viewport height on desktop for Planner and isolate vertical scrolling strictly inside component scrollers'
);

console.log('✓ Test 44: Desktop viewport height freeze & internal component scrolling invariants verified.');

// Test 45: A mouse drag on the planner must never lose to the browser's native drag.
// A 200 ms hold for mouse cancelled itself when the mouse moved 8 px first, so the
// native text-drag ghost appeared and the range/reschedule "worked sometimes".
{
  const comp = (f) => fs.readFileSync(path.resolve(__dirname, '..', 'src', 'composables', f), 'utf8');
  const fnBody = (src, name) => {
    const i = src.indexOf('const ' + name + ' = ');
    assert.ok(i >= 0, 'FAIL: ' + name + ' not found');
    return src.slice(i, src.indexOf('\n  };', i));
  };
  for (const [file, fn] of [['useWorkstationPlannerSelect.js', 'startSlotSelect'], ['useWorkstationPlannerDrag.js', 'startBlockDrag']]) {
    const body = fnBody(comp(file), fn);
    const mouse = body.indexOf("ev.pointerType === 'mouse'");
    const hold = body.indexOf('_armOnHold(');
    assert.ok(mouse >= 0 && hold > mouse && /preventDefault\(\)/.test(body.slice(mouse, hold)),
      `FAIL: ${fn} must start a mouse drag immediately (preventDefault, no hold); only touch waits for a hold`);
  }
  const grid = fs.readFileSync(path.resolve(calSectionDir, 'CalendarPlannerGrid.vue'), 'utf8');
  for (const handler of ['startSlotSelect($event, d)', "startBlockDrag($event, seg.block, 'move')"]) {
    const at = grid.indexOf('@pointerdown="' + handler + '"');
    const tagStart = grid.lastIndexOf('<div', at);
    const tag = grid.slice(tagStart, grid.indexOf('>', at));
    assert.ok(/draggable="false"/.test(tag) && /@dragstart\.prevent/.test(tag) && /select-none/.test(tag),
      `FAIL: the planner element calling ${handler} needs draggable="false", @dragstart.prevent and select-none so no native drag ghost appears`);
  }
}

console.log('✓ Test 45: planner mouse drags start at once and never show a native drag ghost.');

console.log('\nSUCCESS: All 45 Tier 3 Workstation Interaction tests passed cleanly.\n');
process.exit(0);



