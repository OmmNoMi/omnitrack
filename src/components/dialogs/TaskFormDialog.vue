<template>
  <!-- The one task form (useTaskForm). A block's task row, the calendar's assigned work and
       the dashboard all open it: where the task stands in its workflow and the moves open
       to you, then its name, due day and priority, saved on the Task or ToDo itself. -->
  <f-dialog
    :model-value="taskForm.open"
    :title="heading"
    :subtitle="subtitle"
    size="md"
    :esc-back="!!confirming"
    @back="back"
    @update:model-value="!$event && closeTaskForm()"
  >
    <form class="space-y-4" @submit.prevent="save">
      <Textarea
        v-model="form.subject"
        variant="outline"
        size="md"
        :rows="2"
        label="Name"
        class="[&_textarea]:resize-none"
        :disabled="!editable"
        data-autofocus
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      />

      <!-- One row of properties, as in Frappe CRM's task modal: where it stands (its moves on
           click), when it is due, how urgent it is. -->
      <div v-if="loaded && detail.name" class="flex flex-wrap items-center gap-2 [&_input]:h-8 [&_input]:text-base">
        <div ref="state" tabindex="-1" class="outline-none">
          <Dropdown v-if="statusMenu.length" :options="statusMenu" placement="left">
            <Button variant="subtle" size="md" icon-right="chevron-down" :class="chip(detail.state)" :label="'Status: ' + (detail.state || 'Open')" :tooltip="stateHint" :disabled="!!busy">{{ detail.state || 'Open' }}</Button>
          </Dropdown>
          <Badge v-else size="lg" variant="subtle" class="h-8" :class="chip(detail.state)" :title="stateHint || 'No next step open to you from here'">{{ detail.state || 'Open' }}</Badge>
        </div>
        <div class="w-48">
          <DatePicker v-model="form.due_date" variant="subtle" format="ddd, D MMM YYYY" placeholder="Due day" label="Due" :disabled="!editable">
            <template #prefix><FeatherIcon name="calendar" class="h-4 w-4" :class="iconTone" aria-hidden="true" /></template>
          </DatePicker>
        </div>
        <Dropdown v-if="priorityMenu.length" :options="priorityMenu" placement="left">
          <Button variant="subtle" size="md" icon-left="flag" icon-right="chevron-down" :label="'Priority: ' + (form.priority || 'none')" :disabled="!editable">{{ form.priority || 'Priority' }}</Button>
        </Dropdown>
      </div>

      <div v-if="confirming" ref="confirm" class="rounded-lg border border-outline-gray-2 p-4 space-y-3">
        <p class="text-base" :class="strongText">
          {{ confirming.action }}? It moves to <span class="font-medium">{{ confirming.next_state }}</span>.
        </p>
        <Textarea v-model="comment" variant="outline" size="md" :rows="2" label="Comment (optional)" placeholder="Why, for whoever reads it next" class="[&_textarea]:resize-none" :disabled="busy === 'move'" />
        <div class="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" label="Back" :disabled="busy === 'move'" @click="back">Back</Button>
          <Button
            variant="solid"
            :theme="isDangerMove(confirming) ? 'red' : 'gray'"
            :label="confirming.action"
            :loading="busy === 'move'"
            :disabled="!!busy"
            data-confirm-working
            @click="move"
          >{{ confirming.action }}</Button>
        </div>
      </div>

      <p v-if="loaded && !detail.can_edit" class="text-sm" :class="mutedText">Only its owner can edit this task.</p>
    </form>

    <template #actions>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <div v-if="taskMenu.length" class="mr-auto">
          <Dropdown :options="taskMenu" placement="left">
            <Button variant="ghost" icon="more-horizontal" label="More for this task" :disabled="!!busy" />
          </Dropdown>
        </div>
        <Button variant="ghost" label="Cancel" @click="closeTaskForm">Cancel</Button>
        <Button variant="solid" label="Save" :loading="busy === 'save'" :disabled="!canSave" @click="save">Save</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import { taskForm, closeTaskForm } from '../../composables/useTaskForm.js';
import { whenLine } from '../../utils/clockTime.js';
import { stateChipClass, isDangerMove, moveIcon } from '../../utils/taskState.js';

const FIELDS = ['subject', 'due_date', 'priority'];
const blank = () => ({ subject: '', due_date: '', priority: '' });
const emptyDetail = () => ({ doctype: '', name: null, can_edit: true, priorities: [], state: '', status: '', workflow: null, actions: [] });

