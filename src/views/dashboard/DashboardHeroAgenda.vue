<template>
  <!-- Top of the dashboard: what is happening now, then the next block today. -->
  <section aria-label="Now and next" class="space-y-3">
    <DashboardHappeningNow v-for="b in untrackedCurrentBlocks" :key="'now-' + b.name" :block="b" />

    <article
      v-if="upNextBlock && !isBlockInNow(upNextBlock)"
      class="rounded-2xl border px-4 py-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900'"
      :aria-label="'Up next: ' + nextTitle">
      <div class="min-w-0" :title="nextDetails">
        <p class="text-xs font-medium" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
          <span class="text-blue-600">Up next</span> · {{ getStartsInText(upNextBlock) }} · {{ formatBlockRange(upNextBlock) }}
        </p>
        <h3 class="mt-0.5 text-base font-semibold leading-snug truncate">{{ nextTitle }}</h3>
      </div>
      <div class="flex items-center gap-1.5 justify-end shrink-0">
        <Button v-if="getMeetUrl(upNextBlock)" variant="ghost" icon="video" label="Join the meeting link" tooltip="Join meeting" @click="openMeet" />
        <Button v-if="!isBlockLocked(upNextBlock)" variant="ghost" icon="calendar" :label="'Reschedule ' + nextTitle" tooltip="Reschedule" @click="openBlockDrawer(upNextBlock)" />
        <Button variant="subtle" theme="blue" icon-left="play" :label="'Start session now for ' + nextTitle" @click="startFocusBlock(upNextBlock)">Start Session</Button>
      </div>
    </article>
  </section>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import DashboardHappeningNow from './DashboardHappeningNow.vue';

export default {
  name: 'DashboardHeroAgenda',
  components: { DashboardHappeningNow },
  computed: {
    nextTitle() {
      const b = this.upNextBlock || {};
      return b.task_subject || b.deliverable_notes || 'Focus block';
    },
    nextDetails() {
      const b = this.upNextBlock || {};
      return [
        b.project_name || b.project || '',
        b.task ? 'Task ' + b.task : '',
        b.task_nature ? this.getNatureBadge(b.task_nature).label : '',
        Number(b.duration_hours || 0).toFixed(1) + 'h planned',
      ].filter(Boolean).join(' · ');
    },
  },
  methods: {
    openMeet() {
      const url = this.getMeetUrl(this.upNextBlock);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    },
  },
  setup() {
    return useWorkstationContext([
      'formatBlockRange',
      'getMeetUrl',
      'getNatureBadge',
      'getStartsInText',
      'isBlockInNow',
      'isBlockLocked',
      'isDarkMode',
      'openBlockDrawer',
      'startFocusBlock',
      'untrackedCurrentBlocks',
      'upNextBlock'
    ]);
  },
};
</script>
