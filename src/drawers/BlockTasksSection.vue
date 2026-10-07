<template>
  <!-- The tasks this block is for. Tick one off where you see it; the task opens its details.
       A grid for the keyboard: one tab stop, Up/Down move between rows, Left/Right between
       the checkbox and the task (WAI-ARIA grid pattern, as the dashboard lists do). -->
  <section v-if="rows.length || canAdd" class="space-y-2" :aria-labelledby="headId">
    <div class="flex items-center justify-between gap-2">
      <h3 :id="headId" class="text-sm font-medium" :class="mutedText">Tasks ({{ rows.length }})</h3>
      <Button v-if="canAdd" variant="ghost" icon-left="plus" label="Add tasks" @click="showAdd = true">Add</Button>
    </div>
    <p v-if="!rows.length" class="text-sm py-1" :class="mutedText">No tasks yet. Add what this time is for.</p>
    <ul v-else ref="list" class="-mx-2" @keydown="onKey">
      <li v-for="(t, i) in rows" :key="t.ref || t.id" class="group flex items-start gap-1 rounded-lg px-1 py-0.5" :class="hoverRow">
        <!-- A checkbox built from a frappe-ui Button, as ChoiceChips builds radios: frappe-ui's
             Checkbox puts tabindex and aria-label on its wrapper too (a second tab stop). -->
        <Button
          variant="ghost"
          role="checkbox"
          :icon="t.done ? 'check-circle' : 'circle'"
          :label="t.subject"
          :aria-checked="t.done ? 'true' : 'false'"
          :tooltip="t.locked ? t.meta : (t.done ? 'Mark not done' : 'Mark done')"
          :disabled="!canChange"
          :aria-disabled="t.locked ? 'true' : undefined"
          :tabindex="tabStop(i, 0)"
          :data-cell="i + ':0'"
          @focus="cell = [i, 0]"
          class="shrink-0"
          :class="t.done ? doneTone : iconTone"
          @click="toggle(t, !t.done)"
        />
        <!-- The task itself opens its details (Edit and its workflow steps are there) -->
        <button type="button" class="min-w-0 flex-1 rounded-lg px-1 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" :tabindex="tabStop(i, 1)" :data-cell="i + ':1'" @focus="cell = [i, 1]" @click="edit(t)">
          <span class="block text-base leading-snug break-words" :class="t.done ? [mutedText, 'line-through'] : strongText">{{ t.subject }}</span>
          <span v-if="t.meta" class="block text-sm" :class="mutedText">{{ t.meta }}</span>
        </button>
      </li>
    </ul>

    <AddBlockTasksDialog v-model="showAdd" :block="block" :is-dark-mode="isDarkMode" />
  </section>
</template>

<script>
import AddBlockTasksDialog from './AddBlockTasksDialog.vue';
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { shortDate } from '../utils/taskMeta.js';
import { openTaskForm, openTaskDetail } from '../composables/useTaskForm.js';

export const isRowDone = (t) => !!t.completed_at || ['Done', 'Closed', 'Completed'].includes(t.status);

export default {
  name: 'BlockTasksSection',
  components: { AddBlockTasksDialog },
  props: {
    block: { type: Object, required: true },
    isDarkMode: { type: Boolean, default: false },
  },
  setup() {
    return useWorkstationContext(['toggleTaskDone', 'isPastBlock', 'isManager', 'currentUser', 'removeSessionTask', 'onSessionTaskChange']);
  },
  data() {
    return { busy: '', showAdd: false, cell: [0, 0] };
  },
  computed: {
    // The block drawer and the session popup can both show a list at once
    headId() { return 'block-tasks-' + this.$.uid; },
    rows() {
      return (this.block.tasks || []).map((t) => {
        const done = isRowDone(t);
        const moved = t.status === 'Rescheduled' || !!t.rescheduled_to;
        const meta = [
          t.project,
          moved ? 'Moved to ' + (t.rescheduled_to ? shortDate(t.rescheduled_to) : 'another block') : (t.status && !['Open', 'Pending', 'Completed', 'Closed', 'Done'].includes(t.status) ? t.status : ''),
        ].filter(Boolean).join(' · ');
        return { ...t, subject: t.subject || t.reference_name || t.work_item, done, locked: moved, meta };
      });
    },
    // Same people the server lets change a block's tasks (api/tasks._can_change_block),
    // and only while its plan is open: a past block's tasks can be ticked, not swapped.
    canChange() {
      const b = this.block, me = this.currentUser;
      return this.isManager || [b.employee, b.owner, b.pairing_partner].includes(me);
    },
    // A running session with no block yet keeps its own list (is_session_tasks); the planner's
    // other live pseudo blocks have nothing to add to
    canAdd() {
      return (this.block.is_session_tasks || !this.block.is_live_active) && this.canChange && !this.isPastBlock(this.block) && this.block.status !== 'Cancelled';
    },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-800'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    iconTone() { return this.isDarkMode ? '!text-gray-300' : '!text-gray-700'; },
    doneTone() { return this.isDarkMode ? '!text-blue-300' : '!text-blue-700'; },
    hoverRow() { return this.isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'; },
  },
  watch: {
    'block.name'() { this.showAdd = false; this.cell = [0, 0]; },
    rows(list) { if (this.cell[0] >= list.length) this.cell = [Math.max(0, list.length - 1), this.cell[1]]; },
  },
  methods: {
    // A checkbox nobody here may tick is disabled, so the task is the only stop in its row
    tabStop(row, col) {
      const c = this.canChange ? this.cell[1] : 1;
      return this.cell[0] === row && c === col ? 0 : -1;
    },
    async toggle(t, done) {
      const item = (this.block.tasks || []).find((x) => (x.ref || x.id) === (t.ref || t.id));
      // Not disabled while busy or moved: a disabled button drops focus mid-keyboard
      if (!item || !this.canChange || t.locked || this.busy) return;
      this.busy = t.ref;
      try { await this.toggleTaskDone(this.block, item, !!done); } finally { this.busy = ''; }
    },
    // A block's task opens its details, told which block the row belongs to so Edit edits the
    // row. A running session's task opens the form straight away: mid-session is for quick edits.
    edit(t) {
      const row = (this.block.tasks || []).find((x) => (x.ref || x.id) === (t.ref || t.id)) || t;
      if (this.block.is_session_tasks) {
        openTaskForm(row, { onRemove: this.removeSessionTask, onChange: this.onSessionTaskChange });
      } else {
        openTaskDetail(row, { block: this.block, canRemove: this.canAdd });
      }
    },
    onKey(e) {
      const at = e.target && e.target.closest && e.target.closest('[data-cell]');
      if (!at) return;
      const [r, c] = at.dataset.cell.split(':').map(Number);
      const last = this.rows.length - 1;
      const first = this.canChange ? 0 : 1;
      const next = { ArrowDown: [Math.min(last, r + 1), c], ArrowUp: [Math.max(0, r - 1), c], ArrowRight: [r, 1], ArrowLeft: [r, first], Home: [0, c], End: [last, c] }[e.key];
      if (!next) return;
      e.preventDefault();
      this.cell = next;
      this.$nextTick(() => {
        const el = this.$refs.list && this.$refs.list.querySelector(`[data-cell="${next[0]}:${next[1]}"]`);
        if (el) el.focus();
      });
    },
  },
};
</script>
