import { ref, computed, watch, nextTick } from "vue";

/**
 * Custom dropdowns and the session popup focus handling.
 * Shares state with its sibling modules through the `w` context bag.
 */
export function useWorkstationPickers(w) {
  const { activeWorkflowMenuTask, currentUserFullName, filteredTeamMembers, isDarkMode, isManager, isSessionElevated, natureOptions, openNewTaskModal, projects, selectedEmployee, selectedNature, selectedProject, sessionNotesScroll, sessionPointInput, syncActiveSession, todoDropdownOpen, toggleTheme } = w;
  const onEmployeeChange = (...args) => w.onEmployeeChange(...args);
  const openSessionCard = (...args) => w.openSessionCard(...args);
  const removeSessionPoint = (...args) => w.removeSessionPoint(...args);
  const enableNotifications = (...args) => w.enableNotificationsUserGesture(...args);

  // --- custom dropdowns (native browser popups can't be styled) ---
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
    const list = [{ value: currentUserFullName.value, label: currentUserFullName.value + ' (You)' }];
    if (isManager.value) {
      list.push({ value: 'All', label: 'All members' });
      (filteredTeamMembers.value || []).forEach((m) => {
        const nm = m.full_name || m.name;
        if (nm !== currentUserFullName.value) list.push({ value: nm, label: nm });
      });
    }
    return list;
  });
  const headerMenuItems = computed(() => [
    { label: 'New Task', icon: 'plus', onClick: () => openNewTaskModal() },
    { label: 'Session Timesheet', icon: 'file-text', onClick: () => openSessionCard() },
    { label: isDarkMode.value ? 'Light Mode' : 'Dark Mode', icon: isDarkMode.value ? 'sun' : 'moon', onClick: () => toggleTheme() },
    // A blocked permission can't be fixed from a header button, so it lives here
    // instead of as a permanent red chip; clicking explains how to unblock it.
    ...((w.notificationPermission && w.notificationPermission.value) === 'denied'
      ? [{ label: 'Alerts blocked', icon: 'bell-off', theme: 'red', onClick: () => enableNotifications() }]
      : [])
  ]);
  // Team lists grow past a handful, so the teammate pickers use the searchable
  // frappe-ui Combobox: it takes these {label, value} options and reports the
  // chosen value through setSelectedEmployee.
  const employeeOptions = computed(() => employeeItems.value.map(({ label, value }) => ({ label, value })));
  // The Combobox can hand back its display text ("Name (You)") or a half-typed
  // search instead of an option value; anything that is not a known teammate
  // would be sent to the server as an employee and blank the planner.
  const setSelectedEmployee = (picked) => {
    const raw = picked && typeof picked === 'object' ? picked.value : picked;
    const hit = employeeOptions.value.find((o) => o.value === raw) || employeeOptions.value.find((o) => o.label === raw);
    if (!hit || hit.value === selectedEmployee.value) return;
    selectedEmployee.value = hit.value;
    onEmployeeChange();
  };
  const natureItems = computed(() =>
    (natureOptions || []).map((o) => ({ value: o.value, label: o.label, nonWorking: !o.is_working }))
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

  Object.assign(w, {
    showAppMenu,
    openDropdown,
    dropdownIdx,
    headerMenuItems,
    employeeOptions,
    setSelectedEmployee,
    dropdownItems,
    dropdownLabel,
    closeDropdown,
    toggleDropdown,
    pickDropdown,
    onDropdownKey,
    _appMenuOutside,
    _dropdownOutside,
    trapSessionPopupTab,
    focusSessionPointInput,
    activeSessionRowIndex,
    focusLogRow,
    focusLogRowDeleteBtn,
    onLogRowKey,
    onRemoveBtnKey,
    sessionCardRef,
  });
}
