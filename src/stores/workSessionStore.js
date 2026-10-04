import * as Vue from "vue";
const { ref, computed } = Vue;

export function useWorkSessionStore({ postJSON, showToast, csrfToken }) {
  const isTracking = ref(false);
  const trackerSeconds = ref(0);
  const trackerTimer = ref(null);
  const trackerNotes = ref('');
  const selectedNature = ref('Planned Work');
  const selectedProject = ref('');
  const trackerProject = selectedProject;
  const trackerNature = selectedNature;
  const trackerBlockName = ref(null);
  const startTime = ref(null);
  const sessionNotesList = ref([]);
  const discardConfirm = ref(false);
  const sessionCardFlash = ref(false);

  // Modals state
  const showAdjustModal = ref(false);
  const adjustMode = ref('both');
  const adjustForm = ref({ from_time: '', to_time: '', date: '' });
  const showRunawayAlertModal = ref(false);
  const runawayGuardData = ref(null);
  const runawayChoice = ref('stop_at_eod');
  const showEmptyStopModal = ref(false);
  const emptyStopQuickNote = ref('');
  const emptyStopElapsedHrs = ref(0);
  const showInactivityModal = ref(false);
  const inactivityMinutes = ref(30);
  const lastActivityTime = ref(Date.now());
  const showEODModal = ref(false);
  const eodSummary = ref({});
  const eodPendingBlocks = ref([]);
  const showEditSessionModal = ref(false);
  const editSessionForm = ref({});
  const editSessionDuration = ref(0);
  const isSavingEditSession = ref(false);

  const bottomBarTimer = computed(() => {
    const s = trackerSeconds.value || 0;
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    const isHours = hours > 0;
    return {
      hours,
      minutes,
      seconds,
      isHours,
      formatted: isHours 
        ? `${hours}h ${String(minutes).padStart(2, '0')}m`
        : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  });

  return {
    isTracking,
    trackerSeconds,
    trackerTimer,
    trackerNotes,
    selectedNature,
    selectedProject,
    trackerProject,
    trackerNature,
    trackerBlockName,
    startTime,
    sessionNotesList,
    discardConfirm,
    sessionCardFlash,
    showAdjustModal,
    adjustMode,
    adjustForm,
    showRunawayAlertModal,
    runawayGuardData,
    runawayChoice,
    showEmptyStopModal,
    emptyStopQuickNote,
    emptyStopElapsedHrs,
    showInactivityModal,
    inactivityMinutes,
    lastActivityTime,
    showEODModal,
    eodSummary,
    eodPendingBlocks,
    showEditSessionModal,
    editSessionForm,
    editSessionDuration,
    isSavingEditSession,
    bottomBarTimer
  };
}
