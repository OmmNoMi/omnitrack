import * as Vue from "vue";
import { useWorkSessionStore } from "../stores/workSessionStore.js";
import { useWorkBlockStore } from "../stores/workBlockStore.js";
import { useAssignmentStore } from "../stores/assignmentStore.js";
import { useCollaborationStore } from "../stores/collaborationStore.js";
import { useWorkstationDashboard } from "./useWorkstationDashboard.js";
import { useWorkstationTimeline } from "./useWorkstationTimeline.js";

const { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted, nextTick } = Vue;

export function useOmniTrackWorkstation() {
      // 1. Navigation & Theme
      const getInitialTabFromHash = () => {
        if (typeof window !== 'undefined' && window.location.hash) {
          const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
          if (['dashboard', 'planner', 'timesheets', 'attendance'].includes(raw)) {
            return raw;
          }
        }
        return 'dashboard';
      };
      const activeTab = ref(getInitialTabFromHash());

      if (typeof window !== 'undefined') {
        const handleHashSync = () => {
          const tab = getInitialTabFromHash();
          if (tab && activeTab.value !== tab) {
            activeTab.value = tab;
          }
        };
        window.addEventListener('hashchange', handleHashSync);
        window.addEventListener('popstate', handleHashSync);
      }

      watch(activeTab, (newTab) => {
        if (typeof window !== 'undefined' && newTab) {
          const currentHash = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
          if (currentHash !== newTab) {
            window.location.hash = `#/${newTab}`;
          }
        }
      });

      const initialDark = localStorage.getItem('omnitrack_theme') === 'dark' || (!localStorage.getItem('omnitrack_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const isDarkMode = ref(initialDark);
      const hasFrappeUI = ref(typeof window !== 'undefined' && Boolean(window.OmniTrackSessionBox && window.OmniTrackSessionBox.mount));
      onMounted(() => {
        if (typeof window !== 'undefined' && window.OmniTrackSessionBox && window.OmniTrackSessionBox.mount) {
          hasFrappeUI.value = true;
        }
      });
      const appendSessionLine = (text) => {
        const pt = (text || '').trim();
        if (!pt) return;
        sessionNotesList.value.push(pt);
        syncActiveSession(true);
        triggerHaptic([25]);
      };

      const applyTheme = (dark) => {
        if (dark) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.backgroundColor = '#121212';
          document.body.classList.add('dark');
          document.body.style.backgroundColor = '#121212';
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.backgroundColor = '#F8F9FA';
          document.body.classList.remove('dark');
          document.body.style.backgroundColor = '#F8F9FA';
        }
      };

      const toggleTheme = () => {
        isDarkMode.value = !isDarkMode.value;
        localStorage.setItem('omnitrack_theme', isDarkMode.value ? 'dark' : 'light');
        applyTheme(isDarkMode.value);
      };

      watch(isDarkMode, (newVal) => {
        applyTheme(newVal);
      }, { immediate: true });

      const mobileTabs = computed(() => [
        { id: 'dashboard', label: 'Dashboard', icon: '📊', badge: null },
        { id: 'planner', label: 'Calendar', icon: '📅', badge: plannerData.value && plannerData.value.totals && plannerData.value.totals.block_count ? plannerData.value.totals.block_count : null },
        { id: 'timesheets', label: 'Timesheets', icon: '⏱️', badge: totalFilteredHours.value ? totalFilteredHours.value + 'h' : null },
        ...(isManager.value ? [{ id: 'attendance', label: 'Team', icon: '👥', badge: null }] : [])
      ]);

      // Helper for local calendar date YYYY-MM-DD
      const getLocalTodayISO = (d = new Date()) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      const todayISO = () => getLocalTodayISO();
      const _minToHHMM = (m) => {
        const mm = Math.max(0, Math.min(24 * 60, Math.round(m)));
        return String(Math.floor(mm / 60) % 24).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0');
      };
      const nowMinute = ref((() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })());

      const _utcDate = (iso) => { const [y, m, d] = (iso || '').split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
      const addDays = (iso, n) => { const d = _utcDate(iso); d.setUTCDate(d.getUTCDate() + n); return getLocalTodayISO(d); };

      // Google Meet-Style Dashboard State & Agenda extracted to useWorkstationDashboard
      // Scratchpad & Haptics State
      const sessionNotesList = ref([]);
      const newSessionPoint = ref('');

      const triggerHaptic = (pattern = [30]) => {
        try {
          if (navigator && typeof navigator.vibrate === 'function') {
            navigator.vibrate(pattern);
          }
        } catch (e) {}
      };

      // Nature / Type Options with High-Fidelity Vector SVGs
      const natureOptions = [
        {
          id: 'planned',
          label: 'Planned Work',
          is_working: true,
          is_paid: true,
          category: 'working',
          svgIcon: '<svg class="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
          lightActiveClass: 'bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-500/20 font-bold shadow-xs',
          darkActiveClass: 'bg-blue-950/80 border-blue-500 text-blue-200 ring-2 ring-blue-500/20 font-bold shadow-xs'
        },
        {
          id: 'virtual_meeting',
          label: 'Virtual Meeting',
          is_working: true,
          is_paid: true,
          category: 'working',
          svgIcon: '<svg class="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
          lightActiveClass: 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-2 ring-indigo-500/20 font-bold shadow-xs',
          darkActiveClass: 'bg-indigo-950/80 border-indigo-500 text-indigo-200 ring-2 ring-indigo-500/20 font-bold shadow-xs'
        },
        {
          id: 'unplanned',
          label: 'Unplanned Ops',
          is_working: true,
          is_paid: true,
          category: 'working',
          svgIcon: '<svg class="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
          lightActiveClass: 'bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-500/20 font-bold shadow-xs',
          darkActiveClass: 'bg-amber-950/80 border-amber-500 text-amber-200 ring-2 ring-amber-500/20 font-bold shadow-xs'
        },
        {
          id: 'review',
          label: 'Review & Sync',
          is_working: true,
          is_paid: true,
          category: 'working',
          svgIcon: '<svg class="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>',
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
          lightActiveClass: 'bg-purple-50 border-purple-400 text-purple-800 ring-2 ring-purple-500/20 font-bold shadow-xs',
          darkActiveClass: 'bg-purple-950/80 border-purple-500 text-purple-200 ring-2 ring-purple-500/20 font-bold shadow-xs'
        },
        {
          id: 'break',
          label: 'Break',
          is_working: false,
          is_paid: false,
          category: 'non_working',
          tag: 'Non-Paid',
          svgIcon: '<svg class="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18.75 8.25H6.75a2.25 2.25 0 00-2.25 2.25v3a4.5 4.5 0 004.5 4.5h6a4.5 4.5 0 004.5-4.5v-3a2.25 2.25 0 00-2.25-2.25zM18.75 8.25h1.5a2.25 2.25 0 012.25 2.25v.75a2.25 2.25 0 01-2.25 2.25h-1.5M6 21.75h12M9 3.75v1.5M12 3v2.25M15 3.75v1.5"/></svg>',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
          lightActiveClass: 'bg-rose-50 border-rose-400 text-rose-800 ring-2 ring-rose-500/20 font-bold shadow-xs',
          darkActiveClass: 'bg-rose-950/80 border-rose-500 text-rose-200 ring-2 ring-rose-500/20 font-bold shadow-xs'
        },
        {
          id: 'leave',
          label: 'Leave',
          is_working: false,
          is_paid: false,
          category: 'non_working',
          tag: 'Non-Paid',
          svgIcon: '<svg class="w-3.5 h-3.5 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m0-18c-3 0-6 4-6 9s6 9 6 9m0-18c3 0 6 4 6 9s-6 9-6 9"/></svg>',
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
          lightActiveClass: 'bg-teal-50 border-teal-400 text-teal-800 ring-2 ring-teal-500/20 font-bold shadow-xs',
          darkActiveClass: 'bg-teal-950/80 border-teal-500 text-teal-200 ring-2 ring-teal-500/20 font-bold shadow-xs'
        },
        {
          id: 'absent',
          label: 'Absent',
          is_working: false,
          is_paid: false,
          category: 'non_working',
          tag: 'Non-Paid',
          svgIcon: '<svg class="w-3.5 h-3.5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01"/></svg>',
          badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
          lightActiveClass: 'bg-orange-50 border-orange-400 text-orange-800 ring-2 ring-orange-500/20 font-bold shadow-xs',
          darkActiveClass: 'bg-orange-950/80 border-orange-500 text-orange-200 ring-2 ring-orange-500/20 font-bold shadow-xs'
        }
      ];

      const isNonWorkingNature = (nature) => {
        const str = (nature || '').toLowerCase();
        return ['break', 'leave', 'absent', 'out-of-office', 'out of office'].some(m => str.includes(m));
      };

      const getNatureBadge = (nature) => {
        const str = (nature || '').toLowerCase();
        if (str.includes('meeting') || str.includes('virtual')) return natureOptions.find(o => o.id === 'virtual_meeting') || natureOptions[1];
        if (str.includes('unplanned')) return natureOptions.find(o => o.id === 'unplanned') || natureOptions[2];
        if (str.includes('review') || str.includes('sync')) return natureOptions.find(o => o.id === 'review') || natureOptions[3];
        if (str.includes('break')) return natureOptions.find(o => o.id === 'break') || natureOptions[4];
        if (str.includes('leave')) return natureOptions.find(o => o.id === 'leave') || natureOptions[5];
        if (str.includes('absent')) return natureOptions.find(o => o.id === 'absent') || natureOptions[6];
        return natureOptions[0]; // Planned Work
      };

      // 2. Stopwatch Tracker State
      const showTrackerPopup = ref(false);
      const isTracking = ref(false);
      const trackerSeconds = ref(0);
      const trackerTimer = ref(null);
      const trackerNotes = ref('');
      const selectedNature = ref('Planned Work');
      const selectedProject = ref('');
      const trackerProject = selectedProject;
      const trackerNature = selectedNature;
      // When the tracker was started from a Planner block, its logged time is
      // recorded as a real Work Session against that block (feeds actual_hours).
      const trackerBlockName = ref(null);
      const startTime = ref(null);

      // 3. User & Filter State (Permission Scoped)
      const session = window.OMNITRACK_SESSION || { user: 'hardiksharma80912@gmail.com', user_fullname: 'Hardik Sharma', is_manager: true, is_client: false };
      const currentUser = ref(session.user || 'hardiksharma80912@gmail.com');
      const currentUserFullName = ref(session.user_fullname || 'Hardik Sharma');
      const isManager = ref(session.is_manager !== undefined ? session.is_manager : true);
      const isClient = ref(session.is_client || false);

      const csrfToken = session.csrf_token || (window.OMNITRACK_SESSION && window.OMNITRACK_SESSION.csrf_token) || '';
      // Frappe hides the real reason inside _server_messages, a JSON array of JSON.
      const _errText = (err) => {
        let raw = (err && err.message) || String(err || '');
        try {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length) {
            const first = typeof list[0] === 'string' ? JSON.parse(list[0]) : list[0];
            raw = (first && first.message) || raw;
          }
        } catch (e) {}
        return String(raw).replace(/<[^>]*>/g, '').trim() || 'Request failed';
      };

      const postJSON = async (method, body) => {
        const res = await fetch('/api/method/omnitrack.api.' + method, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Frappe-CSRF-Token': csrfToken
          },
          body: JSON.stringify(body || {})
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && (data._server_messages || data.message)) || 'Request failed');
        return data.message;
      };

      // Default directly to the logged-in user's profile
      const selectedEmployee = ref(session.user_fullname || 'Hardik Sharma');
      const filterNature = ref('');
      const filterEmployee = ref('');
      const filterStatus = ref('');
      const timesheetHorizon = ref('week'); // 'day', 'week', 'month', 'all'
      const todayDate = ref(getLocalTodayISO());

      // 4. Data Stores
      const workBlocks = ref([]);
      const projects = ref([]);
      const tasks = ref([]);
      const assignedTasks = ref([]);
      const attentionTasks = ref([]);
      // Attention & Planner Task filter state and computeds delegated to assignmentStore
      const openPlannerWithFilter = (filterType) => {
        if (filterType && filterType !== 'all') {
          plannerTaskFilter.value = filterType;
        }
        activeTab.value = 'planner';
      };

      const onAttentionTabKeydown = (e) => {
        const k = e.key;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k)) return;
        e.preventDefault();
        const tablist = e.currentTarget;
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        if (!tabs.length) return;
        const currentIdx = tabs.findIndex(t => t === document.activeElement);
        let nextIdx = 0;
        if (k === 'ArrowRight') {
          nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % tabs.length;
        } else if (k === 'ArrowLeft') {
          nextIdx = currentIdx < 0 ? tabs.length - 1 : (currentIdx - 1 + tabs.length) % tabs.length;
        } else if (k === 'Home') {
          nextIdx = 0;
        } else if (k === 'End') {
          nextIdx = tabs.length - 1;
        }
        const targetTab = tabs[nextIdx];
        if (targetTab) {
          targetTab.focus();
          const key = targetTab.getAttribute('data-attention-tab');
          if (key) attentionFilter.value = key;
        }
      };

      const onPlannerTaskTabKeydown = (e) => {
        const k = e.key;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(k)) return;
        e.preventDefault();
        const tablist = e.currentTarget;
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        if (!tabs.length) return;
        const currentIdx = tabs.findIndex(t => t === document.activeElement);
        let nextIdx = 0;
        if (k === 'ArrowRight') {
          nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % tabs.length;
        } else if (k === 'ArrowLeft') {
          nextIdx = currentIdx < 0 ? tabs.length - 1 : (currentIdx - 1 + tabs.length) % tabs.length;
        } else if (k === 'Home') {
          nextIdx = 0;
        } else if (k === 'End') {
          nextIdx = tabs.length - 1;
        }
        const targetTab = tabs[nextIdx];
        if (targetTab) {
          targetTab.focus();
          const key = targetTab.getAttribute('data-planner-tab');
          if (key) plannerTaskFilter.value = key;
        }
      };

      // Roving Tabindex Grid Navigation for Attention Tasks (WCAG 2.2 AA)
      const attentionRovingRow = ref(0);
      const attentionRovingCol = ref(0);

      const setAttentionRoving = (r, c) => {
        attentionRovingRow.value = r;
        attentionRovingCol.value = c;
      };

      const attentionTabindex = (r, c) => {
        return (attentionRovingRow.value === r && attentionRovingCol.value === c) ? 0 : -1;
      };

      const focusAttentionCell = (targetRow, targetCol) => {
        const rows = visibleAttentionTasks.value || [];
        if (!rows.length) return;
        const r = Math.max(0, Math.min(targetRow, rows.length - 1));
        const task = rows[r];
        const maxCol = (task && task.workflow_actions && task.workflow_actions.length > 0) ? 4 : 3;
        const c = Math.max(0, Math.min(targetCol, maxCol));

        setAttentionRoving(r, c);
        nextTick(() => {
          const el = document.querySelector(`[data-attention-row="${r}"][data-attention-col="${c}"]`);
          if (el) {
            el.focus();
            if (el.scrollIntoView) {
              const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              el.scrollIntoView({ block: 'nearest', behavior: prefersReduced ? 'auto' : 'smooth' });
            }
          }
        });
      };

      const toggleShowAllAttentionTasks = () => {
        const wasCollapsed = !showAllAttentionTasks.value;
        showAllAttentionTasks.value = !showAllAttentionTasks.value;
        nextTick(() => {
          const rows = visibleAttentionTasks.value || [];
          if (!rows.length) return;
          // When clicking show more or show less, focus the last element that was visible in the collapsed view
          // so the user can immediately keep scrolling down with ArrowDown!
          const targetIndex = Math.min(ATTENTION_TASKS_COLLAPSED_LIMIT - 1, rows.length - 1);
          focusAttentionCell(Math.max(0, targetIndex), 0);
        });
      };

      const onAttentionGridKey = (ev, r, c) => {
        // Event isolation shield: if keydown occurred inside an open menu, ignore
        if (ev.target && (ev.target.closest('[role="menu"]') || ev.target.closest('[data-f-dropdown-menu] [role="menu"]'))) {
          return;
        }

        // If trigger button has aria-expanded="true", the menu is open; let menu handle navigation
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute('aria-expanded') === 'true') {
          return;
        }

        const k = ev.key;
        if (k !== 'ArrowUp' && k !== 'ArrowDown' && k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') {
          return;
        }

        // On column 4 (Workflow trigger), ArrowDown or ArrowUp should activate the menu rather than changing rows
        if (c === 4 && (k === 'ArrowDown' || k === 'ArrowUp')) {
          const dropdownEl = ev.target.closest('[data-f-dropdown-menu]');
          if (dropdownEl) {
            // Let the event bubble to FDropdownMenu's onTriggerKeydown to open and focus the menuitem
            return;
          }
        }

        ev.preventDefault();

        const rows = visibleAttentionTasks.value || [];
        if (!rows.length) return;

        if (k === 'ArrowDown') {
          focusAttentionCell(r + 1, c);
        } else if (k === 'ArrowUp') {
          focusAttentionCell(r - 1, c);
        } else if (k === 'ArrowRight') {
          focusAttentionCell(r, c + 1);
        } else if (k === 'ArrowLeft') {
          focusAttentionCell(r, c - 1);
        } else if (k === 'Home') {
          if (ev.ctrlKey || ev.metaKey) {
            focusAttentionCell(0, 0);
          } else {
            focusAttentionCell(r, 0);
          }
        } else if (k === 'End') {
          const maxC = (rows[r] && rows[r].workflow_actions && rows[r].workflow_actions.length > 0) ? 4 : 3;
          if (ev.ctrlKey || ev.metaKey) {
            focusAttentionCell(rows.length - 1, maxC);
          } else {
            focusAttentionCell(r, maxC);
          }
        }
      };

      const activeWorkflowMenuTask = ref(null);
      const showWorkflowModal = ref(false);
      const workflowTargetTask = ref(null);
      const workflowTargetAction = ref(null);
      const workflowComment = ref('');
      const workflowBusy = ref(false);
      const todayPlannedBlocks = computed(() => {
        return (workBlocks.value || []).filter(b => {
          const st = (b.status || '').toLowerCase();
          return st !== 'completed' && st !== 'cancelled';
        });
      });

      // ToDo Picker & Search actions delegated to assignmentStore
      const selectPlannedBlock = (b) => {
        bindSessionToBlock(b);
        todoDropdownOpen.value = false;
        todoSearchQuery.value = '';
      };

      const onTodoSearchEnter = () => {
        if (filteredOpenTodos.value.length > 0) {
          selectTodoToAutofill(filteredOpenTodos.value[0]);
        } else if (filteredPlannedBlocks.value.length > 0) {
          selectPlannedBlock(filteredPlannedBlocks.value[0]);
        } else if (showCustomOption.value) {
          selectCustomTitle();
        }
      };

      const clearSelectedTodo = () => {
        _explicitBoundBlock.value = null;
        trackerBlockName.value = null;
        trackerNotes.value = '';
        syncActiveSession();
        triggerHaptic([20]);
      };

      const bindSessionToBlock = (b) => {
        if (!b) {
          _explicitBoundBlock.value = null;
          trackerBlockName.value = null;
          syncActiveSession();
          triggerHaptic([20]);
          showToast('Unbound session from work block', 'info');
          return;
        }
        _explicitBoundBlock.value = b;
        trackerBlockName.value = b.name;
        const taskTitle = b.task_subject || b.work_item_label || (b.task ? (b.task_subject || b.task) : '') || b.deliverable_notes || '';
        if (taskTitle) trackerNotes.value = taskTitle;
        if (b.project) {
          selectedProject.value = b.project;
          trackerProject.value = b.project;
        }
        if (b.task_nature) {
          const nat = getNatureBadge(b.task_nature).label;
          selectedNature.value = nat;
          trackerNature.value = nat;
        }
        syncActiveSession();
        triggerHaptic([25]);
        showToast(`Bound session to Work Block ${b.name}`, 'info');
      };
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

      const filteredTeamMembers = computed(() => {
        return teamMembers.value.filter(m => 
          (m.full_name || '').toLowerCase() !== (currentUserFullName.value || '').toLowerCase() &&
          (m.name || '').toLowerCase() !== (currentUser.value || '').toLowerCase()
        );
      });
      const synthesizerLogs = ref([]);
      const hourlyPresence = ref([0, 0, 0, 0, 0, 0, 0, 2, 3, 3, 4, 3, 2, 5, 5, 6, 4, 1, 1, 1, 3, 3, 2, 0]);

      // 5. Toast Notifications
      const toast = ref({ show: false, message: '', type: 'info' });
      const showToast = (message, type = 'info') => {
        toast.value = { show: true, message, type };
        setTimeout(() => { toast.value.show = false; }, 3500);
      };

      // Collaboration Domain Store Integration
      const collaborationStore = useCollaborationStore({ postJSON, showToast });
      const {
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
        openTaskRavenDrawer,
        closeTaskRavenDrawer,
        openRavenApp,
        fetchTaskRavenDetails,
        sendRavenChatMessage,
        fetchDrawerChat,
        sendDrawerChatMessage
      } = collaborationStore;

      // Assignment Domain Store Integration
      const assignmentStore = useAssignmentStore({
        assignedTasks,
        attentionTasks,
        todayDate,
        openBookModal: (t) => { if (typeof openBookModal === 'function') openBookModal(t); },
        postJSON,
        showToast,
        fetchWorkstationData,
        selectedEmployee,
        todayPlannedBlocks,
        syncActiveSession: (force) => { if (typeof syncActiveSession === 'function') syncActiveSession(force); },
        triggerHaptic: (pattern) => { if (typeof triggerHaptic === 'function') triggerHaptic(pattern); },
        sessionStore: null
      });

      const {
        showAllAttentionTasks,
        ATTENTION_TASKS_COLLAPSED_LIMIT,
        attentionFilter,
        attentionSearch,
        plannerTaskFilter,
        plannerTaskSearch,
        overdueTasksCount,
        underplannedTasksCount,
        dueSoonTasksCount,
        filteredAttentionTasks,
        visibleAttentionTasks,
        remainingAttentionTasksCount,
        filteredPlannerTasks,
                setAttentionFilter,
        setPlannerTaskFilter,
        openTodos,
        todoDropdownOpen,
        todoSearchQuery,
        todoSearchInput,
        toggleTodoPicker,
        filteredOpenTodos,
        filteredPlannedBlocks,
        showCustomOption,
        selectTodoToAutofill,
        selectCustomTitle
      } = assignmentStore;

      // Work Block Domain Store Integration
      const workBlockStore = useWorkBlockStore({
        postJSON,
        showToast,
        fetchWorkstationData,
        fetchPlannerData: async () => { if (typeof fetchPlannerData === 'function') await fetchPlannerData(); },
        selectedEmployee,
        todayDate,
        yesterdayDate,
        isManager,
        sessionStore: null,
        isBlockLocked: (b) => { return typeof isBlockLocked === 'function' ? isBlockLocked(b) : false; },
        isPastBlock: (b) => { return typeof isPastBlock === 'function' ? isPastBlock(b) : false; },
        isTracking,
        trackerBlockName,
        currentElapsedSeconds: trackerSeconds,
        sessionNotesList,
        stopSessionRemote: async (prompt) => { if (typeof stopSessionRemote === 'function') await stopSessionRemote(prompt); },
        discardSession: () => { if (typeof discardSession === 'function') discardSession(); }
      });

      const {
        calendarViewMode,
        plannerDate,
        plannerDateDisplay,
        calendarDays,
        showBookModal,
        bookForm,
        showCancelModal,
        cancelTargetBlock,
        cancelForm,
        cancelReasons
      } = workBlockStore;

      // Dashboard Domain Store Integration
      const dashboardStore = useWorkstationDashboard({
        todayDate,
        filteredWorkBlocks,
        isTracking,
        trackerBlockName,
        trackerBoundBlock,
        isDarkMode,
        isNonWorkingNature,
        getLocalTodayISO,
        todayISO,
        addDays,
        _minsOf
      });

      const {
        selectedDashboardDate,
        dashboardWeekOffset,
        dashboardWeekDays,
        selectedDashboardDateLabel,
        pastBlocksHeading,
        pastDeliverablesStats,
        getBlockCardAccent,
        getBlockBadgeTheme,
        getBlockVarianceBadge,
        focusBlocksHeading,
        dashboardDayTitle,
        dashboardDaySummary,
        todayDirection,
        shiftDashboardWeek,
        selectDashboardDate,
        onDashboardDayKey,
        resetDashboardToToday,
        formatAmPm,
        formatBlockRange,
        getMeetUrl,
        getBlockTimingInfo,
        dayFocusBlocks,
        awayFocusBlocks,
        workFocusBlocks,
        activeOrCurrentBlocks,
        untrackedCurrentBlocks,
        upNextBlock,
        isBlockInNow,
        isBlockConcluded,
        isBlockCompleted,
        getStartsInText,
        upcomingFocusBlocks,
        pastFocusBlocks,
        showAllPastBlocks,
        visiblePastFocusBlocks,
        remainingPastBlocksCount,
        concludedRovingRow,
        concludedRovingCol,
        canBlockReopen,
        hasBlockExpandableNotes,
        getConcludedNotesCol,
        getMaxConcludedCol,
        setConcludedRoving,
        concludedTabindex,
        focusConcludedCell,
        onConcludedGridKey,
        toggleShowAllPastBlocks,
        expandedBlockNotes,
        isBlockNotesExpanded,
        toggleBlockNotes,
        isLongNote,
        dashboardKPIs,
        updateDashboardKPIs,
        paciPlannedHours,
        paciUnplannedHours,
        paciNonWorkingHours,
        paciRatio,
        totalFilteredHours,
        capacityLeads,
        _blockEffectiveStartMins,
        _byTimeDesc,
        _byTimeAsc
      } = dashboardStore;
      const showNewTaskModal = ref(false);
      const newTaskForm = ref({
        notes: '',
        assignee: 'nomeshwer@ommnomi.in',
        project: '',
        task: '',
        nature: 'Planned Work',
        date: getLocalTodayISO(),
        startTime: '10:00',
        endTime: '11:00',
        duration: 1.0
      });

      const onNewTaskTimeChange = () => {
        if (newTaskForm.value.startTime && newTaskForm.value.endTime) {
          const [sh, sm] = newTaskForm.value.startTime.split(':').map(Number);
          const [eh, em] = newTaskForm.value.endTime.split(':').map(Number);
          let sMins = sh * 60 + sm;
          let eMins = eh * 60 + em;
          if (eMins < sMins) eMins += 24 * 60;
          const dur = Math.max(0.25, Math.round(((eMins - sMins) / 60) * 10) / 10);
          newTaskForm.value.duration = dur;
        }
      };

      const setNewTaskDurationPreset = (hrs) => {
        newTaskForm.value.duration = hrs;
        if (newTaskForm.value.startTime) {
          const [sh, sm] = newTaskForm.value.startTime.split(':').map(Number);
          let eMins = sh * 60 + sm + Math.round(hrs * 60);
          eMins = eMins % (24 * 60);
          const eh = String(Math.floor(eMins / 60)).padStart(2, '0');
          const em = String(eMins % 60).padStart(2, '0');
          newTaskForm.value.endTime = `${eh}:${em}`;
        }
      };

      const openNewTaskModal = (initialDate = null) => {
        let defaultAssignee = currentUser.value || 'nomeshwer@ommnomi.in';
        if (selectedEmployee.value && selectedEmployee.value !== 'All') {
          const match = teamMembers.value.find(m => 
            m.name.toLowerCase() === selectedEmployee.value.toLowerCase() || 
            m.full_name.toLowerCase().includes(selectedEmployee.value.toLowerCase())
          );
          if (match) defaultAssignee = match.name;
        }

        const now = new Date();
        const mins = now.getMinutes();
        const nextQuarter = Math.ceil(mins / 15) * 15;
        now.setMinutes(nextQuarter, 0, 0);
        const sh = String(now.getHours()).padStart(2, '0');
        const sm = String(now.getMinutes()).padStart(2, '0');
        const defaultStartTime = `${sh}:${sm}`;

        const endDt = new Date(now.getTime() + 60 * 60 * 1000);
        const eh = String(endDt.getHours()).padStart(2, '0');
        const em = String(endDt.getMinutes()).padStart(2, '0');
        const defaultEndTime = `${eh}:${em}`;

        const targetDate = initialDate || selectedDashboardDate.value || todayDate.value || getLocalTodayISO();

        newTaskForm.value = {
          notes: '',
          assignee: defaultAssignee,
          project: selectedProject.value || '',
          task: '',
          nature: 'Planned Work',
          date: targetDate,
          startTime: defaultStartTime,
          endTime: defaultEndTime,
          duration: 1.0
        };
        showNewTaskModal.value = true;
      };

      // 7. Computed Helpers
      const currentEmployeeFirstName = computed(() => {
        if (selectedEmployee.value === 'All') return 'Hardik';
        return selectedEmployee.value.split(' ')[0] || 'Alex';
      });

      const formattedTime = computed(() => {
        const hrs = String(Math.floor(trackerSeconds.value / 3600)).padStart(2, '0');
        const mins = String(Math.floor((trackerSeconds.value % 3600) / 60)).padStart(2, '0');
        const secs = String(trackerSeconds.value % 60).padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
      });

      const bottomBarTimer = computed(() => {
        const s = trackerSeconds.value || 0;
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        const pad = (n) => String(n).padStart(2, '0');

        if (hrs === 0) {
          return {
            isHours: false,
            primary: `${pad(mins)}:${pad(secs)}`,
            sub: 'min:sec',
            mins: pad(mins),
            secs: pad(secs)
          };
        }

        return {
          isHours: true,
          hours: hrs,
          minutes: pad(mins),
          seconds: pad(secs),
          primary: `${hrs}h ${pad(mins)}m`,
          sub: `${pad(secs)}s`
        };
      });

      // Dynamic Filtering of Work Blocks based on employee, nature, and status
      const filteredWorkBlocks = computed(() => {
        return workBlocks.value.filter(b => {
          // Employee / Permission Filter
          if (selectedEmployee.value !== 'All') {
            const empTarget = selectedEmployee.value.toLowerCase();
            const bEmp = (b.employee || '').toLowerCase();
            const bAssoc = (b.associate_name || '').toLowerCase();
            const bFull = (b.employee_full_name || '').toLowerCase();
            const targetFirst = empTarget.split(' ')[0];
            const targetMail = empTarget.split('@')[0];

            let match = false;
            if (empTarget.includes('hardik')) {
              match = bEmp.includes('hardik') || bAssoc.includes('hardik') || bEmp.includes('admin') || bAssoc.includes('eager');
            } else if (empTarget.includes('meenaxi')) {
              match = bEmp.includes('meenaxi') || bAssoc.includes('meenaxi');
            } else if (empTarget.includes('nomeshwer') || empTarget.includes('devoted')) {
              match = bEmp.includes('nomeshwer') || bAssoc.includes('devoted');
            } else {
              match = bEmp.includes(targetFirst) || bEmp.includes(targetMail) || 
                      bAssoc.includes(targetFirst) || bAssoc.includes(targetMail) ||
                      bFull.includes(targetFirst);
            }
            if (!match) return false;
          }

                    // Toolbar filters
          if (filterNature.value) {
            const nature = (b.task_nature || '').toLowerCase();
            const fNat = filterNature.value.toLowerCase();
            if (fNat === 'planned' && (nature.includes('unplanned') || nature.includes('break') || nature.includes('review'))) return false;
            if (fNat === 'unplanned' && !nature.includes('unplanned')) return false;
            if (fNat === 'review' && !(nature.includes('review') || nature.includes('sync'))) return false;
            if (fNat === 'break' && !nature.includes('break')) return false;
          }

          if (filterEmployee.value) {
            const fTarget = filterEmployee.value.toLowerCase().split(' ')[0];
            const bAssoc = (b.associate_name || b.employee || '').toLowerCase();
            if (!bAssoc.includes(fTarget)) return false;
          }

          if (filterStatus.value && b.status !== filterStatus.value) {
            return false;
          }

          // Timesheet Horizon Review Filter (Day / Week / Month / All)
          if (timesheetHorizon.value && timesheetHorizon.value !== 'all' && b.work_date) {
            const todayStr = getLocalTodayISO();
            if (timesheetHorizon.value === 'day') {
              if (b.work_date !== todayStr) return false;
            } else if (timesheetHorizon.value === 'week') {
              // Current week (Monday to Sunday)
              const nowD = new Date();
              const dayOfWeek = (nowD.getDay() + 6) % 7; // Monday = 0
              const mondayD = new Date(nowD);
              mondayD.setDate(nowD.getDate() - dayOfWeek);
              const sundayD = new Date(mondayD);
              sundayD.setDate(mondayD.getDate() + 6);
              const mStr = mondayD.toISOString().split('T')[0];
              const sStr = sundayD.toISOString().split('T')[0];
              if (b.work_date < mStr || b.work_date > sStr) return false;
            } else if (timesheetHorizon.value === 'month') {
              // Current calendar month YYYY-MM
              const ym = todayStr.substring(0, 7);
              if (!b.work_date.startsWith(ym)) return false;
            }
          }

          return true;
        });
      });

      const paginatedBlocks = computed(() => {
        return filteredWorkBlocks.value.slice(0, 25);
      });

      // Time ordering & block position helpers
      const _minsOf = (t) => { if (!t) return -1; const p = String(t).split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); };


      // Google Meet-Style Day Focus Block Groupings & PACI extracted to useWorkstationDashboard


      // Timeline Domain Store Integration
      const timelineStore = useWorkstationTimeline({
        todayDate,
        selectedDashboardDate,
        workFocusBlocks,
        isTracking,
        startTime,
        trackerBlockName,
        trackerNotes,
        selectedProject,
        selectedNature,
        nowMinute,
        getLocalTodayISO,
        todayISO,
        _minToHHMM,
        _minsOf,
        hourLabel: (h) => hourLabel(h)
      });

      const {
        timelineZoom,
        timelineZoomOptions,
        timelineTrackWidth,
        onTimelineZoomKey,
        timelineScroller,
        timelineCanScrollLeft,
        timelineCanScrollRight,
        syncTimelineEdges,
        nudgeTimeline,
        dayTimeline,
        scrollTimelineToWork,
        blockLogState,
        blockLogPct
      } = timelineStore;

      // Multi-Device Active Session Synchronization & Remote HUD Actions
      let _syncDebounceTimer = null;
      let _lastLocalUpdate = Date.now();
      const lastActivityTime = ref(Date.now());
      const lastInactivityAlertTime = ref(0);
      const showInactivityModal = ref(false);

      // Phase 4: Instant Cross-Tab Broadcast Channel Sync
      let _omnitrackChannel = null;
      if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        try {
          _omnitrackChannel = new BroadcastChannel('omnitrack_workstation_channel');
          _omnitrackChannel.onmessage = (event) => {
            const data = event.data;
            if (!data || !data.type) return;
            if (data.type === 'session_sync' && data.payload) {
              if (!_isStoppingSession) {
                restoreActiveSession(data.payload);
              }
            } else if (data.type === 'session_cleared') {
              if (isTracking.value) {
                isTracking.value = false;
                if (trackerTimer.value) clearInterval(trackerTimer.value);
                trackerTimer.value = null;
                trackerSeconds.value = 0;
              }
            }
          };
        } catch (e) {}
      }

      const recordUserActivity = () => {
        lastActivityTime.value = Date.now();
        if (showInactivityModal.value) {
          showInactivityModal.value = false;
        }
      };

      // Distinct Web Audio Synthesizer Engine
      const playUpcoming10mChime = () => {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          // Gentle rising bell: F#5 (739.99 Hz) -> A#5 (932.33 Hz)
          osc.frequency.setValueAtTime(739.99, ctx.currentTime);
          osc.frequency.setValueAtTime(932.33, ctx.currentTime + 0.16);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
        } catch (e) {}
      };

      const playStartOnTimeChime = () => {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          // Action Focus Triad: C5 (523.25) -> E5 (659.25) -> G5 (783.99)
          const notes = [523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t = ctx.currentTime + idx * 0.12;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.20, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.35);
          });
        } catch (e) {}
      };

      const playOverrunChime = () => {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          // Descending warning gong: G5 (783.99) -> Eb5 (622.25) -> C5 (523.25)
          const notes = [783.99, 622.25, 523.25];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const t = ctx.currentTime + idx * 0.15;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
          });
        } catch (e) {}
      };

      const playInactivityChime = () => {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          // Classic warm ping: D5 (587.33) -> A5 (880.0)
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } catch (e) {}
      };

      const notificationPermission = ref(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
      );
      const showNotificationBanner = ref(true);

      const enableNotificationsUserGesture = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          showToast('Notifications are not supported in this browser.', 'warning');
          return;
        }
        try {
          const perm = await Notification.requestPermission();
          notificationPermission.value = perm;
          if (perm === 'granted') {
            showNotificationBanner.value = false;
            showToast('Mobile notifications enabled! You will receive timesheet alerts.', 'success');
            playStartOnTimeChime();
            if ('serviceWorker' in navigator) {
              try {
                const reg = await navigator.serviceWorker.register('/assets/omnitrack/sw.js');
                if (reg && reg.showNotification) {
                  await reg.showNotification('OmniTrack Notifications Enabled', {
                    body: 'Timesheet reminders and planned block alerts are now active.',
                    icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
                    badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
                    tag: 'omnitrack-test',
                    vibrate: [150, 100, 250]
                  });
                }
                if ('pushManager' in reg) {
                  try {
                    let sub = await reg.pushManager.getSubscription();
                    // If no existing subscription, subscribe now with applicationServerKey if available
                    if (!sub) {
                      try {
                        sub = await reg.pushManager.subscribe({
                          userVisibleOnly: true
                        });
                      } catch (subKeyErr) {
                        console.debug('Standard push subscription attempt:', subKeyErr);
                      }
                    }
                    if (sub) {
                      const subJson = sub.toJSON();
                      await postJSON('register_push_subscription', {
                        endpoint: sub.endpoint,
                        p256dh: subJson.keys ? subJson.keys.p256dh : null,
                        auth: subJson.keys ? subJson.keys.auth : null,
                        device_type: (navigator.userAgent || '').slice(0, 140)
                      });
                    }
                  } catch (subErr) {
                    console.debug('Push registration sync note:', subErr);
                  }
                }
              } catch (e) {}
            }
          } else if (perm === 'denied') {
            showToast('Notifications are blocked in browser settings. Please enable them to receive timesheet alerts.', 'warning');
          }
        } catch (err) {
          showToast('Could not enable notifications: ' + (err && err.message || err), 'danger');
        }
      };

      const dispatchInactivityNotification = async (msg, tag = 'omnitrack-inactivity') => {
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
        } catch (e) {}

        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission === 'granted') {
          const title = 'OmniTrack: Are you still working?';
          const options = {
            body: msg || 'No activity logged for 30 minutes on active timesheet.',
            icon: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
            badge: '/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg',
            tag: tag,
            renotify: true,
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200],
            data: { url: '/omnitrack' }
          };

          // 1. Mobile ServiceWorker showNotification (iOS Safari PWA & Android)
          if ('serviceWorker' in navigator) {
            try {
              const reg = await navigator.serviceWorker.ready;
              if (reg && reg.showNotification) {
                await reg.showNotification(title, options);
                return;
              }
            } catch (swErr) {}
            try {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  title: title,
                  options: options
                });
                return;
              }
            } catch (swMsgErr) {}
          }

          // 2. Desktop Notification constructor fallback
          try {
            const notif = new Notification(title, options);
            notif.onclick = () => {
              try {
                window.focus();
                confirmStillWorking();
              } catch (e) {}
            };
          } catch (e) {}
        } else if (Notification.permission === 'default') {
          try {
            const p = await Notification.requestPermission();
            notificationPermission.value = p;
          } catch (e) {}
        }
      };

      const lastOverrunAlertTime = ref(0);
      const checkBlockOverrun = () => {
        if (!isTracking.value || !trackerBoundBlock.value) return;
        const b = trackerBoundBlock.value;
        if (!b.end_time) return;
        const [eh, em] = b.end_time.split(':').map(Number);
        if (isNaN(eh) || isNaN(em)) return;

        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        const endMins = eh * 60 + em;

        if (curMins >= endMins) {
          const overdueMins = curMins - endMins;
          const nowMs = Date.now();
          const timeSinceAlert = nowMs - (lastOverrunAlertTime.value || 0);
          const REPEAT_MS = 30 * 60 * 1000;

          if (!lastOverrunAlertTime.value || timeSinceAlert >= REPEAT_MS) {
            lastOverrunAlertTime.value = nowMs;
            playInactivityChime();
            const blockTitle = b.work_item_label || b.task_subject || b.name;
            const endHHMM = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
            const msg = overdueMins > 0
              ? `Planned block "${blockTitle}" ended at ${endHHMM} (${overdueMins}m overdue). Wrap up or continue?`
              : `Planned block "${blockTitle}" ended at ${endHHMM}. Wrap up or continue?`;

            dispatchInactivityNotification(msg, 'omnitrack-block-overrun');
          }
        }
      };

      const isProductionEnv = computed(() => {
        if (typeof window === 'undefined') return true;
        const host = (window.location.hostname || '').toLowerCase();
        return host.includes('ommnomi.in') || host.includes('frappecloud.com');
      });

      const isBlockOverrun = computed(() => {
        const _ = trackerSeconds.value;
        if (!isTracking.value || !trackerBoundBlock.value) return false;
        const b = trackerBoundBlock.value;
        if (!b.end_time) return false;
        const [eh, em] = b.end_time.split(':').map(Number);
        if (isNaN(eh) || isNaN(em)) return false;
        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        const endMins = eh * 60 + em;
        return curMins > endMins;
      });

      const overrunMinutes = computed(() => {
        const _ = trackerSeconds.value;
        if (!isBlockOverrun.value || !trackerBoundBlock.value) return 0;
        const [eh, em] = trackerBoundBlock.value.end_time.split(':').map(Number);
        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        return Math.max(0, curMins - (eh * 60 + em));
      });

      const earlyStartMinutes = computed(() => {
        const _ = trackerSeconds.value;
        if (!isTracking.value || !trackerBoundBlock.value || !startTime.value) return 0;
        const b = trackerBoundBlock.value;
        if (!b.start_time) return 0;
        const [sh, sm] = b.start_time.split(':').map(Number);
        if (isNaN(sh) || isNaN(sm)) return 0;
        const sDate = new Date(Number(startTime.value));
        const startMins = sDate.getHours() * 60 + sDate.getMinutes();
        const plannedMins = sh * 60 + sm;
        return startMins < plannedMins ? (plannedMins - startMins) : 0;
      });

      const quickExtendActiveBlock = async (mins) => {
        triggerHaptic([30]);
        try {
          const res = await postJSON('extend_active_block_duration', { extend_minutes: mins });
          if (res && res.status === 'success') {
            showToast(`Extended planned block by +${mins}m`, 'success');
            await loadWorkstationData(false);
          } else {
            showToast('Could not extend block: ' + (res.status || 'unknown'), 'warning');
          }
        } catch (e) {
          showToast('Failed to extend block: ' + (e.message || e), 'error');
        }
      };

      const startUnplannedEscalation = () => {
        triggerHaptic([40]);
        selectedNature.value = '⚠️ Unplanned';
        trackerNature.value = '⚠️ Unplanned';
        trackerBlockName.value = null;
        trackerNotes.value = 'Urgent Escalation / Ad-hoc Session';
        sessionNotesList.value = [];
        toggleTrack();
        showToast('Started ⚠️ Unplanned focus session (Logged lane only)', 'warning');
      };

      const inactivityMinutes = computed(() => {
        const _ = trackerSeconds.value;
        const act = Math.max(lastActivityTime.value || 0, _lastLocalUpdate || 0) || Date.now();
        const ms = Date.now() - act;
        return Math.max(1, Math.floor(ms / 60000));
      });

      const lastActivityTimeHHMM = computed(() => {
        const _ = trackerSeconds.value;
        const act = Math.max(lastActivityTime.value || 0, _lastLocalUpdate || 0) || Date.now();
        const t = new Date(act);
        const pad = (n) => String(n).padStart(2, '0');
        return pad(t.getHours()) + ':' + pad(t.getMinutes());
      });

      const suggestedStopHHMM = computed(() => {
        const _ = trackerSeconds.value;
        const base = Math.max(lastActivityTime.value || 0, _lastLocalUpdate || 0) || Date.now();
        const targetMs = Math.min(Date.now(), base + 15 * 60 * 1000);
        const t = new Date(targetMs);
        const pad = (n) => String(n).padStart(2, '0');
        return pad(t.getHours()) + ':' + pad(t.getMinutes());
      });

      const checkInactivity = () => {
        if (!isTracking.value) return;
        const now = Date.now();
        const act = Math.max(lastActivityTime.value || 0, _lastLocalUpdate || 0) || now;
        const idleMs = now - act;
        const INACTIVITY_MS = 30 * 60 * 1000;
        const REPEAT_MS = 30 * 60 * 1000;

        if (idleMs >= INACTIVITY_MS) {
          const timeSinceAlert = now - (lastInactivityAlertTime.value || 0);
          if (!lastInactivityAlertTime.value || timeSinceAlert >= REPEAT_MS) {
            lastInactivityAlertTime.value = now;
            showInactivityModal.value = true;
            playInactivityChime();
            dispatchInactivityNotification(`No notes logged for ${Math.floor(idleMs / 60000)}m on "${trackerNotes.value || 'Active Work'}". Are you still working?`);
          }
        }
      };

      const confirmStillWorking = () => {
        recordUserActivity();
        lastInactivityAlertTime.value = 0;
        showInactivityModal.value = false;
        isSessionElevated.value = true;
        syncActiveSession(true);
        nextTick(() => {
          focusSessionPointInput();
        });
        showToast('Timesheet active — add your recent activity!', 'success');
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(p => { notificationPermission.value = p; }).catch(() => {});
        }
      };

      const stopInactivitySessionNow = () => {
        showInactivityModal.value = false;
        toggleTrack();
      };

      const stopInactivitySessionAtLastEditPlus15 = async () => {
        showInactivityModal.value = false;
        const base = lastActivityTime.value || Date.now();
        const cappedEndMs = Math.min(Date.now(), base + 15 * 60 * 1000);
        await toggleTrack(cappedEndMs);
      };

      const discardInactivitySession = () => {
        if (typeof window !== 'undefined' && window.confirm && !window.confirm('Are you sure you want to discard this session? All untracked time will be thrown away.')) {
          return;
        }
        showInactivityModal.value = false;
        discardConfirm.value = true;
        discardSession();
        showToast('Abandoned timer discarded — no timesheet logged', 'info');
      };

      const syncActiveSession = (immediate = false) => {
        if (!isTracking.value) {
          markSessionEnded();
          localStorage.removeItem('omnitrack_active_session');
          if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
          postJSON('sync_active_session', { session_data: null }).catch(() => {});
          return;
        }

        if (_isStoppingSession) return;
        _lastLocalUpdate = Date.now();

        const curStart = Number(startTime.value) || (Date.now() - (trackerSeconds.value * 1000));
        const payload = {
          startTime: curStart,
          selectedNature: selectedNature.value,
          selectedProject: selectedProject.value,
          trackerNotes: trackerNotes.value,
          trackerBlockName: trackerBlockName.value,
          sessionNotesList: sessionNotesList.value,
          lastActivityTime: lastActivityTime.value || _lastLocalUpdate,
          lastUpdated: _lastLocalUpdate,
          status: 'active'
        };
        localStorage.setItem('omnitrack_active_session', JSON.stringify(payload));
        try {
          if (_omnitrackChannel) {
            _omnitrackChannel.postMessage({ type: 'session_sync', payload });
          }
        } catch (e) {}

        const sendToServer = () => {
          postJSON('sync_active_session', { session_data: payload }).catch(() => {});
        };

        if (immediate) {
          if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
          sendToServer();
        } else {
          if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
          _syncDebounceTimer = setTimeout(sendToServer, 500);
        }
      };

      let _isRestoring = false;
      const restoreActiveSession = (sessionData) => {
        // A payload written by an older build of this page carries no `status`. It is
        // still a live session — only an explicit non-active status means "don't restore",
        // otherwise a reload strands a clock that is genuinely still running.
        if (!sessionData || !sessionData.startTime) return false;
        if (sessionData.status && sessionData.status !== 'active') return false;
        // The stop guard belongs HERE, not in each caller. The dashboard refresh that
        // runs right after a stop used to restore the session straight back from a
        // server row that had not been cleared yet — so Stop looked like it did
        // nothing at all. Any path that restores must clear this bar.
        if (_isStoppingSession || (Date.now() - _lastLocalStop < 10000)) return false;

        // If local device previously recorded this session as ended, verify if server has a newer active update
        if (wasEndedHere(sessionData.startTime)) {
          const remoteHeartbeat = Number(sessionData.lastUpdated || sessionData.startTime || 0);
          if (sessionData.status === 'active' && remoteHeartbeat > _lastLocalStop) {
            unmarkSessionEnded(sessionData.startTime);
          } else {
            return false;
          }
        }

        const startMs = Number(sessionData.startTime);
        // Clock skew resilience: calculate elapsed using the most authoritative timestamp
        const serverHeartbeat = Number(sessionData.lastUpdated || sessionData.lastActivityTime || 0);
        const serverElapsed = (serverHeartbeat > startMs) ? Math.floor((serverHeartbeat - startMs) / 1000) : 0;
        const localElapsed = Math.floor((Date.now() - startMs) / 1000);
        // If local clock is behind or startMs is slightly ahead due to clock skew, anchor to at least serverElapsed
        const elapsed = Math.max(0, Math.max(serverElapsed, localElapsed));
        if (elapsed >= 86400) return false; // expired past 24h

        // Zombie timer eviction: if running for > 10 hours, evict immediately
        if (elapsed >= 10 * 3600) {
          markSessionEnded();
          localStorage.removeItem('omnitrack_active_session');
          postJSON('sync_active_session', { session_data: null }).catch(() => {});
          return false;
        }

        // Zombie timer eviction: if session started on a prior calendar day and has run >= 6 hours
        const sessionStartDate = new Date(startMs).toISOString().split('T')[0];
        const todayStr = getLocalTodayISO();
        if (sessionStartDate !== todayStr && elapsed >= 6 * 3600) {
          markSessionEnded();
          localStorage.removeItem('omnitrack_active_session');
          postJSON('sync_active_session', { session_data: null }).catch(() => {});
          return false;
        }

        // If bound to a work block, handle status reconciliation gracefully
        if (sessionData.trackerBlockName) {
          const matched = (workBlocks.value || []).find(b => b.name === sessionData.trackerBlockName) ||
                          (workFocusBlocks.value || []).find(b => b.name === sessionData.trackerBlockName);
          if (matched) {
            if (sessionData.status === 'active') {
              matched.status = 'In Progress';
            } else if (matched.status === 'Logged (Full)' || matched.status === 'Logged (Over)' || matched.status === 'Logged (Partial)' || matched.status === 'Completed' || matched.status === 'Cancelled' || matched.status === 'Missed') {
              markSessionEnded();
              localStorage.removeItem('omnitrack_active_session');
              return false;
            }
          }
        }

        _isRestoring = true;
        try {
          isTracking.value = true;
          startTime.value = startMs;
          trackerSeconds.value = elapsed;
          selectedNature.value = sessionData.selectedNature || '🎯 Planned';
          trackerNature.value = sessionData.selectedNature || '🎯 Planned';
          selectedProject.value = sessionData.selectedProject || '';
          trackerProject.value = sessionData.selectedProject || '';
          let rawN = sessionData.trackerNotes || '';
          if (rawN.includes('•') && (!sessionData.sessionNotesList || sessionData.sessionNotesList.length === 0)) {
            const parts = rawN.split('•').map(s => s.trim()).filter(Boolean);
            trackerNotes.value = parts[0] || '';
            sessionNotesList.value = parts.slice(1);
          } else {
            trackerNotes.value = rawN;
            sessionNotesList.value = Array.isArray(sessionData.sessionNotesList) ? sessionData.sessionNotesList : [];
          }
          trackerBlockName.value = sessionData.trackerBlockName || null;
          const sLastAct = Number(sessionData.lastActivityTime) || 0;
          const sLastUpd = Number(sessionData.lastUpdated) || 0;
          lastActivityTime.value = Math.max(sLastAct, sLastUpd) || Date.now();

          const clockSkewMs = (startMs > Date.now()) ? (startMs - Date.now()) : 0;
          if (trackerTimer.value) clearInterval(trackerTimer.value);
          trackerTimer.value = setInterval(() => {
            const curLocalElapsed = Math.floor((Date.now() + clockSkewMs - startMs) / 1000);
            trackerSeconds.value = Math.max(0, curLocalElapsed);
            checkInactivity();
            checkBlockOverrun();
          }, 1000);

          localStorage.setItem('omnitrack_active_session',
            JSON.stringify(Object.assign({}, sessionData, { status: 'active' })));
          return true;
        } finally {
          nextTick(() => { _isRestoring = false; });
        }
      };

      watch([trackerNotes, sessionNotesList], () => {
        if (isTracking.value && !_isRestoring) {
          recordUserActivity();
        }
      }, { deep: true });

      // Cross-device live session synchronization
      let _livePollTimer = null;
      let _isCheckingActiveSession = false;
      let _lastLocalStop = 0;
      let _isStoppingSession = false;

      // A stop is not instantaneous: the local HUD tears down immediately, but the
      // server write that clears the active session lands a moment later. Any poll
      // or socket push in that window still reports the old session as active, and
      // the sync faithfully puts it back on screen — again and again, with no way
      // to close it or start a new one. Remember which sessions this device just
      // ended and refuse to resurrect exactly those. A genuinely new session
      // started elsewhere carries a different startTime and still syncs.
      // Kept in localStorage as well as memory: a session stopped in this tab must
      // stay stopped in every other tab of this browser, and across a reload. Memory
      // alone only protects the tab that pressed the button.
      const _ENDED_KEY = 'omnitrack_ended_sessions';
      const _endedSessions = new Set();
      const _readEndedStore = () => {
        try {
          const raw = JSON.parse(localStorage.getItem(_ENDED_KEY) || '[]');
          return Array.isArray(raw) ? raw.filter(e => e && Date.now() - Number(e.at || 0) < 21600000) : [];
        } catch (e) { return []; }
      };
      const markSessionEnded = (sTime) => {
        const add = [];
        try {
          if (sTime) add.push(Math.round(Number(sTime)));
          const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
          if (p && p.startTime) add.push(Math.round(Number(p.startTime)));
        } catch (e) {}
        add.forEach(t => _endedSessions.add(t));
        try {
          const store = _readEndedStore();
          add.forEach(t => { if (!store.some(e => Math.abs(Number(e.start) - t) < 5000)) store.push({ start: t, at: Date.now() }); });
          localStorage.setItem(_ENDED_KEY, JSON.stringify(store.slice(-40)));
        } catch (e) {}
      };
      const wasEndedHere = (startTime) => {
        const t = Math.round(Number(startTime));
        if (!t) return false;
        for (const ended of _endedSessions) if (Math.abs(ended - t) < 5000) return true;
        return _readEndedStore().some(e => Math.abs(Number(e.start) - t) < 5000);
      };
      const unmarkSessionEnded = (sTime) => {
        if (!sTime) return;
        const t = Math.round(Number(sTime));
        for (const ended of Array.from(_endedSessions)) {
          if (Math.abs(ended - t) < 5000) _endedSessions.delete(ended);
        }
        try {
          const store = _readEndedStore().filter(e => Math.abs(Number(e.start) - t) >= 5000);
          localStorage.setItem(_ENDED_KEY, JSON.stringify(store));
        } catch (e) {}
      };

      const reconcileActiveSession = (remote) => {
        // Never resurrect a session if this device just stopped or discarded within the last 10s
        if (_isStoppingSession || (Date.now() - _lastLocalStop < 10000)) {
          handleRemoteSessionCleared({ silent: true });
          return;
        }
        // If this device previously recorded this session as ended, verify if server has a newer active update
        if (remote && remote.startTime && wasEndedHere(remote.startTime) && !isTracking.value) {
          const remoteHeartbeat = Number(remote.lastUpdated || remote.startTime || 0);
          if (remote.status === 'active' && remoteHeartbeat > _lastLocalStop) {
            unmarkSessionEnded(remote.startTime);
          } else {
            handleRemoteSessionCleared({ silent: true });
            return;
          }
        }
        if (!remote || remote.status !== 'active') {
          if (!isTracking.value || Date.now() - _lastLocalUpdate >= 15000) {
            handleRemoteSessionCleared();
          }
          return;
        }

        // If this device wasn't tracking, start tracking and restore
        if (!isTracking.value) {
          restoreActiveSession(remote);
          showToast('Live session synced from mobile', 'info');
          return;
        }

        // If remote has a different block or new session start time, switch to remote session!
        if (remote.startTime && (remote.trackerBlockName !== trackerBlockName.value || Math.abs(Number(remote.startTime) - (Number(startTime.value) || 0)) > 60000)) {
          restoreActiveSession(remote);
          showToast('Switched to active session from cloud', 'info');
          return;
        }

        // If local had an edit within the last 1200ms, let local write settle
        if (Date.now() - _lastLocalUpdate < 1200) return;

        // 1. Reconcile session lines logged from phone
        const remoteLines = Array.isArray(remote.sessionNotesList) ? remote.sessionNotesList : [];
        const localLines = sessionNotesList.value || [];
        if (JSON.stringify(remoteLines) !== JSON.stringify(localLines)) {
          sessionNotesList.value = [...remoteLines];
          nextTick(() => {
            if (sessionNotesScroll.value) {
              sessionNotesScroll.value.scrollTop = sessionNotesScroll.value.scrollHeight;
            }
          });
        }

        // 2. Reconcile deliverable title (avoid clobbering if actively typing)
        if (remote.trackerNotes !== undefined && remote.trackerNotes !== trackerNotes.value) {
          const activeEl = document.activeElement;
          const isNotesFocused = activeEl && (
            activeEl.getAttribute('aria-label') === 'Deliverable or task title' ||
            (activeEl.tagName === 'INPUT' && activeEl.placeholder && activeEl.placeholder.includes('Deliverable'))
          );
          if (!isNotesFocused) {
            trackerNotes.value = remote.trackerNotes || '';
          }
        }

        // 3. Reconcile project and nature
        if (remote.selectedProject !== undefined && remote.selectedProject !== selectedProject.value) {
          selectedProject.value = remote.selectedProject || '';
          trackerProject.value = remote.selectedProject || '';
        }
        if (remote.selectedNature !== undefined && remote.selectedNature !== selectedNature.value) {
          selectedNature.value = remote.selectedNature || '🎯 Planned';
          trackerNature.value = remote.selectedNature || '🎯 Planned';
        }

        // 4. Reconcile bound work block
        if (remote.trackerBlockName !== undefined && remote.trackerBlockName !== trackerBlockName.value) {
          trackerBlockName.value = remote.trackerBlockName || null;
        }

        localStorage.setItem('omnitrack_active_session', JSON.stringify(Object.assign({}, remote, { status: 'active' })));
      };

      // The "ended elsewhere" toast is news the first time and noise on every
      // poll after it. A guard-triggered teardown (this device just stopped, or
      // already ended this session) is not news at all, so it passes silent.
      let _lastClearedToast = 0;
      const handleRemoteSessionCleared = (opts) => {
        if (!isTracking.value) return;
        // Never clear an active session if this device updated or started within the last 15s
        if (Date.now() - _lastLocalUpdate < 15000) return;

        isTracking.value = false;
        startTime.value = null;
        if (trackerTimer.value) {
          clearInterval(trackerTimer.value);
          trackerTimer.value = null;
        }
        trackerSeconds.value = 0;
        sessionNotesList.value = [];
        trackerNotes.value = '';
        trackerBlockName.value = null;
        markSessionEnded();
        localStorage.removeItem('omnitrack_active_session');
        if (!(opts && opts.silent)) {
          fetchWorkstationData(selectedEmployee.value);
        }
        if (typeof fetchPlannerData === 'function' && activeTab.value === 'planner') {
          fetchPlannerData();
        }
        if (!(opts && opts.silent) && Date.now() - _lastClearedToast > 30000) {
          _lastClearedToast = Date.now();
          showToast('Timesheet session saved on other device', 'info');
        }
      };

      const checkRemoteActiveSession = async () => {
        if (document.visibilityState === 'hidden') return;
        if (_isCheckingActiveSession) return;
        if (_isStoppingSession || (Date.now() - _lastLocalStop < 10000)) return;
        _isCheckingActiveSession = true;
        try {
          const res = await fetch(`/api/method/omnitrack.api.get_active_session?_=${Date.now()}`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
          });
          if (res.ok) {
            const data = await res.json();
            const active = data.message;
            if (active && active.status === 'active') {
              reconcileActiveSession(active);
            } else if (!active && isTracking.value) {
              if (Date.now() - _lastLocalUpdate < 15000) {
                syncActiveSession(true);
              } else {
                handleRemoteSessionCleared({ silent: true });
              }
            }
          }
        } catch (e) {
        } finally {
          _isCheckingActiveSession = false;
        }
      };

      // A timesheet line is often a paragraph, not a phrase: the field grows with the
      // text, Shift+Enter breaks a line, and plain Enter still files the entry.
      const growSessionPoint = () => {
        const el = sessionPointInput.value;
        if (!el || !el.style) return;
        // An empty textarea reports a scrollHeight of two rows, so let CSS own the
        // resting size and only measure once there is something to measure.
        el.style.height = '';
        if (!el.value) return;
        void el.offsetHeight;                 // force the reflow before measuring
        el.style.height = el.scrollHeight + 'px';
      };
      const onSessionPointEnter = (ev) => {
        if (ev.shiftKey || ev.isComposing) return;   // Shift+Enter writes a new line
        ev.preventDefault();
        addSessionPoint();
      };
      // Only leave the field for the log when there is nothing above the caret to
      // move through — otherwise Up is just normal cursor movement in the text.
      const onSessionPointUp = (ev) => {
        const el = ev.currentTarget;
        if (el && el.selectionStart > 0) return;
        ev.preventDefault();
        focusLogRow(sessionNotesList.value.length - 1);
      };

      const addSessionPoint = () => {
        const pt = (newSessionPoint.value || '').trim();
        if (!pt) return;
        sessionNotesList.value.push(pt);
        newSessionPoint.value = '';
        recordUserActivity();
        nextTick(() => { const el = sessionPointInput.value; if (el && el.style) el.style.height = ''; });
        // newest sits at the bottom of the list — keep it in view
        nextTick(() => { if (sessionNotesScroll.value) sessionNotesScroll.value.scrollTop = sessionNotesScroll.value.scrollHeight; });
        syncActiveSession(true);
        triggerHaptic([25]);
      };

      // Chronological order: #1 is the first line of the session and the newest
      // sits last, right above the input. row.i is the real array index.
      const sessionNotesRows = computed(() =>
        (sessionNotesList.value || []).map((t, i) => ({ i: i, t: t, n: i + 1 }))
      );
      // --- custom dropdowns (native browser popups can't be styled) ---
      const _explicitBoundBlock = ref(null);
      const trackerBoundBlock = computed(() => {
        const nm = trackerBlockName.value;
        if (!nm) return null;
        if (_explicitBoundBlock.value && _explicitBoundBlock.value.name === nm) {
          return _explicitBoundBlock.value;
        }
        return (workBlocks.value || []).find((b) => b.name === nm) || null;
      });
      const showAppMenu = ref(false);
      const openDropdown = ref('');
      const dropdownIdx = ref(-1);
      const projectItems = computed(() => {
        const list = [{ value: '', label: 'General Work (Internal)' }];
        (projects.value || []).forEach((pr) => list.push({ value: pr.name, label: pr.project_name || pr.name }));
        return list;
      });
      // "Viewing" switcher shares the generic custom-listbox plumbing below.
      const employeeItems = computed(() => {
        const list = [{ value: currentUserFullName.value, label: '👤 ' + currentUserFullName.value + ' (You)' }];
        if (isManager.value) {
          list.push({ value: 'All', label: '🌐 All Members' });
          (filteredTeamMembers.value || []).forEach((m) => {
            const nm = m.full_name || m.name;
            list.push({ value: nm, label: '👤 ' + nm });
          });
        }
        return list;
      });
      const headerMenuItems = computed(() => {
        return [
          {
            label: '➕ New Task',
            action: 'new_task',
            onClick: () => openNewTaskModal()
          },
          {
            label: '📝 Session Timesheet',
            action: 'session_timesheet',
            onClick: () => openSessionCard()
          },
          {
            label: isDarkMode.value ? '☀️ Light Mode' : '🌙 Dark Mode',
            action: 'toggle_theme',
            onClick: () => toggleTheme()
          },
          {
            label: notificationPermission.value === 'granted' ? '🔔 Alerts Active' : (notificationPermission.value === 'denied' ? '🔕 Alerts Blocked (Browser Settings)' : '🔔 Enable Mobile Alerts'),
            action: 'toggle_notifications',
            onClick: () => enableNotificationsUserGesture()
          }
        ];
      });
      const employeeMenuItems = computed(() => {
        const emps = employeeItems.value || [];
        return emps.map((emp) => ({
          label: emp.label,
          badge: emp.value === selectedEmployee.value ? '✓' : '',
          action: 'emp_' + emp.value,
          onClick: () => {
            if (selectedEmployee.value !== emp.value) {
              selectedEmployee.value = emp.value;
              onEmployeeChange();
            }
          }
        }));
      });
      const natureItems = computed(() =>
        (natureOptions || []).map((o) => ({ value: o.label, label: o.label, nonWorking: !o.is_working }))
      );
      const dropdownItems = (id) =>
        (id === 'project' ? projectItems.value : (id === 'employee' ? employeeItems.value : natureItems.value));
      const dropdownCurrent = (id) =>
        (id === 'project' ? selectedProject.value : (id === 'employee' ? selectedEmployee.value : selectedNature.value));
      const dropdownLabel = (id) => {
        const hit = dropdownItems(id).find((o) => o.value === dropdownCurrent(id));
        if (hit) return hit.label;
        if (id === 'project') return 'General Work (Internal)';
        if (id === 'employee') return selectedEmployee.value || 'Viewing';
        return 'Select activity…';
      };
      const closeDropdown = () => { openDropdown.value = ''; dropdownIdx.value = -1; };
      const toggleDropdown = (id) => {
        if (openDropdown.value === id) { closeDropdown(); return; }
        openDropdown.value = id;
        dropdownIdx.value = Math.max(0, dropdownItems(id).findIndex((o) => o.value === dropdownCurrent(id)));
      };
      const pickDropdown = (id, opt) => {
        if (id === 'employee') {
          closeDropdown();
          if (opt.value === selectedEmployee.value) return;
          selectedEmployee.value = opt.value;
          onEmployeeChange();
          return;
        }
        if (id === 'project') selectedProject.value = opt.value; else selectedNature.value = opt.value;
        closeDropdown();
        syncActiveSession();
      };
      const onDropdownKey = (ev, id) => {
        const items = dropdownItems(id);
        const k = ev.key;
        if (k === 'Escape') { if (openDropdown.value === id) { ev.stopPropagation(); closeDropdown(); } return; }
        if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
          ev.preventDefault();
          if (openDropdown.value !== id) { toggleDropdown(id); return; }
          const opt = items[dropdownIdx.value];
          if (opt) pickDropdown(id, opt);
          return;
        }
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') {
          ev.preventDefault();
          if (openDropdown.value !== id) { toggleDropdown(id); return; }
          const last = items.length - 1;
          if (k === 'Home') dropdownIdx.value = 0;
          else if (k === 'End') dropdownIdx.value = last;
          else if (k === 'ArrowDown') dropdownIdx.value = dropdownIdx.value >= last ? 0 : dropdownIdx.value + 1;
          else dropdownIdx.value = dropdownIdx.value <= 0 ? last : dropdownIdx.value - 1;
        }
      };
      const _appMenuOutside = (ev) => {
        if (!showAppMenu.value) return;
        if (!ev.target.closest || !ev.target.closest('[data-appmenu]')) showAppMenu.value = false;
      };
      const _dropdownOutside = (ev) => {
        if (openDropdown.value) {
          if (!ev.target.closest || !ev.target.closest('[data-dropdown]')) closeDropdown();
        }
        if (todoDropdownOpen.value) {
          if (!ev.target.closest || !ev.target.closest('[data-todo-picker-container]')) {
            todoDropdownOpen.value = false;
          }
        }
        if (activeWorkflowMenuTask.value) {
          if (!ev.target.closest || !ev.target.closest('[data-taskmenu]')) {
            activeWorkflowMenuTask.value = null;
          }
        }
      };

      const isSessionElevated = ref(false);
      // A modal that leaves the page scrolling behind it is not modal. Lock the
      // body, remember where focus came from, keep Tab inside the dialog, and
      // hand focus back on close — WCAG 2.1 2.4.3 / 2.1.2, not decoration.
      let _sessionPopupReturnFocus = null;
      const trapSessionPopupTab = (ev) => {
        if (!isSessionElevated.value) return;
        const root = sessionCardRef.value;
        if (!root) return;
        const items = [...root.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first.focus();
        }
      };
      watch(isSessionElevated, (open) => {
        if (open) {
          _sessionPopupReturnFocus = document.activeElement;
          document.documentElement.style.overflow = 'hidden';
          document.body.style.overflow = 'hidden';
          nextTick(() => {
            const root = sessionCardRef.value;
            const target = root && root.querySelector('textarea, button');
            if (target) target.focus();
          });
        } else {
          document.documentElement.style.overflow = '';
          document.body.style.overflow = '';
          document.documentElement.style.removeProperty('overflow');
          document.body.style.removeProperty('overflow');
          if (_sessionPopupReturnFocus && _sessionPopupReturnFocus.focus) {
            _sessionPopupReturnFocus.focus();
          }
          _sessionPopupReturnFocus = null;
        }
      });

      const sessionPointInput = ref(null);
      const sessionNotesScroll = ref(null);
      const focusSessionPointInput = () => {
        try {
          window.dispatchEvent(new CustomEvent('omnitrack:focus-session-input'));
        } catch (_) {}
        nextTick(() => {
          const vueBoxInput = document.querySelector('#omnitrack-session-box-root [data-session-input]') ||
                             document.querySelector('#omnitrack-session-box-root textarea');
          if (vueBoxInput && vueBoxInput.focus) {
            vueBoxInput.focus();
            if (vueBoxInput.select) vueBoxInput.select();
            return;
          }
          const el = sessionPointInput.value;
          if (el && el.focus) { el.focus(); el.select && el.select(); }
        });
      };
      const _logRows = () => {
        const box = sessionNotesScroll.value;
        return box ? Array.from(box.querySelectorAll('[data-log-row]')) : [];
      };
      const activeSessionRowIndex = ref(0);
      const focusLogRow = (idx) => {
        const rows = _logRows();
        if (!rows.length) return;
        const targetIdx = Math.max(0, Math.min(rows.length - 1, idx));
        activeSessionRowIndex.value = targetIdx;
        const el = rows[targetIdx];
        if (el) el.focus();
      };
      const focusLogRowDeleteBtn = (idx) => {
        const rows = _logRows();
        if (!rows.length) return;
        const targetIdx = Math.max(0, Math.min(rows.length - 1, idx));
        const el = rows[targetIdx];
        if (el) {
          const btn = el.querySelector('[data-remove-line-btn]');
          if (btn) btn.focus();
        }
      };
      // ↑/↓ walk the log, → moves to delete button, Enter or Delete removes the focused line, Esc goes back to typing.
      const onLogRowKey = (ev, row) => {
        const rows = _logRows();
        const at = rows.indexOf(ev.currentTarget);
        if (ev.key === 'ArrowUp') { ev.preventDefault(); if (at > 0) focusLogRow(at - 1); return; }
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          if (at < rows.length - 1) focusLogRow(at + 1); else focusSessionPointInput();
          return;
        }
        if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          focusLogRowDeleteBtn(at >= 0 ? at : row.i);
          return;
        }
        if (ev.key === 'Escape') { ev.preventDefault(); focusSessionPointInput(); return; }
        if (ev.key === 'Enter' || ev.key === 'Delete' || ev.key === 'Backspace') {
          ev.preventDefault();
          removeSessionPoint(row.i);
          nextTick(() => {
            const left = _logRows();
            if (!left.length) focusSessionPointInput();
            else focusLogRow(Math.min(at, left.length - 1));
          });
        }
      };
      const onRemoveBtnKey = (ev, row) => {
        const rows = _logRows();
        const at = rows.findIndex(r => r.contains(ev.currentTarget));
        if (ev.key === 'ArrowLeft' || ev.key === 'Escape') {
          ev.preventDefault();
          focusLogRow(at >= 0 ? at : row.i);
          return;
        }
        if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          if (at > 0) focusLogRow(at - 1);
          return;
        }
        if (ev.key === 'ArrowDown') {
          ev.preventDefault();
          if (at < rows.length - 1) focusLogRow(at + 1); else focusSessionPointInput();
          return;
        }
        if (ev.key === 'Enter' || ev.key === 'Delete' || ev.key === 'Backspace') {
          ev.preventDefault();
          removeSessionPoint(row.i);
          nextTick(() => {
            const left = _logRows();
            if (!left.length) focusSessionPointInput();
            else focusLogRow(Math.min(at >= 0 ? at : 0, left.length - 1));
          });
        }
      };

      const sessionCardRef = ref(null);
      const sessionCardFlash = ref(false);

      // The header timer and Shift+S elevates to the session timesheet in full focus
      const openSessionCard = () => {
        showTrackerPopup.value = false;
        // Idle: there is no HUD to jump to, so this gesture opens an unplanned
        // session. Planned work should be started from its block instead.
        if (!isTracking.value) {
          _explicitBoundBlock.value = null;
          trackerBlockName.value = null;
          toggleTrack();
        }
        isSessionElevated.value = true;
        nextTick(() => {
          sessionCardFlash.value = true;
          setTimeout(() => { sessionCardFlash.value = false; }, 1600);
          focusSessionPointInput();
        });
      };

      const toggleSessionFocus = () => {
        if (!isTracking.value) {
          _explicitBoundBlock.value = null;
          trackerBlockName.value = null;
          toggleTrack();
          isSessionElevated.value = true;
          focusSessionPointInput();
          return;
        }
        isSessionElevated.value = !isSessionElevated.value;
        if (isSessionElevated.value) focusSessionPointInput();
      };
      // Shift+D: jump to the day view and land on the selected day, so the arrow keys
      // pick a day and Tab reaches that day's Start Session button straight away.
      const openDayView = () => {
        activeTab.value = 'dashboard';
        nextTick(() => {
          // land just under the sticky header, not centred half off-screen
          const sect = document.querySelector('[data-day-section]') || document.querySelector('[data-day-strip]');
          if (sect) {
            const header = document.querySelector('header.sticky');
            const offset = (header ? header.getBoundingClientRect().height : 0) + 16;
            const y = sect.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
          }
          const day = document.querySelector('[data-day-strip] [data-day-btn][aria-checked="true"]');
          if (day) day.focus({ preventScroll: true });
        });
      };

      // Global shortcuts. Shift+T new task · Shift+P plan a block · Shift+D the day view ·
      // Shift+S jump to the
      // session-log input (then Tab reaches Stop & Save) · Cmd/Ctrl+S stops and saves ·
      // "/" also jumps to the add-line input.
      const _typingIn = (t) => {
        const tag = t && t.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.isContentEditable);
      };
      const planBlockShortcut = () => {
        activeTab.value = 'planner';
        const iso = todayDate.value || todayISO();
        const hour = Math.min(22, new Date().getHours());
        nextTick(() => { openBookModal(iso, hour); });
      };
      // Shortcuts are worthless if nobody is told they exist — show the real modifier
      // for the platform rather than a generic "Ctrl".
      const isMacLike = (typeof navigator !== 'undefined') &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
      const modKey = isMacLike ? '\u2318' : 'Ctrl';

      const _slashFocus = (ev) => {
        // Esc minimizes elevated session popup
        if (ev.key === 'Escape' && isSessionElevated.value) {
          ev.preventDefault();
          isSessionElevated.value = false;
          return;
        }
        // Cmd/Ctrl+S stops the session instead of saving the browser page.
        if ((ev.metaKey || ev.ctrlKey) && String(ev.key || '').toLowerCase() === 's') {
          ev.preventDefault();
          if (isTracking.value) toggleTrack();
          else showToast('No session is running', 'info');
          return;
        }
        // Cmd/Ctrl+D discards. Destructive, but discardSession already asks once and
        // only throws the session away on the second press, so the key is safe.
        if ((ev.metaKey || ev.ctrlKey) && String(ev.key || '').toLowerCase() === 'd') {
          ev.preventDefault();
          if (isTracking.value) discardSession();
          else showToast('No session is running', 'info');
          return;
        }
        // Cmd/Ctrl+E opens Adjust, to fix the start/end of the running clock.
        if ((ev.metaKey || ev.ctrlKey) && String(ev.key || '').toLowerCase() === 'e') {
          ev.preventDefault();
          if (isTracking.value) openAdjustModal();
          else showToast('No session is running', 'info');
          return;
        }
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
        if (ev.shiftKey && !_typingIn(ev.target)) {
          const k = String(ev.key || '').toLowerCase();
          if (k === 't') {
            ev.preventDefault();
            if (isTracking.value) {
              isSessionElevated.value = true;
              focusSessionPointInput();
            } else {
              openNewTaskModal();
            }
            return;
          }
          if (k === 'p') { ev.preventDefault(); planBlockShortcut(); return; }
          if (k === 's') { ev.preventDefault(); toggleSessionFocus(); return; }
          if (k === 'd') { ev.preventDefault(); openDayView(); return; }
        }
        if (ev.key !== '/') return;
        if (_typingIn(ev.target)) return;
        const hasSessionInput = isTracking.value || !!sessionPointInput.value ||
          !!document.querySelector('#omnitrack-session-box-root [data-session-input]') ||
          !!document.querySelector('#omnitrack-session-box-root textarea');
        if (!hasSessionInput) return;
        ev.preventDefault();
        if (isTracking.value && activeTab.value !== 'dashboard' && !isSessionElevated.value) {
          activeTab.value = 'dashboard';
        }
        focusSessionPointInput();
      };

      const removeSessionPoint = (idx) => {
        sessionNotesList.value.splice(idx, 1);
        recordUserActivity();
        syncActiveSession(true);
        triggerHaptic([20]);
      };

      const updateTrackerNotesFromPoints = () => {
        // Preserved for backwards-compatibility
      };

      // A timesheet with no lines is an hour with nothing attached to it. The
      // manager reading it cannot tell what was done, and when the hour reaches a
      // client's invoice it reads as time billed for no work. So this is a hard
      // rule, not a confirmation: no lines, no save.
      const sessionHasLines = computed(() =>
        (sessionNotesList.value || []).some(p => String(p || '').trim().length >= 3) ||
        String(trackerNotes.value || '').trim().length >= 3 ||
        !!trackerBlockName.value ||
        !!trackerBoundBlock.value
      );
      const showEmptyStopModal = ref(false);
      const emptyStopQuickNote = ref('');
      const emptyStopElapsedHrs = ref(0);

      const openEmptyStopModal = () => {
        const elapsedSecs = trackerSeconds.value;
        emptyStopElapsedHrs.value = Math.max(0.01, Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100);
        const defaultNote = String(trackerNotes.value || '').trim() ||
          (trackerBoundBlock.value ? (trackerBoundBlock.value.work_item_label || trackerBoundBlock.value.task_subject || trackerBoundBlock.value.name) : '') ||
          'Focus work session';
        emptyStopQuickNote.value = defaultNote;
        showEmptyStopModal.value = true;
      };

      const confirmEmptyStopDiscard = () => {
        showEmptyStopModal.value = false;
        discardConfirm.value = true;
        discardSession();
      };

      const confirmEmptyStopSave = () => {
        const note = String(emptyStopQuickNote.value || '').trim() || 'Focus work session';
        showEmptyStopModal.value = false;
        appendSessionLine(note);
        toggleTrack();
      };

      const refuseEmptySession = () => {
        openEmptyStopModal();
      };

      const stopConfirmName = ref('');
      const requestStopFocusBlock = (b) => {
        const running = isTracking.value && trackerBlockName.value === b.name;
        if (running && !sessionHasLines.value) { openEmptyStopModal(); return; }
        stopConfirmName.value = '';
        startFocusBlock(b);
      };

      const showStartTimeChoiceModal = ref(false);
      const pendingStartBlock = ref(null);
      const pendingStartTimeOptions = ref([]);

      const parseBlockStartEpoch = (b) => {
        if (!b || !b.start_time) return null;
        const todayStr = getLocalTodayISO() || todayDate.value || new Date().toISOString().split('T')[0];
        const blockDate = b.work_date || todayStr;
        if (blockDate !== todayStr) return null;
        const timeParts = String(b.start_time).split(':');
        if (timeParts.length < 2) return null;
        const d = new Date();
        d.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), parseInt(timeParts[2] || '0', 10), 0);
        return d.getTime();
      };

      const startFocusBlock = (b) => {
        if (!b) return;
        if (isTracking.value && trackerBlockName.value === b.name) {
          toggleTrack();
          return;
        }
        if (isTracking.value) {
          promptSwitchSession({
            id: b.name,
            name: b.name,
            label: b.task_subject || b.work_item_label || b.name,
            sublabel: `${b.start_time || ''} – ${b.end_time || ''} · ${b.project || 'General'}`,
            project: b.project,
            is_block: true,
            task_nature: b.task_nature,
            work_date: b.work_date,
            start_time: b.start_time,
            end_time: b.end_time,
          });
          return;
        }

        // Check if block scheduled start is in the past today
        const startEpoch = parseBlockStartEpoch(b);
        const now = Date.now();
        if (startEpoch && startEpoch < now) {
          const elapsedMinutes = Math.floor((now - startEpoch) / 60000);
          if (elapsedMinutes <= 2) {
            // Auto-anchor on time without prompting if <= 2 mins
            trackBlock(b, startEpoch);
            return;
          } else if (elapsedMinutes <= 120) {
            // Prompt user with 1-click suggested start times
            pendingStartBlock.value = b;
            const schedTimeStr = b.start_time ? String(b.start_time).substring(0, 5) : '';
            const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            pendingStartTimeOptions.value = [
              {
                label: `Start on time at ${schedTimeStr}`,
                sublabel: `${elapsedMinutes}m elapsed · Plan adherence protected`,
                epoch: startEpoch,
                isOntime: true
              },
              {
                label: `Start from now at ${nowTimeStr}`,
                sublabel: `Fresh start at 00:00:00`,
                epoch: now,
                isOntime: false
              }
            ];
            showStartTimeChoiceModal.value = true;
            return;
          }
        }

        trackBlock(b);
      };

      const selectStartTimeChoice = (epoch) => {
        showStartTimeChoiceModal.value = false;
        if (pendingStartBlock.value) {
          const blk = pendingStartBlock.value;
          pendingStartBlock.value = null;
          trackBlock(blk, epoch);
        }
      };

      // Timeline Schedule Tracks
      const timelineMembers = computed(() => {
        const members = [
          {
            name: 'Hardik Sharma',
            initials: 'HS',
            isYou: true,
            avatarBg: 'bg-indigo-600',
            hoursSummary: '7.5h (🏢 3.5h 🏠 4.0h)',
            slots: [
              { time: '9:00 AM', left: '38%', label: '🏢 9:00 AM (3.5h)', type: 'office' },
              { time: '2:30 PM', left: '62%', label: '🏠 2:30 PM (4.0h)', type: 'remote' }
            ]
          },
          {
            name: 'Alex Vance',
            initials: 'AV',
            isYou: false,
            avatarBg: 'bg-blue-600',
            hoursSummary: '6.5h (🏢 2.5h 🏠 4.0h)',
            slots: [
              { time: '8:00 AM', left: '34%', label: '🏠 8:00 AM (4h)', type: 'remote' },
              { time: '1:30 PM', left: '58%', label: '🏢 1:30 PM (2.5h)', type: 'office' }
            ]
          },
          {
            name: 'Nomeshwer Sharma',
            initials: 'NS',
            isYou: false,
            avatarBg: 'bg-emerald-600',
            hoursSummary: '7.0h (🏢 4.0h 🏠 3.0h)',
            slots: [
              { time: '8:30 AM', left: '36%', label: '🏢 8:30 AM (4h)', type: 'office' },
              { time: '3:00 PM', left: '65%', label: '🏠 3:00 PM (3h)', type: 'remote' }
            ]
          },
          {
            name: 'Meenaxi Maxi',
            initials: 'MM',
            isYou: false,
            avatarBg: 'bg-purple-600',
            hoursSummary: '6.0h (🏠 6.0h)',
            slots: [
              { time: '9:30 AM', left: '40%', label: '🏠 9:30 AM (3h)', type: 'remote' },
              { time: '2:00 PM', left: '60%', label: '🏠 2:00 PM (3h)', type: 'remote' }
            ]
          },
          {
            name: 'Elena Rostova',
            initials: 'ER',
            isYou: false,
            avatarBg: 'bg-sky-600',
            hoursSummary: '6.5h (🏢 4.0h 🏠 2.5h)',
            slots: [
              { time: '8:30 AM', left: '36%', label: '🏢 8:30 AM (4h)', type: 'office' },
              { time: '2:30 PM', left: '62%', label: '🏠 2:30 PM (2.5h)', type: 'remote' }
            ]
          },
          {
            name: 'Amara Okafor',
            initials: 'AO',
            isYou: false,
            avatarBg: 'bg-amber-600',
            hoursSummary: '5.0h (🏠 5.0h)',
            slots: [
              { time: '9:00 AM', left: '38%', label: '🏠 9:00 AM (3h)', type: 'remote' },
              { time: '4:00 PM', left: '68%', label: '⚠️ 4:00 PM (2h)', type: 'unplanned' }
            ]
          }
        ];

        if (selectedEmployee.value !== 'All') {
          const first = selectedEmployee.value.split(' ')[0].toLowerCase();
          return members.filter(m => m.name.toLowerCase().includes(first));
        }
        return members;
      });

      // 8. API Methods
      const fetchWorkstationData = async (emp = 'All') => {
        try {
          const url = `/api/method/omnitrack.api.get_workstation_data?employee=${encodeURIComponent(emp)}&_=${Date.now()}`;
          const res = await fetch(url, { cache: 'no-store' });
          const data = await res.json();
          if (data && data.message) {
            const m = data.message;
            workBlocks.value = m.work_blocks || [];
            projects.value = m.projects || [];
            tasks.value = m.tasks || [];
            assignedTasks.value = m.assigned_tasks || [];
            attentionTasks.value = m.attention_tasks || [];
            if (m.team_members && m.team_members.length) {
              teamMembers.value = m.team_members;
            }
            synthesizerLogs.value = m.synthesizer_logs || [];
            if (m.today_date) {
              const localToday = getLocalTodayISO();
              todayDate.value = localToday || m.today_date;
              if (!selectedDashboardDate.value) {
                selectedDashboardDate.value = todayDate.value;
              }
            }
            if (m.current_user) currentUser.value = m.current_user;
            if (m.kpis) updateDashboardKPIs(m.kpis);

            // Evict zombie local session if the bound block is already logged/completed
            // (Only for stale sessions older than 15s to avoid racing newly started local tracking)
            if (isTracking.value && trackerBlockName.value && (Date.now() - _lastLocalUpdate >= 15000)) {
              const curBlock = (workBlocks.value || []).find(b => b.name === trackerBlockName.value);
              if (curBlock && (curBlock.status === 'Logged (Full)' || curBlock.status === 'Logged (Over)' || curBlock.status === 'Logged (Partial)' || curBlock.status === 'Completed' || curBlock.status === 'Cancelled' || curBlock.status === 'Missed')) {
                if (m.active_session && m.active_session.status === 'active') {
                  curBlock.status = 'In Progress';
                  if (m.active_session.trackerBlockName !== trackerBlockName.value) {
                    restoreActiveSession(m.active_session);
                  }
                } else {
                  isTracking.value = false;
                  if (trackerTimer.value) clearInterval(trackerTimer.value);
                  trackerTimer.value = null;
                  trackerSeconds.value = 0;
                  startTime.value = null;
                  sessionNotesList.value = [];
                  trackerNotes.value = '';
                  trackerBlockName.value = null;
                  markSessionEnded();
                  localStorage.removeItem('omnitrack_active_session');
                }
              }
            }

            // Multi-device active session sync (computer <-> mobile phone)
            if (m.active_session && m.active_session.status === 'active' && m.active_session.startTime
                && !_isStoppingSession && (Date.now() - _lastLocalStop >= 10000)) {
              if (wasEndedHere(m.active_session.startTime)) {
                const srvTime = Number(m.active_session.lastUpdated || m.active_session.startTime || 0);
                if (srvTime > _lastLocalStop) {
                  unmarkSessionEnded(m.active_session.startTime);
                }
              }
              if (!wasEndedHere(m.active_session.startTime)) {
                const serverLines = Array.isArray(m.active_session.sessionNotesList) ? m.active_session.sessionNotesList : [];
                const localLines = sessionNotesList.value || [];
                const serverTime = Number(m.active_session.lastUpdated || m.active_session.startTime || 0);
                if (!isTracking.value || serverLines.length >= localLines.length || serverTime > _lastLocalUpdate) {
                  restoreActiveSession(m.active_session);
                }
              }
            } else if (m.active_session === null && isTracking.value) {
              const localAge = Date.now() - _lastLocalUpdate;
              if (localAge >= 15000) {
                isTracking.value = false;
                if (trackerTimer.value) clearInterval(trackerTimer.value);
                trackerSeconds.value = 0;
                sessionNotesList.value = [];
                trackerNotes.value = '';
                trackerBlockName.value = null;
                markSessionEnded();
                localStorage.removeItem('omnitrack_active_session');
                showToast('Session was completed on another device', 'info');
              } else {
                syncActiveSession(true);
              }
            }

            // Sync Pillar 2 attendance presence variance
            fetchAttendancePresence();
          }
        } catch (e) {
          console.error("API error:", e);
        }
      };

      const onEmployeeChange = () => {
        fetchWorkstationData(selectedEmployee.value);
        if (typeof fetchPlannerData === 'function' && activeTab.value === 'planner') {
          fetchPlannerData();
        }
        showToast(`Viewing ${selectedEmployee.value === 'All' ? 'All Team Members' : selectedEmployee.value}`, 'info');
      };

      // A session started by mistake (or abandoned because something else came up)
      // must be throwable away. Two-step, because it drops the elapsed time.
      const discardConfirm = ref(false);
      let _discardTimer = null;
      // Stop & Save and Discard are one control: a single tab stop, arrows between
      // them (WAI-ARIA toolbar), so Tab never lands on Discard by accident.
      // The roving index is Vue state, not a tabindex the handler pokes into the
      // DOM. Written straight to the DOM it survived until the next re-render and
      // then drifted, so Tab out of the notes box could land on Discard — one
      // keystroke from throwing the session away. Stop owns the tab stop.
      // Read the start off the same payload the tracker persists, so a session
      // restored after a reload — or re-anchored by Adjust — shows its real start
      // rather than one inferred from the tick count. trackerSeconds is touched
      // deliberately: it is the dependency that makes this recompute as time runs.
      const sessionStart = computed(() => {
        trackerSeconds.value;
        if (!isTracking.value) return null;
        let ms = 0;
        try {
          const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
          if (p && p.startTime) ms = Number(p.startTime);
        } catch (e) {}
        if (!ms) ms = Date.now() - trackerSeconds.value * 1000;
        const d = new Date(ms);
        if (isNaN(d.getTime())) return null;
        return {
          date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        };
      });

      const sessionToolFocus = ref('stop');
      const sessionToolTabindex = (id) => (sessionToolFocus.value === id ? 0 : -1);
      const onSessionToolbarKey = (ev) => {
        const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (keys.indexOf(ev.key) === -1) return;
        const items = [...ev.currentTarget.querySelectorAll('[data-session-tool]')];
        if (items.length < 2) return;
        ev.preventDefault();
        const cur = Math.max(0, items.indexOf(document.activeElement));
        let next = cur;
        if (ev.key === 'ArrowLeft') next = (cur - 1 + items.length) % items.length;
        else if (ev.key === 'ArrowRight') next = (cur + 1) % items.length;
        else if (ev.key === 'Home') next = 0;
        else next = items.length - 1;
        // Identify by position, not by the attribute's value: Frappe UI's button
        // renders through to a real <button> but drops data-* values on the way,
        // so the attribute is only good as a marker, never as a label.
        const ids = isTracking.value ? (trackerBoundBlock.value ? ['discard', 'adjust', 'noshow', 'stop'] : ['discard', 'adjust', 'stop']) : ['unplanned', 'stop'];
        sessionToolFocus.value = ids[next] || 'stop';
        items[next].focus();
      };
      // Leaving the group resets it. The group is one tab stop and that stop is
      // always Stop, never whichever button was last arrowed to.
      const onSessionToolbarFocusOut = (ev) => {
        if (!ev.currentTarget.contains(ev.relatedTarget)) sessionToolFocus.value = 'stop';
      };

      const discardSession = () => {
        if (!isTracking.value) return;
        if (!discardConfirm.value) {
          discardConfirm.value = true;
          showToast('Discard this session? Press Discard again — nothing will be saved.', 'warning');
          if (_discardTimer) clearTimeout(_discardTimer);
          _discardTimer = setTimeout(() => { discardConfirm.value = false; }, 6000);
          return;
        }
        if (_discardTimer) clearTimeout(_discardTimer);
        discardConfirm.value = false;
        triggerHaptic([40, 30, 40]);
        let sTime = null;
        try {
          const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
          if (p && p.startTime) sTime = Number(p.startTime);
        } catch (e) {}
        _lastLocalStop = Date.now();
        _isStoppingSession = true;
        isTracking.value = false;
        startTime.value = null;
        isSessionElevated.value = false;
        if (trackerTimer.value) clearInterval(trackerTimer.value);
        trackerTimer.value = null;
        markSessionEnded(sTime);
        localStorage.removeItem('omnitrack_active_session');
        // A sync debounced 500ms ago still holds the live payload; let it fire
        // after the clear and the server is active again one beat later.
        if (_syncDebounceTimer) { clearTimeout(_syncDebounceTimer); _syncDebounceTimer = null; }
        postJSON('sync_active_session', { session_data: null }).catch(() => {});
        try {
          if (_omnitrackChannel) {
            _omnitrackChannel.postMessage({ type: 'session_cleared' });
          }
        } catch (e) {}
        trackerSeconds.value = 0;
        trackerBlockName.value = null;
        trackerNotes.value = '';
        sessionNotesList.value = [];
        newSessionPoint.value = '';
        stopConfirmName.value = '';
        showToast('Session discarded — no timesheet was created', 'info');
        setTimeout(() => { _isStoppingSession = false; }, 8000);
      };

      const toggleTrack = async (customEndMs = null, customStartMs = null) => {
        triggerHaptic([40]);
        if (!isTracking.value) {
          _isStoppingSession = false;
          _lastLocalStop = 0;
          isTracking.value = true;
          const sTime = customStartMs ? Number(customStartMs) : Date.now();
          unmarkSessionEnded(sTime);
          startTime.value = sTime;
          trackerSeconds.value = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
          lastActivityTime.value = Date.now();
          lastInactivityAlertTime.value = 0;
          _lastLocalUpdate = Date.now();
          syncActiveSession(true);
          // Request browser notification permission on user gesture (clicking Start)
          try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission().then(p => { notificationPermission.value = p; }).catch(() => {});
            }
          } catch (e) {}
          trackerTimer.value = setInterval(() => {
            trackerSeconds.value = Math.max(0, Math.floor((Date.now() - sTime) / 1000));
            checkInactivity();
            checkBlockOverrun();
          }, 1000);
          showToast(`Focus timer started for ${selectedNature.value}`, 'info');
        } else {
          // Checked before the clock is torn down, so a refused stop leaves the
          // session exactly as it was and nothing is lost.
          if (!sessionHasLines.value) { refuseEmptySession(); return; }
          triggerHaptic([40, 50, 40]);
          let sTime = null;
          try {
            const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
            if (p && p.startTime) sTime = Number(p.startTime);
          } catch (e) {}
          _lastLocalStop = Date.now();
          _isStoppingSession = true;
          isTracking.value = false;
          isSessionElevated.value = false;
          if (trackerTimer.value) clearInterval(trackerTimer.value);
          trackerTimer.value = null;
          markSessionEnded(sTime);
          localStorage.removeItem('omnitrack_active_session');
          // A sync debounced 500ms ago still holds the live payload; let it fire
          // after the clear and the server is active again one beat later.
          if (_syncDebounceTimer) { clearTimeout(_syncDebounceTimer); _syncDebounceTimer = null; }
          postJSON('sync_active_session', { session_data: null }).catch(() => {});
          try {
            if (_omnitrackChannel) {
              _omnitrackChannel.postMessage({ type: 'session_cleared' });
            }
          } catch (e) {}
          // snapshot, then zero the clock: a standby HUD showing the last
          // session's elapsed time reads like a session that is still open
          let elapsedSecs = trackerSeconds.value;
          let effectiveStopMs = Date.now();
          if (customEndMs && customEndMs < effectiveStopMs) {
            effectiveStopMs = customEndMs;
            if (sTime) {
              if (effectiveStopMs < sTime) effectiveStopMs = sTime + 60000;
              elapsedSecs = Math.max(60, Math.floor((effectiveStopMs - sTime) / 1000));
            } else {
              elapsedSecs = Math.min(elapsedSecs, Math.max(60, Math.floor((effectiveStopMs - (Date.now() - elapsedSecs * 1000)) / 1000)));
            }
          }
          trackerSeconds.value = 0;
          const hrs = Math.round(((elapsedSecs / 3600) || 0.01) * 100) / 100;
          const boundBlock = trackerBlockName.value;
          trackerBlockName.value = null;
          const rawTitle = (trackerNotes.value || '').trim();
          const bullets = sessionNotesList.value.filter(p => p.trim()).map(p => `• ${p.trim()}`).join('\n');
          const finalNotes = (rawTitle && bullets) ? `${rawTitle}\n\n${bullets}` : (rawTitle || bullets || `Focus session (${selectedNature.value})`);
          sessionNotesList.value = [];

          const now = new Date(effectiveStopMs);
          const from = new Date(now.getTime() - elapsedSecs * 1000);
          const pad = (n) => String(n).padStart(2, '0');
          const sessionDate = from.getFullYear() + '-' + pad(from.getMonth() + 1) + '-' + pad(from.getDate());

          if (boundBlock) {
            // Recorded against a Planner block -> a real Work Session (the timesheet).
            try {
              await postJSON('log_work_session', {
                block_name: boundBlock,
                session_date: sessionDate,
                from_time: pad(from.getHours()) + ':' + pad(from.getMinutes()),
                to_time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
                hours: hrs,
                notes: finalNotes || `Focus session (${selectedNature.value})`,
                logged_via: 'Stopwatch'
              });
              showToast(`Logged ${hrs.toFixed(2)}h against focus block`, 'success');
              trackerNotes.value = '';
              fetchWorkstationData(selectedEmployee.value);
              if (typeof fetchPlannerData === 'function') await fetchPlannerData();
              const refreshed = (plannerData.value.blocks || []).find(x => x.name === boundBlock);
              if (refreshed && showBlockDrawer.value) activeBlock.value = refreshed;
            } catch (err) {
              showToast('Could not log session: ' + (err && err.message || err), 'danger');
            } finally {
              setTimeout(() => { _isStoppingSession = false; }, 8000);
            }
            return;
          }

          try {
            await postJSON('quick_timer_punch', {
              action: 'stop',
              duration_seconds: elapsedSecs,
              duration_hours: hrs,
              from_time: pad(from.getHours()) + ':' + pad(from.getMinutes()),
              to_time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
              work_date: sessionDate,
              work_nature: selectedNature.value,
              task_nature: selectedNature.value,
              deliverable_notes: finalNotes || `Tracked Focus (${selectedNature.value})`,
              notes: finalNotes || `Tracked Focus (${selectedNature.value})`,
              project: selectedProject.value
            });
            showToast(`Logged ${hrs.toFixed(2)} hrs successfully!`, 'success');
            trackerNotes.value = '';
            fetchWorkstationData(selectedEmployee.value);
            if (typeof fetchPlannerData === 'function' && activeTab.value === 'planner') fetchPlannerData();
          } catch (err) {
            showToast('Timer punch recorded locally.', 'success');
          } finally {
            setTimeout(() => { _isStoppingSession = false; }, 8000);
          }
        }
      };

      // Start the header stopwatch bound to a specific Planner block.
      const trackPlannerBlock = (b) => {
        if (isTracking.value) { showToast('Stop the current timer first', 'danger'); return; }
        _explicitBoundBlock.value = b;
        trackerBlockName.value = b.name;
        let rawN = b.task_subject || b.work_item_label || (b.task ? (b.task_subject || b.task) : '') || b.deliverable_notes || '';
        if (rawN.includes('•')) {
          const parts = rawN.split('•').map(s => s.trim()).filter(Boolean);
          trackerNotes.value = parts[0] || '';
          sessionNotesList.value = parts.slice(1);
        } else {
          trackerNotes.value = rawN;
          sessionNotesList.value = [];
        }
        const proj = b.project || '';
        selectedProject.value = proj;
        trackerProject.value = proj;
        const nat = getNatureBadge(b.task_nature).label;
        selectedNature.value = nat;
        trackerNature.value = nat;
        showBlockDrawer.value = false;
        toggleTrack();
        openSessionCard();
      };

      // 2b. Adjust Timesheet Timing & Backdating
      const showAdjustModal = ref(false);
      const adjustMode = ref('keep_running'); // 'keep_running' | 'stop_and_log'
      const originalStartTimeFormatted = ref('');
      const adjustForm = ref({
        work_date: getLocalTodayISO(),
        from_time: '09:00',
        to_time: '10:00',
        notes: ''
      });

      const minTimesheetDate = computed(() => {
        if (isManager.value) return '';
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      });

      const adjustDurationMinutes = computed(() => {
        if (!adjustForm.value.from_time || !adjustForm.value.to_time) return 0;
        try {
          const [fh, fm] = adjustForm.value.from_time.split(':').map(Number);
          const [th, tm] = adjustForm.value.to_time.split(':').map(Number);
          let startMins = fh * 60 + fm;
          let endMins = th * 60 + tm;
          let diff = endMins - startMins;
          if (diff < 0) diff += 1440;
          return diff;
        } catch (e) {
          return 0;
        }
      });

      // Short form for the save button, so the button itself says how much it will log.
      const adjustDurationShort = computed(() => {
        const mins = adjustDurationMinutes.value;
        if (mins <= 0) return '0m';
        const h = Math.floor(mins / 60), m = mins % 60;
        return h ? (m ? h + 'h ' + m + 'm' : h + 'h') : m + 'm';
      });

      const adjustDurationFormatted = computed(() => {
        const mins = adjustDurationMinutes.value;
        if (mins <= 0) return '0h 00m (0.00 hrs)';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const dec = (mins / 60).toFixed(2);
        return `${h}h ${String(m).padStart(2, '0')}m (${dec} hrs)`;
      });

      const keepRunningElapsedFormatted = computed(() => {
        if (!adjustForm.value.from_time) return '0m 00s';
        try {
          const [fh, fm] = adjustForm.value.from_time.split(':').map(Number);
          const parts = (adjustForm.value.work_date || todayDate.value).split('-').map(Number);
          const startMs = new Date(parts[0], parts[1] - 1, parts[2], fh, fm, 0).getTime();
          const nowMs = Date.now();
          const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
          const h = Math.floor(diffSecs / 3600);
          const m = Math.floor((diffSecs % 3600) / 60);
          const s = diffSecs % 60;
          const dec = (diffSecs / 3600).toFixed(2);
          if (h > 0) {
            return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s (${dec} hrs)`;
          }
          return `${m}m ${String(s).padStart(2, '0')}s (${dec} hrs)`;
        } catch (e) {
          return '0m 00s';
        }
      });

      const openAdjustModal = () => {
        // If the timesheet popup is elevated in full focus, minimize it so the
        // adjust dialog is directly centered and never occluded by the backdrop.
        if (isSessionElevated.value) {
          isSessionElevated.value = false;
        }
        const pad = (n) => String(n).padStart(2, '0');
        const nowObj = new Date();
        let startObj = new Date();
        if (isTracking.value && trackerSeconds.value > 0) {
          startObj = new Date(Date.now() - (trackerSeconds.value * 1000));
          originalStartTimeFormatted.value = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())}`;
          adjustMode.value = 'keep_running';
        } else {
          startObj = new Date(Date.now() - 3600 * 1000);
          originalStartTimeFormatted.value = '';
          adjustMode.value = 'stop_and_log';
        }

        const work_date = `${startObj.getFullYear()}-${pad(startObj.getMonth() + 1)}-${pad(startObj.getDate())}`;
        const from_time = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())}`;
        const to_time = `${pad(nowObj.getHours())}:${pad(nowObj.getMinutes())}`;

        const rawTitle = (trackerNotes.value || '').trim();
        const bullets = (sessionNotesList.value || []).filter(p => p.trim()).map(p => `• ${p.trim()}`).join('\n');
        const notes = (rawTitle && bullets) ? `${rawTitle}\n\n${bullets}` : (rawTitle || bullets || '');

        adjustForm.value = {
          work_date,
          from_time,
          to_time,
          notes
        };
        showAdjustModal.value = true;
      };

      const nudgeAdjustTime = (field, deltaMinutes) => {
        const key = field === 'from' ? 'from_time' : 'to_time';
        const curVal = adjustForm.value[key] || '00:00';
        try {
          const [h, m] = curVal.split(':').map(Number);
          let totalMins = h * 60 + m + deltaMinutes;
          if (totalMins < 0) totalMins = (totalMins % 1440) + 1440;
          else if (totalMins >= 1440) totalMins = totalMins % 1440;
          const newH = Math.floor(totalMins / 60);
          const newM = totalMins % 60;
          const pad = (n) => String(n).padStart(2, '0');
          adjustForm.value[key] = `${pad(newH)}:${pad(newM)}`;
        } catch (e) {}
      };

      const setAdjustEndNow = () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        adjustForm.value.to_time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      };

      const applyAdjustedStartTime = () => {
        if (!adjustForm.value.from_time) {
          showToast('Start time is required', 'warning');
          return;
        }
        try {
          const [fh, fm] = adjustForm.value.from_time.split(':').map(Number);
          const parts = (adjustForm.value.work_date || todayDate.value).split('-').map(Number);
          const newStartObj = new Date(parts[0], parts[1] - 1, parts[2], fh, fm, 0);
          const newStartMs = newStartObj.getTime();
          const nowMs = Date.now();
          if (newStartMs > nowMs) {
            showToast('Start time cannot be in the future for an ongoing session', 'warning');
            return;
          }
          const newElapsedSecs = Math.max(0, Math.floor((nowMs - newStartMs) / 1000));
          trackerSeconds.value = newElapsedSecs;
          if (trackerTimer.value) clearInterval(trackerTimer.value);
          trackerTimer.value = setInterval(() => {
            trackerSeconds.value = Math.max(0, Math.floor((Date.now() - newStartMs) / 1000));
            checkInactivity();
          }, 1000);

          if (adjustForm.value.notes) {
            trackerNotes.value = adjustForm.value.notes;
          }
          recordUserActivity();
          const saved = localStorage.getItem('omnitrack_active_session');
          let activePayload = {};
          try { if (saved) activePayload = JSON.parse(saved); } catch (e) {}
          activePayload.startTime = newStartMs;
          activePayload.lastUpdated = Date.now();
          activePayload.lastActivityTime = Date.now();
          if (adjustForm.value.notes) activePayload.trackerNotes = adjustForm.value.notes;
          localStorage.setItem('omnitrack_active_session', JSON.stringify(activePayload));
          syncActiveSession(true);

          showAdjustModal.value = false;
          showToast(`Running clock updated: started at ${adjustForm.value.from_time} (${Math.round(newElapsedSecs / 60)}m elapsed)`, 'success');
        } catch (err) {
          showToast('Failed to adjust start time: ' + (err && err.message || err), 'danger');
        }
      };

      const submitAdjustedTimesheet = async () => {
        const targetDate = adjustForm.value.work_date || todayDate.value;
        if (!targetDate) {
          showToast('Session date is required', 'warning');
          return;
        }
        if (!isManager.value && minTimesheetDate.value && targetDate < minTimesheetDate.value) {
          showToast(`Regular users can only log for today and yesterday (${minTimesheetDate.value}). Older dates require Manager role.`, 'danger');
          return;
        }
        if (adjustDurationMinutes.value <= 0) {
          showToast('Duration must be greater than 0 minutes', 'warning');
          return;
        }
        // The modal has its own notes box, so either source satisfies the rule.
        if (!sessionHasLines.value && String(adjustForm.value.notes || '').trim().length < 3) {
          showToast('Describe what you did in the notes below before logging this time — an hour with no description cannot be justified to a manager or a client.', 'warning');
          return;
        }

        const hrs = Math.max(Math.round((adjustDurationMinutes.value / 60.0) * 100) / 100, 0.01);
        const fromTimeStr = adjustForm.value.from_time.length === 5 ? adjustForm.value.from_time + ':00' : adjustForm.value.from_time;
        const toTimeStr = adjustForm.value.to_time.length === 5 ? adjustForm.value.to_time + ':00' : adjustForm.value.to_time;
        const boundBlock = trackerBlockName.value;
        const finalNotes = (adjustForm.value.notes || '').trim() || `Adjusted focus session (${selectedNature.value})`;

        try {
          if (boundBlock) {
            await postJSON('log_work_session', {
              block_name: boundBlock,
              session_date: targetDate,
              from_time: fromTimeStr,
              to_time: toTimeStr,
              hours: hrs,
              notes: finalNotes,
              logged_via: 'Adjusted Stopwatch'
            });
            showToast(`Logged ${hrs.toFixed(2)}h against focus block`, 'success');
          } else {
            // postJSON throws on a non-OK response. A bare fetch() resolves even for a
            // 417/500, which used to leave the user with a success toast and a wiped
            // session for a timesheet that was never written.
            await postJSON('quick_timer_punch', {
              action: 'stop',
              work_date: targetDate,
              from_time: fromTimeStr,
              to_time: toTimeStr,
              duration_seconds: adjustDurationMinutes.value * 60,
              duration_hours: hrs,
              work_nature: selectedNature.value,
              task_nature: selectedNature.value,
              deliverable_notes: finalNotes,
              notes: finalNotes,
              project: selectedProject.value
            });
            showToast(`Logged ${hrs.toFixed(2)} hrs successfully!`, 'success');
          }

          // Reset tracker state
          isTracking.value = false;
          if (trackerTimer.value) clearInterval(trackerTimer.value);
          trackerTimer.value = null;
          trackerSeconds.value = 0;
          trackerBlockName.value = null;
          trackerNotes.value = '';
          sessionNotesList.value = [];
          newSessionPoint.value = '';
          stopConfirmName.value = '';
          markSessionEnded();
          localStorage.removeItem('omnitrack_active_session');
          postJSON('sync_active_session', { session_data: null }).catch(() => {});

          showAdjustModal.value = false;
          fetchWorkstationData(selectedEmployee.value);
          if (typeof fetchPlannerData === 'function') fetchPlannerData();
        } catch (err) {
          // The clock is deliberately still running here — nothing was saved, so the
          // user has not lost the session and can retry or fix the times.
          showToast('Not saved — the clock is still running. ' + _errText(err), 'danger');
        }
      };

      // ==========================================
      // TIMESHEET CAPTURE PERFECTION SUITE (PILLARS 1-5)
      // ==========================================

      // Pillar 1: 1-Click Plan-to-Actuals Catch-Up
      const quickConvertPlanToActual = async (block) => {
        if (!block || !block.name) return;
        try {
          const res = await postJSON('convert_plan_to_actual', {
            block_name: block.name,
            session_notes: block.deliverable_notes || 'Completed as scheduled.'
          });
          showToast(`⚡ Plan converted to logged time (${res.actual_hours}h)!`, 'success');
          fetchWorkstationData(selectedEmployee.value);
          if (typeof fetchPlannerData === 'function') fetchPlannerData();
        } catch (err) {
          showToast('Failed to convert plan: ' + (err && err.message || err), 'danger');
        }
      };

      // Pillar 2: Attendance Presence Reconciliation
      const attendancePresence = ref(null);
      const fetchAttendancePresence = async () => {
        try {
          const emp = selectedEmployee.value || session.user;
          const dt = selectedDashboardDate.value || getLocalTodayISO();
          const res = await postJSON('get_attendance_presence_variance', {
            employee: emp,
            work_date: dt
          });
          if (res) attendancePresence.value = res;
        } catch (err) {}
      };

      // Pillar 3: Runaway Timer Guard
      const showRunawayAlertModal = ref(false);
      const runawayGuardData = ref({ elapsed_hours: 0, suggested_cap_hours: 0, reason: '', started_at_str: '' });
      const runawayChoice = ref('keep'); // 'keep' | 'cap' | 'custom'

      const checkRunawayStopwatch = async () => {
        if (!isTracking.value || !startTime.value) return;
        try {
          const res = await postJSON('check_runaway_timer_guard', {
            start_ms: startTime.value,
            scheduled_duration_hours: trackerBoundBlock.value ? flt(trackerBoundBlock.value.duration_hours) : 0
          });
          if (res && res.is_runaway) {
            runawayGuardData.value = {
              elapsed_hours: res.elapsed_hours,
              suggested_cap_hours: res.suggested_cap_hours,
              reason: res.reason,
              started_at_str: new Date(res.start_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            runawayChoice.value = 'cap';
            showRunawayAlertModal.value = true;
          }
        } catch (err) {}
      };

      const resolveRunawayOption = (choice) => {
        runawayChoice.value = choice;
      };

      const confirmRunawayResolution = () => {
        showRunawayAlertModal.value = false;
        if (runawayChoice.value === 'keep') {
          showToast('Timer kept running. Remember to stop when done!', 'info');
        } else if (runawayChoice.value === 'cap') {
          // Open adjust modal prefilled to suggested cap hours
          openAdjustModal();
          const capMins = Math.round(flt(runawayGuardData.value.suggested_cap_hours || 2.0) * 60);
          adjustDurationMinutes.value = capMins;
          adjustMode.value = 'stop_and_log';
          // Calculate to_time based on from_time + capMins
          nudgeAdjustTime('to', 0);
        } else if (runawayChoice.value === 'custom') {
          openAdjustModal();
        }
      };

      // Pillar 4: Interactive Timeline Gap Booking
      const quickLogTimelineGap = (gap) => {
        if (!gap) return;
        adjustForm.value = {
          work_date: selectedDashboardDate.value || getLocalTodayISO(),
          from_time: gap.from_time.substring(0, 5),
          to_time: gap.to_time.substring(0, 5),
          notes: `Unplanned gap work (${gap.label})`
        };
        adjustMode.value = 'stop_and_log';
        showAdjustModal.value = true;
      };

      // Pillar 5: EOD Wrap-Up Ritual & Reconciliation
      const showEODModal = ref(false);
      const eodSummary = computed(() => {
        const blocks = workFocusBlocks.value || [];
        const actualH = blocks.reduce((acc, b) => acc + flt(b.actual_hours || 0), 0);
        const unloggedBlocks = blocks.filter(b => blockLogState(b) === 'none' && b.status !== 'Cancelled');
        const unloggedH = unloggedBlocks.reduce((acc, b) => acc + flt(b.duration_hours || 0), 0);
        const curH = new Date().getHours();
        return {
          total_actual_hours: Math.round(actualH * 10) / 10,
          remaining_to_target: Math.max(0, Math.round((8.0 - actualH) * 10) / 10),
          blocks_count: blocks.length,
          unconverted_count: unloggedBlocks.length,
          unconverted_hours: Math.round(unloggedH * 10) / 10,
          is_eod_time: curH >= 16 // 4 PM or later
        };
      });

      const eodPendingBlocks = computed(() => {
        const blocks = workFocusBlocks.value || [];
        return blocks.filter(b => blockLogState(b) === 'none' && b.status !== 'Cancelled');
      });

      const openEODWrapUpDrawer = () => {
        showEODModal.value = true;
      };

      const convertAllPendingPlannedBlocks = async () => {
        const pending = eodPendingBlocks.value || [];
        if (!pending.length) {
          showToast('No unlogged planned blocks to convert.', 'info');
          return;
        }
        let converted = 0;
        for (const b of pending) {
          try {
            await postJSON('convert_plan_to_actual', {
              block_name: b.name,
              session_notes: b.deliverable_notes || 'Completed as scheduled.'
            });
            converted++;
          } catch (e) {}
        }
        showToast(`⚡ Converted ${converted} planned block(s) to logged timesheets!`, 'success');
        fetchWorkstationData(selectedEmployee.value);
        if (typeof fetchPlannerData === 'function') fetchPlannerData();
      };

      // 2b-2. Edit & Delete Logged Work Sessions
      const showEditSessionModal = ref(false);
      const isSavingEditSession = ref(false);
      const editSessionTargetBlock = ref(null);
      const editSessionForm = ref({
        name: '',
        session_date: '',
        from_time: '',
        to_time: '',
        notes: ''
      });
      const editSessionDuration = computed(() => {
        const f = editSessionForm.value.from_time;
        const t = editSessionForm.value.to_time;
        if (!f || !t) return '0.00';
        try {
          const [fh, fm] = f.split(':').map(Number);
          const [th, tm] = t.split(':').map(Number);
          let diff = (th * 60 + tm) - (fh * 60 + fm);
          if (diff < 0) diff += 1440;
          return (diff / 60).toFixed(2);
        } catch (e) {
          return '0.00';
        }
      });

      const openEditSessionModal = (block, session) => {
        editSessionTargetBlock.value = block;
        editSessionForm.value = {
          name: session.name || '',
          session_date: session.session_date || (block && block.work_date) || todayISO(),
          from_time: session.from_time ? hhmm(session.from_time) : '',
          to_time: session.to_time ? hhmm(session.to_time) : '',
          notes: session.notes || ''
        };
        showEditSessionModal.value = true;
      };

      const saveEditSession = async () => {
        if (!editSessionForm.value.name) return;
        if (!editSessionForm.value.session_date) {
          showToast('Session date is required', 'warning');
          return;
        }
        if (!editSessionForm.value.from_time || !editSessionForm.value.to_time) {
          showToast('Start and end times are required', 'warning');
          return;
        }
        isSavingEditSession.value = true;
        try {
          const res = await postJSON('update_work_session', {
            session_name: editSessionForm.value.name,
            block_name: editSessionTargetBlock.value ? editSessionTargetBlock.value.name : null,
            session_date: editSessionForm.value.session_date,
            from_time: editSessionForm.value.from_time.length === 5 ? editSessionForm.value.from_time + ':00' : editSessionForm.value.from_time,
            to_time: editSessionForm.value.to_time.length === 5 ? editSessionForm.value.to_time + ':00' : editSessionForm.value.to_time,
            notes: editSessionForm.value.notes
          });
          if (res && res.status === 'success') {
            showToast('Work session updated successfully', 'success');
            showEditSessionModal.value = false;
            fetchWorkstationData(selectedEmployee.value);
            if (activeBlock.value && res.name === activeBlock.value.name) {
              activeBlock.value.actual_hours = res.actual_hours;
              activeBlock.value.variance_hours = res.variance_hours;
              activeBlock.value.status = res.block_status;
              if (res.sessions) activeBlock.value.sessions = res.sessions;
            }
          } else {
            showToast(extractErrorMessage(res, 'Failed to update work session'), 'danger');
          }
        } catch (e) {
          showToast(extractErrorMessage(e, 'Failed to update work session'), 'danger');
        } finally {
          isSavingEditSession.value = false;
        }
      };

      const confirmDeleteSession = async (block, session) => {
        if (!session || !session.name) return;
        const timeLabel = session.from_time ? hhmm(session.from_time) + '–' + hhmm(session.to_time) : fmtHrs(session.hours) + 'h';
        if (!confirm(`Delete work session (${timeLabel})? This will update actual hours on this block.`)) return;
        try {
          const res = await postJSON('delete_work_session', {
            session_name: session.name,
            block_name: block ? block.name : null
          });
          if (res && res.status === 'success') {
            showToast('Work session deleted', 'info');
            fetchWorkstationData(selectedEmployee.value);
            if (activeBlock.value && res.name === activeBlock.value.name) {
              activeBlock.value.actual_hours = res.actual_hours;
              activeBlock.value.variance_hours = res.variance_hours;
              activeBlock.value.status = res.block_status;
              if (res.sessions) activeBlock.value.sessions = res.sessions;
            }
          } else {
            showToast(extractErrorMessage(res, 'Failed to delete work session'), 'danger');
          }
        } catch (e) {
          showToast(extractErrorMessage(e, 'Failed to delete work session'), 'danger');
        }
      };

      const trackBlock = (block, customStartMs = null) => {
        if (!block) return;
        if (isTracking.value && trackerBlockName.value !== block.name) {
          promptSwitchSession({
            id: block.name,
            name: block.name,
            label: block.task_subject || block.work_item_label || block.name,
            sublabel: `${block.start_time || ''} – ${block.end_time || ''} · ${block.project || 'General'}`,
            project: block.project,
            is_block: true,
            task_nature: block.task_nature,
            work_date: block.work_date,
            start_time: block.start_time,
            end_time: block.end_time,
          });
          return;
        }
        _explicitBoundBlock.value = block;
        trackerBlockName.value = block.name;
        if (block.status === 'Completed' || block.status === 'Logged (Full)') {
          block.status = 'In Progress';
        }
        let rawN = block.task_subject || block.work_item_label || (block.task ? (block.task_subject || block.task) : '') || block.deliverable_notes || '';
        if (rawN.includes('•')) {
          const parts = rawN.split('•').map(s => s.trim()).filter(Boolean);
          trackerNotes.value = parts[0] || '';
          sessionNotesList.value = parts.slice(1);
        } else {
          trackerNotes.value = rawN;
          sessionNotesList.value = [];
        }
        const proj = block.project || '';
        selectedProject.value = proj;
        trackerProject.value = proj;
        const nat = getNatureBadge(block.task_nature).label;
        selectedNature.value = nat;
        trackerNature.value = nat;
        toggleTrack(null, customStartMs);
      };

      // 2c. 1-Click Atomic Switch Task Action (WCAG 2.2 AA)
      const showSwitchTaskModal = ref(false);
      const showSwitchConfirmModal = ref(false);
      const switchTargetItem = ref(null);
      const isSwitchingSession = ref(false);
      const switchSearchQuery = ref('');
      const switchWrapUpNote = ref('');

      const promptSwitchSession = (target) => {
        if (!target) return;
        triggerHaptic([20]);
        switchTargetItem.value = target;
        const rawTitle = (trackerNotes.value || '').trim();
        const bullets = (sessionNotesList.value || []).filter(p => p.trim()).map(p => `• ${p.trim()}`).join('\n');
        switchWrapUpNote.value = (rawTitle && bullets) ? `${rawTitle}\n\n${bullets}` : (rawTitle || bullets || '');
        showSwitchConfirmModal.value = true;
      };

      const confirmSwitchAndStart = async () => {
        if (!switchTargetItem.value) return;
        const target = switchTargetItem.value;
        isSwitchingSession.value = true;
        try {
          await executeSwitchTask(target);
          showSwitchConfirmModal.value = false;
          switchTargetItem.value = null;
        } finally {
          isSwitchingSession.value = false;
        }
      };

      const openSwitchTaskModal = () => {
        if (isSessionElevated.value) isSessionElevated.value = false;
        switchSearchQuery.value = '';
        const rawTitle = (trackerNotes.value || '').trim();
        const bullets = (sessionNotesList.value || []).filter(p => p.trim()).map(p => `• ${p.trim()}`).join('\n');
        switchWrapUpNote.value = (rawTitle && bullets) ? `${rawTitle}\n\n${bullets}` : (rawTitle || bullets || '');
        showSwitchTaskModal.value = true;
      };

      const switchCandidates = computed(() => {
        const q = (switchSearchQuery.value || '').toLowerCase().trim();
        const curBlock = trackerBlockName.value;
        const list = [];

        // 1. Candidate Planned Work Blocks for today
        const blocks = (plannerData.value && plannerData.value.blocks) || [];
        blocks.forEach(b => {
          if (b.name === curBlock) return;
          if (b.status === 'Cancelled' || b.status === 'Logged (Full)') return;
          const label = b.task_subject || b.work_item_label || b.name;
          const sublabel = `${b.start_time || ''} – ${b.end_time || ''} · ${b.project || 'General'}`;
          if (!q || label.toLowerCase().includes(q) || (b.project || '').toLowerCase().includes(q)) {
            list.push({
              id: b.name,
              name: b.name,
              label,
              sublabel,
              project: b.project,
              is_block: true,
              task_nature: b.task_nature
            });
          }
        });

        // 2. Candidate Open Tasks
        const tasks = assignedTasks.value || [];
        tasks.forEach(t => {
          const label = t.subject || t.title || t.name;
          const sublabel = `Task · ${t.project || 'General'}`;
          if (!q || label.toLowerCase().includes(q) || (t.project || '').toLowerCase().includes(q)) {
            list.push({
              id: t.name || t.id,
              name: t.name || t.id,
              label,
              sublabel,
              project: t.project,
              is_block: false,
              task_nature: '🎯 Planned'
            });
          }
        });

        return list;
      });

      const executeSwitchTask = async (target) => {
        triggerHaptic([30, 40]);
        const isBlock = !!target.is_block;
        const targetBlock = isBlock ? target.name : null;
        const targetTask = !isBlock ? target.name : null;
        const wrapNote = (switchWrapUpNote.value || '').trim();

        showSwitchTaskModal.value = false;
        showSwitchConfirmModal.value = false;
        try {
          const res = await postJSON('switch_active_session', {
            target_block: targetBlock,
            target_task: targetTask,
            current_session_notes: wrapNote,
            previous_block: trackerBlockName.value || null,
            start_time_ms: startTime.value || null
          });
          const loggedH = (res && res.elapsed_hours) ? `${res.elapsed_hours}h` : 'time';
          showToast(`Switched session! Logged ${loggedH} on previous session.`, 'success');
          trackerSeconds.value = 0;
          startTime.value = Date.now();
          lastActivityTime.value = Date.now();
          lastInactivityAlertTime.value = 0;
          trackerBlockName.value = targetBlock;
          trackerNotes.value = target.label || '';
          sessionNotesList.value = [];
          if (isBlock && targetBlock) {
            const foundB = (plannerData.value?.blocks || []).find(b => b.name === targetBlock);
            if (foundB) {
              _explicitBoundBlock.value = foundB;
              selectedProject.value = foundB.project || '';
              trackerProject.value = foundB.project || '';
              selectedNature.value = getNatureBadge(foundB.task_nature).label;
              trackerNature.value = getNatureBadge(foundB.task_nature).label;
            }
          }
          fetchWorkstationData(selectedEmployee.value);
          if (typeof fetchPlannerData === 'function') fetchPlannerData();
        } catch (err) {
          showToast('Failed to switch task: ' + (err && err.message || err), 'danger');
        }
      };

      const saveNewPlannedTask = async () => {
        if (!newTaskForm.value.notes) {
          showToast('Please enter what you will focus on', 'danger');
          return;
        }
        try {
          const sTime = newTaskForm.value.startTime ? (newTaskForm.value.startTime.length === 5 ? newTaskForm.value.startTime + ':00' : newTaskForm.value.startTime) : '10:00:00';
          const eTime = newTaskForm.value.endTime ? (newTaskForm.value.endTime.length === 5 ? newTaskForm.value.endTime + ':00' : newTaskForm.value.endTime) : '11:00:00';
          const durHours = parseFloat(newTaskForm.value.duration) || 1.0;

          const res = await fetch('/api/method/omnitrack.api.create_planned_work_block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deliverable_notes: newTaskForm.value.notes,
              employee: newTaskForm.value.assignee,
              project: newTaskForm.value.project || null,
              task: newTaskForm.value.task || null,
              task_nature: newTaskForm.value.nature || '🎯 Planned',
              work_date: newTaskForm.value.date,
              start_time: sTime,
              end_time: eTime,
              duration_hours: durHours,
              status: 'Planned'
            })
          });
          const assignedMember = teamMembers.value.find(m => m.name === newTaskForm.value.assignee || m.full_name === newTaskForm.value.assignee);
          const memberName = assignedMember ? assignedMember.full_name : newTaskForm.value.assignee;
          showToast(`Focus block scheduled for ${memberName}!`, 'success');
          showNewTaskModal.value = false;
          fetchWorkstationData(selectedEmployee.value);
        } catch (e) {
          showToast('Focus block scheduled.', 'success');
          showNewTaskModal.value = false;
          fetchWorkstationData(selectedEmployee.value);
        }
      };

      // ============================================
      // PLANNER — Calendar work-block self-booking
      // ============================================
      const PLANNER_HOUR_PX = 44;
      const plannerGridScroll = ref(null);
      const scrollPlannerToMorning = () => {
        nextTick(() => {
          if (!plannerGridScroll.value) return;
          const isToday = plannerAnchor.value === todayISO();
          if (isToday && nowMinute.value !== undefined) {
            const boxH = plannerGridScroll.value.clientHeight || (6 * PLANNER_HOUR_PX);
            const nowY = (nowMinute.value / 60) * PLANNER_HOUR_PX;
            plannerGridScroll.value.scrollTop = Math.max(0, nowY - (boxH / 2));
          } else {
            plannerGridScroll.value.scrollTop = 7 * PLANNER_HOUR_PX;
          }
        });
      };
      // Responsive Density: Mobile (<640px) -> Day, Mid-size (640-1024px) -> 4 Days, Desktop (>=1024px) -> Week
      const userCustomizedPlannerView = ref(false);
      const getDeviceDefaultPlannerView = () => {
        if (typeof window === 'undefined') return 'week';
        const w = window.innerWidth;
        if (w < 640) return 'day';
        if (w < 1024) return '4days';
        return 'week';
      };
      const plannerView = ref(getDeviceDefaultPlannerView());
      const setUserPlannerView = (v) => {
        userCustomizedPlannerView.value = true;
        plannerView.value = v;
      };
      const handleResize = () => {
        if (!userCustomizedPlannerView.value) {
          const defaultView = getDeviceDefaultPlannerView();
          if (plannerView.value !== defaultView) {
            plannerView.value = defaultView;
          }
        }
      };
      const plannerNatureOptions = ['🎯 Planned', '⚠️ Unplanned', '🔄 Review & Sync', '☕ Break', '🚫 Out-of-Office', '🌴 Leave', '🤒 Absent'];
      const showNatureFilter = ref(false);
      const natureFilter = ref([]); // empty = show all
      const natureFilterLabel = computed(() =>
        natureFilter.value.length === 0 ? 'All types'
          : natureFilter.value.length === 1 ? natureFilter.value[0]
          : natureFilter.value.length + ' types');
      const plannerNatureMenuItems = computed(() => {
        const items = [
          {
            label: 'All types',
            badge: natureFilter.value.length === 0 ? '✓' : '',
            action: 'all',
            onClick: () => setNatureFilter('all')
          },
          {
            label: '── Filter by Nature ──',
            disabled: true
          }
        ];
        plannerNatureOptions.forEach((n) => {
          items.push({
            label: n,
            badge: natureFilter.value.includes(n) ? '✓' : '',
            action: n,
            keepOpen: true,
            onClick: () => toggleNatureFilter(n)
          });
        });
        return items;
      });
      const setNatureFilter = (v) => { if (v === 'all') natureFilter.value = []; showNatureFilter.value = false; };
      const toggleNatureFilter = (n) => {
        const i = natureFilter.value.indexOf(n);
        if (i >= 0) natureFilter.value.splice(i, 1); else natureFilter.value.push(n);
      };
      const _blockNature = (b) => (b.task_nature && b.task_nature.trim()) ? b.task_nature.trim() : '🎯 Planned';
      const plannerAnchor = ref('');
      const plannerBusy = ref(false);
      const pickedTask = ref(null);
      const plannerData = ref({
        week_start: '', week_end: '', days: [], blocks: [], assigned_tasks: [],
        totals: { planned_hours: 0, actual_hours: 0, variance_hours: 0, adherence_pct: 0, block_count: 0 }
      });
      const getDateOffsetISO = (offsetDays) => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      const setDatePreset = (offsetDays) => {
        bookForm.value.work_date = getDateOffsetISO(offsetDays);
      };
      const isDateActive = (offsetDays) => {
        return bookForm.value.work_date === getDateOffsetISO(offsetDays);
      };
      const comboboxPairingPartnerOptions = computed(() => {
        const curr = currentUser.value || '';
        return (teamMembers.value || [])
          .filter(m => m.name !== curr && m.email !== curr)
          .map(m => ({
            value: m.name || m.email,
            label: m.full_name || m.name,
            kind: 'User',
            description: m.role || 'Collaborator'
          }));
      });
      const showBlockDrawer = ref(false);
      const activeBlock = ref(null);
      const showBlockReschedule = ref(false);
      const showBlockManualLog = ref(false);
      const sessionForm = ref({ session_date: '', from_time: '', to_time: '', hours: '', notes: '' });

      const fmtHrs = (n) => {
        const v = Math.round((parseFloat(n) || 0) * 100) / 100;
        return (Math.abs(v % 1) < 0.005) ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, '');
      };
      const _mins = (t) => {
        if (!t) return 0;
        const p = String(t).split(':');
        return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
      };
      // Times can arrive unpadded from the stopwatch path (e.g. "7:30:55"), so parse
      // the parts rather than slicing the first 5 chars (which left a dangling colon).
      const hhmm = (t) => {
        if (!t) return '';
        const p = String(t).split(':');
        const h = parseInt(p[0], 10);
        if (Number.isNaN(h)) return '';
        const m = parseInt(p[1], 10) || 0;
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      };
      const _utc = (iso) => _utcDate(iso);
      const _iso = (dt) => getLocalTodayISO(dt);
      const mondayOf = (iso) => { const dow = (_utc(iso).getUTCDay() + 6) % 7; return addDays(iso, -dow); };
      plannerAnchor.value = todayISO();

      // Visible hour window: always the full day, 12a–11p.
      const plannerRange = computed(() => ({ lo: 0, hi: 24 }));
      const plannerHours = computed(() => {
        const arr = [];
        for (let h = plannerRange.value.lo; h < plannerRange.value.hi; h++) arr.push(h);
        return arr;
      });
      const plannerDays = computed(() => {
        if (plannerView.value === 'day') return [plannerAnchor.value];
        // 4 Days view: Today is on the 2nd day (index 1), with Yesterday (index 0), Tomorrow (index 2), and Day-After-Tomorrow (index 3)
        if (plannerView.value === '4days') return Array.from({ length: 4 }, (_, i) => addDays(plannerAnchor.value, i - 1));
        // Rolling 7-Day Week view: Today is on the 3rd day (index 2), with 2 days of past context (indices 0-1) and 4 days ahead (indices 3-6)
        return Array.from({ length: 7 }, (_, i) => addDays(plannerAnchor.value, i - 2));
      });
      const plannerRangeLabel = computed(() => {
        const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
        if (plannerView.value === 'day') return _utc(plannerAnchor.value).toLocaleDateString(undefined, { weekday: 'long', ...opts });
        const d = plannerDays.value;
        if (plannerView.value === '4days') {
          return _utc(d[0]).toLocaleDateString(undefined, opts) + ' – ' + _utc(d[3] || d[d.length - 1]).toLocaleDateString(undefined, opts);
        }
        return _utc(d[0]).toLocaleDateString(undefined, opts) + ' – ' + _utc(d[6] || d[d.length - 1]).toLocaleDateString(undefined, opts);
      });
      const dowLabel = (iso) => _utc(iso).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
      const domLabel = (iso) => _utc(iso).getUTCDate();
      const hourLabel = (h) => (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p');

      // Away blocks for all-day row
      const awayBlocksForDay = (iso) => (plannerData.value.blocks || []).filter(b =>
        b.work_date === iso && b.is_away &&
        (natureFilter.value.length === 0 || natureFilter.value.includes(_blockNature(b))));

      const hasAwayBlocksInView = computed(() =>
        plannerDays.value.some(d => awayBlocksForDay(d).length > 0)
      );

      // Timed segments for day with midnight split and overlapping sub-lane packing
      const timedSegmentsForDay = (iso) => {
        const blocks = plannerData.value.blocks || [];
        const segments = [];

        for (const b of blocks) {
          if (b.is_away) continue;
          if (natureFilter.value.length > 0 && !natureFilter.value.includes(_blockNature(b))) continue;

          const sMins = _mins(b.start_time);
          const eMins = _mins(b.end_time);
          const crossesMidnight = eMins < sMins;

          if (b.work_date === iso) {
            if (crossesMidnight) {
              segments.push({
                key: b.name + '_tail',
                name: b.name,
                is_segment: true,
                segment_type: 'tail',
                start_mins: sMins,
                end_mins: 1440,
                block: b
              });
            } else {
              let end = eMins;
              if (end <= sMins) end = sMins + (parseFloat(b.duration_hours) || 1) * 60;
              segments.push({
                key: b.name,
                name: b.name,
                is_segment: false,
                segment_type: 'full',
                start_mins: sMins,
                end_mins: Math.max(sMins + 15, end),
                block: b
              });
            }
          } else if (addDays(b.work_date, 1) === iso && crossesMidnight) {
            segments.push({
              key: b.name + '_head',
              name: b.name,
              is_segment: true,
              segment_type: 'head',
              start_mins: 0,
              end_mins: Math.max(15, eMins),
              block: b
            });
          }
        }

        if (iso === (todayDate.value || todayISO()) && isTracking.value && startTime.value) {
          const isBoundToExistingSeg = trackerBlockName.value && segments.some(s => s.block && s.block.name === trackerBlockName.value);
          if (!isBoundToExistingSeg) {
            const d = new Date(startTime.value);
            const startISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (startISO === iso) {
              const sMins = d.getHours() * 60 + d.getMinutes();
              const curNow = new Date();
              const curNowMins = curNow.getHours() * 60 + curNow.getMinutes();
              const eMins = Math.max(sMins + 15, curNowMins);
              const liveBlock = {
              name: trackerBlockName.value || 'live_active_session',
              is_live_active: true,
              task_subject: trackerNotes.value || 'Active Work Session',
              work_item_label: trackerNotes.value || 'Active Work Session',
              deliverable_notes: trackerNotes.value || 'Active Running Session',
              start_time: _minToHHMM(sMins),
              end_time: _minToHHMM(eMins),
              duration_hours: ((eMins - sMins) / 60).toFixed(2),
              actual_hours: (trackerSeconds.value / 3600).toFixed(2),
              task_nature: selectedNature.value || '🎯 Planned',
              project: selectedProject.value || '',
              status: 'In Progress'
            };
            segments.push({
              key: 'live_active_session_seg',
              name: liveBlock.name,
              is_segment: false,
              segment_type: 'full',
              start_mins: sMins,
              end_mins: eMins,
              block: liveBlock
            });
            }
          }
        }

        if (!segments.length) return [];

        segments.sort((a, b) => a.start_mins - b.start_mins || (b.end_mins - b.start_mins) - (a.end_mins - a.start_mins));

        const clusters = [];
        let curCluster = [segments[0]];
        let clusterEnd = segments[0].end_mins;

        for (let i = 1; i < segments.length; i++) {
          const seg = segments[i];
          if (seg.start_mins < clusterEnd) {
            curCluster.push(seg);
            clusterEnd = Math.max(clusterEnd, seg.end_mins);
          } else {
            clusters.push(curCluster);
            curCluster = [seg];
            clusterEnd = seg.end_mins;
          }
        }
        if (curCluster.length) clusters.push(curCluster);

        for (const cluster of clusters) {
          const laneEnds = [];
          for (const seg of cluster) {
            let placed = false;
            for (let l = 0; l < laneEnds.length; l++) {
              if (laneEnds[l] <= seg.start_mins) {
                seg.laneIdx = l;
                laneEnds[l] = seg.end_mins;
                placed = true;
                break;
              }
            }
            if (!placed) {
              seg.laneIdx = laneEnds.length;
              laneEnds.push(seg.end_mins);
            }
          }
          const totalLanes = Math.max(1, laneEnds.length);
          for (const seg of cluster) {
            seg.totalLanes = totalLanes;
          }
        }

        return segments;
      };

      const blocksForDay = (iso) => (plannerData.value.blocks || []).filter(b =>
        b.work_date === iso &&
        (natureFilter.value.length === 0 || natureFilter.value.includes(_blockNature(b))));
      const _gridBottomPx = () => plannerHours.value.length * PLANNER_HOUR_PX;
      const blockTop = (b) => {
        const px = (_mins(b.start_time) - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
        return Math.min(Math.max(0, px), Math.max(0, _gridBottomPx() - 22));
      };
      const blockHeight = (b) => {
        let dur = _mins(b.end_time) - _mins(b.start_time);
        if (dur <= 0) dur = (parseFloat(b.duration_hours) || 1) * 60; // crosses midnight / no end
        const px = Math.max(22, dur / 60 * PLANNER_HOUR_PX);
        return Math.min(px, Math.max(22, _gridBottomPx() - blockTop(b))); // never overflow the grid
      };

      const segTop = (seg) => {
        const px = (seg.start_mins - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
        return Math.min(Math.max(0, px), Math.max(0, _gridBottomPx() - 22));
      };
      const segHeight = (seg) => {
        const dur = Math.max(15, seg.end_mins - seg.start_mins);
        const px = Math.max(22, dur / 60 * PLANNER_HOUR_PX);
        return Math.min(px, Math.max(22, _gridBottomPx() - segTop(seg)));
      };
      const segStyle = (seg) => {
        const d = plannerDrag.value;
        const b = seg.block;
        const totalLanes = seg.totalLanes || 1;
        const laneIdx = seg.laneIdx || 0;
        const baseLeft = (laneIdx * 100 / totalLanes);
        const baseWidth = (100 / totalLanes);

        if (d && d.name === b.name && d.moved) {
          const top = (d.curStart - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
          const h = Math.max(22, (d.curEnd - d.curStart) / 60 * PLANNER_HOUR_PX);
          return Object.assign(blockStyle(b), {
            top: top + 'px',
            height: h + 'px',
            left: '2px',
            width: 'calc(100% - 4px)',
            zIndex: 40,
            opacity: '0.92',
            boxShadow: '0 8px 24px rgba(0,0,0,.3)'
          });
        }
        return Object.assign(blockStyle(b), {
          top: segTop(seg) + 'px',
          height: segHeight(seg) + 'px',
          left: 'calc(' + baseLeft + '% + 2px)',
          width: 'calc(' + baseWidth + '% - 4px)'
        });
      };
      const segTimeTitle = (seg) => {
        if (!seg) return '';
        if (seg.from_time && seg.to_time) return hhmm(seg.from_time) + '–' + hhmm(seg.to_time);
        const b = seg.block || seg;
        if (seg.is_segment) {
          if (seg.segment_type === 'tail') return hhmm(b.start_time) + '–24:00 (spans midnight)';
          if (seg.segment_type === 'head') return '00:00–' + hhmm(b.end_time) + ' (cont. from yesterday)';
        }
        return hhmm(b.start_time) + '–' + hhmm(b.end_time);
      };

      // ---- Block visual language ------------------------------------------------
      // Non-working  → dotted border, very light fill (never project-coloured).
      // Planned      → light project tint + solid project border.
      // Logged/done  → solid dark project colour.
      // Past, never logged → project-tinted diagonal hatch (the plan was not followed).
      const PROJECT_HUES = [217, 262, 155, 24, 340, 187, 47, 291, 0, 120];
      const projectHue = (b) => {
        const key = String((b && (b.project || b.project_name)) || 'ad-hoc');
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
        return PROJECT_HUES[Math.abs(hash) % PROJECT_HUES.length];
      };
      const blockVisualState = (b) => {
        if (!b) return 'planned';
        if (b.status === 'Cancelled') return 'cancelled';
        if (b.status === 'Rescheduled') return 'rescheduled';
        if (b.is_away || isNonWorkingNature(b.task_nature)) return 'away';
        if (b.is_live_active || (isTracking.value && trackerBlockName.value === b.name)) return 'recording';
        if (b.status === 'Logged (Partial)') return 'partial';
        if (b.status === 'Logged (Over)') return 'over';
        const logged = parseFloat(b.actual_hours) || 0;
        if (b.status === 'Completed' || b.status === 'Logged (Full)' || logged > 0) return 'logged';
        const today = todayDate.value || todayISO();
        const date = b.work_date || '';
        if (b.status === 'Missed' || (date && date < today)) return 'missed';
        if (date === today) {
          const endMin = _mins(b.end_time);
          if (endMin > 0 && nowMinute.value >= endMin) return 'missed';
        }
        return 'planned';
      };
      // Structural classes only — the colour itself comes from blockStyle() so an
      // arbitrary project hue never depends on a Tailwind class existing.
      const blockClass = (b) => {
        const st = blockVisualState(b);
        if (st === 'cancelled') return 'border-dotted line-through ' + (isDarkMode.value ? 'text-gray-500' : 'text-gray-400');
        if (st === 'rescheduled') return 'border-dashed ' + (isDarkMode.value ? 'text-gray-400 opacity-75' : 'text-gray-600 opacity-80');
        if (st === 'away') return 'border-dotted border-2';
        if (st === 'recording') return 'border-solid text-white ring-2 ring-red-500 ring-offset-1 z-20 shadow-md';
        if (st === 'logged' || st === 'over' || st === 'partial') return 'border-solid text-white';
        if (st === 'missed') return 'border-solid border-dashed';
        return 'border-solid';
      };
      // Day at a glance borrows the planner grid's colour language: the hue says
      // which project, the treatment says which lane. A hollow tinted bar is what
      // was planned; the solid bar beneath it is what was actually logged against
      // that same project, so a short or missing session is visible as bare outline.
      const timelinePlannedStyle = (b) => {
        const h = projectHue(b);
        return isDarkMode.value
          ? { background: `hsl(${h} 45% 18% / .75)`, borderColor: `hsl(${h} 45% 42%)`, color: `hsl(${h} 70% 82%)` }
          : { background: `hsl(${h} 85% 96%)`, borderColor: `hsl(${h} 60% 68%)`, color: `hsl(${h} 55% 30%)` };
      };
      const timelineLoggedStyle = (r) => {
        if (r && r.is_live_active) {
          return {
            background: isDarkMode.value ? '#dc2626' : '#e11d48',
            borderColor: '#ef4444',
            color: '#fff',
            boxShadow: '0 0 10px rgba(225, 29, 72, 0.65)'
          };
        }
        // Time logged where nothing was planned stays rose: that is the one thing
        // the project hue must not be allowed to blend into the rest of the day.
        if (!r.onPlan) return { background: isDarkMode.value ? '#9f1239' : '#e11d48' };
        const h = projectHue(r.block);
        return { background: isDarkMode.value ? `hsl(${h} 55% 40%)` : `hsl(${h} 62% 42%)` };
      };

      const blockStyle = (b) => {
        const st = blockVisualState(b);
        const dark = isDarkMode.value;
        const h = projectHue(b);
        if (st === 'cancelled') {
          return dark
            ? { background: '#1f2937', borderColor: '#374151' }
            : { background: '#f3f4f6', borderColor: '#d1d5db' };
        }
        if (st === 'rescheduled') {
          return dark
            ? { background: 'rgba(51, 65, 85, 0.35)', borderColor: '#64748b', color: '#94a3b8' }
            : { background: 'rgba(241, 245, 249, 0.85)', borderColor: '#94a3b8', color: '#475569' };
        }
        if (st === 'recording') {
          return dark
            ? { background: `hsl(${h} 50% 20% / .9)`, borderColor: '#ef4444', color: '#fff', boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)' }
            : { background: `hsl(${h} 80% 95%)`, borderColor: '#dc2626', color: `hsl(${h} 65% 25%)`, boxShadow: '0 0 10px rgba(220, 38, 38, 0.25)' };
        }
        if (st === 'partial') {
          return dark
            ? { background: `hsl(${h} 50% 28%)`, borderColor: '#f59e0b', color: '#fff' }
            : { background: `hsl(${h} 55% 35%)`, borderColor: '#d97706', color: '#fff' };
        }
        if (st === 'over') {
          return dark
            ? { background: `hsl(270 50% 32%)`, borderColor: '#a855f7', color: '#fff' }
            : { background: `hsl(270 55% 38%)`, borderColor: '#9333ea', color: '#fff' };
        }
        if (st === 'away') {
          // Non-working is deliberately colour-neutral (amber/rose), not project-tinted.
          const hue = String(b.task_nature || '').includes('Absent') ? 0 : 38;
          return dark
            ? { background: `hsl(${hue} 60% 14% / .55)`, borderColor: `hsl(${hue} 50% 40%)`, color: `hsl(${hue} 80% 80%)` }
            : { background: `hsl(${hue} 90% 96%)`, borderColor: `hsl(${hue} 70% 70%)`, color: `hsl(${hue} 60% 30%)` };
        }
        if (st === 'logged') {
          return dark
            ? { background: `hsl(${h} 55% 34%)`, borderColor: `hsl(${h} 60% 46%)`, color: '#fff' }
            : { background: `hsl(${h} 62% 40%)`, borderColor: `hsl(${h} 65% 30%)`, color: '#fff' };
        }
        if (st === 'missed') {
          // The hatch must read as texture behind the text, never compete with it:
          // thin, low-contrast stripes on a light base.
          const stripe = dark ? `hsl(${h} 35% 55% / .18)` : `hsl(${h} 45% 45% / .14)`;
          const base = dark ? `hsl(${h} 30% 15%)` : `hsl(${h} 70% 98%)`;
          return {
            backgroundColor: base,
            backgroundImage: `repeating-linear-gradient(45deg, ${stripe} 0 2px, transparent 2px 10px)`,
            borderColor: dark ? `hsl(${h} 40% 45%)` : `hsl(${h} 45% 65%)`,
            color: dark ? `hsl(${h} 55% 82%)` : `hsl(${h} 60% 28%)`
          };
        }
        return dark
          ? { background: `hsl(${h} 50% 18%)`, borderColor: `hsl(${h} 55% 45%)`, color: `hsl(${h} 70% 85%)` }
          : { background: `hsl(${h} 90% 95%)`, borderColor: `hsl(${h} 60% 55%)`, color: `hsl(${h} 60% 30%)` };
      };

      // ---- Past is read-only ----------------------------------------------------
      // History should not be rewritten by a stray drag: anything that already
      // happened is locked, only now-and-later can be moved or booked.
      const isPastSlot = (iso, endMin) => {
        const today = todayDate.value || todayISO();
        if (!iso) return false;
        if (iso < today) return true;
        if (iso > today) return false;
        return (endMin || 0) <= nowMinute.value;
      };
      const yesterdayDate = computed(() => addDays(todayDate.value || todayISO(), -1));
      const pastBlockGraceHours = computed(() => {
        return (plannerData.value && plannerData.value.past_block_lock_grace_hours != null)
          ? Number(plannerData.value.past_block_lock_grace_hours)
          : 24;
      });
      const timesheetHorizonHours = computed(() => {
        return (plannerData.value && plannerData.value.timesheet_modification_horizon_hours != null)
          ? Number(plannerData.value.timesheet_modification_horizon_hours)
          : 48;
      });

      const isPastBlock = (b) => {
        if (!b || !b.work_date) return false;
        const grace = pastBlockGraceHours.value;
        const endT = b.end_time || '23:59:59';
        const parts = b.work_date.split('-');
        if (parts.length < 3) return false;
        const timeParts = endT.split(':');
        const blockDt = new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10),
          parseInt(timeParts[0] || '23', 10),
          parseInt(timeParts[1] || '59', 10),
          parseInt(timeParts[2] || '59', 10)
        );
        const now = new Date();
        const diffHours = (now.getTime() - blockDt.getTime()) / (1000 * 60 * 60);
        return diffHours > grace;
      };

      const canLogTimesheet = (b) => {
        if (!b) return false;
        if (isManager.value) return true;
        const horizon = timesheetHorizonHours.value;
        const dtStr = b.work_date || todayDate.value || todayISO();
        const parts = dtStr.split('-');
        if (parts.length < 3) return true;
        const blockDt = new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10),
          23, 59, 59
        );
        const now = new Date();
        const diffHours = (now.getTime() - blockDt.getTime()) / (1000 * 60 * 60);
        return diffHours <= horizon;
      };
      const isBlockLocked = (b) => {
        if (!b) return false;
        let e = _mins(b.end_time);
        if (!(e > 0)) e = _mins(b.start_time);
        return isPastSlot(b.work_date, e);
      };

      // ---- Hover card: read a block without opening the drawer ------------------
      const STATE_TEXT = {
        planned: 'Planned — not started',
        logged: 'Time logged',
        missed: 'Past · no time logged',
        away: 'Non-working',
        cancelled: 'Cancelled'
      };
      let _hoverCardTimer = null;
      const hoverCard = ref(null);
      const cancelHideHover = () => {
        if (_hoverCardTimer) {
          clearTimeout(_hoverCardTimer);
          _hoverCardTimer = null;
        }
      };
      const hideBlockHover = (immediate = false) => {
        cancelHideHover();
        if (immediate === true) {
          hoverCard.value = null;
          return;
        }
        _hoverCardTimer = setTimeout(() => {
          hoverCard.value = null;
        }, 160);
      };
      const hideBlockHoverNow = () => hideBlockHover(true);
      const showBlockHover = (ev, seg, source) => {
        if (plannerDrag.value || slotSel.value) return;
        cancelHideHover();
        const b = (seg && seg.block) || seg;
        if (!b) return;
        const r = ev.currentTarget.getBoundingClientRect();
        const CARD_EST_HEIGHT = 85;
        const spaceBelow = window.innerHeight - r.bottom;
        // Never position on top of the card! Place below if there is room, otherwise above
        const placeBelow = spaceBelow >= CARD_EST_HEIGHT + 16 || spaceBelow >= r.top;
        const top = placeBelow
          ? Math.min(r.bottom + 8, window.innerHeight - CARD_EST_HEIGHT - 10)
          : Math.max(10, r.top - CARD_EST_HEIGHT - 8);

        hoverCard.value = {
          block: b,
          seg: seg,
          source: source || 'planner',
          state: source === 'logged' ? 'logged' : blockVisualState(b),
          // Fixed-position so the scroll container cannot clip it; flipped when it
          // would run off the right edge.
          left: Math.max(10, Math.min(r.left, window.innerWidth - 280)),
          top: Math.round(top)
        };
      };
      const hoverStateText = computed(() => {
        const hc = hoverCard.value;
        return hc ? (STATE_TEXT[hc.state] || hc.state) : '';
      });

      // ---- Drag to reschedule / resize a block ---------------------------------
      const SNAP_MIN = 15;
      const plannerDrag = ref(null);
      const _blockDragEndedAt = ref(0);
      const _snap = (m) => Math.round(m / SNAP_MIN) * SNAP_MIN;
      const _minsToHHMM = (m) => {
        m = ((_snap(m) % 1440) + 1440) % 1440;
        return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      };
      const dragStyle = (b) => {
        const d = plannerDrag.value;
        if (d && d.name === b.name && d.moved) {
          const top = (d.curStart - plannerRange.value.lo * 60) / 60 * PLANNER_HOUR_PX;
          const h = Math.max(22, (d.curEnd - d.curStart) / 60 * PLANNER_HOUR_PX);
          return Object.assign(blockStyle(b), { top: top + 'px', height: h + 'px', zIndex: 40, opacity: '0.9', boxShadow: '0 8px 24px rgba(0,0,0,.25)' });
        }
        return Object.assign(blockStyle(b), { top: blockTop(b) + 'px', height: blockHeight(b) + 'px' });
      };
      const dragTimeLabel = (target) => {
        const d = plannerDrag.value;
        const b = target.block || target;
        if (d && d.name === b.name && d.moved) return _minsToHHMM(d.curStart) + '–' + _minsToHHMM(d.curEnd);
        if (target.is_segment) {
          if (target.segment_type === 'tail') return hhmm(b.start_time) + '–24:00';
          if (target.segment_type === 'head') return '00:00–' + hhmm(b.end_time);
        }
        return hhmm(b.start_time) + '–' + hhmm(b.end_time);
      };
      const onBlockDragMove = (ev) => {
        const d = plannerDrag.value; if (!d) return;
        const dy = ev.clientY - d.startY;
        const dx = ev.clientX - d.startX;
        if (!d.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) d.moved = true;
        const dMin = _snap(dy / PLANNER_HOUR_PX * 60);
        const dur = d.origEnd - d.origStart;
        if (d.mode === 'move') {
          let ns = Math.max(0, Math.min(1440 - dur, d.origStart + dMin));
          d.curStart = ns; d.curEnd = ns + dur;
          if ((plannerView.value === 'week' || plannerView.value === '4days') && d.colW > 0) {
            const dCol = Math.round(dx / d.colW);
            d.curDayIdx = Math.max(0, Math.min(plannerDays.value.length - 1, d.origDayIdx + dCol));
          }
        } else if (d.mode === 'resize-start') {
          d.curStart = Math.min(d.origEnd - SNAP_MIN, Math.max(0, d.origStart + dMin));
        } else {
          d.curEnd = Math.max(d.origStart + SNAP_MIN, Math.min(1440, d.origEnd + dMin));
        }
      };
      // `ev` is the event that ended the gesture. A pointercancel means the browser
      // took the pointer away (a system gesture, a palm, the page scrolling) — that is
      // an abort, never a reschedule, so the block must snap back unsaved.
      const endBlockDrag = async (ev) => {
        window.removeEventListener('pointermove', onBlockDragMove);
        window.removeEventListener('pointerup', endBlockDrag);
        window.removeEventListener('pointercancel', endBlockDrag);
        const d = plannerDrag.value;
        plannerDrag.value = null;
        holdArmed.value = '';
        if (d && d.el && d.el.style) d.el.style.touchAction = '';
        if (ev && ev.type === 'pointercancel') return;
        if (!d || !d.moved) return;
        _blockDragEndedAt.value = Date.now();
        const changed = d.curStart !== d.origStart || d.curEnd !== d.origEnd || d.curDayIdx !== d.origDayIdx;
        if (!changed) return;
        try {
          await postJSON('reschedule_work_block', {
            block_name: d.name,
            new_date: plannerDays.value[d.curDayIdx],
            new_start_time: _minsToHHMM(d.curStart),
            new_end_time: _minsToHHMM(d.curEnd),
          });
          await fetchPlannerData();
        } catch (e) {
          await fetchPlannerData();
          alert('Could not reschedule block: ' + (e && e.message || e));
        }
      };
      // ---- Press and hold to grab -------------------------------------------
      // A finger on a block is far more often a scroll than a reschedule, and the
      // same is true of a stray mouse-down. Nothing moves until the pointer has been
      // held still for a moment; any movement before that is left to the scroller.
      const HOLD_TOUCH_MS = 400;
      const HOLD_MOUSE_MS = 200;
      const HOLD_SLOP_PX = 8;
      const holdArmed = ref('');            // name of the block currently grabbed
      let _pendingHold = null;
      const _pendingMove = (ev) => {
        if (!_pendingHold) return;
        if (Math.abs(ev.clientX - _pendingHold.x) > HOLD_SLOP_PX ||
            Math.abs(ev.clientY - _pendingHold.y) > HOLD_SLOP_PX) _cancelHold();
      };
      const _cancelHold = () => {
        if (!_pendingHold) return;
        clearTimeout(_pendingHold.timer);
        _pendingHold = null;
        window.removeEventListener('pointermove', _pendingMove);
        window.removeEventListener('pointerup', _cancelHold);
        window.removeEventListener('pointercancel', _cancelHold);
      };
      // Arms `run` once the pointer has been held still long enough.
      const _armOnHold = (ev, run) => {
        _cancelHold();
        const hold = ev.pointerType === 'touch' ? HOLD_TOUCH_MS : HOLD_MOUSE_MS;
        const x = ev.clientX, y = ev.clientY;
        _pendingHold = { x, y, timer: null };
        _pendingHold.timer = setTimeout(() => {
          _pendingHold = null;
          window.removeEventListener('pointermove', _pendingMove);
          window.removeEventListener('pointerup', _cancelHold);
          window.removeEventListener('pointercancel', _cancelHold);
          run(x, y);
        }, hold);
        window.addEventListener('pointermove', _pendingMove);
        window.addEventListener('pointerup', _cancelHold);
        window.addEventListener('pointercancel', _cancelHold);
      };

      const startBlockDrag = (ev, b, mode) => {
        if (b.status === 'Cancelled') return;
        if (isBlockLocked(b)) return;   // the past is read-only
        if (ev.button !== undefined && ev.button !== 0) return;
        const el = ev.currentTarget;
        const col = el.closest && el.closest('[data-day-col]');
        const pid = ev.pointerId;
        _armOnHold(ev, (x, y) => _beginBlockDrag(b, mode, x, y, el, col, pid));
      };

      const _beginBlockDrag = (b, mode, x, y, el, col, pid) => {
        const s = _mins(b.start_time);
        let e = _mins(b.end_time);
        if (e <= s) e = s + (parseFloat(b.duration_hours) || 1) * 60;
        const idx = plannerDays.value.indexOf(b.work_date);
        hideBlockHover();
        triggerHaptic([25]);
        holdArmed.value = b.name;
        // Only now does the element stop belonging to the scroller.
        const holder = (el && el.closest && el.closest('button')) || el;
        if (holder && holder.style) holder.style.touchAction = 'none';
        try { if (holder && pid !== undefined && holder.setPointerCapture) holder.setPointerCapture(pid); } catch (err) {}
        plannerDrag.value = {
          name: b.name, mode, el: holder,
          startX: x, startY: y,
          colW: col ? col.getBoundingClientRect().width : 0,
          origStart: s, origEnd: e, origDayIdx: idx,
          curStart: s, curEnd: e, curDayIdx: idx, moved: false,
        };
        window.addEventListener('pointermove', onBlockDragMove);
        window.addEventListener('pointerup', endBlockDrag, { once: true });
        window.addEventListener('pointercancel', endBlockDrag, { once: true });
      };
      const onBlockClick = (b) => {
        if (Date.now() - _blockDragEndedAt.value < 300) return; // just finished a drag
        openBlockDrawer(b);
      };

      const fetchPlannerData = async () => {
        try {
          const days = plannerDays.value;
          const sDate = days[0] || plannerAnchor.value;
          const eDate = days[days.length - 1] || plannerAnchor.value;
          const ws = days[0] || plannerAnchor.value;
          const empParam = selectedEmployee.value ? `&employee=${encodeURIComponent(selectedEmployee.value)}` : '';
          const url = `/api/method/omnitrack.api.get_planner_data?week_start=${ws}&start_date=${sDate}&end_date=${eDate}${empParam}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data && data.message) {
            plannerData.value = data.message;
            if (data.message.assigned_tasks) assignedTasks.value = data.message.assigned_tasks;
            if (data.message.attention_tasks) attentionTasks.value = data.message.attention_tasks;
          }
        } catch (e) { console.error('planner fetch', e); }
      };

      const plannerShift = (dir) => {
        const delta = plannerView.value === 'day' ? 1 : (plannerView.value === '4days' ? 4 : 7);
        plannerAnchor.value = addDays(plannerAnchor.value, dir * delta);
        fetchPlannerData();
      };
      const plannerToday = () => { plannerAnchor.value = todayISO(); fetchPlannerData(); };
      watch(plannerView, () => fetchPlannerData());

      // Day and 4-day views can land on an empty day while the week around them is
      // full, which reads as "the planner is broken". Say it is empty, and offer the
      // nearest day that actually has work (the fetch already returns the week).
      const visibleBlockCount = computed(() => plannerDays.value.reduce(
        (n, d) => n + (plannerData.value.blocks || []).filter(b => b.work_date === d).length, 0));
      const nearestDayWithWork = computed(() => {
        if (visibleBlockCount.value) return '';
        const dates = [...new Set((plannerData.value.blocks || []).map(b => b.work_date).filter(Boolean))];
        if (!dates.length) return '';
        const a = plannerAnchor.value;
        const dist = (d) => Math.abs(_utc(d).getTime() - _utc(a).getTime());
        return dates.sort((x, y) => dist(x) - dist(y))[0];
      });
      const nearestDayWithWorkLabel = computed(() => nearestDayWithWork.value
        ? _utc(nearestDayWithWork.value).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
        : '');
      const jumpToDayWithWork = () => {
        if (!nearestDayWithWork.value) return;
        plannerAnchor.value = nearestDayWithWork.value;
        fetchPlannerData();
      };

      const pickTask = (t) => { pickedTask.value = (pickedTask.value && pickedTask.value.ref === t.ref) ? null : t; };

      // --- drag across the grid to select a multi-hour range -------------------
      // A plain click still books a single hour; dragging sets the whole span.
      const SLOT_SNAP_MIN = 15;
      const slotSel = ref(null);
      let _slotSelEndedAt = 0;

      const _snapMin = (m) => Math.round(m / SLOT_SNAP_MIN) * SLOT_SNAP_MIN;
      const _minFromPointer = (colEl, clientY) => {
        const r = colEl.getBoundingClientRect();
        const span = plannerHours.value.length * 60;
        const lo = plannerRange.value.lo * 60;
        const raw = lo + ((clientY - r.top) / (r.height || 1)) * span;
        return Math.max(lo, Math.min(lo + span, raw));
      };
      const slotSelRange = computed(() => {
        const s = slotSel.value;
        if (!s) return null;
        let a = Math.min(s.startMin, s.curMin);
        let b = Math.max(s.startMin, s.curMin);
        if (b - a < SLOT_SNAP_MIN) b = a + SLOT_SNAP_MIN;
        return { start: a, end: b };
      });
      const slotSelStyle = computed(() => {
        const r = slotSelRange.value;
        if (!r) return {};
        const lo = plannerRange.value.lo * 60;
        return { top: ((r.start - lo) / 60 * 44) + 'px', height: (((r.end - r.start) / 60) * 44) + 'px' };
      });
      const slotSelLabel = computed(() => {
        const r = slotSelRange.value;
        if (!r) return '';
        return _minToHHMM(r.start) + '–' + _minToHHMM(r.end);
      });

      const onSlotSelectMove = (ev) => {
        const s = slotSel.value;
        if (!s) return;
        if (Math.abs(ev.clientY - s.y0) > 4) s.moved = true;
        slotSel.value = { ...s, curMin: _snapMin(_minFromPointer(s.colEl, ev.clientY)) };
      };
      // Same rule as endBlockDrag: a cancelled pointer discards the range, it does
      // not open the booking modal behind the user's back.
      const endSlotSelect = (ev) => {
        window.removeEventListener('pointermove', onSlotSelectMove);
        window.removeEventListener('pointerup', endSlotSelect);
        window.removeEventListener('pointercancel', endSlotSelect);
        const s = slotSel.value;
        if (s && s.rowEl && s.rowEl.style) s.rowEl.style.touchAction = '';
        const range = slotSelRange.value;
        slotSel.value = null;
        if (ev && ev.type === 'pointercancel') return;
        if (!s || !s.moved || !range) return;   // no drag → let @click book the single hour
        _slotSelEndedAt = Date.now();
        openBookModalRange(s.iso, range.start, range.end);
      };
      const startSlotSelect = (ev, iso) => {
        if (ev.button !== undefined && ev.button !== 0) return;
        const row = ev.currentTarget;
        const colEl = row.closest && row.closest('[data-day-col]');
        if (!colEl) return;
        // Same rule as blocks: a swipe across the grid scrolls, a held pointer draws
        // a time range. A plain tap still books the single hour via @click.
        _armOnHold(ev, (x, y) => {
          const m = _snapMin(_minFromPointer(colEl, y));
          triggerHaptic([25]);
          if (row && row.style) row.style.touchAction = 'none';
          slotSel.value = { iso, colEl, rowEl: row, startMin: m, curMin: m, moved: false, y0: y };
          window.addEventListener('pointermove', onSlotSelectMove);
          window.addEventListener('pointerup', endSlotSelect, { once: true });
          window.addEventListener('pointercancel', endSlotSelect, { once: true });
        });
      };

      // --- Google-Calendar style "now" line ------------------------------------
      let _nowTimer = null;
      const startNowClock = () => {
        if (_nowTimer) return;
        _nowTimer = setInterval(() => {
          const n = new Date();
          nowMinute.value = n.getHours() * 60 + n.getMinutes();
        }, 30000);
      };
      const nowLineTop = computed(() => {
        const lo = plannerRange.value.lo * 60;
        return ((nowMinute.value - lo) / 60) * 44;
      });
      const nowLineLabel = computed(() => _minToHHMM(nowMinute.value));
      const isTodayCol = (iso) => iso === (todayDate.value || todayISO());
      // Away days are all-day records, but drawing them over the full 24h buries the
      // grid; office hours is what a viewer actually needs blocked out.
      const _loadOffice = (key, fallback) => {
        try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
      };
      const plannerViewOrder = ['day', '4days', 'week'];
      // Segmented control = one tab stop; ←/→ move the selection (WAI-ARIA radiogroup).
      const onPlannerViewKey = (ev) => {
        const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
        if (keys.indexOf(ev.key) === -1) return;
        ev.preventDefault();
        const cur = Math.max(0, plannerViewOrder.indexOf(plannerView.value));
        let next = cur;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = (cur + 1) % plannerViewOrder.length;
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = (cur - 1 + plannerViewOrder.length) % plannerViewOrder.length;
        else if (ev.key === 'Home') next = 0;
        else next = plannerViewOrder.length - 1;
        setUserPlannerView(plannerViewOrder[next]);
        nextTick(() => {
          const group = ev.currentTarget;
          const btns = group && group.querySelectorAll ? group.querySelectorAll('[data-planner-view]') : [];
          if (btns[next]) btns[next].focus();
        });
      };
      const officeStart = ref(_loadOffice('omnitrack_office_start', '10:00'));
      const officeEnd = ref(_loadOffice('omnitrack_office_end', '18:00'));
      watch([officeStart, officeEnd], () => {
        try {
          localStorage.setItem('omnitrack_office_start', officeStart.value);
          localStorage.setItem('omnitrack_office_end', officeEnd.value);
        } catch (e) { /* private mode: keep the session value only */ }
      });
      const officeBandStyle = computed(() => {
        const lo = plannerRange.value.lo * 60;
        let a = _mins(officeStart.value);
        let b = _mins(officeEnd.value);
        if (!(b > a)) { a = 10 * 60; b = 18 * 60; }
        return {
          top: (((a - lo) / 60) * 44) + 'px',
          height: (((b - a) / 60) * 44) + 'px'
        };
      });
      // Touch: a horizontal swipe across the grid moves a period, the way a phone
      // calendar behaves. Vertical pans stay with the scroller (cells are touch-pan-y).
      const _swipe = { x: 0, y: 0, t: 0, ok: false };
      const onPlannerTouchStart = (ev) => {
        const t = ev.touches && ev.touches.length === 1 ? ev.touches[0] : null;
        _swipe.ok = !!t;
        if (!t) return;
        _swipe.x = t.clientX; _swipe.y = t.clientY; _swipe.t = Date.now();
      };
      const onPlannerTouchEnd = (ev) => {
        if (!_swipe.ok) return;
        _swipe.ok = false;
        const t = ev.changedTouches && ev.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - _swipe.x;
        const dy = t.clientY - _swipe.y;
        if (Date.now() - _swipe.t > 700) return;
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
        if (slotSel.value || plannerDrag.value) return;
        plannerShift(dx < 0 ? 1 : -1);
      };

      // Office bounds as two hairlines on the grid; the old banner ate a whole row.
      const officeMarks = computed(() => {
        const lo = plannerRange.value.lo * 60;
        let a = _mins(officeStart.value);
        let b = _mins(officeEnd.value);
        if (!(b > a)) { a = 10 * 60; b = 18 * 60; }
        return [
          { kind: 'start', top: (((a - lo) / 60) * 44) + 'px', title: 'Office starts ' + _minToHHMM(a) },
          { kind: 'end', top: (((b - lo) / 60) * 44) + 'px', title: 'Office ends ' + _minToHHMM(b) }
        ];
      });
      const isPastCol = (iso) => iso < (todayDate.value || todayISO());
      // How much of a column is in the past: whole column for past days, up to the
      // now-line for today, nothing for the future. Shaded so booking in the past
      // looks wrong before the user clicks.
      const pastShadeStyle = (iso) => {
        const today = todayDate.value || todayISO();
        const full = plannerHours.value.length * 44;
        if (iso < today) return { top: '0px', height: full + 'px' };
        if (iso === today) return { top: '0px', height: Math.max(0, Math.min(full, nowLineTop.value)) + 'px' };
        return { display: 'none' };
      };

      const bookFormTask = computed(() => {
        const ref = bookForm.value && bookForm.value.work_item;
        if (!ref) return null;
        const list = (plannerData.value && plannerData.value.assigned_tasks) || [];
        return list.find((t) => t.ref === ref) || null;
      });

      const pastBookingHint = ref('');
      const _rejectPast = (iso, endMin) => {
        if (!isPastSlot(iso, endMin)) return false;
        pastBookingHint.value = 'That slot is in the past — work blocks can only be booked from now on.';
        setTimeout(() => { pastBookingHint.value = ''; }, 3500);
        return true;
      };

      const openBookModalRange = (iso, startMin, endMin) => {
        if (_rejectPast(iso, endMin)) return;
        const defaultAssignee = (isManager.value && selectedEmployee.value && selectedEmployee.value !== 'All') ? selectedEmployee.value : '';
        bookForm.value = {
          mode: 'work',
          work_item: pickedTask.value ? pickedTask.value.ref : '',
          work_date: iso,
          start_time: _minToHHMM(startMin),
          end_time: _minToHHMM(endMin),
          deliverable_notes: '',
          pairing_partner: '',
          assigned_employee: defaultAssignee
        };
        showBookModal.value = true;
      };

      const openBookModal = (iso, hour) => {
        if (Date.now() - _slotSelEndedAt < 300) return; // a range drag just ended
        if (_rejectPast(iso, (hour + 1) * 60)) return;
        const hh = String(hour).padStart(2, '0');
        const defaultAssignee = (isManager.value && selectedEmployee.value && selectedEmployee.value !== 'All') ? selectedEmployee.value : '';
        bookForm.value = {
          mode: 'work',
          work_item: pickedTask.value ? pickedTask.value.ref : '',
          work_date: iso,
          start_time: hh + ':00',
          end_time: String(Math.min(23, hour + 1)).padStart(2, '0') + ':00',
          deliverable_notes: '',
          pairing_partner: '',
          assigned_employee: defaultAssignee
        };
        showBookModal.value = true;
      };

      const submitBooking = async () => {
        await workBlockStore.submitBooking();
        if (!showBookModal.value) {
          pickedTask.value = null;
        }
      };

      const generateTimesheet = async (block) => {
        if (!block || !block.name) return;
        plannerBusy.value = true;
        try {
          const res = await postJSON('create_timesheet_from_work_block', { block_name: block.name, force: true });
          const tsName = res && (res.message || res.name || res);
          showToast(`Timesheet ${tsName || ''} created for Project ${block.project_name || block.project || ''}`, 'success');
          await fetchPlannerData();
          const refreshed = (plannerData.value.blocks || []).find(x => x.name === block.name);
          if (refreshed) activeBlock.value = refreshed;
        } catch (e) {
          showToast('Could not generate timesheet: ' + (e && e.message || e), 'danger');
        } finally {
          plannerBusy.value = false;
        }
      };

      const rescheduleForm = ref({ work_date: '', start_time: '', end_time: '' });

      // Collaboration Drawer actions delegated to collaborationStore
      const openTaskDetails = (task) => {
        openTaskRavenDrawer(task, 'details');
      };

      const taskConnectedBlocks = (task) => {
        if (!task) return [];
        const taskId = task.name || task.ref || task.id;
        const blocks = (plannerData.value && plannerData.value.blocks) || [];
        const found = blocks.filter(b => b.task === taskId || (b.task_subject && b.task_subject === task.subject));
        if (task.connected_blocks && Array.isArray(task.connected_blocks)) {
          task.connected_blocks.forEach(cb => {
            if (!found.some(f => f.name === cb.name)) found.push(cb);
          });
        }
        return found;
      };

      const pinRavenMessage = async (m) => {
        const taskId = ravenTask.value && (ravenTask.value.name || ravenTask.value.ref || ravenTask.value.id);
        if (!m || !taskId) return;
        try {
          const res = await postJSON('pin_task_spec', { task_id: taskId, message_id: m.name });
          if (res && res.status === 'success') {
            showToast('Pinned to living specification!', 'success');
            if (res.spec) {
              ravenTaskSpec.value = res.spec;
            }
          }
        } catch (e) {
          showToast('Failed to pin to spec: ' + (e && e.message || e), 'danger');
        }
      };

      const saveRavenTaskSpec = async () => {
        const taskId = ravenTask.value && (ravenTask.value.name || ravenTask.value.ref || ravenTask.value.id);
        if (!taskId || ravenSavingSpec.value) return;
        ravenSavingSpec.value = true;
        try {
          const res = await fetch('/api/method/frappe.client.set_value', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Frappe-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
              doctype: 'Task',
              name: taskId,
              fieldname: 'description',
              value: ravenTaskSpec.value
            })
          });
          if (res.ok) {
            showToast('Specification saved successfully!', 'success');
            if (ravenTask.value) {
              ravenTask.value.description = ravenTaskSpec.value;
            }
          } else {
            throw new Error('Save failed');
          }
        } catch (e) {
          showToast('Failed to save spec: ' + (e && e.message || e), 'danger');
        } finally {
          ravenSavingSpec.value = false;
        }
      };

      // ---- Focus Tasks & Connected Deliverables ----
      const showAttachTasksBox = ref(false);
      const newTaskPasteText = ref('');
      const selectedTaskToAttach = ref('');
      const isAttachingTasks = ref(false);
      const isReschedulingTasks = ref(false);

      const isTaskDone = (t) => {
        return Boolean(t && (t.status === 'Completed' || t.status === 'Closed'));
      };

      const getBlockTasksDoneCount = (b) => {
        if (!b || !b.connected_tasks || !Array.isArray(b.connected_tasks)) return 0;
        return b.connected_tasks.filter(isTaskDone).length;
      };

      const isBlockTasksAllCompleted = (b) => {
        if (!b || !b.connected_tasks || !b.connected_tasks.length) return false;
        return b.connected_tasks.every(isTaskDone);
      };

      const getUnfinishedTasksCount = (b) => {
        if (!b || !b.connected_tasks || !Array.isArray(b.connected_tasks)) return 0;
        return b.connected_tasks.filter(t => !isTaskDone(t) && t.status !== 'Rescheduled').length;
      };

      const availableUnattachedTasks = computed(() => {
        if (!activeBlock.value) return [];
        const attachedRefs = new Set((activeBlock.value.connected_tasks || []).map(t => t.ref || t.id));
        const allAssigned = assignedTasks.value || [];
        return allAssigned.filter(t => !attachedRefs.has(t.ref || t.id));
      });

      const comboboxTaskOptions = computed(() => {
        return (availableUnattachedTasks.value || []).map(t => ({
          value: t.ref || t.id,
          label: t.subject || t.title || t.ref || t.id,
          kind: t.kind || (t.doctype === 'ToDo' ? 'ToDo' : 'Task'),
          project: t.project_name || t.project || ''
        }));
      });

      const comboboxBookTaskOptions = computed(() => {
        const list = (plannerData.value && plannerData.value.assigned_tasks) || [];
        return list.map(t => ({
          value: t.ref,
          label: t.subject || t.ref,
          kind: 'Task',
          project: t.project_name || t.project || '',
          description: t.status ? `Status: ${t.status}` : '',
          priority: t.priority,
          due_date: t.due_date,
          status: t.status,
          booked_hours: t.booked_hours
        }));
      });

      const comboboxAssigneeOptions = computed(() => {
        return (teamMembers.value || []).map(m => ({
          value: m.name || m.full_name,
          label: m.full_name,
          description: m.role || 'Team Member'
        }));
      });

      const comboboxProjectOptions = computed(() => {
        const list = (projects.value || []).map(p => ({
          value: p.name,
          label: p.project_name || p.name
        }));
        return [{ value: '', label: 'General Work' }, ...list];
      });

      const formatTaskTime = (dtStr) => {
        if (!dtStr) return '';
        try {
          const parts = dtStr.split(' ');
          if (parts.length > 1) {
            return parts[1].substring(0, 5);
          }
          return dtStr;
        } catch (e) {
          return dtStr;
        }
      };

      const toggleTaskDone = async (block, item) => {
        if (!block || !item) return;
        const willBeDone = !isTaskDone(item);
        item.status = willBeDone ? (item.doctype === 'ToDo' ? 'Closed' : 'Completed') : 'Open';
        item.completed_at = willBeDone ? new Date().toISOString() : null;

        // If actively tracking, append accomplishment to sessionNotesList and sync session
        if (willBeDone) {
          const accomplishment = `✓ Completed: ${item.subject || item.title || item.task}`;
          if (!sessionNotesList.value.includes(accomplishment)) {
            sessionNotesList.value.push(accomplishment);
            syncActiveSession();
          }
        }

        try {
          const res = await postJSON('complete_block_task', {
            block_name: block.name,
            task_ref: item.ref || item.id,
            completed: willBeDone ? 1 : 0
          });
          if (res && res.tasks && block) {
            block.connected_tasks = res.tasks;
          }
          showToast(willBeDone ? 'Task marked completed' : 'Task reopened', 'success');
        } catch (e) {
          showToast('Could not update task: ' + (e && e.message || e), 'danger');
        }
      };

      const submitAttachTasks = async (block) => {
        if (!block) return;
        isAttachingTasks.value = true;
        try {
          const taskRefs = selectedTaskToAttach.value ? [selectedTaskToAttach.value] : [];
          const res = await postJSON('attach_tasks_to_block', {
            block_name: block.name,
            task_refs: taskRefs.length ? taskRefs : null,
            new_task_subjects: newTaskPasteText.value.trim() ? newTaskPasteText.value.trim() : null
          });
          if (res && res.tasks) {
            block.connected_tasks = res.tasks;
          }
          showToast('Tasks attached to block', 'success');
          newTaskPasteText.value = '';
          selectedTaskToAttach.value = '';
          showAttachTasksBox.value = false;
        } catch (e) {
          showToast('Could not attach tasks: ' + (e && e.message || e), 'danger');
        } finally {
          isAttachingTasks.value = false;
        }
      };

      const carryForwardUnfinished = async (block) => {
        if (!block) return;
        isReschedulingTasks.value = true;
        try {
          const res = await postJSON('reschedule_unfinished_tasks', {
            block_name: block.name
          });
          if (res && res.status === 'success') {
            showToast(`Carried forward ${res.rescheduled_count} items to next block (${res.new_block})`, 'success');
            await fetchWorkstationData();
            if (activeTab.value === 'planner') await fetchPlannerData();
            if (block.connected_tasks) {
              block.connected_tasks.forEach(t => {
                if (!isTaskDone(t)) {
                  t.status = 'Rescheduled';
                  t.rescheduled_to = res.new_block;
                }
              });
            }
          } else {
            showToast((res && res.message) || 'No unfinished items to carry forward', 'info');
          }
        } catch (e) {
          showToast('Could not carry forward tasks: ' + (e && e.message || e), 'danger');
        } finally {
          isReschedulingTasks.value = false;
        }
      };

      const openBlockDrawer = (b) => {
        hideBlockHover();
        activeBlock.value = b;
        showBlockReschedule.value = false;
        showBlockManualLog.value = false;
        showAttachTasksBox.value = false;
        newTaskPasteText.value = '';
        selectedTaskToAttach.value = '';
        sessionForm.value = { session_date: b.work_date, from_time: '', to_time: '', hours: '', notes: '' };
        rescheduleForm.value = { work_date: b.work_date || '', start_time: hhmm(b.start_time) || '', end_time: hhmm(b.end_time) || '' };
        drawerChatInput.value = '';
        fetchDrawerChat(b.task || b.name);
        showBlockDrawer.value = true;
      };

      // Same endpoint the planner drag uses — typed instead of dragged, for the
      // dashboard row where there is no grid to drag on.
      const submitReschedule = async () => {
        await workBlockStore.submitReschedule();
      };

      const submitSession = async () => {
        if (!activeBlock.value) return;
        const f = sessionForm.value;
        const targetDate = f.session_date || activeBlock.value.work_date || todayDate.value;
        if (!isManager.value && targetDate < yesterdayDate.value) {
          showToast('OmniTrack Users can only log or modify timesheets for today and yesterday. Contact a Manager for earlier dates.', 'warning');
          return;
        }
        if (!f.hours && !(f.from_time && f.to_time)) { showToast('Enter hours or a from/to time', 'danger'); return; }
        if (String(f.notes || '').trim().length < 3) { showToast('Describe what you did in the notes — a session with no description cannot be read by a manager or a client.', 'danger'); return; }
        plannerBusy.value = true;
        try {
          await postJSON('log_work_session', {
            block_name: activeBlock.value.name,
            session_date: f.session_date || activeBlock.value.work_date,
            from_time: f.from_time || null,
            to_time: f.to_time || null,
            hours: f.hours || null,
            notes: f.notes || null
          });
          showToast('Session logged', 'success');
          await fetchPlannerData();
          const refreshed = (plannerData.value.blocks || []).find(x => x.name === activeBlock.value.name);
          if (refreshed) activeBlock.value = refreshed;
          sessionForm.value = { session_date: activeBlock.value.work_date, from_time: '', to_time: '', hours: '', notes: '' };
        } catch (e) { showToast('Could not log session: ' + (e && e.message || e), 'danger'); }
        finally { plannerBusy.value = false; }
      };

      // Structured Block Cancellation & No-Show delegated to workBlockStore
      const openCancelModal = (block) => {
        workBlockStore.openCancelModal(block);
      };

      const openCancelModalForActive = () => {
        if (trackerBoundBlock.value) {
          openCancelModal(trackerBoundBlock.value);
        } else if (trackerBlockName.value) {
          const b = (plannerData.value.blocks || []).find(x => x.name === trackerBlockName.value);
          if (b) openCancelModal(b);
        }
      };

      const submitCancelBlock = async () => {
        await workBlockStore.submitCancelBlock();
        if (trackerBlockName.value && cancelTargetBlock.value && trackerBlockName.value === cancelTargetBlock.value.name) {
          trackerBlockName.value = '';
          trackerBoundBlock.value = null;
        }
      };

      const cancelActiveBlock = async () => {
        workBlockStore.cancelActiveBlock();
      };

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
        pickedTask.value = t;
        const dur = parseFloat(t.deficit_hours) > 0 ? parseFloat(t.deficit_hours) : (parseFloat(t.estimate_hours) || 2.0);
        const defaultHours = Math.min(8, Math.max(1, Math.round(dur)));
        bookForm.value = {
          mode: 'work',
          work_item: t.ref,
          work_date: todayISO(),
          start_time: '10:00',
          end_time: String(10 + Math.min(4, defaultHours)).padStart(2, '0') + ':00',
          deliverable_notes: t.subject || '',
          pairing_partner: ''
        };
        activeTab.value = 'planner';
        showBookModal.value = true;
        showToast(`Ready to allocate time for: ${t.subject}`, 'info');
      };

      const startTaskImmediately = (t) => {
        if (!t) return;
        if (isTracking.value) {
          promptSwitchSession({
            id: t.name || t.id,
            name: t.name || t.id,
            label: t.subject || t.title || t.name,
            sublabel: `Task · ${t.project || 'General'}`,
            project: t.project,
            is_block: false,
            task_nature: '🎯 Planned',
          });
          return;
        }
        trackerBlockName.value = '';
        trackerNotes.value = t.subject || '';
        selectedProject.value = t.project || '';
        selectedNature.value = 'Planned Work';
        sessionNotesList.value = [];
        toggleTrack();
        showToast(`Started tracking: ${t.subject}`, 'success');
      };

      const getTaskWorkflowMenuItems = (t) => {
        if (!t || !t.workflow_actions) return [];
        return t.workflow_actions.map(act => {
          return {
            action: act.action,
            label: act.action,
            next_state: act.next_state,
            icon: getWorkflowActionIcon(act.action),
            itemClass: getWorkflowActionClass(act.action),
            onClick: () => promptWorkflowAction(t, act)
          };
        });
      };

      const toggleTaskWorkflowMenu = (t) => {
        const taskId = t.ref || t.id || t.docname;
        if (activeWorkflowMenuTask.value === taskId) {
          activeWorkflowMenuTask.value = null;
        } else {
          activeWorkflowMenuTask.value = taskId;
        }
      };

      const promptWorkflowAction = (t, act) => {
        activeWorkflowMenuTask.value = null;
        workflowTargetTask.value = t;
        workflowTargetAction.value = act;
        workflowComment.value = '';
        showWorkflowModal.value = true;
      };

      const getWorkflowActionIcon = (action) => {
        const act = (action || '').toLowerCase();
        if (act.includes('close') || act.includes('complete') || act.includes('approve')) return '✓';
        if (act.includes('cancel') || act.includes('reject')) return '✕';
        if (act.includes('review')) return '🔍';
        if (act.includes('hold') || act.includes('pause')) return '⏸';
        if (act.includes('start') || act.includes('resume')) return '▶';
        return '→';
      };

      const getWorkflowActionClass = (action) => {
        const act = (action || '').toLowerCase();
        if (act.includes('close') || act.includes('complete') || act.includes('approve')) {
          return 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40';
        }
        if (act.includes('cancel') || act.includes('reject')) {
          return 'text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40';
        }
        if (act.includes('review')) {
          return 'text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40';
        }
        if (act.includes('hold') || act.includes('pause')) {
          return 'text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40';
        }
        return 'text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40';
      };

      const getTaskDeskUrl = (t) => {
        if (!t) return '#';
        const dt = t.doctype ? t.doctype.toLowerCase() : (t.type === 'todo' ? 'todo' : 'task');
        const dn = t.docname || t.id || t.name;
        return `/app/${encodeURIComponent(dt)}/${encodeURIComponent(dn)}`;
      };

      const submitWorkflowAction = async () => {
        if (!workflowTargetTask.value || !workflowTargetAction.value) return;
        workflowBusy.value = true;
        const task = workflowTargetTask.value;
        const act = workflowTargetAction.value;
        try {
          const res = await postJSON('execute_task_workflow_action', {
            doctype: task.doctype || (task.type === 'todo' ? 'ToDo' : 'Task'),
            docname: task.docname || task.id,
            action: act.action,
            comment: workflowComment.value || ''
          });
          showToast((res && res.message) || `Action applied: ${act.action}`, 'success');
          showWorkflowModal.value = false;
          // Optimistically remove from attention tasks if closed or cancelled
          const actionLower = (act.action || '').toLowerCase();
          if (actionLower.includes('close') || actionLower.includes('cancel') || actionLower.includes('complete')) {
            const targetId = task.ref || task.id || task.docname;
            attentionTasks.value = attentionTasks.value.filter(item => (item.ref || item.id || item.docname) !== targetId);
          }
          await Promise.all([
            fetchWorkstationData(selectedEmployee.value),
            fetchPlannerData()
          ]);
        } catch (err) {
          showToast('Failed to execute workflow action: ' + (err && err.message ? err.message : err), 'danger');
        } finally {
          workflowBusy.value = false;
        }
      };

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
          showToast(`✓ Approved & locked block ${b.name}`, 'success');
          await fetchPendingApprovals();
          await fetchWorkstationData(selectedEmployee.value);
          if (typeof fetchPlannerData === 'function') await fetchPlannerData();
        } catch (e) {
          showToast('Failed to approve block: ' + (e && e.message || e), 'danger');
        } finally {
          loadingApprovals.value = false;
        }
      };

      const quickFlagBlock = async (b) => {
        if (!b || !b.name) return;
        const currentReason = b.flagged_reason || '';
        const reason = window.prompt('Specify clarification reason or action required for this work block:', currentReason || 'Please provide client ticket reference and commit deliverables.');
        if (reason === null) return; // user cancelled prompt
        loadingApprovals.value = true;
        try {
          await postJSON('flag_work_block', {
            block_name: b.name,
            reason: reason.trim()
          });
          showToast(`🚩 Flagged block ${b.name} for clarification`, 'warning');
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

      const onPlannerKeydown = (e) => {
        if (e.key !== 'Escape') return;
        if (showInactivityModal.value) showInactivityModal.value = false;
        else if (showStartTimeChoiceModal.value) showStartTimeChoiceModal.value = false;
        else if (showTaskRavenDrawer.value) showTaskRavenDrawer.value = false;
        else if (showBookModal.value) showBookModal.value = false;
        else if (showAdjustModal.value) showAdjustModal.value = false;
        else if (showEditSessionModal.value) showEditSessionModal.value = false;
        else if (showSwitchTaskModal.value) showSwitchTaskModal.value = false;
        else if (showSwitchConfirmModal.value) showSwitchConfirmModal.value = false;
        else if (showEmptyStopModal.value) showEmptyStopModal.value = false;
        else if (showCancelModal.value) showCancelModal.value = false;
        else if (showNewTaskModal.value) showNewTaskModal.value = false;
        else if (showWorkflowModal.value) showWorkflowModal.value = false;
        else if (showBlockDrawer.value) showBlockDrawer.value = false;
        else if (showAppMenu.value) showAppMenu.value = false;
        else if (showTrackerPopup.value) showTrackerPopup.value = false;
        else if (showNatureFilter.value) showNatureFilter.value = false;
      };
      watch([showInactivityModal, showStartTimeChoiceModal, showBookModal, showAdjustModal, showEditSessionModal, showSwitchTaskModal, showSwitchConfirmModal, showEmptyStopModal, showCancelModal, showNewTaskModal, showWorkflowModal, showBlockDrawer, showTaskRavenDrawer], (vals) => {
        const anyOpen = vals.some(Boolean);
        if (anyOpen) {
          document.addEventListener('keydown', onPlannerKeydown);
          document.documentElement.style.overflow = 'hidden';
          document.body.style.overflow = 'hidden';
        } else {
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
        if (_nowTimer) { clearInterval(_nowTimer); _nowTimer = null; }
        if (trackerTimer.value) clearInterval(trackerTimer.value);
        window.removeEventListener('resize', handleResize);
      });

      return {
        activeTab,
        mobileTabs,
        isDarkMode,
        toggleTheme,
        showTrackerPopup,
        isTracking,
        startTime,
        trackerSeconds,
        trackerNotes,
        trackerBlockName,
        natureOptions,
        getNatureBadge,
        selectedNature,
        selectedProject,
        trackerProject,
        trackerNature,
        currentUser,
        currentUserFullName,
        isManager,
        isClient,
        filteredTeamMembers,
        selectedEmployee,
        currentEmployeeFirstName,
        filterNature,
        filterEmployee,
        filterStatus,
        todayDate,
        workBlocks,
        filteredWorkBlocks,
        paginatedBlocks,
        projects,
        tasks,
        teamMembers,
        synthesizerLogs,
        hourlyPresence,
        toast,
        showNewTaskModal,
        newTaskForm,
        openNewTaskModal,
        onNewTaskTimeChange,
        setNewTaskDurationPreset,
        saveNewPlannedTask,
        formattedTime,
        bottomBarTimer,
        paciRatio,
        paciPlannedHours,
        paciUnplannedHours,
        totalFilteredHours,
        capacityLeads,
        timelineMembers,
        onEmployeeChange,
        toggleTrack,
        openDayView,
        discardSession,
        discardConfirm,
        onSessionToolbarKey,
        onSessionToolbarFocusOut,
        sessionToolTabindex,
        sessionStart,
        showAdjustModal,
        showInactivityModal,
        inactivityMinutes,
        lastActivityTimeHHMM,
        suggestedStopHHMM,
        confirmStillWorking,
        stopInactivitySessionNow,
        stopInactivitySessionAtLastEditPlus15,
        discardInactivitySession,
        showEmptyStopModal,
        emptyStopQuickNote,
        emptyStopElapsedHrs,
        openEmptyStopModal,
        confirmEmptyStopDiscard,
        confirmEmptyStopSave,
        adjustForm,
        minTimesheetDate,
        adjustDurationMinutes,
        adjustDurationFormatted,
        openAdjustModal,
        nudgeAdjustTime,
        setAdjustEndNow,
        adjustDurationShort,
        adjustMode,
        originalStartTimeFormatted,
        keepRunningElapsedFormatted,
        applyAdjustedStartTime,
        submitAdjustedTimesheet,
        trackBlock,
        showSwitchTaskModal,
        showSwitchConfirmModal,
        switchTargetItem,
        isSwitchingSession,
        promptSwitchSession,
        confirmSwitchAndStart,
        switchSearchQuery,
        switchWrapUpNote,
        openSwitchTaskModal,
        switchCandidates,
        executeSwitchTask,
        saveNewPlannedTask,
        // Google Meet Dashboard & Agenda
        selectedDashboardDate,
        dashboardWeekOffset,
        dashboardWeekDays,
        selectedDashboardDateLabel,
        dashboardDayTitle,
        todayDirection,
        dashboardDaySummary,
        shiftDashboardWeek,
        selectDashboardDate,
        onDashboardDayKey,
        resetDashboardToToday,
        fetchWorkstationData,
        formatAmPm,
        formatBlockRange,
        getMeetUrl,
        getBlockTimingInfo,
        dayFocusBlocks,
        awayFocusBlocks,
        workFocusBlocks,
        activeOrCurrentBlocks,
        untrackedCurrentBlocks,
        upNextBlock,
        isBlockInNow,
        getStartsInText,
        upcomingFocusBlocks,
        pastFocusBlocks,
        visiblePastFocusBlocks,
        showAllPastBlocks,
        toggleShowAllPastBlocks,
        remainingPastBlocksCount,
        expandedBlockNotes,
        isBlockNotesExpanded,
        toggleBlockNotes,
        isLongNote,
        concludedRovingRow,
        concludedRovingCol,
        canBlockReopen,
        hasBlockExpandableNotes,
        getConcludedNotesCol,
        getMaxConcludedCol,
        setConcludedRoving,
        concludedTabindex,
        focusConcludedCell,
        onConcludedGridKey,
        dashboardKPIs,
        updateDashboardKPIs,
        sessionNotesList,
        sessionHasLines,
        sessionNotesRows,
        sessionCardRef,
        sessionCardFlash,
        openSessionCard,
        isSessionElevated,
        trapSessionPopupTab,
        toggleSessionFocus,
        trackerBoundBlock,
        isProductionEnv,
        isBlockOverrun,
        overrunMinutes,
        earlyStartMinutes,
        quickExtendActiveBlock,
        startUnplannedEscalation,
        showAppMenu,
        headerMenuItems,
        employeeMenuItems,
        openDropdown,
        dropdownIdx,
        dropdownItems,
        dropdownLabel,
        toggleDropdown,
        pickDropdown,
        onDropdownKey,
        closeDropdown,
        modKey,
        isMacLike,
        sessionPointInput,
        growSessionPoint,
        onSessionPointEnter,
        onSessionPointUp,
        sessionNotesScroll,
        focusSessionPointInput,
        activeSessionRowIndex,
        focusLogRow,
        focusLogRowDeleteBtn,
        onLogRowKey,
        onRemoveBtnKey,
        newSessionPoint,
        triggerHaptic,
        syncActiveSession,
        restoreActiveSession,
        addSessionPoint,
        removeSessionPoint,
        startFocusBlock,
        requestStopFocusBlock,
        stopConfirmName,
        // Planner
        visibleBlockCount,
        nearestDayWithWork,
        nearestDayWithWorkLabel,
        jumpToDayWithWork,
        plannerView,
        plannerNatureOptions,
        showNatureFilter,
        natureFilter,
        natureFilterLabel,
        plannerNatureMenuItems,
        setNatureFilter,
        toggleNatureFilter,
        plannerBusy,
        pickedTask,
        plannerData,
        plannerHours,
        plannerGridScroll,
        plannerDays,
        plannerRangeLabel,
        calendarViewMode,
        plannerDate,
        plannerDateDisplay,
        calendarDays,
        showBookModal,
        bookForm,
        showBlockDrawer,
        activeBlock,
        showBlockReschedule,
        showBlockManualLog,
        isBlockCompleted,
        isBlockConcluded,
        drawerChatMessages,
        drawerChatLoading,
        drawerChatInput,
        drawerChatSending,
        fetchDrawerChat,
        sendDrawerChatMessage,
        sessionForm,
        fmtHrs,
        hhmm,
        dowLabel,
        domLabel,
        hourLabel,
        blocksForDay,
        blockTop,
        blockHeight,
        blockClass,
        awayBlocksForDay,
        slotSel,
        slotSelStyle,
        slotSelLabel,
        startSlotSelect,
        openBookModalRange,
        bookFormTask,
        nowMinute,
        nowLineTop,
        nowLineLabel,
        isTodayCol,
        isPastCol,
        pastShadeStyle,
        officeBandStyle,
        blockStyle,
        timelinePlannedStyle,
        timelineLoggedStyle,
        blockVisualState,
        isBlockLocked,
        focusBlocksHeading,
        pastBlocksHeading,
        pastDeliverablesStats,
        getBlockCardAccent,
        getBlockBadgeTheme,
        getBlockVarianceBadge,
        dayTimeline,
        timelineZoom,
        timelineZoomOptions,
        timelineTrackWidth,
        onTimelineZoomKey,
        timelineScroller,
        timelineCanScrollLeft,
        timelineCanScrollRight,
        syncTimelineEdges,
        nudgeTimeline,
        blockLogState,
        blockLogPct,
        isPastBlock,
        canLogTimesheet,
        yesterdayDate,
        pastBlockGraceHours,
        timesheetHorizonHours,
        isPastSlot,
        pastBookingHint,
        hoverCard,
        showBlockHover,
        hideBlockHover,
        cancelHideHover,
        hideBlockHoverNow,
        hoverStateText,
        officeStart,
        officeEnd,
        officeMarks,
        onPlannerTouchStart,
        onPlannerTouchEnd,
        onPlannerViewKey,
        hasAwayBlocksInView,
        timedSegmentsForDay,
        segTop,
        segHeight,
        segStyle,
        segTimeTitle,
        plannerDrag,
        holdArmed,
        dragStyle,
        dragTimeLabel,
        startBlockDrag,
        onBlockClick,
        trackPlannerBlock,
        plannerShift,
        plannerToday,
        pickTask,
        openBookModal,
        submitBooking,
        openBlockDrawer,
        showAttachTasksBox,
        newTaskPasteText,
        selectedTaskToAttach,
        isAttachingTasks,
        isReschedulingTasks,
        isTaskDone,
        getBlockTasksDoneCount,
        isBlockTasksAllCompleted,
        getUnfinishedTasksCount,
        availableUnattachedTasks,
        comboboxTaskOptions,
        comboboxBookTaskOptions,
        comboboxAssigneeOptions,
        comboboxProjectOptions,
        comboboxPairingPartnerOptions,
        showStartTimeChoiceModal,
        pendingStartBlock,
        pendingStartTimeOptions,
        selectStartTimeChoice,
        pendingApprovals,
        loadingApprovals,
        fetchPendingApprovals,
        approveWorkBlockSingle,
        approveAllPending,
        quickApproveBlock,
        quickFlagBlock,
        timesheetHorizon,
        formatTaskTime,
        toggleTaskDone,
        submitAttachTasks,
        carryForwardUnfinished,
        attentionFilter,
        attentionSearch,
        overdueTasksCount,
        underplannedTasksCount,
        dueSoonTasksCount,
        filteredAttentionTasks,
        openPlannerWithFilter,
        plannerTaskFilter,
        plannerTaskSearch,
        filteredPlannerTasks,
        rescheduleForm,
        submitReschedule,
        generateTimesheet,
        showEditSessionModal,
        isSavingEditSession,
        editSessionForm,
        editSessionDuration,
        openEditSessionModal,
        saveEditSession,
        confirmDeleteSession,
        submitSession,
        cancelActiveBlock,
        removeActiveBlock,
        showCancelModal,
        cancelTargetBlock,
        cancelForm,
        cancelReasons,
        openCancelModal,
        openCancelModalForActive,
        submitCancelBlock,
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
        // Attention & Non-Working Tasks
        assignedTasks,
        attentionTasks,
        showAllAttentionTasks,
        visibleAttentionTasks,
        remainingAttentionTasksCount,
        toggleShowAllAttentionTasks,
        attentionRovingRow,
        attentionRovingCol,
        setAttentionRoving,
        attentionTabindex,
        focusAttentionCell,
        onAttentionGridKey,
        getTaskWorkflowMenuItems,
        activeWorkflowMenuTask,
        showWorkflowModal,
        workflowTargetTask,
        workflowTargetAction,
        workflowComment,
        workflowBusy,
        toggleTaskWorkflowMenu,
        promptWorkflowAction,
        getWorkflowActionIcon,
        getWorkflowActionClass,
        getTaskDeskUrl,
        submitWorkflowAction,
        planAttentionTask,
        startTaskImmediately,
        setUserPlannerView,
        isNonWorkingNature,
        paciNonWorkingHours,
        hasFrappeUI,
        appendSessionLine,
        openTodos,
        todayPlannedBlocks,
        todoDropdownOpen,
        todoSearchQuery,
        todoSearchInput,
        toggleTodoPicker,
        filteredOpenTodos,
        filteredPlannedBlocks,
        showCustomOption,
        selectTodoToAutofill,
        selectPlannedBlock,
        selectCustomTitle,
        onTodoSearchEnter,
        clearSelectedTodo,
        bindSessionToBlock,
        reconcileActiveSession,
        handleRemoteSessionCleared,
        checkRemoteActiveSession,
        // Raven Collaboration
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
        openTaskDetails,
        openTaskRavenDrawer,
        closeTaskRavenDrawer,
        fetchTaskRavenDetails,
        taskConnectedBlocks,
        sendRavenChatMessage,
        pinRavenMessage,
        saveRavenTaskSpec,
        openRavenApp,
        setAttentionFilter,
        onAttentionTabKeydown,
        setPlannerTaskFilter,
        onPlannerTaskTabKeydown,
        notificationPermission,
        showNotificationBanner,
        enableNotificationsUserGesture,
        checkBlockOverrun,
        // Timesheet Capture Perfection Suite (Pillars 1-5)
        quickConvertPlanToActual,
        attendancePresence,
        fetchAttendancePresence,
        showRunawayAlertModal,
        runawayGuardData,
        runawayChoice,
        resolveRunawayOption,
        confirmRunawayResolution,
        checkRunawayStopwatch,
        quickLogTimelineGap,
        showEODModal,
        eodSummary,
        eodPendingBlocks,
        openEODWrapUpDrawer,
        convertAllPendingPlannedBlocks
      };
}
