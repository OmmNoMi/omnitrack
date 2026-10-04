import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import CalendarView from '../views/CalendarView.vue';
import TimesheetsView from '../views/TimesheetsView.vue';
import AttendanceView from '../views/AttendanceView.vue';

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { tab: 'dashboard' }
  },
  {
    path: '/planner',
    name: 'Planner',
    component: CalendarView,
    meta: { tab: 'planner' }
  },
  {
    path: '/timesheets',
    name: 'Timesheets',
    component: TimesheetsView,
    meta: { tab: 'timesheets' }
  },
  {
    path: '/attendance',
    name: 'Attendance',
    component: AttendanceView,
    meta: { tab: 'attendance' }
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
