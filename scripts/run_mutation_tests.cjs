#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

console.log('===========================================================');
console.log('   OmniTrack Automated Mutation Testing Framework (TDD++)  ');
console.log('===========================================================\n');

const omnitrackDir = path.resolve(__dirname, '..');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');
const viteConfigPath = path.resolve(omnitrackDir, 'vite.config.js');
const tailwindConfigPath = path.resolve(omnitrackDir, 'tailwind.config.cjs');
const appVuePath = path.resolve(omnitrackDir, 'src', 'App.vue');
const headerVuePath = fs.existsSync(path.resolve(omnitrackDir, 'src', 'components', 'layout', 'WorkstationHeader.vue'))
  ? path.resolve(omnitrackDir, 'src', 'components', 'layout', 'WorkstationHeader.vue')
  : appVuePath;
const identityPath = path.resolve(omnitrackDir, 'src', 'composables', 'useWorkstationIdentity.js');
const calendarViewPath = path.resolve(omnitrackDir, 'src', 'views', 'calendar', 'CalendarAssignedTasks.vue');

let totalMutants = 0;
let killedMutants = 0;
let survivingMutants = 0;

function runMutationTest(name, fileToMutate, mutator, testCmd, expectedErrorSubstr) {
  totalMutants++;
  console.log(`[Mutant #${totalMutants}] Testing: ${name}`);
  const originalContent = fs.readFileSync(fileToMutate, 'utf8');

  try {
    // 1. Inoculate / apply mutation
    const mutatedContent = mutator(originalContent);
    if (mutatedContent === originalContent) {
      throw new Error(`Mutator failed to change content for: ${name}`);
    }
    fs.writeFileSync(fileToMutate, mutatedContent, 'utf8');

    // 2. Run the test command
    let testPassed = false;
    let testOutput = '';
    try {
      testOutput = execSync(testCmd, { cwd: omnitrackDir, stdio: 'pipe' }).toString();
      testPassed = true;
    } catch (err) {
      testPassed = false;
      testOutput = (err.stdout ? err.stdout.toString() : '') + (err.stderr ? err.stderr.toString() : '');
    }

    // 3. Evaluate mutation result
    if (testPassed) {
      console.error(`  ❌ SURVIVED: The test suite passed despite the intentional mutation!`);
      survivingMutants++;
    } else {
      // Red for the wrong reason (a crash, another guard) proves nothing about this guard
      if (expectedErrorSubstr && !testOutput.includes(expectedErrorSubstr)) {
        console.error(`  ❌ SURVIVED: red, but not with "${expectedErrorSubstr}".\n${testOutput.slice(-600)}`);
        survivingMutants++;
      } else {
        console.log(`  🎯 KILLED: Test turned RED as expected and caught the regression.`);
        killedMutants++;
      }
    }
  } finally {
    // 4. Always restore original content cleanly
    fs.writeFileSync(fileToMutate, originalContent, 'utf8');
  }
}

// Mutant 1: Bundler Alias changed to runtime-only build
runMutationTest(
  'Runtime compiler disabled in bundler (alias mutated to runtime-only)',
  viteConfigPath,
  (code) => code.replace('vue/dist/vue.esm-bundler.js', 'vue/dist/vue.runtime.esm-bundler.js'),
  'npm run build && node scripts/test_bundle_and_components.cjs',
  'FAIL: Vue.compile must NOT be a no-op stub'
);

// Ensure bundle is restored to full compiler build after Mutant 1
execSync('npm run build', { cwd: omnitrackDir, stdio: 'pipe' });

// Mutant 2: Obsolete 404 Script injected into omnitrack.html
runMutationTest(
  'Obsolete 404 script re-introduced into omnitrack.html',
  htmlPath,
  (code) => code.replace('</head>', '<script src="/assets/omnitrack/dist/timesheet_session_box.bundle.js"></script></head>'),
  'node scripts/test_bundle_and_components.cjs',
  'FAIL: timesheet_session_box.bundle.js is obsolete'
);

