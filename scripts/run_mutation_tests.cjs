#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

console.log('===========================================================');
console.log('   OmniTrack Automated Mutation Testing Framework (TDD++)  ');
console.log('===========================================================\n');

// Mutants go into a throwaway copy of the app, never the files bench serves.
// Rewriting a served Python file restarts `bench start`'s web process, and one
// such run left it cutting every large response short (AGENTS.md). Mutant 1 also
// rebuilt the served bundle with a broken Vue.
const appDir = path.resolve(__dirname, '..');
const NOT_COPIED = new Set(['node_modules', '.git', '.ruff_cache', '__pycache__']);
const omnitrackDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitrack-mutants-'));
fs.cpSync(appDir, omnitrackDir, { recursive: true, filter: (src) => !NOT_COPIED.has(path.basename(src)) });
const linkedModules = path.join(omnitrackDir, 'node_modules');
fs.symlinkSync(path.join(appDir, 'node_modules'), linkedModules, 'dir');
process.on('exit', () => {
  fs.unlinkSync(linkedModules);
  fs.rmSync(omnitrackDir, { recursive: true, force: true });
});
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
  if (!path.resolve(fileToMutate).startsWith(omnitrackDir + path.sep)) {
    throw new Error(`Mutant "${name}" would rewrite a served file: ${fileToMutate}`);
  }
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

// Mutant 8: a planner filter chip goes back to its own colour, unreadable in dark mode
runMutationTest(
  'Planner filter chips lose their grey dark-mode selection',
  calendarViewPath,
  (code) => code.replace(`:class="plannerTaskFilter === tab.id ? 'dark:!bg-gray-700 dark:!text-white' : ''"`, ''),
  'node scripts/test_frappe_ui_planner_tabs.cjs',
  'planner filter chips are grey'
);

