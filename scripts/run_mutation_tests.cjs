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
  'Tailwind config loses the 950 palette extension',
  tailwindConfigPath,
  (code) => code.replace('{ 950: require("tailwindcss/colors")[c][950] }', '{}'),
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
  (code) => code.replace('const ee = live.toAfter ? 1440 : Math.max(ss + 1, nowMinute.value);', 'const curNow = new Date();\n        const ee = live.toAfter ? 1440 : Math.max(ss + 1, curNow.getHours() * 60 + curNow.getMinutes());'),
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
  'Adjusting a session goes back to a native time input',
  path.resolve(omnitrackDir,'src/session/SessionControlsPane.vue'),
  (code) => code.replace(/<DayTimeFields/g, '<input type="time" /><DayTimeFieldz'),
  'node scripts/check_dialog_popovers.cjs',
  'shared DayTimeFields'
);
runMutationTest(
  'A second dialog grows its own timesheet timing form',
  path.resolve(omnitrackDir,'src/drawers/RescheduleBlockDialog.vue'),
  (code) => code.replace('title="Reschedule"', 'title="Adjust timesheet timing"'),
  'node scripts/check_dialog_popovers.cjs',
  'a session dialog of its own'
);
runMutationTest(
  'Adjust on the running session opens a panel again',
  path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('    if (!(opt && opt.inPlace)) showSessionBox();\n', "    if (!(opt && opt.inPlace)) showSessionBox();\n    openPanel({ mode: 'free', ...liveAdjust.value });\n"),
  'node scripts/check_dialog_popovers.cjs',
  'never a panel'
);
runMutationTest(
  'Escape minimizes the popup with the times still open',
  path.resolve(omnitrackDir,'src/composables/useWorkstationShortcuts.js'),
  (code) => code.replace('if (liveAdjust.value) cancelLiveAdjust();\n      else isSessionElevated.value = false;', 'isSessionElevated.value = false;'),
  'node scripts/check_dialog_popovers.cjs',
  'closes the open times before'
);
runMutationTest(
  'Inline, Escape with focus outside the box leaves the times open',
  path.resolve(omnitrackDir,'src/composables/useWorkstationShortcuts.js'),
  (code) => code.replace("if (ev.key === 'Escape' && liveAdjust.value) {", "if (false) {"),
  'node scripts/check_dialog_popovers.cjs',
  'wherever focus is'
);
runMutationTest(
  'Cmd+S with the times open stops at now',
  path.resolve(omnitrackDir,'src/composables/useWorkstationShortcuts.js'),
  (code) => code.replace('if (isTracking.value && liveAdjust.value) stopAndLogSession();\n      else if', 'if'),
  'node scripts/check_dialog_popovers.cjs',
  'stops at the end they show'
);
runMutationTest('The TimePicker swallows the Escape that closes the times again', path.resolve(omnitrackDir,'src/session/SessionControlsPane.vue'),
  (code) => code.replace('@keydown.esc.capture="onAdjustEscape"', '@keydown.esc="onAdjustEscape"'), 'node scripts/check_dialog_popovers.cjs', 'caught before the TimePicker');
runMutationTest('The times close but the TimePicker still blurs its field', path.resolve(omnitrackDir,'src/session/SessionControlsPane.vue'),
  (code) => code.replace('      e.preventDefault();\n      e.stopPropagation();\n      ws.cancelLiveAdjust();', '      e.preventDefault();\n      ws.cancelLiveAdjust();'), 'node scripts/check_dialog_popovers.cjs', 'never blurs its field');
runMutationTest('Escape on an open time list drops focus to the page', path.resolve(omnitrackDir,'src/session/SessionControlsPane.vue'),
  (code) => code.replace("        setTimeout(() => { if (document.activeElement === document.body && field.isConnected) field.focus(); });\n", ''), 'node scripts/check_dialog_popovers.cjs', 'focus stays on its field');
runMutationTest(
  'Escape inside the inline times does nothing',
  path.resolve(omnitrackDir,'src/session/SessionControlsPane.vue'),
  (code) => code.replace('@keydown.esc.capture="onAdjustEscape"', ''),
  'node scripts/check_dialog_popovers.cjs',
  'Escape inside the open times closes them'
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
  'Moving the start rewrites the session title',
  path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('    startTime.value = ms;\n', "    startTime.value = ms;\n    trackerNotes.value = trackerNotes.value || 'Focus work session';\n"),
  'node scripts/check_dialog_popovers.cjs',
  "never rewrites the session's title"
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
  (code) => code.replace("{{ currentState }}", "{{ detail.subject }}"), DP, 'where the task stands');
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
  (code) => code.replace('\tif doctype != "Task" or not frappe.db.exists("Task", clean_id):\n\t\treturn None', '\tif not doctype:\n\t\treturn None'), DA, 'a Task and nothing else');
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
  (code) => code.replace('if (seq === this.seq) { this.take(res); this.failed = false; }', '{ this.take(res); this.failed = false; }'), DA, 'slow load');
runMutationTest('A refused Activity offers Try again', DAC,
  (code) => code.replace('this.refused = !!(e && e.status === 403); this.failed = !this.refused;', 'this.refused = false; this.failed = true;'), DA, 'not offered Try again');
runMutationTest('A refused Activity says nothing', DAC,
  (code) => code.replace("You cannot see this {{ noun }}'s activity.", ''), DA, 'a refusal says so');
runMutationTest('Try again does not show it is trying', DAC,
  (code) => code.replace('label="Try again" :loading="loading" @click="load"', 'label="Try again" @click="load"'), DA, 'shows it is trying');
runMutationTest('A retry flashes Loading again', DAC,
  (code) => code.replace('<p v-else-if="loading && !items.length"', '<p v-if="loading && !items.length"'), DA, 'keeps the failed line');
runMutationTest('postJSON drops the HTTP status', path.resolve(omnitrackDir,'src/composables/useWorkstationIdentity.js'),
  (code) => code.replace('{ status: res.status }', '{}'), DA, 'carries the HTTP status');
runMutationTest('Activity refuses a person their own block again', path.resolve(omnitrackDir,'omnitrack/api/activity.py'),
  (code) => code.replace('\tif doctype == "Planned Work Block":\n', '\tif False:\n'), DA, 'has_work_block_permission');
runMutationTest('Activity reads any block', path.resolve(omnitrackDir,'omnitrack/api/activity.py'),
  (code) => code.replace('\t\tif not has_work_block_permission(doc, "read"):\n', '\t\tif False:\n'), DA, 'has_work_block_permission');
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
const ES = path.resolve(omnitrackDir,'src/session/SessionControlsPane.vue');
runMutationTest('Stop and log is ready for an end after now', ES,
  (code) => code.replace(':disabled="adjustAhead || !(adjustMins > 0)"', ':disabled="!(adjustMins > 0)"'), EW, 'waits for an end that is not ahead');
runMutationTest('An adjusted end is measured against the start', ES,
  (code) => code.replace('return entryEndMs(f.session_date, f.from_time, adjustMins.value) > Date.now() + 60000;', 'return entryEndMs(f.session_date, f.from_time, 0) > Date.now() + 60000;'), EW, 'is ahead');
runMutationTest('Why the times cannot be logged goes unsaid', ES,
  (code) => code.replace('role="alert">The end is after now.', '>The end is after now.'), EW, 'says why it cannot be logged');
runMutationTest('Stop and log logs an end after now', path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('const end = entryEndMs(f.session_date, f.from_time, mins);\n    if (end > Date.now() + 60000) {', 'const end = entryEndMs(f.session_date, f.from_time, mins);\n    if (false) {'), EW, 'Stop and log refuses an end after now');
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
  (code) => code.replace('dark:text-red-200" role="alert">{{ entryRefusal }}', 'dark:text-red-200">{{ entryRefusal }}'), EW, 'says why');
runMutationTest('Cancel drops out of Tab while Add session waits', SCP,
  (code) => code.replace(':tabindex="activeToolIndex === 0 || !entryCanSave ? 0 : -1"', ':tabindex="activeToolIndex === 0 ? 0 : -1"'), EW, 'Cancel stays reachable');
runMutationTest('Adding a session opens the sheet, not the session box', path.resolve(omnitrackDir,'src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace('<WorkSessionEntry\n      :model-value="showEditSessionModal"', '<WorkSessionEntry\n      :model-value="false"'), EW, 'open WorkSessionEntry');
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
  (code) => code.replace("if (!(f.log || []).length) return refuse(", 'if (false) return refuse('), EW, 'refuses an entry with no line');
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
// An entry lists its own block's tasks, never the running session's
const SBX = path.resolve(omnitrackDir,'src/session/SessionBox.vue');
runMutationTest("An entry lists the running session's tasks", SBX,
  (code) => code.replace('(ws ? props.trackerBoundBlock || ws.liveSessionBlock.value : props.trackerBoundBlock)', '(props.trackerBoundBlock || (ws && ws.liveSessionBlock.value))'), DP, 'never the running session');
// Two columns: tasks under the Log. One column: beside "Logging to". Never both, never neither.
runMutationTest('Tasks stay beside "Logging to" with two columns', SCP,
  (code) => code.replace('v-if="tasksBlock && !tasksUnderLog"', 'v-if="tasksBlock"'), DP, 'beside "Logging to" only with one column');
runMutationTest('Tasks vanish with two columns', SLP,
  (code) => code.replace('v-if="tasksBlock && tasksUnderLog"', 'v-if="false"'), DP, 'under the Log only with two columns');
runMutationTest('Tasks follow a breakpoint the grid does not use', SBX,
  (code) => code.replace("window.matchMedia('(min-width: 1024px)')", "window.matchMedia('(min-width: 768px)')"), DP, "grid's own lg breakpoint");
runMutationTest('Tasks do not move when the window is resized', SBX,
  (code) => code.replace("  twoColumns.addEventListener('change', onColumnsChange);\n", ''), DP, 'crosses lg');
runMutationTest('The column listener outlives the box', SBX,
  (code) => code.replace("  twoColumns.removeEventListener('change', onColumnsChange);\n", ''), DP, 'listener is removed');
runMutationTest('Tasks sit above the Log', SLP,
  (code) => code.replace(/(\s*<!-- With two columns[\s\S]*?<BlockTasksSection v-if="tasksBlock && tasksUnderLog"[^>]*\/>)/, '').replace('<div class="min-h-0 flex flex-col"', '<BlockTasksSection v-if="tasksBlock && tasksUnderLog" :block="tasksBlock" :is-dark-mode="isDarkMode" />\n    <div class="min-h-0 flex flex-col"'), DP, 'last thing in the pane');
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
const TM = path.resolve(omnitrackDir,'omnitrack/utils/time_math.py');
const TMT = `${path.resolve(appDir, '../../env/bin/python')} -m unittest omnitrack.tests.test_time_math`;
runMutationTest('pad_time splits on ":" again', TM,
  (code) => code.replace('\treturn get_time(value).strftime("%H:%M:%S")\n', '\tp = str(value).split(":")\n\treturn f"{p[0].zfill(2)}:{p[1]}:{p[2] if len(p) > 2 else \'00\'}"\n'), TMT, 'test_pad_time_reads_any_time');
runMutationTest('mins_of splits on ":" again', TM,
  (code) => code.replace('\tt = get_time(value)\n\treturn t.hour * 60 + t.minute\n', '\tp = [int(x) for x in str(value).split(":")[:2]]\n\treturn p[0] * 60 + p[1]\n'), TMT, 'test_mins_of_reads_any_time');
runMutationTest('A stored 24:00 end counts as 00:00', TM,
  (code) => code.replace('\tif isinstance(value, timedelta):\n\t\treturn int(value.total_seconds() // 60)\n', ''), TMT, 'test_mins_of_reads_any_time');
runMutationTest('An empty Time field is sent as 00:00:00', TM,
  (code) => code.replace('\tif val in (None, ""):\n\t\treturn ""\n', ''), TMT, 'test_time_str_keeps_empty_empty');
runMutationTest('Planner serialises empty times as 00:00:00 again', path.resolve(omnitrackDir,'omnitrack/api/planner.py'),
  (code) => code.replace('\ttime_str as _time_str,\n', '\tpad_time as _time_str,\n'), TMT, 'test_no_hand_parser_is_left');
const TP = path.resolve(omnitrackDir,'omnitrack/utils/task_parity.py');
const TPT = `${path.resolve(appDir, '../../env/bin/python')} -m unittest omnitrack.tests.test_task_parity`;
const PWBC = path.resolve(omnitrackDir,'omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.py');
runMutationTest("A block on someone else's task leaves its person off it", TP,
  (code) => code.replace('and name in task_assignees and person not in task_assignees[name]:', 'and name in task_assignees and not task_assignees[name]:'), TPT, 'test_someone_elses_task_gets_the_blocks_person_added');
runMutationTest('A deleted task is assigned anyway', TP,
  (code) => code.replace('and name in task_assignees and person not in', 'and person not in task_assignees.get(name, set()) and person not in'), TPT, 'test_finished_missing_and_repeated_tasks');
runMutationTest('A finished task gets a new assignee', TP,
  (code) => code.replace('\t\tif not name or status == "Completed":\n', '\t\tif not name:\n'), TPT, 'test_finished_missing_and_repeated_tasks');
runMutationTest("A block on someone else's to-do is booked", TP,
  (code) => code.replace('\t\t\tif owner and owner != person:\n\t\t\t\trefuse.append((name, owner))\n', ''), TPT, 'test_someone_elses_todo_is_refused');
runMutationTest("A colleague's copy is refused its owner's to-do", TP,
  (code) => code.replace('elif doctype == "ToDo" and not is_copy:', 'elif doctype == "ToDo":'), TPT, 'test_her_own_todo_and_a_copys_todo_pass');
runMutationTest('Saving a block no longer checks its tasks', PWBC,
  (code) => code.replace('\t\tself.sync_primary_task()\n\t\tself.put_person_on_tasks()\n', '\t\tself.sync_primary_task()\n'), TPT, 'test_every_saved_block_is_checked');
runMutationTest('Assignees in open ToDos are ignored', PWBC,
  (code) => code.replace('\t\t\t\ttask_assignees[td.reference_name].add(td.allocated_to)\n', '\t\t\t\tpass\n'), TPT, 'test_every_saved_block_is_checked');
runMutationTest('Every save re-checks old rows', PWBC,
  (code) => code.replace('if r.work_item not in known and', 'if'), TPT, 'test_only_new_rows_are_checked');
runMutationTest('Booking no longer says who was added', path.resolve(omnitrackDir,'omnitrack/api/planner.py'),
  (code) => code.replace('\t\t"added_to_tasks": doc.flags.added_to_tasks or [],\n', ''), TPT, 'test_the_result_says_who_was_added');
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
  (code) => code.replace("'enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white'", "'!bg-blue-700 hover:!bg-blue-800 enabled:!text-white'"), 'node scripts/check_contrast_tokens.cjs', 'looks pressable');
