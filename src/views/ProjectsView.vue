<template>
  <section class="rounded-2xl border overflow-hidden" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'" aria-labelledby="projects-heading">
    <!-- ERPNext owns Projects and Tasks; this page shows how each one is going and opens its tasks -->
    <div class="px-4 pt-3 border-b" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
      <div class="flex items-center justify-between gap-3 flex-wrap pb-2">
        <h2 id="projects-heading" class="text-base font-semibold" :class="strongText">Projects</h2>
        <div v-if="projects.length" class="w-full sm:w-64">
          <TextInput v-model="search" type="search" placeholder="Search projects" aria-label="Search projects">
            <template #prefix><FeatherIcon name="search" class="w-4 h-4" aria-hidden="true" /></template>
          </TextInput>
        </div>
      </div>
      <!-- One tab stop for the bar: Left and Right move between statuses -->
      <div v-if="projects.length" role="tablist" aria-label="Project status" class="flex items-end gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none]" @keydown="onTabKey">
        <button
          v-for="s in statusTabs"
          :id="'projects-tab-' + s.id"
          :key="s.id"
          type="button"
          role="tab"
          :aria-selected="status === s.id ? 'true' : 'false'"
          aria-controls="projects-panel"
          :tabindex="status === s.id ? 0 : -1"
          :data-status-tab="s.id"
          :class="[TAB, 'whitespace-nowrap shrink-0', tabTone(status === s.id)]"
          @click="status = s.id">
          {{ s.label }}
          <!-- The count only on the open tab, so four tabs fit a phone -->
          <span v-if="status === s.id" :class="[COUNT, countTone(true)]">{{ s.count }}</span>
          <span v-if="status === s.id" :class="INDICATOR" aria-hidden="true"></span>
        </button>
      </div>
    </div>

    <p v-if="loading && !projects.length" role="status" class="px-4 py-10 text-center text-sm" :class="mutedText">Loading projects</p>
    <div v-else-if="error" role="alert" class="px-4 py-10 text-center text-sm space-y-2" :class="mutedText">
      <p>{{ error }}</p>
      <Button variant="outline" label="Try again" @click="load">Try again</Button>
    </div>
    <p v-else-if="!available" class="px-4 py-10 text-center text-sm" :class="mutedText">
      Projects are not set up on this site.
    </p>
    <p v-else-if="!projects.length" class="px-4 py-10 text-center text-sm" :class="mutedText">
      {{ isClient ? 'No project has been shared with you yet.' : 'No projects yet. Projects you own, are a member of, or have tasks in show here.' }}
    </p>

    <div v-else id="projects-panel" role="tabpanel" :aria-labelledby="'projects-tab-' + status">
      <div v-if="!rows.length" class="px-4 py-10 text-center text-sm space-y-2" :class="mutedText">
        <p>No project matches.</p>
        <Button v-if="search" variant="ghost" label="Clear search" @click="search = ''">Clear search</Button>
      </div>
      <!-- One tab stop for the list: Up and Down move between projects, Home and End jump -->
      <ul v-else class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-100'" aria-label="Projects" @keydown="onRowKey">
        <li v-for="p in rows" :key="p.name">
          <button
            type="button"
            class="w-full text-left px-4 py-3 flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
            :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'"
            :title="[p.health_reason, hours(p)].filter(Boolean).join(' · ')"
            :tabindex="p.name === currentRow ? 0 : -1"
            :data-project-row="p.name"
            @focus="rowFocus = p.name"
            @click="openProject(p)">
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium break-words" :class="strongText">{{ p.title }}</span>
              <span class="block text-xs truncate" :class="mutedText">{{ meta(p) }}</span>
            </span>
            <Badge v-if="p.health" :theme="p.health === 'late' ? 'red' : 'orange'" variant="subtle" class="shrink-0">
              {{ p.health === 'late' ? 'Late' : 'At risk' }}<span class="sr-only">: {{ p.health_reason }}</span>
            </Badge>
            <span class="shrink-0 w-16 sm:w-24 flex flex-col items-end gap-1">
              <span class="text-xs tabular-nums" :class="mutedText">{{ pct(p.percent) }}%</span>
              <span class="block w-full h-1.5 rounded-full overflow-hidden" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" role="progressbar" :aria-valuenow="pct(p.percent)" aria-valuemin="0" aria-valuemax="100" :aria-label="p.title + ' complete'">
                <span class="block h-full rounded-full bg-blue-600 dark:bg-blue-400" :style="{ width: pct(p.percent) + '%' }"></span>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- A project's tasks, each under its milestone. Editing a task happens in the task form. -->
    <f-dialog :model-value="!!detail" :title="detail ? detail.project.title : ''" :subtitle="detail ? meta(detail.project) : ''" size="xl" @update:model-value="(v) => { if (!v) detail = null; }">
      <template v-if="detail">
        <p v-if="detail.project.health_reason" class="text-sm" :class="detail.project.health === 'late' ? lateText : riskText">
          {{ detail.project.health === 'late' ? 'Late' : 'At risk' }}: {{ detail.project.health_reason }}
        </p>
        <p class="text-sm" :class="mutedText">{{ hours(detail.project) }}</p>
        <p v-if="!tree.length" class="py-6 text-center text-sm" :class="mutedText">
          {{ detail.is_client ? 'No deliverables have been shared on this project yet.' : 'This project has no tasks yet.' }}
        </p>
        <ul v-else class="divide-y -mx-2" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-100'" :aria-label="'Tasks in ' + detail.project.title" @keydown="onTaskKey">
          <li v-for="t in tree" :key="t.name">
            <!-- A plain <button>: <component is="button"> would resolve to frappe-ui's global Button -->
            <div v-if="detail.is_client" class="py-2.5 pr-2 flex items-center gap-2" :style="indent(t)" :title="hours(t)">
              <span class="min-w-0 flex-1">
                <span class="block text-sm break-words" :class="[strongText, t.is_group ? 'font-semibold' : 'font-medium']">{{ t.subject }}</span>
                <span class="block text-xs truncate" :class="t.is_overdue ? lateText : mutedText">{{ taskMeta(t) }}</span>
              </span>
              <Badge v-if="t.is_milestone" theme="blue" variant="subtle" class="shrink-0">Milestone</Badge>
            </div>
            <button
              v-else
              type="button"
              class="w-full text-left py-2.5 pr-2 flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
              :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'"
              :style="indent(t)"
              :title="hours(t)"
              :tabindex="t.name === currentTask ? 0 : -1"
              :data-project-task="t.name"
              @focus="taskFocus = t.name"
              @click="openTask(t)">
              <span class="min-w-0 flex-1">
                <span class="block text-sm break-words" :class="[strongText, t.is_group ? 'font-semibold' : 'font-medium']">{{ t.subject }}</span>
                <span class="block text-xs truncate" :class="t.is_overdue ? lateText : mutedText">{{ taskMeta(t) }}</span>
              </span>
              <Badge v-if="t.is_milestone" theme="blue" variant="subtle" class="shrink-0">Milestone</Badge>
              <Badge v-if="t.is_overdue" theme="red" variant="subtle" class="shrink-0">Overdue</Badge>
            </button>
          </li>
        </ul>
      </template>
    </f-dialog>
  </section>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { openTaskDetail } from '../composables/useTaskForm.js';
