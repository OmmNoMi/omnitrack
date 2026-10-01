<template>
  <div class="relative inline-block text-left" data-f-dropdown-menu>
    <div @click="toggle" @keydown="onTriggerKeydown">
      <slot name="trigger" :is-open="isOpen" :toggle="toggle">
        <slot :is-open="isOpen" :toggle="toggle">
          <button
            type="button"
            :disabled="disabled"
            :aria-expanded="isOpen ? 'true' : 'false'"
            :aria-label="ariaLabel"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors shadow-xs outline-none bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <span>{{ title || ariaLabel || 'Menu' }}</span>
            <svg class="w-3 h-3 transition-transform" :class="isOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </slot>
      </slot>
    </div>

    <div
      v-if="isOpen"
      role="menu"
      tabindex="-1"
      @keydown="onMenuKeydown"
      :aria-label="ariaLabel"
      class="absolute z-50 mt-1.5 min-w-[13.5rem] sm:min-w-[18rem] max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-xl border py-1.5 transition-all outline-none bg-white border-gray-200 text-gray-900 shadow-gray-400/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:shadow-black/60"
      :class="align === 'left' ? 'left-0' : 'right-0'"
    >
      <div v-if="title" class="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700/60 mb-1">
        {{ title }}
      </div>
      <div class="space-y-0.5 px-1">
        <button
          v-for="(item, idx) in items"
          :key="item.action || item.label || idx"
          type="button"
          role="menuitem"
          :disabled="item.disabled"
          :tabindex="idx === focusedIdx ? 0 : -1"
          @click.stop="selectItem(item)"
          @pointerenter="focusedIdx = idx"
          @focus="focusedIdx = idx"
          class="w-full text-left px-3 py-2 text-xs font-medium rounded-xl flex items-center justify-between gap-4 transition-colors cursor-pointer group outline-none"
          :class="[
            idx === focusedIdx ? (item.focusClass || 'bg-gray-100 dark:bg-gray-700/70 ring-1 ring-inset ring-gray-300 dark:ring-gray-600') : '',
            item.itemClass || 'hover:bg-gray-100 dark:hover:bg-gray-700/70 text-gray-800 dark:text-gray-200'
          ]"
        >
          <span class="flex items-center gap-2.5 min-w-0 flex-1">
            <span v-if="item.icon" class="w-4 text-center font-bold shrink-0 text-xs" aria-hidden="true">{{ item.icon }}</span>
            <span class="font-semibold truncate" :title="item.label">{{ item.label }}</span>
          </span>
          <span v-if="item.next_state || item.badge" class="shrink-0 font-mono text-[10px] tracking-tight uppercase px-2 py-0.5 rounded-full border bg-gray-100/90 border-gray-200 text-gray-600 dark:bg-gray-800/90 dark:border-gray-700 dark:text-gray-300 ml-2">
            {{ item.next_state || item.badge }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FDropdownMenu',
  props: {
    items: { type: Array, default: () => [] },
    title: { type: String, default: null },
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: 'Menu' },
    align: { type: String, default: 'right' }
  },
  emits: ['select'],
  data() {
    return {
      isOpen: false,
      focusedIdx: -1
    };
  },
  mounted() {
    this._outsideHandler = (e) => {
      if (this.isOpen && this.$el && !this.$el.contains(e.target)) {
        this.close(false);
      }
    };
    this._closeListener = (e) => {
      if (this.isOpen && e.detail !== this) {
        this.close(false);
      }
    };
    document.addEventListener('pointerdown', this._outsideHandler);
    window.addEventListener('omnitrack-close-menus', this._closeListener);
  },
  unmounted() {
    document.removeEventListener('pointerdown', this._outsideHandler);
    window.removeEventListener('omnitrack-close-menus', this._closeListener);
  },
  methods: {
    getTriggerButton() {
      return this.$el ? this.$el.querySelector('button[aria-expanded]') : null;
    },
    getMenuItems() {
      if (!this.$el) return [];
      return Array.from(this.$el.querySelectorAll('[role="menuitem"]:not([disabled])'));
    },
    open(focusTarget = 'first') {
      if (this.disabled || this.isOpen) return;
      this._triggerEl = document.activeElement;
      this.isOpen = true;
      window.dispatchEvent(new CustomEvent('omnitrack-close-menus', { detail: this }));
      this.adjustPosition();
      this.$nextTick(() => {
        const items = this.getMenuItems();
        if (items.length > 0) {
          const idx = focusTarget === 'last' ? items.length - 1 : 0;
          this.focusedIdx = idx;
          items[idx].focus();
        }
      });
    },
    adjustPosition() {
      this.$nextTick(() => {
        if (!this.isOpen || !this.$el) return;
        const menu = this.$el.querySelector('[role="menu"]');
        if (!menu) return;
        const rect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        if (rect.left < 8) {
          menu.style.left = '0px';
          menu.style.right = 'auto';
        } else if (rect.right > viewportWidth - 8) {
          menu.style.right = '0px';
          menu.style.left = 'auto';
        }
      });
    },
    close(restoreFocus = true) {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.focusedIdx = -1;
      if (restoreFocus) {
        const target = this._triggerEl || this.getTriggerButton();
        if (target && typeof target.focus === 'function') {
          target.focus();
        }
      }
    },
    toggle() {
      if (this.isOpen) {
        this.close(true);
      } else {
        this.open('first');
      }
    },
    focusItem(idx) {
      const items = this.getMenuItems();
      if (!items.length) return;
      this.focusedIdx = (idx + items.length) % items.length;
      if (items[this.focusedIdx]) {
        items[this.focusedIdx].focus();
      }
    },
    selectItem(item) {
      if (!item || item.disabled) return;
      if (!item.keepOpen) {
        this.close(true);
      }
      if (typeof item.onClick === 'function') {
        item.onClick();
      }
      this.$emit('select', item);
    },
    onTriggerKeydown(e) {
      if (this.disabled) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        this.open('first');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        this.open('last');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      }
    },
    onMenuKeydown(e) {
      if (!this.isOpen) return;
      const k = e.key;
      if (k === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        this.focusItem(this.focusedIdx + 1);
      } else if (k === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        this.focusItem(this.focusedIdx - 1);
      } else if (k === 'Home') {
        e.preventDefault();
        e.stopPropagation();
        this.focusItem(0);
      } else if (k === 'End') {
        e.preventDefault();
        e.stopPropagation();
        const items = this.getMenuItems();
        this.focusItem(items.length - 1);
      } else if (k === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close(true);
      } else if (k === 'Tab') {
        this.close(false);
      } else if (k === 'Enter' || k === ' ') {
        if (this.focusedIdx >= 0 && this.items[this.focusedIdx]) {
          e.preventDefault();
          e.stopPropagation();
          this.selectItem(this.items[this.focusedIdx]);
        }
      }
    }
  }
};
</script>
