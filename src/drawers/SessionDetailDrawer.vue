<template>
  <div>
    <!-- Scrim for the session side sheet -->
    <div v-if="show && entry" @click="$emit('close')" class="fixed inset-0 z-[44] bg-black/30 transition-opacity" aria-hidden="true"></div>

    <!-- One logged Work Session: what got done, the task moves made while it ran, its approval,
         and the block it sits in. Any of those may be missing: an unplanned entry sits in a
         carrier block (no plan to show), and an entry may have no tasks. It never edits in place;
         Edit opens the one entry form. -->
    <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="show && entry" ref="sheet" class="fixed inset-y-0 right-0 z-[45] w-full max-w-md shadow-xl overflow-y-auto sm:rounded-l-2xl" :class="isDarkMode ? 'bg-[#1E1F22]' : 'bg-white'" role="dialog" aria-modal="true" aria-labelledby="session-drawer-title">
        <div class="px-6 pt-4 pb-6 space-y-6">

          <!-- Header: what, when, who, and where it stands -->
          <div class="space-y-2">
            <div class="flex items-start gap-1">
              <h2 id="session-drawer-title" class="min-w-0 flex-1 pt-1.5 text-[22px] leading-7 font-normal break-words" :class="strongText">{{ title }}</h2>
              <Button variant="ghost" icon="x" class="shrink-0" label="Close" data-sheet-close @click="$emit('close')" />
            </div>
            <p class="flex items-center gap-2 text-base" :class="mutedText" :title="loggedVia">
              <FeatherIcon name="clock" class="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{{ when }}</span>
            </p>
            <p v-if="project" class="flex items-start gap-2 text-base min-w-0" :class="mutedText">
              <FeatherIcon name="folder" class="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span class="min-w-0 break-words">{{ project }}</span>
            </p>
            <p v-if="person" class="flex items-start gap-2 text-base min-w-0" :class="mutedText">
              <FeatherIcon name="user" class="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span class="min-w-0 break-words">{{ person }}</span>
            </p>
            <div class="flex items-center gap-1.5 flex-wrap pt-1">
              <Badge v-if="approval" variant="subtle" size="md" :class="chip(approval.tone)">{{ approval.label }}</Badge>
              <Badge v-if="block.unplanned" variant="subtle" size="md" :class="chip('amber')" :title="block.unplanned_reason || 'Logged with no work block planned for it'">Unplanned</Badge>
              <Badge v-if="nature" variant="subtle" size="md" :class="chip('gray')">{{ nature }}</Badge>
            </div>
            <p v-if="approvalLine" class="text-sm" :class="block.approval_status === 'Flagged' ? flagText : mutedText">{{ approvalLine }}</p>
          </div>

          <!-- Actions: the one entry form, and removing the entry -->
          <div v-if="canEdit" class="flex items-center gap-2">
            <Button variant="outline" icon-left="edit-2" label="Edit entry" class="flex-1" @click="$emit('edit-session', session, entry.block)">Edit entry</Button>
            <Button variant="outline" icon-left="trash-2" label="Delete entry" @click="$emit('delete-session', session, entry.block)">Delete</Button>
          </div>

          <!-- Manager review: approve or flag this entry, with what it did in view below -->
          <section v-if="canReview && block.approval_status !== 'Approved'" class="rounded-xl p-4 space-y-3" :class="panelTone" aria-label="Review this entry">
            <p v-if="block.entries > 1" class="text-sm" :class="mutedText">Approval covers all {{ block.entries }} entries in this work block.</p>
            <div v-if="flagging" class="space-y-2">
              <TextInput ref="flagInput" v-model="flagReason" variant="outline" placeholder="What needs clarifying?" aria-label="Reason for flagging" @keydown.enter="sendFlag" @keydown.esc.stop="flagging = false" />
              <div class="flex justify-end gap-2">
                <Button variant="ghost" label="Cancel" @click="flagging = false">Cancel</Button>
                <Button variant="solid" label="Send flag" :disabled="!flagReason.trim()" @click="sendFlag">Flag</Button>
              </div>
            </div>
            <div v-else class="flex gap-2">
              <Button variant="solid" icon-left="check" label="Approve this entry" class="flex-1 !bg-green-700 hover:!bg-green-800 !text-white" @click="$emit('approve-block', entry.block)">Approve</Button>
              <Button variant="outline" icon-left="flag" label="Flag for clarification" @click="startFlag">Flag</Button>
            </div>
          </section>

          <p v-if="failed" class="text-sm" :class="mutedText">
            Could not load the rest of this entry.
            <Button variant="ghost" label="Try again" @click="load">Try again</Button>
          </p>

          <!-- What got done: the entry's own lines; ticked tasks show once, under Task changes -->
          <section v-if="notes.text || notes.done.length" class="space-y-1.5" aria-labelledby="session-drawer-done">
            <h3 id="session-drawer-done" class="text-sm font-medium" :class="mutedText">What got done</h3>
            <p v-if="notes.text" class="text-base whitespace-pre-line break-words" :class="strongText">{{ notes.text }}</p>
            <ul v-if="notes.done.length" class="space-y-1" aria-label="Tasks completed">
              <li v-for="d in notes.done" :key="d" class="flex items-start gap-2 text-base" :class="strongText">
                <FeatherIcon name="check-circle" class="w-4 h-4 mt-1 shrink-0" :class="doneTone" aria-hidden="true" />
                <span class="min-w-0 break-words">{{ d }}</span>
              </li>
            </ul>
          </section>

          <!-- Task changes made while it ran: ticks on the block and status or workflow moves -->
          <section v-if="moves.length" class="space-y-1.5" aria-labelledby="session-drawer-moves">
            <h3 id="session-drawer-moves" class="text-sm font-medium" :class="mutedText">Task changes</h3>
            <ul class="space-y-2">
              <li v-for="(m, i) in moves" :key="i + m.at" class="flex items-start gap-2">
                <FeatherIcon :name="m.from ? 'git-commit' : 'check-circle'" class="w-4 h-4 mt-1 shrink-0" :class="m.from ? iconTone : doneTone" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <p class="text-base break-words" :class="strongText">{{ m.subject }}</p>
                  <p class="flex items-center gap-1.5 flex-wrap text-sm" :class="mutedText">
                    <template v-if="m.from">
                      <Badge variant="subtle" size="sm" :class="stateChip(m.from)">{{ m.from }}</Badge>
                      <span>to</span>
                    </template>
                    <Badge variant="subtle" size="sm" :class="stateChip(m.to)">{{ m.to }}</Badge>
                    <span class="tabular-nums">{{ at(m.at) }}</span>
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <!-- The tasks it was for, where each stands in its workflow now, and the moves open to
               you. A subject opens the one task form; a move opens it at that move's confirm step. -->
          <section v-if="tasks.length" class="space-y-1.5" aria-labelledby="session-drawer-tasks">
            <h3 id="session-drawer-tasks" class="text-sm font-medium" :class="mutedText">Tasks ({{ tasks.length }})</h3>
            <ul ref="taskList" class="-mx-2" @keydown="onTaskKey">
              <li v-for="(t, i) in tasks" :key="t.ref || t.id" class="flex items-start gap-2 rounded-lg pr-1 py-0.5" :class="hoverRow">
                <button type="button" class="min-w-0 flex-1 rounded-lg px-2 py-1 text-left text-base [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" :class="strongText" :tabindex="tabStop(i, 0)" :data-cell="i + ':0'" @click="openTask(t)" @focus="taskCell = [i, 0]">{{ t.subject || t.ref }}</button>
                <Dropdown v-if="taskMoves(t).length" :options="taskMoves(t)" placement="right" class="shrink-0 mt-0.5">
                  <Button variant="subtle" size="sm" icon-right="chevron-down" :class="stateChip(taskState(t))" :label="'Status of ' + (t.subject || t.ref) + ': ' + taskState(t)" :tooltip="taskHint(t)" :tabindex="tabStop(i, 1)" :data-cell="i + ':1'" @focus="taskCell = [i, 1]">{{ taskState(t) }}</Button>
                </Dropdown>
                <Badge v-else variant="subtle" size="sm" class="shrink-0 mt-1" :class="stateChip(taskState(t))" :title="taskHint(t) || 'No next step open to you from here'">{{ taskState(t) }}</Badge>
              </li>
            </ul>
          </section>

          <!-- The plan it was logged against; an unplanned entry has none -->
          <section v-if="!block.unplanned" class="space-y-2" aria-labelledby="session-drawer-block">
            <h3 id="session-drawer-block" class="text-sm font-medium" :class="mutedText">Work block</h3>
            <p v-if="planned !== when" class="text-base" :class="strongText">Planned {{ planned }}</p>
            <p v-if="loaded" class="text-sm tabular-nums" :class="mutedText">
              {{ hrs(block.actual_hours) }} of {{ hrs(block.duration_hours) }} planned, {{ block.entries === 1 ? 'in this one entry' : 'across ' + block.entries + ' entries' }}
            </p>
            <Button variant="outline" icon-left="maximize-2" class="w-full" label="Open work block" @click="$emit('open-block', entry.block)">Open work block</Button>
          </section>

          <!-- What the block produced, and where it was billed -->
          <section v-if="metrics.length" class="space-y-1.5" aria-labelledby="session-drawer-output">
            <h3 id="session-drawer-output" class="text-sm font-medium" :class="mutedText">Output</h3>
            <ul class="space-y-1">
              <li v-for="(m, i) in metrics" :key="i" class="text-base" :class="strongText" :title="m.notes || null">{{ m.quantity }} {{ m.unit }} {{ m.metric_type }}</li>
            </ul>
          </section>
          <p v-if="details && details.timesheet" class="text-sm" :class="mutedText">ERPNext Timesheet {{ details.timesheet.name }} ({{ details.timesheet.state }})</p>

          <!-- The task's discussion lives in Raven -->
          <Button variant="outline" icon-left="message-square" class="w-full" label="Open discussion" @click="$emit('open-raven', entry.block)">Open discussion</Button>

        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { toneChipClass, stateChipClass, isDangerMove, moveIcon } from '../utils/taskState.js';