// Mutant 3: Production Error Boundary Fallback removed from omnitrack.html
runMutationTest(
  'Error boundary fallback container removed from omnitrack.html',
  htmlPath,
  (code) => code.replace('id="omnitrack-fallback-error"', 'id="disabled-fallback"'),
  'node scripts/test_bundle_and_components.cjs',
  'FAIL: omnitrack.html must have an explicit mount error fallback container'
);

// Mutant 4: the attention grid roves into a menu column that no longer exists
runMutationTest(
  'attention grid End lands on a removed workflow menu column',
  identityPath,
  (code) => code.replace('const ATTENTION_LAST_COL = 2;', 'const ATTENTION_LAST_COL = 4;'),
  'node scripts/test_workstation_interactions.cjs',
  'ATTENTION_LAST_COL must be 2'
);

// Mutant 5: Redundant isProductionEnv badge re-introduced into header (Issue #12)
runMutationTest(
  'Redundant isProductionEnv badge re-introduced into header (Issue #12 regression)',
  headerVuePath,
  // Anchor on the brand group's opening div, which survives typography changes to the brand name
  (code) => code.replace('<div class="flex items-center gap-2.5 sm:gap-3 min-w-0">', '<div class="flex items-center gap-2.5 sm:gap-3 min-w-0"><span>{{ isProductionEnv ? \'Production\' : \'Local Dev\' }}</span>'),
  'node scripts/test_mobile_navbar.cjs',
  'FAIL: Header must NOT contain the redundant isProductionEnv badge'
);

// Mutant 6: Raven returns to the header bar instead of the app menu
runMutationTest(
  'Raven button re-added to the header bar',
  headerVuePath,
  (code) => code.replace('<Dropdown :options="menuItems"', '<Button>Raven</Button><Dropdown :options="menuItems"'),
  'node scripts/test_mobile_navbar.cjs',
  'Raven must not be a header button'
);

// Mutant 7: Rose color palette removed from tailwind.config.cjs (Contrast regression)
runMutationTest(
  'Rose color palette stripped from tailwind.config.cjs (Contrast regression)',
  tailwindConfigPath,
  (code) => code.replace('rose: require("tailwindcss/colors").rose,', ''),
  'node scripts/test_attention_filter_contrast.cjs',
  'FAIL: tailwind.config.cjs does not include rose color palette'
);

// Mutant 8: Planner overdue filter tab stripped of Frappe UI theme="red"
runMutationTest(
  'Planner overdue filter tab stripped of Frappe UI theme="red"',
  calendarViewPath,
  (code) => code.replace("{ id: 'overdue', label: 'Overdue', theme: 'red' }", "{ id: 'overdue', label: 'Overdue', theme: 'invalid_theme' }"),
  'node scripts/test_frappe_ui_planner_tabs.cjs',
  'FAIL: the Overdue tab must use theme red'
);

