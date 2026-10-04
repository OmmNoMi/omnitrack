import * as Vue from "vue";
const { ref, computed } = Vue;

export function useWorkBlockStore({ postJSON, showToast }) {
  const workBlocks = ref([]);
  const plannerData = ref({ totals: { block_count: 0 } });
  const calendarViewMode = ref('day');
  const plannerDate = ref('');
  const plannerDateDisplay = ref('');
  const calendarDays = ref([]);
  const hoverCard = ref(null);
  const activeBlock = ref(null);
  const showBlockDrawer = ref(false);
  const showBookModal = ref(false);
  const bookForm = ref({});
  const bookFormTask = ref(null);
  const showCancelModal = ref(false);
  const cancelTargetBlock = ref(null);
  const cancelForm = ref({ reason: '' });
  const cancelReasons = ref([
    'Deprioritized by manager',
    'Blocked by dependency',
    'Task scope changed',
    'Rescheduled to future date'
  ]);

  const openBlockDrawer = (b) => {
    activeBlock.value = b;
    showBlockDrawer.value = true;
  };

  const closeBlockDrawer = () => {
    showBlockDrawer.value = false;
    activeBlock.value = null;
  };

  return {
    workBlocks,
    plannerData,
    calendarViewMode,
    plannerDate,
    plannerDateDisplay,
    calendarDays,
    hoverCard,
    activeBlock,
    showBlockDrawer,
    showBookModal,
    bookForm,
    bookFormTask,
    showCancelModal,
    cancelTargetBlock,
    cancelForm,
    cancelReasons,
    openBlockDrawer,
    closeBlockDrawer
  };
}
