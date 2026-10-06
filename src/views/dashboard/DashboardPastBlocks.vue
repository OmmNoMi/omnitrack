<template>
  <section class="space-y-2" aria-labelledby="past-blocks-heading">
    <div class="flex items-baseline justify-between gap-3 px-1">
      <h3 id="past-blocks-heading" class="text-base font-semibold text-gray-900 dark:text-white">{{ pastBlocksHeading }}</h3>
      <p class="text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ tally }}</p>
    </div>

    <!-- A Material list: one row per block, a chip only when something is off, notes in one line
         (full text on hover, everything else in the drawer). Arrow keys rove the rows and actions. -->
    <div class="omni-card omni-card--flush overflow-hidden">
      <div
        role="grid"
        :aria-rowcount="visiblePastFocusBlocks.length"
        :aria-label="pastBlocksHeading + '. Arrow keys move between blocks and their actions.'"
        class="divide-y divide-gray-200 dark:divide-gray-800">
        <div
          v-for="(b, rIdx) in visiblePastFocusBlocks"
          :key="b.name"
          role="row"
          :aria-rowindex="rIdx + 1"
          @click="openBlockDrawer(b)"
          class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/5">
          <div role="gridcell" class="min-w-0 flex-1 basis-60">
            <button
              type="button"
              @click.stop="openBlockDrawer(b)"
              :title="rowTitle(b)"
              :tabindex="concludedTabindex(rIdx, 0)"
              :data-concluded-row="rIdx"
              :data-concluded-col="0"
              @focus="setConcludedRoving(rIdx, 0)"
              @keydown="onConcludedGridKey($event, rIdx, 0)"
              class="block max-w-full truncate text-left text-base font-semibold text-gray-900 dark:text-white rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer">
              {{ rowTitle(b) }}
            </button>
            <p class="mt-0.5 truncate text-sm text-gray-700 dark:text-gray-300 tabular-nums">
              <span v-if="b.work_date && selectedDashboardDate && b.work_date !== selectedDashboardDate">From {{ b.work_date }} · </span>{{ formatBlockRange(b) }}<span v-if="b.project_name || b.project"> · {{ b.project_name || b.project }}</span>
            </p>
            <p v-if="concludedRowNote(b)" class="mt-0.5 truncate text-sm text-gray-700 dark:text-gray-300" :title="concludedRowNote(b)">
              {{ concludedRowNote(b) }}
            </p>
          </div>

          <div role="gridcell" class="flex items-center gap-3 shrink-0 ml-auto">
            <span v-if="concludedRowHours(b)" class="text-sm font-medium text-gray-900 dark:text-white tabular-nums" :title="'Logged ' + concludedRowHours(b) + ' of ' + Number(b.duration_hours || 0).toFixed(1) + 'h planned'">
              {{ concludedRowHours(b) }}
            </span>
            <Badge v-if="concludedRowStatus(b)" :theme="concludedRowStatus(b).theme" variant="subtle" size="md">
              {{ concludedRowStatus(b).label }}
            </Badge>
          </div>

          <div v-if="canReopen(b)" role="gridcell" class="shrink-0">
            <Button
              variant="ghost"
              theme="gray"
              size="sm"
              @click.stop="startFocusBlock(b)"
              :tabindex="concludedTabindex(rIdx, 1)"
              :data-concluded-row="rIdx"
              :data-concluded-col="1"
              @focus="setConcludedRoving(rIdx, 1)"
              @keydown="onConcludedGridKey($event, rIdx, 1)"
              label="Re-open"
              tooltip="Start another session" />
          </div>
        </div>
      </div>

      <div v-if="pastFocusBlocks.length > 2" class="border-t border-gray-200 dark:border-gray-800 px-2 py-1.5">
        <Button
          variant="ghost"
          theme="gray"
          size="sm"
          class="w-full"
          @click="toggleShowAllPastBlocks"
          :aria-expanded="showAllPastBlocks ? 'true' : 'false'"
          :label="showAllPastBlocks ? 'Show less' : ('Show ' + remainingPastBlocksCount + ' more')">
          <template #suffix>
            <FeatherIcon :name="showAllPastBlocks ? 'chevron-up' : 'chevron-down'" class="w-4 h-4" aria-hidden="true" />
          </template>
          {{ showAllPastBlocks ? 'Show less' : 'Show ' + remainingPastBlocksCount + ' more' }}
        </Button>
      </div>
    </div>
  </section>
</template>

<script>
import { computed } from 'vue';
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import { concludedRowStatus, concludedRowHours, concludedRowNote, concludedTally } from '../../utils/concludedRow.js';
import { blockTitle } from '../../utils/blockTitle.js';

export default {
  name: 'DashboardPastBlocks',
  setup() {
    const ctx = useWorkstationContext([
      'canBlockReopen',
      'countedNow',
      'concludedTabindex',
      'formatBlockRange',
      'onConcludedGridKey',
      'openBlockDrawer',
      'pastBlocksHeading',
      'pastFocusBlocks',
      'remainingPastBlocksCount',
      'selectedDashboardDate',
      'setConcludedRoving',
      'showAllPastBlocks',
      'startFocusBlock',
      'todayDate',
      'toggleShowAllPastBlocks',
      'visiblePastFocusBlocks'
    ]);
    const tally = computed(() => concludedTally(ctx.pastFocusBlocks.value, ctx.countedNow.value));
    const rowTitle = (b) => blockTitle(b);
    // Another session belongs to today only; an earlier day's plan is closed.
    const canReopen = (b) => ctx.canBlockReopen(b) && ctx.selectedDashboardDate.value === ctx.todayDate.value;
    // Rows read counted hours against the live clock (countedNow), so a row changes as time passes.
    const now = () => ctx.countedNow.value;
    return {
      ...ctx, tally, rowTitle, canReopen, concludedRowNote,
      concludedRowStatus: (b) => concludedRowStatus(b, now()),
      concludedRowHours: (b) => concludedRowHours(b, now()),
    };
  },
};
</script>
