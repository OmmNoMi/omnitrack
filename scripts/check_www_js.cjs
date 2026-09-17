#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const wwwDir = path.resolve(__dirname, '..', 'omnitrack', 'www');
const htmlFiles = fs.readdirSync(wwwDir).filter(f => f.endsWith('.html'));

let totalErrors = 0;

for (const file of htmlFiles) {
  const filePath = path.join(wwwDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIndex = 0;

  while ((match = scriptRegex.exec(content)) !== null) {
    scriptIndex++;
    const code = match[1].trim();
    if (!code || !code.includes('createApp')) continue;

    let setupRan = false;
    let setupError = null;
    let returnedPropsCount = 0;

    const context = {
      window: {
        matchMedia: () => ({ matches: false, addEventListener: () => {} }),
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
        location: { href: '', search: '', pathname: '/' + file.replace('.html', '') },
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      },
      document: {
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        documentElement: { style: {} },
        body: { style: {} },
        title: '',
        visibilityState: 'visible'
      },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      navigator: { clipboard: { writeText: () => Promise.resolve() } },
      console: {
        log: () => {},
        warn: () => {},
        error: (...args) => console.error('[In-Script Error]:', ...args),
        info: () => {}
      },
      setTimeout: (fn) => setTimeout(fn, 0),
      clearTimeout: (id) => clearTimeout(id),
      setInterval: () => 1,
      clearInterval: () => {},
      requestAnimationFrame: (fn) => setTimeout(fn, 16),
      Vue: {
        ref: (val) => ({ value: val }),
        reactive: (obj) => obj,
        computed: (fn) => ({ get value() { return fn(); } }),
        watch: () => {},
        watchEffect: () => {},
        onMounted: (fn) => {},
        onUnmounted: (fn) => {},
        nextTick: (fn) => fn && fn(),
        createApp: (opts) => {
          if (opts && opts.setup) {
            try {
              const res = opts.setup();
              setupRan = true;
              if (res && typeof res === 'object') {
                returnedPropsCount = Object.keys(res).length;
              }
            } catch (err) {
              setupError = err;
            }
          }
          return {
            mount: () => {},
            component: () => {},
            config: {}
          };
        }
      },
      session: { user_fullname: 'Test Administrator' },
      frappe: {
        csrf_token: 'test_token',
        user: 'Administrator',
        session: { user: 'Administrator' },
        call: () => Promise.resolve({ message: {} })
      }
    };

    context.window.window = context.window;
    context.window.document = context.document;

    const vmContext = vm.createContext(context);

    try {
      vm.runInContext(code, vmContext, { filename: file + ':script#' + scriptIndex });
      if (setupError) {
        console.error('FAIL: ' + file + ' (script #' + scriptIndex + ') setup() threw:', setupError);
        totalErrors++;
      } else if (setupRan) {
        console.log('OK: ' + file + ' (script #' + scriptIndex + ') setup() executed cleanly (' + returnedPropsCount + ' returned properties).');
      }
    } catch (evalErr) {
      console.error('FAIL: ' + file + ' (script #' + scriptIndex + ') evaluation error:', evalErr);
      totalErrors++;
    }
  }
}

if (totalErrors > 0) {
  console.error('\nFAILED: ' + totalErrors + ' script evaluation error(s) detected.');
  process.exit(1);
} else {
  console.log('\nSUCCESS: all www inline scripts evaluated cleanly with zero runtime/setup errors.');
  process.exit(0);
}
