<template>
  <Dialog v-model="open" :options="{ size: dialogSize }" :disable-outside-click-to-close="!dismissible">
    <template #body>
      <div ref="panel" class="max-h-[85vh] overflow-y-auto bg-surface-modal p-5 sm:p-6 space-y-4" :aria-label="title || ariaLabel || undefined" @keydown.esc="keepEscape">
        <div v-if="title || $slots.header || $slots['header-icon']" class="flex items-start justify-between gap-3">
          <slot name="header">
            <div class="flex items-center gap-3 min-w-0">
              <div v-if="$slots['header-icon']" class="h-9 w-9 rounded-full flex items-center justify-center bg-surface-blue-2 text-ink-blue-3 shrink-0">
                <slot name="header-icon" />
              </div>
              <div class="min-w-0">
                <DialogTitle v-if="title" as="h3" class="text-lg font-semibold text-ink-gray-9">{{ title }}</DialogTitle>
                <DialogDescription v-if="subtitle" as="p" class="text-sm text-ink-gray-7 mt-0.5">{{ subtitle }}</DialogDescription>
              </div>
            </div>
          </slot>
          <Button v-if="dismissible" variant="ghost" icon="x" label="Close dialog" class="shrink-0 -mr-1 -mt-1" @click="open = false" />
        </div>

        <slot />

        <div v-if="$slots.actions || $slots.footer" class="pt-2">
          <slot name="actions"><slot name="footer" /></slot>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script>
import { Dialog } from 'frappe-ui';
import { DialogTitle, DialogDescription } from 'reka-ui';
import { popoverOpen, markDialogEscape } from '../../utils/popover.js';

// Focus trap, Esc, scroll lock and return-focus come from frappe-ui's Dialog
// (reka-ui). What stays ours is the *safe* initial focus: never the close
// button or a destructive action (WCAG 3.3.4), honouring an explicit
// autofocus / data-autofocus / data-confirm-working marker.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const isClose = (el) => el.getAttribute('aria-label') === 'Close dialog';
// A field that opens its own popup when focused (a DatePicker's calendar) would open over the
// form the moment the dialog does, hiding the fields under it.
const opensOnFocus = (el) => el.tagName === 'INPUT' && el.hasAttribute('aria-haspopup');
const isDestructive = (el) => {
  const txt = (el.textContent || '').trim().toLowerCase();
  return el.getAttribute('theme') === 'red' || txt.includes('discard') || txt.includes('delete');
};


export default {
  name: 'FDialog',
  components: { Dialog, DialogTitle, DialogDescription },
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: null },
    subtitle: { type: String, default: null },
    size: { type: String, default: 'md' },
    zIndex: { type: String, default: 'z-[70]' },
    dismissible: { type: Boolean, default: true },
    // An inner step is open (a confirm): Escape steps back out of it (emits back) instead of closing
    escBack: { type: Boolean, default: false },
    ariaLabel: { type: String, default: null }
  },
  emits: ['update:modelValue', 'close', 'back'],
  computed: {
    dialogSize() {
      return { sm: 'md', md: 'lg', lg: '2xl', xl: '4xl' }[this.size] || 'lg';
    },
    open: {
      get() { return this.modelValue; },
      set(v) {
        if (!v && !this.dismissible) return;
        if (!v && this.escOwnedByPopover) return;
        if (!v && this.escHeld) return;
        this.$emit('update:modelValue', v);
        if (!v) this.$emit('close');
      }
    }
  },
  data() {
    return { escOwnedByPopover: false, escHeld: false };
  },
  watch: {
    modelValue(v) { if (v) this.focusSafe(); }
  },
  // frappe-ui's Dialog closes on any Escape, even one meant for a TimePicker list,
  // DatePicker calendar or Combobox open inside it: the user lost the whole form.
  // Escape closes the innermost thing first (WAI-ARIA dialog pattern).
  mounted() {
    if (this.modelValue) this.focusSafe();
    document.addEventListener('keydown', this.noteEscape, true);
  },
  beforeUnmount() { document.removeEventListener('keydown', this.noteEscape, true); },
  methods: {
    noteEscape(e) {
      if (e.key !== 'Escape' || !this.modelValue) return;
      markDialogEscape(e);
      this.escOwnedByPopover = popoverOpen();
      if (this.escOwnedByPopover) setTimeout(() => { this.escOwnedByPopover = false; }, 0);
      else if (this.escBack) {
        this.escHeld = true;
        setTimeout(() => { this.escHeld = false; }, 0);
        this.$emit('back');
      }
    },
    // The Escape that closes this dialog is this dialog's alone. Left to bubble, the page's own
    // Escape handlers also act on it, and one key closed both this and the session popup under it.
    // Stopping it here also keeps it from reka's listener, so the dialog closes itself (the open
    // setter still honours escBack and a non-dismissible dialog).
    keepEscape(e) {
      if (this.escOwnedByPopover) return;
      e.stopPropagation();
      this.open = false;
    },
    focusSafe() {
      // After reka's own auto-focus (which lands on the first focusable).
      setTimeout(() => {
        const panel = this.$refs.panel;
        if (!panel) return;
        const items = [...panel.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const target =
          items.find((el) => el.hasAttribute('autofocus') || el.hasAttribute('data-autofocus') || el.hasAttribute('data-confirm-working')) ||
          items.find((el) => !isClose(el) && !isDestructive(el) && !opensOnFocus(el)) ||
          items.find((el) => !isClose(el)) ||
          items[0];
        target.focus();
      }, 0);
    }
  }
};
</script>
