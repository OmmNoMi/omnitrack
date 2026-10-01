<template>
  <div class="relative w-full text-left" data-f-combobox>
    <div class="relative flex items-center w-full">
      <button
        type="button"
        role="combobox"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :aria-label="ariaLabel"
        :disabled="disabled"
        @click="toggle"
        @keydown="onTriggerKeydown"
        class="w-full flex items-center justify-between gap-2 rounded-xl border text-left transition-all outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        :class="[
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs',
          disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : 'cursor-pointer bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600',
          'border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-xs'
        ]"
      >
        <span class="flex items-center gap-2 min-w-0 flex-1 truncate">
          <span v-if="displayLabel" class="truncate font-medium text-gray-900 dark:text-gray-100">
            {{ displayLabel }}
          </span>
          <span v-else class="truncate text-gray-400 dark:text-gray-500">
            {{ placeholder }}
          </span>
        </span>

        <span class="flex items-center gap-1 shrink-0 text-gray-400 dark:text-gray-500 pl-6">
          <svg class="w-3.5 h-3.5 transition-transform" :class="isOpen ? 'rotate-180 text-blue-500' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </span>
      </button>

      <button
        v-if="clearable && modelValue && !disabled"
        type="button"
        @click="clear"
        aria-label="Clear selection"
        class="absolute right-7 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md transition-colors cursor-pointer"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div
      v-if="isOpen"
      class="absolute left-0 right-0 z-50 mt-1.5 rounded-2xl shadow-xl border p-1.5 transition-all outline-none bg-white border-gray-200 text-gray-900 shadow-gray-400/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:shadow-black/60"
      role="dialog"
      aria-modal="true"
    >
      <div class="relative px-1 pt-1 pb-1.5">
        <div class="relative flex items-center">
          <svg class="absolute left-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            :placeholder="searchPlaceholder"
            @keydown="onSearchKeydown"
            class="w-full text-xs pl-8 pr-7 py-2 rounded-xl border outline-none transition-all bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <button
            v-if="searchQuery"
            type="button"
            @click="searchQuery = ''; $refs.searchInput && $refs.searchInput.focus()"
            class="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
            aria-label="Clear search"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700/60 mb-1">
        <span>{{ filteredOptions.length }} {{ filteredOptions.length === 1 ? 'option' : 'options' }}</span>
        <span v-if="searchQuery" class="text-blue-500">Filtered</span>
      </div>

      <div
        ref="optionsList"
        role="listbox"
        class="max-h-60 overflow-y-auto space-y-0.5 px-0.5 py-0.5"
      >
        <div
          v-for="(opt, idx) in filteredOptions"
          :key="opt.value || idx"
          role="option"
          :aria-selected="opt.value === modelValue ? 'true' : 'false'"
          @pointerenter="highlightedIdx = idx"
          @click="selectOption(opt)"
          class="w-full text-left px-2.5 py-2 text-xs rounded-xl flex items-center justify-between gap-3 cursor-pointer select-none transition-colors"
          :class="[
            idx === highlightedIdx ? 'bg-blue-50 dark:bg-blue-900/40 ring-1 ring-blue-300 dark:ring-blue-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700/60',
            opt.value === modelValue ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
          ]"
        >
          <div class="min-w-0 flex-1 flex flex-col gap-0.5">
            <div class="flex items-center gap-1.5 truncate">
              <span class="truncate font-medium text-xs">{{ opt.label }}</span>
            </div>
            <div v-if="opt.project || opt.description" class="text-[10px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5 pl-0.5">
              <span v-if="opt.project">📁 {{ opt.project }}</span>
              <span v-if="opt.description">{{ opt.project ? '· ' + opt.description : opt.description }}</span>
            </div>
          </div>

          <svg v-if="opt.value === modelValue" class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>

        <div v-if="filteredOptions.length === 0" class="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          <div class="font-medium">No matching items</div>
          <div class="text-[10px] mt-0.5">Try a different search term</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FCombobox',
  props: {
    modelValue: { type: [String, Number, Object], default: '' },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'Select an option...' },
    searchPlaceholder: { type: String, default: 'Search...' },
    disabled: { type: Boolean, default: false },
    clearable: { type: Boolean, default: true },
    ariaLabel: { type: String, default: 'Select' },
    size: { type: String, default: 'md' }
  },
  emits: ['update:modelValue', 'change', 'clear'],
  data() {
    return {
      isOpen: false,
      searchQuery: '',
      highlightedIdx: 0
    };
  },
  computed: {
    normalizedOptions() {
      if (!Array.isArray(this.options)) return [];
      return this.options.map(opt => {
        if (opt && typeof opt === 'object') {
          return {
            value: opt.value !== undefined ? opt.value : (opt.ref || opt.id || opt.name || ''),
            label: opt.label !== undefined ? opt.label : (opt.subject || opt.title || opt.name || String(opt.value || '')),
            kind: opt.kind || '',
            project: opt.project || opt.project_name || '',
            description: opt.description || '',
            disabled: Boolean(opt.disabled),
            raw: opt
          };
        }
        return {
          value: opt,
          label: String(opt),
          kind: '',
          project: '',
          description: '',
          disabled: false,
          raw: opt
        };
      });
    },
    filteredOptions() {
      const q = (this.searchQuery || '').trim().toLowerCase();
      if (!q) return this.normalizedOptions;
      return this.normalizedOptions.filter(opt => {
        const l = (opt.label || '').toLowerCase();
        const v = String(opt.value || '').toLowerCase();
        const k = (opt.kind || '').toLowerCase();
        const p = (opt.project || '').toLowerCase();
        const d = (opt.description || '').toLowerCase();
        return l.includes(q) || v.includes(q) || k.includes(q) || p.includes(q) || d.includes(q);
      });
    },
    selectedOption() {
      const val = this.modelValue;
      if (val === '' || val === null || val === undefined) return null;
      return this.normalizedOptions.find(opt => opt.value === val) || null;
    },
    displayLabel() {
      if (this.selectedOption) {
        return this.selectedOption.label;
      }
      if (this.modelValue && typeof this.modelValue === 'string') {
        return this.modelValue;
      }
      return '';
    }
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
      return this.$el ? this.$el.querySelector('button[role="combobox"]') : null;
    },
    open() {
      if (this.disabled || this.isOpen) return;
      this._triggerEl = document.activeElement;
      this.isOpen = true;
      this.searchQuery = '';
      this.highlightedIdx = 0;
      window.dispatchEvent(new CustomEvent('omnitrack-close-menus', { detail: this }));
      this.$nextTick(() => {
        if (this.$refs.searchInput && typeof this.$refs.searchInput.focus === 'function') {
          this.$refs.searchInput.focus();
        }
      });
    },
    close(restoreFocus = true) {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.searchQuery = '';
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
        this.open();
      }
    },
    selectOption(opt) {
      if (!opt || opt.disabled) return;
      this.$emit('update:modelValue', opt.value);
      this.$emit('change', opt.value, opt);
      this.close(true);
    },
    clear(e) {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      this.$emit('update:modelValue', '');
      this.$emit('clear');
      this.$emit('change', '', null);
    },
    onTriggerKeydown(e) {
      if (this.disabled) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.open();
      }
    },
    onSearchKeydown(e) {
      const k = e.key;
      if (k === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (this.filteredOptions.length > 0) {
          this.highlightedIdx = (this.highlightedIdx + 1) % this.filteredOptions.length;
          this.scrollToHighlighted();
        }
      } else if (k === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (this.filteredOptions.length > 0) {
          this.highlightedIdx = (this.highlightedIdx - 1 + this.filteredOptions.length) % this.filteredOptions.length;
          this.scrollToHighlighted();
        }
      } else if (k === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (this.filteredOptions.length > 0 && this.filteredOptions[this.highlightedIdx]) {
          this.selectOption(this.filteredOptions[this.highlightedIdx]);
        }
      } else if (k === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close(true);
      } else if (k === 'Tab') {
        this.close(false);
      }
    },
    scrollToHighlighted() {
      this.$nextTick(() => {
        const list = this.$refs.optionsList;
        if (!list) return;
        const el = list.children[this.highlightedIdx];
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest' });
        }
      });
    }
  }
};
</script>
