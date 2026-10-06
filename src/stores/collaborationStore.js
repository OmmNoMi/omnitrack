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
  const drawerChatMessages = ref([]);
  const drawerChatLoading = ref(false);
  const drawerChatInput = ref('');
  const drawerChatSending = ref(false);

  const teamMembers = ref([
    { name: 'hardiksharma80912@gmail.com', full_name: 'Hardik Sharma', role: 'Lead Architect / Founder' },
    { name: 'Devoted NoMi', full_name: 'Nomeshwer Sharma', role: 'Operations Manager' },
    { name: 'Meenaxi Maxi', full_name: 'Meenaxi Maxi', role: 'Logistics & Field Lead' },
    { name: 'Misha Sharma', full_name: 'Misha Sharma', role: 'Admin & Finance Specialist' },
    { name: 'Alex Vance', full_name: 'Alex Vance', role: 'Principal Engineer' },
    { name: 'Tariq Nomi', full_name: 'Tariq Nomi', role: 'Operations Lead' },
    { name: 'Elena Rostova', full_name: 'Elena Rostova', role: 'Full-Stack Dev' },
    { name: 'Amara Okafor', full_name: 'Amara Okafor', role: 'Logistics Dispatcher' },
    { name: 'Sophia Patel', full_name: 'Sophia Patel', role: 'Backend Engineer' },
    { name: 'Administrator', full_name: 'Administrator', role: 'System Admin' }
  ]);

  const ravenSprintRecaps = computed(() => {
    return (ravenMessages.value || []).filter(m => {
      const txt = m.content || m.text || '';
      return txt.includes('🏁 Focus Session Accomplished') || txt.includes('🏁') || m.is_bot_message || m.message_type === 'System';
    });
  });

  const openTaskRavenDrawer = (task, initialTab = 'chat') => {
    if (!task) return;
    ravenTask.value = { ...task };
    showTaskRavenDrawer.value = true;
    ravenActiveTab.value = initialTab;
    ravenMessages.value = [];
    ravenTaskSpec.value = task.description || '';
    ravenChatInput.value = '';
    fetchTaskRavenDetails(task.name || task.ref || task.id, task.doctype || 'Task');
  };

  const closeTaskRavenDrawer = () => {
    showTaskRavenDrawer.value = false;
    ravenTask.value = null;
  };

  const openRavenApp = () => {
    if (typeof window !== 'undefined') {
      // /app/raven is Raven's Desk workspace (a DocType list); the chat app itself is /raven
      window.open('/raven', '_blank', 'noopener');
    }
  };

  const fetchTaskRavenDetails = async (taskId, doctype = 'Task') => {
    if (!taskId) return;
    ravenLoading.value = true;
    try {
      const res = await postJSON('get_task_chat', { task_id: taskId, limit: 50 });
      if (res) {
        ravenChannel.value = res.channel;
        ravenMessages.value = res.messages || [];
      }
    } catch (e) {
      console.warn('Could not load task chat', e);
    } finally {
      ravenLoading.value = false;
    }
  };

  const sendRavenChatMessage = async () => {
    const text = ravenChatInput.value.trim();
    const taskId = ravenTask.value && (ravenTask.value.name || ravenTask.value.ref || ravenTask.value.id);
    if (!text || !taskId || ravenChatSending.value) return;
    ravenChatSending.value = true;
    try {
      const res = await postJSON('post_task_chat_message', { task_id: taskId, content: text });
      if (res && res.success) {
        ravenChatInput.value = '';
        await fetchTaskRavenDetails(taskId, ravenTask.value.doctype);
      }
    } catch (e) {
      showToast('Failed to send message: ' + (e && e.message || e), 'danger');
    } finally {
      ravenChatSending.value = false;
    }
  };

  const fetchDrawerChat = async (taskId) => {
    if (!taskId) { drawerChatMessages.value = []; return; }
    drawerChatLoading.value = true;
    try {
      const res = await postJSON('get_task_chat', { task_id: taskId, limit: 30 });
      drawerChatMessages.value = (res && res.messages) || [];
    } catch (e) {
      console.warn('Could not load drawer chat', e);
    } finally {
      drawerChatLoading.value = false;
    }
  };

  const sendDrawerChatMessage = async (activeBlock) => {
    const text = drawerChatInput.value.trim();
    const taskId = activeBlock && (activeBlock.task || activeBlock.name);
    if (!text || !taskId || drawerChatSending.value) return;
    drawerChatSending.value = true;
    try {
      const res = await postJSON('post_task_chat_message', { task_id: taskId, content: text });
      if (res && res.success) {
        drawerChatInput.value = '';
        await fetchDrawerChat(taskId);
      }
    } catch (e) {
      showToast('Failed to send message: ' + (e && e.message || e), 'danger');
    } finally {
      drawerChatSending.value = false;
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
    drawerChatLoading,
    drawerChatInput,
    drawerChatSending,
    teamMembers,
    openTaskRavenDrawer,
    closeTaskRavenDrawer,
    openRavenApp,
    fetchTaskRavenDetails,
    sendRavenChatMessage,
    fetchDrawerChat,
    sendDrawerChatMessage
  };
}
