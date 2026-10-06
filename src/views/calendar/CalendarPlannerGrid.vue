<template>
  <div :class="['omni-card', 'omni-card--flush']" class="-mx-3 sm:mx-0 rounded-none sm:rounded-3xl border-x-0 sm:border-x overflow-hidden flex flex-col min-h-0 h-[640px] lg:h-full lg:max-h-full lg:min-h-0 order-1 lg:order-2">
    <!-- toolbar (Frappe UI Controls) -->
    <div class="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 border-b transition-colors" :class="isDarkMode ? 'border-gray-800 bg-[#25262A]' : 'border-gray-200 bg-gray-50/60'">
      
      <!-- Left: Today Button, Period Navigation Chevrons, Date Range -->
      <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
        <!-- Jump to Today Button -->
        <Button 
          variant="subtle" 
          theme="gray" 
          size="sm" 
          @click="plannerToday" 
          label="Jump to current date in calendar"
        >
          Today
        </Button>

        <!-- Grouped Navigation Chevrons -->
        <div class="inline-flex items-center rounded-xl border p-0.5 shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-white border-gray-300'" role="group" aria-label="Calendar period navigation">
          <Button variant="ghost" size="sm" icon="chevron-left" @click="plannerShift(-1)"
            :label="'Previous ' + (plannerView === 'day' ? 'day' : (plannerView === '4days' ? '4 days' : 'week'))" />

          <div class="w-[1px] h-4 mx-1" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" aria-hidden="true"></div>

          <h3 class="text-xs sm:text-sm font-extrabold tracking-tight text-center px-2 tabular-nums whitespace-nowrap flex-1 sm:flex-none sm:w-[168px]" :class="isDarkMode ? 'text-white' : 'text-gray-900'" aria-live="polite">
            {{ plannerRangeLabel }}
          </h3>

          <div class="w-[1px] h-4 mx-1" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" aria-hidden="true"></div>

          <Button variant="ghost" size="sm" icon="chevron-right" @click="plannerShift(1)"
            :label="'Next ' + (plannerView === 'day' ? 'day' : (plannerView === '4days' ? '4 days' : 'week'))" />
        </div>

      </div>

      <!-- Right: Nature Filter & View Switcher (Day / 4 Days / Week) -->
      <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">

        <!-- Nature filter -->
        <Dropdown :options="plannerNatureMenuItems" align="end">
          <Button
            :variant="natureFilter.length ? 'subtle' : 'outline'"
            :theme="natureFilter.length ? 'blue' : 'gray'"
            size="sm"
            icon-right="chevron-down"
            class="max-w-[200px]"
            :label="'Filter calendar events by activity. Current filter: ' + natureFilterLabel"
          >
            <span class="truncate">{{ natureFilterLabel }}</span>
          </Button>
        </Dropdown>


        <!-- View Switcher: Day / 4 Days / Week (Frappe UI Button Group) -->
        <div class="inline-flex items-center rounded-xl p-0.5 border shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-gray-100 border-gray-300'" role="radiogroup" aria-label="Calendar view density" @keydown="onPlannerViewKey">
          <Button 
            size="sm"
            :variant="plannerView === 'day' ? 'solid' : 'ghost'"
            :theme="plannerView === 'day' ? 'blue' : 'gray'"
            class="!px-2.5 !py-1 !text-xs font-bold"
            role="radio" 
            data-planner-view
            :tabindex="plannerView === 'day' ? 0 : -1"
            :aria-checked="plannerView === 'day'"
            @click="setUserPlannerView('day')"
          >
            Day
          </Button>
          <Button 
            size="sm"
            :variant="plannerView === '4days' ? 'solid' : 'ghost'"
            :theme="plannerView === '4days' ? 'blue' : 'gray'"
            class="!px-2.5 !py-1 !text-xs font-bold"
            role="radio" 
            data-planner-view
            :tabindex="plannerView === '4days' ? 0 : -1"
            :aria-checked="plannerView === '4days'"
            @click="setUserPlannerView('4days')"
          >
            4 Days
          </Button>
          <Button 
            size="sm"
            :variant="plannerView === 'week' ? 'solid' : 'ghost'"
            :theme="plannerView === 'week' ? 'blue' : 'gray'"
            class="!px-2.5 !py-1 !text-xs font-bold"
            role="radio" 
            data-planner-view
            :tabindex="plannerView === 'week' ? 0 : -1"
            :aria-checked="plannerView === 'week'"
            @click="setUserPlannerView('week')"
          >
            Week
          </Button>
        </div>
      </div>
    </div>

    <!-- Banners & Feedback -->
    <div v-if="pastBookingHint" class="px-3 py-2 text-[11px] font-semibold flex items-center gap-2 border-b" :class="isDarkMode ? 'bg-amber-950/60 text-amber-200 border-amber-900/50' : 'bg-amber-50 text-amber-800 border-amber-200'" role="status">
      <FeatherIcon name="lock" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{{ pastBookingHint }}</span>
    </div>
    <div v-if="pickedTask" class="px-3 py-2 text-[11px] flex items-center justify-between gap-2 border-b" :class="isDarkMode ? 'bg-blue-950/50 text-blue-200 border-blue-900/50' : 'bg-blue-50 text-blue-700 border-blue-200'">
      <div class="flex items-center gap-2">
        <FeatherIcon name="map-pin" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span><b>{{ pickedTask.subject }}</b>: pick a time slot to place it.</span>
      </div>
      <Button variant="ghost" theme="blue" size="sm" label="Stop placing this task" @click="pickedTask = null">Cancel</Button>
    </div>

    <!-- grid -->
    <div class="overflow-x-auto flex-1 min-h-0 flex flex-col">
      <div class="flex-1 min-h-0 flex flex-col" :class="plannerView === 'day' ? 'w-full min-w-0' : (plannerView === '4days' ? 'w-full min-w-[500px]' : 'min-w-[640px]')">
        <!-- day headers -->
        <div class="grid border-b shrink-0" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
          <div></div>
          <div v-for="d in plannerDays" :key="d" class="text-center py-2">
            <div class="text-[11px] font-medium" :class="d === todayDate ? 'text-blue-600' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')">{{ dowLabel(d) }}</div>
            <div class="mx-auto mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold tabular-nums" :class="d === todayDate ? 'bg-[#1B64DA] text-white' : (isDarkMode ? 'text-gray-100' : 'text-gray-900')">{{ domLabel(d) }}</div>
          </div>
        </div>
        <!-- all-day / away row -->
        <div v-if="hasAwayBlocksInView" class="grid border-b text-[11px] shrink-0" :class="isDarkMode ? 'border-gray-800 bg-[#161719]' : 'border-gray-200 bg-gray-50/80'" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
          <div class="flex items-center justify-end pr-2 text-[10px] font-medium" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">All day</div>
          <div v-for="d in plannerDays" :key="'away-' + d" class="border-l p-1 min-h-[34px] min-w-0 flex flex-col gap-1 overflow-hidden" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <button type="button" v-for="b in awayBlocksForDay(d)" :key="b.name"
              @click="openBlockDrawer(b)"
              :title="[getNatureBadge(b.task_nature).label, b.deliverable_notes, 'Not paid'].filter(Boolean).join(' · ')"
              class="w-full text-left rounded-md px-2 py-1 text-[10px] font-semibold truncate border cursor-pointer transition-transform hover:scale-[1.01] shadow-2xs flex items-center justify-between gap-1"
              :class="isDarkMode ? 'bg-amber-950/60 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-800'">
              <span class="truncate">{{ getNatureBadge(b.task_nature).label }}</span>
            </button>
          </div>
        </div>
        <!-- hour rows (full 24h, scrollable; opens scrolled to ~7a) -->
        <div ref="plannerGridScroll" class="overflow-y-auto overscroll-contain flex-1 min-h-0"
          @touchstart="onPlannerTouchStart" @touchend="onPlannerTouchEnd"
          style="scrollbar-gutter: stable;">
        <div class="relative" :style="{ height: (plannerHours.length * 44) + 'px' }">
          <div class="absolute inset-0 grid" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
            <!-- hour gutter -->
            <div class="relative">
              <div v-for="(h, i) in plannerHours" :key="h" class="absolute left-0 right-1 text-[10px] text-right -translate-y-1/2" :class="isDarkMode ? 'text-gray-400' : 'text-gray-700'" :style="{ top: (i * 44) + 'px' }">{{ hourLabel(h) }}</div>
            </div>
            <!-- day columns -->
            <div v-for="d in plannerDays" :key="d" data-day-col class="relative border-l" :class="isDarkMode ? 'border-gray-700' : 'border-gray-300'">
              <!-- away day: stretch the all-day record across office hours -->
              <div v-for="b in awayBlocksForDay(d)" :key="'awayband-' + b.name"
                class="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed pointer-events-none z-0 flex items-center justify-center"
                :class="isDarkMode ? 'bg-amber-950/40 border-amber-800/70' : 'bg-amber-100/70 border-amber-300'"
                :style="officeBandStyle" aria-hidden="true">
                <span class="text-[11px] font-semibold"
                  :class="isDarkMode ? 'text-amber-300' : 'text-amber-700'">{{ getNatureBadge(b.task_nature).label }}</span>
              </div>
              <!-- past time is shaded, so the eye avoids booking behind the now-line -->
              <div class="absolute left-0 right-0 pointer-events-none z-0" :class="isDarkMode ? 'bg-black/35' : 'bg-gray-900/[0.07]'" :style="pastShadeStyle(d)" aria-hidden="true"></div>
              <!-- office start/end: two hairlines instead of a banner above the grid -->
              <div v-for="m in officeMarks" :key="'om-' + d + m.kind"
                class="absolute left-0 right-0 border-t-2 pointer-events-none z-0"
                :class="isDarkMode ? 'border-emerald-500/40' : 'border-emerald-500/50'"
                :style="{ top: m.top }" :aria-hidden="true"></div>
              <div v-for="(h, i) in plannerHours" :key="h"
                class="absolute left-0 right-0 border-t cursor-cell transition-colors touch-pan-y select-none"
                :class="[isDarkMode ? 'border-gray-700 hover:bg-blue-950/30' : 'border-gray-300 hover:bg-blue-50/60']"
                :style="{ top: (i * 44) + 'px', height: '44px' }"
                role="button"
                :aria-label="'Book work on ' + d + ' at ' + hourLabel(h) + ' — drag to cover more hours'"
                tabindex="0"
                draggable="false"
                @dragstart.prevent
                @pointerdown="startSlotSelect($event, d)"
                @click="openBookModal(d, h)"
                @keydown.enter.prevent="openBookModal(d, h)"
                @keydown.space.prevent="openBookModal(d, h)">
                <!-- half-hour tick: faint, so the 30-min mark is readable -->
                <div class="absolute left-0 right-0 top-1/2 border-t border-dashed pointer-events-none"
                  :class="isDarkMode ? 'border-gray-800/70' : 'border-gray-200'" aria-hidden="true"></div>
              </div>
              <!-- drag-to-select ghost -->
              <div v-if="slotSel && slotSel.iso === d" class="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed pointer-events-none z-10 flex items-start justify-center pt-0.5"
                :class="isDarkMode ? 'border-blue-500 bg-blue-500/20' : 'border-blue-500 bg-blue-500/10'"
                :style="slotSelStyle">
                <span class="text-[9px] font-bold text-blue-600 dark:text-blue-300">{{ slotSelLabel }}</span>
              </div>
              <!-- current-time line (today only), like Google Calendar -->
              <div v-if="isTodayCol(d)" class="absolute left-0 right-0 pointer-events-none z-20" :style="{ top: nowLineTop + 'px' }" aria-hidden="true">
                <div class="relative h-0 border-t-2 border-red-500">
                  <span class="absolute -left-1 -top-[5px] w-2.5 h-2.5 rounded-full bg-red-500 shadow"></span>
                  <span class="absolute right-0.5 -top-[9px] text-[9px] font-bold font-mono px-1 rounded bg-red-500 text-white">{{ nowLineLabel }}</span>
                </div>
              </div>
              <!-- timed blocks with smart overlapping sub-lanes and midnight continuation -->
              <div role="button" tabindex="0" v-for="seg in timedSegmentsForDay(d)" :key="seg.key"
                draggable="false"
                @dragstart.prevent
                @pointerdown="startBlockDrag($event, seg.block, 'move')"
                @click.stop="onBlockClick(seg.block)"
                @keydown.enter.prevent="openBlockDrawer(seg.block)"
                @keydown.space.prevent="openBlockDrawer(seg.block)"
                @pointerenter="showBlockHover($event, seg)"
                @pointerleave="hideBlockHover"
                @focus="showBlockHover($event, seg)"
                @blur="hideBlockHover"
                :aria-label="(seg.block.task_subject || seg.block.work_item_label || seg.block.deliverable_notes || 'Work block') + ' ' + segTimeTitle(seg)"
                class="absolute rounded-lg px-2 py-1 text-left overflow-hidden border touch-pan-y select-none hover:z-20 transition-[left,width] duration-75"
                :class="[blockClass(seg.block), isBlockLocked(seg.block) ? 'cursor-pointer' : ((plannerDrag && plannerDrag.name === seg.block.name) ? 'cursor-grabbing' : 'cursor-grab'), holdArmed === seg.block.name ? 'ring-2 ring-blue-500 ring-offset-1 z-30 scale-[1.02]' : '']"
                :style="segStyle(seg)">
                <!-- recorded (timesheet) time filling up from the bottom of the planned block -->
                <div v-if="seg.block.actual_hours > 0 && seg.block.status !== 'Cancelled' && !seg.block.is_away"
                  class="absolute left-0 right-0 bottom-0 pointer-events-none rounded-b-lg"
                  :class="seg.block.actual_hours > seg.block.duration_hours ? 'bg-rose-500/25 border-t-2 border-rose-500' : 'bg-emerald-500/30 border-t-2 border-emerald-500'"
                  :style="{ height: Math.min(100, (seg.block.actual_hours / (parseFloat(seg.block.duration_hours) || seg.block.actual_hours) * 100)) + '%' }"
                  :title="fmtHrs(seg.block.actual_hours) + 'h recorded of ' + fmtHrs(seg.block.duration_hours) + 'h planned'"></div>
                <!-- Live recording fill bar when session is actively tracking on this block -->
                <div v-if="isTracking && (trackerBlockName === seg.block.name || seg.block.is_live_active)"
                  class="absolute left-0 right-0 bottom-0 pointer-events-none rounded-b-lg bg-red-500/25 border-t-2 border-red-500"
                  :style="{ height: Math.min(100, Math.max(8, ((trackerSeconds / 3600) / (parseFloat(seg.block.duration_hours) || 1) * 100))) + '%' }"
                  :title="'Live Recording: ' + formattedTime + ' elapsed'"></div>
                <!-- Timesheet status: one dot clipped inside the card, so narrow lanes never spill -->
                <span v-if="approvalDot(seg.block)" class="absolute top-1 right-1 w-2 h-2 rounded-full ring-1 ring-white/70 pointer-events-none" :class="approvalDot(seg.block).cls" :title="approvalDot(seg.block).title" aria-hidden="true"></span>
                <div class="relative text-[11px] font-semibold leading-tight truncate pr-2.5">
                  <span v-if="isLive(seg.block)" class="font-mono font-bold text-red-600">{{ formattedTime }} · </span>
                  <span v-if="seg.is_segment && seg.segment_type === 'head'" class="font-normal opacity-80">(cont.) </span>{{ seg.block.task_subject || seg.block.work_item_label || seg.block.deliverable_notes || 'Work block' }}
                </div>
                <div class="relative text-[10px] opacity-90 truncate">{{ dragTimeLabel(seg) }}</div>
                <div class="relative text-[10px] opacity-90 truncate" v-if="segHeight(seg) > 44">
                  <template v-if="isLive(seg.block)">{{ fmtHrs(trackerSeconds / 3600) }} of {{ fmtHrs(seg.block.duration_hours) }}h</template>
                  <template v-else>{{ fmtHrs(seg.block.actual_hours) }} of {{ fmtHrs(seg.block.duration_hours) }}h</template>
                  <template v-if="seg.block.pairing_partner"> · with {{ seg.block.pairing_partner_name || seg.block.pairing_partner }}</template>
                </div>
                <div v-if="!isBlockLocked(seg.block)" @pointerdown.stop="startBlockDrag($event, seg.block, 'resize-start')"
                  class="absolute left-0 right-0 top-0 h-2 cursor-ns-resize" aria-hidden="true"
                  title="Drag to change the start time"></div>
                <div v-if="!isBlockLocked(seg.block)" @pointerdown.stop="startBlockDrag($event, seg.block, 'resize')"
                  class="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize" aria-hidden="true"
                  title="Drag to change the end time"></div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>  <!-- /overflow-x-auto -->
  </div>  <!-- /planner calendar card -->
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

