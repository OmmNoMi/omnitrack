<template>
  <div class="space-y-3">
    <h4 class="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">{{ focusBlocksHeading }}</h4>
    <div class="space-y-3">
      <div 
        v-for="b in upcomingFocusBlocks" 
        :key="b.name" :class="['omni-card']">
        
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1.5 flex-1 min-w-0" :title="blockDetails(b)">
            <div class="flex items-center gap-2 flex-wrap">
              <Badge theme="gray" variant="outline" size="sm">{{ formatBlockRange(b) }}</Badge>
              <Badge :theme="getBlockBadgeTheme(b)" variant="subtle" size="sm">
                {{ getBlockTimingInfo(b).label }}
              </Badge>
            </div>
            <h3 class="text-base sm:text-lg font-bold leading-snug truncate">
              {{ blockTitle(b, 'Focus block') }}
            </h3>
            <p class="text-xs text-gray-700 dark:text-gray-300 truncate">
              <span v-if="b.project_name || b.project">{{ b.project_name || b.project }} · </span>{{ Number(b.duration_hours || 0).toFixed(1) }}h
            </p>
          </div>

          <!-- Actions Cluster (Frappe UI FButton) -->
          <div class="flex items-center gap-2 self-stretch md:self-center justify-end">
            <Button
              v-if="!isBlockLocked(b)"
              theme="gray"
              variant="outline"
              size="sm"
              @click.stop="openBlockDrawer(b)"
              :label="'Reschedule ' + blockTitle(b)"
              title="Reschedule this planned block">
              Reschedule
            </Button>
            <Button 
              theme="blue"
              variant="solid"
              size="sm"
              icon-left="play"
              @click.stop="startFocusBlock(b)"
              label="Start session"
              :title="'Start a session on ' + blockTitle(b, 'this block')" />
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import { blockTitle } from '../../utils/blockTitle.js';

export default {
  name: 'DashboardUpcomingBlocks',
  methods: {
    blockTitle,
    // Secondary facts live in the hover tooltip so the card stays uncluttered.
    blockDetails(b) {
      return [
        b.task ? `Task: ${b.task}` : '',
        b.task_nature ? this.getNatureBadge(b.task_nature).label : '',
        b.associate_name || b.employee || '',
      ].filter(Boolean).join(' · ');
    },
  },
  setup() {
    return useWorkstationContext([
      'focusBlocksHeading',
      'formatBlockRange',
      'getBlockBadgeTheme',
      'getBlockTimingInfo',
      'getNatureBadge',
      'isBlockLocked',
      'openBlockDrawer',
      'startFocusBlock',
      'upcomingFocusBlocks'
    ]);
  },
};
</script>