// Mutant 9: an icon-only Button draws its icon in #prefix, so its label renders as "P…"
runMutationTest(
  'Planner prev Button loses its icon prop (label shows as visible text)',
  path.resolve(__dirname, '..', 'src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace(/icon="chevron-left"([^>]*?)\/>/, '$1><template #prefix><svg></svg></template></Button>'),
  'node scripts/test_workstation_interactions.cjs',
  'so its label shows as text; use the icon prop'
);

// Mutant 10: a long data list goes back into a search-less Dropdown
runMutationTest(
  'Teammate picker reverts from searchable Combobox to Dropdown',
  path.resolve(__dirname, '..', 'src/views/TimesheetsView.vue'),
  (code) => code.replace('<div v-if="isManager" class="w-52">', '<Dropdown :options="employeeOptions"><Button label="Member">Member</Button></Dropdown><div v-if="isManager" class="w-52">'),
  'node scripts/test_workstation_interactions.cjs',
  'data lists use a searchable <Combobox>'
);
runMutationTest(
  'Wrapper regains a native title around a Button tooltip',
  path.resolve(__dirname, '..', 'src/views/dashboard/DashboardDateSelector.vue'),
  (code) => code.replace('aria-keyshortcuts="Shift+D"', 'aria-keyshortcuts="Shift+D" title="Shift+D, then ← →"'),
  'node scripts/check_nested_tooltips.cjs',
  'they stack on hover'
);
runMutationTest(
  'Tailwind config loses the 950 / indigo palette extension',
  tailwindConfigPath,
  (code) => code.replace('indigo: require("tailwindcss/colors").indigo,', ''),
  'node scripts/check_palette_classes.cjs',
  'compile to nothing'
);

runMutationTest(
  'Planner mouse drag goes back to waiting for a hold',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationPlannerSelect.js'),
  (code) => code.replace("if (ev.pointerType === 'mouse') {", "if (false) {"),
  'node scripts/test_workstation_interactions.cjs',
  'must start a mouse drag immediately'
);
runMutationTest(
  'Planner slot row loses its native-drag guard',
  path.resolve(__dirname, '..', 'src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace('draggable="false"\n                @dragstart.prevent\n                @pointerdown="startSlotSelect', '@pointerdown="startSlotSelect'),
  'node scripts/test_workstation_interactions.cjs',
  'no native drag ghost appears'
);

// Popovers inside dialogs: layering, Escape ownership, chip keyboard model, End list
runMutationTest(
  'Popper wrapper loses its !important (reka inline z-index wins, list opens behind dialog)',
  path.resolve(__dirname, '..', 'src/styles/main.css'),
  (code) => code.replace('z-index: 60 !important;', 'z-index: 60;'),
  'node scripts/check_dialog_popovers.cjs',
  'needs !important'
);
runMutationTest(
  'Document Escape handler stops skipping events a popover already handled',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationEod.js'),
  (code) => code.replace('    if (e.defaultPrevented) return;\n', ''),
  'node scripts/check_dialog_popovers.cjs',
  'e.defaultPrevented'
);
runMutationTest(
  'Session popup minimises on the Escape that closed a list inside it',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationShortcuts.js'),
  (code) => code.replace('if (ev.defaultPrevented || popoverOpen()) return;', 'if (ev.defaultPrevented) return;'),
  'node scripts/check_dialog_popovers.cjs',
  'popoverOpen()'
);
runMutationTest(
  'The session Details tab shows the drawer actions again',
  path.resolve(__dirname, '..', 'src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('<div v-if="!inline" class="flex items-center gap-2">', '<div class="flex items-center gap-2">'),
  'node scripts/check_dialog_popovers.cjs',
  'action row'
);
runMutationTest(
  'Session tabs draw an outer focus ring the bar clips',
  path.resolve(__dirname, '..', 'src/session/SessionLogPane.vue'),
  (code) => code.replace('focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600', 'focus-visible:ring-2 focus-visible:ring-blue-600'),
  'node scripts/check_dialog_popovers.cjs',
  'inset focus ring'
);
runMutationTest(
  'The session card boxes the popup contents in a ring again',
  path.resolve(__dirname, '..', 'src/session/SessionBox.vue'),
  (code) => code.replace('dark:border-gray-800 p-4 sm:p-5\'"', 'dark:border-gray-800 p-4 sm:p-5\' + \' ring-2 ring-blue-500/60\'"'),
  'node scripts/check_dialog_popovers.cjs',
  'the popup is the frame'
);
runMutationTest(
  'The session pane can go blank on an unknown tab',
  path.resolve(__dirname, '..', 'src/session/useSessionChat.js'),
  (code) => code.replace("? activePaneTab.value : 'notes'", "? activePaneTab.value : ''"),
  'node scripts/test_workstation_interactions.cjs',
  'falls back to the Log'
);
runMutationTest(
  'Escape handler stops noting open popovers in the capture phase (MultiSelect Escape closes the dialog)',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationEod.js'),
  (code) => code.replace("addEventListener('keydown', notePopoverEscape, true)", "addEventListener('keydown', notePopoverEscape)"),
  'node scripts/check_dialog_popovers.cjs',
  'capture phase'
);
runMutationTest(
  'Escape handler ignores the popover note',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationEod.js'),
  (code) => code.replace('if (escForPopover) {', 'if (false) {'),
  'node scripts/check_dialog_popovers.cjs',
  'escForPopover'
);
runMutationTest(
  'Task names in the plan list go back to one truncated line',
  path.resolve(__dirname, '..', 'src/components/dialogs/PlanTaskStep.vue'),
  (code) => code.replace('leading-snug break-words line-clamp-3', 'truncate'),
  'node scripts/check_dialog_popovers.cjs',
  'must wrap'
);
runMutationTest(
  'The block drawer stops listing its linked tasks',
  path.resolve(__dirname, '..', 'src/drawers/BlockTasksSection.vue'),
  (code) => code.replace('v-for="(t, i) in rows"', 'v-for="(t, i) in []"'),
  'node scripts/check_dialog_popovers.cjs',
  'must list every task'
);
runMutationTest(
  'Logging a session goes back to a native time input',
  path.resolve(__dirname, '..', 'src/components/dialogs/TimesheetEntryDialog.vue'),
  (code) => code.replace('<DayTimeFields', '<input type="time" /><DayTimeFieldz'),
  'node scripts/check_dialog_popovers.cjs',
  'shared DayTimeFields'
);
runMutationTest(
  'A second dialog grows its own timesheet timing form',
  path.resolve(__dirname, '..', 'src/drawers/RescheduleBlockDialog.vue'),
  (code) => code.replace('title="Reschedule"', 'title="Adjust timesheet timing"'),
  'node scripts/check_dialog_popovers.cjs',
  'a timesheet dialog of its own'
);
runMutationTest(
  'The timesheet panel stops being rendered',
  path.resolve(__dirname, '..', 'src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace('<TimesheetEntryDialog', '<TimesheetEntryDialogx'),
  'node scripts/check_dialog_popovers.cjs',
  'renders TimesheetEntryDialog exactly once'
);
runMutationTest(
  'Keep running sets the start only in localStorage (the next sync reverts it)',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('startTime.value = ms;', "localStorage.setItem('omnitrack_tracker_start', String(ms));"),
  'node scripts/check_dialog_popovers.cjs',
  'restartClockAt sets startTime itself'
);
runMutationTest(
  'Stop and log writes its own session instead of the one stop path',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('await toggleTrack(end < Date.now() ? end : null);', "await postJSON('quick_timer_punch', { action: 'stop' });"),
  'node scripts/check_dialog_popovers.cjs',
  'the one stop path (toggleTrack)'
);
runMutationTest(
  'Logging a free window wipes the running session',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("    afterSave('Timesheet entry added');\n", "    trackerNotes.value = '';\n    afterSave('Timesheet entry added');\n"),
  'node scripts/check_dialog_popovers.cjs',
  'never touches the running session'
);
runMutationTest(
  'The running session panel copies its lines into the notes (logged twice)',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("notes: notesWithoutLines(trackerNotes.value || '', lines),", "notes: [trackerNotes.value, ...lines].join('\\n'),"),
  'node scripts/check_dialog_popovers.cjs',
  'edits its notes only'
);
runMutationTest(
  'Notes that repeat a session line are kept (logged twice)',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('filter(l => bare(l) && !known.has(bare(l)))', 'filter(l => bare(l))'),
  'node scripts/check_dialog_popovers.cjs',
  'must drop notes that repeat a session line'
);
runMutationTest(
  'The drawer grows its own manual-log form again',
  path.resolve(__dirname, '..', 'src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace("$emit('log-session', b)", "$emit('toggle-manual-log')"),
  'node scripts/check_dialog_popovers.cjs',
  'Add timesheet entry'
);
runMutationTest(
  'The block drawer climbs back above dialogs (Log work opens behind it)',
  path.resolve(__dirname, '..', 'src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('right-0 z-[45]', 'right-0 z-[60]'),
  'node scripts/check_dialog_popovers.cjs',
  'must be between 40 and 50'
);
runMutationTest(
  'Whose calendar says "Your calendar" again',
  path.resolve(__dirname, '..', 'src/components/dialogs/PlanWorkBlockDialog.vue'),
  (code) => code.replace('label: `${myName} (you)`', 'label: "Your calendar"'),
  'node scripts/check_dialog_popovers.cjs',
  'name the person'
);
runMutationTest(
  'ChoiceChips gives every chip a tab stop',
  path.resolve(__dirname, '..', 'src/components/common/ChoiceChips.vue'),
  (code) => code.replace(':tabindex="i === focusIndex ? 0 : -1"', ':tabindex="0"'),
  'node scripts/check_dialog_popovers.cjs',
  'roving tabindex'
);
runMutationTest(
  'End TimePicker goes back to a bare 15-minute interval',
  path.resolve(__dirname, '..', 'src/components/common/DayTimeFields.vue'),
  (code) => code.replace(':options="endOptions"', ':interval="15"'),
  'node scripts/check_dialog_popovers.cjs',
  'endOptions'
);

const drawerDir = (f) => path.resolve(__dirname, '..', 'src/drawers', f);
const DP = 'node scripts/check_dialog_popovers.cjs';
const TE = 'node scripts/check_timesheet_entry.mjs';
runMutationTest('Reschedule goes back to a form inside the drawer', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('<BlockTasksSection', '<form aria-label="Reschedule"></form><BlockTasksSection'), DP, 'no inline reschedule form');
runMutationTest('Reschedule stops opening its dialog', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('@click="showReschedule = true"', '@click="$emit(\'toggle-reschedule\')"'), DP, 'must open RescheduleBlockDialog');
runMutationTest('The Reschedule dialog loses its title', drawerDir('RescheduleBlockDialog.vue'),
  (code) => code.replace('title="Reschedule"', 'title="Edit"'), DP, 'titled Reschedule');
runMutationTest('Cancel block falls out of More actions', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace("label: 'Cancel block'", "label: 'Cancel'"), DP, 'Cancel block');
runMutationTest('Log work sits beside Start Session again', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('<BlockTasksSection', '<Button label="Log work" /><BlockTasksSection'), DP, 'must not sit beside');
runMutationTest('A task row loses its checkbox state', drawerDir('BlockTasksSection.vue'),
  (code) => code.replace(':aria-checked="t.done ? \'true\' : \'false\'"', ''), DP, 'role=checkbox Button');
runMutationTest('Task rows go back to frappe-ui Checkbox', drawerDir('BlockTasksSection.vue'),
  (code) => code.replace('<Button\n          variant="ghost"\n          role="checkbox"', '<Checkbox\n          variant="ghost"\n          role="checkbox"'), DP, 'second tab stop');
runMutationTest('Every task row becomes a tab stop', drawerDir('BlockTasksSection.vue'),
  (code) => code.replace(':tabindex="tabStop(i, 0)"', ':tabindex="0"'), DP, 'rove focus');
const taskFormFile = path.resolve(__dirname, '..', 'src/components/dialogs/TaskFormDialog.vue');
runMutationTest('Saving a task sends every field', taskFormFile,
  (code) => code.replace('...this.changes', '...this.form'), DP, 'only what changed');
runMutationTest('A workflow move skips its confirm', taskFormFile,
  (code) => code.replace('onClick: () => this.ask(a),', 'onClick: () => { this.confirming = a; this.move(); },'), DP, 'ask first');
runMutationTest('The task form hides where the task stands', taskFormFile,
  (code) => code.replace("{{ detail.state || 'Open' }}", "{{ detail.subject }}"), DP, 'where the task stands');
runMutationTest('Escape closes the form from a move\'s confirm', taskFormFile,
  (code) => code.replace(':esc-back="!!confirming"', ''), DP, 'steps back');
runMutationTest('Task details open the discussion drawer again', path.resolve(__dirname, '..', 'src/composables/useWorkstationPlannerSelect.js'),
  (code) => code.replace('    openTaskForm(task);', "    w.openTaskRavenDrawer(task, 'details');"), DP, 'openTaskDetails opens the one task form');
runMutationTest('A block task row opens its own dialog', drawerDir('BlockTasksSection.vue'),
  (code) => code.replace('openTaskForm(row, { block: this.block, canRemove: this.canAdd });', 'this.showEdit = true;'), DP, 'one task form');
runMutationTest('The dashboard gets a workflow menu again', path.resolve(__dirname, '..', 'src/views/dashboard/DashboardAttentionTasks.vue'),
  (code) => code.replace('</ul>', '<Dropdown :options="getTaskWorkflowMenuItems(t)"><Button label="Workflow" /></Dropdown></ul>'), DP, 'only in TaskFormDialog');
runMutationTest('Edit block shows on any block', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace(" && !this.isPastBlock(b) && b.status !== 'Cancelled';", ';'), DP, 'never on a past or cancelled block');
runMutationTest('Edit block stops opening its dialog', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace("onClick: () => { this.showEdit = true; }", "onClick: () => {}"), DP, 'opens EditBlockDialog');
runMutationTest('An unplanned live session is not seen as recording', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('return !!this.block.is_live_active || (', 'return ('), DP, 'counts as recording');
runMutationTest('The live block is titled by its notes again', path.resolve(__dirname, '..', 'src/composables/useWorkstationPlannerLayout.js'),
  (code) => code.replace('task_subject: heading,', 'task_subject: trackerNotes.value,'), DP, 'not a ticked-off task');
runMutationTest('Reschedule hides while a session records again', path.resolve(__dirname, '..', 'src/App.vue'),
  (code) => code.replace("isOpenPlan(b) && !b.is_live_active;", "isOpenPlan(b) && !b.is_live_active && !isRecordingOn(b);"), DP, 'the plan moves, the session stays');
runMutationTest('Cancel offered on a recording block', path.resolve(__dirname, '..', 'src/App.vue'),
  (code) => code.replace(" && !isRecordingOn(b);", ";"), DP, 'never offer Cancel');
runMutationTest('More actions offered on an unplanned live session', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('return b.is_live_active ? [] : out;', 'return out;'), DP, 'stays empty for an unplanned live session');
runMutationTest('Add tasks offered on an unplanned live session', drawerDir('BlockTasksSection.vue'),
  (code) => code.replace('return (this.block.is_session_tasks || !this.block.is_live_active) && this.canChange', 'return this.canChange'), DP, 'no Add tasks on an unplanned live session');
runMutationTest('Notes show raw Completed: lines again', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('{{ notes.text }}', '{{ block.deliverable_notes }}'), DP, 'never raw "Completed:" lines');
runMutationTest('A live session can be approved again', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('return !this.isRecording && this.sessions.length > 0;', 'return this.sessions.length > 0;'), DP, 'never while a session is recording');
runMutationTest('Saving a block sends every field', drawerDir('EditBlockDialog.vue'),
  (code) => code.replace('...changes }', '...this.form }'), DP, 'saves only what changed');
runMutationTest('A drawer chip goes back to frappe-ui subtle blue', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace(':class="chip(status.tone)"', ':theme="status.tone"'), DP, 'AA chip class');
runMutationTest('Add tasks offers tasks the block already has', drawerDir('AddBlockTasksDialog.vue'),
  (code) => code.replace('.filter((o) => !have.has(o.value))', ''), DP, 'less the block');
runMutationTest('An Escape a dialog took closes the drawer too', path.resolve(__dirname, '..', 'src/composables/useWorkstationEod.js'),
  (code) => code.replace('    else if (dialogEsc) return;\n', ''), DP, 'must not also close the block drawer');
runMutationTest('FDialog stops claiming its Escape', path.resolve(__dirname, '..', 'src/components/common/FDialog.vue'),
  (code) => code.replace('      markDialogEscape(e);\n', ''), DP, 'claim its Escape');
runMutationTest('Timesheet day chips ignore the horizon', path.resolve(__dirname, '..', 'src/utils/timesheetEntry.js'),
  (code) => code.replace('Math.round((Number(horizonHours) || 48) / 24)', '2'), TE, '72h horizon');
runMutationTest('A new entry defaults to a future block\'s own slot', path.resolve(__dirname, '..', 'src/utils/timesheetEntry.js'),
  (code) => code.replace('if (planned && day && day <= today)', 'if (planned && day)'), TE, 'a future block');
runMutationTest('Adding an entry drops log_work_session\'s result', path.resolve(__dirname, '..', 'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("return afterSave('Timesheet entry added', await postJSON('log_work_session'", "await postJSON('log_work_session'"), TE, 'log_work_session\'s result');
runMutationTest('A client-side day limit comes back', path.resolve(__dirname, '..', 'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("const withSeconds = ", "const minTimesheetDate = null;\n  const withSeconds = "), TE, 'server\'s horizon');
runMutationTest('Drawer Reschedule moves the store\'s block', path.resolve(__dirname, '..', 'src/composables/useWorkstationFocusTasks.js'),
  (code) => code.replace('    const b = activeBlock.value;\n    const f = form', '    const b = workBlockStore.activeBlock;\n    const f = form'), TE, 'w.activeBlock');
runMutationTest('A refused tick stays ticked', path.resolve(__dirname, '..', 'src/composables/useWorkstationFocusTasks.js'),
  (code) => code.replace('      Object.assign(item, before);\n', ''), TE, 'restore the task');

const SRC = (f) => path.resolve(__dirname, '..', f);
runMutationTest('The session popup loses its task list', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace(':block="trackerBoundBlock || liveSessionBlock"', ':block="trackerBoundBlock"'), DP, 'lists its tasks with BlockTasksSection');
runMutationTest('A session task opens the block form', drawerDir('BlockTasksSection.vue'),
  (code) => code.replace('openTaskForm(row, { onRemove: this.removeSessionTask, onChange: this.onSessionTaskChange })', 'openTaskForm(row, { block: this.block, canRemove: this.canAdd })'), DP, 'a session task opens the one task form');
runMutationTest('The task form ignores onChange', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace("typeof taskForm.onChange === 'function'", 'false'), DP, 'honours onRemove / onChange');
runMutationTest('Session tasks go to attach_tasks_to_block', drawerDir('AddBlockTasksDialog.vue'),
  (code) => code.replace('if (this.block.is_session_tasks) {\n          const n', 'if (false) {\n          const n'), DP, 'go to addSessionTasks');
runMutationTest('The live session forgets its tasks on sync', SRC('src/composables/useWorkstationSessionSync.js'),
  (code) => code.replace('sessionTasks: sessionTasks.value,', ''), DP, 'synced with it and restored');
runMutationTest('Stop drops the session\'s tasks', SRC('src/composables/useWorkstationApi.js'),
  (code) => code.replace('session_tasks: JSON.stringify(doneTasks)', "session_tasks: '[]'"), DP, 'Stop sends the session');
runMutationTest('quick_timer_punch stops attaching session tasks', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('attach_session_tasks(block, session_tasks)', 'pass'), DP, 'puts session_tasks on its new block');
runMutationTest('A tick is appended to the session title again', SRC('omnitrack/api/tasks.py'),
  (code) => code.replace('\t\t\t\tactive_sess["sessionNotesList"] = sess_list\n', '\t\t\t\tactive_sess["sessionNotesList"] = sess_list\n\t\t\t\tactive_sess["trackerNotes"] = accomplishment\n'), DP, 'trackerNotes is the session');
runMutationTest('clean_session_tasks keeps duplicate refs', SRC('omnitrack/utils/block_tasks.py'),
  (code) => code.replace(' or t["ref"] in seen', ''), DP, 'clean_session_tasks must dedupe');
runMutationTest('A session tool is no longer squared', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace(':class="TOOL_SQUARE"\n            :tabindex="activeToolIndex === 2', ':tabindex="activeToolIndex === 2'), DP, 'each of the 3 session tools');
runMutationTest('An FDialog Escape reaches the page again', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace('      e.stopPropagation();\n      this.open = false;', '      this.open = false;'), DP, 'keepEscape');
runMutationTest('A spread setup hides an undeclared template name', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace("        'modKey',\n", ''), 'node scripts/check_sfc_ctx.cjs', 'undeclared');

runMutationTest('Popover lists go back to a blurry raster layer', SRC('src/styles/main.css'),
  (code) => code.replace('[data-reka-popper-content-wrapper] { will-change: auto !important; }\n', ''), DP, 'will-change');

// Activity is a kind of time; planned-ness is the block's `unplanned` flag
const AK = 'node scripts/check_activity_kinds.cjs';
runMutationTest('JS toKind drops a marker Python still has', SRC('src/utils/activity.js'),
  (code) => code.replace("'absent', ", ''), AK, 'in JS but');
runMutationTest('An activity label differs from its value', SRC('src/utils/activity.js'),
  (code) => code.replace("value: 'Away', label: 'Away'", "value: 'Away', label: 'Away (Non-Paid)'"), AK, 'different label');
runMutationTest('A DocType loses an activity option', SRC('omnitrack/omnitrack/doctype/omnitrack_work_session/omnitrack_work_session.json'),
  (code) => code.replace('"options": "Work\\nBreak\\nAway"', '"options": "Work\\nMeeting\\nBreak\\nAway"'), AK, 'options are not the kinds');
runMutationTest('quick_timer_punch makes a planned-looking block', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('\t\tblock.unplanned = 1\n', ''), AK, 'quick_timer_punch must mark');
runMutationTest('fac auto-create forgets the unplanned flag', SRC('omnitrack/fac.py'),
  (code) => code.replace('frappe.db.set_value("Planned Work Block", target_block, "unplanned", 1, update_modified=False)', 'pass'), AK, 'auto-create must mark');
runMutationTest('KPIs read "Unplanned" from the activity again', SRC('src/composables/useDashboardKpis.js'),
  (code) => code.replace('&& !b.unplanned)', "&& !(b.task_nature || '').includes('Unplanned'))"), AK, 'planned hours must exclude');
runMutationTest('The timeline reads planned-ness from the activity', SRC('src/composables/useWorkstationTimeline.js'),
  (code) => code.replace('const isUnplanned = !!bk.unplanned;', "const isUnplanned = String(bk.task_nature).includes('Unplanned');"), AK, 'timeline must read');
runMutationTest('A legacy "Planned Work" default returns', SRC('src/composables/useWorkstationIdentity.js'),
  (code) => code.replace('const selectedNature = ref(WORK);', "const selectedNature = ref('Planned Work');"), AK, 'legacy activity value');
runMutationTest('The Activity picker passes display text through', SRC('src/session/useSessionDisplay.js'),
  (code) => code.replace("emit('update:nature', toKind(v))", "emit('update:nature', v)"), AK, 'through toKind');
runMutationTest('The activity split patch is unregistered', SRC('omnitrack/patches.txt'),
  (code) => code.replace('omnitrack.patches.v1_5.split_activity_from_planned\n', ''), AK, 'not registered');
runMutationTest('The Work / Break / Away merge patch is unregistered', SRC('omnitrack/patches.txt'),
  (code) => code.replace('omnitrack.patches.v1_5.merge_activity_into_work_break_away\n', ''), AK, 'not registered');
runMutationTest('The session picker adds a Non-Paid suffix again', SRC('src/session/useSessionDisplay.js'),
  (code) => code.replace('map(n => ({ label: n.label, value: n.value }))', 'map(n => ({ label: n.is_working ? n.label : `${n.label} (Non-Paid)`, value: n.value }))'), AK, 'legacy activity value');
runMutationTest('The calendar styles Absent apart from Away again', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace(`:class="isDarkMode ? 'text-amber-300' : 'text-amber-700'"`, `:class="b.task_nature.includes('Absent') ? 'text-rose-700' : 'text-amber-700'"`), AK, 'legacy activity value');

// Summary Report
console.log('\n===========================================================');
console.log(` Mutation Testing Summary:`);
console.log(`   Total Mutants Tested: ${totalMutants}`);
console.log(`   Killed Mutants (Caught): ${killedMutants}`);
console.log(`   Surviving Mutants (Missed): ${survivingMutants}`);
const mutationScore = Math.round((killedMutants / totalMutants) * 100);
console.log(`   Mutation Score: ${mutationScore}%`);
console.log('===========================================================\n');

if (survivingMutants > 0) {
  console.error(`FAIL: ${survivingMutants} mutant(s) survived! Harden the test suite.\n`);
  process.exit(1);
} else {
  console.log(`SUCCESS: 100% Mutation Score achieved! The test suite is authentic and robust.\n`);
  process.exit(0);
}
