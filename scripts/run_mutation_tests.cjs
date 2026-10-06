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
  'An emoji comes back into a user-facing label',
  path.resolve(__dirname, '..', 'src/components/dialogs/WrapAndStartNextModal.vue'),
  (code) => code.replace('label="Keep working"', 'label="\u{1F680} Keep working"'),
  'node scripts/check_no_glyphs.cjs',
  'emoji or pictographic glyphs'
);
runMutationTest(
  'A glyph comes back into a service-worker notification action',
  path.resolve(__dirname, '..', 'omnitrack/public/sw.js'),
  (code) => code.replace("title: 'Stop' }", "title: '\u23F9\uFE0F Stop' }"),
  'node scripts/check_no_glyphs.cjs',
  'omnitrack/public/sw.js'
);

runMutationTest(
  'The timeline loses its 3h zoom',
  path.resolve(__dirname, '..', 'src/utils/timelineZoom.js'),
  (code) => code.replace('= [3, 6, 12, 24]', '= [6, 12, 24]'),
  'node scripts/check_timeline_zoom.mjs',
  'every screen offers 3h'
);
runMutationTest(
  'Phones open the timeline on 6h again',
  path.resolve(__dirname, '..', 'src/utils/timelineZoom.js'),
  (code) => code.replace('if (width < PHONE_MAX_WIDTH) return 3;', ''),
  'node scripts/check_timeline_zoom.mjs',
  'opens on 3h'
);
runMutationTest(
  'The day subtitle repeats logged hours again',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationDashboard.js'),
  (code) => code.replace("return n ? n + (n === 1 ? ' block' : ' blocks') : '';", "return n ? n + (n === 1 ? ' block' : ' blocks') + ' · 0.0h logged' : '';"),
  'node scripts/check_timeline_zoom.mjs',
  'must not repeat planned or logged hours'
);

runMutationTest(
  'The recording bar reads the wall clock again and falls behind the now line',
  path.resolve(__dirname, '..', 'src/composables/useWorkstationTimeline.js'),
  (code) => code.replace('const ee = Math.max(ss + 1, nowMinute.value);', 'const curNow = new Date();\n        const ee = Math.max(ss + 1, curNow.getHours() * 60 + curNow.getMinutes());'),
  'node scripts/check_timeline_zoom.mjs',
  'must end at nowMinute.value'
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
  (code) => code.replace('    else if (dialogEsc) return;\n', ''), DP, 'must not also close the entry sheet or the block drawer');
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

// Block reminders: the app's clock, the server's windows, the socket, one alert each
const BR = 'node scripts/check_block_reminders.mjs';
runMutationTest('The reminder lead grows to eleven minutes', SRC('src/utils/blockReminders.js'),
  (code) => code.replace('export const LEAD_MIN = 10;', 'export const LEAD_MIN = 11;'), BR, 'FAIL: block reminders');
runMutationTest('A start reminder goes out however late', SRC('src/utils/blockReminders.js'),
  (code) => code.replace('until <= 0 && until >= -START_GRACE_MIN', 'until <= 0'), BR, 'six minutes late');
runMutationTest('A started block is reminded again', SRC('src/utils/blockReminders.js'),
  (code) => code.replace("new Set(['Draft', 'Planned'])", "new Set(['Draft', 'Planned', 'In Progress'])"), BR, 'started block');
runMutationTest("Someone else's block reminds me", SRC('src/utils/blockReminders.js'),
  (code) => code.replace('if (user && b.employee && b.employee !== user) continue;\n', ''), BR, 'not mine');
runMutationTest('The running block is reminded', SRC('src/utils/blockReminders.js'),
  (code) => code.replace('if (runningBlock && b.name === runningBlock) continue;\n', ''), BR, 'already running');
runMutationTest('The server goes back to narrow fixed windows', SRC('omnitrack/notifications.py'),
  (code) => code.replace('kind = reminder_kind(delta_mins)', 'kind = "upcoming_10m" if 8 <= delta_mins <= 11 else None'), BR, 'reminder_kind');
runMutationTest('The server lead drifts from the app', SRC('omnitrack/notifications.py'),
  (code) => code.replace('REMINDER_LEAD_MIN = 10', 'REMINDER_LEAD_MIN = 15'), BR, 'must equal blockReminders.js');
