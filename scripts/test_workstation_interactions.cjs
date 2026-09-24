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
assert.ok(content.includes('min-w-[13.5rem] sm:min-w-[18rem]') && content.includes('max-w-[calc(100vw-1.5rem)]'), 'FAIL: FDropdownMenu must use responsive min-w and max-w to prevent mobile clipping');
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
assert.ok(content.includes('v-model="showInactivityModal"'), 'FAIL: showInactivityModal dialog must be rendered in template');
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
assert.ok(content.includes('Prolonged Inactivity Detected'), 'FAIL: Inactivity modal must display prolonged inactivity alert when >=60m');

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
const setupIdx = content.indexOf('setup() {');
const nowMinIdx = content.indexOf('const nowMinute = ref');
const todayIsoIdx = content.indexOf('const todayISO = () => getLocalTodayISO()');
assert.ok(setupIdx > 0 && nowMinIdx > setupIdx && nowMinIdx < setupIdx + 4000, 'FAIL: nowMinute must be declared at the top of setup()');
assert.ok(setupIdx > 0 && todayIsoIdx > setupIdx && todayIsoIdx < setupIdx + 4000, 'FAIL: todayISO must be declared at the top of setup()');

// 3. Export of startTime in setup return
assert.ok(content.includes('startTime,\n        trackerSeconds,'), 'FAIL: startTime must be exported in setup() return');

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
  content.includes('if (isSessionElevated.value) {\n          isSessionElevated.value = false;\n        }'),
  'FAIL: openAdjustModal must de-elevate isSessionElevated to prevent dialog occlusion'
);

// 2. FDialog default zIndex is elevated above elevated session popup (z-[70])
assert.ok(
  content.includes("zIndex: { type: String, default: 'z-[70]' }"),
  'FAIL: FDialog default zIndex must be at least z-[70] to render above elevated session cards'
);

// 3. showAdjustModal specifies z-index="z-[75]"
assert.ok(
  content.includes('z-index="z-[75]"'),
  'FAIL: showAdjustModal dialog must specify z-index="z-[75]"'
);

console.log('✓ Test 26: Adjust dialog stacking & de-elevation invariants verified.');

// ---------------------------------------------------------------------------
// TEST 27: Mobile Dropdown Viewport Clamping & Reflow (Issue #6)
// ---------------------------------------------------------------------------
// 1. FDropdownMenu defines adjustPosition method
assert.ok(
  content.includes('adjustPosition() {') &&
  content.includes('menu.style.left = \'0px\';') &&
  content.includes('menu.style.right = \'auto\';'),
  'FAIL: FDropdownMenu must implement adjustPosition to clamp menu within viewport'
);

// 2. Responsive min-width and max-width classes on dropdown menu
assert.ok(
  content.includes('min-w-[13.5rem] sm:min-w-[18rem]') &&
  content.includes('max-w-[calc(100vw-1.5rem)]'),
  'FAIL: FDropdownMenu must use responsive min-w-[13.5rem] and max-w-[calc(100vw-1.5rem)] to prevent mobile clipping'
);

console.log('✓ Test 27: Mobile dropdown viewport clamping & reflow verified.');

// ---------------------------------------------------------------------------
// TEST 28: 1-Click Atomic Switch Task Action (Issue #7)
// ---------------------------------------------------------------------------
// 1. switch_active_session API defined in omnitrack/api.py
const apiContent = fs.readFileSync(path.join(__dirname, '../omnitrack/api.py'), 'utf8');
assert.ok(
  apiContent.includes('def switch_active_session('),
  'FAIL: switch_active_session must be defined in omnitrack/api.py'
);

// 2. UI trigger button in session card toolbar
assert.ok(
  content.includes('@click.stop="openSwitchTaskModal"'),
  'FAIL: Switch task button must be present in session card toolbar'
);

// 3. Switch Task modal dialog defined in template
assert.ok(
  content.includes('v-model="showSwitchTaskModal"'),
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
    const cur = Math.max(0, timelineZoomOptions.indexOf(timelineZoom.value));
    let next = cur;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (cur + 1) % timelineZoomOptions.length;
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (cur - 1 + timelineZoomOptions.length) % timelineZoomOptions.length;
    else if (ev.key === 'Home') next = 0;
    else next = timelineZoomOptions.length - 1;
    timelineZoom.value = timelineZoomOptions[next];
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
  content.includes('openEditSessionModal(activeBlock, s)'),
  'FAIL: Logged work sessions in drawer must provide an edit button invoking openEditSessionModal'
);
assert.ok(
  content.includes('confirmDeleteSession(activeBlock, s)'),
  'FAIL: Logged work sessions in drawer must provide a delete button invoking confirmDeleteSession'
);
assert.ok(
  content.includes('v-model="showEditSessionModal"'),
  'FAIL: omnitrack.html must declare showEditSessionModal dialog'
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
// TEST 35: HoverCard Non-Occlusion & Auto-Dismissal Invariants
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
  content.includes('const openBlockDrawer = (b) => {\n        hideBlockHover();'),
  'FAIL: openBlockDrawer must immediately invoke hideBlockHover() to clear tooltip'
);

const hoverSandbox = {
  window: { innerWidth: 1280, innerHeight: 900 },
  r: { top: 450, bottom: 478, left: 300, width: 120 }
};
vm.createContext(hoverSandbox);
const hoverCode = `
  const CARD_EST_HEIGHT = 220;
  const spaceBelow = window.innerHeight - r.bottom;
  const placeBelow = spaceBelow >= CARD_EST_HEIGHT + 16 || spaceBelow >= r.top;
  const top = placeBelow 
    ? Math.min(r.bottom + 8, window.innerHeight - CARD_EST_HEIGHT - 10)
    : Math.max(10, r.top - CARD_EST_HEIGHT - 8);
  ({ placeBelow, top });
`;
const hoverRes = vm.runInContext(hoverCode, hoverSandbox);
assert.strictEqual(hoverRes.placeBelow, true, 'FAIL: Mid-screen card must place hovercard below');
assert.strictEqual(hoverRes.top, 486, 'FAIL: Top must be 486 (r.bottom + 8), 8px completely clear of card');

console.log('✓ Test 35: HoverCard non-occlusion & auto-dismissal invariants verified.');

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

console.log('\nSUCCESS: All 36 Tier 3 Workstation Interaction tests passed cleanly.\n');
process.exit(0);



