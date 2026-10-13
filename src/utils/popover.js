// frappe-ui popovers (Combobox, MultiSelect, TimePicker, DatePicker, Dropdown) are portalled
// to <body>. One counts as open when its content takes up room: TimePicker hides its list
// with v-show, leaving an empty wrapper behind.
export const popoverOpen = () =>
  [...document.querySelectorAll("[data-reka-popper-content-wrapper]")].some(
    (w) => w.firstElementChild && w.firstElementChild.getBoundingClientRect().height > 0
  );

// A field that opens its popup when focused: a DatePicker's input, marked aria-haspopup
export const opensOnFocus = (el) => !!el && el.tagName === "INPUT" && el.hasAttribute("aria-haspopup");

// Focus on a field that opens on focus, held back from the field so its calendar stays shut
const hushOpener = (e) => { if (opensOnFocus(e.target)) e.stopImmediatePropagation(); };

// Gives focus back to a field after Escape closed its list or calendar, without opening it again
export const focusBack = (field) => {
  window.addEventListener("focus", hushOpener, true);
  try { field.focus(); } finally { window.removeEventListener("focus", hushOpener, true); }
};

const POPUP = "[data-reka-popper-content-wrapper]";
const FIELD = 'input:not([type=hidden]), button, textarea, select, [tabindex]:not([tabindex="-1"])';

// The field a list or calendar belongs to: the last one pressed or focused outside the popups. A
// click on a DatePicker opens its calendar without focusing the field, so a press counts too. A
// DatePicker opens in its own focus handler and the calendar takes focus at once, so focusin never
// reaches its field: the capturing focus listener runs before the field's handler.
let lastField = null;
const noteField = (e) => {
  const t = e.target;
  if (!t || !t.closest || t.closest(POPUP)) return;
  const el = t.closest(FIELD);
  if (el) lastField = el;
};

// When Escape closes a DatePicker's calendar, reka gives focus back to its field, and the field
// opens the calendar again on focus: from the keyboard the calendar could not be closed. For the
// rest of that Escape, a field that opens on focus takes focus without opening.
// Outside a dialog nothing gave focus back at all: a calendar takes focus as it opens, and on
// Escape it went to the page (so did a TimePicker's field, which blurs itself). When the Escape
// came from the popup or from its field and focus ends on the page, the field gets it back.
let quietInstalled = false;
export const quietReopenOnEscape = () => {
  if (quietInstalled) return;
  quietInstalled = true;
  window.addEventListener("focus", noteField, true);
  document.addEventListener("pointerdown", noteField, true);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !popoverOpen()) return;
    const field = lastField, from = document.activeElement;
    const ours = !!field && (from === field || !!(from && from.closest && from.closest(POPUP)));
    window.addEventListener("focus", hushOpener, true);
    const settle = () => {
      const now = document.activeElement;
      if (ours && field.isConnected && (!now || now === document.body)) focusBack(field);
    };
    setTimeout(() => {
      window.removeEventListener("focus", hushOpener, true);
      // A calendar lets go of focus only as it finishes closing, after this turn
      const now = document.activeElement;
      if (ours && now && now.closest && now.closest(POPUP)) now.addEventListener("focusout", () => setTimeout(settle), { once: true });
      else settle();
    });
  }, true);
};

// frappe-ui's DatePicker sets inheritAttrs: false and passes on only class and style, so an
// aria-label or aria-haspopup on <DatePicker> never reached its input: the field had no name, and
// nothing could tell it opens a calendar when focused. On the element around the picker,
// v-input-attrs puts them on its input.
const applyInputAttrs = (el, { value }) => {
  const input = el.querySelector("input");
  if (!input) return;
  for (const [k, v] of Object.entries(value || {})) {
    if (v == null || v === false) input.removeAttribute(k);
    else input.setAttribute(k, String(v));
  }
};
export const vInputAttrs = { mounted: applyInputAttrs, updated: applyInputAttrs };

// The button a reka menu item belongs to. A pick opens things from the item, which goes when
// the menu closes; its button stays, so that is what focus goes back to.
export const menuTrigger = (el) => {
  const menu = el && el.closest && el.closest('[role="menu"]');
  const id = menu && menu.getAttribute("aria-labelledby");
  return (id && document.getElementById(id)) || el;
};

// An open FDialog claims the Escape that closes it, so the document-level handler
// (useWorkstationEod.onPlannerKeydown) does not also close the drawer underneath.
const dialogEscapes = new WeakSet();
export const markDialogEscape = (e) => { dialogEscapes.add(e); };
export const dialogTookEscape = (e) => dialogEscapes.has(e);
