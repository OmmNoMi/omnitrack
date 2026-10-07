<template>
  <!-- What this panel is about, above its title: a Work block, Time away, a Work session, a Task
       or a To-do. They share one layout, so without it they read alike; each kind keeps one
       icon and one colour wherever it opens. -->
  <p :id="id" class="flex items-center gap-2 min-w-0 text-sm font-medium">
    <span class="inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-lg" :class="tile" aria-hidden="true">
      <FeatherIcon :name="meta.icon" class="w-4 h-4" />
    </span>
    <span :class="label">{{ meta.label }}</span>
    <!-- The comma keeps a screen reader from running the two together ("To-dob54ede2q50") -->
    <span v-if="docName" class="min-w-0 truncate font-normal tabular-nums" :class="muted" :title="docName"><span class="sr-only">, </span>{{ docName }}</span>
  </p>
</template>

<script>
import { toneChipClass } from '../../utils/taskState.js';

// One entry per kind of record a details panel opens on
export const DETAIL_KINDS = {
  block: { icon: 'calendar', label: 'Work Block', tone: 'blue' },
  away: { icon: 'sun', label: 'Time Away', tone: 'amber' },
  session: { icon: 'activity', label: 'Work Session', tone: 'green' },
  task: { icon: 'check-square', label: 'Task', tone: 'purple' },
  todo: { icon: 'check-circle', label: 'To-Do', tone: 'gray' },
};

const LABEL = {
  light: { blue: 'text-blue-800', amber: 'text-amber-800', green: 'text-green-800', purple: 'text-purple-800', gray: 'text-gray-800' },
  dark: { blue: 'text-blue-200', amber: 'text-amber-200', green: 'text-green-200', purple: 'text-purple-200', gray: 'text-gray-100' },
};

export default {
  name: 'DetailKind',
  props: {
    kind: { type: String, required: true, validator: (k) => k in DETAIL_KINDS },
    // The record's own name (TASK-0012), for telling two alike titles apart
    docName: { type: String, default: '' },
    isDarkMode: { type: Boolean, default: false },
    // So the sheet can name itself by its kind and title together
    id: { type: String, default: null },
  },
  computed: {
    meta() { return DETAIL_KINDS[this.kind] || DETAIL_KINDS.block; },
    tile() { return toneChipClass(this.meta.tone, this.isDarkMode); },
    label() { return LABEL[this.isDarkMode ? 'dark' : 'light'][this.meta.tone]; },
    muted() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
  },
};
</script>
