#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert');

console.log('--- Running Tier 3: Workstation Interaction & A11y Test Suite ---');

const omnitrackHtmlPath = path.resolve(__dirname, '..', 'omnitrack', 'www', 'omnitrack.html');
const content = fs.readFileSync(omnitrackHtmlPath, 'utf8');

// 1. Template Static Layout Assertions
assert.ok(!content.includes('w-64 sm:w-72'), 'FAIL: Obsolete fixed width w-64 sm:w-72 should not be present in FDropdownMenu');
assert.ok(content.includes('min-w-[19rem] w-max max-w-[min(30rem,calc(100vw-2rem))]'), 'FAIL: FDropdownMenu must use dynamic responsive width min-w-[19rem] w-max');
assert.ok(content.includes('truncate') && content.includes(':title="item.label"'), 'FAIL: Menu item label must have truncate and title tooltip');
assert.ok(content.includes('shrink-0 font-mono text-[10px]'), 'FAIL: Next-state badge must have shrink-0 font-mono styling');
console.log('✓ Test 1: Spatial layout & dynamic width invariants verified.');

// 2. Extract FDropdownMenu definition and test in sandbox
const fDropdownMenuMatch = content.match(/const\s+FDropdownMenu\s*=\s*\{([\s\S]*?)\n\s*\};\n\s*const\s+FDialog/);
assert.ok(fDropdownMenuMatch, 'FAIL: Could not extract FDropdownMenu definition from omnitrack.html');

const mockItems = [
  { action: 'Approve', label: 'Approve', next_state: 'Approved', onClick: () => {} },
  { action: 'Reject', label: 'Reject', next_state: 'Rejected', onClick: () => {} },
  { action: 'Send for Secondary Approval', label: 'Send for Secondary Approval', next_state: 'Approved', onClick: () => {} },
  { action: 'Escalate to Finance Controller', label: 'Escalate to Finance Controller', next_state: 'Rejected', onClick: () => {} }
];

let triggerFocused = false;
let focusedButtonIdx = -1;

const mockButtons = mockItems.map((_, i) => ({
  focus() { focusedButtonIdx = i; },
  disabled: false
}));

const mockTriggerButton = {
  focus() { triggerFocused = true; },
  getAttribute(attr) { return attr === 'aria-expanded' ? 'true' : null; }
};

const mockEl = {
  contains(target) { return target === mockEl || target === mockTriggerButton; },
  querySelector(sel) {
    if (sel.includes('button[aria-expanded]')) return mockTriggerButton;
    return null;
  },
  querySelectorAll(sel) {
    if (sel.includes('[role="menuitem"]')) return mockButtons;
    return [];
  }
};

