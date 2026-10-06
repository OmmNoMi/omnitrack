<template>
  <!-- A block's own title and notes. Its tasks keep their names (each is edited in the one
       task form); when and how long are Reschedule's. -->
  <f-dialog
    :model-value="modelValue"
    title="Edit block"
    :subtitle="when || null"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label for="edit-block-title" class="block mb-1 text-sm font-medium" :class="labelText">Title</label>
        <TextInput
          id="edit-block-title"
          v-model="form.title"
          size="lg"
          variant="outline"
          maxlength="140"
          placeholder="What this time is for"
          :disabled="busy"
          data-autofocus
          @keydown.enter.prevent="save"
        />
      </div>
      <Textarea
        v-model="form.notes"
        variant="outline"
        size="md"
        :rows="3"
        label="Notes"
        placeholder="What it should produce. Optional."
        :disabled="busy"
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      />
    </form>

    <template #actions>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" label="Cancel" @click="$emit('update:modelValue', false)">Cancel</Button>
        <Button variant="solid" label="Save" :loading="busy" :disabled="!canSave" @click="save">Save</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { whenLine } from '../utils/clockTime.js';

const clean = (v) => String(v || '').trim();

export default {
  name: 'EditBlockDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    block: { type: Object, required: true },
    // The title the drawer shows, which may come from the main task or the notes
    title: { type: String, default: '' },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup() {
    return useWorkstationContext(['postJSON', 'showToast', 'fetchPlannerData', 'fetchWorkstationData', 'selectedEmployee']);
  },
  data() {
    return { form: { title: '', notes: '' }, busy: false };
  },
  computed: {
    when() {
      return whenLine(this.block.work_date, this.block.start_time, this.block.end_time);
    },
    // Notes that only repeat the title are not shown as notes (the drawer hides them too)
    notesMirrorTitle() {
      return clean(this.block.deliverable_notes) === clean(this.title);
    },
    // Only what changed goes to the server
    changes() {
      const out = {};
      const title = clean(this.form.title);
      if (title && title !== clean(this.title)) out.work_item_label = title;
      const notes = clean(this.form.notes) || (this.notesMirrorTitle ? title : '');
      if (notes !== clean(this.block.deliverable_notes)) out.deliverable_notes = notes;
      return out;
    },
    canSave() {
      return !this.busy && !!clean(this.form.title) && Object.keys(this.changes).length > 0;
    },
    labelText() { return this.isDarkMode ? 'text-gray-200' : 'text-gray-800'; },
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(open) {
        if (!open) return;
        this.busy = false;
        this.form = { title: this.title, notes: this.notesMirrorTitle ? '' : String(this.block.deliverable_notes || '') };
      },
    },
  },
  methods: {
    async save() {
      if (!this.canSave) return;
      const b = this.block, changes = this.changes;
      this.busy = true;
      try {
        await this.postJSON('update_work_block', { block_name: b.name, ...changes });
        if (changes.work_item_label) Object.assign(b, { work_item_label: changes.work_item_label, task_subject: changes.work_item_label });
        if ('deliverable_notes' in changes) b.deliverable_notes = changes.deliverable_notes;
        this.fetchPlannerData();
        this.fetchWorkstationData(this.selectedEmployee);
        this.showToast('Block saved', 'success');
        this.$emit('update:modelValue', false);
      } catch (e) {
        this.showToast('Could not save this block: ' + (e && e.message || e), 'danger');
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
