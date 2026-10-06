<template>
  <!-- End of day: one line of status, one primary action. Details live in the review dialog. -->
  <section
    class="rounded-2xl px-4 py-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'"
    aria-label="End of day">
    <div class="flex items-center gap-3 min-w-0">
      <FeatherIcon :name="dayMet ? 'check-circle' : 'flag'" class="w-5 h-5 shrink-0" :class="dayMet ? 'text-green-600' : 'text-amber-600'" aria-hidden="true" />
      <div class="min-w-0">
        <p class="text-sm font-semibold" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">
          {{ dayMet ? 'Day complete' : 'Close your day' }}
        </p>
        <p class="text-xs" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
          {{ eodSummary.total_actual_hours }}h of 8h logged<span v-if="!dayMet"> · {{ eodSummary.remaining_to_target }}h to go</span><span v-if="eodSummary.unconverted_count > 0"> · {{ eodSummary.unconverted_count }} planned {{ eodSummary.unconverted_count === 1 ? 'block' : 'blocks' }} not logged</span>
        </p>
      </div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <Button
        v-if="eodSummary.unconverted_count > 0"
        variant="subtle"
        label="Log all planned blocks as worked"
        tooltip="Log as planned"
        @click="convertAllPendingPlannedBlocks">
        Log {{ eodSummary.unconverted_hours }}h
      </Button>
      <Button variant="solid" theme="blue" label="Review day" @click="openEODWrapUpDrawer">Review day</Button>
    </div>
  </section>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

export default {
  name: 'DashboardEodBanner',
  computed: {
    dayMet() { return this.eodSummary.remaining_to_target === 0; },
  },
  setup() {
    return useWorkstationContext([
      'convertAllPendingPlannedBlocks',
      'eodSummary',
      'isDarkMode',
      'openEODWrapUpDrawer'
    ]);
  },
};
</script>
