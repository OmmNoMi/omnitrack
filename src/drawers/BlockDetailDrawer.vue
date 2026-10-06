<template>
  <div>
    <!-- Scrim for the block side sheet -->
    <div v-if="show && block && !inline" @click="$emit('close')" class="fixed inset-0 z-[44] bg-black/30 transition-opacity" aria-hidden="true"></div>

    <!-- inline: the same details inside the session popup's Details tab, with no sheet, title,
         actions or task list (the popup shows those); Open block brings the full sheet. -->
    <transition :enter-active-class="inline ? '' : 'transition ease-out duration-150'" enter-from-class="translate-x-full" enter-to-class="translate-x-0" :leave-active-class="inline ? '' : 'transition ease-in duration-100'" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="show && block" :class="inline ? '' : ['fixed inset-y-0 right-0 z-[45] w-full max-w-md shadow-xl overflow-y-auto sm:rounded-l-2xl', isDarkMode ? 'bg-[#1E1F22]' : 'bg-white']" :role="inline ? null : 'dialog'" :aria-modal="inline ? null : 'true'" :aria-labelledby="inline ? null : 'block-drawer-title'">
        <div :class="inline ? 'space-y-5' : 'px-6 pt-4 pb-6 space-y-6'">

          <!-- Header: what, when, and one status -->
          <div class="space-y-2">
            <div v-if="!inline" class="flex items-start gap-1">
              <h2 id="block-drawer-title" class="min-w-0 flex-1 pt-1.5 text-[22px] leading-7 font-normal break-words" :class="strongText">{{ title }}</h2>
              <Button variant="ghost" icon="x" class="shrink-0" label="Close" @click="$emit('close')" />
            </div>
            <p class="flex items-center gap-2 text-base" :class="mutedText">
              <FeatherIcon name="clock" class="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{{ when }}</span>
            </p>
            <p v-if="block.project_name || block.project" class="flex items-center gap-2 text-base min-w-0" :class="mutedText">
              <FeatherIcon name="folder" class="w-4 h-4 shrink-0" aria-hidden="true" />
              <span class="truncate" :title="block.project_name || block.project">{{ block.project_name || block.project }}</span>
            </p>
            <div class="flex items-center gap-1.5 flex-wrap pt-1">
              <Badge v-if="!(inline && isRecording)" variant="subtle" size="md" :class="chip(status.tone)">{{ status.label }}</Badge>
              <Badge v-if="nature" variant="subtle" size="md" :class="chip('gray')">{{ nature }}</Badge>
              <Badge v-if="block.unplanned" variant="subtle" size="md" :class="chip('amber')" :title="block.unplanned_reason || 'Logged with no work block planned for it'">Unplanned</Badge>
              <Badge v-if="approvalBadge" variant="subtle" size="md" :class="chip(approvalBadge.tone)">{{ approvalBadge.label }}</Badge>
              <Badge v-if="block.pairing_partner" variant="subtle" size="md" :class="chip('blue')">With {{ block.pairing_partner_name || block.pairing_partner }}</Badge>
            </div>
            <p v-if="block.rescheduled_to || block.rescheduled_from" class="text-sm" :class="mutedText">
              {{ block.rescheduled_to ? 'Moved to ' + block.rescheduled_to : 'Moved from ' + block.rescheduled_from }}
            </p>
          </div>

          <!-- Actions: the session and the plan up front; the rarer ones behind More -->
          <div v-if="!inline" class="flex items-center gap-2">
            <Button v-if="!isBlockCompleted(block) && !isRecording" variant="solid" icon-left="play" label="Start Session" class="flex-1 !bg-blue-700 hover:!bg-blue-800 !text-white" @click="$emit('start-session', block)">Start Session</Button>
            <Button v-if="isRecording" variant="solid" theme="red" icon-left="square" label="Stop live session" class="flex-1 !bg-red-700 hover:!bg-red-800 !text-white" @click="$emit('stop-session', block)">Stop live session</Button>
            <Button v-if="isBlockReschedulable(block)" variant="outline" icon-left="calendar" label="Reschedule" aria-haspopup="dialog" @click="showReschedule = true">Reschedule</Button>
            <Dropdown v-if="moreActions.length" :options="moreActions" placement="right">
              <Button variant="ghost" icon="more-horizontal" label="More actions" />
            </Dropdown>
          </div>

          <BlockTasksSection v-if="!inline" :block="block" :is-dark-mode="isDarkMode" />

          <!-- Manager review: approve or flag here, with the logged sessions in view below -->
          <section v-if="canReview && hasLoggedTime && block.approval_status !== 'Approved'" class="rounded-xl p-4 space-y-3" :class="panelTone" aria-label="Review this timesheet">
            <p v-if="block.flagged_reason" class="text-sm" :class="isDarkMode ? 'text-amber-200' : 'text-amber-800'">Flagged: {{ block.flagged_reason }}</p>
            <div v-if="flagging" class="space-y-2">
              <TextInput ref="flagInput" v-model="flagReason" variant="outline" placeholder="What needs clarifying?" aria-label="Reason for flagging" @keydown.enter="sendFlag" @keydown.esc.stop="flagging = false" />
              <div class="flex justify-end gap-2">
                <Button variant="ghost" label="Cancel" @click="flagging = false">Cancel</Button>
                <Button variant="solid" label="Send flag" :disabled="!flagReason.trim()" @click="sendFlag">Flag</Button>
              </div>
            </div>
            <div v-else class="flex gap-2">
              <Button variant="solid" icon-left="check" label="Approve this timesheet" class="flex-1 !bg-green-700 hover:!bg-green-800 !text-white" @click="$emit('approve', block)">Approve</Button>
              <Button variant="outline" icon-left="flag" label="Flag for clarification" @click="startFlag">Flag</Button>
            </div>
          </section>

          <!-- Time: planned against logged, then each session -->
          <section class="space-y-2" aria-labelledby="block-drawer-time">
            <div class="flex items-baseline justify-between gap-2">
              <h3 id="block-drawer-time" class="text-sm font-medium" :class="mutedText">Time logged</h3>
              <p class="text-sm tabular-nums" :class="mutedText">
                <span class="font-medium" :class="strongText">{{ hrs(block.actual_hours) }}</span><template v-if="!block.is_live_active"> of {{ hrs(block.duration_hours) }} planned</template><template v-else> so far</template>
                <span v-if="block.actual_hours > 0 && Math.abs(block.variance_hours || 0) > 0.05" :class="block.variance_hours > 0 ? overText : underText">({{ block.variance_hours > 0 ? '+' : '−' }}{{ hrs(Math.abs(block.variance_hours)) }})</span>
              </p>
            </div>
            <div v-if="!block.is_live_active" class="w-full h-1 rounded-full overflow-hidden" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="Logged against planned">
              <div class="h-full rounded-full" :class="block.variance_hours > 0.25 ? 'bg-red-600' : 'bg-blue-600'" :style="{ width: progress + '%' }"></div>
            </div>
            <p v-if="!sessions.length" class="text-sm py-1" :class="mutedText">{{ isRecording ? 'Recording now. The time is logged here when you stop.' : 'Nothing logged yet. Start a session, or add a timesheet entry from More actions.' }}</p>
            <ul v-else class="-mx-2">
              <li v-for="s in sessions" :key="s.name || s.from_time" class="group flex items-start gap-1 rounded-lg pl-2 pr-1 py-1.5" :class="hoverRow">
                <div class="min-w-0 flex-1 py-0.5">
                  <p class="text-sm tabular-nums" :class="mutedText">{{ whenLine(s.session_date, s.from_time, s.to_time) || hrs(s.hours) }}</p>
                  <p v-if="s.notes" class="mt-0.5 text-base whitespace-pre-line break-words" :class="strongText">{{ s.notes }}</p>
                </div>
                <div v-if="canLogTimesheet(block) && s.name" class="flex shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  <Button variant="ghost" icon="edit-2" label="Edit session" @click="$emit('edit-session', s, block)" />
                  <Button variant="ghost" icon="trash-2" label="Delete session" @click="$emit('delete-session', s, block)" />
                </div>
              </li>
            </ul>
          </section>

          <!-- What this block should produce -->
          <section v-if="block.deliverable_target || block.deliverable_output_summary || showNotes" class="space-y-1.5" aria-labelledby="block-drawer-output">
            <h3 id="block-drawer-output" class="text-sm font-medium" :class="mutedText">{{ isRecording ? 'Done this session' : 'Output' }}</h3>
            <p v-if="block.deliverable_target" class="text-base" :class="strongText">Target: {{ block.deliverable_target }} {{ block.deliverable_metric || 'units' }}</p>
            <p v-if="showNotes && notes.text" class="text-base whitespace-pre-line break-words" :class="strongText">{{ notes.text }}</p>
            <ul v-if="showNotes && notes.done.length" class="space-y-1" aria-label="Tasks completed">
              <li v-for="d in notes.done" :key="d" class="flex items-start gap-2 text-base" :class="strongText">
                <FeatherIcon name="check-circle" class="w-4 h-4 mt-1 shrink-0" :class="isDarkMode ? 'text-blue-300' : 'text-blue-700'" aria-hidden="true" />
                <span class="min-w-0 break-words">{{ d }}</span>
              </li>
            </ul>
            <p v-if="block.deliverable_output_summary" class="text-base whitespace-pre-wrap" :class="strongText"><span class="font-medium">Achieved:</span> {{ block.deliverable_output_summary }}</p>
          </section>

          <!-- Inline, the rest of the block (reschedule, edit, earlier days) is one step away -->
          <Button v-if="inline && !block.is_session_tasks" variant="outline" icon-left="maximize-2" class="w-full" label="Open block" @click="$emit('open-full', block)">Open block</Button>

          <!-- The task's discussion lives in Raven -->
          <Button v-if="!inline" variant="outline" icon-left="message-square" class="w-full" label="Open discussion" @click="$emit('open-raven', block)">
            {{ drawerChatMessages && drawerChatMessages.length ? `Discussion (${drawerChatMessages.length})` : 'Open discussion' }}
          </Button>

        </div>
      </div>
    </transition>
    <RescheduleBlockDialog v-if="block" v-model="showReschedule" :block="block" :title="title" :busy="plannerBusy" :is-dark-mode="isDarkMode" @submit="$emit('submit-reschedule', $event)" />
    <EditBlockDialog v-if="block" v-model="showEdit" :block="block" :title="title" :is-dark-mode="isDarkMode" />
  </div>
