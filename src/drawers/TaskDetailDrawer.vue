<template>
  <div>
    <!-- Scrim for the task side sheet; it opens over a block or session sheet, so it sits above them -->
    <div v-if="taskDetail.open" class="fixed inset-0 z-[46] bg-black/30 transition-opacity" aria-hidden="true" @click="closeTaskDetail"></div>

    <!-- One Task or ToDo, read before anything changes: what it is, who it is for, where it stands
         in its workflow, and its description as written. Edit and every move go through the one
         task form, with the options the list that opened it passed. -->
    <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="taskDetail.open" ref="sheet" class="fixed inset-y-0 right-0 z-[47] w-full max-w-md shadow-xl overflow-y-auto sm:rounded-l-2xl" :class="isDarkMode ? 'bg-[#1E1F22]' : 'bg-white'" role="dialog" aria-modal="true" aria-labelledby="task-drawer-kind task-drawer-title" @keydown="onKey">
        <div class="px-6 pt-4 pb-6 space-y-6">

          <!-- Header: what kind of record, and its title -->
          <div class="space-y-2">
            <div class="flex items-center gap-1">
              <DetailKind id="task-drawer-kind" :kind="doc.doctype === 'ToDo' ? 'todo' : 'task'" :doc-name="doc.name" :is-dark-mode="isDarkMode" class="flex-1" />
              <Button variant="ghost" icon="x" class="shrink-0" label="Close" data-sheet-close @click="closeTaskDetail" />
            </div>
            <h2 id="task-drawer-title" class="min-w-0 text-[22px] leading-7 font-normal break-words" :class="strongText">{{ title }}</h2>
          </div>

          <!-- Its facts, each named: a bare chip ("Open", "High") did not say what it was -->
          <dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-base items-baseline">
            <template v-if="d">
              <dt :class="mutedText">Status</dt>
              <dd class="min-w-0"><Badge variant="subtle" size="md" :class="stateChip(state)" :title="stateHint">{{ state }}</Badge></dd>
            </template>
            <template v-if="due">
              <dt :class="mutedText">Due</dt>
              <dd class="min-w-0" :class="overdue ? lateText : strongText">{{ due }}<template v-if="overdue">, overdue</template></dd>
            </template>
            <template v-if="d && d.priority">
              <dt :class="mutedText">Priority</dt>
              <dd class="min-w-0" :class="strongText">{{ d.priority }}</dd>
            </template>
            <template v-if="project">
              <dt :class="mutedText">Project</dt>
              <dd class="min-w-0 break-words" :class="strongText">{{ project }}</dd>
            </template>
            <template v-if="people">
              <dt :class="mutedText">Assigned to</dt>
              <dd class="min-w-0 break-words" :class="strongText">{{ people }}</dd>
            </template>
          </dl>

          <!-- Said while the task loads, so the panel is never blank and its steps never jump in -->
          <p v-if="!d && !failed" class="text-sm" :class="mutedText" role="status">Loading the task…</p>

          <!-- Actions: the next workflow steps first, then Edit; the rest under More. Every step
               opens the one task form at its confirm step. -->
          <div v-if="d || failed" class="flex items-center gap-2 flex-wrap" role="group" aria-label="Task actions">
            <Button v-for="(m, i) in shownMoves" :key="m.label" size="md" :variant="i === 0 && !m.danger ? 'solid' : 'subtle'" :theme="m.danger ? 'red' : (i === 0 ? 'blue' : 'gray')" :class="m.danger ? '!text-red-700 dark:!text-red-300' : (i === 0 ? 'enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white' : '')" :icon-left="m.icon" :label="m.label" @click="m.onClick">{{ m.label }}</Button>
            <Button variant="subtle" size="md" icon-left="edit-2" label="Edit task" :disabled="!d" @click="edit()">Edit</Button>
            <Dropdown :options="moreMenu" placement="right">
              <Button variant="outline" size="md" icon-right="chevron-down" label="More" aria-haspopup="menu">More</Button>
            </Dropdown>
          </div>

          <p v-if="failed" class="text-sm" :class="mutedText">
            This task could not be loaded. <Button variant="ghost" size="sm" label="Try again" @click="load">Try again</Button>
          </p>

          <!-- Its description as it was written, links and lists kept (sanitized on the server) -->
          <section v-if="d && d.description_html" class="space-y-1.5" aria-labelledby="task-drawer-description">
            <h3 id="task-drawer-description" class="text-sm font-medium" :class="mutedText">Description</h3>
            <div class="prose prose-sm max-w-none break-words" :class="isDarkMode ? 'prose-invert' : ''" v-html="d.description_html"></div>
          </section>

          <!-- Hours ERPNext has logged on it, against what was expected -->
          <section v-if="d && (d.logged_hours || d.expected_hours)" class="space-y-1.5" aria-labelledby="task-drawer-hours">
            <h3 id="task-drawer-hours" class="text-sm font-medium" :class="mutedText">Time</h3>
            <p class="text-base tabular-nums" :class="strongText">
              {{ hrs(d.logged_hours) }} logged<template v-if="d.expected_hours"> of {{ hrs(d.expected_hours) }} expected</template>
            </p>
          </section>

          <!-- What was said and done on it, and a box to comment: its Frappe comments and history -->
          <DocActivity v-if="d" :doctype="doc.doctype" :name="doc.name" :is-dark-mode="isDarkMode" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { taskDetail, closeTaskDetail, openTaskForm, taskDocRef } from '../composables/useTaskForm.js';
