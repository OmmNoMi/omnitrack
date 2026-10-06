import { inject } from 'vue';

// SessionBox provides its props, emit and composable state once; each pane asks
// for exactly the names it renders. A missing name fails loudly at setup.
export const SESSION_KEY = Symbol('omnitrack.session');

export function useSessionContext(names) {
  const ctx = inject(SESSION_KEY, null);
  if (!ctx) throw new Error('useSessionContext: no session provided by SessionBox');
  const picked = {};
  const missing = [];
  for (const name of names) {
    if (name in ctx) picked[name] = ctx[name];
    else missing.push(name);
  }
  if (missing.length) throw new Error(`useSessionContext: session does not expose ${missing.join(', ')}`);
  return picked;
}
