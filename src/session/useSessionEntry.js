import { ref, computed, onMounted, onUnmounted } from 'vue';
import { spanMins, durationLabel, clock } from '../utils/clockTime.js';
import { entryEndMs } from '../utils/timesheetEntry.js';

// The session box adding or editing a work session by hand (mode 'entry'): the same Log, tasks,
// Project and Activity as a running session, with the clock replaced by when the work was done.
// A work session is time already worked, so nothing that ends after now can be saved; time
// still ahead is logged by starting a session. A session needs at least one line, as when it
// is stopped. A line still in the field counts, and saving adds it first.
export function useSessionEntry(props, emit, notes) {
  const isEntry = computed(() => props.mode === 'entry');
  const entry = computed(() => props.entry || {});
  const now = ref(Date.now());
  let tick = null;
  onMounted(() => {
    if (!isEntry.value) return;
    tick = setInterval(() => { now.value = Date.now(); }, 30000);
  });
  onUnmounted(() => clearInterval(tick));

  const entryMins = computed(() => spanMins(entry.value.from_time, entry.value.to_time));
  // The clock's own face: hours, minutes and seconds, so it reads as the timer it stands in for
  const entryLength = computed(() => {
    const m = entryMins.value;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
  });
  const entryLengthWords = computed(() => (entryMins.value > 0 ? durationLabel(entryMins.value) : 'No time yet'));
  const entryAhead = computed(() => {
    const end = entryEndMs(entry.value.session_date, entry.value.from_time, entryMins.value);
    return end != null && entryMins.value > 0 && end > now.value + 60000;
  });
  const entryAheadText = computed(() => {
    const d = new Date(now.value);
    return `A work session is time already worked, so it has to end by ${clock(d.getHours() * 60 + d.getMinutes())}. For time still ahead, start a session when the work begins.`;
  });
  const entrySaveLabel = computed(() => (entry.value.mode === 'edit' ? 'Save' : 'Add session'));
  const draftReady = computed(() => notes.localLineText.value.trim().length >= props.minLineChars);
  const entryCanSave = computed(() => {
    const said = (props.sessionNotesList || []).length > 0 || draftReady.value;
    return !props.isSaving && !!entry.value.session_date && entryMins.value > 0 && !entryAhead.value && said;
  });

  function entrySave() {
    now.value = Date.now();
    if (notes.localLineText.value.trim()) {
      notes.submitLine();
      if (notes.lineHint.value) { notes.focusLineInput(); return; }
    }
    if (entryCanSave.value) emit('save');
  }

  return {
    isEntry,
    entry,
    entryMins,
    entryLength,
    entryLengthWords,
    entryAhead,
    entryAheadText,
    entrySaveLabel,
    entryCanSave,
    entrySave
  };
}
