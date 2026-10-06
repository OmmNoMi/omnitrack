import { computed } from "vue";
import { WORK } from "../utils/activity.js";

/**
 * Client portal metrics.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationPortal(w) {
  const { activeBlock, fetchPlannerData, isPastBlock, isTracking, plannerBusy, plannerData, postJSON, promptSwitchSession, selectedNature, selectedProject, sessionNotesList, showBlockDrawer, showToast, toggleTrack, trackerBlockName, trackerNotes } = w;

  // Executive Client Portal Computed Metrics
  const clientCompletedBlocks = computed(() => {
    return (plannerData.value.blocks || []).filter(b => b.status === 'Completed' || b.status === 'Logged (Full)' || b.status === 'Logged (Partial)' || b.status === 'Logged (Over)');
  });
  const clientInProgressBlocks = computed(() => {
    return (plannerData.value.blocks || []).filter(b => b.status === 'In Progress' || (isTracking.value && trackerBlockName.value === b.name));
  });
  const clientCancelledBlocks = computed(() => {
    return (plannerData.value.blocks || []).filter(b => b.status === 'Cancelled' || b.status === 'Rescheduled');
  });
  const clientUpcomingBlocks = computed(() => {
    const completedNames = new Set(clientCompletedBlocks.value.map(b => b.name));
    const inProgressNames = new Set(clientInProgressBlocks.value.map(b => b.name));
    const cancelledNames = new Set(clientCancelledBlocks.value.map(b => b.name));
    return (plannerData.value.blocks || []).filter(b => !completedNames.has(b.name) && !inProgressNames.has(b.name) && !cancelledNames.has(b.name));
  });
  const clientDeliveredHours = computed(() => {
    return clientCompletedBlocks.value.reduce((sum, b) => sum + (parseFloat(b.actual_hours) || 0), 0);
  });
  const clientCompletedHours = computed(() => clientDeliveredHours.value);
  const clientUpcomingHours = computed(() => {
    return clientUpcomingBlocks.value.reduce((sum, b) => sum + (parseFloat(b.duration_hours) || 0), 0);
  });
  const clientTotalPlannedHours = computed(() => {
    return (plannerData.value.blocks || []).reduce((sum, b) => sum + (parseFloat(b.duration_hours) || 0), 0);
  });
  const clientInProgressCount = computed(() => clientInProgressBlocks.value.length);
  const clientReliabilityRate = computed(() => {
    const total = (plannerData.value.blocks || []).length;
    if (!total) return 100;
    const logged = clientCompletedBlocks.value.length;
    return Math.round((logged / total) * 100);
  });
  const removeActiveBlock = async () => {
    if (isPastBlock(activeBlock.value)) { showToast('Past planned work blocks cannot be deleted', 'warning'); return; }
    plannerBusy.value = true;
    try {
      await postJSON('delete_work_block', { block_name: activeBlock.value.name });
      showBlockDrawer.value = false;
      showToast('Block deleted', 'info');
      await fetchPlannerData();
    } catch (e) { showToast('Could not delete block: ' + (e && e.message || e), 'danger'); }
    finally { plannerBusy.value = false; }
  };
  const planAttentionTask = (t) => {
    // Default length: what the task still needs, 1 to 4 hours
    const need = parseFloat(t.deficit_hours) > 0 ? parseFloat(t.deficit_hours) : (parseFloat(t.estimate_hours) || 2);
    w.workBlockStore.openPlanDialog({ work_item: t.ref, hours: Math.min(4, Math.max(1, Math.round(need))) });
  };
  const startTaskImmediately = (t) => {
    if (!t) return;
    if (isTracking.value) {
      promptSwitchSession({
        id: t.name || t.id,
        name: t.name || t.id,
        label: t.subject || t.title || t.name,
        project: t.project,
        is_block: false,
        task_nature: WORK,
      });
      return;
    }
    trackerBlockName.value = '';
    trackerNotes.value = t.subject || '';
    selectedProject.value = t.project || '';
    selectedNature.value = WORK;
    sessionNotesList.value = [];
    toggleTrack();
    showToast(`Started tracking: ${t.subject}`, 'success');
  };
  const getTaskDeskUrl = (t) => {
    if (!t) return '#';
    const dt = t.doctype ? t.doctype.toLowerCase() : (t.type === 'todo' ? 'todo' : 'task');
    const dn = t.docname || t.id || t.name;
    return `/app/${encodeURIComponent(dt)}/${encodeURIComponent(dn)}`;
  };
  Object.assign(w, {
    clientCompletedBlocks,
    clientInProgressBlocks,
    clientCancelledBlocks,
    clientUpcomingBlocks,
    clientDeliveredHours,
    clientCompletedHours,
    clientUpcomingHours,
    clientTotalPlannedHours,
    clientInProgressCount,
    clientReliabilityRate,
    removeActiveBlock,
    planAttentionTask,
    startTaskImmediately,
    getTaskDeskUrl,
  });
}
