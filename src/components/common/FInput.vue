<template>
  <div class="relative w-full flex items-center">
    <div v-if="$slots.prefix" class="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-gray-400">
      <slot name="prefix"></slot>
    </div>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="$emit('update:modelValue', $event.target.value); $emit('input', $event)"
      @keydown="$emit('keydown', $event)"
      :class="classes"
    />
    <div v-if="$slots.suffix" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-gray-400">
      <slot name="suffix"></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FInput',
  props: {
    modelValue: [String, Number],
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: 'sm' },
    ariaLabel: { type: String, default: null }
  },
  emits: ['update:modelValue', 'input', 'keydown'],
  computed: {
    classes() {
      const base = 'w-full text-xs font-medium rounded-xl outline-none border transition-colors shadow-xs focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';
      const pl = this.$slots.prefix ? 'pl-8' : (this.size === 'lg' ? 'pl-4.5' : (this.size === 'md' ? 'pl-4' : 'pl-3.5'));
      const pr = this.$slots.suffix ? 'pr-8' : (this.size === 'lg' ? 'pr-4.5' : (this.size === 'md' ? 'pr-4' : 'pr-3.5'));
      const py = this.size === 'lg' ? 'py-3' : (this.size === 'md' ? 'py-2.5' : 'py-1.5');
      const theme = 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20 dark:bg-[#2B2D30] dark:border-gray-700 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/25';
      return [base, py, pl, pr, theme].join(' ');
    }
  }
};
</script>
