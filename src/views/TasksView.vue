<template>
  <section class="rounded-2xl border overflow-hidden" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'" aria-labelledby="tasks-heading">
    <!-- Toolbar: search, project, person. Editing, moves and discussion live in the task form. -->
    <div class="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
      <h2 id="tasks-heading" class="text-base font-semibold" :class="strongText">Tasks</h2>
      <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        <div class="flex-1 sm:flex-none sm:w-56">
          <TextInput v-model="search" type="search" placeholder="Search tasks" aria-label="Search tasks">
            <template #prefix><FeatherIcon name="search" class="w-4 h-4" aria-hidden="true" /></template>
          </TextInput>
        </div>
        <div v-if="projectOptions.length > 2" class="w-full sm:w-48">
          <Combobox open-on-click :model-value="project" :options="projectOptions" placeholder="All projects" aria-label="Show tasks for project" @update:model-value="setProject" />
        </div>
        <div v-if="isManager" class="w-full sm:w-52">
          <Combobox open-on-click :model-value="selectedEmployee" :options="employeeOptions" placeholder="Search teammates" aria-label="Show tasks for" @update:model-value="setSelectedEmployee" />
        </div>
      </div>
    </div>

    <p v-if="!tasks.length" class="px-4 py-10 text-center text-sm" :class="mutedText">
      No open tasks. Tasks assigned in Desk, and tasks added while planning a block, show here.
    </p>
    <div v-else-if="!rows.length" class="px-4 py-10 text-center text-sm space-y-2" :class="mutedText">
      <p>No task matches.</p>
      <Button variant="ghost" label="Clear filters" @click="clearFilters">Clear filters</Button>
    </div>

    <!-- Grouped by what to do next. One tab stop for the whole list: arrows move between
         rows and between a row's actions, Home and End jump to the first and last row. -->
    <div v-else @keydown="onKey">
      <section v-for="g in groups" :key="g.id" :aria-labelledby="'tasks-group-' + g.id">
        <h3 :id="'tasks-group-' + g.id" class="px-4 pt-4 pb-1 text-sm font-semibold flex items-center gap-2" :class="g.id === 'overdue' ? overText : strongText">
          {{ g.label }}<span class="font-normal tabular-nums" :class="mutedText">{{ g.items.length }}</span>
        </h3>
        <ul class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-100'" :aria-labelledby="'tasks-group-' + g.id">
          <li v-for="t in g.items" :key="t.ref" class="flex items-center gap-1 pr-2" :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'">
            <button
              type="button"
              class="min-w-0 flex-1 text-left px-4 py-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
              :title="details(t)"
              :tabindex="tabindex(t, 0)"
              :data-task-cell="cellKey(t, 0)"
              @focus="cell = [t.ref, 0]"
              @click="open(t)">
              <span class="block text-sm font-medium break-words" :class="strongText">{{ t.subject }}</span>
              <span class="block text-xs truncate" :class="mutedText">{{ meta(t) }}</span>
            </button>
            <Badge v-if="isHigh(t)" theme="red" variant="subtle" class="shrink-0">{{ t.priority }}</Badge>
            <Button variant="outline" size="sm" icon-left="calendar" class="shrink-0" :label="'Plan ' + t.subject" :tabindex="tabindex(t, 1)" :data-task-cell="cellKey(t, 1)" @focus="cell = [t.ref, 1]" @click="planAttentionTask(t)">Plan</Button>
            <Button variant="ghost" size="sm" icon="play" class="shrink-0" tooltip="Start session" :label="'Start session on ' + t.subject" :tabindex="tabindex(t, 2)" :data-task-cell="cellKey(t, 2)" @focus="cell = [t.ref, 2]" @click="startTaskImmediately(t)" />
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { openTaskDetail } from '../composables/useTaskForm.js';

const ALL_PROJECTS = '';
const PRIORITY = { urgent: 0, high: 1, medium: 2, low: 3 };

