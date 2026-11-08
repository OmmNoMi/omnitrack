<template>
  <section class="rounded-2xl border overflow-hidden" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'" aria-labelledby="timesheets-heading">
    <!-- Toolbar: period, person, total. Approval happens inside each block, not here. -->
    <div class="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
      <h2 id="timesheets-heading" class="text-base font-semibold" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">Logged time</h2>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="inline-flex items-center gap-0.5 rounded-lg p-0.5" :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'" role="group" aria-label="Period">
          <Button
            v-for="hz in horizons"
            :key="hz.id"
            size="sm"
            :variant="timesheetHorizon === hz.id ? 'solid' : 'ghost'"
            :theme="timesheetHorizon === hz.id ? 'blue' : 'gray'"
            :aria-pressed="timesheetHorizon === hz.id ? 'true' : 'false'"
            @click="timesheetHorizon = hz.id">{{ hz.label }}</Button>
        </div>
        <div v-if="isManager" class="w-52">
          <Combobox
            open-on-click
            :model-value="selectedEmployee"
            :options="employeeOptions"
            placeholder="Search teammates"
            aria-label="Show logged time for"
            @update:model-value="setSelectedEmployee"
          />
        </div>
        <span class="text-sm font-semibold tabular-nums" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'" title="Total hours in this view">{{ totalFilteredHours }}h</span>
      </div>
    </div>

    <!-- Hours by person: counted on the server from every Work Session in the period, not from the list below -->
    <div class="border-b" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'" aria-labelledby="team-hours-heading" role="region">
      <div class="px-4 pt-3 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <h3 id="team-hours-heading" class="text-sm font-semibold" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ hours && hours.can_review_team ? 'Hours by person' : 'My hours' }}</h3>
          <p class="text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ periodLabel }}<template v-if="timesheetHorizon === 'all'">{{ ' ' }}(last {{ maxDays }} days)</template></p>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="hours && hours.can_review_team" class="text-sm font-semibold tabular-nums" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">Team {{ fmt(hours.total_worked) }}h</span>
          <Button size="sm" variant="ghost" icon="refresh-cw" label="Refresh hours by person" :loading="hoursLoading" @click="loadHours" />
        </div>
      </div>
      <p v-if="hoursError" role="alert" class="px-4 pb-3 text-sm text-red-700 dark:text-red-300">Hours could not be loaded. {{ hoursError }}</p>
      <p v-else-if="hours && !hours.people.length" class="px-4 pb-3 text-sm" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Nobody logged time in this period.</p>
      <div v-else-if="hours" class="overflow-x-auto pb-2">
        <table class="w-full text-sm tabular-nums" aria-labelledby="team-hours-heading">
          <thead>
            <tr class="text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
              <th scope="col" class="px-4 py-1.5 text-left font-medium">Person</th>
              <th v-for="d in dayColumns" :key="d" scope="col" class="hidden md:table-cell px-2 py-1.5 text-right font-medium" :title="d">{{ dayHead(d) }}</th>
              <th scope="col" class="px-2 py-1.5 text-right font-medium">Worked</th>
              <th scope="col" class="hidden sm:table-cell px-2 py-1.5 text-right font-medium">Planned</th>
              <th scope="col" class="px-2 py-1.5 text-right font-medium">Approved</th>
              <th scope="col" class="px-2 py-1.5 text-right font-medium">Awaiting</th>
              <th scope="col" class="hidden sm:table-cell px-4 py-1.5 text-right font-medium">Flagged</th>
            </tr>
          </thead>
          <tbody v-for="p in hours.people" :key="p.user" class="border-t" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <tr>
              <th scope="row" class="px-2 py-1 text-left font-normal">
                <button
                  type="button"
                  class="w-full flex items-center gap-1.5 rounded px-2 py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  :class="isDarkMode ? 'text-gray-100 hover:bg-gray-800/60' : 'text-gray-900 hover:bg-gray-50'"
                  :aria-expanded="openPerson === p.user ? 'true' : 'false'"
                  :aria-controls="'team-hours-detail-' + rowId(p.user)"
                  @click="openPerson = openPerson === p.user ? '' : p.user">
                  <FeatherIcon :name="openPerson === p.user ? 'chevron-down' : 'chevron-right'" class="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span class="truncate font-medium" :title="p.full_name">{{ p.full_name }}</span>
                </button>
              </th>
              <td v-for="d in dayColumns" :key="d" class="hidden md:table-cell px-2 py-1 text-right" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ p.by_day[d] ? fmt(p.by_day[d]) : '' }}</td>
              <td class="px-2 py-1 text-right font-semibold" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ fmt(p.worked) }}</td>
              <td class="hidden sm:table-cell px-2 py-1 text-right" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ fmt(p.planned) }}</td>
              <td class="px-2 py-1 text-right text-green-800 dark:text-green-300">{{ fmt(p.approved) }}</td>
              <td class="px-2 py-1 text-right" :class="isDarkMode ? 'text-blue-300' : 'text-blue-800'">{{ fmt(p.awaiting) }}</td>
              <td class="hidden sm:table-cell px-4 py-1 text-right" :class="p.flagged ? (isDarkMode ? 'text-orange-300' : 'text-orange-800') : (isDarkMode ? 'text-gray-300' : 'text-gray-700')">{{ fmt(p.flagged) }}</td>
            </tr>
            <tr v-if="openPerson === p.user" :id="'team-hours-detail-' + rowId(p.user)">
              <td :colspan="columnCount" class="px-4 pb-3 pt-1">
                <div class="grid gap-4 sm:grid-cols-2 rounded-lg p-3" :class="isDarkMode ? 'bg-gray-800/60' : 'bg-gray-50'">
                  <div>
                    <h4 class="text-xs font-semibold mb-1" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">By day</h4>
                    <p v-if="!Object.keys(p.by_day).length" class="text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">No time worked.</p>
                    <ul v-else class="text-xs space-y-0.5" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
                      <li v-for="(h, d) in p.by_day" :key="d" class="flex justify-between gap-3"><span>{{ longDay(d) }}</span><span class="font-medium">{{ fmt(h) }}h</span></li>
                    </ul>
                  </div>
                  <div>
                    <h4 class="text-xs font-semibold mb-1" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">By project</h4>
                    <p v-if="!p.by_project.length" class="text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">No time worked.</p>
                    <ul v-else class="text-xs space-y-0.5" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">
                      <li v-for="row in p.by_project" :key="row.project" class="flex justify-between gap-3"><span class="truncate" :title="row.project">{{ row.project }}</span><span class="font-medium">{{ fmt(row.hours) }}h</span></li>
                    </ul>
                  </div>
                  <p class="sm:col-span-2 text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
                    {{ p.blocks }} {{ p.blocks === 1 ? 'block' : 'blocks' }} with time<template v-if="p.away">{{ ' ' }}· {{ fmt(p.away) }}h on break or away, not counted</template>
                  </p>
                  <div v-if="isManager && canShowEntries(p)" class="sm:col-span-2">
                    <Button size="sm" variant="subtle" :label="'Show ' + p.full_name + '\'s entries below'" @click="showEntries(p)" />
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="px-4 pb-3 text-sm" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'" aria-live="polite">Loading hours…</p>
    </div>

    <p v-if="filteredWorkBlocks.length === 0" class="px-4 py-10 text-center text-sm" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
      Nothing logged in this period.
    </p>

    <!-- One list for every width: each row opens its block, where it can be reviewed -->
    <ul v-else class="divide-y" :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-100'" aria-label="Logged time">
      <li v-for="b in filteredWorkBlocks" :key="b.name">
        <button
          type="button"
          class="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
          :class="isDarkMode ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'"
          :title="details(b)"
          @click="openBlockDrawer(b)">
          <span class="w-20 shrink-0 text-xs tabular-nums" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ shortDate(b.work_date) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium truncate" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ blockTitle(b) }}</span>
            <span class="block text-xs truncate" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
              <template v-if="selectedEmployee === 'All'">{{ b.associate_name || b.employee }} · </template>{{ b.project_name || 'General' }}
            </span>
          </span>
          <span class="shrink-0 text-sm font-semibold tabular-nums" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ hoursOf(b) }}h</span>
          <Badge class="shrink-0 w-[7.5rem] justify-center" :theme="status(b).theme" variant="subtle">{{ status(b).label }}</Badge>
        </button>
      </li>
    </ul>
  </section>
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { blockTitle } from '../utils/blockTitle.js';

