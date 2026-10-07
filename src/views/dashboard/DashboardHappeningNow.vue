<template>
  <!-- One block that is happening now. Secondary facts (task, nature, owner, hours) are in the hover title. -->
  <article
    class="rounded-2xl border px-4 py-4 sm:px-5"
    :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-gray-100' : 'bg-white border-gray-200 text-gray-900'"
    :aria-label="(recording ? 'Recording: ' : 'Happening now: ') + title">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="min-w-0 flex-1" :title="details">
        <p class="flex items-center gap-2 text-xs font-medium" :class="recording ? 'text-red-600' : 'text-blue-600'">
          <span class="w-2 h-2 rounded-full" :class="recording ? 'bg-red-500 pulse-record' : 'bg-blue-600'" aria-hidden="true"></span>
          <span>{{ recording ? 'Recording' : 'Now' }}</span>
          <span :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">· {{ formatBlockRange(block) }}<template v-if="project"> · {{ project }}</template></span>
        </p>
        <!-- The title is the way into the block: details, tasks, Reschedule and More live in the drawer -->
        <h3 class="mt-1 text-base sm:text-lg font-semibold leading-snug">
          <button type="button" class="text-left break-words [overflow-wrap:anywhere] rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" :aria-label="'Open details of ' + title" @click.stop="openBlockDrawer(block)">{{ title }}</button>
        </h3>
      </div>

      <div class="flex items-center gap-1.5 justify-end shrink-0">
        <template v-if="recording">
          <span class="font-mono text-sm tabular-nums mr-1" :class="isDarkMode ? 'text-gray-100' : 'text-gray-800'" aria-label="Elapsed time">{{ formattedTime }}</span>
          <Button variant="ghost" icon="clock" label="Adjust start and end time" tooltip="Adjust time" @click.stop="openAdjustModal" />
          <Button variant="ghost" icon="repeat" label="Switch to another task without losing time" tooltip="Switch task" @click.stop="openSwitchTaskModal" />
          <Button
            :variant="discardConfirm ? 'solid' : 'ghost'"
            :theme="discardConfirm ? 'orange' : 'gray'"
            :label="discardConfirm ? 'Confirm discard: throw this session away without saving' : 'Discard this session without saving'"
            :tooltip="discardConfirm ? 'Press again to discard' : 'Discard'"
            @click.stop="discardSession">
            {{ discardConfirm ? 'Discard?' : 'Discard' }}
          </Button>
          <Button
            :variant="stopConfirm ? 'solid' : 'subtle'"
            theme="red"
            :class="stopConfirm ? '' : 'dark:!text-red-300'"
            icon-left="square"
            :label="stopConfirm ? 'Stop and save without any log lines' : 'Stop and save the session'"
            @click.stop="requestStopFocusBlock(block)">
            {{ stopConfirm ? 'Stop anyway' : 'Stop & save' }}
          </Button>
        </template>
        <template v-else>
          <Button variant="solid" theme="blue" icon-left="play" label="Start session" :title="'Start a session on ' + title" @click.stop="startFocusBlock(block)" />
        </template>
      </div>
    </div>

    <!-- While recording: one quiet line pointing at the session log, never a second input -->
    <p v-if="recording" class="mt-3 pt-3 border-t text-xs" :class="isDarkMode ? 'border-gray-800 text-gray-300' : 'border-gray-100 text-gray-700'" role="status" aria-live="polite">
      <template v-if="sessionNotesList.length">{{ sessionNotesList.length }} {{ sessionNotesList.length === 1 ? 'line' : 'lines' }} in the session log</template>
      <button v-else type="button" class="underline underline-offset-2 rounded text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" @click.stop="focusSessionPointInput">Nothing logged yet. Add a line</button>
    </p>
  </article>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import { blockTitle } from '../../utils/blockTitle.js';

export default {
  name: 'DashboardHappeningNow',
  props: {
    block: { type: Object, required: true },
  },
  computed: {
    recording() { return this.isTracking && this.trackerBlockName === this.block.name; },
    stopConfirm() { return this.stopConfirmName === this.block.name; },
    title() { return blockTitle(this.block, 'Focus block'); },
    project() { return this.block.project_name || this.block.project || ''; },
    details() {
      const b = this.block;
      return [
        b.task ? 'Task ' + b.task : '',
        b.task_nature ? this.getNatureBadge(b.task_nature).label : '',
        b.associate_name || b.employee || '',
        Number(b.duration_hours || 0).toFixed(1) + 'h planned',
        b.actual_hours ? Number(b.actual_hours).toFixed(1) + 'h logged' : '',
      ].filter(Boolean).join(' · ');
    },
  },
  setup() {
    return useWorkstationContext([
      'discardConfirm',
      'discardSession',
      'focusSessionPointInput',
      'formatBlockRange',
      'formattedTime',
      'getNatureBadge',
      'isDarkMode',
      'isTracking',
      'openAdjustModal',
      'openBlockDrawer',
      'openSwitchTaskModal',
      'requestStopFocusBlock',
      'sessionNotesList',
      'startFocusBlock',
      'stopConfirmName',
      'trackerBlockName'
    ]);
  },
};
</script>
