<template>
  <div>
    <!-- Scrim for the session side sheet -->
    <div v-if="show && entry" @click="$emit('close')" class="fixed inset-0 z-[44] bg-black/30 transition-opacity" aria-hidden="true"></div>

    <!-- One logged Work Session: what got done, the task moves made while it ran, its approval,
         and the block it sits in. Any of those may be missing: an unplanned entry sits in a
         carrier block (no plan to show), and an entry may have no tasks. It never edits in place;
         Edit opens the one entry form. -->
    <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="show && entry" ref="sheet" class="fixed inset-y-0 right-0 z-[45] w-full max-w-md shadow-xl overflow-y-auto sm:rounded-l-2xl" :class="isDarkMode ? 'bg-[#1E1F22]' : 'bg-white'" role="dialog" aria-modal="true" aria-labelledby="session-drawer-kind session-drawer-title">
        <div class="px-6 pt-4 pb-6 space-y-6">

          <!-- Header: what kind of record, and its title -->
          <div class="space-y-2">
            <div class="flex items-center gap-1">
              <DetailKind id="session-drawer-kind" kind="session" :is-dark-mode="isDarkMode" class="flex-1" />
              <Button variant="ghost" icon="x" class="shrink-0" label="Close" data-sheet-close @click="$emit('close')" />
            </div>
            <h2 id="session-drawer-title" class="min-w-0 text-[22px] leading-7 font-normal break-words" :class="strongText">{{ title }}</h2>
          </div>

          <!-- Its facts, each named, as the task panel names them -->
          <dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-base items-baseline">
            <dt :class="mutedText">When</dt>
            <dd class="min-w-0 tabular-nums" :class="strongText" :title="loggedVia">{{ when }}</dd>
            <template v-if="project">
              <dt :class="mutedText">Project</dt>
              <dd class="min-w-0 break-words" :class="strongText">{{ project }}</dd>
            </template>
            <template v-if="person">
              <dt :class="mutedText">Logged by</dt>
              <dd class="min-w-0 break-words" :class="strongText">{{ person }}</dd>
            </template>
            <template v-if="nature">
              <dt :class="mutedText">Activity</dt>
              <dd class="min-w-0" :class="strongText">{{ nature }}</dd>
            </template>
            <template v-if="block.unplanned">
              <dt :class="mutedText">Work block</dt>
              <dd class="min-w-0 break-words" :class="strongText">None, logged unplanned<template v-if="block.unplanned_reason">: {{ block.unplanned_reason }}</template></dd>
            </template>
            <template v-if="approval">
              <dt :class="mutedText">Approval</dt>
              <dd class="min-w-0 space-y-1">
                <Badge variant="subtle" size="md" :class="chip(approval.tone)">{{ approval.label }}</Badge>
                <p v-if="approvalLine" class="text-sm break-words" :class="block.approval_status === 'Flagged' ? flagText : mutedText">{{ approvalLine }}</p>
              </dd>
            </template>
          </dl>

          <!-- Actions in one bar: the review first for a manager, then Edit; the rest under More -->
          <div v-if="!flagging" class="space-y-2">
            <div class="flex items-center gap-2 flex-wrap" role="group" aria-label="Session actions">
              <template v-if="canApprove">
                <Button variant="solid" size="md" icon-left="check" label="Approve this block's logged time" class="!bg-green-700 hover:!bg-green-800 !text-white" @click="$emit('approve-block', entry.block)">Approve</Button>
                <Button variant="subtle" size="md" icon-left="flag" label="Flag for clarification" @click="startFlag">Flag</Button>
              </template>
              <Button v-if="canEdit" variant="subtle" size="md" icon-left="edit-2" label="Edit session" @click="$emit('edit-session', session, entry.block)">Edit</Button>
              <Dropdown v-if="moreMenu.length" :options="moreMenu" placement="right">
                <Button variant="outline" size="md" icon-right="chevron-down" label="More" aria-haspopup="menu">More</Button>
              </Dropdown>
            </div>
            <p v-if="canApprove && block.entries > 1" class="text-sm" :class="mutedText">Approval covers all {{ block.entries }} entries in this work block.</p>
          </div>
          <div v-else class="space-y-2">
            <TextInput ref="flagInput" v-model="flagReason" variant="outline" placeholder="What needs clarifying?" aria-label="Reason for flagging" @keydown.enter="sendFlag" @keydown.esc.stop="flagging = false" />
            <div class="flex justify-end gap-2">
              <Button variant="ghost" label="Cancel" @click="flagging = false">Cancel</Button>
              <Button variant="solid" label="Send flag" :disabled="!flagReason.trim()" @click="sendFlag">Flag</Button>
            </div>
          </div>

          <p v-if="failed" class="text-sm" :class="mutedText">
            Could not load the rest of this session.
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

          <!-- The tasks it was for, and where each stands in its workflow now. A task opens its
               details panel, whose action bar holds its workflow steps. -->
          <section v-if="tasks.length" class="space-y-1.5" aria-labelledby="session-drawer-tasks">
            <h3 id="session-drawer-tasks" class="text-sm font-medium" :class="mutedText">Tasks ({{ tasks.length }})</h3>
            <ul ref="taskList" class="-mx-2" @keydown="onTaskKey">
              <li v-for="(t, i) in tasks" :key="t.ref || t.id" class="rounded-lg" :class="hoverRow">
                <button type="button" class="w-full flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-base [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" :tabindex="tabStop(i)" :data-cell="i" @click="openTask(t)" @focus="taskCell = i">
                  <span class="min-w-0 flex-1" :class="strongText">{{ t.subject || t.ref }}</span>
                  <span class="sr-only">, status </span>
                  <Badge variant="subtle" size="sm" class="shrink-0 mt-0.5" :class="stateChip(taskState(t))" :title="taskHint(t)">{{ taskState(t) }}</Badge>
                </button>
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

          <!-- What was said and done, and a box to comment: Frappe comments on its work block -->
          <DocActivity v-if="blockDoc" doctype="Planned Work Block" :name="blockDoc" :note="activityNote" :stamp="docStamp" :is-dark-mode="isDarkMode" />

        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { toneChipClass, stateChipClass } from '../utils/taskState.js';
