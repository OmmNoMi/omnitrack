<template>
  <!-- Step 1 of planning (after a calendar slot is picked): which tasks? The time is known.
       A combobox whose list stays open: arrows move, Enter picks, typing filters.
       The box at the start of a row ticks it (several tasks in one block); the rest of
       the row picks that task and goes on. -->
  <div class="space-y-3">
    <p class="flex items-center gap-2 text-sm" :class="mutedText">
      <FeatherIcon name="clock" class="w-4 h-4 shrink-0" :class="iconTone" aria-hidden="true" />
      {{ whenLine }}
    </p>
    <TextInput
      ref="taskSearch"
      size="lg"
      :model-value="query"
      placeholder="Search tasks or type a name"
      role="combobox"
      aria-label="Tasks for this time"
      aria-expanded="true"
      aria-autocomplete="list"
      aria-keyshortcuts="Shift+Enter"
      :aria-controls="listId"
      :aria-describedby="listId + '-hint'"
      :aria-activedescendant="taskRows.length ? optionId(activeIndex) : undefined"
      data-autofocus
      @update:model-value="$emit('update:query', $event)"
      @keydown="onTaskKey"
    >
      <template #prefix><FeatherIcon name="search" class="w-4 h-4" :class="iconTone" aria-hidden="true" /></template>
    </TextInput>
    <p :id="listId + '-hint'" class="text-sm" :class="mutedText">
      {{ checked.length ? `${checked.length} ticked. Pick one more, or continue.` : 'Tick the box to pick several tasks.' }}
      <span class="hidden sm:inline">Shift+Enter ticks.</span>
    </p>
    <ul :id="listId" role="listbox" aria-label="Tasks" aria-multiselectable="true" class="max-h-[45vh] overflow-y-auto -mx-1">
      <li
        v-for="(row, i) in taskRows"
        :id="optionId(i)"
        :key="row.key"
        role="option"
        :aria-selected="row.create ? undefined : (isChecked(row) ? 'true' : 'false')"
        class="flex items-center gap-1 pr-2 mx-1 rounded-lg cursor-pointer"
        :class="i === activeIndex ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
        @mousemove="activeIndex = i"
        @click="pickRow(row)"
      >
        <!-- 40px target so a thumb can tick it; focus stays in the search box -->
        <span
          v-if="!row.create"
          class="flex items-center justify-center w-10 h-11 shrink-0 rounded-lg hover:bg-surface-gray-4"
          :title="isChecked(row) ? 'Untick' : 'Tick to pick several'"
          @click.stop="toggleRow(row)"
        >
          <FeatherIcon :name="isChecked(row) ? 'check-square' : 'square'" class="w-5 h-5" :class="isChecked(row) ? 'text-ink-blue-3' : iconTone" aria-hidden="true" />
        </span>
        <span v-else class="flex items-center justify-center w-10 h-11 shrink-0">
          <FeatherIcon name="plus" class="w-5 h-5 text-ink-blue-3" aria-hidden="true" />
        </span>
        <!-- The whole name, wrapped: long task names differ only near their end -->
        <span class="min-w-0 flex-1 py-2" :title="row.hover">
          <span class="block text-base leading-snug break-words line-clamp-3" :class="row.create ? 'text-ink-blue-3 font-medium' : 'text-ink-gray-8'">{{ row.label }}</span>
          <span v-if="row.meta && row.meta.length" class="mt-0.5 flex flex-wrap gap-x-1.5 text-sm" :class="mutedText">
            <template v-for="(m, j) in row.meta" :key="j">
              <span v-if="j" aria-hidden="true">·</span>
              <span :class="toneClass(m.tone, isDarkMode)">{{ m.text }}</span>
            </template>
          </span>
          <span v-else-if="row.description" class="mt-0.5 block text-sm" :class="mutedText">{{ row.description }}</span>
        </span>
      </li>
      <li v-if="!taskRows.length" class="px-3 py-6 text-center text-sm" :class="mutedText" role="presentation">
        No assigned tasks yet. Type a name to create one.
      </li>
    </ul>
  </div>
</template>