// Mutant 9: an icon-only Button draws its icon in #prefix, so its label renders as "P…"
runMutationTest(
  'Planner prev Button loses its icon prop (label shows as visible text)',
  path.resolve(omnitrackDir,'src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace(/icon="chevron-left"([^>]*?)\/>/, '$1><template #prefix><svg></svg></template></Button>'),
  'node scripts/test_workstation_interactions.cjs',
  'so its label shows as text; use the icon prop'
);

// Mutant 10: a long data list goes back into a search-less Dropdown
runMutationTest(
  'Teammate picker reverts from searchable Combobox to Dropdown',
  path.resolve(omnitrackDir,'src/views/TimesheetsView.vue'),
  (code) => code.replace('<div v-if="isManager" class="w-52">', '<Dropdown :options="employeeOptions"><Button label="Member">Member</Button></Dropdown><div v-if="isManager" class="w-52">'),
  'node scripts/test_workstation_interactions.cjs',
  'data lists use a searchable <Combobox>'
);
runMutationTest(
  'Wrapper regains a native title around a Button tooltip',
  path.resolve(omnitrackDir,'src/views/dashboard/DashboardDateSelector.vue'),
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
  path.resolve(omnitrackDir,'src/components/dialogs/WrapAndStartNextModal.vue'),
  (code) => code.replace('label="Keep working"', 'label="\u{1F680} Keep working"'),
  'node scripts/check_no_glyphs.cjs',
  'emoji or pictographic glyphs'
);
runMutationTest(
  'A glyph comes back into a service-worker notification action',
  path.resolve(omnitrackDir,'omnitrack/public/sw.js'),
  (code) => code.replace("title: 'Stop' }", "title: '\u23F9\uFE0F Stop' }"),
  'node scripts/check_no_glyphs.cjs',
  'omnitrack/public/sw.js'
);

runMutationTest(
  'The timeline loses its 3h zoom',
  path.resolve(omnitrackDir,'src/utils/timelineZoom.js'),
  (code) => code.replace('= [3, 6, 12, 24]', '= [6, 12, 24]'),
  'node scripts/check_timeline_zoom.mjs',
  'every screen offers 3h'
);
runMutationTest(
  'Phones open the timeline on 6h again',
  path.resolve(omnitrackDir,'src/utils/timelineZoom.js'),
  (code) => code.replace('if (width < PHONE_MAX_WIDTH) return 3;', ''),
  'node scripts/check_timeline_zoom.mjs',
  'opens on 3h'
);
runMutationTest(
  'The day subtitle repeats logged hours again',
  path.resolve(omnitrackDir,'src/composables/useWorkstationDashboard.js'),
  (code) => code.replace("return n ? n + (n === 1 ? ' block' : ' blocks') : '';", "return n ? n + (n === 1 ? ' block' : ' blocks') + ' · 0.0h logged' : '';"),
  'node scripts/check_timeline_zoom.mjs',
  'must not repeat planned or logged hours'
);

runMutationTest(
  'The recording bar reads the wall clock again and falls behind the now line',
  path.resolve(omnitrackDir,'src/composables/useWorkstationTimeline.js'),
  (code) => code.replace('const ee = Math.max(ss + 1, nowMinute.value);', 'const curNow = new Date();\n        const ee = Math.max(ss + 1, curNow.getHours() * 60 + curNow.getMinutes());'),
  'node scripts/check_timeline_zoom.mjs',
  'must end at nowMinute.value'
);

runMutationTest(
  'Planner mouse drag goes back to waiting for a hold',
  path.resolve(omnitrackDir,'src/composables/useWorkstationPlannerSelect.js'),
  (code) => code.replace("if (ev.pointerType === 'mouse') {", "if (false) {"),
  'node scripts/test_workstation_interactions.cjs',
  'must start a mouse drag immediately'
);
runMutationTest(
  'Planner slot row loses its native-drag guard',
  path.resolve(omnitrackDir,'src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace('draggable="false"\n                @dragstart.prevent\n                @pointerdown="startSlotSelect', '@pointerdown="startSlotSelect'),
  'node scripts/test_workstation_interactions.cjs',
  'no native drag ghost appears'
);

// Popovers inside dialogs: layering, Escape ownership, chip keyboard model, End list
runMutationTest(
  'Popper wrapper loses its !important (reka inline z-index wins, list opens behind dialog)',
  path.resolve(omnitrackDir,'src/styles/main.css'),
  (code) => code.replace('z-index: 60 !important;', 'z-index: 60;'),
  'node scripts/check_dialog_popovers.cjs',
  'needs !important'
);
runMutationTest(
  'Document Escape handler stops skipping events a popover already handled',
  path.resolve(omnitrackDir,'src/composables/useWorkstationEod.js'),
  (code) => code.replace('    if (e.defaultPrevented) return;\n', ''),
  'node scripts/check_dialog_popovers.cjs',
  'e.defaultPrevented'
);
runMutationTest(
  'Session popup minimises on the Escape that closed a list inside it',
  path.resolve(omnitrackDir,'src/composables/useWorkstationShortcuts.js'),
  (code) => code.replace('if (ev.defaultPrevented || popoverOpen()) return;', 'if (ev.defaultPrevented) return;'),
  'node scripts/check_dialog_popovers.cjs',
  'popoverOpen()'
);
runMutationTest(
  'The session Details tab shows the drawer actions again',
  path.resolve(omnitrackDir,'src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('<div v-if="!inline" class="flex items-center gap-2">', '<div class="flex items-center gap-2">'),
  'node scripts/check_dialog_popovers.cjs',
  'action row'
);
runMutationTest(
  'Session tabs draw an outer focus ring the bar clips',
  path.resolve(omnitrackDir,'src/utils/materialTab.js'),
  (code) => code.replace('focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600', 'focus-visible:ring-2 focus-visible:ring-blue-600'),
  'node scripts/check_dialog_popovers.cjs',
  'inset focus ring'
);
runMutationTest(
  'The session card boxes the popup contents in a ring again',
  path.resolve(omnitrackDir,'src/session/SessionBox.vue'),
  (code) => code.replace('dark:border-gray-800 p-4 sm:p-5\'"', 'dark:border-gray-800 p-4 sm:p-5\' + \' ring-2 ring-blue-500/60\'"'),
  'node scripts/check_dialog_popovers.cjs',
  'the popup is the frame'
);
runMutationTest(
  'The session pane can go blank on an unknown tab',
  path.resolve(omnitrackDir,'src/session/useSessionChat.js'),
  (code) => code.replace("? activePaneTab.value : 'notes'", "? activePaneTab.value : ''"),
  'node scripts/test_workstation_interactions.cjs',
  'falls back to the Log'
);
runMutationTest(
  'Escape handler stops noting open popovers in the capture phase (MultiSelect Escape closes the dialog)',
  path.resolve(omnitrackDir,'src/composables/useWorkstationEod.js'),
  (code) => code.replace("addEventListener('keydown', notePopoverEscape, true)", "addEventListener('keydown', notePopoverEscape)"),
  'node scripts/check_dialog_popovers.cjs',
  'capture phase'
);
runMutationTest(
  'Escape handler ignores the popover note',
  path.resolve(omnitrackDir,'src/composables/useWorkstationEod.js'),
  (code) => code.replace('if (escForPopover) {', 'if (false) {'),
  'node scripts/check_dialog_popovers.cjs',
  'escForPopover'
);
runMutationTest(
  'Task names in the plan list go back to one truncated line',
  path.resolve(omnitrackDir,'src/components/dialogs/PlanTaskStep.vue'),
  (code) => code.replace('leading-snug break-words line-clamp-3', 'truncate'),
  'node scripts/check_dialog_popovers.cjs',
  'must wrap'
);
runMutationTest(
  'The block drawer stops listing its linked tasks',
  path.resolve(omnitrackDir,'src/drawers/BlockTasksSection.vue'),
  (code) => code.replace('v-for="(t, i) in rows"', 'v-for="(t, i) in []"'),
  'node scripts/check_dialog_popovers.cjs',
  'must list every task'
);
runMutationTest(
  'Logging a session goes back to a native time input',
  path.resolve(omnitrackDir,'src/components/dialogs/TimesheetEntryDialog.vue'),
  (code) => code.replace('<DayTimeFields', '<input type="time" /><DayTimeFieldz'),
  'node scripts/check_dialog_popovers.cjs',
  'shared DayTimeFields'
);
runMutationTest(
  'A second dialog grows its own timesheet timing form',
  path.resolve(omnitrackDir,'src/drawers/RescheduleBlockDialog.vue'),
  (code) => code.replace('title="Reschedule"', 'title="Adjust timesheet timing"'),
  'node scripts/check_dialog_popovers.cjs',
  'a timesheet dialog of its own'
);
runMutationTest(
  'The timesheet panel stops being rendered',
  path.resolve(omnitrackDir,'src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace('<TimesheetEntryDialog', '<TimesheetEntryDialogx'),
  'node scripts/check_dialog_popovers.cjs',
  'renders TimesheetEntryDialog exactly once'
);
runMutationTest(
  'Keep running sets the start only in localStorage (the next sync reverts it)',
  path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('startTime.value = ms;', "localStorage.setItem('omnitrack_tracker_start', String(ms));"),
  'node scripts/check_dialog_popovers.cjs',
  'restartClockAt sets startTime itself'
);
runMutationTest(
  'Stop and log writes its own session instead of the one stop path',
  path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('await toggleTrack(end < Date.now() ? end : null);', "await postJSON('quick_timer_punch', { action: 'stop' });"),
  'node scripts/check_dialog_popovers.cjs',
  'the one stop path (toggleTrack)'
);
runMutationTest(
  'Logging a free window wipes the running session',
  path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("    afterSave('Work session added');\n", "    trackerNotes.value = '';\n    afterSave('Work session added');\n"),
  'node scripts/check_dialog_popovers.cjs',
  'never touches the running session'
);
runMutationTest(
  'The running session panel copies its lines into the notes (logged twice)',
  path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("notes: notesWithoutLines(trackerNotes.value || '', lines),", "notes: [trackerNotes.value, ...lines].join('\\n'),"),
  'node scripts/check_dialog_popovers.cjs',
  'edits its notes only'
);
runMutationTest(
  'Notes that repeat a session line are kept (logged twice)',
  path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('filter(l => bare(l) && !known.has(bare(l)))', 'filter(l => bare(l))'),
  'node scripts/check_dialog_popovers.cjs',
  'must drop notes that repeat a session line'
);
runMutationTest(
  'The drawer grows its own manual-log form again',
  path.resolve(omnitrackDir,'src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace("$emit('log-session', b)", "$emit('toggle-manual-log')"),
  'node scripts/check_dialog_popovers.cjs',
  'Add work session'
);
runMutationTest(
  'The block drawer climbs back above dialogs (Log work opens behind it)',
  path.resolve(omnitrackDir,'src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('right-0 z-[45]', 'right-0 z-[60]'),
  'node scripts/check_dialog_popovers.cjs',
  'must be between 40 and 50'
);
runMutationTest(
  'Whose calendar says "Your calendar" again',
  path.resolve(omnitrackDir,'src/components/dialogs/PlanWorkBlockDialog.vue'),
  (code) => code.replace('label: `${myName} (you)`', 'label: "Your calendar"'),
  'node scripts/check_dialog_popovers.cjs',
  'name the person'
);
runMutationTest(
  'ChoiceChips gives every chip a tab stop',
  path.resolve(omnitrackDir,'src/components/common/ChoiceChips.vue'),
  (code) => code.replace(':tabindex="i === focusIndex ? 0 : -1"', ':tabindex="0"'),
  'node scripts/check_dialog_popovers.cjs',
  'roving tabindex'
);
runMutationTest(
  'End TimePicker goes back to a bare 15-minute interval',
  path.resolve(omnitrackDir,'src/components/common/DayTimeFields.vue'),
  (code) => code.replace(':options="endOptions"', ':interval="15"'),
  'node scripts/check_dialog_popovers.cjs',
  'endOptions'
);

const drawerDir = (f) => path.resolve(omnitrackDir,'src/drawers', f);
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
const taskFormFile = path.resolve(omnitrackDir,'src/components/dialogs/TaskFormDialog.vue');
runMutationTest('Saving a task sends every field', taskFormFile,
  (code) => code.replace('...this.changes', '...this.form'), DP, 'only what changed');
runMutationTest('A workflow move skips its confirm', taskFormFile,
  (code) => code.replace('onClick: () => this.ask(a),', 'onClick: () => { this.confirming = a; this.move(); },'), DP, 'ask first');
runMutationTest('The task form hides where the task stands', taskFormFile,
  (code) => code.replace("{{ detail.state || 'Open' }}", "{{ detail.subject }}"), DP, 'where the task stands');
runMutationTest('Escape closes the form from a move\'s confirm', taskFormFile,
  (code) => code.replace(':esc-back="!!confirming"', ''), DP, 'steps back');
const DA = 'node scripts/check_doc_activity.mjs';
runMutationTest('The task panel loses its Activity', drawerDir('TaskDetailDrawer.vue'),
  (code) => code.replace('<DocActivity v-if="d" :doctype="doc.doctype" :name="doc.name" :is-dark-mode="isDarkMode" />', ''), DA, "task's or to-do's own Activity");
runMutationTest('The session sheet shows no Activity', drawerDir('SessionDetailDrawer.vue'),
  (code) => code.replace(':note="activityNote" ', ''), DA, "its block's Activity");
runMutationTest('A block opens a Raven channel again', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace("emits: [", "emits: ['open-raven', "), DA, 'not a Raven channel');
runMutationTest('A To-Do offers Raven chat again', drawerDir('TaskDetailDrawer.vue'),
  (code) => code.replace("...(this.doc.doctype === 'Task' ? [{ label: 'Raven chat'", "...(true ? [{ label: 'Raven chat'"), DA, 'ERPNext Task only');
runMutationTest('The task form offers Raven chat on a To-Do', path.resolve(omnitrackDir,'src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace("if (this.linked.doctype === 'Task') items.push({ label: 'Raven chat'", "items.push({ label: 'Raven chat'"), DA, 'ERPNext Task only');
runMutationTest('The server makes Raven channels for blocks again', path.resolve(omnitrackDir,'omnitrack/raven_bridge.py'),
  (code) => code.replace('\tif doctype != "Task":\n\t\treturn None', '\tif not doctype:\n\t\treturn None'), DA, 'a Task and nothing else');
runMutationTest('Desk shows Raven on a block again', path.resolve(omnitrackDir,'omnitrack/hooks.py'),
  (code) => code.replace('"Task": ["omnitrack.raven_bridge.get_task_raven_timeline_content"],', '"Task": ["omnitrack.raven_bridge.get_task_raven_timeline_content"],\n\t"Planned Work Block": ["x"],'), DA, 'Task only');
runMutationTest('Activity reads without a permission check', path.resolve(omnitrackDir,'omnitrack/api/activity.py'),
  (code) => code.replace('\tdoc.check_permission("read")\n', ''), DA, 'checks read permission');
runMutationTest('Activity opens any DocType', path.resolve(omnitrackDir,'omnitrack/api/activity.py'),
  (code) => code.replace('if doctype not in DOCTYPES or ', 'if '), DA, 'refuses any other DocType');
runMutationTest('A comment can be posted with GET', path.resolve(omnitrackDir,'omnitrack/api/activity.py'),
  (code) => code.replace('@frappe.whitelist(methods=["POST"])\ndef add_comment', '@frappe.whitelist()\ndef add_comment'), DA, 'POST only');
runMutationTest('Typed text is stored unescaped', path.resolve(omnitrackDir,'omnitrack/api/activity.py'),
  (code) => code.replace('frappe.utils.escape_html(p.strip())', 'p.strip()'), DA, 'escaped before');
runMutationTest('Comment HTML reaches the panel unsanitized', path.resolve(omnitrackDir,'omnitrack/api/activity.py'),
  (code) => code.replace('"html": sanitize_html(row.content or "", always_sanitize=True)', '"html": row.content or ""'), DA, 'sanitized before');
const ACT = path.resolve(omnitrackDir,'omnitrack/api/activity.py');
runMutationTest('Several rows read "added a task (2)" again', ACT,
  (code) => code.replace('_(nouns[0]) if n == 1 else _(nouns[1]).format(n)', '_(nouns[0]) + (f" ({n})" if n > 1 else "")'), DA, 'added 2 tasks');
runMutationTest('Repeated events show as equal lines', ACT,
  (code) => code.replace('return _fold(items)[-MAX_ITEMS:]', 'return items[-MAX_ITEMS:]'), DA, 'folded into one line');
runMutationTest('Comments fold together', ACT,
  (code) => code.replace('and it["kind"] == "event" == last["kind"]', 'and it["kind"] == last["kind"]'), DA, 'never comments');
runMutationTest('Two people\'s events fold together', ACT,
  (code) => code.replace('\t\t\tand it.get("by") == last.get("by")\n', ''), DA, "same person's");
runMutationTest('Events a day apart fold together', ACT,
  (code) => code.replace('.total_seconds() <= FOLD_SECONDS', '.total_seconds() <= FOLD_SECONDS * 1000'), DA, 'minutes apart');
runMutationTest('A folded line keeps its first time', ACT,
  (code) => code.replace('last["at"], last["id"] = it["at"], it.get("id")', 'pass'), DA, 'latest time');
const DAC = path.resolve(omnitrackDir,'src/components/common/DocActivity.vue');
runMutationTest('The comment box has no name', DAC,
  (code) => code.replace(":label=\"'Comment on this ' + noun\"", ''), DA, 'visible label');
runMutationTest('Ctrl+Enter stops posting', DAC,
  (code) => code.replace('@keydown.ctrl.enter.prevent="post"', ''), DA, 'Ctrl+Enter posts');
runMutationTest('A failed post is silent', DAC,
  (code) => code.replace('<p v-if="error" class="text-sm" :class="lateText" role="alert">', '<p v-if="error" class="text-sm" :class="lateText">'), DA, 'failed post is announced');
runMutationTest('A posted comment is not announced', DAC,
  (code) => code.replace('<p class="sr-only" role="status">{{ said }}</p>', ''), DA, 'posted comment is announced');
runMutationTest('Closing a panel loses the draft', DAC,
  (code) => code.replace('if (v.trim()) drafts.set(this.key, v); else drafts.delete(this.key);', 'drafts.delete(this.key);'), DA, 'saved as it is typed');
runMutationTest('A slow load lands on the next document', DAC,
  (code) => code.replace('if (seq === this.seq) this.take(res);', 'this.take(res);'), DA, 'slow load');
runMutationTest('Activity renders any HTML', DAC,
  (code) => code.replace('<p v-if="note"', '<p v-html="note" v-if="note"'), DA, 'v-html only');
runMutationTest('Activity reads oldest first again', DAC,
  (code) => code.replace('newest() { return [...this.items].reverse(); }', 'newest() { return this.items; }'), DA, 'newest first');
runMutationTest('Activity shows the oldest few', DAC,
  (code) => code.replace('this.newest.slice(0, RECENT)', 'this.newest.slice(-RECENT)'), DA, 'newest few');
runMutationTest('The comment box goes back under the list', DAC,
  (code) => { const f = code.slice(code.indexOf('    <!-- Say something.'), code.indexOf('    </form>\n') + 12); return code.replace(f, '').replace('    <p class="sr-only" role="status">', f + '    <p class="sr-only" role="status">'); }, DA, 'comment box comes before');
runMutationTest('Who and what run together again', DAC,
  (code) => code.replace("{{ it.by }}</span>{{ ' ' }}</template>", '{{ it.by }}</span> </template>'), DA, 'edge of a <template>');
runMutationTest('A space at the start of a template elsewhere', drawerDir('SessionDetailDrawer.vue'),
  (code) => code.replace('<template>', '<template> <span>x</span>'), DA, 'edge of a <template>');
const MI = 'node scripts/check_menu_icons.mjs';
runMutationTest('Add work session draws a pencil again', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace("label: 'Add work session', icon: 'activity'", "label: 'Add work session', icon: 'edit-3'"), MI, 'look alike');
runMutationTest('Two menu items share a picture', path.resolve(omnitrackDir,'src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace("label: 'Raven chat', icon: 'message-circle'", "label: 'Raven chat', icon: 'external-link'"), MI, 'look alike');
const EW = 'node scripts/check_entry_is_worked.mjs';
const ES = path.resolve(omnitrackDir,'src/components/dialogs/TimesheetEntryDialog.vue');
runMutationTest('An entry can end after now', ES,
  (code) => code.replace('this.mins > 0 && !this.ahead && said;', 'this.mins > 0 && said;'), EW, 'cannot be saved');
runMutationTest('Future time is measured against the start', ES,
  (code) => code.replace('return end != null && this.mins > 0 && end > this.now + 60000;', 'return end != null && this.mins > 0 && end - this.mins * 60000 > this.now + 60000;'), EW, 'is ahead');
runMutationTest('Why an entry cannot be saved goes unsaid', ES,
  (code) => code.replace(':class="lateText" role="alert">{{ aheadText }}', ':class="lateText">{{ aheadText }}'), EW, 'says why');
// Adding or editing a work session is the timer's session box (WorkSessionEntry hosting SessionBox)
const WSE = path.resolve(omnitrackDir,'src/components/dialogs/WorkSessionEntry.vue');
const USE = path.resolve(omnitrackDir,'src/session/useSessionEntry.js');
const SCP = path.resolve(omnitrackDir,'src/session/SessionControlsPane.vue');
const SLP = path.resolve(omnitrackDir,'src/session/SessionLogPane.vue');
const WSM = path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js');
runMutationTest('Now stands still while the entry is open', USE,
  (code) => code.replace('tick = setInterval(() => { now.value = Date.now(); }, 30000);', ''), EW, 'now moves on');
runMutationTest('The entry measures the future from its start', USE,
  (code) => code.replace('return end != null && entryMins.value > 0 && end > now.value + 60000;', 'return end != null && entryMins.value > 0 && end - entryMins.value * 60000 > now.value + 60000;'), EW, 'is ahead');
runMutationTest('The entry saves time not worked yet', USE,
  (code) => code.replace('entryMins.value > 0 && !entryAhead.value && said;', 'entryMins.value > 0 && said;'), EW, 'cannot be saved');
runMutationTest('The entry saves a session with nothing said', USE,
  (code) => code.replace('const said = (props.sessionNotesList || []).length > 0 || draftReady.value;', 'const said = true;'), EW, 'needs a line');
runMutationTest('The entry keeps quiet about why it cannot save', SCP,
  (code) => code.replace('dark:text-red-200" role="alert">{{ entryAheadText }}', 'dark:text-red-200">{{ entryAheadText }}'), EW, 'says why');
runMutationTest('Cancel drops out of Tab while Add session waits', SCP,
  (code) => code.replace(':tabindex="activeToolIndex === 0 || !entryCanSave ? 0 : -1"', ':tabindex="activeToolIndex === 0 ? 0 : -1"'), EW, 'Cancel stays reachable');
runMutationTest('Adding a session opens the sheet, not the session box', path.resolve(omnitrackDir,'src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace(":model-value=\"showEditSessionModal && editSessionForm.mode !== 'live'\"", ':model-value="false"'), EW, 'open WorkSessionEntry');
runMutationTest('The entry is not a modal', WSE,
  (code) => code.replace('aria-modal="true"', ''), EW, 'named modal');
runMutationTest('Escape for an open list closes the entry', WSE,
  (code) => code.replace('if (e.defaultPrevented || popover) return;', 'if (e.defaultPrevented) return;'), EW, 'closes the list');
runMutationTest('Shift+Tab leaves the entry', WSE,
  (code) => code.replace('if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }', 'if (false) {}'), EW, 'Tab stays inside');
runMutationTest('Focus is lost when the entry closes', WSE,
  (code) => code.replace('if (lost && opener && document.contains(opener)) opener.focus();', ''), EW, 'focus goes back');
runMutationTest('The page stays locked after the entry closes', WSE,
  (code) => code.replace('setScrollLock("work-session-entry", false);', ''), EW, 'scroll again');
runMutationTest('Focus goes back to a menu item that is gone', WSE,
  (code) => code.replace('this.opener = menuTrigger(document.activeElement);', 'this.opener = document.activeElement;'), EW, "menu's button");
runMutationTest('The menu keeps focus behind the entry', WSE,
  (code) => code.replace('if (this.$refs.sheet && !this.$refs.sheet.contains(e.target)) setTimeout(() => this.toLine());', ''), EW, "comes back to the Log's field");
runMutationTest('The entry never lets focus leave', WSE,
  (code) => code.replace('setTimeout(() => document.removeEventListener("focusin", back, true), 600);', ''), EW, 'not for good');
runMutationTest('Cmd+S behind the entry stops the running session', WSE,
  (code) => code.replace('if (e.metaKey || e.ctrlKey || e.altKey || e.key === "/" || (e.shiftKey && e.key.length === 1)) e.stopPropagation();', ''), EW, "keeps the app's shortcuts");
runMutationTest('Cmd+Enter does not save the entry', WSE,
  (code) => code.replace('if (this.$refs.box) this.$refs.box.entrySave();', ''), EW, 'Cmd/Ctrl+Enter saves');
runMutationTest('The save path takes an entry past midnight as backwards', WSM,
  (code) => code.replace('f.from_time && f.to_time ? spanMins(f.from_time, f.to_time) : 0;', 'f.from_time && f.to_time ? toMinutes(f.to_time) - toMinutes(f.from_time) : 0;'), EW, 'measures the entry with spanMins');
runMutationTest('The save path takes an entry with no line', WSM,
  (code) => code.replace("if (!(f.log || []).length) { showToast(", 'if (false) { showToast('), EW, 'refuses an entry with no line');
runMutationTest('The Log is saved as one run-on note', WSM,
  (code) => code.replace('const notes = composeWrapNote(f.block_title, f.log);', "const notes = (f.log || []).join(' ');"), EW, "saves the Log's lines");
runMutationTest('Editing a session loses its lines', WSM,
  (code) => code.replace("log: logLines(session.notes || '', ", "log: splitNotes(session.notes || '', "), EW, 'opens its notes as Log lines');
runMutationTest("A free entry files under the running session's Project", WSM,
  (code) => code.replace('      project: f.project || null\n    });', '      project: selectedProject.value || null\n    });'), EW, "entry's own Project");
// A waiting solid button greys out legibly, not pale blue under white
runMutationTest('A waiting Add session goes pale blue', SCP,
  (code) => code.replace(":class=\"[DISABLED_SOLID, 'enabled:!bg-blue-700", ":class=\"['enabled:!bg-blue-700"), DP, 'Add session waits in DISABLED_SOLID');
runMutationTest("The Log's waiting Add goes pale blue", SLP,
  (code) => code.replace(":class=\"[DISABLED_SOLID, '!h-auto", ":class=\"['!h-auto"), DP, "Log's Add waits");
runMutationTest('A waiting button keeps white text', path.resolve(omnitrackDir,'src/utils/sessionFrame.js'),
  (code) => code.replace("'disabled:!bg-gray-100 disabled:!text-gray-700 ", "'disabled:!bg-gray-100 disabled:!text-white "), DP, 'greys a waiting button');
// An entry lists its own block's tasks under the Log, never the running session's
runMutationTest("An entry lists the running session's tasks", SCP,
  (code) => code.replace('<BlockTasksSection v-if="!isEntry" ', '<BlockTasksSection '), DP, 'bound block, else liveSessionBlock');
runMutationTest("An entry on a block loses the block's tasks", SLP,
  (code) => code.replace('<BlockTasksSection v-if="isEntry && trackerBoundBlock"', '<BlockTasksSection v-if="false"'), DP, "its block's tasks under the Log");
// Dark mode is two switches: .dark and frappe-ui's data-theme
runMutationTest("Dark mode leaves frappe-ui's tokens light", path.resolve(omnitrackDir,'src/composables/useWorkstationShell.js'),
  (code) => code.replace("document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');", ''), 'node scripts/check_contrast_tokens.cjs', 'applyTheme sets data-theme');
runMutationTest("The first paint leaves frappe-ui's tokens light", path.resolve(omnitrackDir,'omnitrack/www/omnitrack.html'),
  (code) => code.replace("document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');", ''), 'node scripts/check_contrast_tokens.cjs', 'first-paint script sets data-theme');
// A grey that reads on white went faint on the dark page
const DTL = path.resolve(omnitrackDir,'src/views/dashboard/DashboardTimeline.vue');
runMutationTest("The timeline's hour labels stay dark on the dark page", DTL,
  (code) => code.replace('font-mono text-gray-700 dark:text-gray-300"', 'font-mono text-gray-700"'), 'node scripts/check_contrast_tokens.cjs', 'no dark: colour');
runMutationTest("The zoom pill's labels go faint in dark mode", DTL,
  (code) => code.replace("(isDarkMode ? 'text-gray-300 hover:text-white'", "(isDarkMode ? 'text-gray-600 hover:text-white'"), 'node scripts/check_contrast_tokens.cjs', 'dark branch');
runMutationTest("The week's Overview label goes faint in dark mode", path.resolve(omnitrackDir,'src/views/calendar/CalendarWeekStats.vue'),
  (code) => code.replace(":class=\"isDarkMode ? 'text-gray-300' : 'text-gray-700'\"", ":class=\"isDarkMode ? 'text-gray-700' : 'text-gray-700'\""), 'node scripts/check_contrast_tokens.cjs', 'dark branch');
runMutationTest("Plan's label goes dark on its blue in dark mode", path.resolve(omnitrackDir,'src/views/dashboard/DashboardDateSelector.vue'),
  (code) => code.replace('enabled:hover:!bg-blue-800 enabled:!text-white', 'enabled:hover:!bg-blue-800'), 'node scripts/check_contrast_tokens.cjs', 'keeps enabled:!text-white');
runMutationTest("The selected zoom pill fades into its track on the dark page", DTL,
  (code) => code.replace("(isDarkMode ? 'bg-gray-700 text-white shadow-xs'", "(isDarkMode ? 'bg-gray-600 text-white shadow-xs'"), 'node scripts/check_timeline_zoom.mjs', 'selected zoom');
runMutationTest("The now badge's time goes faint on lighter red", DTL,
  (code) => code.replace('rounded bg-red-600 text-white shadow-xs whitespace-nowrap', 'rounded bg-red-500 text-white shadow-xs whitespace-nowrap'), 'node scripts/check_timeline_zoom.mjs', 'now badge');
const DAT = path.resolve(omnitrackDir,'src/views/dashboard/DashboardAttentionTasks.vue');
runMutationTest('The attention chips turn red again', DAT,
  (code) => code.replace(`theme="gray"\n          :class="attentionFilter === f.key`, `theme="red"\n          :class="attentionFilter === f.key`), 'node scripts/test_frappe_ui_planner_tabs.cjs', 'attention filter chips are grey');
runMutationTest("Start session's label goes dark on its blue in dark mode", DAT,
  (code) => code.replace('enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white', 'enabled:!bg-blue-700 enabled:hover:!bg-blue-800'), 'node scripts/check_contrast_tokens.cjs', 'keeps enabled:!text-white');
runMutationTest('Open planner reads 4.1:1 in frappe-ui blue', DAT,
  (code) => code.replace('class="!text-blue-700 dark:!text-blue-300"', ''), 'node scripts/check_contrast_tokens.cjs', 'blue Button needs !text-blue-700');
runMutationTest('The stop button keeps light red text on the dark page', path.resolve(omnitrackDir,'src/views/dashboard/DashboardHappeningNow.vue'),
  (code) => code.replace(`:class="stopConfirm ? '' : 'dark:!text-red-300'"`, ''), 'node scripts/check_contrast_tokens.cjs', 'needs a dark:!text- colour');
runMutationTest('The live stopwatch keeps light red text on the dark page', path.resolve(omnitrackDir,'src/components/layout/WorkstationHeader.vue'),
  (code) => code.replace(`:class="isTracking && !isSessionElevated ? '!text-red-700 dark:!text-red-300' : ''"`, ''), 'node scripts/check_contrast_tokens.cjs', 'names its own !text- colour');
runMutationTest('The Overdue chip loses its dark selected colour', DAT,
  (code) => code.replace(`:class="attentionFilter === f.key ? 'dark:!bg-gray-700 dark:!text-white' : ''"`, `:class="attentionFilter === f.key ? 'dark:!bg-gray-600' : ''"`), 'node scripts/test_attention_filter_contrast.cjs', 'Overdue chip is grey');
const BS = path.resolve(omnitrackDir,'omnitrack/utils/block_slot.py');
const FACPY = path.resolve(omnitrackDir,'omnitrack/fac.py');
// block_slot.py reads times with frappe.utils, so these run on the bench's own Python
const BST = `${path.resolve(appDir, '../../env/bin/python')} -m unittest omnitrack.tests.test_block_slot`;
runMutationTest("A block's dated start no longer sets its day", BS,
  (code) => code.replace('return day or (str(getdate(work_date)) if work_date else None), start, end', 'return (str(getdate(work_date)) if work_date else None), start, end'), BST, 'test_a_dated_start_sets_the_day');
runMutationTest('A start dated tomorrow is booked on the work_date given', BS,
  (code) => code.replace('if day and work_date and getdate(work_date) != getdate(day):', 'if False:'), BST, 'test_a_date_that_disagrees_with_work_date_is_refused');
runMutationTest('A block runs across two days', BS,
  (code) => code.replace('getdate(add_days(start_day, 1)) and end <= start)', 'getdate(add_days(start_day, 1)))'), BST, 'test_a_block_sits_on_one_day');
runMutationTest('A block with no length is booked', BS,
  (code) => code.replace('if start == end:', 'if False:'), BST, 'test_no_length_and_no_time_are_refused');
runMutationTest('Planning drops the date in start_time again', FACPY,
  (code) => code.replace('target_date = work_date or (days.pop() if days else nowdate())', 'target_date = work_date or nowdate()'), BST, 'test_plan_work_blocks_books_the_resolved_slot');
runMutationTest("A quick task's block drops the date in block_start", FACPY,
  (code) => code.replace('target_date = work_date or start_day or nowdate()', 'target_date = work_date or nowdate()'), BST, 'test_quick_create_task_checks_the_block_before_the_task');
runMutationTest('A stored 24:00 end is not read', BS,
  (code) => code.replace('\t\tif isinstance(value, timedelta):\n\t\t\treturn None, get_time(value).strftime("%H:%M:%S")\n', ''), BST, 'test_times_from_the_database_are_read_too');
const PLP = path.resolve(omnitrackDir,'omnitrack/api/planner.py');
runMutationTest('Booking drops the date in start_time again', PLP,
  (code) => code.replace('\twork_date, start_time, end_time = _slot(start_time, end_time, work_date)\n', ''), BST, 'test_book_work_block_resolves_the_slot_before_anything_else');
runMutationTest('A bad slot reaches the database as a server error', PLP,
  (code) => code.replace('frappe.throw(str(e), frappe.ValidationError)', 'raise'), BST, 'test_book_work_block_resolves_the_slot_before_anything_else');
runMutationTest('Moving a block checks the past lock against its old day', PLP,
  (code) => code.replace('\t\twork_date = day\n', ''), BST, 'test_moving_a_block_resolves_the_slot_before_the_past_lock');
runMutationTest('Rescheduling drops the date in new_start_time', PLP,
  (code) => code.replace('\t\tnew_date = day\n', ''), BST, 'test_moving_a_block_resolves_the_slot_before_the_past_lock');
const PWB = path.resolve(omnitrackDir,'omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.py');
runMutationTest('A block writes 0.0 for a time it cannot read', PWB,
  (code) => code.replace('except ValueError as e:\n\t\t\tfrappe.throw(str(e), frappe.ValidationError)', 'except ValueError:\n\t\t\tself.duration_hours = 0.0\n\t\t\treturn'), BST, 'test_the_block_refuses_a_time_it_cannot_read');
runMutationTest('A block keeps a time dated another day', PWB,
  (code) => code.replace('if day and ((start_day', 'if False and ((start_day'), BST, 'test_the_block_refuses_a_time_it_cannot_read');
runMutationTest('Every re-save rewrites the stored times', PWB,
  (code) => code.replace('\t\tif start_day:\n\t\t\tself.start_time = start\n', '\t\tself.start_time = start\n'), BST, 'test_the_block_refuses_a_time_it_cannot_read');
runMutationTest('A menu item stands in for its button', path.resolve(omnitrackDir,'src/utils/popover.js'),
  (code) => code.replace('return (id && document.getElementById(id)) || el;', 'return el;'), EW, 'menuTrigger finds');
runMutationTest('A disabled Add session looks ready', ES,
  (code) => code.replace('class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white"', 'class="!bg-blue-700 hover:!bg-blue-800 enabled:!text-white"'), 'node scripts/check_contrast_tokens.cjs', 'looks pressable');
runMutationTest('An empty comment looks ready to post', path.resolve(omnitrackDir,'src/components/common/DocActivity.vue'),
  (code) => code.replace('enabled:!bg-blue-700 enabled:hover:!bg-blue-800', 'enabled:!bg-blue-700 hover:!bg-blue-800'), 'node scripts/check_contrast_tokens.cjs', 'looks pressable');
runMutationTest('An overnight entry ends on its start day', path.resolve(omnitrackDir,'src/utils/timesheetEntry.js'),
  (code) => code.replace('(toMin(from) + mins) * 60000', '((toMin(from) + mins) % 1440) * 60000'), EW, 'overnight');
runMutationTest('The save path takes time not worked yet', path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('if (entryEndMs(f.session_date, f.from_time, mins) > Date.now() + 60000) { showToast(', 'if (false) { showToast('), EW, 'saveEditSession refuses');
const TSP = path.resolve(omnitrackDir,'omnitrack/api/timesheet.py');
runMutationTest('The server logs time not worked yet', TSP,
  (code) => code.replace('\t_require_worked(base_date, from_time, to_time)\n', ''), EW, 'log_work_session checks');
runMutationTest('The server takes an edit into the future', TSP,
  (code) => code.replace('\t_require_worked(sess_row.session_date, sess_row.from_time, sess_row.to_time)\n', ''), EW, 'update_work_session checks');
runMutationTest('The server lets an end after now through', TSP,
  (code) => code.replace('if end > now_datetime() + FUTURE_SLACK:', 'if end > now_datetime() + FUTURE_SLACK * 1000:'), EW, 'refuses an end after now');
runMutationTest('The server ends an overnight entry on its start day', TSP,
  (code) => code.replace('end_day = add_days(end_day, 1)', 'end_day = end_day'), EW, 'overnight');
runMutationTest('Task details open the discussion drawer again', path.resolve(omnitrackDir,'src/composables/useWorkstationPlannerSelect.js'),
  (code) => code.replace('    openTaskDetail(task);', "    w.openTaskRavenDrawer(task, 'details');"), DP, 'openTaskDetails opens the task details panel');
runMutationTest('A block task row opens its own dialog', drawerDir('BlockTasksSection.vue'),
  (code) => code.replace('openTaskDetail(row, { block: this.block, canRemove: this.canAdd });', 'this.showEdit = true;'), DP, 'a task row opens its details');
runMutationTest('The dashboard gets a workflow menu again', path.resolve(omnitrackDir,'src/views/dashboard/DashboardAttentionTasks.vue'),
  (code) => code.replace('</ul>', '<Dropdown :options="getTaskWorkflowMenuItems(t)"><Button label="Workflow" /></Dropdown></ul>'), DP, 'only in TaskFormDialog');
runMutationTest('Edit block shows on any block', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace(" && !this.isPastBlock(b) && b.status !== 'Cancelled';", ';'), DP, 'never on a past or cancelled block');
runMutationTest('Edit block stops opening its dialog', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace("onClick: () => { this.showEdit = true; }", "onClick: () => {}"), DP, 'opens EditBlockDialog');
runMutationTest('An unplanned live session is not seen as recording', drawerDir('BlockDetailDrawer.vue'),
  (code) => code.replace('return !!this.block.is_live_active || (', 'return ('), DP, 'counts as recording');
runMutationTest('The live block is titled by its notes again', path.resolve(omnitrackDir,'src/composables/useWorkstationPlannerLayout.js'),
  (code) => code.replace('task_subject: heading,', 'task_subject: trackerNotes.value,'), DP, 'not a ticked-off task');
runMutationTest('Reschedule hides while a session records again', path.resolve(omnitrackDir,'src/App.vue'),
  (code) => code.replace("isMissedPlan(b)) && !b.is_live_active;", "isMissedPlan(b)) && !b.is_live_active && !isRecordingOn(b);"), DP, 'the plan moves, the session stays');
runMutationTest('Cancel offered on a recording block', path.resolve(omnitrackDir,'src/App.vue'),
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
runMutationTest('An Escape a dialog took closes the drawer too', path.resolve(omnitrackDir,'src/composables/useWorkstationEod.js'),
  (code) => code.replace('    else if (dialogEsc) return;\n', ''), DP, 'must not also close the entry sheet or the block drawer');
runMutationTest('FDialog stops claiming its Escape', path.resolve(omnitrackDir,'src/components/common/FDialog.vue'),
  (code) => code.replace('      markDialogEscape(e);\n', ''), DP, 'claim its Escape');
runMutationTest('Timesheet day chips ignore the horizon', path.resolve(omnitrackDir,'src/utils/timesheetEntry.js'),
  (code) => code.replace('Math.round((Number(horizonHours) || 48) / 24)', '2'), TE, '72h horizon');
runMutationTest('A new entry defaults to a future block\'s own slot', path.resolve(omnitrackDir,'src/utils/timesheetEntry.js'),
  (code) => code.replace('if (planned && day && day <= today)', 'if (planned && day)'), TE, 'a future block');
runMutationTest('Adding an entry drops log_work_session\'s result', path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("return afterSave('Work session added', await postJSON('log_work_session'", "await postJSON('log_work_session'"), TE, 'log_work_session\'s result');
runMutationTest('A client-side day limit comes back', path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("const withSeconds = ", "const minTimesheetDate = null;\n  const withSeconds = "), TE, 'server\'s horizon');
runMutationTest('Drawer Reschedule moves the store\'s block', path.resolve(omnitrackDir,'src/composables/useWorkstationFocusTasks.js'),
  (code) => code.replace('    const b = activeBlock.value;\n    const f = form', '    const b = workBlockStore.activeBlock;\n    const f = form'), TE, 'w.activeBlock');
runMutationTest('A refused tick stays ticked', path.resolve(omnitrackDir,'src/composables/useWorkstationFocusTasks.js'),
  (code) => code.replace('      Object.assign(item, before);\n', ''), TE, 'restore the task');

const SRC = (f) => path.resolve(omnitrackDir,f);
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
  (code) => code.replace("const hours = time && lines >= 4 && !seg.block.is_away;", "const hours = time && lines >= 4 && !seg.block.is_away && !String(seg.block.task_nature).includes('Absent');"), AK, 'legacy activity value');

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
  (code) => code.replace('<form class="px-6 pt-4 pb-6 space-y-6"', '<div v-if="form.viewing" data-entry-view></div><form v-else class="px-6 pt-4 pb-6 space-y-6"'), BR, 'the one entry form is only a form');
runMutationTest('The entry sheet loses its dialog role', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('role="dialog" aria-modal="true" ', ''), BR, 'a modal dialog named by its kind and title');
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
runMutationTest('A task row grows its own move menu again', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<Badge variant="subtle" size="sm" class="shrink-0 mt-0.5"', '<Dropdown :options="taskMoves(t)" /><Badge variant="subtle" size="sm" class="shrink-0 mt-0.5"'), BR, 'its steps live in the task panel');
runMutationTest('A task in the entry sheet opens the form again', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('openTask(t) {\n      openTaskDetail(t, ', 'openTask(t) {\n      openTaskForm(t, '), BR, 'a task opens its details panel');
runMutationTest('The task list loses Up/Down', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('ArrowDown: Math.min(last, r + 1), ArrowUp', 'ArrowDown: r, ArrowUp'), BR, 'Up/Down between tasks');
runMutationTest('A reload strands the tab stop', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('        this.clampCell();\n', ''), BR, 'Up/Down between tasks');
runMutationTest('The entry sheet leaves focus behind', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace("sheet.querySelector('[data-sheet-close]')", "sheet.querySelector('[data-none]')"), BR, 'focus moves into the sheet');
runMutationTest('Closing the entry sheet drops focus', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('if (lost && opener && document.contains(opener)) opener.focus();', ''), BR, 'back to its opener on close');
runMutationTest('The task form ignores the move it was opened for', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace('if (a) this.ask(a);', 'if (a) void a;'), BR, "straight to that move's confirm step");
runMutationTest('Tasks becomes managers-only', SRC('src/components/layout/WorkstationBottomNav.vue'),
  (code) => code.replace('<Button\n        variant="ghost"\n        :theme="activeTab === \'tasks\'', '<Button\n        v-if="isManager"\n        variant="ghost"\n        :theme="activeTab === \'tasks\''), BR, 'Tasks is a page in the bar, for everyone');
runMutationTest('New task comes back to the bar', SRC('src/App.vue'),
  (code) => code.replace('    @open-session="openSessionCard"\n', '    @open-session="openSessionCard"\n    @open-new-task="openNewTaskModal"\n'), BR, 'no New task button');
runMutationTest('The header menu says New Task again', SRC('src/composables/useWorkstationPickers.js'),
  (code) => code.replace("label: 'Plan a block'", "label: 'New Task'"), BR, 'Plan a block');
runMutationTest('A task shows in two groups', SRC('src/views/TasksView.vue'),
  (code) => code.replace('for (const t of items) left.splice(left.indexOf(t), 1);', ''), BR, 'a task sits in one group only');
runMutationTest('Every task action is a tab stop', SRC('src/views/TasksView.vue'),
  (code) => code.replace("this.current[1] === col ? 0 : -1;", "this.current[1] === col ? 0 : 0;"), BR, 'one tab stop');
runMutationTest('A task row opens something else', SRC('src/views/TasksView.vue'),
  (code) => code.replace('openTaskDetail(t, { onChange:', 'void openTaskDetail; ({ onChange:'), BR, 'rows open the task details panel');
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

// The page scrolls again after every dialog closes (reka restores body overflow)
const SL = 'node scripts/check_scroll_lock.mjs';
runMutationTest('A watcher locks body again', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace("      document.addEventListener('keydown', onPlannerKeydown);\n    } else {", "      document.addEventListener('keydown', onPlannerKeydown);\n      document.body.style.overflow = 'hidden';\n    } else {"), SL, 'sets page overflow itself');
runMutationTest('The session popup stops using the shared lock', SRC('src/composables/useWorkstationPickers.js'),
  (code) => code.replace("    setScrollLock('session-popup', open);\n", ''), SL, "setScrollLock('session-popup'");
runMutationTest('One owner closing unlocks the page under another', SRC('src/utils/scrollLock.js'),
  (code) => code.replace('else owners.delete(owner);', 'else owners.clear();'), SL, 'still open');
runMutationTest('The lock also writes body', SRC('src/utils/scrollLock.js'),
  (code) => code.replace('if (owners.size) root.style.overflow = "hidden";', 'if (owners.size) { root.style.overflow = "hidden"; document.body.style.overflow = "hidden"; }'), SL, 'wrote body.style');
runMutationTest('The lock never releases', SRC('src/utils/scrollLock.js'),
  (code) => code.replace('else root.style.removeProperty("overflow");', ''), SL, 'everything has closed');

// Away keeps the times picked and sits on the calendar at them
const AW = 'node scripts/check_away_is_timed.mjs';
runMutationTest('Away is saved as nine to six again', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace('        start_time: f.start_time,\n        end_time: f.end_time,', "        start_time: isAway ? '09:00' : f.start_time,\n        end_time: isAway ? '18:00' : f.end_time,"), AW, 'fixed clock time');
runMutationTest('Away skips the end-after-start check', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace('    if (!f.start_time || !f.end_time) {', '    if (!isAway && (!f.start_time || !f.end_time)) {'), AW, 'skips the start/end checks');
runMutationTest('The dialog saves away without times', SRC('src/components/dialogs/PlanWorkBlockDialog.vue'),
  (code) => code.replace('      if (this.durationMins <= 0) return false;', '      if (this.mode === "away") return true;\n      if (this.durationMins <= 0) return false;'), AW, 'canSave');
runMutationTest('The calendar skips away blocks', SRC('src/composables/useWorkstationPlannerLayout.js'),
  (code) => code.replace('    for (const b of blocks) {\n', '    for (const b of blocks) {\n      if (b.is_away) continue;\n'), AW, 'away blocks are skipped');
runMutationTest('The All day row comes back', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace('        <!-- hour rows', '        <div class="text-[10px]">All day</div>\n        <!-- hour rows'), AW, 'all-day row');

const ON = 'node scripts/check_overnight_log.mjs';
runMutationTest('The time log ends on the start day again', SRC('omnitrack/utils/log_span.py'),
  (code) => code.replace('\t\t\tend += timedelta(days=1)', '\t\t\tpass'), ON, 'log_span(2026-10-06, 23:00:00');
runMutationTest('The Timesheet pastes the end onto the start day', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('s_from, s_to = log_span(base_date, start_t, sess.to_time, dur, 0.5)', 's_from, s_to = f"{base_date} {start_t}", f"{base_date} {sess.to_time}"'), ON, 'place both the session and the block');
runMutationTest('A punch past midnight is one row again', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('\tif MidnightSplitter.is_overnight(start_t, end_t):', '\tif False:'), ON, 'split a session past midnight');
runMutationTest('The pair partner is not split at midnight', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('for row in _punch_sessions(target_date, start_t, end_t, dur_hours, f"[Pairing', 'for row in [dict(work_date=target_date, from_time=start_t, to_time=end_t, hours=dur_hours, notes=f"[Pairing'), ON, 'pairing partner');
runMutationTest('A failed Timesheet is swallowed again', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace(/except Exception:\n(\t+)# Kept on record[^\n]*\n\t+frappe\.log_error\(title="OmniTrack: Timesheet sync failed", reference_doctype="Planned Work Block", reference_name=block\.name\)/, 'except Exception:\n$1pass'), ON, 'swallowed');
runMutationTest('A failed stop says it was saved', SRC('src/composables/useWorkstationApi.js'),
  (code) => code.replace("showToast('Could not save this session: ' + (err && err.message || err) + '. Add it again from Log.', 'danger');", "showToast('Timer punch recorded locally.', 'success');"), ON, 'reported as saved');
runMutationTest('An end before the start is refused again', SRC('src/utils/clockTime.js'),
  (code) => code.replace('  return d < 0 ? d + 24 * 60 : d;', '  return d < 0 ? 0 : d;'), ON, 'spanMins(23:00, 04:00)');
runMutationTest('The Timesheet dialog stops measuring past midnight', SRC('src/components/dialogs/TimesheetEntryDialog.vue'),
  (code) => code.replace('return spanMins(this.form.from_time, this.form.to_time);', 'return Math.max(0, toMin(this.form.to_time) - toMin(this.form.from_time));'), ON, 'TimesheetEntryDialog.vue');

const RS = 'node scripts/check_reschedule.mjs';
runMutationTest('A missed plan cannot be rescheduled', SRC('src/App.vue'),
  (code) => code.replace('(isOpenPlan(b) || isMissedPlan(b))', 'isOpenPlan(b)'), RS, 'isBlockReschedulable');
runMutationTest('A logged block counts as missed', SRC('src/App.vue'),
  (code) => code.replace("isPastBlock(b) && !(parseFloat(b.actual_hours) > 0) && ", "isPastBlock(b) && "), RS, 'isMissedPlan');
runMutationTest('The server locks a missed plan by its age', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\tif flt(doc.actual_hours) > 0:\n\t\tcheck_planned_block_past_lock(doc, new_work_date=new_date)\n\telse:', '\tcheck_planned_block_past_lock(doc, new_work_date=new_date)\n\tif False:'), RS, 'reschedule_work_block');
runMutationTest('The copy keeps its Timesheet', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\t"timesheet": None, ', '\t'), RS, 'timesheet to None');
runMutationTest('The copy keeps its approval', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('"approval_status": "Draft", ', ''), RS, 'approval_status');
runMutationTest('The copy keeps its sessions', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\tnew_block.sessions = []\n', ''), RS, 'start empty');
runMutationTest('A moved block can be moved again', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\tif doc.status in ("Rescheduled", "Cancelled"):\n', '\tif False:\n'), RS, 'already moved');

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
runMutationTest('The calendar is not sent approvals', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('"rescheduled_from", "approval_status", "approval_notes",', '"rescheduled_from",'), BR, 'every logged block reads as awaiting approval');
runMutationTest('The dashboard feed drops the flag reason', SRC('omnitrack/api/workstation.py'),
  (code) => code.replace('"approval_status", "approval_notes"\n', '"approval_status"\n'), BR, 'all three block queries send approval_notes');
runMutationTest('Pending approvals drop the flag reason', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('"approval_status", "approval_notes", "pairing_partner"', '"approval_status", "pairing_partner"'), BR, 'pending approvals send approval_notes');
runMutationTest('Approval wording reads a field that does not exist', SRC('src/utils/approval.js'),
  (code) => code.replace("(b.approval_notes || 'needs clarifying')", "(b.flagged_reason || 'needs clarifying')"), BR, 'reads flagged_reason');
runMutationTest('The hover card clamps the title', SRC('src/components/common/BlockHoverCard.vue'),
  (code) => code.replace('leading-snug break-words">', 'leading-snug break-words line-clamp-2">'), BR, 'is clamped where its details');
runMutationTest('The block drawer clamps task names', SRC('src/drawers/BlockTasksSection.vue'),
  (code) => code.replace('<span class="block text-base leading-snug break-words"', '<span class="block text-base leading-snug break-words line-clamp-2"'), BR, 'is clamped where its details');
runMutationTest('The entry sheet cuts the project name', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<dd class="min-w-0 break-words" :class="strongText">{{ project }}</dd>', '<dd class="truncate">{{ project }}</dd>'), BR, 'is clamped where its details');
runMutationTest('The hover card trusts a guessed height', SRC('src/composables/useWorkstationPlannerState.js'),
  (code) => code.replace('placeHoverCard(r, card.offsetHeight)', 'placeHoverCard(r, 85)'), BR, 'placed by its measured height');
runMutationTest('The hover card covers the bottom bar', SRC('src/composables/useWorkstationPlannerState.js'),
  (code) => code.replace(`document.querySelector('nav[aria-label="Workstation navigation"]')`, 'null'), BR, 'clear of the bottom bar');
runMutationTest('The hover card drops the approval', SRC('src/components/common/BlockHoverCard.vue'),
  (code) => code.replace('{{ approval.label }}', ''), BR, 'the hover card says where the entry stands in review');
const HC = SRC('src/components/common/BlockHoverCard.vue');
runMutationTest('The hover card titles a logged bar with its notes', HC,
  (code) => code.replace('return blockTitle(this.hoverCard.block,', 'return (this.hoverCard.seg && this.hoverCard.seg.notes) || blockTitle(this.hoverCard.block,'), BR, 'title is the block');
runMutationTest('The hover card lists every note line', HC,
  (code) => code.replace('in notes.slice(0, NOTE_LINES)"', 'in notes"'), BR, 'short list of lines');
runMutationTest('The hover card repeats the title in its notes', HC,
  (code) => code.replace('return noteLines(raw, this.title);', 'return noteLines(raw, "");'), BR, 'short list of lines');
runMutationTest('The hover card logs a sliver of an hour', HC,
  (code) => code.replace("durationLabel(Math.max(1, Math.round(hours * 60))) + ' logged'", "hours.toFixed(2) + 'h logged'"), BR, 'in minutes under an hour');
runMutationTest('The hover card runs off the right edge', SRC('src/composables/useWorkstationPlannerState.js'),
  (code) => code.replace('window.innerWidth - 298)', 'window.innerWidth - 280)'), BR, '18rem wide');
runMutationTest('Note lines keep their bullets', SRC('src/utils/wrapNote.js'),
  (code) => code.replace(".replace(/^\\s*[•*-]\\s*/, '')", ''), BR, 'bullets dropped');
runMutationTest('Note lines keep the title', SRC('src/utils/wrapNote.js'),
  (code) => code.replace("if (text.toLowerCase() === head) { ownDone = ownDone || !!m; continue; }", ''), BR, 'never its name again');
runMutationTest('Note lines match the title by case', SRC('src/utils/wrapNote.js'),
  (code) => code.replace("const head = String(title || '').trim().toLowerCase();", "const head = String(title || '').trim();"), BR, 'only repeats the title');
runMutationTest('Note lines lose that the title was done', SRC('src/utils/wrapNote.js'),
  (code) => code.replace("return ownDone ? [{ text: 'Completed', done: true }, ...out] : out;", 'return out;'), BR, 'never its name again');
runMutationTest('Note lines keep the Completed prefix', SRC('src/utils/wrapNote.js'),
  (code) => code.replace('const text = m ? m[1].trim() : line;', 'const text = line;'), BR, 'ticked tasks marked done');
runMutationTest('The hover card hides which tasks were done', HC,
  (code) => code.replace('<span v-if="line.done && line.text !== \'Completed\'" class="sr-only">Done: </span>', ''), BR, 'says Done to screen readers');
const DT = SRC('src/views/dashboard/DashboardTimeline.vue');
runMutationTest('A logged bar is named by its whole notes', DT,
  (code) => code.replace("return blockTitle(r.block, '') || noteHeading(r.notes) ||", "return r.notes || blockTitle(r.block, '') ||"), BR, 'never by its whole notes');
runMutationTest('A logged bar reads its length as a sliver of an hour', DT,
  (code) => code.replace("loggedLength(r) { return durationLabel(Math.max(1, Math.round((Number(r.hours) || 0) * 60))); }", "loggedLength(r) { return (Number(r.hours) || 0).toFixed(2) + 'h'; }"), BR, 'in minutes under an hour');
runMutationTest('A logged bar tells screen readers its notes', DT,
  (code) => code.replace(":aria-label=\"'Logged: ' + loggedName(r)", ":aria-label=\"'Logged: ' + r.notes"), BR, 'never by its whole notes');
runMutationTest('A session is named by a ticked-off task', SRC('src/utils/wrapNote.js'),
  (code) => code.replace("l && !/^\\W*Completed:/.test(l) && !/^[•*-]\\s/.test(l)", "l && !/^[•*-]\\s/.test(l)"), BR, 'not a logged step');
runMutationTest('A session is named by a bullet', SRC('src/utils/wrapNote.js'),
  (code) => code.replace(" && !/^[•*-]\\s/.test(l)) || '';", ") || '';"), BR, 'not a logged step');
runMutationTest('The live bar says Recording in its name', SRC('src/composables/useWorkstationTimeline.js'),
  (code) => code.replace("notes: trackerNotes.value || '',", "notes: (trackerNotes.value || 'Active Work') + ' (Recording...)',"), 'node scripts/check_dialog_popovers.cjs', 'stuck on');
runMutationTest('The live bar is titled by its whole notes', SRC('src/composables/useWorkstationTimeline.js'),
  (code) => code.replace('task_subject: heading,', 'task_subject: trackerNotes.value,'), 'node scripts/check_dialog_popovers.cjs', 'not a ticked-off task');
const PS = SRC('src/composables/useWorkstationPlannerState.js');
const HT = 'node scripts/test_workstation_interactions.cjs';
runMutationTest('The hover card gets a View details button again', HC,
  (code) => code.replace('<div v-if="billingRef" class="tabular-nums">ERPNext Timesheet {{ billingRef }}</div>', '<div v-if="billingRef" class="tabular-nums">ERPNext Timesheet {{ billingRef }}</div>\n      <button type="button" @click.stop="$emit(\'view-details\', hoverCard.block)">View details</button>'), HT, 'plain tooltip');
runMutationTest('The hover card loses its tooltip id', HC,
  (code) => code.replace('    id="block-hover-card"\n', ''), HT, 'id block-hover-card');
runMutationTest('The block does not point at its hover card', PS,
  (code) => code.replace("_hoverTrigger.setAttribute('aria-describedby', 'block-hover-card');", ''), HT, 'aria-describedby');
runMutationTest('A block keeps pointing at a closed hover card', PS,
  (code) => code.replace("if (_hoverTrigger) _hoverTrigger.removeAttribute('aria-describedby');", ''), HT, 'aria-describedby');
runMutationTest('Escape leaves the hover card up', PS,
  (code) => code.replace("document.addEventListener('keydown', onHoverEscape, true);", ''), HT, 'Escape dismisses');
runMutationTest('Escape on the hover card closes the drawer too', PS,
  (code) => code.replace("    e.preventDefault();\n    clearHover();", "    clearHover();"), HT, 'Escape dismisses');
runMutationTest('The hover card vanishes when the pointer moves onto it', HC,
  (code) => code.replace(' pointer-events-auto ', ' pointer-events-none '), HT, 'WCAG 1.4.13');
runMutationTest('A calendar block hides its approval from screen readers', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace(", approvalLabel(seg.block)]", "]"), BR, "a calendar block's name says where it stands in review");

const WI = 'node scripts/test_workstation_interactions.cjs';
runMutationTest('Task form shows Cancel in the same colour as Approve', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace("theme: isDangerMove(a) ? 'red' : undefined,", 'theme: undefined,'), WI, 'TaskFormDialog statusMenu destructive moves');
runMutationTest('Task panel step menu repeats the next state', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace("        label: a.action,\n        icon: moveIcon(a.action),", "        label: a.action,\n        description: a.next_state,\n        icon: moveIcon(a.action),"), WI, 'TaskDetailDrawer stateMoves options must not repeat');

runMutationTest('Calendar approval dot gets an unseeable title', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace('\' : \'top-1\']" aria-hidden="true"', '\' : \'top-1\']" :title="approvalLabel(seg.block)" aria-hidden="true"'), BR, 'approval dot carries no title');

runMutationTest('Entry sheet words its approval itself again', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace("      const s = approvalState(this.block);\n      return s && { tone: APPROVAL_CHIP[s.tone], label: s.short };", "      return { tone: 'gray', label: 'Awaiting approval' };"), BR, 'approval chip comes from approvalState');

runMutationTest('Entry sheet re-reads on every dashboard refresh', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('blockStamp(now, before) { if (now !== before && this.show', 'workBlocks() { if (this.show'), BR, 'not on every dashboard refresh');
runMutationTest('Entry sheet misses a task moved from it', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('this.entry.block, onChange: () => this.load() })', 'this.entry.block })'), BR, 'a task saved or moved from the sheet');

// Copy never says a bare "timesheet" (DOMAIN_MODEL section 9)
const VO = 'node scripts/check_vocabulary.cjs';
runMutationTest('A menu says timesheet entry again', SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace("label: 'Add work session'", "label: 'Add timesheet entry'"), VO, 'bare "timesheet"');
runMutationTest('Template text says timesheet again', SRC('src/components/dialogs/EmptyStopModal.vue'),
  (code) => code.replace('Discard session', 'Discard (No Timesheet)'), VO, 'bare "timesheet"');
runMutationTest('A toast says timesheet again', SRC('src/composables/useWorkstationApi.js'),
  (code) => code.replace("'Session discarded. Nothing was logged.'", "'Session discarded, no timesheet was created'"), VO, 'bare "timesheet"');

// Start session belongs to today's block only
runMutationTest('Past block offers Start session', SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace(' && b.work_date === this.todayDate;', ';'), 'node scripts/check_dialog_popovers.cjs', "Start session shows only on today's block");

// The block sheet hands focus back to the row that opened it
runMutationTest('Block sheet forgets its opener on close', SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('if (lost && opener && document.contains(opener)) opener.focus();', ''), BR, 'BlockDetailDrawer.vue: focus moves into the sheet');
runMutationTest('Block sheet leaves focus behind on open', SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('label="Close" data-sheet-close', 'label="Close"'), BR, 'BlockDetailDrawer.vue: focus moves into the sheet');
runMutationTest('Inline block details steal focus', SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('openKey() { return !this.inline && ', 'openKey() { return '), BR, 'BlockDetailDrawer.vue: the inline details never take or move focus');

// Projects: one visibility rule, clients see only what is shared, keyboard-first page
const PJ = 'node scripts/check_projects.mjs';
runMutationTest("A customer's name comes back into the client portal", SRC('src/views/dashboard/DashboardClientPortal.vue'),
  (code) => code.replace('Delivery status and work sessions', 'CampusCredit delivery status and work sessions'), PJ, "no customer's name in the code");
runMutationTest('The Task query pastes the user into SQL', SRC('omnitrack/permissions.py'),
  (code) => code.replace('_assign LIKE {frappe.db.escape(_assigned_like(user))}', "_assign LIKE '%{user}%'"), PJ, 'no user id pasted into SQL');
runMutationTest('A client sees every block with a project again', SRC('omnitrack/permissions.py'),
  (code) => code.replace('projects = projects_for(user, include_assigned=False)', 'projects = None\n\tif is_project_client(user):\n\t\treturn "`tabPlanned Work Block`.project IS NOT NULL"\n\tprojects = projects_for(user, include_assigned=False)'), PJ, 'never shows every block with a project');
runMutationTest('Any project opens for anyone', SRC('omnitrack/api/projects.py'),
  (code) => code.replace('if allowed is not None and name not in allowed:', 'if False:'), PJ, 'not shared with you is refused');
runMutationTest('A client sees planned hours', SRC('omnitrack/api/projects.py'),
  (code) => code.replace('"planned_hours": None if client else round(planned, 2),\n\t\t"logged_hours": None if hide_logged else round(logged, 2),\n\t\t"health"', '"planned_hours": round(planned, 2),\n\t\t"logged_hours": None if hide_logged else round(logged, 2),\n\t\t"health"'), PJ, 'never sees planned hours');
runMutationTest('A client sees every task of a project', SRC('omnitrack/api/projects.py'),
  (code) => code.replace('\t\t\tfilters["custom_is_public_deliverable"] = 1', '\t\t\tpass'), PJ, 'only tasks marked as shared deliverables');
runMutationTest('The page boot loads blocks again', SRC('omnitrack/www/omnitrack.py'),
  (code) => code.replace('ctx.has_projects =', 'ctx.blocks = frappe.get_all("Planned Work Block")\n\tctx.has_projects ='), PJ, 'the page boot loads no blocks');
runMutationTest('Projects shows on a site without Projects', SRC('src/components/layout/WorkstationHeader.vue'),
  (code) => code.replace('...(this.hasProjects ? [{ label: "Projects"', '...(true ? [{ label: "Projects"'), PJ, 'only on a site that has Projects');
runMutationTest('Logged time leaves the menu', SRC('src/components/layout/WorkstationHeader.vue'),
  (code) => code.replace('{ label: "Logged time", icon: "clock"', '{ label: "Timesheets", icon: "clock"'), PJ, 'opens with Projects and Logged time');
runMutationTest('Logged time goes back in the bottom bar', SRC('src/components/layout/WorkstationBottomNav.vue'),
  (code) => code.replace('<!-- Team: managers only -->', '<Button :aria-current="activeTab === \'timesheets\' ? \'page\' : null" label="Logged time" />\n      <!-- Team: managers only -->'), PJ, 'not back in the bottom bar');
runMutationTest('Bottom bar labels drop to low contrast', SRC('src/components/layout/WorkstationBottomNav.vue'),
  (code) => code.replace("(isDarkMode ? '!text-gray-300 font-medium'", "(isDarkMode ? '!text-gray-600 font-medium'"), PJ, '4.5:1 contrast');
runMutationTest('Every project row is a tab stop', SRC('src/views/ProjectsView.vue'),
  (code) => code.replace(':tabindex="p.name === currentRow ? 0 : -1"', ':tabindex="0"'), PJ, 'project list is one tab stop');
runMutationTest('Every status tab is a tab stop', SRC('src/views/ProjectsView.vue'),
  (code) => code.replace(':tabindex="status === s.id ? 0 : -1"', ':tabindex="0"'), PJ, 'status bar is a tablist with one tab stop');
runMutationTest('A client opens the task form', SRC('src/views/ProjectsView.vue'),
  (code) => code.replace('if (!this.detail || this.detail.is_client) return;', 'if (!this.detail) return;'), PJ, 'only the team opens the task form');
runMutationTest("A client sees everyone's blocks on a shared project", SRC('omnitrack/permissions.py'),
  (code) => code.replace(' AND {t}.`employee` IN ({persons})', ''), PJ, 'shared projects AND visible people');
runMutationTest('A client sees blocks on unshared tasks', SRC('omnitrack/permissions.py'),
  (code) => code.replace('task_ok = f"IFNULL({t}.`task`, \'\') = \'\'" + (f" OR {t}.`task` IN ({shared})" if shared else "")', 'task_ok = "1=1"'), PJ, 'needs that task shared');
runMutationTest('Everyone is visible to clients before the field exists', SRC('omnitrack/permissions.py'),
  (code) => code.replace('"visible_to_clients"):\n\t\treturn set()', '"visible_to_clients"):\n\t\treturn set(frappe.get_all("User", pluck="name"))'), PJ, 'until the field exists');
runMutationTest('The block list query forgets the client rule', SRC('omnitrack/permissions.py'),
  (code) => code.replace('\tif is_project_client(user):\n\t\tconditions.append(client_block_condition(user))\n\t\treturn " OR ".join(conditions)\n', ''), PJ, 'only client_block_condition');
runMutationTest('Opening one block skips the client rule', SRC('omnitrack/permissions.py'),
  (code) => code.replace('\tif is_project_client(user):\n\t\treturn client_may_see_block(doc, user)\n', ''), PJ, 'applies the client rule');
runMutationTest("The client feed shows every shared project's blocks", SRC('omnitrack/api/workstation.py'),
  (code) => code.replace('where_clause = client_block_condition(session_user) if allowed_projects else "1=0"', 'where_clause = "project IN %(allowed_projects)s" if allowed_projects else "1=0"'), PJ, 'same client rule');
runMutationTest('A shared task names hidden people to a client', SRC('omnitrack/api/projects.py'),
  (code) => code.replace('"assignees": _names(t._assign, only=visible),', '"assignees": _names(t._assign),'), PJ, 'only visible people named');
runMutationTest('Opening a project fails on an order_by expression again', SRC('omnitrack/api/projects.py'),
  (code) => code.replace('\t\torder_by="creation asc",\n', '\t\torder_by="exp_end_date is null, exp_end_date asc, creation asc",\n'), PJ, 'Frappe 16 accepts only fields');
runMutationTest('Task loses its Shared with Client field', SRC('omnitrack/install.py'),
  (code) => code.replace('"fieldname": "custom_is_public_deliverable"', '"fieldname": "custom_is_shared"'), PJ, 'Task and ToDo both get');
runMutationTest('The Projects page keeps its own tab styles', SRC('src/views/ProjectsView.vue'),
  (code) => code.replace("import { TAB, INDICATOR, COUNT, tabTone, countTone } from '../utils/materialTab.js';", "const TAB = 'px-3'; const INDICATOR = ''; const COUNT = ''; const tabTone = () => ''; const countTone = () => '';"), 'node scripts/check_dialog_popovers.cjs', 'import TAB and INDICATOR from utils/materialTab.js');

const SR = 'node scripts/check_session_restore.mjs';
runMutationTest('A page load evicts an overnight session again', SRC('src/composables/useWorkstationSessionSync.js'),
  (code) => code.replace('    const elapsed = Math.max(0, Math.max(serverElapsed, localElapsed));\n', "    const elapsed = Math.max(0, Math.max(serverElapsed, localElapsed));\n    if (elapsed >= 6 * 3600) { markSessionEnded(); postJSON('sync_active_session', { session_data: null }).catch(() => {}); return false; }\n"), SR, 'never clears the server');
runMutationTest('A day-old session is silently ignored again', SRC('src/composables/useWorkstationSessionSync.js'),
  (code) => code.replace('    const elapsed = Math.max(0, Math.max(serverElapsed, localElapsed));\n', '    const elapsed = Math.max(0, Math.max(serverElapsed, localElapsed));\n    if (elapsed >= 86400) return false;\n'), SR, 'no age limit drops a session');
runMutationTest('Reading the session deletes a day-old one again', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('\tif not data or not isinstance(data, dict):\n\t\treturn None\n\n\t# A start more than', '\tif not data or not isinstance(data, dict):\n\t\treturn None\n\tfrappe.cache.hdel("omnitrack:active_session", target_user)\n\n\t# A start more than'), SR, 'reading the session never deletes it');
runMutationTest("The dialog's time hides that it was yesterday", SRC('src/composables/useWorkstationSessionClock.js'),
  (code) => code.replace("if (daysAgo === 1) return hhmm + ' yesterday';", 'if (daysAgo === 1) return hhmm;'), SR, 'a time from yesterday says so');
runMutationTest('The still-working dialog loses Discard', SRC('src/components/dialogs/InactivityGovernorModal.vue'),
  (code) => code.replace("@click=\"$emit('discard')\"", '@click="$emit(\'update:modelValue\', false)"'), SR, 'offers to discard it');

const OA = 'node scripts/check_optional_apps.mjs';
runMutationTest('A block cannot be saved on a site without ERPNext', SRC('omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.py'),
  (code) => code.replace('class PlannedWorkBlock(OptionalLinks, Document):', 'class PlannedWorkBlock(Document):'), OA, 'PlannedWorkBlock: mixes in OptionalLinks');
runMutationTest('Skipped link values are lost on save', SRC('omnitrack/utils/optional_links.py'),
  (code) => code.replace('\t\tfinally:\n\t\t\tfor fieldname, value in held.items():\n\t\t\t\tself.set(fieldname, value)', '\t\tfinally:\n\t\t\tpass'), OA, 'the skipped values are put back');
runMutationTest('Every link is skipped, not just absent DocTypes', SRC('omnitrack/utils/optional_links.py'),
  (code) => code.replace('if value and df.options and not frappe.db.exists("DocType", df.options):', 'if value and df.options:'), OA, 'only links to an absent DocType');
runMutationTest('ERPNext becomes a required app', SRC('omnitrack/hooks.py'),
  (code) => code + '\nrequired_apps = ["erpnext"]\n', OA, 'never required apps');
runMutationTest('The sync receiver accepts unsigned payloads', SRC('omnitrack/sync.py'),
  (code) => code.replace('\tif not _signed_by_a_connection(data_str, frappe.get_request_header("X-OmniTrack-Signature")):\n\t\tfrappe.throw(_("This sync payload is not signed by a connected site."), frappe.AuthenticationError)\n', ''), OA, 'refuses a payload no connection signed');
runMutationTest('Signatures are compared with ==', SRC('omnitrack/sync.py'),
  (code) => code.replace('if secret and hmac.compare_digest(\n\t\t\thmac.new(secret.encode(), data_str.encode(), hashlib.sha256).hexdigest(), signature):', 'if secret and hmac.new(secret.encode(), data_str.encode(), hashlib.sha256).hexdigest() == signature:'), OA, 'constant time');
runMutationTest('Sending falls back to a built-in secret', SRC('omnitrack/sync.py'),
  (code) => code.replace('\tif not secret:\n\t\tconn.db_set("sync_error_log", "Set the HMAC secret on this connection before syncing.")\n\t\treturn\n', '\tsecret = secret or "default_secret"\n'), OA, 'no built-in fallback secret');
runMutationTest('Anyone may rebuild attendance', SRC('omnitrack/synthesizer.py'),
  (code) => code.replace('\tif not is_omnitrack_manager():\n\t\tfrappe.throw(_("Only an OmniTrack Manager can rebuild attendance."), frappe.PermissionError)\n', ''), OA, 'only an OmniTrack Manager');
runMutationTest('Desk content names Attendance on a site without Frappe HR', SRC('omnitrack/install.py'),
  (code) => code.replace('for i, sc in enumerate(present):', 'for i, sc in enumerate(ws["shortcuts"]):'), OA, 'only shows shortcuts to DocTypes the site has');
runMutationTest('Custom fields are forced onto absent DocTypes', SRC('omnitrack/install.py'),
  (code) => code.replace('\t\tif frappe.db.exists("DocType", doctype):\n\t\t\tcreate_custom_fields({doctype: fields}, ignore_validate=True)', '\t\tcreate_custom_fields({doctype: fields}, ignore_validate=True)'), OA, 'custom fields go only on DocTypes');

const DK = 'node scripts/check_detail_kind.mjs';
runMutationTest('A session sheet loses its kind header', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<DetailKind id="session-drawer-kind"', '<span id="session-drawer-kind"'), DK, 'starts with <DetailKind id="session-drawer-kind">');
runMutationTest('The task sheet is named by its title only', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace('aria-labelledby="task-drawer-kind task-drawer-title"', 'aria-labelledby="task-drawer-title"'), DK, 'named by its kind and its title');
runMutationTest('A task and a to-do look the same', SRC('src/components/common/DetailKind.vue'),
  (code) => code.replace("label: 'To-Do', tone: 'gray'", "label: 'To-Do', tone: 'purple'"), DK, 'two kinds share a tone');
runMutationTest('The raw description is rendered as HTML', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace('v-html="d.description_html"', 'v-html="d.description"'), DK, 'only the server-sanitized description_html');
runMutationTest('Esc in the task sheet also closes the sheet behind it', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace('        e.stopPropagation();\n        closeTaskDetail();', '        closeTaskDetail();'), DK, 'Escape closes this sheet only');
runMutationTest('Task details skip the permission check', SRC('omnitrack/api/tasks.py'),
  (code) => code.replace('doc = _task_doc(doctype, task_id)', 'doc = frappe.get_doc(doctype, task_id)'), DK, 'load the task through _task_doc');
runMutationTest('The task description is sent unsanitized', SRC('omnitrack/api/tasks.py'),
  (code) => code.replace('sanitize_html(doc.get("description")', '(doc.get("description")'), DK, 'sanitize the description');

runMutationTest('The kind and record name run together for a screen reader', SRC('src/components/common/DetailKind.vue'),
  (code) => code.replace('<span class="sr-only">, </span>{{ docName }}', '{{ docName }}'), DK, 'a hidden comma parts the kind');
runMutationTest('The task panel shows a bare status chip again', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace('<dt :class="mutedText">Status</dt>', ''), DK, 'the Status fact is named');
runMutationTest('Workflow steps leave the action bar', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace('<Button v-for="(m, i) in shownMoves"', '<Button v-if="false" v-for="(m, i) in shownMoves"'), DK, 'buttons at the start of the action bar');
runMutationTest("A block's task title opens nothing", SRC('src/drawers/BlockTasksSection.vue'),
  (code) => code.replace('@focus="cell = [i, 1]" @click="edit(t)">', '@focus="cell = [i, 1]">'), DK, 'the button that opens its details');
runMutationTest("A block's logged session opens nothing", SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace(`@click="$emit('open-session', s, block)">`, '>'), DK, "opens that session's panel");
runMutationTest('Two sheets stay open at once', SRC('src/App.vue'),
  (code) => code.replace('const openBlockSession = (session, block) => {\n      workstation.showBlockDrawer.value = false;\n', 'const openBlockSession = (session, block) => {\n'), DK, 'one sheet at a time');
const FT = 'node scripts/check_finished_tasks.mjs';
runMutationTest('A finished task comes back through its open assignment', SRC('omnitrack/api/tasks.py'),
  (code) => code.replace('if has_task and td.reference_type == "Task":\n', 'if has_task and td.reference_type == "Task" and td.reference_name in items:\n'), FT, 'a ToDo on a Task is never listed as a to-do');

runMutationTest('Time away lists tasks', SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('<BlockTasksSection v-if="!inline && !block.is_away"', '<BlockTasksSection v-if="!inline"'), AW, 'time away lists no tasks');
runMutationTest('Time away offers Start session', SRC('src/drawers/BlockDetailDrawer.vue'),
  (code) => code.replace('return !b.is_away && !this.isBlockCompleted(b)', 'return !this.isBlockCompleted(b)'), AW, 'no Start session');
runMutationTest('An away card shows hours worked', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace('const hours = time && lines >= 4 && !seg.block.is_away;', 'const hours = time && lines >= 4;'), AW, 'no hours-worked line');

const FF = 'node scripts/check_field_focus.mjs';
runMutationTest('A dialog opens its date picker on open again', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace(' && !opensOnFocus(el))', ')'), FF, 'skips a field that opens a popup');
runMutationTest('The Due picker loses its name', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace('aria-label="Due" aria-haspopup="dialog"', 'aria-haspopup="dialog"'), FF, 'has no aria-label');
runMutationTest('The Combobox shrinks to its text again', SRC('src/styles/main.css'),
  (code) => code.replace('[data-slot="trigger"]:has(> input[role="combobox"]) { display: flex; width: 100%; }', ''), FF, 'fills its container');

runMutationTest('The session sheet drops a fact name', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<dt :class="mutedText">When</dt>', '<dt :class="mutedText"></dt>'), DK, 'the "When" fact is not named');
runMutationTest('The session sheet shows a bare chip again', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<!-- Its facts, each named', '<Badge v-if="nature">{{ nature }}</Badge><!-- Its facts, each named'), DK, 'a bare chip is back');
runMutationTest('The session sheet splits its actions again', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace('<Dropdown v-if="moreMenu.length" :options="moreMenu" placement="right">', '</div><div><Dropdown v-if="moreMenu.length" :options="moreMenu" placement="right">'), DK, 'sit together in the one action bar');
runMutationTest('The session sheet loses Delete under More', SRC('src/drawers/SessionDetailDrawer.vue'),
  (code) => code.replace("label: 'Delete entry'", "label: 'Remove'"), DK, 'More holds Delete entry');

runMutationTest('The task panel is blank while it loads', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace('<p v-if="!d && !failed"', '<p v-if="false"'), DK, 'say it is loading');
runMutationTest('The task steps jump in after the panel opens', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace('<div v-if="d || failed" class="flex items-center gap-2 flex-wrap"', '<div v-if="true" class="flex items-center gap-2 flex-wrap"'), DK, 'say it is loading');

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