export default {
  name: 'TaskFormDialog',
  setup() {
    const ctx = useWorkstationContext([
      'postJSON', 'showToast', 'fetchPlannerData', 'fetchWorkstationData', 'selectedEmployee',
      'openTaskRavenDrawer', 'getTaskDeskUrl', 'isDarkMode',
    ]);
    return { ...ctx, taskForm, closeTaskForm, isDangerMove, moveIcon };
  },
  data() {
    return { loaded: false, busy: '', detail: emptyDetail(), form: blank(), saved: blank(), confirming: null, comment: '' };
  },
  computed: {
    task() { return taskForm.task; },
    block() { return taskForm.block; },
    doctype() {
      const t = this.task || {};
      return this.detail.doctype || t.doctype || (String(t.ref || '').startsWith('todo:') ? 'ToDo' : '');
    },
    heading() {
      return this.doctype === 'ToDo' ? 'To-do' : 'Task';
    },
    subtitle() {
      const b = this.block;
      if (b) return whenLine(b.work_date, b.start_time, b.end_time) || null;
      return this.detail.project || (this.task && (this.task.project_name || this.task.project)) || null;
    },
    editable() {
      return !this.busy && (!this.loaded || this.detail.can_edit);
    },
    // Only what changed goes to the server
    changes() {
      const out = {};
      for (const k of FIELDS) {
        const v = k === 'subject' ? String(this.form[k] || '').trim() : (this.form[k] || '');
        if (v !== (this.saved[k] || '')) out[k] = v;
      }
      return out;
    },
    canSave() {
      return this.loaded && this.detail.can_edit && !this.busy && !!String(this.form.subject || '').trim() && Object.keys(this.changes).length > 0;
    },
    // The moves open to you from here; each asks first (ask), then applies (move)
    statusMenu() {
      return this.detail.actions.map((a) => ({
        label: a.action,
        icon: moveIcon(a.action),
        theme: isDangerMove(a) ? 'red' : undefined,
        onClick: () => this.ask(a),
      }));
    },
    // The workflow and the plain status behind the state, on hover only
    stateHint() {
      const d = this.detail;
      const parts = [d.workflow && d.workflow + ' workflow', d.workflow && d.status && d.status !== d.state && 'status ' + d.status];
      return parts.filter(Boolean).join(', ') || null;
    },
    priorityMenu() {
      return this.detail.priorities.map((p) => ({
        label: p,
        icon: p === this.form.priority ? 'check' : undefined,
        onClick: () => { if (this.editable) this.form.priority = p; },
      }));
    },
    // The task as the rest of the workstation knows it (discussion, Desk link)
    linked() {
      const d = this.detail;
      if (!d.name) return null;
      return { ...(this.block ? {} : this.task), doctype: d.doctype, docname: d.name, id: d.name, ref: d.doctype === 'ToDo' ? 'todo:' + d.name : d.name, subject: d.subject || this.form.subject, project: d.project };
    },
    taskMenu() {
      const items = [];
      if (this.linked) {
        items.push({ label: 'Open discussion', icon: 'message-circle', onClick: () => this.discuss() });
        items.push({ label: 'Open full form', icon: 'external-link', onClick: () => window.open(this.getTaskDeskUrl(this.linked), '_blank', 'noopener') });
      }
      if (taskForm.canRemove) items.push({ label: taskForm.onRemove ? 'Remove from session' : 'Remove from block', icon: 'x-circle', theme: 'red', onClick: () => this.remove() });
      return items;
    },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-900'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    labelText() { return this.isDarkMode ? 'text-gray-200' : 'text-gray-800'; },
    iconTone() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    panelTone() { return this.isDarkMode ? 'bg-gray-800' : 'bg-gray-50'; },
  },
  watch: {
    'taskForm.open': {
      immediate: true,
      handler(open) { if (open) this.load(); },
    },
    'taskForm.task'() { if (taskForm.open) this.load(); },
  },
  methods: {
    chip(state) { return stateChipClass(state, this.isDarkMode); },
    fetchDetail() {
      const t = this.task, b = this.block;
      if (b) return this.postJSON('get_block_task', { block_name: b.name, task_ref: t.ref });
      const doctype = t.doctype || (String(t.ref || '').startsWith('todo:') ? 'ToDo' : 'Task');
      const name = t.docname || (String(t.ref || '').startsWith('todo:') ? t.ref.slice(5) : (t.id || t.name || t.ref));
      return this.postJSON('get_task', { doctype, name });
    },
    fill(d, keepEdits) {
      const next = { subject: d.subject || '', due_date: d.due_date || '', priority: d.priority || '' };
      // A workflow move reloads the form: edits not saved yet stay
      if (keepEdits) for (const k of FIELDS) if (this.form[k] !== this.saved[k]) next[k] = this.form[k];
      this.detail = { ...emptyDetail(), ...d, priorities: d.priorities || [], actions: d.actions || [] };
      this.saved = { subject: d.subject || '', due_date: d.due_date || '', priority: d.priority || '' };
      this.form = next;
    },
    async load() {
      const t = this.task;
      if (!t) return;
      // The name shows at once; the rest arrives with the task
      Object.assign(this, { loaded: false, busy: '', confirming: null, comment: '', detail: emptyDetail() });
      this.form = { ...blank(), subject: t.subject || '' };
      this.saved = { ...this.form };
      try {
        const d = await this.fetchDetail();
        if (!taskForm.open || this.task !== t) return;
        this.fill(d, false);
        this.loaded = true;
      } catch (e) {
        this.showToast('Could not open this task: ' + (e && e.message || e), 'danger');
        closeTaskForm();
      }
    },
    refreshAll() {
      this.fetchPlannerData();
      this.fetchWorkstationData(this.selectedEmployee);
    },
    // The block keeps its own copy of its tasks' names and its title; the server sends both back
    apply(res) {
      // A list keeping its own copy of the task (a running session) hears what changed
      if (typeof taskForm.onChange === 'function' && this.detail.name) {
        taskForm.onChange({ ...this.detail, subject: (res && res.subject) || this.form.subject || this.detail.subject });
      }
      const b = this.block;
      if (!b || !res) return;
      if (res.tasks) b.tasks = res.tasks;
      if (res.block) {
        Object.assign(b, res.block);
        if (b.task_subject !== undefined) b.task_subject = res.block.work_item_label || b.task_subject;
      }
    },
    async save() {
      if (!this.canSave) return;
      this.busy = 'save';
      try {
        const res = this.block
          ? await this.postJSON('update_block_task', { block_name: this.block.name, task_ref: this.task.ref, ...this.changes })
          : await this.postJSON('update_task', { doctype: this.detail.doctype, name: this.detail.name, ...this.changes });
        this.apply(res);
        this.refreshAll();
        this.showToast('Task saved', 'success');
        closeTaskForm();
      } catch (e) {
        this.showToast('Could not save this task: ' + (e && e.message || e), 'danger');
      } finally {
        this.busy = '';
      }
    },
    // The status button, or its wrapper when no move is open
    focusState() {
      const box = this.$refs.state;
      const el = box && (box.querySelector('button:not([disabled])') || box);
      if (el) el.focus();
    },
    ask(a) {
      this.confirming = a;
      this.comment = '';
      const toComment = () => {
        const el = this.confirming === a && this.$refs.confirm && this.$refs.confirm.querySelector('textarea');
        if (el) el.focus();
      };
      setTimeout(toComment);
      // The menu hands focus back to its button once it has closed, which is after this tick
      const box = this.$refs.state;
      if (!box) return;
      const onBack = () => setTimeout(toComment);
      box.addEventListener('focusin', onBack, { once: true });
      setTimeout(() => box.removeEventListener('focusin', onBack), 600);
    },
    back() {
      if (!this.confirming || this.busy === 'move') return;
      this.confirming = null;
      this.$nextTick(() => this.focusState());
    },
    async move() {
      const a = this.confirming;
      if (!a || this.busy) return;
      this.busy = 'move';
      try {
        const res = await this.postJSON('execute_task_workflow_action', {
          doctype: this.detail.doctype, docname: this.detail.name, action: a.action, comment: this.comment.trim(),
        });
        const d = await this.fetchDetail();
        this.fill(d, true);
        this.apply(null);
        this.confirming = null;
        this.refreshAll();
        this.showToast('Now ' + ((res && res.new_state) || d.state || a.next_state), 'success');
        this.$nextTick(() => this.focusState());
      } catch (e) {
        this.showToast('Could not move this task: ' + (e && e.message || e), 'danger');
      } finally {
        this.busy = '';
      }
    },
    discuss() {
      const t = this.linked;
      closeTaskForm();
      if (t) this.openTaskRavenDrawer(t);
    },
    async remove() {
      if (!taskForm.canRemove || this.busy) return;
      // Nothing is saved for a running session's task until Stop, so taking it off is local
      if (typeof taskForm.onRemove === 'function') {
        taskForm.onRemove(this.task);
        this.showToast('Taken off this session. The task itself is kept.', 'success');
        closeTaskForm();
        return;
      }
      this.busy = 'remove';
      try {
        const res = await this.postJSON('remove_block_task', { block_name: this.block.name, task_ref: this.task.ref });
        this.apply(res);
        this.refreshAll();
        this.showToast('Taken off this block. The task itself is kept.', 'success');
        closeTaskForm();
      } catch (e) {
        this.showToast('Could not take this task off: ' + (e && e.message || e), 'danger');
      } finally {
        this.busy = '';
      }
    },
  },
};
</script>
