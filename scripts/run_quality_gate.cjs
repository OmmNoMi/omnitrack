#!/usr/bin/env node
/**
 * OmniTrack Local 3-Pillar Quality Gate (100% Free / Zero Cloud)
 *
 * Runs locally before any push:
 *   Pillar 1: 🛡️ Security (Bandit AST static analysis & injection check)
 *   Pillar 2: ♿ Accessibility (HTML5 spec tree parser, Axe-Core WCAG 2.2 AA, Tier 3 interactions)
 *   Pillar 3: 🧪 Quality & TDD++ (Ruff fatal error linter, Fixtures, Bundle, 100% Mutation score)
 */

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const rootDir = path.resolve(__dirname, '..');
const benchPython = '/Users/ommnomi/frappe-bench/version-16/env/bin/python3';
const pythonBin = fs.existsSync(benchPython) ? benchPython : 'python3';
const ruffBin = fs.existsSync('/Users/ommnomi/frappe-bench/version-16/env/bin/ruff')
  ? '/Users/ommnomi/frappe-bench/version-16/env/bin/ruff'
  : 'ruff';

function runStep(name, cmd) {
  process.stdout.write(`  ⏳ ${name}... `);
  try {
    execSync(cmd, { cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(`\x1b[32mPASSED\x1b[0m\n`);
  } catch (err) {
    process.stdout.write(`\x1b[31mFAILED\x1b[0m\n\n`);
    console.error(`❌ Error in step: ${name}`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

console.log('\n============================================================');
console.log('   OmniTrack Local 3-Pillar Quality Gate (Security, A11y, TDD++)');
console.log('============================================================\n');

// Pillar 1: Security
console.log('🛡️  Pillar 1: Security Scan');
runStep('Bandit AST Static Security Scan (-ll)', `${pythonBin} -m bandit -r omnitrack/ -ll`);

// Pillar 2: Accessibility
console.log('\n♿  Pillar 2: Accessibility & Spec Gate');
runStep('HTML5 Spec Tree Parser (check_www_html.py)', `${pythonBin} scripts/check_www_html.py`);
runStep('Tier 3 Workstation Keyboard & Focus Interactions', 'node scripts/test_workstation_interactions.cjs');
runStep('Axe-Core WCAG 2.2 AA Compliance Audit', 'node scripts/test_axe_wcag.cjs');

// Pillar 3: Code Quality & TDD++
console.log('\n🧪  Pillar 3: Code Quality & TDD++');
runStep('Ruff Python Syntax & Reference Linter', `${ruffBin} check --select E9,F63,F7,F82 omnitrack/`);
runStep('Standalone Workspace Fixture Isolation Tests', `${pythonBin} -m unittest omnitrack.tests.test_workspace_fixtures`);
runStep('Static SPA Checks (undefined refs, view contexts, component registry, file size)', 'npm run --silent test:static');
runStep('Runtime Smoke Test (every tab + dialog, zero console errors)', 'node scripts/test_spa_smoke.cjs');
runStep('Frontend Bundle & Vue Runtime Verification', 'node scripts/test_bundle_and_components.cjs');
runStep('Automated Mutation Testing (100% Score Invariant)', 'node scripts/run_mutation_tests.cjs');

console.log('\n============================================================');
console.log(' \x1b[32m🏆 All 3 Pillars PASSED! Code is 100% verified & safe to push.\x1b[0m');
console.log('============================================================\n');