import { whenLine, clock, toMin } from '../utils/clockTime.js';
import { hrs } from '../utils/taskMeta.js';
import { WORK, toKind } from '../utils/activity.js';
import { blockTitle } from '../utils/blockTitle.js';
import { openTaskForm } from '../composables/useTaskForm.js';
import { approvalState } from '../utils/approval.js';

const APPROVAL_CHIP = { approved: 'green', flagged: 'amber', pending: 'gray' };
const VIA = { Manual: 'Typed in', Stopwatch: 'Timed with the stopwatch', Import: 'Imported', 'AI Assistant': 'Logged by the assistant' };

export default {
  name: 'SessionDetailDrawer',
  props: {
    show: { type: Boolean, default: false },
    // { block, session }: the timeline row's block and session, shown until the server answers
    entry: { type: Object, default: null },
    isDarkMode: { type: Boolean, default: false },
    canLogTimesheet: { type: Function, default: () => true },
    canReview: { type: Boolean, default: false },
  },
  emits: ['close', 'open-block', 'edit-session', 'delete-session', 'approve-block', 'flag-block', 'open-raven'],
  setup() {
    return useWorkstationContext(['postJSON', 'workBlocks', 'isManager', 'currentUser']);
  },
  data() {
    return { details: null, failed: false, flagging: false, flagReason: '', taskCell: [0, 0], seq: 0 };
  },
  computed: {
    loaded() { return !!this.details; },
    openKey() { return this.show && this.entry && this.entry.session ? this.entry.session.name || '' : ''; },
    session() { return (this.details && this.details.session) || (this.entry && this.entry.session) || {}; },
    // The server's view of the block once it answers; the row's until then
    block() { return { ...((this.entry && this.entry.block) || {}), ...((this.details && this.details.block) || {}) }; },
    title() { return blockTitle(this.block, 'Work session'); },
    when() {
      const s = this.session;
      return whenLine(s.session_date, s.from_time, s.to_time) || hrs(s.hours);
    },
    loggedVia() { return VIA[this.session.logged_via] || null; },
    project() { return this.block.project_name || this.block.project || ''; },
    // Whose entry, when it is not mine (a manager reviewing)
    person() {
      const d = this.details;
      return d && d.employee && d.employee !== this.currentUser ? (d.employee_name || d.employee) : '';
    },
    nature() {
      const n = toKind(this.session.task_nature || this.block.task_nature);
      return n === WORK ? '' : n;
    },
    // The same review wording as the calendar and hover card (approvalState); the chip takes the short form
    approval() {
      const s = approvalState(this.block);
      return s && { tone: APPROVAL_CHIP[s.tone], label: s.short };
    },
    approvalLine() {
      const b = this.block;
      const s = approvalState(b);
      if (!s || s.tone === 'pending') return '';
      if (s.tone === 'flagged') return b.approval_notes ? s.label : '';
      const by = b.approved_by_name || b.approved_by;
      const on = b.approval_date ? whenLine(b.approval_date) : '';
      return ['Approved' + (by ? ' by ' + by : ''), on, b.approval_notes].filter(Boolean).join(' · ');
    },
    // The one entry form, for the people who may log on this block; an approved entry is a manager's
    canEdit() {
      const b = this.entry && this.entry.block;
      return !!b && !!this.session.name && this.canLogTimesheet(b) && (this.block.approval_status !== 'Approved' || this.isManager);
    },
    moves() { return (this.details && this.details.task_moves) || []; },
    tasks() { return (this.details && this.details.tasks) || (this.entry && this.entry.block && this.entry.block.tasks) || []; },
    metrics() { return (this.details && this.details.output_metrics) || []; },
    planned() { return whenLine(this.block.work_date, this.block.start_time, this.block.end_time); },
    // The entry's lines, with each "Completed: X" shown once: under Task changes when that move is there
    notes() {
      const moved = new Set(this.moves.map((m) => m.subject));
      const done = [], text = [];
      for (const raw of String(this.session.notes || '').split('\n')) {
        const line = raw.trim();
        const m = line.match(/^\W*Completed:\s*(.+)$/);
        if (m) { if (!moved.has(m[1]) && !done.includes(m[1])) done.push(m[1]); } else if (line) text.push(line);
      }
      // The title already says it when the entry is one line
      const said = text.join('\n');
      return { done, text: said === this.title.trim() ? '' : said };
    },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-800'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    iconTone() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    doneTone() { return this.isDarkMode ? 'text-blue-300' : 'text-blue-700'; },
    flagText() { return this.isDarkMode ? 'text-amber-200' : 'text-amber-800'; },
    // What the dashboard feed says about this entry's block; a change means the sheet is stale
    blockStamp() {
      const name = this.entry && this.entry.block && this.entry.block.name;
      const b = name && (this.workBlocks || []).find((x) => x.name === name);
      if (!b) return '';
      const sessions = (b.sessions || []).map((s) => [s.name, s.hours, s.from_time, s.to_time, s.notes]);
      return JSON.stringify([b.status, b.actual_hours, b.approval_status, b.approval_notes, b.deliverable_notes, b.project, b.work_item_label, sessions]);
    },
    panelTone() { return this.isDarkMode ? 'bg-gray-800' : 'bg-gray-50'; },
    hoverRow() { return this.isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'; },
  },
  watch: {
    // Opening sets the entry and show together: one read per entry opened
    openKey(key) { if (key) this.open(); else this.closed(); },
    // An approve, flag, edit or delete refreshes the dashboard; read the entry again only when
    // this entry's block came back different (the dashboard refreshes on a timer too)
    blockStamp(now, before) { if (now !== before && this.show && this.details) this.load(); },
    'entry.block.approval_status'() { if (this.show && this.details) this.load(); },
  },
  mounted() { if (this.openKey) this.open(); },
  methods: {
    hrs,
    chip(tone) { return toneChipClass(tone, this.isDarkMode); },
    stateChip(state) { return stateChipClass(state, this.isDarkMode); },
    at(iso) { const t = String(iso || '').slice(11, 16); return t ? clock(toMin(t)) : ''; },
    open() {
      // Kept to hand focus back on close; a sheet replacing this one keeps the first opener
      if (!this.opener || !document.contains(this.opener)) this.opener = document.activeElement;
      this.details = null;
      this.flagging = false;
      this.flagReason = '';
      this.taskCell = [0, 0];
      this.load();
      // Focus moves into the sheet (frappe-ui's Button root is not always the <button>)
      this.$nextTick(() => {
        const el = this.$refs.sheet && this.$refs.sheet.querySelector('[data-sheet-close]');
        if (el) el.focus();
      });
    },
    // Back to the bar that opened it, unless focus has moved somewhere on purpose
    closed() {
      this.flagging = false;
      const opener = this.opener;
      this.opener = null;
      const here = document.activeElement;
      const lost = !here || here === document.body || (this.$refs.sheet && this.$refs.sheet.contains(here));
      if (lost && opener && document.contains(opener)) opener.focus();
    },
    async load() {
      const name = this.entry && this.entry.session && this.entry.session.name;
      if (!name) return;
      const seq = ++this.seq;
      this.failed = false;
      try {
        const res = await this.postJSON('get_work_session', { session_name: name });
        if (seq !== this.seq) return;
        this.details = res && res.session ? res : null;
        this.clampCell();
      } catch (e) {
        if (seq !== this.seq) return;
        // Deleted (here or elsewhere): there is nothing left to show
        if (/not found/i.test(String((e && e.message) || e))) this.$emit('close');
        else this.failed = true;
      }
    },
    openTask(t) {
      openTaskForm(t, { block: this.entry && this.entry.block, onChange: () => this.load() });
    },
    // The workflow state when the task has one; its status otherwise
    taskState(t) { return t.state || t.status || 'Open'; },
    taskHint(t) {
      const parts = [t.workflow && t.workflow + ' workflow', t.workflow && t.status && t.status !== t.state && 'status ' + t.status];
      return parts.filter(Boolean).join(', ') || null;
    },
    // Every move goes through the one task form, which asks for a comment before applying it
    taskMoves(t) {
      return (t.actions || []).map((a) => ({
        label: a.action,
        icon: moveIcon(a.action),
        theme: isDangerMove(a) ? 'red' : undefined,
        onClick: () => openTaskForm(t, { block: this.entry && this.entry.block, ask: a.action, onChange: () => this.load() }),
      }));
    },
    // A reload can drop a task, or a move can leave none open: keep the list's one tab stop on something
    clampCell() {
      const [r, c] = this.taskCell;
      if (r >= this.tasks.length) this.taskCell = [0, 0];
      else if (c > 0 && !this.taskMoves(this.tasks[r]).length) this.taskCell = [r, 0];
    },
    tabStop(r, c) { return this.taskCell[0] === r && this.taskCell[1] === c ? 0 : -1; },
    // One tab stop for the list: Up/Down/Home/End between tasks, Left/Right between a task and its status
    onTaskKey(e) {
      const at = e.target && e.target.closest && e.target.closest('[data-cell]');
      if (!at) return;
      const [r, c] = at.dataset.cell.split(':').map(Number);
      const last = this.tasks.length - 1;
      const cols = (row) => (this.taskMoves(this.tasks[row]).length ? 1 : 0);
      const to = { ArrowDown: Math.min(last, r + 1), ArrowUp: Math.max(0, r - 1), Home: 0, End: last }[e.key];
      const next = to != null ? [to, Math.min(c, cols(to))] : { ArrowRight: [r, cols(r)], ArrowLeft: [r, 0] }[e.key];
      if (!next) return;
      e.preventDefault();
      this.taskCell = next;
      this.$nextTick(() => {
        const el = this.$refs.taskList && this.$refs.taskList.querySelector(`[data-cell="${next[0]}:${next[1]}"]`);
        if (el) el.focus();
      });
    },
    startFlag() {
      this.flagReason = this.block.approval_status === 'Flagged' ? (this.block.approval_notes || '') : '';
      this.flagging = true;
      this.$nextTick(() => {
        const el = this.$refs.flagInput && (this.$refs.flagInput.$el || this.$refs.flagInput);
        const input = el && el.querySelector ? el.querySelector('input') : null;
        if (input) input.focus();
      });
    },
    sendFlag() {
      const reason = this.flagReason.trim();
      if (!reason) return;
      this.$emit('flag-block', this.entry.block, reason);
      this.flagging = false;
    },
  },
};
</script>