import { whenLine, clock, toMin } from '../utils/clockTime.js';
import { hrs } from '../utils/taskMeta.js';
import { WORK, toKind } from '../utils/activity.js';
import { blockTitle } from '../utils/blockTitle.js';
import { openTaskDetail } from '../composables/useTaskForm.js';
import { approvalState } from '../utils/approval.js';
import DetailKind from '../components/common/DetailKind.vue';
import DocActivity from '../components/common/DocActivity.vue';

const APPROVAL_CHIP = { approved: 'green', flagged: 'amber', pending: 'gray' };
const VIA = { Manual: 'Typed in', Stopwatch: 'Timed with the stopwatch', Import: 'Imported', 'AI Assistant': 'Logged by the assistant' };

export default {
  name: 'SessionDetailDrawer',
  components: { DetailKind, DocActivity },
  props: {
    show: { type: Boolean, default: false },
    // { block, session }: the timeline row's block and session, shown until the server answers
    entry: { type: Object, default: null },
    isDarkMode: { type: Boolean, default: false },
    canLogTimesheet: { type: Function, default: () => true },
    canReview: { type: Boolean, default: false },
  },
  emits: ['close', 'open-block', 'edit-session', 'delete-session', 'approve-block', 'flag-block'],
  setup() {
    return useWorkstationContext(['postJSON', 'workBlocks', 'isManager', 'currentUser']);
  },
  data() {
    return { details: null, failed: false, flagging: false, flagReason: '', taskCell: 0, seq: 0 };
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
    // A manager reviews time not yet approved
    canApprove() { return this.canReview && this.block.approval_status !== 'Approved'; },
    // What the bar leaves out: removing the entry. Talk is in Activity below, not Raven.
    moreMenu() {
      return this.canEdit ? [{ label: 'Delete entry', icon: 'trash-2', theme: 'red', onClick: () => this.$emit('delete-session', this.session, this.entry.block) }] : [];
    },
    // A session is a row of its Planned Work Block, so what is said about it is said on the block
    blockDoc() { const b = this.block; return b.name && !b.is_live_active && !b.is_session_tasks ? b.name : ''; },
    activityNote() { return this.block.entries > 1 ? 'Shared by all ' + this.block.entries + ' entries in this work block.' : ''; },
    docStamp() { const b = this.block; return [b.modified, b.status, b.approval_status, b.actual_hours].join('|'); },
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
      this.taskCell = 0;
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
      openTaskDetail(t, { block: this.entry && this.entry.block, onChange: () => this.load() });
    },
    // The workflow state when the task has one; its status otherwise
    taskState(t) { return t.state || t.status || 'Open'; },
    taskHint(t) {
      const parts = [t.workflow && t.workflow + ' workflow', t.workflow && t.status && t.status !== t.state && 'status ' + t.status];
      return parts.filter(Boolean).join(', ') || null;
    },
    // A reload can drop a task: keep the list's one tab stop on something
    clampCell() { if (this.taskCell >= this.tasks.length) this.taskCell = 0; },
    tabStop(r) { return this.taskCell === r ? 0 : -1; },
    // One tab stop for the list: Up/Down/Home/End between tasks
    onTaskKey(e) {
      const at = e.target && e.target.closest && e.target.closest('[data-cell]');
      if (!at) return;
      const r = Number(at.dataset.cell);
      const last = this.tasks.length - 1;
      const next = { ArrowDown: Math.min(last, r + 1), ArrowUp: Math.max(0, r - 1), Home: 0, End: last }[e.key];
      if (next == null) return;
      e.preventDefault();
      this.taskCell = next;
      this.$nextTick(() => {
        const el = this.$refs.taskList && this.$refs.taskList.querySelector(`[data-cell="${next}"]`);
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