</template>

<script>
import BlockTasksSection from './BlockTasksSection.vue';
import RescheduleBlockDialog from './RescheduleBlockDialog.vue';
import EditBlockDialog from './EditBlockDialog.vue';
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { toneChipClass } from '../utils/taskState.js';
import { whenLine } from '../utils/clockTime.js';
import { hrs } from '../utils/taskMeta.js';
import { WORK, toKind } from '../utils/activity.js';


export default {
  name: 'BlockDetailDrawer',
  components: { BlockTasksSection, RescheduleBlockDialog, EditBlockDialog },
  props: {
    show: { type: Boolean, default: false },
    inline: { type: Boolean, default: false },
    block: { type: Object, default: () => null },
    isDarkMode: { type: Boolean, default: false },
    isTracking: { type: Boolean, default: false },
    trackerBlockName: { type: String, default: '' },
    plannerBusy: { type: Boolean, default: false },
    drawerChatMessages: { type: Array, default: () => [] },
    isBlockCompleted: { type: Function, default: () => false },
    isBlockReschedulable: { type: Function, default: () => false },
    isBlockCancellable: { type: Function, default: () => false },
    canLogTimesheet: { type: Function, default: () => true },
    canReview: { type: Boolean, default: false }
  },
  setup() {
    return useWorkstationContext(['isPastBlock', 'isManager', 'currentUser']);
  },
  data() {
    return { flagging: false, flagReason: '', showReschedule: false, showEdit: false };
  },
  computed: {
    title() {
      const b = this.block;
      return b.task_subject || b.work_item_label || b.deliverable_notes || 'Work block';
    },
    when() {
      return whenLine(this.block.work_date, this.block.start_time, this.block.end_time);
    },
    // The planner draws an unplanned live session as a block of its own (is_live_active)
    isRecording() {
      return !!this.block.is_live_active || (this.isTracking && this.trackerBlockName === this.block.name);
    },
    status() {
      const b = this.block;
      if (this.isRecording) return { tone: 'red', label: 'Recording' };
      if (b.status === 'Cancelled') return { tone: 'red', label: b.cancel_reason ? `Cancelled: ${b.cancel_reason}` : 'Cancelled' };
      if (this.isBlockCompleted(b)) return { tone: 'green', label: b.status || 'Completed' };
      return { tone: b.status === 'Rescheduled' ? 'gray' : 'blue', label: b.status || 'Planned' };
    },
    // The activity, only when it says something: Work is the default
    nature() {
      const n = toKind(this.block.task_nature);
      return n === WORK ? '' : n;
    },
    // One status for approval, shown once in the header.
    approvalBadge() {
      const b = this.block;
      if (b.approval_status === 'Approved') return { tone: 'green', label: 'Approved' };
      if (b.approval_status === 'Flagged') return { tone: 'amber', label: 'Flagged' };
      if (this.hasLoggedTime) return { tone: 'gray', label: 'Awaiting approval' };
      return null;
    },
    // Editing the title, adding a timesheet entry and cancelling are rarer than starting a session
    moreActions() {
      const b = this.block, out = [];
      if (this.canEditBlock) out.push({ label: 'Edit block', icon: 'edit-2', onClick: () => { this.showEdit = true; } });
      if (this.canLogTimesheet(b)) out.push({ label: 'Add timesheet entry', icon: 'edit-3', onClick: () => this.$emit('log-session', b) });
      if (this.isBlockCancellable(b)) out.push({ label: 'Cancel block', icon: 'x-circle', theme: 'red', onClick: () => this.$emit('open-cancel-modal', b) });
      // An unplanned live session (is_live_active) has no block yet to edit or log against
      return b.is_live_active ? [] : out;
    },
    sessions() {
      return this.block.sessions || [];
    },
    // Time a manager can review: sessions that ended. A session still running is not a timesheet yet.
    hasLoggedTime() {
      return !this.isRecording && this.sessions.length > 0;
    },
    progress() {
      return Math.min(100, Math.round(((this.block.actual_hours || 0) / (this.block.duration_hours || 1)) * 100));
    },
    // Notes split into the tasks ticked off ("Completed: X", from a session) and anything else
    notes() {
      const done = [], text = [];
      for (const raw of String(this.block.deliverable_notes || '').split('\n')) {
        const line = raw.trim();
        const m = line.match(/^\W*Completed:\s*(.+)$/);
        if (m) { if (!done.includes(m[1])) done.push(m[1]); } else if (line) text.push(line);
      }
      return { done, text: text.join('\n') };
    },
    // Commitment notes, unless they are the title already
    showNotes() {
      const n = String(this.block.deliverable_notes || '').trim();
      return !!n && n !== this.title.trim();
    },
    // Its title and notes: the people update_work_block lets edit it, while its day is open
    canEditBlock() {
      const b = this.block;
      return (this.isManager || b.employee === this.currentUser) && !this.isPastBlock(b) && b.status !== 'Cancelled';
    },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-800'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    overText() { return this.isDarkMode ? 'text-red-300' : 'text-red-700'; },
    underText() { return this.isDarkMode ? 'text-green-300' : 'text-green-800'; },
    panelTone() { return this.isDarkMode ? 'bg-gray-800' : 'bg-gray-50'; },
    hoverRow() { return this.isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'; }
  },
  watch: {
    block() { this.flagging = false; this.flagReason = ''; this.showReschedule = false; this.showEdit = false; },
    show(open) { if (!open) { this.showReschedule = false; this.showEdit = false; } }
  },
  methods: {
    whenLine,
    hrs,
    chip(tone) { return toneChipClass(tone, this.isDarkMode); },
    startFlag() {
      this.flagReason = this.block.flagged_reason || '';
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
      this.$emit('flag', this.block, reason);
      this.flagging = false;
    }
  },
  emits: [
    'close',
    'open-full',
    'start-session',
    'stop-session',
    'open-cancel-modal',
    'log-session',
    'open-raven',
    'edit-session',
    'delete-session',
    'submit-reschedule',
    'approve',
    'flag'
  ]
}
</script>
