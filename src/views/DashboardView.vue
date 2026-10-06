<template>
  <div class="space-y-6">
    <DashboardClientPortal v-if="isClient" />

    <div v-else class="space-y-6">
      <!-- What to act on first: the block happening now, then tasks that need attention -->
      <DashboardHeroAgenda v-if="untrackedCurrentBlocks.length > 0 || (selectedDashboardDate === todayDate && upNextBlock)" />
      <DashboardAttentionTasks v-if="attentionTasks && attentionTasks.length > 0" />

      <!-- The selected day -->
      <div class="space-y-4">
        <DashboardDateSelector />

        <!-- Focus blocks for the day, grouped now / upcoming / past / away -->
        <div v-if="dayFocusBlocks.length > 0" class="space-y-4">

          <DashboardTimeline v-if="dayTimeline" />
          <DashboardUpcomingBlocks v-if="upcomingFocusBlocks.length > 0" />
          <DashboardPastBlocks v-if="pastFocusBlocks.length > 0" />

          <section v-if="awayFocusBlocks.length > 0" class="space-y-2" aria-label="Time away">
            <h4 class="text-sm font-semibold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">Time away</h4>
            <div
              v-for="b in awayFocusBlocks"
              :key="b.name"
              class="rounded-xl px-4 py-3 border flex items-center justify-between gap-3 text-sm"
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900'"
              :title="b.deliverable_notes || ''">
              <div class="flex items-center gap-2 min-w-0">
                <FeatherIcon name="sun" class="w-4 h-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span class="font-medium truncate">{{ b.task_nature || 'Out of office' }}</span>
              </div>
              <span class="font-mono text-xs shrink-0" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ b.start_time ? formatBlockRange(b) : 'All day' }}</span>
            </div>
          </section>

        </div>

        <!-- Empty day: one sentence and a way to the planner; "Plan" sits in the header above -->
        <div v-else class="rounded-2xl px-6 py-10 border text-center" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'">
          <FeatherIcon name="calendar" class="w-8 h-8 mx-auto text-blue-600" aria-hidden="true" />
          <p class="mt-3 text-sm font-medium" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">Nothing planned</p>
          <p class="mt-1 text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">Book focus time like a meeting so it stays protected.</p>
          <div class="mt-4 flex justify-center gap-2">
            <Button variant="ghost" icon-right="arrow-right" label="Open week planner" @click="activeTab = 'planner'">Week planner</Button>
          </div>
        </div>

      </div>

      <!-- End of day: shown after 16:30 or while today is short of target -->
      <DashboardEodBanner v-if="eodSummary && (eodSummary.remaining_to_target > 0 || eodSummary.is_eod_time)" />

      <!-- 4. Statistics last: the day's numbers, after the things you act on -->
      <DashboardStatCards />

    </div>

  </div>  <!-- /TAB 1: DASHBOARD -->
</template>

<script>
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import DashboardClientPortal from './dashboard/DashboardClientPortal.vue';
import DashboardHeroAgenda from './dashboard/DashboardHeroAgenda.vue';
import DashboardAttentionTasks from './dashboard/DashboardAttentionTasks.vue';
import DashboardDateSelector from './dashboard/DashboardDateSelector.vue';
import DashboardTimeline from './dashboard/DashboardTimeline.vue';
import DashboardUpcomingBlocks from './dashboard/DashboardUpcomingBlocks.vue';
import DashboardPastBlocks from './dashboard/DashboardPastBlocks.vue';
import DashboardEodBanner from './dashboard/DashboardEodBanner.vue';
import DashboardStatCards from './dashboard/DashboardStatCards.vue';

export default {
  name: 'DashboardView',
  components: { DashboardClientPortal, DashboardHeroAgenda, DashboardAttentionTasks, DashboardDateSelector, DashboardTimeline, DashboardUpcomingBlocks, DashboardPastBlocks, DashboardEodBanner, DashboardStatCards },
  setup() {
    return useWorkstationContext([
      'activeTab',
      'attentionTasks',
      'awayFocusBlocks',
      'dayFocusBlocks',
      'dayTimeline',
      'eodSummary',
      'formatBlockRange',
      'isClient',
      'isDarkMode',
      'pastFocusBlocks',
      'selectedDashboardDate',
      'todayDate',
      'untrackedCurrentBlocks',
      'upNextBlock',
      'upcomingFocusBlocks'
    ]);
  },
}
</script>
