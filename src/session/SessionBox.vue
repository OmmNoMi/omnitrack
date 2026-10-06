<template>
  <!-- One frame only: inside the full-focus popup the popup is the frame. -->
  <div
    v-if="isTracking"
    class="frappe-ui-session-hud w-full transition-all duration-200 text-gray-900 dark:text-white"
    :class="isElevated ? '' : 'rounded-2xl border bg-white border-gray-200 dark:bg-[#1E1F22] dark:border-gray-800 p-4 sm:p-5'"
  >
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
      <!-- Right on desktop, first on mobile: the clock and what it is logging -->
      <SessionControlsPane class="lg:order-2" />
      <!-- The running log of what was done -->
      <SessionLogPane class="lg:order-1" />
    </div>
  </div>
</template>

<script setup>
import { provide, toRefs, nextTick, onMounted, onUnmounted, watch } from 'vue';
import SessionLogPane from './SessionLogPane.vue';
import SessionControlsPane from './SessionControlsPane.vue';
import { SESSION_KEY } from './useSessionContext.js';
import { useSessionChat } from './useSessionChat.js';
import { useSessionDisplay } from './useSessionDisplay.js';
import { useSessionNotes } from './useSessionNotes.js';

const props = defineProps({
  isTracking: { type: Boolean, default: false },
  trackerSeconds: { type: Number, default: 0 },
  trackerNotes: { type: String, default: '' },
  trackerProject: { type: String, default: '' },
  trackerNature: { type: String, default: 'Work' },
  trackerBoundBlock: { type: Object, default: null },
  sessionNotesList: { type: Array, default: () => [] },
  minLineChars: { type: Number, default: 10 },
  projects: { type: Array, default: () => [] },
  natureOptions: { type: Array, default: () => [] },
  assignedTasks: { type: Array, default: () => [] },
  workBlocks: { type: Array, default: () => [] },
  modKey: { type: String, default: '⌘' },
  isDarkMode: { type: Boolean, default: false },
  discardConfirm: { type: Boolean, default: false },
  isElevated: { type: Boolean, default: false }
});

const emit = defineEmits([
  'stop',
  'adjust',
  'discard',
  'add-line',
  'remove-line',
  'bind-block',
  'unbind-block',
  'toggle-elevate',
  'update:notes',
  'update:project',
  'update:nature'
]);

// The two panes read what they need through useSessionContext (the same
// explicit-names pattern the workstation views use) instead of 30 props each.
const chat = useSessionChat(props);
const display = useSessionDisplay(props, emit);
const notes = useSessionNotes(props, emit);
provide(SESSION_KEY, { ...toRefs(props), emit, ...chat, ...display, ...notes });

function onFocusSessionInput() {
  chat.activePaneTab.value = 'notes';
  notes.focusLineInput();
}

onMounted(() => {
  window.addEventListener('omnitrack:focus-session-input', onFocusSessionInput);
});

onUnmounted(() => {
  window.removeEventListener('omnitrack:focus-session-input', onFocusSessionInput);
});

// Ensure Session Log tab is always active and input focused when full focus elevates
watch(() => props.isElevated, (elevated) => {
  if (elevated) {
    chat.activePaneTab.value = 'notes';
    nextTick(() => notes.focusLineInput());
  }
});

// Auto-fill connected task whenever a Planned Work Block is bound
watch(() => props.trackerBoundBlock, (newBlock) => {
  if (newBlock && !props.trackerNotes) {
    const taskTitle = newBlock.task_subject || newBlock.work_item_label || (newBlock.task ? (newBlock.task_subject || newBlock.task) : '') || newBlock.deliverable_notes || '';
    if (taskTitle) emit('update:notes', taskTitle);
    if (newBlock.project) emit('update:project', newBlock.project);
    if (newBlock.task_nature) emit('update:nature', newBlock.task_nature);
  }
}, { immediate: true });

defineExpose({
  focusLineInput: notes.focusLineInput,
  focusStopButton: notes.focusStopButton
});
</script>
