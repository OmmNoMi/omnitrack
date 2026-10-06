#!/usr/bin/env node
/**
 * Tier 2.5 runtime smoke test: boots the REAL built bundle against the REAL
 * www/omnitrack.html shell in jsdom (no new dependencies) and fails on anything
 * the static checks cannot see:
 *   - any console.error / uncaught error / unhandled rejection while booting,
 *     switching tabs, or opening every dialog/drawer;
 *   - unresolved components (a production Vue build renders an unregistered
 *     <f-dialog> as an inert custom element instead of warning, which is exactly
 *     how dialogs once rendered inline);
 *   - a tab that renders (almost) nothing (the blank-Dashboard regression);
 *   - dialog flags in the workstation that no longer map to a dialog the
 *     DialogCoordinator renders.
 *
 * Run `npm run build` first; this tests dist/omnitrack.bundle.js as shipped.
 */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { build: buildFixtures } = require('./fixtures/spa_smoke_data.cjs');
const fx = buildFixtures();

const root = path.resolve(__dirname, '..');
const bundle = fs.readFileSync(path.join(root, 'omnitrack/public/dist/omnitrack.bundle.js'), 'utf8');
const rawHtml = fs.readFileSync(path.join(root, 'omnitrack/www/omnitrack.html'), 'utf8');
const dialogSrc = fs.readFileSync(path.join(root, 'src/components/dialogs/DialogCoordinator.vue'), 'utf8');

// Jinja -> static values, as test_axe_wcag.cjs does.
const html = rawHtml
  .replace(/{%\s*raw\s*%}|{%\s*endraw\s*%}/g, '')
  .replace(/{{\s*title\s*or\s*'OmniTrack Workstation'\s*}}/g, 'OmniTrack Workstation')
  .replace(/{{\s*asset_bust\s*}}/g, 'smoke')
  .replace(/{{\s*\(active_session \| tojson\) if active_session else 'null'\s*}}/g, 'null')
  .replace(/{{\s*'true' if is_manager else 'false'\s*}}/g, 'true')
  .replace(/{{\s*'true' if is_client else 'false'\s*}}/g, 'false')
  .replace(/<script\s+src=[^>]*><\/script>/g, '')
  .replace(/{{\s*[^}]*}}/g, 'smoke');

const problems = [];
const apiCalls = new Set();
const note = (kind, msg) => problems.push(`${kind}: ${String(msg).split('\n')[0].slice(0, 300)}`);

const vc = new VirtualConsole();
vc.on('error', (e) => note('console.error', e && e.message ? e.message : e));
vc.on('jsdomError', (e) => note('jsdomError', e.message));
vc.on('warn', (w) => { if (/Vue warn|Failed to resolve/i.test(String(w))) note('vue-warn', w); });

const dom = new JSDOM(html, {
  url: 'http://localhost:8000/omnitrack#/dashboard',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const w = dom.window;

// ---- browser/Frappe environment stubs -------------------------------------
w.matchMedia = w.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
w.HTMLElement.prototype.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
w.scrollTo = () => {};
w.Notification = class { static get permission() { return 'denied'; } static requestPermission() { return Promise.resolve('denied'); } };
w.HTMLCanvasElement.prototype.getContext = () => null;
w.HTMLMediaElement.prototype.play = () => Promise.resolve();
w.AudioContext = w.webkitAudioContext = class { createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {} } }; } createGain() { return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } }; } get destination() { return {}; } get currentTime() { return 0; } };
w.frappe = {
  csrf_token: 'smoke',
  session: { user: 'smoke@example.com' },
  boot: { sitename: 'smoke.local', user: { name: 'smoke@example.com' } },
  realtime: { on() {}, off() {}, emit() {} },
  call: () => Promise.resolve({ message: null }),
  show_alert() {}
};
w.omnitrack_boot = true;
// No real network: socket.io's polling transport would otherwise dial localhost.
w.XMLHttpRequest = class { open() {} send() {} setRequestHeader() {} abort() {} addEventListener() {} };
w.WebSocket = class { constructor() { setTimeout(() => this.onerror && this.onerror(new Error('offline')), 0); } send() {} close() {} };
w.fetch = async (url) => {
  const m = String(url).split('/api/method/')[1] || String(url);
  const method = m.split('?')[0].replace('omnitrack.api.', '');
  apiCalls.add(method);
  const bodies = {
    get_workstation_data: fx.workstation,
    get_planner_data: fx.planner,
    get_pending_team_approvals: fx.approvals,
    get_active_session: null
  };
  const message = method in bodies ? bodies[method] : null;
  return { ok: true, status: 200, json: async () => ({ message }), text: async () => '' };
};
w.addEventListener('error', (e) => note('uncaught', e.message));
w.addEventListener('unhandledrejection', (e) => note('unhandledrejection', e.reason && e.reason.message ? e.reason.message : e.reason));

const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const rootText = () => (w.document.querySelector('.omnitrack-view-coordinator') || { innerText: '', textContent: '' }).textContent.trim();