export default {
  name: 'CalendarPlannerGrid',
  methods: {
    isLive(b) { return this.isTracking && (this.trackerBlockName === b.name || b.is_live_active); },
    approvalDot(b) {
      if (b.approval_status === 'Approved') return { cls: 'bg-emerald-500', title: 'Timesheet approved' };
      if (b.approval_status === 'Flagged') return { cls: 'bg-orange-500', title: 'Timesheet flagged: ' + (b.flagged_reason || 'needs clarifying') };
      if (Number(b.actual_hours) > 0) return { cls: 'bg-blue-500', title: 'Timesheet awaiting approval' };
      return null;
    },
  },
  setup() {
    return useWorkstationContext([
      'awayBlocksForDay',
      'blockClass',
      'domLabel',
      'dowLabel',
      'dragTimeLabel',
      'fmtHrs',
      'formattedTime',
      'getNatureBadge',
      'hasAwayBlocksInView',
      'hideBlockHover',
      'holdArmed',
      'hourLabel',
      'isBlockLocked',
      'isDarkMode',
      'isTodayCol',
      'isTracking',
      'natureFilter',
      'natureFilterLabel',
      'nowLineLabel',
      'nowLineTop',
      'officeBandStyle',
      'officeMarks',
      'onBlockClick',
      'onPlannerTouchEnd',
      'onPlannerTouchStart',
      'onPlannerViewKey',
      'openBlockDrawer',
      'openBookModal',
      'pastBookingHint',
      'pastShadeStyle',
      'pickedTask',
      'plannerDays',
      'plannerDrag',
      'plannerGridScroll',
      'plannerHours',
      'plannerNatureMenuItems',
      'plannerRangeLabel',
      'plannerShift',
      'plannerToday',
      'plannerView',
      'segHeight',
      'segStyle',
      'segTimeTitle',
      'setUserPlannerView',
      'showBlockHover',
      'slotSel',
      'slotSelLabel',
      'slotSelStyle',
      'startBlockDrag',
      'startSlotSelect',
      'timedSegmentsForDay',
      'todayDate',
      'trackerBlockName',
      'trackerSeconds'
    ]);
  },
};
</script>
