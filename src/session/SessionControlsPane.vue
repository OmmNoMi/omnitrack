<template>
  <div class="lg:col-span-5 flex flex-col gap-4">
    <!-- The clock: a soft red-to-blue wash marks it as live without shouting -->
    <section
      class="rounded-2xl px-4 py-4 border bg-gradient-to-br from-red-50 via-white to-blue-50 border-red-100 dark:from-red-950/40 dark:via-[#1E1F22] dark:to-blue-950/30 dark:border-red-900/40"
      aria-label="Session clock"
    >
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="min-w-0">
          <div class="font-mono text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums leading-none text-gray-900 dark:text-white" role="timer" aria-label="Elapsed time">{{ formattedDuration }}</div>
          <!-- The start is the defensible fact on a timesheet, so it stays visible -->
          <p v-if="sessionStart" class="mt-1.5 text-xs text-gray-700 dark:text-gray-300">Started {{ sessionStart.date }} · {{ sessionStart.time }}</p>
        </div>

        <div
          ref="toolbarRef"
          class="flex items-center gap-1.5 shrink-0 ml-auto"
          role="toolbar"
          aria-orientation="horizontal"
          aria-label="Session controls"
          @keydown="onToolbarKey"
        >
          <Button
            data-session-tool
            :class="TOOL_SQUARE"
            :tabindex="activeToolIndex === 0 ? 0 : -1"
            :variant="discardConfirm ? 'solid' : 'ghost'"
            :theme="discardConfirm ? 'red' : 'gray'"
            icon-left="trash-2"
            :tooltip="(discardConfirm ? 'Press again' : 'Discard') + ' · ' + (modKey || '⌘') + 'D'"
            :label="discardConfirm ? 'Press again to discard' : 'Discard without saving'"
            @click="emit('discard')"
          >
            <span class="hidden min-[480px]:inline">{{ discardConfirm ? 'Discard?' : 'Discard' }}</span>
          </Button>
          <Button
            data-session-tool
            :class="TOOL_SQUARE"
            :tabindex="activeToolIndex === 1 ? 0 : -1"
            variant="subtle"
            icon-left="clock"
            :tooltip="'Adjust times · ' + (modKey || '⌘') + 'E'"
            label="Adjust start or end time"
            @click="emit('adjust')"
          >
            <span class="hidden min-[480px]:inline">Adjust</span>
          </Button>
          <Button
            data-session-tool
            :class="TOOL_SQUARE"
            :tabindex="activeToolIndex === 2 ? 0 : -1"
            variant="solid"
            theme="red"
            icon-left="square"
            :tooltip="'Stop and save · ' + (modKey || '⌘') + 'S'"
            label="Stop the session"
            @click="emit('stop')"
          >
            <span class="hidden min-[480px]:inline">Stop</span>
          </Button>
        </div>
      </div>
    </section>

    <!-- Bound planned block: one line; the rest is in the hover title -->
    <div
      v-if="trackerBoundBlock"
      class="flex items-center gap-2 rounded-xl px-3 py-2 bg-blue-50 dark:bg-blue-950/40"
    >
      <FeatherIcon name="link-2" class="w-4 h-4 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
      <p class="min-w-0 flex-1 truncate text-sm text-blue-950 dark:text-blue-100" :title="[trackerBoundBlock.name, connectedTaskName, currentProjectLabel, trackerBoundBlock.work_date, trackerBoundBlock.task_nature, trackerBoundBlock.duration_hours ? trackerBoundBlock.duration_hours + 'h planned' : '', trackerBoundBlock.actual_hours ? trackerBoundBlock.actual_hours + 'h logged' : ''].filter(Boolean).join(' · ')">
        Logging to <span class="font-semibold">{{ blockTitle(trackerBoundBlock) }}</span>
      </p>
      <span class="shrink-0 text-xs tabular-nums text-blue-900 dark:text-blue-200">{{ formatCleanTime(trackerBoundBlock.start_time) }}–{{ formatCleanTime(trackerBoundBlock.end_time) }}</span>
      <Button variant="ghost" size="sm" icon="x" label="Unbind from this planned block" tooltip="Unbind" @click="emit('unbind-block')" />
    </div>

    <!-- What this session is for: the same task list a block shows, so a task is ticked,
         edited or moved through its workflow the same way everywhere. Bound to a block, it is
         that block's tasks; otherwise the session's own, which Stop puts on its new block. -->
    <BlockTasksSection :block="trackerBoundBlock || liveSessionBlock" :is-dark-mode="isDarkMode" />

    <!-- Project & activity: searchable frappe-ui Comboboxes. frappe-ui gives a Combobox
         trigger a fixed width, so each one is stretched to its column or it spills out. -->
    <div class="grid grid-cols-2 gap-2.5 [&_[data-slot=trigger]]:w-full">
      <div class="min-w-0">
        <span class="block text-xs font-medium mb-1.5 text-gray-800 dark:text-gray-200">Project</span>
        <Combobox
          open-on-click
          :model-value="projectComboValue"
          :options="projectComboOptions"
          placeholder="Search projects"
          aria-label="Project"
          @update:model-value="pickProject"
        />
      </div>
      <div class="min-w-0">
        <span class="block text-xs font-medium mb-1.5 text-gray-800 dark:text-gray-200">Activity</span>
        <Combobox
          open-on-click
          :model-value="natureComboValue"
          :options="natureComboOptions"
          placeholder="Search activity types"
          aria-label="Activity nature"
          @update:model-value="pickNature"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { Button, Combobox, FeatherIcon } from 'frappe-ui';
import BlockTasksSection from '../drawers/BlockTasksSection.vue';
import { useSessionContext } from './useSessionContext.js';
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { blockTitle } from '../utils/blockTitle.js';

// Under 480px the toolbar buttons are icon only. frappe-ui still renders their (hidden)
// label's wrapper and the 8px gap, which pushed each icon off centre: square them up.
const TOOL_SQUARE = 'max-[479px]:w-7 max-[479px]:px-0 max-[479px]:gap-0';

export default {
  name: 'SessionControlsPane',
  components: { BlockTasksSection, Button, Combobox, FeatherIcon },
  methods: { blockTitle },
  setup() {
    return {
      TOOL_SQUARE,
      ...useWorkstationContext(['liveSessionBlock']),
      ...useSessionContext([
        'activeToolIndex',
        'connectedTaskName',
        'currentProjectLabel',
        'discardConfirm',
        'emit',
        'formatCleanTime',
        'formattedDuration',
        'isDarkMode',
        'modKey',
        'natureComboOptions',
        'natureComboValue',
        'onToolbarKey',
        'pickNature',
        'pickProject',
        'projectComboOptions',
        'projectComboValue',
        'sessionStart',
        'toolbarRef',
        'trackerBoundBlock',
      ]),
    };
  },
};
</script>
