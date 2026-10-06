// Where a task stands, as one colour family. frappe-ui's subtle Badges miss WCAG AA in
// light mode (amber 3.0:1, blue 1.8:1, red 4.1:1), so state chips carry their own pairs.
export function stateTone(state) {
  const s = String(state || '').toLowerCase();
  if (/reject|cancel|drop|fail/.test(s)) return 'red';
  if (/approv|complet|clos|done|accept/.test(s)) return 'green';
  if (/pend|hold|review|wait|draft/.test(s)) return 'amber';
  if (/work|progress|open|start/.test(s)) return 'blue';
  return 'gray';
}

const CHIP = {
  light: {
    red: '!text-red-700 !bg-red-100',
    green: '!text-green-800 !bg-green-100',
    amber: '!text-amber-800 !bg-amber-100',
    blue: '!text-blue-800 !bg-blue-100',
    gray: '!text-gray-800 !bg-gray-100',
  },
  dark: {
    red: '!text-red-200 !bg-red-900',
    green: '!text-green-200 !bg-green-900',
    amber: '!text-amber-200 !bg-amber-900',
    blue: '!text-blue-200 !bg-blue-900',
    gray: '!text-gray-100 !bg-gray-800',
  },
};

// A chip in one colour family that reads at AA in either theme
export const toneChipClass = (tone, dark = false) => CHIP[dark ? 'dark' : 'light'][tone] || CHIP[dark ? 'dark' : 'light'].gray;

export const stateChipClass = (state, dark = false) => toneChipClass(stateTone(state), dark);

// Moves that end or turn a task down read red, by their name or where they lead
export const isDangerMove = (move) =>
  !!move && (/cancel|reject|drop/i.test(String(move.action || '')) || stateTone(move.next_state) === 'red');

export function moveIcon(action) {
  const a = String(action || '').toLowerCase();
  if (/close|complete|approve|done/.test(a)) return 'check';
  if (/cancel|reject|drop/.test(a)) return 'x';
  if (/hold|pause/.test(a)) return 'pause';
  if (/reopen|undo|back/.test(a)) return 'rotate-ccw';
  if (/start|resume/.test(a)) return 'play';
  return 'arrow-right';
}
