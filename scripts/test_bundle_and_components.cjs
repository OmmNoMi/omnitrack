#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert');

console.log('--- Running Tier 2: Frontend Bundle & Vue Runtime Compiler Suite ---');

const omnitrackDir = path.resolve(__dirname, '..');
const bundlePath = path.resolve(omnitrackDir, 'omnitrack', 'public', 'dist', 'omnitrack.bundle.js');
const htmlPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.html');
const pyPath = path.resolve(omnitrackDir, 'omnitrack', 'www', 'omnitrack.py');

// Test 1: Bundle file exists and has non-trivial size
assert.ok(fs.existsSync(bundlePath), 'FAIL: omnitrack.bundle.js does not exist in dist');
const bundleStat = fs.statSync(bundlePath);
assert.ok(bundleStat.size > 100000, `FAIL: Bundle size ${bundleStat.size} is suspiciously small (<100KB)`);
console.log(`✓ Test 1: omnitrack.bundle.js exists (${(bundleStat.size / 1024).toFixed(1)} KB).`);

// Test 2: Bundle exports required globals
const makeEl = (tag) => {
  const el = {
    tagName: tag.toUpperCase(),
    children: [],
    attributes: {},
    setAttribute: (k, v) => { el.attributes[k] = String(v); },
    getAttribute: (k) => el.attributes[k] !== undefined ? el.attributes[k] : null,
    removeAttribute: (k) => { delete el.attributes[k]; },
    appendChild: (child) => { el.children.push(child); return child; },
    removeChild: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {}
  };
  let _html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => _html,
    set: (val) => {
      _html = String(val || '');
      const m = _html.match(/<div\s+foo="([\s\S]*?)">/i);
      if (m) {
        const child = makeEl('div');
        child.setAttribute('foo', m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
        el.children = [child];
      } else {
        el.children = [];
      }
    }
  });
  Object.defineProperty(el, 'textContent', {
    get: () => (_html ? _html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : ''),
    set: (val) => { _html = String(val || ''); }
  });
  return el;
};

const doc = {
  readyState: 'complete',
  addEventListener: () => {},
  createElement: (tag) => makeEl(tag),
  head: makeEl('head'),
  getElementById: () => null
};
const win = {
  document: doc,
  navigator: { userAgent: 'Mozilla/5.0' },
  localStorage: { getItem: () => null, setItem: () => {} },
  addEventListener: () => {}
};
global.window = win;
global.document = doc;
global.navigator = win.navigator;
global.localStorage = win.localStorage;

const bundleCode = fs.readFileSync(bundlePath, 'utf8');
vm.runInThisContext(bundleCode);

assert.ok(window.Vue, 'FAIL: window.Vue must be exported by bundle');
assert.ok(window.FrappeUI, 'FAIL: window.FrappeUI must be exported by bundle');
assert.ok(window.io, 'FAIL: window.io must be exported by bundle');
assert.ok(window.OmniTrackSessionBox, 'FAIL: window.OmniTrackSessionBox must be exported by bundle');
console.log('✓ Test 2: All required globals exported (Vue, FrappeUI, io, OmniTrackSessionBox).');

// Test 3: window.Vue.compile is a genuine runtime compiler, not a dummy no-op stub
assert.strictEqual(typeof window.Vue.compile, 'function', 'FAIL: Vue.compile must be a function');
const compileStr = window.Vue.compile.toString();
assert.ok(!compileStr.includes('()=>{}') && !compileStr.includes('() => {}'), 'FAIL: Vue.compile must NOT be a no-op stub (() => {})');

const testRender = window.Vue.compile('<div>Hello {{ name }}</div>');
assert.strictEqual(typeof testRender, 'function', 'FAIL: Vue.compile must return a render function');
console.log('✓ Test 3: Vue.compile is a genuine runtime template compiler producing render functions.');

// Test 4: omnitrack.html does not load dead / 404 scripts
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
assert.ok(!htmlContent.includes('timesheet_session_box.bundle.js'), 'FAIL: timesheet_session_box.bundle.js is obsolete and returns 404; must not be referenced');
console.log('✓ Test 4: Zero obsolete/404 script tags referenced in omnitrack.html.');

// Test 5: Root mount container #app exists in omnitrack.html and bundle mounts cleanly
const appStart = htmlContent.indexOf('<div id="app"');
assert.ok(appStart !== -1, 'FAIL: <div id="app" not found in omnitrack.html');

// In modern SPA architecture, omnitrack.html is a lean shell mounting the pre-compiled bundle.
// If an in-DOM template is present, compile it; otherwise verify lean shell mount container.
const appEnd = htmlContent.indexOf('</div>\n\n<script>');
if (appEnd !== -1 && appEnd > appStart) {
  const appTemplate = htmlContent.substring(appStart, appEnd + 6);
  let compileErrors = [];
  let compileWarns = [];
  const appRenderFn = window.Vue.compile(appTemplate, {
    onError: (err) => compileErrors.push(err),
    onWarn: (warn) => compileWarns.push(warn)
  });
  assert.strictEqual(typeof appRenderFn, 'function', 'FAIL: omnitrack.html template failed to compile into a render function');
  assert.strictEqual(compileErrors.length, 0, `FAIL: omnitrack.html template had ${compileErrors.length} compilation errors: ${JSON.stringify(compileErrors)}`);
  console.log(`✓ Test 5: omnitrack.html template (${(appTemplate.length / 1024).toFixed(1)} KB) compiles with zero errors.`);
} else {
  assert.ok(htmlContent.includes('window.OmniTrack.mountApp'), 'FAIL: Lean SPA shell must invoke OmniTrack.mountApp');
  console.log('✓ Test 5: Pure SPA lean shell detected; root mount container and auto-mount invoker verified.');
}

// Test 6: Production-grade error boundary / fallback UI exists in omnitrack.html
// If Vue fails or is slow to initialize, a fallback UI must be present so user never gets an uninformative blank white screen
assert.ok(
  htmlContent.includes('id="omnitrack-fallback-error"') || htmlContent.includes('id="omnitrack-mount-fallback"'),
  'FAIL: omnitrack.html must have an explicit mount error fallback container to prevent blank screen of death'
);
assert.ok(
  htmlContent.includes('window.__omnitrack_mount_success__') || htmlContent.includes('OmniTrack Mount Error'),
  'FAIL: omnitrack.html must handle mount errors deterministically and reveal error fallback UI'
);
console.log('✓ Test 6: Production-grade fallback error UI and mount recovery handlers verified.');

// Test 7: Cache busting verification in omnitrack.py
const pyContent = fs.readFileSync(pyPath, 'utf8');
assert.ok(pyContent.includes('os.path.getmtime(_dist)'), 'FAIL: omnitrack.py must compute asset_bust from bundle mtime');
assert.ok(htmlContent.includes('v={{ asset_bust }}'), 'FAIL: omnitrack.html must include asset_bust query parameter on bundles');
console.log('✓ Test 7: Dynamic mtime cache busting verified in omnitrack.py and omnitrack.html.');

console.log('\nSUCCESS: All Tier 2 Bundle & Runtime Compiler tests passed cleanly!\n');