<script>
import { taskMeta, toneClass } from "../../utils/taskMeta.js";

let uid = 0;

export default {
  name: "PlanTaskStep",
  props: {
    query: { type: String, default: "" },
    // Refs ticked so far; the parent commits them to the form on continue
    checked: { type: Array, default: () => [] },
    taskOptions: { type: Array, default: () => [] },
    whenLine: { type: String, default: "" },
    isDarkMode: { type: Boolean, default: false },
  },
  // pick(refs, newSubject): go on with these tasks. continue: go on with the ticked ones.
  // skip: no task, the typed text names the block.
  emits: ["update:query", "update:checked", "pick", "continue", "skip"],
  data() {
    return { activeIndex: 0, listId: "plan-task-step-" + (++uid) };
  },
  watch: {
    query() {
      this.activeIndex = 0;
    },
  },
  computed: {
    // Matching tasks, then "Create task" when the text names none of them exactly
    taskRows() {
      const q = this.query.trim().toLowerCase();
      const rows = this.taskOptions
        .filter((t) => !q || String(t.label).toLowerCase().includes(q) || String(t.description || "").toLowerCase().includes(q))
        .slice(0, 50)
        .map((t) => {
          const meta = taskMeta(t);
          return { key: t.value, value: t.value, label: t.label, meta, hover: [t.label, ...meta.map((m) => m.text)].join("\n") };
        });
      if (q && !this.taskOptions.some((t) => String(t.label).trim().toLowerCase() === q)) {
        rows.push({ key: "__create", create: true, label: `Create task "${this.query.trim()}"`, description: "Adds it to your tasks and plans this time for it" });
      }
      return rows;
    },
    iconTone() {
      return this.isDarkMode ? "text-gray-300" : "text-gray-600";
    },
    mutedText() {
      return this.isDarkMode ? "text-gray-300" : "text-gray-700";
    },
  },
  methods: {
    toneClass,
    optionId(i) {
      return `${this.listId}-${i}`;
    },
    isChecked(row) {
      return !!row.value && this.checked.includes(row.value);
    },
    toggleRow(row) {
      if (!row || row.create) return;
      const next = this.checked.includes(row.value)
        ? this.checked.filter((v) => v !== row.value)
        : [...this.checked, row.value];
      this.$emit("update:checked", next);
    },
    // The row's body: this task, plus any already ticked, and on to the form
    pickRow(row) {
      if (!row) return;
      if (row.create) this.$emit("pick", this.checked, this.query.trim());
      else this.$emit("pick", [...this.checked.filter((v) => v !== row.value), row.value], "");
    },
    onTaskKey(e) {
      const n = this.taskRows.length;
      const moves = { ArrowDown: 1, ArrowUp: -1 };
      if (e.key in moves && n) {
        e.preventDefault();
        this.activeIndex = (this.activeIndex + moves[e.key] + n) % n;
      } else if ((e.key === "Home" || e.key === "End") && n && e.ctrlKey) {
        e.preventDefault();
        this.activeIndex = e.key === "Home" ? 0 : n - 1;
      } else if (e.key === "Enter" && e.shiftKey) {
        // Shift+Enter ticks the active row, as Space would in a list that held focus
        e.preventDefault();
        if (n) this.toggleRow(this.taskRows[this.activeIndex]);
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (n) this.pickRow(this.taskRows[this.activeIndex]);
        else this.$emit(this.checked.length ? "continue" : "skip");
        return;
      } else {
        return;
      }
      this.scrollActive();
    },
    scrollActive() {
      this.$nextTick(() => {
        const el = document.getElementById(this.optionId(this.activeIndex));
        if (el) el.scrollIntoView({ block: "nearest" });
      });
    },
    // Back from the form: focus the search and start on the task already linked
    focusOn(ref) {
      const at = this.taskRows.findIndex((r) => r.value && r.value === ref);
      this.activeIndex = at > 0 ? at : 0;
      const el = this.$refs.taskSearch && this.$refs.taskSearch.el;
      if (el) el.focus();
      this.scrollActive();
    },
  },
};
</script>