runMutationTest('An empty comment looks ready to post', path.resolve(omnitrackDir,'src/components/common/DocActivity.vue'),
  (code) => code.replace('enabled:!bg-blue-700 enabled:hover:!bg-blue-800', 'enabled:!bg-blue-700 hover:!bg-blue-800'), 'node scripts/check_contrast_tokens.cjs', 'looks pressable');
runMutationTest('An overnight entry ends on its start day', path.resolve(omnitrackDir,'src/utils/timesheetEntry.js'),
  (code) => code.replace('0, toMin(from) + mins)', '0, (toMin(from) + mins) % 1440)'), EW, 'overnight');
runMutationTest('The save path takes time not worked yet', path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('if (entryEndMs(f.session_date, f.from_time, mins) > Date.now() + 60000) return refuse(', 'if (false) return refuse('), EW, 'saveEditSession refuses');
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
runMutationTest('Day chips offer Yesterday when only today can be logged', path.resolve(omnitrackDir,'src/utils/timesheetEntry.js'),
  (code) => code.replace('(Number(daysBack) || 15) >= 2 ? [0, -1] : [0]', 'true ? [0, -1] : [0]'), TE, 'today only');
runMutationTest('Day chips grow with the logging window again', path.resolve(omnitrackDir,'src/utils/timesheetEntry.js'),
  (code) => code.replace("return isManager || (Number(daysBack) || 15) >= 2 ? [0, -1] : [0];", "return Array.from({ length: Math.min(isManager ? 7 : Math.max(1, Number(daysBack) || 15), 7) }, (_, i) => -i);"), TE, '15 days back');
runMutationTest('A new entry defaults to a future block\'s own slot', path.resolve(omnitrackDir,'src/utils/timesheetEntry.js'),
  (code) => code.replace('if (planned && day && day <= today)', 'if (planned && day)'), TE, 'a future block');
