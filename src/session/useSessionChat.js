import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { blockTitle } from '../utils/blockTitle.js';

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
  // An entry added by hand is its Log only: the block's details and chat belong to the block
  // Task chat is a Raven channel on an ERPNext Task: offered only when this work is one
  const paneTabs = computed(() => (props.mode === 'entry' ? ['notes'] : ['notes', 'details', ...(isRavenAvailable.value && connectedTaskId.value ? ['chat'] : [])]));
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

  // The ERPNext Task this session's chat is about, or null. Never the block's own name or a
  // to-do: Raven has no channel for them (their talk is the block's Activity, under Details),
  // so a message sent with one went nowhere and the page said nothing.
  const connectedTaskId = computed(() => {
    const blk = props.trackerBoundBlock;
    if (blk) return blk.task || null;
    const match = (props.assignedTasks || []).find(t =>
      t.kind === 'Task' && t.subject && t.subject === props.trackerNotes
    );
    return match ? match.ref : null;
  });
  // The task's own name, to say what the chat is about
  const chatTaskSubject = computed(() => {
    const id = connectedTaskId.value;
    if (!id) return '';
    const row = (props.assignedTasks || []).find(t => t.ref === id);
    return (row && row.subject) || (props.trackerBoundBlock && props.trackerBoundBlock.task_subject) || id;
  });
  // Why a message was not sent (or pinned), said under the box; what was typed stays
  const chatError = ref('');
  const refusal = (e, fallback) => {
    const msg = e && e.message;
    if (!msg || msg === 'Request failed') return fallback;
    try {
      const list = JSON.parse(msg);
      if (Array.isArray(list) && list.length) return JSON.parse(list[0]).message || fallback;
    } catch (_) {}
    return msg;
  };

  const connectedTaskName = computed(() => {
    if (props.trackerBoundBlock) {
      return blockTitle(props.trackerBoundBlock, props.trackerBoundBlock.task || 'Client Support Session');
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
    chatError.value = '';
    try {
      const res = await callApi('post_task_chat_message', {
        task_id: connectedTaskId.value,
        content: text
      });
      if (res && res.message && res.message.success) {
        chatInputText.value = '';
        await fetchTaskChat();
      } else {
        chatError.value = 'Not sent. ' + ((res && res.message && res.message.error) || 'Try again.');
      }
    } catch (e) {
      chatError.value = 'Not sent. ' + refusal(e, 'Try again.');
    } finally {
      chatSending.value = false;
    }
  }

  async function pinSpec(msgId) {
    if (!msgId || !connectedTaskId.value) return;
    chatError.value = '';
    try {
      const res = await callApi('pin_task_spec', {
        message_id: msgId,
        task_id: connectedTaskId.value
      });
      if (res && res.message && res.message.success) {
        if (typeof window !== 'undefined' && window.frappe && window.frappe.show_alert) {
          window.frappe.show_alert({ message: 'Pinned as the task spec', indicator: 'green' });
        }
      } else {
        chatError.value = 'Not pinned. ' + ((res && res.message && res.message.error) || 'Try again.');
      }
    } catch (e) {
      chatError.value = 'Not pinned. ' + refusal(e, 'Try again.');
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
    chatError.value = '';
    if (newId && activePaneTab.value === 'chat') {
      fetchTaskChat();
    }
  });

  onMounted(() => {
    if (props.mode === 'entry') return;
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
    chatTaskSubject,
    chatError,
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
