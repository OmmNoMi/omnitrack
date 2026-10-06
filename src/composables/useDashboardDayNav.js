import { nextTick } from "vue";

/** Week strip navigation for the dashboard day selector (roving radio keys). */
export function useDashboardDayNav({ selectedDashboardDate, dashboardWeekOffset, dashboardWeekDays, todayDate, getLocalTodayISO }) {
  const shiftDashboardWeek = (delta) => {
    dashboardWeekOffset.value += delta;
    const cur = selectedDashboardDate.value;
    if (cur) {
      const [y, m, d] = cur.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + delta * 7);
      const pad = (n) => String(n).padStart(2, '0');
      selectedDashboardDate.value = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
    }
    nextTick(() => {
      const day = document.querySelector('[data-day-strip] [data-day-btn][aria-checked="true"]');
      if (day && document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-day-strip]')) day.focus({ preventScroll: true });
    });
  };

  const selectDashboardDate = (dt) => {
    selectedDashboardDate.value = dt;
  };

  const _focusSelectedDay = () => {
    nextTick(() => {
      const el = document.querySelector('[data-day-strip] [data-day-btn][aria-checked="true"]');
      if (el) el.focus();
    });
  };

  const onDashboardDayKey = (ev) => {
    const k = ev.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    if (!ev.target.closest || !ev.target.closest('[data-day-btn]')) return;
    ev.preventDefault();
    const days = dashboardWeekDays.value || [];
    if (!days.length) return;
    if (k === 'Home') { selectDashboardDate(days[0].dateStr); _focusSelectedDay(); return; }
    if (k === 'End') { selectDashboardDate(days[days.length - 1].dateStr); _focusSelectedDay(); return; }
    const idx = days.findIndex((d) => d.isSelected);
    const next = (idx < 0 ? 0 : idx) + (k === 'ArrowRight' ? 1 : -1);
    if (next < 0) {
      shiftDashboardWeek(-1);
      nextTick(() => { const ds = dashboardWeekDays.value; selectDashboardDate(ds[ds.length - 1].dateStr); _focusSelectedDay(); });
      return;
    }
    if (next >= days.length) {
      shiftDashboardWeek(1);
      nextTick(() => { selectDashboardDate(dashboardWeekDays.value[0].dateStr); _focusSelectedDay(); });
      return;
    }
    selectDashboardDate(days[next].dateStr);
    _focusSelectedDay();
  };

  const resetDashboardToToday = () => {
    dashboardWeekOffset.value = 0;
    selectedDashboardDate.value = todayDate.value || getLocalTodayISO();
  };

  return { shiftDashboardWeek, selectDashboardDate, onDashboardDayKey, resetDashboardToToday };
}