// Custom elements that are legitimate; anything else with a dash is an
// unregistered component that Vue silently rendered as a plain element.
const KNOWN_ELEMENTS = new Set(['svg-icon']);
function unresolvedComponents() {
  const bad = new Set();
  // Portaled dialogs live under <body>, so scan the whole body. An unregistered
  // <Badge> becomes an HTMLUnknownElement; an unregistered <Button> becomes a
  // *native* <button> that still carries its props (theme/variant) as attributes.
  for (const el of w.document.body.querySelectorAll('*')) {
    const t = el.tagName.toLowerCase();
    if (t.includes('-') && !KNOWN_ELEMENTS.has(t) && !w.customElements.get(t)) bad.add(t);
    else if (!t.includes('-') && el instanceof w.HTMLUnknownElement) bad.add(t);
    else if (el.hasAttribute('theme')) bad.add(`${t}[theme] (unregistered component props leaked as attributes)`);
    // frappe-ui Button overwrites a passed aria-label with its `label` prop, so
    // an icon button given aria-label renders nameless. Pass `label` instead.
    else if (t === 'button' && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.textContent.trim()) {
      bad.add(`nameless <button class="${(el.className || '').toString().slice(0, 40)}…"> (use the Button label prop)`);
    }
  }
  return [...bad];
}

(async () => {
  w.eval(bundle);
  if (!w.OmniTrack || !w.OmniTrack.mountApp) throw new Error('bundle did not export OmniTrack.mountApp');
  const app = w.OmniTrack.mountApp('#app');
  w.__omnitrack_mount_success__ = true;
  await tick(400);
  const vm = app.rootProxy;
  const state = vm.$.setupState;
  const results = [];
  const check = (label, ok, detail = '') => { results.push({ label, ok, detail }); if (!ok) problems.push(`${label}${detail ? ': ' + detail : ''}`); };

  check('app mounted', !!w.document.querySelector('#app').children.length);

  // 1. Every tab renders real content.
  for (const tab of ['dashboard', 'planner', 'timesheets', 'attendance', 'dashboard']) {
    w.location.hash = `#/${tab}`;
    w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    await tick(250);
    check(`tab "${tab}" renders`, rootText().length > 40, `only ${rootText().length} chars`);
    const unresolved = unresolvedComponents();
    if (tab === 'dashboard') check('dashboard shows fixture data', /Smoke task/.test(rootText()), 'fixture task not rendered');
    check(`tab "${tab}" has no unresolved components`, unresolved.length === 0, unresolved.join(', '));
  }

  // 1b. The live session HUD (SessionBox + its two panes) only mounts while a
  // timer runs, which no tab visit exercises: start one and render it for real.
  if ('isTracking' in state) {
    state.isTracking = true;
    await tick(250);
    const hud = w.document.querySelector('.frappe-ui-session-hud');
    check('session HUD renders while tracking', !!hud, 'no .frappe-ui-session-hud in DOM');
    check('session HUD has both panes', !!hud && !!hud.querySelector('[role="toolbar"]') && !!hud.querySelector('[role="tablist"]') && hud.querySelectorAll('textarea,input').length > 0, 'log/controls pane missing');
    const unresolvedHud = unresolvedComponents();
    check('session HUD has no unresolved components', unresolvedHud.length === 0, unresolvedHud.join(', '));
    state.isTracking = false;
    await tick(150);
  }

  // 2. Every dialog/drawer flag opens and closes cleanly.
  const flagRe = /^show[A-Za-z]*(Modal|Drawer|Popup)$/;
  const flags = Object.keys(state).filter((k) => flagRe.test(k) && typeof state[k] === 'boolean');
  const coordinated = [...dialogSrc.matchAll(/:model-value="(show[A-Za-z]+)"/g)].map((m) => m[1]);
  const missing = coordinated.filter((n) => !flags.includes(n));
  check('every DialogCoordinator flag is a workstation flag', missing.length === 0, missing.join(', '));

  for (const flag of [...new Set([...flags, ...coordinated])].filter((n) => n in state)) {
    state[flag] = true;
    await tick(120);
    const open = w.document.querySelectorAll('[role="dialog"], [data-drawer], aside[aria-label]').length;
    const unresolved = unresolvedComponents();
    check(`${flag} opens`, unresolved.length === 0, unresolved.join(', '));
    if (coordinated.includes(flag)) check(`${flag} renders a dialog`, open > 0, 'no [role=dialog] in DOM');
    state[flag] = false;
    await tick(60);
  }
  check('all dialogs closed afterwards', w.document.querySelectorAll('[role="dialog"]').length === 0);
  check('page scroll lock released', !w.document.documentElement.style.overflow);

  // ---- report
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.label}${r.ok || !r.detail ? '' : ' — ' + r.detail}`);
  console.log(`\n(API methods the shell called while booting: ${[...apiCalls].sort().join(', ') || 'none'})`);
  const uniq = [...new Set(problems)];
  if (uniq.length) {
    console.error(`\nFAIL: ${uniq.length} runtime problem(s):`);
    uniq.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }
  console.log('\nSUCCESS: SPA boots, every tab renders, every dialog opens/closes, zero runtime errors.');
  process.exit(0);
})().catch((e) => { console.error('FAIL (smoke harness):', e && e.stack || e); process.exit(1); });
