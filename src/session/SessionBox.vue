<template>
  <!-- One frame only: inside the full-focus popup the popup is the frame. mode="entry" is the
       same box adding or editing a work session by hand (WorkSessionEntry): people log time in
       the one place they know, with the clock replaced by when they worked. -->
  <div
    v-if="isTracking || mode === 'entry'"
    class="frappe-ui-session-hud w-full transition-all duration-200 text-gray-900 dark:text-white"
    :class="isElevated || mode === 'entry' ? '' : 'rounded-2xl border bg-white border-gray-200 dark:bg-[#1E1F22] dark:border-gray-800 p-4 sm:p-5'"
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
import { useSessionEntry } from './useSessionEntry.js';
import { blockTitle } from '../utils/blockTitle.js';

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
  isElevated: { type: Boolean, default: false },
  // 'live' is the running session; 'entry' adds or edits one by hand
  mode: { type: String, default: 'live' },
  // For mode 'entry': { mode: add | edit | free, session_date, from_time, to_time }
  entry: { type: Object, default: null },
  dayOffsets: { type: Array, default: () => [0, -1] },
  isSaving: { type: Boolean, default: false }
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
  'update:nature',
  'save',
  'cancel'
]);

// The two panes read what they need through useSessionContext (the same
// explicit-names pattern the workstation views use) instead of 30 props each.
const chat = useSessionChat(props);
const display = useSessionDisplay(props, emit);
const notes = useSessionNotes(props, emit);
const entry = useSessionEntry(props, emit, notes);
// Ids and the "/" target belong to the running session; an entry open beside it has its own
const idp = props.mode === 'entry' ? 'entry-' : '';
provide(SESSION_KEY, { ...toRefs(props), emit, ...chat, ...display, ...notes, ...entry, idp });

function onFocusSessionInput() {
  chat.activePaneTab.value = 'notes';
  notes.focusLineInput();
}

onMounted(() => {
  if (props.mode === 'entry') return;
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
  if (props.mode === 'entry') return;
  if (newBlock && !props.trackerNotes) {
    const taskTitle = blockTitle(newBlock, '');
    if (taskTitle) emit('update:notes', taskTitle);
    if (newBlock.project) emit('update:project', newBlock.project);
    if (newBlock.task_nature) emit('update:nature', newBlock.task_nature);
  }
}, { immediate: true });

defineExpose({
  focusLineInput: notes.focusLineInput,
  focusStopButton: notes.focusStopButton,
  entrySave: entry.entrySave
});
</script>
