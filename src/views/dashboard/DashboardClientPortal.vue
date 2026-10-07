<template>
  <section class="space-y-6" aria-label="Project Pulse">
    <!-- Executive Welcome Banner -->
    <div class="rounded-2xl p-6 border shadow-sm transition-all"
      :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Active Operations
            </span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black mt-2 tracking-tight">Executive Project Pulse</h2>
          <p class="text-xs text-gray-700 dark:text-gray-300 mt-1">
            Delivery status and work sessions on the projects shared with you.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-[10px] font-bold uppercase text-gray-600">Selected Date</div>
            <div class="text-sm font-extrabold">{{ selectedDashboardDate === todayDate ? "Today (" + todayDate + ")" : selectedDashboardDate }}</div>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
        <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
          <div class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Delivered Today</div>
          <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {{ fmtHrs(clientDeliveredHours) }}h
          </div>
        </div>
        <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
          <div class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Active Engineering</div>
          <div class="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {{ clientInProgressCount }} session{{ clientInProgressCount === 1 ? '' : 's' }}
          </div>
        </div>
        <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
          <div class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Total Planned Today</div>
          <div class="text-lg font-black text-gray-800 dark:text-gray-200 mt-0.5">
            {{ fmtHrs(clientTotalPlannedHours) }}h
          </div>
        </div>
        <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
          <div class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Reliability Rate</div>
          <div class="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
            {{ clientReliabilityRate }}%
          </div>
        </div>
      </div>
    </div>

    <!-- Today's Story Scorecard -->
    <div class="space-y-4">
      <h3 class="text-sm font-extrabold uppercase tracking-wider text-gray-700 px-1">Today's Delivery Scorecard</h3>

      <!-- Card 1: Completed Deliverables -->
      <div v-if="clientCompletedBlocks.length" class="rounded-2xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h4 class="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed Deliverables ({{ clientCompletedBlocks.length }})</h4>
          </div>
          <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{{ fmtHrs(clientCompletedHours) }}h total</span>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="b in clientCompletedBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">{{ formatBlockRange(b) }}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{{ b.status || 'Completed' }}</span>
                <span v-if="b.task_nature" class="text-[10px] text-gray-600">{{ b.task_nature }}</span>
              </div>
              <div class="text-sm font-bold text-gray-900 dark:text-white">{{ blockTitle(b, '') }}</div>
              <div v-if="b.deliverable_notes && b.deliverable_notes !== b.task_subject" class="text-xs text-gray-700 dark:text-gray-300">{{ b.deliverable_notes }}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{{ fmtHrs(b.actual_hours) }}h</div>
              <div class="text-[10px] text-gray-600">planned {{ fmtHrs(b.duration_hours) }}h</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 2: In Progress -->
      <div v-if="clientInProgressBlocks.length" class="rounded-2xl p-5 border bg-white dark:bg-[#1E1F22] border-blue-200 dark:border-blue-900 shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <h4 class="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">In Progress · Active Engineering ({{ clientInProgressBlocks.length }})</h4>
          </div>
          <span class="text-xs font-bold text-blue-600 dark:text-blue-400">Active</span>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="b in clientInProgressBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">{{ formatBlockRange(b) }}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">In Progress</span>
              </div>
              <div class="text-sm font-bold text-gray-900 dark:text-white">{{ blockTitle(b, '') }}</div>
              <div class="text-xs text-gray-700 dark:text-gray-300">{{ b.deliverable_notes || 'Active engineering sprint' }}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-sm font-black font-mono text-blue-600 dark:text-blue-400">{{ fmtHrs(b.actual_hours || b.duration_hours) }}h</div>
              <div class="text-[10px] text-gray-600">allocated</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: Rescheduled & Cancelled -->
      <div v-if="clientCancelledBlocks.length" class="rounded-2xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <h4 class="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Rescheduled & Cancelled ({{ clientCancelledBlocks.length }})</h4>
          </div>
          <span class="text-xs font-bold text-gray-600">Audited Schedule Variance</span>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="b in clientCancelledBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs font-bold text-gray-700 line-through">{{ formatBlockRange(b) }}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="b.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'">
                  {{ b.status === 'Cancelled' ? (b.cancel_reason ? 'Cancelled (' + b.cancel_reason + ')' : 'Cancelled') : 'Rescheduled' }}
                </span>
              </div>
              <div class="text-sm font-bold text-gray-700 dark:text-gray-300 line-through">{{ blockTitle(b, '') }}</div>
              <div class="text-xs text-gray-600">
                <span v-if="b.cancel_reason">Reason: {{ b.cancel_reason }} · </span>
                <span v-if="b.actual_hours > 0">{{ fmtHrs(b.actual_hours) }}h wait logged</span>
                <span v-else>Freed capacity returned to engineering</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-sm font-mono text-gray-600">{{ fmtHrs(b.actual_hours) }}h</div>
              <div class="text-[10px] text-gray-600">planned {{ fmtHrs(b.duration_hours) }}h</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 4: Upcoming Scheduled -->
      <div v-if="clientUpcomingBlocks.length" class="rounded-2xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
            <h4 class="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">Upcoming Scheduled ({{ clientUpcomingBlocks.length }})</h4>
          </div>
          <span class="text-xs font-mono font-bold text-gray-700">{{ fmtHrs(clientUpcomingHours) }}h total</span>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-800">
          <div v-for="b in clientUpcomingBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{{ formatBlockRange(b) }}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Scheduled</span>
              </div>
              <div class="text-sm font-bold text-gray-900 dark:text-white">{{ blockTitle(b, '') }}</div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-sm font-black font-mono text-gray-700 dark:text-gray-300">{{ fmtHrs(b.duration_hours) }}h</div>
              <div class="text-[10px] text-gray-600">planned</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import { blockTitle } from '../../utils/blockTitle.js';

export default {
  name: 'DashboardClientPortal',
  methods: { blockTitle },
  setup() {
    return useWorkstationContext([
      'clientCancelledBlocks',
      'clientCompletedBlocks',
      'clientCompletedHours',
      'clientDeliveredHours',
      'clientInProgressBlocks',
      'clientInProgressCount',
      'clientReliabilityRate',
      'clientTotalPlannedHours',
      'clientUpcomingBlocks',
      'clientUpcomingHours',
      'fmtHrs',
      'formatBlockRange',
      'isDarkMode',
      'openBlockDrawer',
      'selectedDashboardDate',
      'todayDate'
    ]);
  },
};
</script>
