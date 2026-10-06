/**
 * useActiveSession Composable
 * Manages the live stopwatch state, Redis background synchronization,
 * multi-line bullet session notes, and inactivity/runaway watchdog timers.
 */
import { ref, computed } from "vue";
import { WORK } from "../utils/activity.js";

export function useActiveSession() {
  const isTracking = ref(false);
  const trackerSeconds = ref(0);
  const startTime = ref(null);
  const trackerBlockName = ref(null);
  const selectedNature = ref(WORK);
  const selectedProject = ref("");
  const trackerNotes = ref("");
  const sessionNotesList = ref([]);
  const lastActivityTime = ref(Date.now());

  let _timerInterval = null;
  let _syncDebounceTimer = null;
  let _lastLocalStop = 0;
  let _isStoppingSession = false;

  const formattedTimer = computed(() => {
    const total = trackerSeconds.value;
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  });

  const tick = () => {
    if (!isTracking.value || !startTime.value) return;
    const now = Date.now();
    trackerSeconds.value = Math.max(0, Math.floor((now - startTime.value) / 1000));
  };

  const startTimer = ({ blockName = null, nature = WORK, project = "", notes = "", initialStartTime = null } = {}) => {
    isTracking.value = true;
    startTime.value = initialStartTime || Date.now();
    trackerBlockName.value = blockName;
    selectedNature.value = nature;
    selectedProject.value = project;
    trackerNotes.value = notes;
    sessionNotesList.value = [];
    lastActivityTime.value = Date.now();
    tick();

    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(tick, 1000);
  };

  const stopTimer = () => {
    isTracking.value = false;
    _lastLocalStop = Date.now();
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    trackerSeconds.value = 0;
    startTime.value = null;
    trackerBlockName.value = null;
    sessionNotesList.value = [];
  };

  const appendNote = (noteText) => {
    if (!noteText || !noteText.trim()) return;
    sessionNotesList.value.push({
      text: noteText.trim(),
      timestamp: Date.now(),
    });
    lastActivityTime.value = Date.now();
  };

  const removeNote = (index) => {
    if (index >= 0 && index < sessionNotesList.value.length) {
      sessionNotesList.value.splice(index, 1);
      lastActivityTime.value = Date.now();
    }
  };

  return {
    isTracking,
    trackerSeconds,
    startTime,
    trackerBlockName,
    selectedNature,
    selectedProject,
    trackerNotes,
    sessionNotesList,
    lastActivityTime,
    formattedTimer,
    startTimer,
    stopTimer,
    resetTimer,
    appendNote,
    removeNote,
    tick,
  };
}
