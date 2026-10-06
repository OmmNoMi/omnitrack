import { ref, watch, onMounted, onUnmounted } from "vue";
import { popoverOpen, dialogTookEscape } from "../utils/popover.js";
import { dueReminders, reminderKey } from "../utils/blockReminders.js";
import { blockTitle } from "../utils/blockTitle.js";
import { clock, toMin, localISO } from "../utils/clockTime.js";

/**
 * End-of-day wrap-up and lifecycle effects.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationEod(w) {
  const { _appMenuOutside, _dropdownOutside, _slashFocus, activeBlock, activeTab, applyTheme, checkBlockOverrun, checkInactivity, checkRemoteActiveSession, confirmStillWorking, fetchDrawerChat, fetchPlannerData, fetchTaskRavenDetails, fetchWorkstationData, handleRemoteSessionCleared, handleResize, isDarkMode, isManager, isTracking, lastActivityTime, playInactivityChime, playStartOnTimeChime, playUpcoming10mChime, postJSON, ravenChannel, ravenTask, reconcileActiveSession, recordUserActivity, restoreActiveSession, scrollPlannerToMorning, selectedEmployee, session, showAppMenu, showBlockDrawer, showBookModal, showCancelModal, showEditSessionModal, showEmptyStopModal, showInactivityModal, showNatureFilter, showStartTimeChoiceModal, showSwitchConfirmModal, showSessionDrawer, showSwitchTaskModal, showTaskRavenDrawer, showToast, showTrackerPopup, showWorkflowModal, startNowClock, stopNowClock, toggleTrack, trackerTimer, unlockAudio } = w;
  let _livePollTimer = null;
  let _reminderTimer = null;

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
  const refreshReviews = async () => {
    await fetchPendingApprovals();
    await fetchWorkstationData(selectedEmployee.value);
    if (typeof fetchPlannerData === 'function') await fetchPlannerData();
  };
  // An approval can be taken back for a few seconds (the server keeps what it replaced)
  const UNDO_APPROVAL_MS = 5000;
  const undoApproval = async (b) => {
    try {
      const res = await postJSON('undo_block_approval', { block_name: b.name });
      b.approval_status = (res && res.approval_status) || 'Draft';
      showToast('Approval undone', 'info');
      await refreshReviews();
    } catch (e) {
      showToast('Could not undo: ' + (e && e.message || e), 'danger');
    }
  };
  const approveOne = async (b, message) => {
    if (!b || !b.name) return;
    loadingApprovals.value = true;
    try {
      await postJSON('approve_work_blocks', {
        block_names: [b.name]
      });
      b.approval_status = 'Approved'; // the open drawer shows the new state at once
      showToast(message, 'success', { action: { label: 'Undo', onClick: () => undoApproval(b) }, duration: UNDO_APPROVAL_MS });
      await refreshReviews();
    } catch (e) {
      showToast('Failed to approve: ' + (e && e.message || e), 'danger');
    } finally {
      loadingApprovals.value = false;
    }
  };
  const approveWorkBlockSingle = (b) => approveOne(b, `Approved for ${b && (b.associate_name || b.employee)}`);
  const quickApproveBlock = (b) => approveOne(b, 'Entry approved');
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
    else if (showSessionDrawer.value) showSessionDrawer.value = false;
    else if (showBlockDrawer.value) showBlockDrawer.value = false;
    else if (showAppMenu.value) showAppMenu.value = false;
    else if (showTrackerPopup.value) showTrackerPopup.value = false;
    else if (showNatureFilter.value) showNatureFilter.value = false;
  };
  watch([showInactivityModal, showStartTimeChoiceModal, showBookModal, showEditSessionModal, showSwitchTaskModal, showSwitchConfirmModal, showEmptyStopModal, showCancelModal, showWorkflowModal, showBlockDrawer, showSessionDrawer, showTaskRavenDrawer], (vals) => {
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

    // One path for every block alert, from the server or from the app's own clock. Each block's
    // reminder goes out once, whichever source is first. The system notification shows whenever
    // this window is not in front, not only when its tab is hidden.
    const alertKeyFor = (data) => {
      const kind = data.alert_type || '';
      if (!data.block_name || (kind !== 'upcoming_10m' && kind !== 'start_on_time')) return '';
      return reminderKey(localISO(new Date()), data.block_name, kind);
    };
    const handleIncomingBlockAlert = (data) => {
      if (!data) return;
      const key = alertKeyFor(data);
      if (key) {
        try {
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, '1');
        } catch (e) {}
      }
      const aType = data.alert_type || '';
      if (aType === 'upcoming_10m') {
        playUpcoming10mChime();
        showToast(data.title || 'A planned block starts soon', 'info');
      } else if (aType === 'start_on_time') {
        playStartOnTimeChime();
        showToast(data.title || 'Time to start your planned block', 'success');
      } else {
        playInactivityChime();
        showToast(data.title || 'OmniTrack Alert', 'info');
      }

      const away = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !away) return;
      const payload = {
        type: 'SHOW_NOTIFICATION',
        title: data.title,
        alert_type: aType,
        options: {
          body: data.message,
          tag: key || undefined,
          icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
          badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
          data: { url: data.action_url || '/omnitrack', block_name: data.block_name }
        }
      };
      const fallback = () => {
        try { new Notification(data.title, { body: data.message, tag: key || undefined, icon: payload.options.icon }); } catch (e) {}
      };
      // The worker adds the Start session and Open buttons. A page loaded before the worker took
      // over has no controller yet, so post to the active worker instead.
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => (reg && reg.active ? reg.active.postMessage(payload) : fallback()))
          .catch(fallback);
      } else {
        fallback();
      }
    };

    // The app's own reminder clock: while any OmniTrack tab is open, a planned block alerts
    // ten minutes before and at its start even when the server's alert never arrives.
    const checkBlockReminders = () => {
      const now = new Date();
      const due = dueReminders(w.workBlocks ? w.workBlocks.value : [], {
        date: localISO(now),
        minute: now.getHours() * 60 + now.getMinutes(),
        user: (window.OMNITRACK_SESSION || {}).user,
        runningBlock: isTracking.value ? (w.trackerBlockName && w.trackerBlockName.value) : ''
      });
      for (const { block, kind, until } of due) {
        const title = blockTitle(block, 'Planned block');
        const when = clock(toMin(block.start_time)) + (block.end_time ? ' – ' + clock(toMin(block.end_time)) : '');
        handleIncomingBlockAlert(kind === 'start_on_time'
          ? { alert_type: kind, block_name: block.name, title: 'Time to start: ' + title, message: 'Planned for ' + when + '.', action_url: '/omnitrack?action=view_block&block=' + encodeURIComponent(block.name) }
          : { alert_type: kind, block_name: block.name, title: 'In ' + until + ' min: ' + title, message: 'Starts at ' + when + '. Wrap up what you are on.', action_url: '/omnitrack?action=view_block&block=' + encodeURIComponent(block.name) });
      }
    };
    _reminderTimer = setInterval(checkBlockReminders, 20000);
    setTimeout(checkBlockReminders, 3000);

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
        // Bundled code is never rendered by Jinja: the site and port come from the page.
        // A namespace other than the site's own is refused, and then no alert ever arrives.
        const page = window.OMNITRACK_SESSION || {};
        const siteName = page.site || host;
        let socketHost;
        if (isLocal) {
          const socketPort = page.socketio_port || 9000;
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
    if (_reminderTimer) { clearInterval(_reminderTimer); _reminderTimer = null; }
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
