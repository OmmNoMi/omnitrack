import { ref, computed, watch, nextTick, onMounted } from 'vue';

export function useSessionChat(props) {
  // ---- Raven Real-Time Task Chat Integration ---------------------------------
  const activePaneTab = ref('notes'); // 'notes' | 'chat'
  const isRavenAvailable = ref(true);
  const taskMessages = ref([]);
  const chatLoading = ref(false);
  const chatInputText = ref('');
  const chatSending = ref(false);
  const taskUnreadCount = ref(0);
  const chatStreamRef = ref(null);
  const tabNotesRef = ref(null);
  const tabChatRef = ref(null);

  // Log, Details, then Task chat when Raven is installed. paneTab is never anything else, so the
  // pane is never blank: an unknown value shows the Log.
  const tabDetailsRef = ref(null);
  const paneTabs = computed(() => ['notes', 'details', ...(isRavenAvailable.value ? ['chat'] : [])]);
  const paneTab = computed(() => (paneTabs.value.includes(activePaneTab.value) ? activePaneTab.value : 'notes'));
  const tabRefs = { notes: tabNotesRef, details: tabDetailsRef, chat: tabChatRef };

  function selectPaneTab(id) {
    if (id === 'chat') openChatTab();
    else activePaneTab.value = id;
  }

  // WAI-ARIA tabs: Left/Right move and wrap, Home/End jump to the ends
  function onPaneTabKeydown(e) {
    const tabs = paneTabs.value, i = tabs.indexOf(paneTab.value);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const id = tabs[(to + tabs.length) % tabs.length];
    selectPaneTab(id);
    nextTick(() => tabRefs[id].value?.focus());
  }

  // Universal API caller compatible with both Frappe Desk and Web Portal pages
  async function callApi(method, args = {}) {
    if (typeof window !== 'undefined' && window.frappe && typeof window.frappe.call === 'function') {
      return await window.frappe.call({ method, args });
    }
    const fullMethod = method.startsWith('omnitrack.api.') ? method : `omnitrack.api.${method}`;
    const csrfToken = (typeof window !== 'undefined' && (
      (window.OMNITRACK_SESSION && window.OMNITRACK_SESSION.csrf_token) ||
      window.frappe_csrf_token ||
      (window.frappe && window.frappe.csrf_token) ||
      window.csrf_token
    )) || '';

    const res = await fetch(`/api/method/${fullMethod}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken
      },
      body: JSON.stringify(args)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data && (data._server_messages || data.message)) || 'Request failed');
    }
    return { message: data.message };
  }

  const connectedTaskId = computed(() => {
    if (props.trackerBoundBlock && props.trackerBoundBlock.task) {
      return props.trackerBoundBlock.task;
    }
    if (props.trackerBoundBlock && props.trackerBoundBlock.name) {
      return props.trackerBoundBlock.name;
    }
    const match = (props.assignedTasks || []).find(t =>
      (t.subject && t.subject === props.trackerNotes) ||
      (t.title && t.title === props.trackerNotes) ||
      t.name === props.trackerNotes
    );
    if (match) return match.name;
    return null;
  });

  const connectedTaskName = computed(() => {
    if (props.trackerBoundBlock) {
      return props.trackerBoundBlock.task_subject || props.trackerBoundBlock.work_item_label || props.trackerBoundBlock.deliverable_notes || props.trackerBoundBlock.task || 'Client Support Session';
    }
    return props.trackerNotes || 'General Task';
  });

  function formatCleanTime(val) {
    if (!val) return '';
    const str = String(val).trim();
    const parts = str.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return str;
  }

  function formatMsgTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return String(iso).slice(11, 16);
    }
  }

  async function checkRavenStatus() {
    try {
      const res = await callApi('is_raven_enabled');
      isRavenAvailable.value = !!(res && res.message && res.message.available);
    } catch (e) {
      isRavenAvailable.value = false;
    }
  }

  async function fetchTaskChat() {
    if (!connectedTaskId.value || !isRavenAvailable.value) return;
    chatLoading.value = true;
    try {
      const res = await callApi('get_task_chat', { task_id: connectedTaskId.value, limit: 50 });
      if (res && res.message && res.message.messages) {
        taskMessages.value = res.message.messages;
        taskUnreadCount.value = 0;
        nextTick(() => {
          if (chatStreamRef.value) {
            chatStreamRef.value.scrollTop = chatStreamRef.value.scrollHeight;
          }
        });
      }
    } catch (e) {
      console.warn('Failed to fetch task chat', e);
    } finally {
      chatLoading.value = false;
    }
  }

  function openChatTab() {
    activePaneTab.value = 'chat';
    taskUnreadCount.value = 0;
    fetchTaskChat();
  }

  async function sendChatMessage() {
    const text = chatInputText.value.trim();
    if (!text || !connectedTaskId.value || chatSending.value) return;
    chatSending.value = true;
    try {
      const res = await callApi('post_task_chat_message', {
        task_id: connectedTaskId.value,
        content: text
      });
      if (res && res.message && res.message.success) {
        chatInputText.value = '';
        await fetchTaskChat();
      }
    } catch (e) {
      console.error('Error sending task message', e);
    } finally {
      chatSending.value = false;
    }
  }

  async function pinSpec(msgId) {
    if (!msgId || !connectedTaskId.value) return;
    try {
      const res = await callApi('pin_task_spec', {
        message_id: msgId,
        task_id: connectedTaskId.value
      });
      if (res && res.message && res.message.success) {
        if (typeof window !== 'undefined' && window.frappe && window.frappe.show_alert) {
          window.frappe.show_alert({ message: 'Pinned as the task spec', indicator: 'green' });
        }
      }
    } catch (e) {
      console.error('Failed to pin message', e);
    }
  }

  function setupRealtimeChat() {
    if (typeof window !== 'undefined' && window.frappe && window.frappe.realtime) {
      window.frappe.realtime.on('new_message', () => {
        if (activePaneTab.value === 'chat') {
          fetchTaskChat();
        } else {
          taskUnreadCount.value++;
        }
      });
      window.frappe.realtime.on('message_edited', () => {
        if (activePaneTab.value === 'chat') fetchTaskChat();
      });
    }
  }

  // Watch for connected task change to refresh chat if chat tab is active
  watch(() => connectedTaskId.value, (newId) => {
    if (newId && activePaneTab.value === 'chat') {
      fetchTaskChat();
    }
  });

  onMounted(() => {
    checkRavenStatus();
    setupRealtimeChat();
  });

  return {
    activePaneTab,
    isRavenAvailable,
    taskMessages,
    chatLoading,
    chatInputText,
    chatSending,
    taskUnreadCount,
    chatStreamRef,
    tabNotesRef,
    tabChatRef,
    tabDetailsRef,
    paneTab,
    selectPaneTab,
    onPaneTabKeydown,
    callApi,
    connectedTaskId,
    connectedTaskName,
    formatCleanTime,
    formatMsgTime,
    checkRavenStatus,
    fetchTaskChat,
    openChatTab,
    sendChatMessage,
    pinSpec,
    setupRealtimeChat
  };
}
