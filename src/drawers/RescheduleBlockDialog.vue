<template>
  <!-- Moving a block to another day or time: its own dialog, like planning one, so it is
       always clear what is open. Logging time worked is the timesheet entry, not this. -->
  <f-dialog
    :model-value="modelValue"
    title="Reschedule"
    :subtitle="title || null"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="submit">
      <p class="text-sm" :class="mutedText">Now: {{ now }}</p>
      <DayTimeFields
        v-model:date="form.work_date"
        v-model:start="form.start_time"
        v-model:end="form.end_time"
        day-label="Move to"
        :is-dark-mode="isDarkMode"
      />
    </form>

    <template #actions>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" label="Cancel" @click="$emit('update:modelValue', false)">Cancel</Button>
        <Button variant="solid" label="Move block" :loading="busy" :disabled="!canMove" @click="submit">Move block</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import DayTimeFields from '../components/common/DayTimeFields.vue';
import { whenLine, toMin, toHHMM, spanMins, localISO } from '../utils/clockTime.js';

const hhmm = (t) => (t ? toHHMM(toMin(t)) : '');

export default {
  name: 'RescheduleBlockDialog',
  components: { DayTimeFields },
  props: {
    modelValue: { type: Boolean, default: false },
    block: { type: Object, required: true },
    title: { type: String, default: '' },
    busy: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
  },
  // submit({ work_date, start_time, end_time }): the drawer hands it to submitReschedule
  emits: ['update:modelValue', 'submit'],
  data() {
    return { form: { work_date: '', start_time: '', end_time: '' } };
  },
  computed: {
    now() {
      return whenLine(this.block.work_date, this.block.start_time, this.block.end_time);
    },
    // A real move: a day and a time that ends after it starts, and not where it is now
    canMove() {
      const f = this.form, b = this.block;
      const valid = !!f.work_date && !!f.start_time && spanMins(f.start_time, f.end_time) > 0;
      const moved = f.work_date !== String(b.work_date || '').slice(0, 10) || f.start_time !== hhmm(b.start_time) || f.end_time !== hhmm(b.end_time);
      return !this.busy && valid && moved;
    },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(open) {
        if (!open) return;
        const b = this.block;
        const day = String(b.work_date || '').slice(0, 10);
        const today = localISO(new Date());
        // A missed block is moved forward, so it starts from today rather than the day it missed
        this.form = { work_date: day && day < today ? today : day, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) };
      },
    },
  },
  methods: {
    submit() {
      if (this.canMove) this.$emit('submit', { ...this.form });
    },
  },
};
</script>
