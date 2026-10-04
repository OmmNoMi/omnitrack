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
const fDropdownMenuPath = path.resolve(omnitrackDir, 'src', 'components', 'common', 'FDropdownMenu.vue');
const calendarViewPath = path.resolve(omnitrackDir, 'src', 'views', 'CalendarView.vue');

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
      if (expectedErrorSubstr && !testOutput.includes(expectedErrorSubstr)) {
        console.warn(`  ⚠️ KILLED with unexpected error signature.`);
      }
      console.log(`  🎯 KILLED: Test turned RED as expected and caught the regression.`);
      killedMutants++;
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

// Mutant 4: FDropdownMenu accessibility Escape key restoration broken
runMutationTest(
  'FDropdownMenu close() bypasses focus restoration',
  fDropdownMenuPath,
  (code) => code.replace('if (restoreFocus) {', 'if (false && restoreFocus) {'),
  'node scripts/test_workstation_interactions.cjs',
  'FAIL: Escape must restore DOM focus to trigger'
);

// Mutant 5: Redundant isProductionEnv badge re-introduced into header (Issue #12)
runMutationTest(
  'Redundant isProductionEnv badge re-introduced into header (Issue #12 regression)',
  appVuePath,
  (code) => code.replace('<span class="font-bold text-sm sm:text-base tracking-tight truncate"', '<span>{{ isProductionEnv ? \'Production\' : \'Local Dev\' }}</span><span class="font-bold text-sm sm:text-base tracking-tight truncate"'),
  'node scripts/test_mobile_navbar.cjs',
  'FAIL: Header must NOT contain the redundant isProductionEnv badge'
);

// Mutant 6: Raven Chat text not collapsed on mobile screens (Issue #12)
runMutationTest(
  'Raven Chat button text fails to collapse on mobile (hidden sm:inline removed)',
  appVuePath,
  (code) => code.replace('<span class="hidden sm:inline">Raven Chat</span>', '<span>Raven Chat</span>'),
  'node scripts/test_mobile_navbar.cjs',
  'FAIL: Raven Chat text must be hidden on mobile'
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
  (code) => code.replaceAll('theme="red"', 'theme="invalid_theme"'),
  'node scripts/test_frappe_ui_planner_tabs.cjs',
  'FAIL: "Overdue" <f-button> must use theme="red"'
);

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