runMutationTest('Tapping the start reminder starts a session', SRC('omnitrack/notifications.py'),
  (code) => code.replace(/(Time to start: \{0\}[\s\S]*?)action_url = f"\/omnitrack\?action=view_block/, '$1action_url = f"/omnitrack?action=start_block'), BR, 'only its Start session button');
runMutationTest('The socket namespace is literal Jinja again', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace('const siteName = page.site || host;', 'const siteName = "{{ frappe.local.site }}";'), BR, 'never rendered by Jinja');
runMutationTest('A reminder is shown twice', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace('if (localStorage.getItem(key)) return;', 'localStorage.getItem(key);'), BR, 'not shown again');
runMutationTest('The app has no reminder clock', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace('_reminderTimer = setInterval(checkBlockReminders, 20000);', ''), BR, 'reminder clock');
runMutationTest('Notify only when the tab is hidden', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace("const away = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());", 'const away = document.hidden;'), BR, 'not in front');
runMutationTest('The page does not tell the app its site', SRC('omnitrack/www/omnitrack.html'),
  (code) => code.replace('      site: "{{ site_name }}",\n', ''), BR, 'its site and socket port');
runMutationTest('A logged bar opens the block again', SRC('src/views/dashboard/DashboardTimeline.vue'),
  (code) => code.replace('@click="openLogged(r)"', '@click="openBlockDrawer(r.block)"'), BR, 'opens its session, not the block');
runMutationTest('Served sessions lose their names', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('"name": s.name,\n', ''), BR, 'carries its name');
runMutationTest('A logged bar opens the edit form again', SRC('src/views/dashboard/DashboardTimeline.vue'),
  (code) => code.replace('this.openSessionDrawer(r.block, r.session)', 'this.openEditSessionModal(r.block, r.session)'), BR, "entry's details sheet");
runMutationTest('The entry form grows a view mode again', SRC('src/components/dialogs/TimesheetEntryDialog.vue'),
  (code) => code.replace('<form class="space-y-4"', '<div v-if="form.viewing" data-entry-view></div><form v-else class="space-y-4"'), BR, 'the one entry form is only a form');
runMutationTest('The entry sheet loses its dialog role', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('role="dialog" aria-modal="true" ', ''), BR, 'a labelled modal dialog');
runMutationTest('The entry sheet drops the task moves', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<section v-if="moves.length"', '<section v-if="false"'), BR, 'task moves made while the entry ran');
runMutationTest('An unplanned entry shows a plan', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<section v-if="!block.unplanned"', '<section'), BR, 'an unplanned entry shows no plan');
runMutationTest('Escape leaves the entry sheet open', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace('    else if (showSessionDrawer.value) showSessionDrawer.value = false;\n', ''), BR, 'Escape closes the entry sheet');
runMutationTest('A workflow move is not a task change', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('_TASK_STATE_FIELDS = ("status", "workflow_state")', '_TASK_STATE_FIELDS = ("status",)'), BR, 'status or a workflow_state change');
runMutationTest("An entry's tasks lose their workflow", SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('"tasks": [_with_workflow(t) for t in block_tasks(block)]', '"tasks": block_tasks(block)'), BR, "each task's workflow state and moves");
runMutationTest('An entry shows tasks the viewer cannot read', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace(' or not frappe.has_permission(doctype, "read", name)', ''), BR, 'only for tasks the viewer may read');
runMutationTest('A task row shows its stale status again', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('taskState(t) { return t.state || t.status', 'taskState(t) { return t.status || t.state'), BR, 'shows its workflow state');
runMutationTest('A task row offers no moves', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<Dropdown v-if="taskMoves(t).length" :options="taskMoves(t)"', '<Dropdown v-if="false" :options="taskMoves(t)"'), BR, 'shows its workflow state');
runMutationTest('A move skips the confirm step', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('openTaskForm(t, { block: this.entry && this.entry.block, ask: a.action })', 'openTaskForm(t, { block: this.entry && this.entry.block })'), BR, 'opens the task form at its confirm step');
runMutationTest('The task list loses Left/Right', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('ArrowRight: [r, cols(r)], ArrowLeft: [r, 0]', 'ArrowRight: [r, 0], ArrowLeft: [r, 0]'), BR, 'Left/Right between a task and its status');
runMutationTest('A reload strands the tab stop', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('        this.clampCell();\n', ''), BR, 'Left/Right between a task and its status');
runMutationTest('The entry sheet leaves focus behind', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace("sheet.querySelector('[data-sheet-close]')", "sheet.querySelector('[data-none]')"), BR, 'focus moves into the sheet');
runMutationTest('Closing the entry sheet drops focus', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('if (lost && opener && document.contains(opener)) opener.focus();', ''), BR, 'back to its opener on close');
runMutationTest('The task form ignores the move it was opened for', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace('if (a) this.ask(a);', 'if (a) void a;'), BR, "straight to that move's confirm step");
runMutationTest('A manager loses New task again', SRC('src/components/layout/WorkstationBottomNav.vue'),
  (code) => code.replace('        theme="gray"\n', '        v-else\n        theme="gray"\n'), BR, 'New task shows for managers too');
runMutationTest('The bottom bar becomes a tablist again', SRC('src/components/layout/WorkstationBottomNav.vue'),
  (code) => code.replace('    aria-label="Workstation navigation"', '    role="tablist"\n    aria-label="Workstation navigation"'), BR, 'no tab roles');
runMutationTest('Planner titles clip to one line again', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace(':style="clampStyle(titleLines(seg))"', 'class="truncate"'), BR, "a block's title wraps");
runMutationTest('A split lane crams its time in again', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace('const time = !this.isSplit(seg) && lines >= 2;', 'const time = lines >= 2;'), BR, 'leaves its time to the hover card');
runMutationTest('Task names in the entry sheet are cut off again', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('text-left text-base [overflow-wrap:anywhere]', 'text-left text-base truncate'), BR, "full name shows, wrapped");
runMutationTest('A flag loses its reason again', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('b_doc.approval_notes = b_doc.flagged_reason', 'pass'), BR, 'keeps the reason in approval_notes');
runMutationTest("The dashboard's sessions lose their names", SRC('omnitrack/api/workstation.py'),
  (code) => code.replace('SELECT name, parent, session_date', 'SELECT parent, session_date'), BR, "dashboard's sessions carry their name");
runMutationTest("frappe-ui's own socket is switched back on", SRC('src/frappeUiComponents.js'),
  (code) => code.replace('{ socketio: false }', '{}'), BR, 'socket stays off');
runMutationTest('The app installs FrappeUI bare again', SRC('src/main.js'),
  (code) => code.replace('app.use(FrappeUI, FRAPPE_UI_OPTIONS);', 'app.use(FrappeUI);'), BR, 'never bare');

// The day is named once
const DH = 'node scripts/check_day_header.mjs';
runMutationTest('Plan loses its visible label', SRC('src/views/dashboard/DashboardDateSelector.vue'),
  (code) => code.replace('@click="openNewTaskModal">Plan</Button>', '@click="openNewTaskModal" />'), DH, 'visible label');
runMutationTest('The summary repeats the date', SRC('src/composables/useWorkstationDashboard.js'),
  (code) => code.replace("return n ? n + (n === 1 ? ' block' : ' blocks') : '';", "return new Date().toLocaleDateString() + (n ? ' · ' + n + ' blocks' : '');"), DH, 'never repeats the date');

// A block is called by its typed title
const BT = 'node scripts/check_block_title.mjs';
runMutationTest('Booking names the block after the first task', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace(/work_item_label:\s*notes\s*\|\|\s*\(picked \? picked\.subject : newTask\)/, 'work_item_label: (picked ? picked.subject : newTask) || notes'), BT, 'typed Title first');
runMutationTest('A view builds its own title chain', SRC('src/views/dashboard/DashboardTimeline.vue'),
  (code) => code.replace("{{ blockTitle(r.block, 'Block') }}", "{{ r.block.task_subject || r.block.deliverable_notes }}"), BT, 'builds its own block title');

// The switch dialog never asks to retype the log
const SD = 'node scripts/check_switch_dialog.mjs';
runMutationTest('The switch prefills the log again', SRC('src/composables/useWorkstationAttendance.js'),
  (code) => code.replace("switchWrapUpNote.value = '';", "switchWrapUpNote.value = (sessionNotesList.value || []).join('\\n');"), SD, 'FAIL: switch dialog');
runMutationTest('The last line is dropped from the saved notes', SRC('src/utils/wrapNote.js'),
  (code) => code.replace('[...(logLines || []), lastLine]', '[...(logLines || [])]'), SD, 'FAIL: switch dialog');

// Undo an approval: briefly, by its approver, with the draft Timesheet it made
runMutationTest('An approval forgets what it replaced', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('_remember_review(b_name, approver, before)', 'pass'), BR, 'so it can be undone');
runMutationTest("Anyone can undo someone else's approval", SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('if not saved or saved.get("by") != user:', 'if not saved:'), BR, 'only the approver');
runMutationTest('Undo overwrites a review made since', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('b_doc.approval_status != "Approved" or b_doc.approved_by != user:', 'False:'), BR, 'only the approver');
runMutationTest('Undo removes a submitted Timesheet', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('"docstatus") != 0:', '"docstatus") > 1:'), BR, 'never a submitted one');
runMutationTest('Approving offers no Undo', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace("action: { label: 'Undo', onClick: () => undoApproval(b) }, ", ''), BR, 'offers Undo for 5 seconds');
runMutationTest('The Undo window shrinks', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace('const UNDO_APPROVAL_MS = 5000;', 'const UNDO_APPROVAL_MS = 1000;'), BR, 'offers Undo for 5 seconds');
runMutationTest('The toast hides its action', SRC('src/App.vue'),
  (code) => code.replace('v-if="toast.action"', 'v-if="false"'), BR, 'the toast shows its action');
runMutationTest('The toast closes under the pointer', SRC('src/App.vue'),
  (code) => code.replace(' @mouseenter="holdToast"', ''), BR, 'waits while it is hovered');
runMutationTest("An old toast's timer closes a new one", SRC('src/composables/useWorkstationStoreBindings.js'),
  (code) => code.replace('clearTimeout(toastTimer);\n    toastLeft = ms;', 'toastLeft = ms;'), BR, 'restarts the timer');
runMutationTest('Flagged is not an approval status', SRC('omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.json'),
  (code) => code.replace('Approved\\nFlagged\\nRejected', 'Approved\\nRejected'), BR, 'every Flag is rejected');

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
