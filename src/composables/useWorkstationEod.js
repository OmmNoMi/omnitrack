import { ref, watch, onMounted, onUnmounted } from "vue";
import { popoverOpen, dialogTookEscape } from "../utils/popover.js";

/**
 * End-of-day wrap-up and lifecycle effects.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationEod(w) {
  const { _appMenuOutside, _dropdownOutside, _slashFocus, activeBlock, activeTab, applyTheme, checkBlockOverrun, checkInactivity, checkRemoteActiveSession, confirmStillWorking, fetchDrawerChat, fetchPlannerData, fetchTaskRavenDetails, fetchWorkstationData, handleRemoteSessionCleared, handleResize, isDarkMode, isManager, isTracking, lastActivityTime, playInactivityChime, playStartOnTimeChime, playUpcoming10mChime, postJSON, ravenChannel, ravenTask, reconcileActiveSession, recordUserActivity, restoreActiveSession, scrollPlannerToMorning, selectedEmployee, session, showAppMenu, showBlockDrawer, showBookModal, showCancelModal, showEditSessionModal, showEmptyStopModal, showInactivityModal, showNatureFilter, showStartTimeChoiceModal, showSwitchConfirmModal, showSwitchTaskModal, showTaskRavenDrawer, showToast, showTrackerPopup, showWorkflowModal, startNowClock, stopNowClock, toggleTrack, trackerTimer, unlockAudio } = w;
  let _livePollTimer = null;

  // ----------------------------------------------------
  // Team Work Block & Timesheet Approvals (Manager Governance)
  // ----------------------------------------------------
  const pendingApprovals = ref([]);
  const loadingApprovals = ref(false);
  const fetchPendingApprovals = async () => {
    if (!isManager.value) return;
    loadingApprovals.value = true;
    try {
      const res = await postJSON('get_pending_team_approvals', {
        employee: selectedEmployee.value || 'All'
      });
      pendingApprovals.value = (res && res.message) || res || [];
    } catch (e) {
      pendingApprovals.value = [];
    } finally {
      loadingApprovals.value = false;
    }
  };
  const approveWorkBlockSingle = async (b) => {
    if (!b || !b.name) return;
    loadingApprovals.value = true;
    try {
      await postJSON('approve_work_blocks', {
        block_names: [b.name]
      });
      showToast(`Approved work block for ${b.associate_name || b.employee}`, 'success');
      await fetchPendingApprovals();
      await fetchWorkstationData(selectedEmployee.value);
      if (typeof fetchPlannerData === 'function') await fetchPlannerData();
    } catch (e) {
      showToast('Failed to approve work block: ' + (e && e.message || e), 'danger');
    } finally {
      loadingApprovals.value = false;
    }
  };
  const quickApproveBlock = async (b) => {
    if (!b || !b.name) return;
    loadingApprovals.value = true;
    try {
      await postJSON('approve_work_blocks', {
        block_names: [b.name]
      });
      b.approval_status = 'Approved'; // the open drawer shows the new state at once
      showToast(`Approved ${b.name}`, 'success');
      await fetchPendingApprovals();
      await fetchWorkstationData(selectedEmployee.value);
      if (typeof fetchPlannerData === 'function') await fetchPlannerData();
    } catch (e) {
      showToast('Failed to approve block: ' + (e && e.message || e), 'danger');
    } finally {
      loadingApprovals.value = false;
    }
  };
  // The drawer passes the reason it collected; other callers fall back to a prompt.
  const quickFlagBlock = async (b, givenReason) => {
    if (!b || !b.name) return;
    const reason = typeof givenReason === 'string'
      ? givenReason
      : window.prompt('What needs clarifying?', b.flagged_reason || '');
    if (reason === null || !reason.trim()) return;
    loadingApprovals.value = true;
    try {
      await postJSON('flag_work_block', {
        block_name: b.name,
        reason: reason.trim()
      });
      b.approval_status = 'Flagged';
      b.flagged_reason = reason.trim();
      showToast(`Flagged ${b.name} for clarification`, 'warning');
      await fetchPendingApprovals();
      await fetchWorkstationData(selectedEmployee.value);
      if (typeof fetchPlannerData === 'function') await fetchPlannerData();
    } catch (e) {
      showToast('Failed to flag block: ' + (e && e.message || e), 'danger');
    } finally {
      loadingApprovals.value = false;
    }
  };
  const approveAllPending = async () => {
    if (!pendingApprovals.value.length) return;
    loadingApprovals.value = true;
    try {
      const names = pendingApprovals.value.map(b => b.name);
      await postJSON('approve_work_blocks', {
        block_names: names
      });
      showToast(`Approved ${names.length} team work block(s)`, 'success');
      await fetchPendingApprovals();
      await fetchWorkstationData(selectedEmployee.value);
      if (typeof fetchPlannerData === 'function') await fetchPlannerData();
    } catch (e) {
      showToast('Failed to approve blocks: ' + (e && e.message || e), 'danger');
    } finally {
      loadingApprovals.value = false;
    }
  };
  // Whether a popover was open when this Escape started. By the time the key bubbles to
  // the document, reka has already closed it, so it is noted on the way down.
  let escForPopover = false;
  const notePopoverEscape = (e) => {
    if (e.key === 'Escape') escForPopover = popoverOpen();
  };
  const onPlannerKeydown = (e) => {
    if (e.key !== 'Escape') return;
    // A list was open (focus can stay on its trigger, outside the portal): it takes this Escape
    if (escForPopover) { escForPopover = false; return; }
    // Already handled inside the dialog (a TimePicker list or Combobox closing itself):
    // that Escape belongs to the popover, not to the dialog around it.
    if (e.defaultPrevented) return;
    // reka's Combobox/MultiSelect close on Escape without preventDefault; their content is
    // portalled into a popper wrapper, so a key from inside one is never the dialog's.
    if (e.target && e.target.closest && e.target.closest('[data-reka-popper-content-wrapper]')) return;
    // An open dialog took it (one opened from inside a drawer is not in this list)
    const dialogEsc = dialogTookEscape(e);
    if (showInactivityModal.value) showInactivityModal.value = false;
    else if (showStartTimeChoiceModal.value) showStartTimeChoiceModal.value = false;
    else if (showTaskRavenDrawer.value && !dialogEsc) showTaskRavenDrawer.value = false;
    else if (showBookModal.value) showBookModal.value = false;
    else if (showEditSessionModal.value) showEditSessionModal.value = false;
    else if (showSwitchTaskModal.value) showSwitchTaskModal.value = false;
    else if (showSwitchConfirmModal.value) showSwitchConfirmModal.value = false;
    else if (showEmptyStopModal.value) showEmptyStopModal.value = false;
    else if (showCancelModal.value) showCancelModal.value = false;
    else if (showWorkflowModal.value) showWorkflowModal.value = false;
    else if (dialogEsc) return;
    else if (showBlockDrawer.value) showBlockDrawer.value = false;
    else if (showAppMenu.value) showAppMenu.value = false;
    else if (showTrackerPopup.value) showTrackerPopup.value = false;
    else if (showNatureFilter.value) showNatureFilter.value = false;
  };
  watch([showInactivityModal, showStartTimeChoiceModal, showBookModal, showEditSessionModal, showSwitchTaskModal, showSwitchConfirmModal, showEmptyStopModal, showCancelModal, showWorkflowModal, showBlockDrawer, showTaskRavenDrawer], (vals) => {
    const anyOpen = vals.some(Boolean);
    if (anyOpen) {
      document.addEventListener('keydown', notePopoverEscape, true);
      document.addEventListener('keydown', onPlannerKeydown);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', notePopoverEscape, true);
      document.removeEventListener('keydown', onPlannerKeydown);
      window.__omnitrackDialogDepth = 0;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.documentElement.style.removeProperty('overflow');
      document.body.style.removeProperty('overflow');
    }
  });
  watch(activeTab, (t) => {
    if (t === 'planner') {
      fetchPlannerData();
      scrollPlannerToMorning();
    } else if (t === 'dashboard') {
      fetchWorkstationData(selectedEmployee.value);
    } else if (t === 'attendance') {
      fetchPendingApprovals();
    }
  });
  onMounted(() => {
    // The tab watch above only fires on a change, so a page opened straight on
    // #/planner (reload, bookmark, shared link) never loaded its blocks.
    if (activeTab.value === 'planner') {
      fetchPlannerData();
      scrollPlannerToMorning();
    }
    const _onUserActivity = () => {
      const now = Date.now();
      if (now - (lastActivityTime.value || 0) > 15000) {
        recordUserActivity();
      }
    };
    window.addEventListener('pointerdown', _onUserActivity, { passive: true });
    window.addEventListener('keydown', _onUserActivity, { passive: true });
    document.addEventListener('keydown', _slashFocus);
    document.addEventListener('pointerdown', _dropdownOutside);
    document.addEventListener('pointerdown', _appMenuOutside);
    applyTheme(isDarkMode.value);
    startNowClock();
    fetchWorkstationData(selectedEmployee.value);
    window.addEventListener('resize', handleResize);
    handleResize();

    // Real-time listener for incoming Raven messages on Task channels
    if (typeof frappe !== 'undefined' && frappe.realtime) {
      frappe.realtime.on('new_message', (data) => {
        if (showTaskRavenDrawer.value && ravenTask.value) {
          const currentTaskId = ravenTask.value.name || ravenTask.value.ref || ravenTask.value.id;
          if (data && (data.link_document === currentTaskId || (ravenChannel.value && data.channel_id === ravenChannel.value.name))) {
            fetchTaskRavenDetails(currentTaskId);
          }
        }
        if (showBlockDrawer.value && activeBlock.value) {
          const currentTaskId = activeBlock.value.task || activeBlock.value.name;
          if (data && data.link_document === currentTaskId) {
            fetchDrawerChat(currentTaskId);
          }
        }
      });
    }

    window.workstationApp = { 
      setActiveTab: (t) => { activeTab.value = t; },
      setDark: (d) => { isDarkMode.value = d; applyTheme(d); }
    };

    // Auto-recover active session (SSR window.OMNITRACK_SESSION.active_session or localStorage)
    try {
      const ssrSession = session && session.active_session;
      if (ssrSession && ssrSession.status === 'active' && ssrSession.startTime) {
        restoreActiveSession(ssrSession);
      } else if (session && session.active_session === null) {
        // Server explicitly verified no active session exists for this user across devices
        localStorage.removeItem('omnitrack_active_session');
      } else {
        const saved = localStorage.getItem('omnitrack_active_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          restoreActiveSession(parsed);
        }
      }
    } catch (e) {}

    // Register service worker for PWA & mobile push notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/assets/omnitrack/sw.js')
        .then(reg => {
          console.log('[OmniTrack] Service Worker registered:', reg.scope);
        })
        .catch(err => {
          console.warn('[OmniTrack] SW registration skipped:', err);
        });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'STILL_WORKING_ELEVATE_FOCUS') {
          confirmStillWorking();
        } else if (event.data && event.data.type === 'REMOTE_STOP_PROMPT') {
          if (isTracking.value) toggleTrack();
        } else if (event.data && event.data.type === 'BLOCK_START_FOCUS') {
          const bName = event.data.block_name;
          if (bName) {
            checkRemoteActiveSession();
            fetchWorkstationData(selectedEmployee.value);
            showToast('Focus session started for ' + bName, 'success');
          }
        } else if (event.data && event.data.type === 'VIEW_BLOCK_FOCUS') {
          fetchWorkstationData(selectedEmployee.value);
        }
      });
    }

    // Handle URL action parameter from push notification tap (e.g. ?action=start_block&block=PWB-...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const blockParam = urlParams.get('block');
      if (urlParams.get('action') === 'still_working') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          confirmStillWorking();
        }, 300);
      } else if (urlParams.get('action') === 'stop') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          if (isTracking.value) toggleTrack();
        }, 300);
      } else if (urlParams.get('action') === 'start_block') {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (blockParam) {
          setTimeout(async () => {
            try {
              await postJSON('start_timer', { block_name: blockParam });
              await checkRemoteActiveSession();
              await fetchWorkstationData(selectedEmployee.value);
              showToast('Started session for ' + blockParam, 'success');
              playStartOnTimeChime();
            } catch (e) {
              showToast('Could not auto-start block: ' + (e && e.message || e), 'warning');
            }
          }, 400);
        }
      } else if (urlParams.get('action') === 'view_block') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          fetchWorkstationData(selectedEmployee.value);
          playUpcoming10mChime();
        }, 300);
      }
    } catch (_) {}

    // Centralized Handler for Realtime Block Alerts
    const handleIncomingBlockAlert = (data) => {
      if (!data) return;
      const aType = data.alert_type || '';
      if (aType === 'upcoming_10m') {
        playUpcoming10mChime();
        showToast(data.title || '⏳ Upcoming in 10m', 'info');
      } else if (aType === 'start_on_time') {
        playStartOnTimeChime();
        showToast(data.title || '🚀 Time to Start Session', 'success');
      } else {
        playInactivityChime();
        showToast(data.title || 'OmniTrack Alert', 'info');
      }

      // Trigger local OS notification if tab is in background and permission granted
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SHOW_NOTIFICATION',
              title: data.title,
              alert_type: aType,
              options: {
                body: data.message,
                icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
                badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
                data: { url: data.action_url || '/omnitrack', block_name: data.block_name }
              }
            });
          } else {
            new Notification(data.title, {
              body: data.message,
              icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg'
            });
          }
        } catch (notifErr) {}
      }
    };

    // Unlock Web Audio context on first user tap/key for mobile chime reliability
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            ctx.resume();
          }
        }
      } catch (e) {}
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    // Listen for visibility change to immediately sync timer & fetch fresh active session on phone wake
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkRemoteActiveSession();
        fetchWorkstationData(selectedEmployee.value);
        checkInactivity();
        checkBlockOverrun();
      }
    });
    window.addEventListener('focus', () => {
      checkInactivity();
      checkBlockOverrun();
    });

    // 1. Rock-solid background poller (every 2s for instant multi-device reflection)
    _livePollTimer = setInterval(checkRemoteActiveSession, 2000);

    // 2. Realtime sync across devices via WebSockets / Socket.IO if available
    if (typeof io !== 'undefined') {
      try {
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
          || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
        const siteName = "{{ frappe.local.site }}";
        let socketHost;
        if (isLocal) {
          const socketPort = (window.frappe && frappe.boot && frappe.boot.socketio_port) || 9003;
          socketHost = `${window.location.protocol}//${host}:${socketPort}/${siteName}`;
        } else {
          socketHost = `${window.location.protocol}//${host}/${siteName}`;
        }
        const socket = io(socketHost, {
          withCredentials: true,
          reconnectionAttempts: 10,
          timeout: 4000,
          transports: ['websocket', 'polling']
        });
        socket.on('omnitrack:active_session_updated', (data) => {
          if (data && data.status === 'active') {
            reconcileActiveSession(data);
          }
        });
        socket.on('omnitrack:active_session_cleared', () => {
          handleRemoteSessionCleared({ authoritative: true });
        });
        socket.on('omnitrack:block_alert', (data) => {
          handleIncomingBlockAlert(data);
        });
        socket.on('omnitrack:timesheet_reminder', (data) => {
          handleIncomingBlockAlert(data);
        });
      } catch (e) {
        console.debug('Socket.io connection bypassed, live poller active', e);
      }
    } else if (window.frappe && frappe.realtime) {
      frappe.realtime.on('omnitrack:active_session_updated', (data) => {
        if (data && data.status === 'active') reconcileActiveSession(data);
      });
      frappe.realtime.on('omnitrack:active_session_cleared', () => {
        handleRemoteSessionCleared({ authoritative: true });
      });
      frappe.realtime.on('omnitrack:block_alert', (data) => {
        handleIncomingBlockAlert(data);
      });
      frappe.realtime.on('omnitrack:timesheet_reminder', (data) => {
        handleIncomingBlockAlert(data);
      });
    }
  });
  onUnmounted(() => {
    if (_livePollTimer) { clearInterval(_livePollTimer); _livePollTimer = null; }
    document.removeEventListener('keydown', _slashFocus);
    document.removeEventListener('pointerdown', _dropdownOutside);
    document.removeEventListener('pointerdown', _appMenuOutside);
    stopNowClock();
    if (trackerTimer.value) clearInterval(trackerTimer.value);
    window.removeEventListener('resize', handleResize);
  });

  Object.assign(w, {
    pendingApprovals,
    loadingApprovals,
    fetchPendingApprovals,
    approveWorkBlockSingle,
    quickApproveBlock,
    quickFlagBlock,
    approveAllPending,
  });
}