runMutationTest('Adding an entry drops log_work_session\'s result', path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("return afterSave('Work session added', await postJSON('log_work_session'", "await postJSON('log_work_session'"), TE, 'log_work_session\'s result');
runMutationTest('A client-side day limit comes back', path.resolve(omnitrackDir,'src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("const withSeconds = ", "const minTimesheetDate = null;\n  const withSeconds = "), TE, 'minTimesheetDate');
runMutationTest('Drawer Reschedule moves the store\'s block', path.resolve(omnitrackDir,'src/composables/useWorkstationFocusTasks.js'),
  (code) => code.replace('    const b = activeBlock.value;\n    const f = form', '    const b = workBlockStore.activeBlock;\n    const f = form'), TE, 'w.activeBlock');
runMutationTest('A refused tick stays ticked', path.resolve(omnitrackDir,'src/composables/useWorkstationFocusTasks.js'),
  (code) => code.replace('      Object.assign(item, before);\n', ''), TE, 'restore the task');

const SRC = (f) => path.resolve(omnitrackDir,f);
runMutationTest('The session popup loses its task list', SRC('src/session/SessionBox.vue'),
  (code) => code.replace('(ws ? props.trackerBoundBlock || ws.liveSessionBlock.value : props.trackerBoundBlock)', '(props.trackerBoundBlock)'), DP, 'bound block, else liveSessionBlock');
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
runMutationTest('Escape on a time list in a dialog drops focus to the page', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace('          if (field && field.isConnected && now !== field && (now === document.body || (panel && panel.contains(now)))) focusBack(field);\n', ''), DP, 'focus stays on its field');
runMutationTest('A closed day calendar leaves focus on another field', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace(' || (panel && panel.contains(now))', ''), DP, 'focus stays on its field');
runMutationTest('Focus coming back to a day field opens its calendar again', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace('panel.contains(now)))) focusBack(field);', 'panel.contains(now)))) field.focus();'), DP, 'focus stays on its field');
runMutationTest('A dialog forgets which field its list belongs to', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace(' @focus.capture="noteFocus"', ''), DP, 'focus stays on its field');
runMutationTest('A click on the day field is forgotten by its dialog', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace(' @pointerdown="noteFocus"', ''), DP, 'focus stays on its field');
runMutationTest('Escape on a time list in a dialog steals focus already placed', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace('if (field && field.isConnected && now !== field && (now === document.body || (panel && panel.contains(now))))', 'if (field)'), DP, 'focus stays on its field');
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
runMutationTest('The entry form grows a view mode again', SRC('src/components/dialogs/WorkSessionEntry.vue'),
  (code) => code.replace('<SessionBox', '<div data-entry-view></div><SessionBox'), BR, 'the one entry form is only a form');
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
  (code) => code.replace("showToast('Not saved, the session is still running. ' + _errText(err), 'danger');", "showToast('Timer punch recorded locally.', 'success');"), ON, 'reported as saved');
runMutationTest('An end before the start is refused again', SRC('src/utils/clockTime.js'),
  (code) => code.replace('  return d < 0 ? d + 24 * 60 : d;', '  return d < 0 ? 0 : d;'), ON, 'spanMins(23:00, 04:00)');
runMutationTest('Adjust stops measuring past midnight', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace('spanMins(ws.liveAdjust.value.from_time, ws.liveAdjust.value.to_time)', 'Math.max(0, toMin(ws.liveAdjust.value.to_time) - toMin(ws.liveAdjust.value.from_time))'), ON, 'SessionControlsPane.vue');
runMutationTest('An overnight end is an hour off the night the clocks change', SRC('src/utils/timesheetEntry.js'),
  (code) => code.replace('return new Date(y, m - 1, d, 0, toMin(from) + mins).getTime();', 'return new Date(y, m - 1, d, 0, 0, 0).getTime() + (toMin(from) + mins) * 60000;'), ON, 'the clocks change that night');
runMutationTest('An overnight end lands on its start day', SRC('src/utils/timesheetEntry.js'),
  (code) => code.replace('0, toMin(from) + mins)', '0, (toMin(from) + mins) % 1440)'), ON, 'a session from 20:19 stopped at 01:10');

runMutationTest('A day with only a running session says Nothing planned', SRC('src/views/DashboardView.vue'),
  (code) => code.replace('<div v-if="dayFocusBlocks.length > 0 || dayTimeline" class="space-y-4">', '<div v-if="dayFocusBlocks.length > 0" class="space-y-4">'), DH, 'whenever the day has anything on it');

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
runMutationTest('A length reads as a rounded decimal again', SRC('src/utils/clockTime.js'),
  (code) => code.replace('return m ? `${h}h ${m}m` : h + "h";', 'return m ? (mins / 60).toFixed(1) + "h" : h + "h";'), ON, 'want 7h 15m');
runMutationTest('The session box offers six lengths again', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace(':durations="[15, 30, 60, 120]"', ':durations="[15, 30, 60, 90, 120, 180]"'), ON, 'four at most');
runMutationTest('The odd length drops under the chips again', SRC('src/components/common/DayTimeFields.vue'),
  (code) => code.replace('aria-label="Length" @update:model-value="setDuration" />', 'aria-label="Length" @update:model-value="setDuration" />\n          <span v-if="mins > 0 && !durations.includes(mins)">{{ durationLabel(mins) }}</span>'), ON, 'beside the label');
runMutationTest('The default lengths wrap again', SRC('src/components/common/DayTimeFields.vue'),
  (code) => code.replace('default: () => [30, 60, 120, 240] }', 'default: () => [30, 60, 90, 120, 180, 240] }'), ON, 'four at most');
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
runMutationTest('Template text says timesheet again', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace('>Keep running</Button>', '>Keep running (no timesheet)</Button>'), VO, 'bare "timesheet"');
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
runMutationTest("The dialog's time hides that it was yesterday", SRC('src/utils/clockTime.js'),
  (code) => code.replace('if (daysAgo === 1) return at + " yesterday";', 'if (daysAgo === 1) return at;'), SR, 'a time from yesterday was yesterday');
runMutationTest('The still-working dialog stops the session in one press', SRC('src/components/dialogs/InactivityGovernorModal.vue'),
  (code) => code.replace("@click=\"$emit('adjust')\"", "@click=\"$emit('stop-at-last-edit')\""), SR, 'never stops or discards');
runMutationTest('A click on the page answers the still-working dialog', SRC('src/composables/useWorkstationSessionClock.js'),
  (code) => code.replace('  const recordUserActivity = () => {\n    lastActivityTime.value = Date.now();\n', '  const recordUserActivity = () => {\n    lastActivityTime.value = Date.now();\n    showInactivityModal.value = false;\n'), SR, 'never answers the dialog');
runMutationTest('Adjust times opens at now, not the suggested stop', SRC('src/composables/useWorkstationSessionClock.js'),
  (code) => code.replace('w.openAdjustModal({ endMs });', 'w.openAdjustModal();'), SR, 'its end at the held suggested stop');
runMutationTest('The Adjust box ignores the end it was given', SRC('src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('const cap = opt && opt.endMs ?', 'const cap = false ?'), SR, 'starts the end where it was asked to');
runMutationTest('The still-working question moves with each answer', SRC('src/composables/useWorkstationSessionClock.js'),
  (code) => code.replace('idleSinceMs.value = act;\n', ''), SR, 'holding the moment');

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
  (code) => code.replace("{ 'aria-label': 'Due', 'aria-haspopup': 'dialog' }", "{ 'aria-haspopup': 'dialog' }"), FF, 'has no aria-label');
runMutationTest('The day field\'s name goes back on the DatePicker, which drops it', SRC('src/components/common/DayTimeFields.vue'),
  (code) => code.replace('placeholder="Pick a day"\n', 'placeholder="Pick a day"\n            :aria-label="dayLabel"\n'), FF, 'put them in v-input-attrs');
runMutationTest('A DatePicker loses the element that names its input', SRC('src/components/common/DayTimeFields.vue'),
  (code) => code.replace(`<div v-input-attrs="{ 'aria-label': dayLabel, 'aria-haspopup': 'dialog' }">`, '<div>'), FF, 'sits directly inside');
runMutationTest('The day field no longer says it opens a calendar', SRC('src/components/common/DayTimeFields.vue'),
  (code) => code.replace(`'aria-haspopup': 'dialog' }">`, `}">`), FF, "needs 'aria-haspopup'");
runMutationTest('v-input-attrs is not registered where it is used', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace('  directives: { inputAttrs: vInputAttrs },\n', ''), FF, 'registers v-input-attrs');
runMutationTest('v-input-attrs keeps a stale name after the label changes', SRC('src/utils/popover.js'),
  (code) => code.replace('{ mounted: applyInputAttrs, updated: applyInputAttrs }', '{ mounted: applyInputAttrs }'), FF, 'on every update');
runMutationTest('v-input-attrs puts nothing on the input', SRC('src/utils/popover.js'),
  (code) => code.replace('    else input.setAttribute(k, String(v));\n', ''), FF, 'puts its attributes on the input');
runMutationTest('Escape on a day calendar opens it again as focus comes back', SRC('src/utils/popover.js'),
  (code) => code.replace('    window.addEventListener("focus", hushOpener, true);\n    const settle', '    const settle'), FF, 'does not open its calendar again');
runMutationTest('A day field opens its calendar even while focus is held back', SRC('src/utils/popover.js'),
  (code) => code.replace('if (opensOnFocus(e.target)) e.stopImmediatePropagation();', 'if (opensOnFocus(e.target)) return;'), FF, 'without opening (hushOpener)');
runMutationTest('The day calendar hold is installed nowhere', SRC('src/main.js'),
  (code) => code.replace('\nquietReopenOnEscape();\n', '\n'), FF, 'installed when the app loads');
runMutationTest('The day calendar hold listens after the calendar closed', SRC('src/utils/popover.js'),
  (code) => code.replace('      else settle();\n    });\n  }, true);', '      else settle();\n    });\n  });'), FF, 'capture phase');
runMutationTest('Escape on a day calendar outside a dialog leaves focus on the page', SRC('src/utils/popover.js'),
  (code) => code.replace('if (ours && field.isConnected && (!now || now === document.body)) focusBack(field);', ''), FF, 'its field gets focus back');
runMutationTest('Tabbing onto a day field is never noted (focusin comes too late)', SRC('src/utils/popover.js'),
  (code) => code.replace('window.addEventListener("focus", noteField, true);', 'document.addEventListener("focusin", noteField, true);'), FF, 'capturing focus, not focusin');
runMutationTest('A click on a day field is never noted', SRC('src/utils/popover.js'),
  (code) => code.replace('  document.addEventListener("pointerdown", noteField, true);\n', ''), FF, 'as it is pressed');
runMutationTest("A calendar's own buttons count as the field it belongs to", SRC('src/utils/popover.js'),
  (code) => code.replace('if (!t || !t.closest || t.closest(POPUP)) return;', 'if (!t || !t.closest) return;'), FF, 'outside a popup');
runMutationTest('Escape on a hover tooltip pulls focus to a field pressed long ago', SRC('src/utils/popover.js'),
  (code) => code.replace('const ours = !!field && (from === field || !!(from && from.closest && from.closest(POPUP)));', 'const ours = !!field;'), FF, 'does not open its calendar again');
runMutationTest('Focus already placed after Escape is moved again', SRC('src/utils/popover.js'),
  (code) => code.replace('(!now || now === document.body)) focusBack(field);', 'now !== field) focusBack(field);'), FF, 'its field gets focus back');
runMutationTest('Focus is checked before the calendar lets go of it', SRC('src/utils/popover.js'),
  (code) => code.replace('if (ours && now && now.closest && now.closest(POPUP)) now.addEventListener("focusout", () => setTimeout(settle), { once: true });\n      else settle();', 'settle();'), FF, 'let go of it');
runMutationTest('An end time and its length are cut off in the time list', SRC('src/styles/main.css'),
  (code) => code.replace('  width: max-content;\n  min-width: 11rem;', '  min-width: 11rem;'), FF, 'never cut off');
runMutationTest('Tabbing onto a day field in a dialog is never noted', SRC('src/components/common/FDialog.vue'),
  (code) => code.replace('@focus.capture="noteFocus"', '@focusin="noteFocus"'), DP, 'focus stays on its field');
runMutationTest('The Combobox shrinks to its text again', SRC('src/styles/main.css'),
  (code) => code.replace('[data-slot="trigger"]:has(> input[role="combobox"]) { display: flex; width: 100%; }', ''), FF, 'fills its container');
runMutationTest('A dialog focuses a Button through its $el again', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace("const el = box && (box.querySelector('button:not([disabled])') || box);", 'const el = this.$refs.stateBtn && this.$refs.stateBtn.$el;'), FF, "focuses a component's $el");
runMutationTest('A sheet focuses its close Button through $el directly', SRC('src/drawers/TaskDetailDrawer.vue'),
  (code) => code.replace("if (el) el.focus();\n      });\n    },\n    // Back to the row", "if (el) el.focus();\n        this.$refs.sheet.$el.focus();\n      });\n    },\n    // Back to the row"), FF, "focuses a component's $el");

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

// A refused Stop never loses a session, and an older copy of its log never replaces a newer one
const SLN = 'node scripts/check_session_lines.mjs';
const SLT = `${path.resolve(appDir, '../../env/bin/python')} -m unittest omnitrack.tests.test_session_lines`;
const WAPI = SRC('src/composables/useWorkstationApi.js');
const WSYNC = SRC('src/composables/useWorkstationSessionSync.js');
runMutationTest('The page counts a hyphen as part of a word', SRC('src/utils/sessionWords.js'),
  (code) => code.replace("replace(/[•\\-*\\n\\r\\t,;:.]/g, ' ')", "replace(/[•*\\n\\r\\t,;:.]/g, ' ')"), SLN, 'as the server counts');
runMutationTest('The page ignores the Minimum Words setting', SRC('src/utils/sessionWords.js'),
  (code) => code.replace('return n > 0 ? n : 15;', 'return 15;'), SLN, 'follows OmniTrack Settings');
runMutationTest('An older copy of the log wins', SRC('src/utils/sessionLines.js'),
  (code) => code.replace('return (Number(remoteRev) || 0) >= (Number(localRev) || 0);', 'return true;'), SLN, 'must not replace a newer one');
runMutationTest('Stop tears the clock down before counting words', WAPI,
  (code) => code.replace('countSessionWords(notesNow) < minSessionWords(window.OMNITRACK_SESSION)) { refuseEmptySession(); return; }', 'false) { refuseEmptySession(); return; }'), SLN, 'before the clock is torn down');
runMutationTest('Stop drops the line typed but not added', WAPI,
  (code) => code.replace("if (draft) { sessionNotesList.value.push(draft); newSessionPoint.value = ''; syncActiveSession(true); }", ''), SLN, 'unsent line joins the log');
runMutationTest('Stop clears the server copy before saving', WAPI,
  (code) => code.replace('const notesNow = composeWrapNote(', "postJSON('/api/method/omnitrack.api.stopwatch.sync_active_session', { session_data: null });\n      const notesNow = composeWrapNote("), SLN, 'must not clear the server copy');
runMutationTest('A refused block save loses the session', WAPI,
  (code) => code.replace(/\} catch \(err\) \{\s*keepSession\(err\);/, '} catch (err) { showToast(_errText(err), \'danger\');'), SLN, 'puts the session back');
runMutationTest('keepSession leaves the session ended', WAPI,
  (code) => code.replace('restoreActiveSession(keptSession);', ''), SLN, 'restores the session');
runMutationTest('An edit does not stamp the log', WSYNC,
  (code) => code.replace('if (!_applyingRemote) _linesRev = Date.now();', ''), SLN, 'stamps the log');
runMutationTest('The sync leaves out the log revision', WSYNC,
  (code) => code.replace('linesRev: _linesRev,', ''), SLN, "carries the log's revision");
runMutationTest('A restore takes an older log', WSYNC,
  (code) => code.replace('const keepLocalLines = sameSession && !remoteLinesWin(sessionData.linesRev, _linesRev);', 'const keepLocalLines = false;'), SLN, 'keeps a newer log');
runMutationTest('A poll takes an older log', WSYNC,
  (code) => code.replace('const keptLocal = !remoteLinesWin(remote.linesRev, _linesRev);', 'const keptLocal = false;'), SLN, 'keeps a newer log');
runMutationTest('A short Stop opens a dialog again', WSM,
  (code) => code.replace('    stopNeedsWords.value = true;\n    showSessionBox();', '    stopNeedsWords.value = true;\n    showEditSessionModal.value = true;'), SLN, 'shows the session box and asks there');
runMutationTest('Stop and log moves the start before the words are checked', WSM,
  (code) => code.replace('    if (!logIsEnough()) { refuseEmptySession(); return; }\n    if (restartClockAt(f) == null) return;', '    if (restartClockAt(f) == null) return;\n    if (!logIsEnough()) { refuseEmptySession(); return; }'), SLN, 'checks the words before the start moves');
runMutationTest('The line still in the field is left out of the count', WSM,
  (code) => code.replace('const lines = [...(sessionNotesList.value || []), ...(draft ? [draft] : [])];', 'const lines = [...(sessionNotesList.value || [])];'), SLN, 'the line still in the field');
runMutationTest('The word prompt is not announced', SLP,
  (code) => code.replace(/id="session-stop-words"\s*role="status"/, 'id="session-stop-words"'), SLN, 'announced as it changes');
runMutationTest('The word prompt stops saying how many words there are', SLP,
  (code) => code.replace('(you wrote {{ stopWordsNow }})', ''), SLN, 'how many there are');
runMutationTest('The session field stops sharing its line with Stop', SRC('src/session/SessionBox.vue'),
  (code) => code.replace('watch(notes.localLineText, (t) => { if (newSessionPoint.value !== t) newSessionPoint.value = t; });', ''), SLN, 'so Stop keeps it and the count sees it');
// Behaviour of the running session's own box, driven against the real composable
const LA = 'node scripts/check_live_adjust.mjs';
runMutationTest('Stop puts an overnight end on the start day again', WSM,
  (code) => code.replace('const end = entryEndMs(f.session_date, f.from_time, mins);', 'const end = msOf(f.session_date, f.to_time);'), LA, 'an overnight Stop');
runMutationTest('Stop puts an overnight end on the start day, spelt another way', WSM,
  (code) => code.replace('const end = entryEndMs(f.session_date, f.from_time, mins);', 'const { session_date: day, to_time: until } = f;\n    const end = mins >= 0 ? msOf(day, until) : 0;'), LA, 'an overnight Stop');
runMutationTest('Adjust from the box itself pops the box up', WSM,
  (code) => code.replace('    if (!(opt && opt.inPlace)) showSessionBox();\n', '    showSessionBox();\n'), LA, 'leaves the box where it is');
runMutationTest('Adjust from elsewhere leaves the box hidden', WSM,
  (code) => code.replace('    if (!(opt && opt.inPlace)) showSessionBox();\n', ''), LA, 'brings the session box up');
runMutationTest('Keep running leaves its times open', WSM,
  (code) => code.replace("    liveAdjust.value = null;\n    showToast(`Start set to", "    showToast(`Start set to"), LA, 'Keep running closes the box');
runMutationTest('An ended session keeps its word prompt', WSM,
  (code) => code.replace('    liveAdjust.value = null;\n    stopNeedsWords.value = false;\n  });', '    liveAdjust.value = null;\n  });'), LA, 'takes its open box and prompt with it');
runMutationTest('Stop and log stops at now, not the end picked', WSM,
  (code) => code.replace('await toggleTrack(end < Date.now() ? end : null);', 'await toggleTrack(null);'), LA, 'ends at the end picked');
runMutationTest('Adjust times starts on the start, not the suggested end', WSM,
  (code) => code.replace("focus: opt && opt.endMs ? 'end' : 'start'", "focus: 'start'"), LA, 'starts on the suggested end');
runMutationTest('Adjust on its own starts on the end', WSM,
  (code) => code.replace("focus: opt && opt.endMs ? 'end' : 'start'", "focus: 'end'"), LA, 'starts on the start time');
runMutationTest('The box focuses the start whatever was asked', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace('return (wantsEnd ? inputs[2] : inputs[1]) || inputs[0];', 'return inputs[1] || inputs[0];'), LA, 'handed to the end');
runMutationTest('The box focuses once and lets the closing dialog take it back', SRC('src/session/SessionControlsPane.vue'),
  (code) => code.replace('            handFocus(() => {', '            ((f) => { const el = f(); if (el) el.focus(); })(() => {'), LA, 'handed to the end');
runMutationTest('Focus taken by a closing dialog is not put back', SRC('src/utils/focusHandOff.js'),
  (code) => code.replace("  document.addEventListener('focusin', onFocus, true);\n", ''), LA, 'is put back');
runMutationTest("The hand-off overrides the person's own click", SRC('src/utils/focusHandOff.js'),
  (code) => code.replace("  document.addEventListener('pointerdown', stop, true);\n", ''), LA, 'never overridden');
runMutationTest('The hand-off never lets go', SRC('src/utils/focusHandOff.js'),
  (code) => code.replace('  timer = setTimeout(stop, ms);\n', ''), LA, 'lets go after a moment');
// Task chat is the ERPNext Task's Raven channel, never a block's or a to-do's
const TC = 'node scripts/check_task_chat.mjs';
const CHATJS = SRC('src/session/useSessionChat.js');
runMutationTest("A block's own name is sent as its task again", CHATJS,
  (code) => code.replace('if (blk) return blk.task || null;', 'if (blk) return blk.task || blk.name;'), TC, "a block's own name");
runMutationTest('A to-do picked by title is sent as a task', CHATJS,
  (code) => code.replace("t.kind === 'Task' && t.subject && t.subject === props.trackerNotes", 't.subject && t.subject === props.trackerNotes'), TC, 'a to-do picked by title');
runMutationTest('The Task chat tab is offered with nothing to chat about', CHATJS,
  (code) => code.replace("isRavenAvailable.value && connectedTaskId.value ? ['chat'] : []", "isRavenAvailable.value ? ['chat'] : []"), TC, 'offered only with a Task');
runMutationTest('A refused message says nothing again', CHATJS,
  (code) => code.replace("        chatError.value = 'Not sent. ' + ((res && res.message && res.message.error) || 'Try again.');\n", ''), TC, 'a refused message says Not sent');
runMutationTest('A failed request is only logged', CHATJS,
  (code) => code.replace("      chatError.value = 'Not sent. ' + refusal(e, 'Try again.');", "      console.error('Failed to send message', e);"), TC, 'a failed request says Not sent');
runMutationTest('A new try keeps the last refusal', CHATJS,
  (code) => code.replace("    chatSending.value = true;\n    chatError.value = '';\n", '    chatSending.value = true;\n'), TC, 'clears the last refusal');
runMutationTest('A refused pin says nothing', CHATJS,
  (code) => code.replace("        chatError.value = 'Not pinned. ' + ((res && res.message && res.message.error) || 'Try again.');\n", ''), TC, 'Not pinned');
const SLPANE = SRC('src/session/SessionLogPane.vue');
runMutationTest('The Task chat tab shows for any block', SLPANE,
  (code) => code.replace('v-if="isRavenAvailable && connectedTaskId && !isEntry"', 'v-if="isRavenAvailable && !isEntry"'), TC, 'shows only with a Task');
runMutationTest('The chat stops naming its task', SLPANE,
  (code) => code.replace('With everyone on the task <span', 'Chat <span'), TC, 'names the task');
runMutationTest('A chat refusal is not announced', SLPANE,
  (code) => code.replace('<p v-if="chatError" role="alert"', '<p v-if="chatError"'), TC, 'announced under the box');
runMutationTest('Send leaves the tab order', SLPANE,
  (code) => code.replace('@click="sendChatMessage"\n', '@click="sendChatMessage"\n              tabindex="-1"\n'), TC, 'Send is in the tab order');
runMutationTest('The server makes a channel for any id', SRC('omnitrack/raven_bridge.py'),
  (code) => code.replace('if doctype != "Task" or not frappe.db.exists("Task", clean_id):\n\t\treturn None', 'if doctype != "Task":\n\t\treturn None'), TC, 'anything but a real Task');
runMutationTest('A message with no channel is not told why', SRC('omnitrack/raven_bridge.py'),
  (code) => code.replace('_("Only an ERPNext Task has a chat; {0} is not one.").format(task_id)', '"Failed to resolve channel"'), TC, 'says why');
runMutationTest('The server counts a hyphen as part of a word', SRC('omnitrack/utils/validators.py'),
  (code) => code.replace('("\\u2022", "-", "*",', '("\\u2022", "*",'), SLT, 'test_counted_as_the_page_counts_them');
runMutationTest('The server lets an older copy replace the log', SRC('omnitrack/utils/session_lines.py'),
  (code) => code.replace('if int(stored.get("linesRev") or 0) <= int(incoming.get("linesRev") or 0):', 'if True:'), SLT, 'test_an_older_copy_keeps_the_stored_log');
runMutationTest('The server keeps an old log for a new session', SRC('omnitrack/utils/session_lines.py'),
  (code) => code.replace(' or int(stored.get("startTime") or 0) != int(incoming.get("startTime") or 0):', ':'), SLT, 'test_a_different_session_or_none_stored_is_stored');
runMutationTest('The sync skips the newer-log check', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('\tclean_data = keep_newer_lines(get_active_session(user=target_user), clean_data)\n', ''), SLT, 'test_every_sync_goes_through_it');

const PR = 'node scripts/check_prompts.mjs';
runMutationTest('When did you start? focuses the planned start', SRC('src/components/dialogs/StartTimeChoiceModal.vue'),
  (code) => code.replace('          data-autofocus\n          data-start-now', '          data-start-now'), PR, 'Just now is the answer focus starts on');
runMutationTest('Just now starts from the planned start', SRC('src/components/dialogs/StartTimeChoiceModal.vue'),
  (code) => code.replace("@click=\"$emit('select', null)\"", "@click=\"$emit('select', plannedStartMs)\""), PR, 'Just now starts from the moment');
runMutationTest('When did you start? grows its option cards back', SRC('src/components/dialogs/StartTimeChoiceModal.vue'),
  (code) => code.replace('<template #actions>', '<button v-for="opt in [1]" :key="opt" type="button">Option</button>\n    <template #actions>'), PR, 'not a list of option cards');
runMutationTest('An answer to When did you start? drops its time', WSM,
  (code) => code.replace('if (typeof trackBlock === \'function\') trackBlock(blk, epoch);', 'if (typeof trackBlock === \'function\') trackBlock(blk);'), PR, 'At the planned start starts the block');
runMutationTest('The day review grows Log all back', SRC('src/components/dialogs/EODWrapUpModal.vue'),
  (code) => code.replace('emits: ["update:modelValue", "log-block"]', 'emits: ["update:modelValue", "log-block", "convert-all"]'), PR, 'its only answers are Done');
runMutationTest('A block left unlogged is logged as its plan', SRC('src/composables/useWorkstationAttendance.js'),
  (code) => code.replace('    w.openEditSessionModal(block);\n', "    postJSON('convert_plan_to_actual', { block_name: block.name, session_notes: block.deliverable_notes || 'Done' });\n"), PR, 'no plan written in as the work');
runMutationTest('Log opens the entry box over the day review', SRC('src/composables/useWorkstationAttendance.js'),
  (code) => code.replace('    showEODModal.value = false;\n    w.openEditSessionModal(block);', '    w.openEditSessionModal(block);'), PR, 'one dialog at a time');
runMutationTest('Clicking a notification answers the still-working question', SRC('src/composables/useWorkstationAudioSync.js'),
  (code) => code.replace('try { window.focus(); } catch (e) {}', "try { window.focus(); window.dispatchEvent(new CustomEvent('omnitrack:confirmStillWorking')); confirmStillWorking(); } catch (e) {}"), PR, 'never answers the still-working question');
runMutationTest('The overrun notification asks what it cannot take an answer to', SRC('src/composables/useWorkstationAudioSync.js'),
  (code) => code.replace('The session is still running.`;', 'Wrap up or continue?`;'), PR, 'it asks nothing');
runMutationTest('The overrun notification reads as the still-working question', SRC('src/composables/useWorkstationAudioSync.js'),
  (code) => code.replace("dispatchInactivityNotification(msg, 'omnitrack-block-overrun', 'OmniTrack: Planned block ended');", "dispatchInactivityNotification(msg, 'omnitrack-block-overrun');"), PR, 'its own heading');
runMutationTest('The runaway options-plus-Apply dialog comes back', SRC('src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace('    <EODWrapUpModal\n', '    <RunawayTimerModal :model-value="false" />\n    <EODWrapUpModal\n'), PR, 'the runaway options-plus-Apply dialog is gone');

runMutationTest('App.vue hands the start-time question its block under a name it does not declare', SRC('src/App.vue'),
  (code) => code.replace(':pending-start-block="pendingStartBlock"', ':pending-block="pendingStartBlock"'), 'node scripts/check_app_bindings.cjs', 'bindings it does not declare');

// One switch dialog: picked in place, Switch waits, a refusal keeps the session and says why
const SWM = 'src/components/dialogs/WrapAndStartNextModal.vue', SWA = 'src/composables/useWorkstationAttendance.js';
runMutationTest('Switch can be pressed with nothing picked', SRC(SWM),
  (code) => code.replace('return !!this.targetItem && this.enoughWords && !this.isSwitching;', 'return this.enoughWords && !this.isSwitching;'), SD, 'Switch waits for a target');
runMutationTest('Switch ignores a log too short to save', SRC(SWM),
  (code) => code.replace('return !!this.targetItem && this.enoughWords && !this.isSwitching;', 'return !!this.targetItem && !this.isSwitching;'), SD, 'Switch waits');
runMutationTest('The last line does not count toward the words', SRC(SWM),
  (code) => code.replace('return this.logWords + countSessionWords(this.wrapUpNote);', 'return this.logWords;'), SD, "last line's words count");
runMutationTest('Focus skips the open question', SRC(SWM),
  (code) => code.replace('if (this.pick && !this.targetItem) return "pick";', ''), SD, 'focus starts on what starts next');
runMutationTest('The title jumps once a target is picked', SRC(SWM),
  (code) => code.replace('if (this.pick) return "What are you switching to?";', 'if (this.pick && !this.targetItem) return "What are you switching to?";'), SD, 'the title stays put');
runMutationTest('A block option drops its clock times', SRC(SWM),
  (code) => code.replace('description: this.details(t)', 'description: t.project'), SD, 'says when, as a clock');
runMutationTest('A refusal is not said in the dialog', SRC(SWM),
  (code) => code.replace('<p v-if="error" role="alert"', '<p v-if="error"'), SD, 'said in place');
runMutationTest('A refusal closes the dialog', SRC(SWA),
  (code) => code.replace('if (await executeSwitchTask(switchTargetItem.value)) {', 'await executeSwitchTask(switchTargetItem.value); {'), SD, 'refused: the dialog stays open');
runMutationTest('A refusal is only a toast', SRC(SWA),
  (code) => code.replace("switchError.value = String((err && err.message) || err || '');", "showToast(String(err), 'danger');"), SD, 'refused: it says why');
runMutationTest('An edit leaves the old refusal up', SRC(SWA),
  (code) => code.replace("watch([switchWrapUpNote, switchTargetItem], () => { switchError.value = ''; });", ''), SD, 'an edit clears the refusal');
runMutationTest("The session's tasks are dropped on a switch", SRC(SWA),
  (code) => code.replace(/,\n\s*session_tasks: JSON\.stringify\([^\n]*\n/, '\n'), SD, "the session's tasks go with it");
runMutationTest('The next session inherits the last one\'s tasks', SRC(SWA),
  (code) => code.replace('if (w.sessionTasks) w.sessionTasks.value = [];', ''), SD, 'starts with no tasks');
runMutationTest('The running block is offered as the next one', SRC(SWA),
  (code) => code.replace("b.name !== curBlock && ", ''), SD, 'the running block is not offered');
runMutationTest('Switch opens over the session popup', SRC(SWA),
  (code) => code.replace('if (isSessionElevated.value) isSessionElevated.value = false;\n    openSwitch(null, true);', 'openSwitch(null, true);'), SD, 'closes the session popup');
runMutationTest('The Switch button opens the old list', SRC('src/views/dashboard/DashboardHappeningNow.vue'),
  (code) => code.replace('@click.stop="openSwitchPicker"', '@click.stop="openSwitchTaskModal"'), SD, 'opens the switch dialog to pick in');
runMutationTest('Switch offered with nothing to switch to', SRC('src/views/dashboard/DashboardHappeningNow.vue'),
  (code) => code.replace('<Button v-if="switchCandidates.length" variant="ghost" icon="repeat"', '<Button variant="ghost" icon="repeat"'), SD, 'a question with no answer');
runMutationTest('The switch invents a note again', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('\t\t\tnotes=current_session_notes,\n\t\t\tlogged_via="Stopwatch"', '\t\t\tnotes=current_session_notes or "Switched to another task",\n\t\t\tlogged_via="Stopwatch"'), SD, 'never an invented note');
runMutationTest('A session on no block is dropped by a switch', SRC('omnitrack/api/stopwatch.py'),
  (code) => code.replace('\telif start_ms > 0:\n', '\telif False:\n'), SD, 'on no block is saved');

// Which days can be logged (scripts/check_log_window.mjs)
const LW = 'node scripts/check_log_window.mjs';
const TSE = SRC('src/utils/timesheetEntry.js');
runMutationTest('Today stops counting as day 1', TSE,
  (code) => code.replace('now.getDate() - (days - 1)', 'now.getDate() - days'), LW, 'the 16th day back');
runMutationTest('The window falls back to two days again', TSE,
  (code) => code.replace('const days = Math.max(1, Number(daysBack) || 15);', 'const days = Math.max(1, Number(daysBack) || 2);'), LW, 'the 15-day default');
runMutationTest('The payroll day itself stays open', TSE,
  (code) => code.replace('if (closed && day <= closed) {', 'if (closed && day < closed) {'), LW, 'the day payroll is closed through');
runMutationTest('A manager edits paid time on the client', TSE,
  (code) => code.replace("  if (isManager) return \"\";\n  const days", "  const days").replace('const closed = payrollClosedThrough', 'if (isManager) return "";\n  const closed = payrollClosedThrough'), LW, 'a manager on a closed day');
runMutationTest('The window lets any day through', TSE,
  (code) => code.replace('if (day < firstISO) {', 'if (false) {'), LW, 'the 16th day back');
runMutationTest('The block menu ignores the window again', SRC('src/composables/useWorkstationPlannerState.js'),
  (code) => code.replace('const canLogTimesheet = (b) => !!b && !logWindowRefusal(', 'const canLogTimesheet = (b) => !!b || !logWindowRefusal('), LW, 'canLogTimesheet uses logWindowRefusal');
runMutationTest('The entry box forgets the payroll date', SRC('src/composables/useWorkstationPlannerState.js'),
  (code) => code.replace('payrollClosedThrough: payrollClosedThrough.value,', 'payrollClosedThrough: "",'), LW, 'passes the window, the payroll date');
runMutationTest('Save works on a closed day', SRC('src/session/useSessionEntry.js'),
  (code) => code.replace('!!entry.value.session_date && !props.dayRefusal &&', '!!entry.value.session_date &&'), LW, 'Save waits');
runMutationTest('The server refusal goes unsaid in the box', SRC('src/session/useSessionEntry.js'),
  (code) => code.replace(" || props.saveError || ''", " || ''"), LW, 'one reason at a time');
runMutationTest('The entry never asks about its day', SRC('src/components/dialogs/WorkSessionEntry.vue'),
  (code) => code.replace(':day-refusal="dayRefusal"', ''), LW, "hands the day's refusal");
runMutationTest('A refused save is a toast behind the box again', SRC('src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("refuse(extractErrorMessage(e, 'Not saved. Try again.'));", "showToast(extractErrorMessage(e, 'Could not save this work session'), 'danger');"), LW, 'never a toast');
runMutationTest('An old refusal greets a new entry', SRC('src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("editSessionTargetBlock.value = block;\n    editSessionError.value = '';", 'editSessionTargetBlock.value = block;'), LW, 'starts with no old refusal');
runMutationTest('Managers skip the payroll lock', SRC('omnitrack/permissions.py'),
  (code) => code.replace('\tcheck_payroll_open(session_date)\n\tif is_omnitrack_manager(user):\n\t\treturn True\n', '\tif is_omnitrack_manager(user):\n\t\treturn True\n\tcheck_payroll_open(session_date)\n'), LW, 'payroll before the manager exemption');
runMutationTest('The server window falls back to 48 hours', SRC('omnitrack/permissions.py'),
  (code) => code.replace('DEFAULT_LOG_DAYS_BACK = 15\n', 'DEFAULT_LOG_DAYS_BACK = 2\n'), LW, 'defaults to 15 days');
runMutationTest('The server leaves the payroll day open', SRC('omnitrack/permissions.py'),
  (code) => code.replace('getdate(target_date) <= closed:', 'getdate(target_date) < closed:'), LW, 'the payroll date itself is closed');
runMutationTest('An empty payroll date reads as closed through 0001-01-01', SRC('omnitrack/permissions.py'),
  (code) => code.replace('return closed if closed and closed.year > 1 else None', 'return closed'), LW, 'means not set');
runMutationTest('An ERPNext Timesheet keeps its own copy of the window', SRC('omnitrack/permissions.py'),
  (code) => code.replace('\tfor d in _timesheet_dates(doc):\n\t\tcheck_timesheet_date_permission(d)\n\n\nCLIENT_ROLES', '\tpass\n\n\nCLIENT_ROLES'), LW, 'validate_timesheet_trash_event');
runMutationTest('A session moves out of a closed payroll period', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('\t\tcheck_timesheet_date_permission(sess_row.session_date, frappe.session.user)\n', '\t\tpass\n'), LW, 'the day the session leaves');
runMutationTest('Delete checks the block day, not the session day', SRC('omnitrack/api/timesheet.py'),
  (code) => code.replace('base_date = (row and row.session_date) or doc.work_date or nowdate()', 'base_date = doc.work_date or nowdate()'), LW, "the session's own day");
runMutationTest('Approving a paid-out block is refused', SRC('omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.py'),
  (code) => code.replace('if prev is None or row(prev) != row(sess):', 'if True:'), LW, 'can still be approved');
runMutationTest('Removing a paid session goes unchecked', SRC('omnitrack/omnitrack/doctype/planned_work_block/planned_work_block.py'),
  (code) => code.replace('\t\ttouched += [r.session_date for r in old.values()]\n', ''), LW, "removed session's day");
runMutationTest('Any OmniTrack Manager moves the payroll date', SRC('omnitrack/omnitrack/doctype/omnitrack_settings/omnitrack_settings.json'),
  (code) => code.replace('"role": "OmniTrack Manager",\n      "permlevel": 1,\n      "read": 1,\n      "write": 0', '"role": "OmniTrack Manager",\n      "permlevel": 1,\n      "read": 1,\n      "write": 1'), LW, 'only HR and System Manager');
runMutationTest('HR cannot set the payroll date', SRC('omnitrack/omnitrack/doctype/omnitrack_settings/omnitrack_settings.json'),
  (code) => code.replace('"role": "HR Manager",\n      "permlevel": 1,\n      "read": 1,\n      "write": 1', '"role": "HR Manager",\n      "permlevel": 1,\n      "read": 1,\n      "write": 0'), LW, 'HR Manager sets payroll_closed_through');
runMutationTest('The payroll date is a level-0 field anyone with Settings edits', SRC('omnitrack/omnitrack/doctype/omnitrack_settings/omnitrack_settings.json'),
  (code) => code.replace('"label": "Payroll closed through",\n      "permlevel": 1,', '"label": "Payroll closed through",'), LW, 'payroll_closed_through is a Date at permlevel 1');
runMutationTest('The app never hears the payroll date', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('"payroll_closed_through": str(closed) if closed else None,', ''), LW, 'the planner payload carries both');
runMutationTest('The hours-to-days patch is not run', SRC('omnitrack/patches.txt'),
  (code) => code.replace('omnitrack.patches.v1_5.log_days_back\n', ''), LW, 'the patch moving hours to days');

// Refused dialogs say why inside themselves; cancel asks for a real reason (scripts/check_dialog_refusals.mjs)
const DR = 'node scripts/check_dialog_refusals.mjs';
runMutationTest('Cancel presets a reason again', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace("cancelForm.value = { reason: '', notes: '' };", "cancelForm.value = { reason: 'Internal Priority Shift', notes: '' };"), DR, 'starts with no reason');
runMutationTest('Cancel offers a reason the server refuses', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace("    'Dependency Blocked',\n", "    'Blocked by Dependency',\n"), DR, "cancel_reason's options");
runMutationTest('Cancel writes into the running session again', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace("    if (!blk || !reason) return;\n", "    if (!blk || !reason) return;\n    if (discardSession) discardSession();\n"), DR, 'writes into no session');
runMutationTest('A refused cancel is a toast behind the dialog', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace("cancelError.value = msg && msg !== 'Request failed' ? msg : 'Try again.';", "showToast('Could not cancel block: ' + msg, 'danger');"), DR, 'submitCancelBlock says why in the dialog');
runMutationTest('The cancel note never reaches the server', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace(",\n        cancel_note: (cancelForm.value.notes || '').trim()", ''), DR, 'the note goes to the server');
runMutationTest('Cancel block works with no reason', SRC('src/components/dialogs/CancelWorkBlockModal.vue'),
  (code) => code.replace(':disabled="!cancelForm.reason || busy"', ':disabled="busy"'), DR, 'waits until a reason is picked');
runMutationTest('The cancel title is a label, not a question', SRC('src/components/dialogs/CancelWorkBlockModal.vue'),
  (code) => code.replace('title="Cancel this block?"', 'title="Cancel Work Block"'), DR, 'the title is the question');
runMutationTest('The cancel refusal is never shown', SRC('src/components/dialogs/CancelWorkBlockModal.vue'),
  (code) => code.replace('<p v-if="error" role="alert" class="text-sm text-ink-red-4">Not cancelled. {{ error }}</p>', ''), DR, 'role="alert" inside the dialog');
runMutationTest('The cancel dialog never hears the refusal', SRC('src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace(':error="cancelError"', ''), DR, 'the cancel dialog gets the refusal');
runMutationTest('The server drops the cancel note', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\t\tdoc.add_comment("Comment", text=frappe.utils.escape_html(note))\n', '\t\tpass\n'), DR, "the note goes on the block's activity");
runMutationTest('The cancel note goes on the activity unescaped', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('text=frappe.utils.escape_html(note)', 'text=note'), DR, 'escaped');
runMutationTest('Delete asks with the browser confirm() again', SRC('src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("    deleteEntryError.value = '';\n    deleteEntry.value = { block: block || null, session };", "    if (!confirm('Delete work session?')) return;\n    deleteEntryError.value = '';\n    deleteEntry.value = { block: block || null, session };"), DR, 'no browser confirm()');
runMutationTest('A refused delete is a toast', SRC('src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace("deleteEntryError.value = extractErrorMessage(e, 'Try again.');", "showToast(extractErrorMessage(e, 'Failed to delete work session'), 'danger');"), DR, 'deleteSessionEntry says why in the dialog');
runMutationTest('Enter deletes the entry', SRC('src/components/dialogs/DeleteEntryDialog.vue'),
  (code) => code.replace('<Button variant="ghost" label="Keep entry" data-autofocus', '<Button variant="ghost" label="Keep entry"').replace('theme="red" label="Delete entry"', 'theme="red" data-autofocus label="Delete entry"'), DR, 'focus starts on Keep entry');
runMutationTest('The delete dialog is never mounted', SRC('src/App.vue'),
  (code) => code.replace('<DeleteEntryDialog />', ''), DR, 'App mounts DeleteEntryDialog');
runMutationTest('A refused task save is a toast again', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace("this.error = 'Not saved. ' + this.extractErrorMessage(e, 'Try again.');", "this.showToast('Could not save this task: ' + (e && e.message || e), 'danger');"), DR, 'save says why in the dialog');
runMutationTest('A refused workflow move is a toast again', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace("this.error = 'Not moved. ' + this.extractErrorMessage(e, 'Try again.');", "this.showToast('Could not move this task: ' + (e && e.message || e), 'danger');"), DR, 'a workflow move says why in the dialog');
runMutationTest('A task that will not open closes the form', SRC('src/components/dialogs/TaskFormDialog.vue'),
  (code) => code.replace("this.error = 'Could not open this task. ' + this.extractErrorMessage(e, 'Try again.');", "this.error = 'Could not open this task.';\n        closeTaskForm();"), DR, 'not a toast and a closed form');
runMutationTest('A refused block edit is a toast again', SRC('src/drawers/EditBlockDialog.vue'),
  (code) => code.replace("this.error = this.extractErrorMessage(e, 'Try again.');", "this.showToast('Could not save this block: ' + (e && e.message || e), 'danger');"), DR, 'Edit block says why in the dialog');
runMutationTest('A refused Add tasks is never shown', SRC('src/drawers/AddBlockTasksDialog.vue'),
  (code) => code.replace('<p v-if="error" role="alert" class="mt-3 text-sm text-ink-red-4">Not added. {{ error }}</p>', ''), DR, 'Add tasks: the refusal shows');
runMutationTest('A refused reschedule is a toast again', SRC('src/composables/useWorkstationFocusTasks.js'),
  (code) => code.replace("return w.extractErrorMessage(e, 'Try again.');", "showToast('Could not reschedule block: ' + (e && e.message || e), 'danger');\n      return 'x';"), DR, 'submitReschedule says why in the dialog');
runMutationTest('Reschedule drops the refusal', SRC('src/drawers/RescheduleBlockDialog.vue'),
  (code) => code.replace('this.error = await this.submitReschedule({ ...this.form });', 'await this.submitReschedule({ ...this.form });'), DR, 'Reschedule keeps what submitReschedule says');
runMutationTest('A refused plan is a toast again', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace("      const msg = e && e.message;\n      bookError.value = msg && msg !== 'Request failed' ? msg : 'Try again.';", "      showToast('Could not plan this time: ' + (e && e.message || e), 'danger');"), DR, 'submitBooking says why in the Plan dialog');
runMutationTest('An old plan refusal greets a new plan', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace("    bookError.value = '';\n    showBookModal.value = true;", '    showBookModal.value = true;'), DR, 'starts with no old refusal');
runMutationTest('The Plan dialog never hears the refusal', SRC('src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace(':error="bookError"', ''), DR, 'the Plan dialog gets the refusal');
runMutationTest('A failed drag freezes the page with alert()', SRC('src/composables/useWorkstationPlannerDrag.js'),
  (code) => code.replace("showToast('Not moved. ' + extractErrorMessage(e, 'Try again.'), 'danger');", "alert('Could not reschedule block: ' + (e && e.message || e));"), DR, 'no browser confirm() or alert()');

// The FAC (MCP) tools keep the page's rules (scripts/check_fac_tools.mjs)
const FT_ = 'node scripts/check_fac_tools.mjs';
runMutationTest('FAC log invents half an hour again', FACPY,
  (code) => code.replace('\tif dur_hours <= 0:\n\t\tfrappe.throw(_("Not logged. Say how long: hours, or from_time and to_time."), frappe.ValidationError)\n', '\tif dur_hours <= 0:\n\t\tdur_hours = 0.5\n'), FT_, 'log_work_session invents no length');
runMutationTest('FAC log puts a new block at 09:00 again', FACPY,
  (code) => code.replace('\t\t\tstart_t = _time_str(from_time)\n', '\t\t\tstart_t = _time_str(from_time) if from_time else "09:00:00"\n'), FT_, 'no block is put at 09:00 or 10:00');
runMutationTest('FAC log guesses a block with no task or project', FACPY,
  (code) => code.replace('if match_existing_block and (task or project):', 'if match_existing_block:'), FT_, 'joins a block only by its task or project');
runMutationTest('FAC log joins a cancelled block', FACPY,
  (code) => code.replace('"status": ["not in", ("Cancelled", "Rescheduled")]', '"status": ["!=", "Rescheduled"]'), FT_, 'never joins a cancelled');
runMutationTest('FAC log checks the window for the employee, not the asker', FACPY,
  (code) => code.replace('check_timesheet_date_permission(target_date, frappe.session.user)', 'check_timesheet_date_permission(target_date, target_user)'), FT_, 'for whoever is asking');
runMutationTest('FAC quick task books a block with no start', FACPY,
  (code) => code.replace('\t\tif not block_start:\n\t\t\tfrappe.throw(', '\t\tif not block_start:\n\t\t\tblock_start = "10:00:00"\n\t\tif False:\n\t\t\tfrappe.throw('), FT_, 'needs its start');
runMutationTest('FAC start throws away a running session again', FACPY,
  (code) => code.replace('\t\tif running and running.get("status") == "active":\n', '\t\tif False:\n'), FT_, 'start refuses while a session runs');
runMutationTest('FAC start saves its title twice again', FACPY,
  (code) => code.replace('"trackerNotes": title,', '"trackerNotes": raw_notes,'), FT_, 'keeps the title apart');
runMutationTest('FAC start reads a bad time as now', FACPY,
  (code) => code.replace('\t\t\t\tfrappe.throw(_("Not started. {0} is not a time; send HH:MM:SS.").format(start_time), frappe.ValidationError)\n', '\t\t\t\tstart_ms = None\n'), FT_, 'an unreadable start_time is refused');
runMutationTest('FAC stop drops the session log again', FACPY,
  (code) => code.replace('compose_wrap_note(active.get("trackerNotes"), active.get("sessionNotesList"), notes)', 'notes'), FT_, 'stop saves the title, the log lines');
runMutationTest('FAC stop saves on today, not the start day', FACPY,
  (code) => code.replace('session_date=start_dt.strftime("%Y-%m-%d"),', 'session_date=nowdate(),'), FT_, 'the day the session started');
runMutationTest('FAC stop moves the time onto a matched block', FACPY,
  (code) => code.replace('\t\t\tmatch_existing_block=False,\n', ''), FT_, 'never moves the time onto another block');
runMutationTest('FAC switch drops the session log again', FACPY,
  (code) => code.replace('compose_wrap_note(active.get("trackerNotes"), active.get("sessionNotesList"), current_session_notes) if running else current_session_notes', 'current_session_notes'), FT_, 'switch saves the title');
runMutationTest('FAC switch starts nothing in particular', FACPY,
  (code) => code.replace('\tif not (target_block or target_task):\n\t\tfrappe.throw(', '\tif False:\n\t\tfrappe.throw('), FT_, 'switch needs what comes next');
runMutationTest('FAC add_note replaces the title again', FACPY,
  (code) => code.replace('\t\tactive["sessionNotesList"] = lines\n', '\t\tactive["sessionNotesList"] = lines\n\t\tactive["trackerNotes"] = new_line\n'), FT_, 'never replaces the title');
runMutationTest('FAC add_note is held to 3 characters again', FACPY,
  (code) => code.replace('\t\tmin_chars = get_min_log_line_chars()\n', '\t\tmin_chars = 3\n'), FT_, 'Minimum Characters per Log Line');
runMutationTest('FAC add_note is not stamped newest', FACPY,
  (code) => code.replace('\t\tactive["linesRev"] = int(datetime.now().timestamp() * 1000)\n', ''), FT_, 'stamped newest');
runMutationTest('FAC discard says success with nothing running', FACPY,
  (code) => code.replace('frappe.throw(_("Nothing to discard: no session is running."), frappe.ValidationError)', 'return {"status": "success"}'), FT_, 'discard with nothing running');
runMutationTest('FAC adjust moves sessions to today again', FACPY,
  (code) => code.replace('\t\tsession_date=session_date or None,\n', '\t\tsession_date=session_date or nowdate(),\n'), FT_, 'adjust keeps the session');
runMutationTest('FAC workspace keeps the log rules to itself', FACPY,
  (code) => code.replace('\t\t"log_rules": get_log_rules(),\n', ''), FT_, 'returns log_rules');
runMutationTest('FAC log rules leave out the payroll date', FACPY,
  (code) => code.replace('"payroll_closed_through":', '"payroll":'), FT_, 'payroll_closed_through');
runMutationTest('FAC schedule has no cancel', FACPY,
  (code) => code.replace('\telif act == "cancel":\n', '\telif act == "cancel_block_unused":\n'), FT_, "omnitrack_schedule cancels");
runMutationTest('FAC schedule tool hides cancel', FACPY,
  (code) => code.replace('"approve", "update", "get_block", "cancel"]', '"approve"]'), FT_, 'offers every action');
runMutationTest('FAC cancel reason is any string again', FACPY,
  (code) => code.replace('"cancel_reason": {"type": "string", "enum": CANCEL_REASONS, "description": "For \'cancel\': why, the person\'s pick."}', '"cancel_reason": {"type": "string", "description": "For \'cancel\': why."}'), FT_, "cancel_reason is the DocType's options");
runMutationTest('FAC cancel needs no reason', FACPY,
  (code) => code.replace('"required": ["block_name", "cancel_reason"]', '"required": ["block_name"]'), FT_, 'needs a block and a reason');
runMutationTest('FAC update drops the cancel note', FACPY,
  (code) => code.replace('\t\tcancel_note=cancel_note\n\t)\n\n\ndef cancel_work_block_reasons', '\t)\n\n\ndef cancel_work_block_reasons'), FT_, 'passes the note on');
runMutationTest('FAC delete stops asking first', FACPY,
  (code) => code.replace('"Ask the person first, naming the entry (its day, times and notes), and call only after their yes. "', '""'), FT_, 'OmniTrackDeleteWorkSessionTool tells the assistant to ask');
runMutationTest('FAC tools tell the old two-day rule again', FACPY,
  (code) => code.replace('"Only to move it to another day (YYYY-MM-DD); omit to keep its day."', '"Work date (YYYY-MM-DD). Regular users can only adjust today and yesterday."'), FT_, 'no outdated rule');
runMutationTest('The cancel tool is not registered', SRC('omnitrack/hooks.py'),
  (code) => code.replace('\t"omnitrack.fac.OmniTrackCancelWorkBlockTool",\n', ''), FT_, 'the cancel tool is registered');
runMutationTest('A past block is cancelled again', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\tif block_date < today:\n\t\tfrappe.throw(', '\tif False:\n\t\tfrappe.throw('), FT_, 'a past block is not cancelled');
runMutationTest('Any cancel reason is taken', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\tif cancel_reason not in reasons:\n\t\tfrappe.throw(', '\tif False:\n\t\tfrappe.throw('), FT_, "only the DocType's reasons");
runMutationTest('A recording block is cancelled', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('active.get("status") == "active" and active.get("trackerBlockName") == doc.name:', 'False:'), FT_, 'a block a session records on');
runMutationTest('update_work_block skips the cancel checks', SRC('omnitrack/api/planner.py'),
  (code) => code.replace('\tif status == "Cancelled":\n\t\t_check_cancellable(doc, cancel_reason)\n', ''), FT_, 'checks every cancel');
runMutationTest('The FAC guide tells the old 3-character rule', SRC('docs/OMNITRACK_FAC_INTEGRATION.md'),
  (code) => code.replace('at least **Minimum Words per Session** (default 15) words.', 'at least 3 characters.'), FT_, 'the FAC guide');
runMutationTest('JS composeWrapNote keeps a blank line', SRC('src/utils/wrapNote.js'),
  (code) => code.replace(/\.filter\(Boolean\)/, '.filter((x) => x !== undefined)'), FT_, 'as compose_wrap_note does');
runMutationTest('Python compose_wrap_note keeps a blank line', SRC('omnitrack/utils/session_lines.py'),
  (code) => code.replace('for p in lines if p)', 'for p in lines)'), SLT, 'test_same_notes_as_the_page');

// A plan is for time still to come (scripts/check_plan_window.mjs, test_unit_governance.TestPlanWindow)
const PW = 'node scripts/check_plan_window.mjs';
const GOV = `${path.resolve(appDir, '../../env/bin/python')} -m unittest omnitrack.tests.test_unit_governance`;
const PWJS = SRC('src/utils/planWindow.js');
const PERMS = SRC('omnitrack/permissions.py');
runMutationTest('JS plans an earlier day again', PWJS,
  (code) => code.replace('if (day < today) return PLAN_PAST;', ''), PW, 'yesterday');
runMutationTest('JS plans on the payroll day itself', PWJS,
  (code) => code.replace('if (closed && day <= closed) {', 'if (closed && day < closed) {'), PW, 'the day payroll is closed through');
runMutationTest('JS plans a slot already over', PWJS,
  (code) => code.replace('if (e <= now.getHours() * 60 + now.getMinutes()) return PLAN_OVER;', ''), PW, 'today, ended at now');
runMutationTest('JS reads an overnight end as over', PWJS,
  (code) => code.replace('if (e <= s) e += 24 * 60;', ''), PW, 'today, ending the next morning');
runMutationTest('JS says the slot words differently', PWJS,
  (code) => code.replace('"That time is over. Plan from now on, or log it as time worked."', '"That time is over."'), PW, 'as src/utils/planWindow.js does');
runMutationTest('Python plans an earlier day again', PERMS,
  (code) => code.replace('\tif day < today:\n\t\treturn _(', '\tif False:\n\t\treturn _('), GOV, 'test_earlier_days_are_logged_not_planned');
runMutationTest('Python plans on the payroll day itself', PERMS,
  (code) => code.replace('if closed and day <= closed:', 'if closed and day < closed:'), GOV, 'test_never_on_a_closed_payroll_day');
runMutationTest('Python plans a slot already over', PERMS,
  (code) => code.replace('if end <= now.hour * 60 + now.minute:', 'if False:'), GOV, 'test_today_from_now_on');
runMutationTest('Python reads an overnight end as over', PERMS,
  (code) => code.replace('\t\tif end <= start:\n\t\t\tend += 24 * 60\n', ''), GOV, 'test_today_from_now_on');
runMutationTest('check_plan_date lets a refusal through', PERMS,
  (code) => code.replace('\tif refusal:\n\t\tfrappe.throw(refusal, frappe.ValidationError)', '\tif False:\n\t\tfrappe.throw(refusal, frappe.ValidationError)'), GOV, 'test_check_plan_date_refuses_with_the_reason');
runMutationTest('Python says the past-day words differently', PERMS,
  (code) => code.replace('"You can plan from today on. Time already worked is logged, not planned."', '"You can plan from today on."'), PW, 'as src/utils/planWindow.js does');
const PLN = SRC('omnitrack/api/planner.py');
runMutationTest('book_work_block plans the past again', PLN,
  (code) => code.replace('\t\tcheck_plan_date(work_date or nowdate(), start_time, end_time)', '\t\tpass'), PW, 'book_work_block');
runMutationTest('book_work_block checks logged time too', PLN,
  (code) => code.replace('if not frappe.flags.omnitrack_block_for_logged_time:', 'if True:'), PW, 'unless it holds logged time');
runMutationTest('create_planned_work_block plans the past again', PLN,
  (code) => code.replace('check_plan_date(doc.work_date, doc.start_time, doc.end_time)', 'pass'), PW, 'create_planned_work_block');
runMutationTest('update_work_block moves into the past again', PLN,
  (code) => code.replace('check_plan_date(work_date or doc.work_date, start_time or doc.start_time, end_time or doc.end_time)', 'pass'), PW, 'update_work_block');
runMutationTest('reschedule_work_block moves into the past again', PLN,
  (code) => code.replace('check_plan_date(target_date, target_start, target_end)', 'pass'), PW, 'reschedule_work_block');
runMutationTest('Carrying tasks over lands in the past again', SRC('omnitrack/api/tasks.py'),
  (code) => code.replace('\tcheck_plan_date(target_date, start_at, end_at)', '\tpass'), PW, 'reschedule_unfinished_tasks: check_plan_date');
runMutationTest('Carrying tasks over keeps a slot already over', SRC('omnitrack/api/tasks.py'),
  (code) => code.replace('\t\tif plan_refusal(target_date, start_at, end_at):\n', '\t\tif False:\n'), PW, 'carries to tomorrow');
runMutationTest('The logged-time flag is never cleared', SRC('omnitrack/fac.py'),
  (code) => code.replace('\t\t\tfinally:\n\t\t\t\tfrappe.flags.omnitrack_block_for_logged_time = False\n', '\t\t\tfinally:\n\t\t\t\tpass\n'), PW, 'cleared in finally');
runMutationTest('Another caller books a block for logged time', SRC('omnitrack/api/stopwatch.py'),
  (code) => code + '\n\ndef _sneak():\n\tfrappe.flags.omnitrack_block_for_logged_time = True\n', PW, 'only fac.log_work_session');
runMutationTest('The FAC plan tool plans the past again', SRC('omnitrack/fac.py'),
  (code) => code.replace('\t\tcheck_plan_date(target_date, s_time, e_time)', '\t\tpass'), PW, 'plan_work_blocks');
runMutationTest('The FAC plan tool tells the old rule', SRC('omnitrack/fac.py'),
  (code) => code.replace('A plan is for time still to come: refused for an earlier day', 'Cannot plan in the past: refused for an earlier day'), PW, 'tells the assistant the rule');
runMutationTest('The Plan dialog saves a refused day', SRC('src/components/dialogs/PlanWorkBlockDialog.vue'),
  (code) => code.replace('if (this.dayRefusal) return false;', ''), PW, 'Save waits');
runMutationTest('The Plan dialog does not say why', SRC('src/components/dialogs/PlanWorkBlockDialog.vue'),
  (code) => code.replace(/<p v-if="dayRefusal" role="alert"/, '<p v-if="dayRefusal"'), PW, 'as an alert');
runMutationTest('The Plan dialog forgets payroll', SRC('src/components/dialogs/DialogCoordinator.vue'),
  (code) => code.replace(/(<PlanWorkBlockDialog[\s\S]*?):payroll-closed-through="payrollClosedThrough"/, '$1'), PW, 'the Plan dialog gets the payroll date');
runMutationTest('Move block takes a refused day', SRC('src/drawers/RescheduleBlockDialog.vue'),
  (code) => code.replace('&& !this.dayRefusal;', ';'), PW, 'Move block waits');
runMutationTest('submitBooking posts a refused day', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace(/if \(refused\) \{\s*bookError\.value = refused;\s*return;\s*\}/, ''), PW, 'submitBooking refuses');
runMutationTest('The Plan dialog opens on a past day', SRC('src/stores/workBlockStore.js'),
  (code) => code.replace('isISODate(opts.date) && opts.date >= today ? opts.date : today', 'isISODate(opts.date) ? opts.date : today'), PW, 'opens the dialog on today');
runMutationTest('A drag drops into the past', SRC('src/composables/useWorkstationPlannerDrag.js'),
  (code) => code.replace(/if \(refused\) \{\s*await fetchPlannerData\(\);\s*showToast\('Not moved\. ' \+ refused, 'danger'\);\s*return;\s*\}/, ''), PW, 'springs back');

// A session past midnight is drawn on both days, and today moves on at midnight
const LM = 'node scripts/check_live_across_midnight.mjs';
const LSPAN = SRC('src/utils/liveSpan.js');
runMutationTest('The running bar stops at its start day', LSPAN,
  (code) => code.replace('const s = fromBefore ? 0 : ', 'const s = '), LM, 'the next day runs from midnight');
runMutationTest('The running bar runs past midnight on its start day', LSPAN,
  (code) => code.replace('const e = toAfter ? 1440 : ', 'const e = '), LM, 'runs to midnight');
runMutationTest('The running bar shows on a day it never reached', LSPAN,
  (code) => code.replace('if (start >= dayEnd || now <= dayStart || now <= start) return null;', 'if (now <= start) return null;'), LM, 'a day still to come');
runMutationTest('Day at a glance draws the running bar only today', SRC('src/composables/useWorkstationTimeline.js'),
  (code) => code.replace('liveSpanOn(selectedDashboardDate.value || todayDate.value || todayISO(), startTime.value)', 'liveSpanOn(todayDate.value || todayISO(), startTime.value)'), LM, 'part of the session on the day shown');
runMutationTest('Day at a glance stops a night session at the now minute', SRC('src/composables/useWorkstationTimeline.js'),
  (code) => code.replace('const ee = live.toAfter ? 1440 : ', 'const ee = '), LM, 'runs to the end of the day');
runMutationTest('A carried-over bar is rounded at midnight', SRC('src/views/dashboard/DashboardTimeline.vue'),
  (code) => code.replace("r.from_before ? 'rounded-none z-10' : 'rounded-r-none z-10'", "'rounded-r-none z-10'"), LM, 'square at midnight');
runMutationTest('The calendar draws the running bar only on its start day', SRC('src/composables/useWorkstationPlannerLayout.js'),
  (code) => code.replace('? liveSpanOn(iso, startTime.value) : null;', '&& iso === (todayDate.value || todayISO()) ? liveSpanOn(iso, startTime.value) : null;'), LM, 'every day column asks liveSpanOn');
runMutationTest('The calendar hides that the bar crosses midnight', SRC('src/composables/useWorkstationPlannerLayout.js'),
  (code) => code.replace("segment_type: live.fromBefore ? 'head' : live.toAfter ? 'tail' : 'full',", "segment_type: 'full',"), LM, 'reads as a night block does');
runMutationTest('An open page keeps yesterday as today', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace('    todayDate.value = now;\n    if (selectedDashboardDate', '    if (selectedDashboardDate'), LM, 'today moves on');
runMutationTest('The dashboard stays on yesterday at midnight', SRC('src/composables/useWorkstationEod.js'),
  (code) => code.replace('if (selectedDashboardDate.value === was) selectedDashboardDate.value = now;', ''), LM, 'a dashboard on today follows');

// A logged session past midnight is drawn and counted only on the day each part was worked
const SOD = 'node scripts/check_session_on_day.mjs';
const SODU = SRC('src/utils/sessionOnDay.js');
runMutationTest('A session row is drawn on every day its block shows', SODU,
  (code) => code.replace('  if (day === iso) {', '  if (true) {'), SOD, 'not drawn on the next day');
runMutationTest('A night row stops short of midnight', SODU,
  (code) => code.replace('return h === 23 && m === 59 && s === 59 ? 1440 : ', 'return '), SOD, 'runs to midnight');
runMutationTest('An old night row is lost the next morning', SODU,
  (code) => code.replace('if (overnight && nextDay(day) === iso && e > 0) return { s: 0, e };', ''), SOD, 'a single night row on the next day');
runMutationTest('Close your day counts a night block on both days', SODU,
  (code) => code.replace('return Math.round(actual * onDay / total * 100) / 100;', 'return actual;'), SOD, 'blockHoursOn');
runMutationTest('Day at a glance draws every row of a block', SRC('src/composables/useWorkstationTimeline.js'),
  (code) => code.replace('const span = sessionSpanOn(x, bk, selectedDashboardDate.value);', 'const span = sessionSpanOn(x, bk, x.session_date || bk.work_date);'), SOD, 'the part of its session on the day shown');
runMutationTest('Close your day counts block totals', SRC('src/composables/useWorkstationAttendance.js'),
  (code) => code.replace('acc + blockHoursOn(b, dt), 0)', 'acc + flt(b.actual_hours || 0), 0)'), SOD, 'only the hours worked on the day shown');

// Press and drag picks a stretch to plan or log, the same in both views, and a swipe still scrolls
const DPK = 'node scripts/check_drag_pick_range.mjs';
const PTR = SRC('src/utils/pickTimeRange.js');
const PSEL = SRC('src/composables/useWorkstationPlannerSelect.js');
const DTLV = SRC('src/views/dashboard/DashboardTimeline.vue');
runMutationTest('A plan starts in the past', PTR,
  (code) => code.replace('const start = isToday && range.start < nowMin ? (next < range.end ? next : nowMin) : range.start;', 'const start = range.start;'), DPK, 'not in the past');
runMutationTest('Time that has passed can be planned', PTR,
  (code) => code.replace("    if (endsByNow) return { refuse: 'past' };\n", ''), DPK, 'plan time that has passed');
runMutationTest('A log runs into the future', PTR,
  (code) => code.replace('end: isToday ? Math.min(range.end, nowMin) : range.end', 'end: range.end'), DPK, 'a log ends now');
runMutationTest('Time still to come can be logged', PTR,
  (code) => code.replace("  if (startsAfterNow) return { refuse: 'future' };\n", ''), DPK, 'log time still to come');
runMutationTest('The calendar plans every range', PTR,
  (code) => code.replace("want === 'auto' ? (endsByNow ? 'log' : 'plan') : want", "want === 'auto' ? 'plan' : want"), DPK, 'the calendar logs');
runMutationTest('A range can be a single minute', PTR,
  (code) => code.replace('  if (end - start < RANGE_SNAP_MIN) end = start + RANGE_SNAP_MIN;\n', ''), DPK, 'never shorter than 15 minutes');
runMutationTest('The end of the day reads 00:00', PTR,
  (code) => code.replace('Math.min(1439, Math.round(m))', 'Math.min(1440, Math.round(m))'), DPK, 'the end of the day');
runMutationTest('A refused range says nothing', PSEL,
  (code) => code.replace("if (r.refuse) { showToast(PICK_REFUSED[r.refuse], 'warning'); return; }", 'if (r.refuse) return;'), DPK, 'says why');
runMutationTest('A log opens on the dashboard day, not the range day', PSEL,
  (code) => code.replace('w.quickLogTimelineGap({ session_date: iso, from_time', 'w.quickLogTimelineGap({ from_time'), DPK, 'on the day the range is on');
runMutationTest('The quick log ignores the day it is given', SRC('src/composables/useWorkstationSessionModals.js'),
  (code) => code.replace('session_date: gap.session_date || selectedDashboardDate.value', 'session_date: selectedDashboardDate.value'), DPK, 'names its own day');
runMutationTest('The calendar range only plans', PSEL,
  (code) => code.replace("const openBookModalRange = (iso, startMin, endMin) => openPickedRange('auto', iso,", "const openBookModalRange = (iso, startMin, endMin) => openPickedRange('plan', iso,"), DPK, 'logs the past and plans the rest');
runMutationTest('The calendar hour only plans', PSEL,
  (code) => code.replace("openPickedRange('auto', iso, { start: hour * 60", "openPickedRange('plan', iso, { start: hour * 60"), DPK, 'single hour follows the same rule');
runMutationTest('Both lanes plan', PSEL,
  (code) => code.replace("openPickedRange(s.lane === 'planned' ? 'plan' : 'log', s.iso, range)", "openPickedRange('plan', s.iso, range)"), DPK, 'Logged logs it');
runMutationTest('A finger draws at once on Day at a glance', PSEL,
  (code) => code.replace("    _armOnHold(ev, (x) => { triggerHaptic([25]); begin(x); });\n", '    begin(ev.clientX);\n'), DPK, 'a finger is held first');
runMutationTest('A press on a bar draws a range', PSEL,
  (code) => code.replace("if (ev.target && ev.target.closest && ev.target.closest('[data-tl-bar]')) return; // a bar opens itself", ''), DPK, 'opens the bar');
runMutationTest('A cancelled timeline press still opens a dialog', PSEL,
  (code) => code.replace("    if (ev && ev.type === 'pointercancel') return;\n    if (!s || !s.moved || !range) return;\n    _timelineSelEndedAt", "    if (!s || !s.moved || !range) return;\n    _timelineSelEndedAt"), DPK, 'a cancelled or unmoved press');
runMutationTest('A drag ending on a gap also logs the whole gap', PSEL,
  (code) => code.replace('const clickTimelineGap = (g) => {\n    if (_timelineSelJustEnded()) return;\n', 'const clickTimelineGap = (g) => {\n'), DPK, 'does not also log the whole gap');
runMutationTest('A click on a planned bar also plans an hour', PSEL,
  (code) => code.replace('if (_timelineSelJustEnded() || ev.target !== ev.currentTarget) return;', 'if (_timelineSelJustEnded()) return;'), DPK, 'plans that hour');
runMutationTest('Day at a glance blocks every scroll', PSEL,
  (code) => code.replace('if (timelineSel.value && ev.cancelable) ev.preventDefault();', 'if (ev.cancelable) ev.preventDefault();'), DPK, 'only while a held finger is drawing');
runMutationTest('The calendar blocks every scroll', PSEL,
  (code) => code.replace('if ((slotSel.value || w.plannerDrag.value) && ev.cancelable) ev.preventDefault();', 'if (ev.cancelable) ev.preventDefault();'), DPK, 'only while a held finger draws');
runMutationTest('A held finger on the timeline still scrolls', DTLV,
  (code) => code.replace(' @touchmove="onTimelineTouchMove"', ''), DPK, "held finger's moves can draw");
runMutationTest('The timeline takes the page scroll away from a finger', DTLV,
  (code) => code.replace('class="relative h-8 mt-3 cursor-cell select-none', 'class="relative h-8 mt-3 cursor-cell select-none touch-none'), DPK, 'takes a vertical page scroll away');
runMutationTest('The Logged lane cannot draw', DTLV,
  (code) => code.replace(`@pointerdown="startTimelineSel($event, 'logged')"`, ''), DPK, 'the Logged lane draws');
runMutationTest('A logged bar is not marked as a bar', DTLV,
  (code) => code.replace(`:key="'l' + i" data-tl-bar`, `:key="'l' + i"`), DPK, 'a logged bar is marked');
runMutationTest('A gap click skips the drag check', DTLV,
  (code) => code.replace('@click.stop="clickTimelineGap(g)"', '@click.stop="quickLogTimelineGap(g)"'), DPK, "a gap's click goes through");
runMutationTest('A held finger on the calendar still scrolls', SRC('src/views/calendar/CalendarPlannerGrid.vue'),
  (code) => code.replace(' @touchmove="onPlannerTouchMove"', ''), DPK, 'the calendar grid listens for moves');

// Summary Report
console.log('\n===========================================================');
console.log(` Mutation Testing Summary:`);
console.log(`   Total Mutants Tested: ${totalMutants}`);
console.log(`   Killed Mutants (Caught): ${killedMutants}`);
console.log(`   Surviving Mutants (Missed): ${survivingMutants}`);
// Floored, so a single survivor never reads as 100%
const mutationScore = Math.floor((killedMutants / totalMutants) * 1000) / 10;
console.log(`   Mutation Score: ${mutationScore}%`);
console.log('===========================================================\n');

if (survivingMutants > 0) {
  console.error(`FAIL: ${survivingMutants} mutant(s) survived! Harden the test suite.\n`);
  process.exit(1);
} else {
  console.log(`SUCCESS: 100% Mutation Score achieved! The test suite is authentic and robust.\n`);
  process.exit(0);
}
