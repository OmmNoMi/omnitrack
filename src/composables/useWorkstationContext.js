import { inject } from 'vue';

// App.vue provides the workstation once; views and drawers ask for exactly the
// names they use instead of receiving them as 100+ props through a coordinator
// (the Helpdesk/CRM pattern: a shared store/composable, explicit per-component
// dependency list). A name that does not exist fails loudly at setup instead of
// as a render-time "Cannot read properties of undefined".
export const WORKSTATION_KEY = Symbol('omnitrack.workstation');

export function useWorkstationContext(names) {
  const ws = inject(WORKSTATION_KEY, null);
  if (!ws) throw new Error('useWorkstationContext: no workstation provided by App.vue');
  const picked = {};
  const missing = [];
  for (const name of names) {
    if (name in ws) picked[name] = ws[name];
    else missing.push(name);
  }
  if (missing.length) throw new Error(`useWorkstationContext: workstation does not expose ${missing.join(', ')}`);
  return picked;
}