import { TAB, INDICATOR, COUNT, tabTone, countTone } from '../utils/materialTab.js';

// ERPNext Project statuses, in the order people work through them
const STATUSES = [
  { id: 'Open', label: 'Open' },
  { id: 'On hold', label: 'On hold' },
  { id: 'Completed', label: 'Completed' },
  { id: 'all', label: 'All' },
];
const HEALTH = { late: 0, at_risk: 1 };

export default {
  name: 'ProjectsView',
  setup() {
    return {
      ...useWorkstationContext(['extractErrorMessage', 'fmtHrs', 'isClient', 'isDarkMode', 'postJSON', 'showToast']),
      TAB, INDICATOR, COUNT, tabTone, countTone,
    };
  },
  data() {
    return {
      projects: [], available: true, loading: false, error: '',
      search: '', status: 'Open', rowFocus: '',
      detail: null, taskFocus: '',
    };
  },
  computed: {
    statusTabs() {
      return STATUSES.map((s) => ({
        ...s,
        count: s.id === 'all' ? this.projects.length : this.projects.filter((p) => p.status === s.id).length,
      }));
    },
    // Late first, then at risk, then the nearest end date
    rows() {
      const q = this.search.trim().toLowerCase();
      return this.projects
        .filter((p) => this.status === 'all' || p.status === this.status)
        .filter((p) => !q || [p.title, p.name, p.customer].some((v) => v && String(v).toLowerCase().includes(q)))
        .sort((a, b) => (HEALTH[a.health] ?? 2) - (HEALTH[b.health] ?? 2)
          || (a.end || '9999-12-31').localeCompare(b.end || '9999-12-31')
          || a.title.localeCompare(b.title));
    },
    currentRow() {
      return this.rows.some((p) => p.name === this.rowFocus) ? this.rowFocus : (this.rows[0] || {}).name;
    },
    // Tasks in outline order: each group task, then what sits under it
    tree() {
      if (!this.detail) return [];
      const tasks = this.detail.tasks;
      const names = new Set(tasks.map((t) => t.name));
      const kids = new Map();
      for (const t of tasks) {
        const parent = t.parent && names.has(t.parent) ? t.parent : '';
        if (!kids.has(parent)) kids.set(parent, []);
        kids.get(parent).push(t);
      }
      const out = [];
      const seen = new Set();
      const walk = (parent, depth) => {
        for (const t of kids.get(parent) || []) {
          if (seen.has(t.name)) continue;
          seen.add(t.name);
          out.push({ ...t, depth });
          walk(t.name, depth + 1);
        }
      };
      walk('', 0);
      return out;
    },
    currentTask() {
      return this.tree.some((t) => t.name === this.taskFocus) ? this.taskFocus : (this.tree[0] || {}).name;
    },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-900'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    lateText() { return this.isDarkMode ? 'text-red-300' : 'text-red-700'; },
    riskText() { return this.isDarkMode ? 'text-orange-300' : 'text-orange-700'; },
  },
  mounted() { this.load(); },
  methods: {
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const res = await this.postJSON('projects.get_projects');
        this.available = res.available !== false;
        this.projects = res.projects || [];
      } catch (e) {
        this.error = this.extractErrorMessage(e, 'Projects could not be loaded.');
      } finally {
        this.loading = false;
      }
    },
    async openProject(p) {
      try {
        this.detail = await this.postJSON('projects.get_project', { name: p.name });
        this.taskFocus = '';
      } catch (e) {
        this.showToast(this.extractErrorMessage(e, 'This project could not be opened.'), 'danger');
      }
    },
    openTask(t) {
      if (!this.detail || this.detail.is_client) return;
      const p = this.detail.project;
      openTaskDetail(
        { doctype: 'Task', name: t.name, ref: t.name, subject: t.subject, project: p.name, project_name: p.title },
        { onChange: () => { this.openProject(p); this.load(); } },
      );
    },
    // Subtasks sit under their milestone, up to three levels deep
    indent(t) { return { paddingLeft: (0.5 + Math.min(t.depth, 3) * 1.25) + 'rem' }; },
    pct(v) { return Math.max(0, Math.min(100, Math.round(Number(v) || 0))); },
    shortDate(d) {
      if (!d || d.length < 10) return '';
      const [y, m, day] = d.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: y === new Date().getFullYear() ? undefined : 'numeric' });
    },
    meta(p) {
      const open = !p.open_tasks ? '' : p.open_tasks === 1 ? '1 open task' : `${p.open_tasks} open tasks`;
      return [p.customer, p.end ? 'Due ' + this.shortDate(p.end) : '', open].filter(Boolean).join(' · ');
    },
    taskMeta(t) {
      const who = t.assignees && t.assignees.length ? t.assignees[0] + (t.assignees.length > 1 ? ` +${t.assignees.length - 1}` : '') : '';
      return [t.status, t.due ? 'Due ' + this.shortDate(t.due) : '', who].filter(Boolean).join(' · ');
    },
    // Hours on hover: what was estimated, booked on the calendar, and logged
    hours(x) {
      const h = (v) => this.fmtHrs(v || 0) + 'h';
      return [
        x.estimate_hours > 0 ? 'Estimate ' + h(x.estimate_hours) : '',
        x.planned_hours != null ? 'Planned ' + h(x.planned_hours) : '',
        x.logged_hours != null ? 'Logged ' + h(x.logged_hours) : '',
      ].filter(Boolean).join(' · ');
    },
    // Moves the roving focus within a list of [data-attr] items
    rove(e, list, current, attr, set) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !list.length) return;
      // The event's currentTarget is gone by the next tick; the dialog list is teleported out of $el
      const root = e.currentTarget;
      let i = list.findIndex((x) => x.name === current);
      if (e.key === 'ArrowDown') i = Math.min(list.length - 1, i + 1);
      else if (e.key === 'ArrowUp') i = Math.max(0, i - 1);
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = list.length - 1;
      else return;
      e.preventDefault();
      set(list[i].name);
      this.$nextTick(() => {
        const el = root.querySelector(`[${attr}="${CSS.escape(list[i].name)}"]`);
        if (el) el.focus();
      });
    },
    onRowKey(e) {
      if (!e.target.closest('[data-project-row]')) return;
      this.rove(e, this.rows, this.currentRow, 'data-project-row', (n) => { this.rowFocus = n; });
    },
    onTaskKey(e) {
      if (!e.target.closest('[data-project-task]') || this.detail.is_client) return;
      this.rove(e, this.tree, this.currentTask, 'data-project-task', (n) => { this.taskFocus = n; });
    },
    onTabKey(e) {
      const ids = STATUSES.map((s) => s.id);
      let i = ids.indexOf(this.status);
      if (e.key === 'ArrowRight') i = (i + 1) % ids.length;
      else if (e.key === 'ArrowLeft') i = (i - 1 + ids.length) % ids.length;
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = ids.length - 1;
      else return;
      e.preventDefault();
      this.status = ids[i];
      this.$nextTick(() => {
        const el = this.$el.querySelector(`[data-status-tab="${CSS.escape(ids[i])}"]`);
        if (el) el.focus();
      });
    },
  },
};
</script>