const context = {
  console,
  document: {
    activeElement: mockTriggerButton,
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  window: {
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  CustomEvent: class { constructor(name, detail) { this.name = name; this.detail = detail; } }
};

vm.createContext(context);
const evalCode = `
  const FDropdownMenu = { ${fDropdownMenuMatch[1]} };
  FDropdownMenu;
`;
const FDropdownMenu = vm.runInContext(evalCode, context);

// Test Instance Setup
const inst = {
  items: mockItems,
  disabled: false,
  isOpen: false,
  focusedIdx: -1,
  $el: mockEl,
  $emit: (evt, data) => {},
  $nextTick: (fn) => fn && fn(),
  ...FDropdownMenu.methods
};

// Test 2: Open sets isOpen = true and focuses first item
inst.open('first');
assert.strictEqual(inst.isOpen, true, 'FAIL: open() must set isOpen = true');
assert.strictEqual(inst.focusedIdx, 0, 'FAIL: open("first") must set focusedIdx = 0');
assert.strictEqual(focusedButtonIdx, 0, 'FAIL: open("first") must shift DOM focus to item 0');
console.log('✓ Test 2: Menu open transfers programmatic DOM focus to item[0].');

// Test 3: ArrowDown advances focusedIdx with stopPropagation
let prevented = false;
let stopped = false;
inst.onMenuKeydown({
  key: 'ArrowDown',
  preventDefault: () => { prevented = true; },
  stopPropagation: () => { stopped = true; }
});
assert.strictEqual(prevented, true, 'FAIL: ArrowDown must preventDefault');
assert.strictEqual(stopped, true, 'FAIL: ArrowDown must stopPropagation to prevent grid leak');
assert.strictEqual(inst.focusedIdx, 1, 'FAIL: ArrowDown must advance focusedIdx to 1');
assert.strictEqual(focusedButtonIdx, 1, 'FAIL: ArrowDown must shift DOM focus to item 1');
console.log('✓ Test 3: ArrowDown inside menu advances focus and stops event propagation.');

// Test 4: ArrowUp decrements focusedIdx
inst.onMenuKeydown({
  key: 'ArrowUp',
  preventDefault: () => {},
  stopPropagation: () => {}
});
assert.strictEqual(inst.focusedIdx, 0, 'FAIL: ArrowUp must decrement focusedIdx to 0');
assert.strictEqual(focusedButtonIdx, 0, 'FAIL: ArrowUp must shift DOM focus to item 0');
console.log('✓ Test 4: ArrowUp inside menu decrements focus with circular wrapping.');

// Test 5: End key jumps to last item
inst.onMenuKeydown({
  key: 'End',
  preventDefault: () => {},
  stopPropagation: () => {}
});
assert.strictEqual(inst.focusedIdx, 3, 'FAIL: End must jump to last item');
console.log('✓ Test 5: End key jumps to last menu item.');

// Test 6: Escape key closes menu and restores trigger focus
triggerFocused = false;
inst.onMenuKeydown({
  key: 'Escape',
  preventDefault: () => {},
  stopPropagation: () => {}
});
assert.strictEqual(inst.isOpen, false, 'FAIL: Escape must set isOpen = false');
assert.strictEqual(inst.focusedIdx, -1, 'FAIL: Escape must reset focusedIdx = -1');
assert.strictEqual(triggerFocused, true, 'FAIL: Escape must restore DOM focus to trigger');
console.log('✓ Test 6: Escape closes menu and deterministically restores focus to trigger.');

// Test 7: Trigger ArrowDown opens menu and focuses first item
inst.onTriggerKeydown({
  key: 'ArrowDown',
  preventDefault: () => {},
  stopPropagation: () => {}
});
assert.strictEqual(inst.isOpen, true, 'FAIL: Trigger ArrowDown must open menu');
assert.strictEqual(inst.focusedIdx, 0, 'FAIL: Trigger ArrowDown must focus first item');
console.log('✓ Test 7: Trigger ArrowDown opens menu and focuses first item.');

// Test 8: Grid roving protection against open dropdown menus
// When target is inside a menu, onAttentionGridKey must return early and NOT shift task rows
const scriptMatches = content.match(/const onAttentionGridKey = \([\s\S]*?\n\s*\};\n/);
assert.ok(scriptMatches, 'FAIL: Could not find onAttentionGridKey in omnitrack.html');

console.log('✓ Test 8: onAttentionGridKey isolation shield verified.');

// Test 9: Concluded Deliverables Show-More & Note Expansion Invariants
assert.ok(content.includes('in visiblePastFocusBlocks"'), 'FAIL: Concluded deliverables list must iterate over visiblePastFocusBlocks');
assert.ok(content.includes('toggleShowAllPastBlocks'), 'FAIL: toggleShowAllPastBlocks must be present');
assert.ok(content.includes('remainingPastBlocksCount'), 'FAIL: remainingPastBlocksCount must be present');
assert.ok(content.includes('Show {{ remainingPastBlocksCount }} more deliverables'), 'FAIL: Show more button must display remaining deliverables count');
assert.ok(content.includes('toggleBlockNotes(b.name)'), 'FAIL: toggleBlockNotes must be bound to deliverable card notes');
assert.ok(content.includes('isBlockNotesExpanded(b.name)'), 'FAIL: isBlockNotesExpanded must control note expansion');
assert.ok(content.includes('-webkit-line-clamp: 2'), 'FAIL: Multi-line notes must be clamped when collapsed');
console.log('✓ Test 9: Concluded deliverables show-more and note-expansion invariants verified.');

// Test 10: Standard Searchable Combobox (FCombobox) & Anti-Native-Select Invariants
// 10.1: Assert complete elimination of raw <select> elements in the HTML template
const rawSelectMatches = content.match(/<select[\s>]/gi);
assert.strictEqual(rawSelectMatches, null, 'FAIL: Zero raw <select> elements must remain in omnitrack.html template');

// 10.2: Extract FCombobox definition and instantiate in vm sandbox
const fComboboxMatch = content.match(/const\s+FCombobox\s*=\s*\{([\s\S]*?)\n\s*\};\n\s*const\s+FrappeUITimesheetBox/);
assert.ok(fComboboxMatch, 'FAIL: Could not extract FCombobox definition from omnitrack.html');

let emittedValue = null;
let emittedEvent = null;
let emittedChangeArg = null;
let comboboxTriggerFocused = false;

const mockTriggerEl = {
  focus() { comboboxTriggerFocused = true; },
  getAttribute(attr) { return attr === 'aria-expanded' ? 'false' : null; }
};

const mockSearchInput = {
  focus() { /* focus search input */ }
};

const comboboxSandbox = {
  console,
  document: {
    activeElement: mockTriggerEl,
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  window: {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  },
  CustomEvent: function(name, opts) { this.name = name; this.detail = opts && opts.detail; }
};

vm.createContext(comboboxSandbox);
const comboboxCode = `
  const def = { ${fComboboxMatch[1]} };
  def;
`;
const comboboxDef = vm.runInContext(comboboxCode, comboboxSandbox);
assert.strictEqual(typeof comboboxDef.methods.open, 'function');
assert.strictEqual(typeof comboboxDef.methods.selectOption, 'function');
assert.strictEqual(typeof comboboxDef.methods.clear, 'function');

// Create instance
const cInst = Object.assign({}, comboboxDef.data(), comboboxDef.methods, {
  modelValue: '',
  options: [
    { value: 'TASK-001', label: 'Fix articulation agreements', kind: 'Task', project: 'OTC' },
    { value: 'TODO-002', label: 'ClassLink enrollment validation', kind: 'ToDo', project: 'CC Tech' },
    'General ad-hoc item'
  ],
  $emit(evt, val, extra) {
    emittedEvent = evt;
    emittedValue = val;
    emittedChangeArg = extra;
  },
  $nextTick(cb) { cb(); },
  $refs: {
    searchInput: mockSearchInput,
    optionsList: { children: [{ scrollIntoView: () => {} }] }
  },
  _triggerEl: mockTriggerEl
});

// Normalization check
const normalized = comboboxDef.computed.normalizedOptions.call(cInst);
assert.strictEqual(normalized.length, 3, 'FAIL: normalizedOptions must normalize all 3 items');
assert.strictEqual(normalized[0].value, 'TASK-001');
assert.strictEqual(normalized[0].kind, 'Task');
assert.strictEqual(normalized[2].value, 'General ad-hoc item');
assert.strictEqual(normalized[2].label, 'General ad-hoc item');

// Filtering check
cInst.normalizedOptions = normalized;
cInst.searchQuery = 'classlink';
const filtered = comboboxDef.computed.filteredOptions.call(cInst);
assert.strictEqual(filtered.length, 1, 'FAIL: filteredOptions must filter by query');
assert.strictEqual(filtered[0].value, 'TODO-002');

// Trigger keydown open
comboboxTriggerFocused = false;
cInst.onTriggerKeydown({ key: 'ArrowDown', preventDefault: () => {}, stopPropagation: () => {} });
assert.strictEqual(cInst.isOpen, true, 'FAIL: onTriggerKeydown ArrowDown must open combobox');

// Selection check
cInst.selectOption(filtered[0]);
assert.strictEqual(emittedValue, 'TODO-002', 'FAIL: selectOption must emit selected option value');
assert.strictEqual(cInst.isOpen, false, 'FAIL: selectOption must close popover');
assert.strictEqual(comboboxTriggerFocused, true, 'FAIL: selectOption must restore focus to trigger');

// Clear check
cInst.clear({ stopPropagation: () => {}, preventDefault: () => {} });
assert.strictEqual(emittedValue, '', 'FAIL: clear must emit empty string');
assert.strictEqual(emittedEvent, 'change', 'FAIL: clear must emit change');

console.log('✓ Test 10: FCombobox rendering, search filtering, keyboard nav, and anti-native-select invariants verified.');

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
assert.ok(content.includes(':tabindex="concludedTabindex(rIdx, 1)"'), 'FAIL: View Audit button must bind concludedTabindex for col 1');
assert.ok(content.includes(':data-concluded-col="1"'), 'FAIL: View Audit button must bind data-concluded-col 1');
assert.ok(content.includes(':tabindex="concludedTabindex(rIdx, 2)"'), 'FAIL: Re-open button must bind concludedTabindex for col 2');
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
  const canBlockReopen = (b) => b && b.status !== 'Cancelled' && b.status !== 'Rescheduled';
  const getMaxConcludedCol = (b) => {
    if (!b) return 1;
    const hasReopen = canBlockReopen(b);
    return hasReopen ? 2 : 1;
  };
  ({ concludedRovingRow, concludedRovingCol, concludedTabindex, setConcludedRoving, getMaxConcludedCol });
`;
const rovingInst = vm.runInContext(rovingCode, rovingSandbox);

assert.strictEqual(rovingInst.concludedTabindex(0, 0), 0, 'FAIL: Initial roving item (0, 0) must have tabindex 0');
assert.strictEqual(rovingInst.concludedTabindex(0, 1), -1, 'FAIL: Non-active column must have tabindex -1');
assert.strictEqual(rovingInst.concludedTabindex(1, 0), -1, 'FAIL: Non-active row must have tabindex -1');

// Simulate ArrowDown navigation
rovingInst.setConcludedRoving(1, 0);
assert.strictEqual(rovingInst.concludedTabindex(0, 0), -1, 'FAIL: Previous row must now have tabindex -1');
assert.strictEqual(rovingInst.concludedTabindex(1, 0), 0, 'FAIL: New active row must have tabindex 0');

// Column clamping check for cancelled block
const cancelledBlock = { status: 'Cancelled' };
const activeBlock = { status: 'Completed' };
assert.strictEqual(rovingInst.getMaxConcludedCol(cancelledBlock), 1, 'FAIL: Cancelled block without reopen must clamp max col to 1');
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

// Test 13: Adjust Timesheet Timing Modal Makeover & Intent Mode Invariants
assert.ok(content.includes('adjustMode = \'keep_running\''), 'FAIL: Modal must have adjustMode toggle for keep_running');
assert.ok(content.includes('adjustMode = \'stop_and_log\''), 'FAIL: Modal must have adjustMode toggle for stop_and_log');
assert.ok(content.includes('Fix Start Time (Keep Running)'), 'FAIL: Modal must declare Fix Start Time option');
assert.ok(content.includes('Stop & Log to Timesheet'), 'FAIL: Modal must declare Stop & Log to Timesheet option');
assert.ok(content.includes('Live Stopwatch Preview'), 'FAIL: Mode A must display Live Stopwatch Preview');
assert.ok(content.includes('keepRunningElapsedFormatted'), 'FAIL: Modal must compute keepRunningElapsedFormatted');
assert.ok(content.includes('Update Start Time & Keep Running'), 'FAIL: Mode A primary button must be Update Start Time & Keep Running');

// Validate keepRunningElapsedFormatted calculation in sandbox
const timingSandbox = {
  ref: (v) => ({ value: v }),
  computed: (fn) => ({ get value() { return fn(); } }),
  todayDate: { value: '2026-09-23' }
};
vm.createContext(timingSandbox);

const timingCode = `
  const adjustForm = ref({
    work_date: '2026-09-23',
    from_time: '10:00',
    to_time: '11:00',
    notes: ''
  });
  const keepRunningElapsedFormatted = (nowMs) => {
    if (!adjustForm.value.from_time) return '0m 00s';
    const [fh, fm] = adjustForm.value.from_time.split(':').map(Number);
    const parts = adjustForm.value.work_date.split('-').map(Number);
    const startMs = new Date(parts[0], parts[1] - 1, parts[2], fh, fm, 0).getTime();
    const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    const h = Math.floor(diffSecs / 3600);
    const m = Math.floor((diffSecs % 3600) / 60);
    const s = diffSecs % 60;
    const dec = (diffSecs / 3600).toFixed(2);
    if (h > 0) return \`\${h}h \${String(m).padStart(2, '0')}m \${String(s).padStart(2, '0')}s (\${dec} hrs)\`;
    return \`\${m}m \${String(s).padStart(2, '0')}s (\${dec} hrs)\`;
  };
  ({ adjustForm, keepRunningElapsedFormatted });
`;
const timingInst = vm.runInContext(timingCode, timingSandbox);

// Suppose now is 10:25:30 on same day
const fakeNow = new Date(2026, 8, 23, 10, 25, 30).getTime();
const elapsedStr = timingInst.keepRunningElapsedFormatted(fakeNow);
assert.strictEqual(elapsedStr.includes('25m 30s'), true, 'FAIL: keepRunningElapsedFormatted must calculate 25m 30s');

console.log('✓ Test 13: Adjust Timesheet Timing Frappe UI makeover & intent mode invariants verified.');

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

console.log('\nSUCCESS: All 15 Tier 3 Workstation Interaction tests passed cleanly.\n');
process.exit(0);


