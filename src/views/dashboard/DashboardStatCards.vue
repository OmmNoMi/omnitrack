<template>
  <!-- Three periods, one shape: logged of target, one bar (logged over planned), one status line.
       Counts and away hours live in the hover title so the card stays readable at a glance. -->
  <section class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4" aria-label="Hours summary">
    <article
      v-for="c in cards"
      :key="c.key"
      class="rounded-2xl border p-4 sm:p-5 flex flex-col gap-3"
      :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'"
      :title="c.details"
      :aria-label="c.title + ': ' + c.logged + ' of ' + c.target + ' hours logged. ' + c.status"
    >
      <header class="flex items-center gap-2.5">
        <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="c.chip" aria-hidden="true">
          <FeatherIcon :name="c.icon" class="w-4 h-4" />
        </span>
        <h3 class="text-sm font-medium flex-1" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ c.title }}</h3>
        <span class="text-xs font-medium tabular-nums rounded-full px-2 py-0.5" :class="c.chip">{{ c.pct }}% {{ c.pctShort }}</span>
      </header>

      <p class="flex items-baseline gap-1.5 tabular-nums">
        <span class="text-3xl font-semibold tracking-tight" :class="isDarkMode ? 'text-white' : 'text-gray-900'">{{ c.logged }}h</span>
        <span class="text-sm" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">of {{ c.target }}h</span>
      </p>

      <!-- Target is the full width; the tint is what is planned, the solid fill is what is logged -->
      <div class="relative h-2 rounded-full overflow-hidden" :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'" aria-hidden="true">
        <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-500" :class="c.planBar" :style="{ width: c.plannedPct + '%' }"></div>
        <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-500" :class="c.logBar" :style="{ width: c.loggedPct + '%' }"></div>
      </div>

      <p class="flex items-center justify-between gap-2 text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
        <span class="tabular-nums">{{ c.planned }}h planned</span>
        <span class="font-medium tabular-nums" :class="c.statusText">{{ c.status }}</span>
      </p>
    </article>
  </section>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

const n = (v) => Number(v) || 0;
const h = (v) => n(v).toFixed(1);
const pctOf = (part, whole) => (whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0);

// Tonal Material colours per period; every text colour clears 4.5:1 on its surface
const TONES = {
  blue: { chip: ['bg-blue-50 text-blue-700', 'bg-blue-900/50 text-blue-300'], log: 'bg-blue-600', plan: ['bg-blue-200', 'bg-blue-900'] },
  purple: { chip: ['bg-purple-50 text-purple-700', 'bg-purple-900/50 text-purple-300'], log: 'bg-purple-600', plan: ['bg-purple-200', 'bg-purple-900'] },
  emerald: { chip: ['bg-emerald-50 text-emerald-700', 'bg-emerald-900/50 text-emerald-300'], log: 'bg-emerald-600', plan: ['bg-emerald-200', 'bg-emerald-900'] },
};

export default {
  name: 'DashboardStatCards',
  computed: {
    cards() {
      const k = this.dashboardKPIs || {};
      const t = k.today || {};
      const w = k.week || {};
      const m = k.month || {};
      return [
        this.card({
          key: 'today', title: 'Today', icon: 'sun', tone: 'blue',
          actual: t.actual_hours, planned: t.planned_hours, target: t.target_hours || 8,
          pct: n(t.todo_completed_pct), pctLabel: 'of today’s ToDos done', pctShort: 'done',
          extra: [`${n(t.completed_count)} of ${n(t.block_count)} blocks done`, `${n(t.todo_completed_pct)}% of today’s ToDos done`],
          away: t.non_working_hours,
        }),
        this.card({
          key: 'week', title: 'This week', icon: 'calendar', tone: 'purple',
          actual: w.actual_hours, planned: w.planned_hours, target: w.target_hours || 40,
          pct: n(w.adherence_pct), pctLabel: 'plan adherence', pctShort: 'on plan',
          extra: [`${n(w.block_count)} planned blocks`, `${n(w.adherence_pct)}% plan adherence`],
          away: w.non_working_hours,
        }),
        this.card({
          key: 'month', title: m.month || 'This month', icon: 'bar-chart-2', tone: 'emerald',
          actual: m.actual_hours, planned: m.planned_hours, target: m.target_hours || m.capacity_hours || 160,
          pct: n(m.capacity_pct), pctLabel: 'of capacity used', pctShort: 'used',
          extra: [`${n(m.capacity_pct)}% of capacity used`],
          away: m.non_working_hours,
        }),
      ];
    },
  },
  methods: {
    card({ key, title, icon, tone, actual, planned, target, pct, pctLabel, pctShort, extra, away }) {
      const dark = this.isDarkMode ? 1 : 0;
      const T = TONES[tone];
      const diff = n(actual) - n(planned);
      // "Behind" would be wrong for blocks later today, so the gap reads as planned time not yet logged
      let status = 'On plan';
      let statusText = this.isDarkMode ? 'text-gray-200' : 'text-gray-800';
      if (n(planned) === 0 && n(actual) === 0) status = 'Nothing planned';
      else if (diff < -0.05) status = `${h(-diff)}h still to log`;
      else if (diff > 0.05) { status = `${h(diff)}h over plan`; statusText = this.isDarkMode ? 'text-emerald-300' : 'text-emerald-700'; }
      const details = [
        `${h(actual)}h logged · ${h(planned)}h planned · ${h(target)}h target`,
        ...extra,
        n(away) > 0 ? `${h(away)}h away (break or leave)` : '',
      ].filter(Boolean).join('\n');
      return {
        key, title, icon, pct, pctLabel, pctShort, status, statusText, details,
        logged: h(actual), planned: h(planned), target: h(target),
        loggedPct: pctOf(n(actual), n(target)),
        plannedPct: pctOf(n(planned), n(target)),
        chip: T.chip[dark], logBar: T.log, planBar: T.plan[dark],
      };
    },
  },
  setup() {
    return useWorkstationContext([
      'dashboardKPIs',
      'isDarkMode'
    ]);
  },
};
</script>
