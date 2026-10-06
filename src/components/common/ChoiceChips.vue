<template>
  <!-- A single-choice row of chips (Google's filter chips), built from frappe-ui Buttons.
       Radio-group keyboard model: one tab stop, arrows move and select, Home/End jump. -->
  <div
    ref="group"
    role="radiogroup"
    :aria-label="ariaLabel"
    :class="block ? 'grid gap-2' : 'flex flex-wrap gap-2'"
    :style="block ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : null"
    @keydown="onKey"
  >
    <Button
      v-for="(o, i) in options"
      :key="String(o.value)"
      size="md"
      :theme="isOn(o) ? TONES[o.tone || tone].theme : 'gray'"
      variant="outline"
      role="radio"
      :aria-checked="isOn(o) ? 'true' : 'false'"
      :tabindex="i === focusIndex ? 0 : -1"
      :label="o.label"
      :tooltip="o.tooltip"
      :icon-left="o.icon"
      :class="[block ? 'w-full min-w-0' : '', isOn(o) ? TONES[o.tone || tone].on : '']"
      @click="pick(o)"
    >
      <span class="truncate">{{ o.label }}</span>
    </Button>
  </div>
</template>

<script>
// frappe-ui Button themes are gray/blue/green/red only; amber and violet are added as
// token classes on top of the gray outline so every tone keeps the same shape.
const TONES = {
  blue: { theme: "blue", on: "!bg-surface-blue-2" },
  green: { theme: "green", on: "!bg-surface-green-2" },
  amber: { theme: "gray", on: "!bg-surface-amber-2 !text-ink-amber-3 !border-outline-amber-2" },
};

export default {
  name: "ChoiceChips",
  props: {
    modelValue: { type: [String, Number], default: "" },
    // [{ label, value, icon?, tooltip?, tone? }]
    options: { type: Array, default: () => [] },
    ariaLabel: { type: String, required: true },
    tone: { type: String, default: "blue" },
    // one row of equal-width chips instead of wrapping
    block: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  data() {
    return { TONES };
  },
  computed: {
    selectedIndex() {
      return this.options.findIndex((o) => o.value === this.modelValue);
    },
    // the tab stop: the chosen chip, else the first
    focusIndex() {
      return this.selectedIndex >= 0 ? this.selectedIndex : 0;
    },
  },
  methods: {
    isOn(o) {
      return o.value === this.modelValue;
    },
    pick(o) {
      if (!this.isOn(o)) this.$emit("update:modelValue", o.value);
    },
    onKey(e) {
      const n = this.options.length;
      if (!n) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let to;
      if (step) to = (this.focusIndex + step + n) % n;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = n - 1;
      else return;
      e.preventDefault();
      this.pick(this.options[to]);
      this.$nextTick(() => {
        const chips = this.$refs.group.querySelectorAll('[role="radio"]');
        if (chips[to]) chips[to].focus();
      });
    },
  },
};
</script>
