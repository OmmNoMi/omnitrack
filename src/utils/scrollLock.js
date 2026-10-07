// The one owner of the page scroll lock for OmniTrack's own dialogs, drawers and the session popup.
//
// It locks <html> only. frappe-ui dialogs (reka) lock <body> themselves and, on close, put back
// whatever body.style.overflow was when they opened. If we also wrote "hidden" on <body>, reka
// would save our "hidden" as the original and restore it after we unlocked, leaving the page
// unable to scroll (the Stop button in the 30-minute reminder did exactly this).
//
// Each caller names itself, so one surface closing never unlocks the page under another.
const owners = new Set();

export function setScrollLock(owner, locked) {
  if (locked) owners.add(owner);
  else owners.delete(owner);
  const root = document.documentElement;
  if (owners.size) root.style.overflow = "hidden";
  else root.style.removeProperty("overflow");
}
