import * as Vue from "vue";
const { ref, computed } = Vue;

export function useCollaborationStore({ postJSON, showToast }) {
  const showTaskRavenDrawer = ref(false);
  const ravenTask = ref(null);
  const ravenChannel = ref(null);
  const ravenMessages = ref([]);
  const ravenLoading = ref(false);
  const ravenChatSending = ref(false);
  const ravenChatInput = ref('');
  const ravenActiveTab = ref('spec');
  const ravenTaskSpec = ref('');
  const ravenSavingSpec = ref(false);
  const ravenSprintRecaps = ref([]);
  const drawerChatMessages = ref([]);
  const teamMembers = ref([]);

  const openTaskRavenDrawer = (task) => {
    ravenTask.value = task;
    showTaskRavenDrawer.value = true;
  };

  const closeTaskRavenDrawer = () => {
    showTaskRavenDrawer.value = false;
    ravenTask.value = null;
  };

  const openRavenApp = () => {
    if (typeof window !== 'undefined') {
      window.open('/app/raven', '_blank');
    }
  };

  return {
    showTaskRavenDrawer,
    ravenTask,
    ravenChannel,
    ravenMessages,
    ravenLoading,
    ravenChatSending,
    ravenChatInput,
    ravenActiveTab,
    ravenTaskSpec,
    ravenSavingSpec,
    ravenSprintRecaps,
    drawerChatMessages,
    teamMembers,
    openTaskRavenDrawer,
    closeTaskRavenDrawer,
    openRavenApp
  };
}
