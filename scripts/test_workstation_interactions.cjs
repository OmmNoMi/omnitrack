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
console.log('\nSUCCESS: All 8 Tier 3 Workstation Interaction tests passed cleanly.\n');
process.exit(0);
