<template>
  <!-- More tasks for a block that is already planned: the same task list as planning one.
       Picking a row adds it (with any ticked); a typed name that matches none becomes a new to-do. -->
  <f-dialog
    :model-value="modelValue"
    title="Add tasks"
    :subtitle="blockTitle(block, '') || null"
    size="lg"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <PlanTaskStep
      v-model:query="query"
      v-model:checked="checked"
      :task-options="options"
      :when-line="when"
      :is-dark-mode="isDarkMode"
      @pick="add"
      @continue="add(checked, '')"
      @skip="add([], query.trim())"
    />

    <template #actions>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" label="Cancel" @click="$emit('update:modelValue', false)">Cancel</Button>
        <Button variant="solid" :label="addLabel" :loading="busy" :disabled="!checked.length || busy" @click="add(checked, '')">{{ addLabel }}</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import PlanTaskStep from '../components/dialogs/PlanTaskStep.vue';
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { whenLine } from '../utils/clockTime.js';
import { blockTitle } from '../utils/blockTitle.js';

export default {
  name: 'AddBlockTasksDialog',
  components: { PlanTaskStep },
  props: {
    modelValue: { type: Boolean, default: false },
    block: { type: Object, required: true },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup() {
    return useWorkstationContext(['postJSON', 'showToast', 'fetchPlannerData', 'comboboxBookTaskOptions', 'addSessionTasks']);
  },
  data() {
    return { query: '', checked: [], busy: false };
  },
  computed: {
    // Everything assigned, less what the block already has
    options() {
      const have = new Set((this.block.tasks || []).map((t) => t.ref || t.id));
      return (this.comboboxBookTaskOptions || []).filter((o) => !have.has(o.value));
    },
    when() {
      return whenLine(this.block.work_date, this.block.start_time, this.block.end_time);
    },
    addLabel() {
      const n = this.checked.length;
      return n > 1 ? `Add ${n} tasks` : 'Add task';
    },
  },
  watch: {
    modelValue(open) {
      if (open) { this.query = ''; this.checked = []; this.busy = false; }
    },
  },
  methods: {
    blockTitle,
    async add(refs, newSubject) {
      const list = (refs || []).filter(Boolean);
      const subject = String(newSubject || '').trim();
      if (this.busy || (!list.length && !subject)) return;
      this.busy = true;
      try {
        // A running session with no block yet keeps the tasks until Stop makes its block
        if (this.block.is_session_tasks) {
          const n = await this.addSessionTasks(list, subject);
          this.showToast(n > 1 ? `${n} tasks added` : 'Task added', 'success');
          this.$emit('update:modelValue', false);
          return;
        }
        const res = await this.postJSON('attach_tasks_to_block', {
          block_name: this.block.name,
          task_refs: list.length ? JSON.stringify(list) : null,
          new_task_subjects: subject || null,
        });
        if (res && res.tasks) this.block.tasks = res.tasks;
        this.fetchPlannerData();
        const n = list.length + (subject ? 1 : 0);
        this.showToast(n > 1 ? `${n} tasks added` : 'Task added', 'success');
        this.$emit('update:modelValue', false);
      } catch (e) {
        this.showToast('Could not add tasks: ' + (e && e.message || e), 'danger');
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
