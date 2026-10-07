<template>
  <!-- Top of the dashboard: what is happening now, then the next block today. -->
  <section aria-label="Now and next" class="space-y-3">
    <DashboardHappeningNow v-for="b in untrackedCurrentBlocks" :key="'now-' + b.name" :block="b" />

    <article
      v-if="upNextBlock && !isBlockInNow(upNextBlock)"
      class="rounded-2xl border px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-gray-200 text-gray-900 dark:bg-[#1E1F22] dark:border-gray-800 dark:text-gray-100"
      :aria-label="'Up next: ' + nextTitle">
      <div class="min-w-0 space-y-1" :title="nextDetails">
        <p class="text-xs font-medium text-blue-700 dark:text-blue-300">Up next</p>
        <!-- The title is the way into the block: details, tasks, Reschedule and More live in the drawer -->
        <h3 class="text-lg font-semibold leading-snug">
          <button type="button" class="text-left line-clamp-2 break-words rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" :aria-label="'Open details of ' + nextTitle" @click="openBlockDrawer(upNextBlock)">{{ nextTitle }}</button>
        </h3>
        <p class="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
          {{ formatBlockRange(upNextBlock) }}<template v-if="nextStartsIn"> · {{ nextStartsIn }}</template>
        </p>
      </div>
      <div class="flex items-center gap-1.5 justify-end shrink-0">
        <Button v-if="getMeetUrl(upNextBlock)" variant="ghost" icon="video" label="Join the meeting link" tooltip="Join meeting" @click="openMeet" />
        <Button variant="solid" theme="blue" class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white" icon-left="play" label="Start session" :title="'Start a session on ' + nextTitle" @click="startFocusBlock(upNextBlock)" />
      </div>
    </article>
  </section>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import DashboardHappeningNow from './DashboardHappeningNow.vue';
import { blockTitle } from '../../utils/blockTitle.js';

export default {
  name: 'DashboardHeroAgenda',
  components: { DashboardHappeningNow },
  computed: {
    nextTitle() {
      const b = this.upNextBlock || {};
      return blockTitle(b, 'Focus block');
    },
    nextStartsIn() {
      const t = this.getStartsInText(this.upNextBlock);
      return t ? t.charAt(0).toLowerCase() + t.slice(1) : '';
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
      'isDarkMode',
      'openBlockDrawer',
      'startFocusBlock',
      'untrackedCurrentBlocks',
      'upNextBlock'
    ]);
  },
};
</script>