import { stateChipClass, stateTone, isDangerMove, moveIcon } from '../utils/taskState.js';
import { hrs } from '../utils/taskMeta.js';
import { setScrollLock } from '../utils/scrollLock.js';
import DetailKind from '../components/common/DetailKind.vue';
import DocActivity from '../components/common/DocActivity.vue';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default {
  name: 'TaskDetailDrawer',
  components: { DetailKind, DocActivity },
  setup() {
    const ctx = useWorkstationContext(['postJSON', 'getTaskDeskUrl', 'openTaskRavenDrawer', 'isDarkMode']);
    return { ...ctx, taskDetail, closeTaskDetail };
  },
  data() {
    return { d: null, failed: false, seq: 0, opener: null };
  },
  computed: {
    doc() { return taskDocRef(taskDetail.task) || { doctype: 'Task', name: '' }; },
    title() {
      const t = taskDetail.task || {};
      return (this.d && this.d.subject) || t.subject || t.title || this.doc.name;
    },
    // Where it stands: its workflow state when it has one, its status otherwise
    state() { return (this.d && (this.d.state || this.d.status)) || 'Open'; },
    // On hover: which workflow, and the plain status behind the state when it differs
    stateHint() {
      if (!this.d || !this.d.workflow) return null;
      const behind = this.d.status && this.d.status !== this.state ? '; its status is ' + this.d.status : '';
      return 'A step in the ' + this.d.workflow + ' workflow' + behind;
    },
    finished() { return ['green', 'red'].includes(stateTone(this.state)) || ['green', 'red'].includes(stateTone(this.d && this.d.status)); },
    dueISO() { return String((this.d && this.d.due_date) || (taskDetail.task && taskDetail.task.due_date) || '').slice(0, 10); },
    due() {
      if (this.dueISO.length < 10) return '';
      const [y, m, day] = this.dueISO.split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: y === new Date().getFullYear() ? undefined : 'numeric' });
    },
    overdue() {
      if (!this.d || this.finished || this.dueISO.length < 10) return false;
      const now = new Date();
      const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      return this.dueISO < today;
    },
    project() {
      const t = taskDetail.task || {};
      return (this.d && (this.d.project_name || this.d.project)) || t.project_name || t.project || '';
    },
    people() { return ((this.d && this.d.assigned_to) || []).map((p) => p.name || p.user).join(', '); },
    // Every move opens the one task form at its confirm step, which asks for a comment
    stateMoves() {
      return ((this.d && this.d.actions) || []).map((a) => ({
        label: a.action,
        icon: moveIcon(a.action),
        theme: isDangerMove(a) ? 'red' : undefined,
        onClick: () => this.edit(a.action),
      }));
    },
    // The first two steps are buttons in the action bar, so the likely next step is one click
    shownMoves() { return this.stateMoves.slice(0, 2).map((m) => ({ ...m, danger: m.theme === 'red' })); },
    // The rest of the steps, then a Task's Raven chat (Raven is for Projects and their ERPNext
    // Tasks; a to-do is talked about in its Activity), then Desk
    moreMenu() {
      return [
        ...this.stateMoves.slice(2),
        ...(this.doc.doctype === 'Task' ? [{ label: 'Raven chat', icon: 'message-circle', onClick: () => this.openRaven() }] : []),
        { label: 'Open in Desk', icon: 'external-link', onClick: () => this.openDesk() },
      ];
    },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-800'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    lateText() { return this.isDarkMode ? 'text-red-200' : 'text-red-700'; },
  },
  watch: {
    'taskDetail.open': { immediate: true, handler(open) { if (open) this.open(); else this.closed(); } },
    'taskDetail.task'() { if (taskDetail.open) this.load(); },
  },
  beforeUnmount() { setScrollLock('task-detail', false); },
  methods: {
    hrs,
    stateChip(state) { return stateChipClass(state, this.isDarkMode); },
    open() {
      // Kept to hand focus back on close; a task opened from this one keeps the first opener
      if (!this.opener || !document.contains(this.opener)) this.opener = document.activeElement;
      setScrollLock('task-detail', true);
      this.load();
      this.$nextTick(() => {
        const el = this.$refs.sheet && this.$refs.sheet.querySelector('[data-sheet-close]');
        if (el) el.focus();
      });
    },
    // Back to the row that opened it, unless focus has moved somewhere on purpose
    closed() {
      setScrollLock('task-detail', false);
      const opener = this.opener;
      this.opener = null;
      const here = document.activeElement;
      const lost = !here || here === document.body || (this.$refs.sheet && this.$refs.sheet.contains(here));
      if (lost && opener && document.contains(opener)) opener.focus();
    },
    async load() {
      const r = taskDocRef(taskDetail.task);
      if (!r) return;
      const seq = ++this.seq;
      this.d = null;
      this.failed = false;
      try {
        const res = await this.postJSON('tasks.get_task_details', { task_id: r.name, doctype: r.doctype });
        if (seq === this.seq) this.d = res && res.name ? res : null;
        if (seq === this.seq && !this.d) this.failed = true;
      } catch (e) {
        if (seq === this.seq) this.failed = true;
      }
    },
    // The one task form, opened as the list that showed this task would have opened it. A save
    // or a move there reads this panel again.
    edit(ask = null) {
      const opts = taskDetail.opts || {};
      openTaskForm(taskDetail.task, {
        ...opts,
        ask,
        onChange: (t) => {
          if (typeof opts.onChange === 'function') opts.onChange(t);
          if (taskDetail.open) this.load();
        },
      });
    },
    openRaven() {
      const name = this.doc.name;
      closeTaskDetail();
      this.openTaskRavenDrawer({ doctype: 'Task', name, docname: name, id: name, ref: name, subject: this.title, project: this.project });
    },
    openDesk() {
      window.open(this.getTaskDeskUrl({ doctype: this.doc.doctype, docname: this.doc.name }), '_blank', 'noopener');
    },
    // Esc closes this sheet only (a list open inside it takes its own Escape first); Tab stays inside
    onKey(e) {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        e.stopPropagation();
        closeTaskDetail();
        return;
      }
      if (e.key !== 'Tab' || !this.$refs.sheet) return;
      const items = [...this.$refs.sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
  },
};
</script>
