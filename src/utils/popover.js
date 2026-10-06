// frappe-ui popovers (Combobox, MultiSelect, TimePicker, DatePicker, Dropdown) are portalled
// to <body>. One counts as open when its content takes up room: TimePicker hides its list
// with v-show, leaving an empty wrapper behind.
export const popoverOpen = () =>
  [...document.querySelectorAll("[data-reka-popper-content-wrapper]")].some(
    (w) => w.firstElementChild && w.firstElementChild.getBoundingClientRect().height > 0
  );

// An open FDialog claims the Escape that closes it, so the document-level handler
// (useWorkstationEod.onPlannerKeydown) does not also close the drawer underneath.
const dialogEscapes = new WeakSet();
export const markDialogEscape = (e) => { dialogEscapes.add(e); };
export const dialogTookEscape = (e) => dialogEscapes.has(e);