export default {
  name: 'TasksView',
  setup() {
    return useWorkstationContext([
      'assignedTasks',
      'employeeOptions',
      'fetchWorkstationData',
      'fmtHrs',
      'isDarkMode',
      'isManager',
      'planAttentionTask',
      'selectedEmployee',
      'setSelectedEmployee',
      'startTaskImmediately'
    ]);
  },
  data() {
    return { search: '', project: ALL_PROJECTS, cell: ['', 0] };
  },
  computed: {
    tasks() { return this.assignedTasks || []; },
    projectOptions() {
      const seen = new Map();
      for (const t of this.tasks) if (t.project) seen.set(t.project, t.project_name || t.project);
      const list = [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
      return [{ value: ALL_PROJECTS, label: 'All projects' }, ...list];
    },
    rows() {
      const q = this.search.trim().toLowerCase();
      return this.tasks.filter((t) => {
        if (this.project && t.project !== this.project) return false;
        if (!q) return true;
        return [t.subject, t.project_name, t.project, t.status].some((v) => v && String(v).toLowerCase().includes(q));
      });
    },
    // What to do next decides the group: late first, then today, then work with no time booked
    groups() {
      const defs = [
        { id: 'overdue', label: 'Overdue', test: (t) => t.is_overdue },
        { id: 'today', label: 'Due today', test: (t) => t.is_due_today },
        { id: 'unplanned', label: 'Not planned yet', test: (t) => t.is_unplanned },
        { id: 'planned', label: 'Planned', test: () => true },
      ];
      const left = [...this.rows].sort(this.byUrgency);
      return defs.map((d) => {
        const items = left.filter(d.test);
        for (const t of items) left.splice(left.indexOf(t), 1);
        return { id: d.id, label: d.label, items };
      }).filter((g) => g.items.length);
    },
    flat() { return this.groups.flatMap((g) => g.items); },
    // The roving cell, kept on a row that is still listed
    current() {
      const [ref, col] = this.cell;
      const row = this.flat.find((t) => t.ref === ref) || this.flat[0];
      return row ? [row.ref, row.ref === ref ? col : 0] : ['', 0];
    },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-900'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    overText() { return this.isDarkMode ? 'text-red-300' : 'text-red-700'; },
  },
  methods: {
    isHigh(t) { return ['high', 'urgent'].includes(String(t.priority || '').toLowerCase()); },
    byUrgency(a, b) {
      const p = (t) => PRIORITY[String(t.priority || '').toLowerCase()] ?? 4;
      return (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31') || p(a) - p(b) || String(a.subject).localeCompare(String(b.subject));
    },
    shortDate(d) {
      if (!d || d.length < 10) return '';
      const [y, m, day] = d.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    meta(t) {
      return [t.project_name || t.project || 'No project', t.due_date ? 'Due ' + this.shortDate(t.due_date) : '', t.status].filter(Boolean).join(' · ');
    },
    // Hours and the reason it needs attention, on hover
    details(t) {
      const h = (v) => this.fmtHrs(v || 0) + 'h';
      return [
        t.attention_reason || '',
        'Planned ' + h(t.booked_hours) + (t.estimate_hours > 0 ? ' of ' + h(t.estimate_hours) : ''),
        t.logged_hours > 0 ? 'Logged ' + h(t.logged_hours) : '',
      ].filter(Boolean).join(' · ');
    },
    cellKey(t, col) { return t.ref + ':' + col; },
    tabindex(t, col) { return this.current[0] === t.ref && this.current[1] === col ? 0 : -1; },
    open(t) { openTaskDetail(t, { onChange: () => this.fetchWorkstationData(this.selectedEmployee) }); },
    setProject(v) { this.project = this.projectOptions.some((o) => o.value === v) ? v : ALL_PROJECTS; },
    clearFilters() { this.search = ''; this.project = ALL_PROJECTS; },
    onKey(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (!e.target.closest('[data-task-cell]')) return;
      const rows = this.flat;
      let r = rows.findIndex((t) => t.ref === this.current[0]);
      let c = this.current[1];
      if (e.key === 'ArrowDown') r = Math.min(rows.length - 1, r + 1);
      else if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
      else if (e.key === 'ArrowRight') c = Math.min(2, c + 1);
      else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
      else if (e.key === 'Home') r = 0;
      else if (e.key === 'End') r = rows.length - 1;
      else return;
      e.preventDefault();
      this.cell = [rows[r].ref, c];
      this.$nextTick(() => {
        const el = this.$el.querySelector(`[data-task-cell="${CSS.escape(this.cellKey(rows[r], c))}"]`);
        if (el) el.focus();
      });
    },
  },
};
</script>