const pad = (n) => String(n).padStart(2, '0');
// Local calendar date; toISOString() is UTC and gives yesterday before 05:30 in IST
const ymd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

export default {
  name: 'TimesheetsView',
  data() {
    return {
      horizons: [
        { id: 'day', label: 'Today' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
        { id: 'all', label: 'All' },
      ],
      maxDays: 92,
      hours: null,
      hoursLoading: false,
      hoursError: '',
      openPerson: '',
      hoursReq: 0,
    };
  },
  computed: {
    period() {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
      if (this.timesheetHorizon === 'day') return { from: ymd(now), to: ymd(now) };
      if (this.timesheetHorizon === 'week') {
        const mon = new Date(y, m, d - ((now.getDay() + 6) % 7));
        return { from: ymd(mon), to: ymd(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)) };
      }
      if (this.timesheetHorizon === 'month') return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
      return { from: ymd(new Date(y, m, d - (this.maxDays - 1))), to: ymd(now) };
    },
    periodLabel() {
      // Say the period the numbers are for, as the server read it
      const { from, to } = this.hours ? { from: this.hours.from_date, to: this.hours.to_date } : this.period;
      return from === to ? this.longDay(from) : this.shortDate(from) + ' to ' + this.shortDate(to);
    },
    // A column per day only for a week; a month or more is read in each person's detail
    dayColumns() { return this.timesheetHorizon === 'week' && this.hours ? this.hours.days : []; },
    columnCount() { return 6 + this.dayColumns.length; },
  },
  watch: {
    timesheetHorizon() { this.openPerson = ''; this.loadHours(); },
  },
  mounted() { this.loadHours(); },
  methods: {
    fmt(v) { return Number(v || 0).toFixed(2); },
    rowId(user) { return String(user).replace(/[^a-zA-Z0-9_-]/g, '_'); },
    dayHead(d) {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    },
    longDay(d) {
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    },
    async loadHours() {
      const req = ++this.hoursReq;
      this.hoursLoading = true;
      this.hoursError = '';
      try {
        const res = await this.postJSON('get_team_hours', { from_date: this.period.from, to_date: this.period.to });
        if (req === this.hoursReq) this.hours = res;
      } catch (e) {
        if (req === this.hoursReq) this.hoursError = this.extractErrorMessage(e, 'Try again.');
      } finally {
        if (req === this.hoursReq) this.hoursLoading = false;
      }
    },
    canShowEntries(p) {
      return (this.employeeOptions || []).some((o) => o.value === p.full_name || o.label === p.full_name);
    },
    showEntries(p) {
      this.setSelectedEmployee(p.full_name);
      this.$nextTick(() => {
        const list = document.querySelector('[aria-label="Logged time"] button');
        if (list) list.focus();
      });
    },
    blockTitle,
    hoursOf(b) { return Number(b.actual_hours || b.duration_hours || 0).toFixed(2); },
    shortDate(d) {
      if (!d) return '';
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },
    // The one status a timesheet carries in the list; review actions live in the drawer.
    status(b) {
      if (b.approval_status === 'Approved') return { theme: 'green', label: 'Approved' };
      if (b.approval_status === 'Flagged') return { theme: 'orange', label: 'Flagged' };
      if (Number(b.actual_hours) > 0) return { theme: 'blue', label: 'Awaiting approval' };
      return { theme: 'gray', label: 'Not logged' };
    },
    details(b) {
      return [
        b.name,
        b.task_nature || '',
        b.duration_hours ? Number(b.duration_hours).toFixed(2) + 'h planned' : '',
        b.approval_status === 'Flagged' && b.approval_notes ? 'Flagged: ' + b.approval_notes : '',
      ].filter(Boolean).join(' · ');
    },
  },
  setup() {
    return useWorkstationContext([
      'employeeOptions',
      'setSelectedEmployee',
      'filteredWorkBlocks',
      'openBlockDrawer',
      'selectedEmployee',
      'timesheetHorizon',
      'totalFilteredHours',
      'isDarkMode',
      'isManager',
      'postJSON',
      'extractErrorMessage'
    ]);
  },
}
</script>
