<template>
  <div class="rounded-2xl p-4 sm:p-5 border shadow-xs"
    :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
    <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
      <h4 class="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">Day at a glance</h4>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 text-[11px] font-semibold">
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm border border-gray-400 bg-gray-400/20" aria-hidden="true"></span><span class="text-gray-700 dark:text-gray-300">Planned {{ dayTimeline.plannedH.toFixed(1) }}h</span></span>
        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm bg-gray-500" aria-hidden="true"></span><span class="text-gray-700 dark:text-gray-300">Logged {{ dayTimeline.loggedH.toFixed(1) }}h</span></span>
        <span class="inline-flex items-center gap-1.5" title="Time logged when nothing was planned for it"><span class="w-3 h-2 rounded-sm bg-rose-500" aria-hidden="true"></span><span class="text-gray-700 dark:text-gray-300">Off plan</span></span>
        <span v-if="dayTimeline.gapH > 0.05" class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm bg-amber-400" aria-hidden="true"></span><span class="text-orange-700 dark:text-orange-300">{{ dayTimeline.gapH.toFixed(1) }}h unlogged</span></span>
        <span v-if="attendancePresence && attendancePresence.shift_presence_hours > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border" :class="attendancePresence.unallocated_presence_hours > 0.5 ? (isDarkMode ? 'bg-amber-950/60 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800') : (isDarkMode ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800')">
          <span>At work {{ attendancePresence.shift_presence_hours }}h</span>
          <span v-if="attendancePresence.unallocated_presence_hours > 0.5" class="ml-1">({{ attendancePresence.unallocated_presence_hours }}h unallocated)</span>
        </span>
        <div class="inline-flex items-center rounded-full p-0.5 border" role="radiogroup" aria-label="Hours visible across the timeline"
          @keydown="onTimelineZoomKey"
          :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-100 border-gray-200'">
          <button v-for="z in timelineZoomOptions" :key="z" type="button" role="radio"
            :aria-checked="timelineZoom === z ? 'true' : 'false'"
            :aria-label="z + ' hours across'"
            data-timeline-zoom
            :tabindex="timelineZoom === z ? 0 : -1"
            @click="timelineZoom = z"
            class="min-h-6 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            :class="timelineZoom === z ? (isDarkMode ? 'bg-[#1E1F22] text-white' : 'bg-white text-gray-900 shadow-xs') : (isDarkMode ? 'text-gray-600' : 'text-gray-700')">{{ z }}h</button>
        </div>
      </div>
    </div>
    <!-- Two named lines, not one band: what was planned, and under it what was
         actually logged. The gutter sits outside the scroller so the labels
         stay put while the day scrolls. -->
    <div class="flex gap-2">
    <div class="shrink-0 w-[52px] select-none text-[9px] font-bold uppercase tracking-wider pt-3.5"
      :class="isDarkMode ? 'text-gray-700' : 'text-gray-600'" aria-hidden="true">
      <div class="h-7 leading-7">Planned</div>
      <div class="h-6 leading-6 mt-1.5">Logged</div>
      <div class="h-4 mt-0.5"></div>
    </div>
    <!-- The day is wider than the card, and a hidden scrollbar gives no hint
         of that. Show a real button on each side that can still be scrolled,
         so the affordance is visible and operable by keyboard (WCAG 2.1.1). -->
    <div class="relative flex-1 min-w-0">
    <button v-if="timelineCanScrollLeft" type="button" @click="nudgeTimeline(-1)"
      aria-label="Scroll timeline to earlier hours"
      class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      :class="isDarkMode ? 'bg-[#1E1F22]/90 border-gray-700 text-gray-300 hover:bg-gray-800' : 'bg-white/90 border-gray-200 text-gray-600 hover:bg-gray-50'">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button v-if="timelineCanScrollRight" type="button" @click="nudgeTimeline(1)"
      aria-label="Scroll timeline to later hours"
      class="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      :class="isDarkMode ? 'bg-[#1E1F22]/90 border-gray-700 text-gray-300 hover:bg-gray-800' : 'bg-white/90 border-gray-200 text-gray-600 hover:bg-gray-50'">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <div ref="timelineScroller" @scroll="syncTimelineEdges" class="overflow-x-auto no-scrollbar w-full -mr-1 pr-1 pt-3.5">
    <div class="relative" role="img" :style="{ width: timelineTrackWidth }"
      :aria-label="dayTimeline.plannedH.toFixed(1) + ' hours planned and ' + dayTimeline.loggedH.toFixed(1) + ' hours logged on ' + selectedDashboardDateLabel">
      <!-- hour grid -->
      <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div v-for="t in dayTimeline.ticks" :key="'t' + t.m" class="absolute top-0 bottom-4 w-px"
          :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'" :style="{ left: t.left }"></div>
      </div>

      <!-- Current Time Red Line (When viewing today) -->
      <div v-if="selectedDashboardDate === todayDate"
        class="absolute top-0 bottom-4 pointer-events-none z-20"
        :style="{ left: ((nowMinute / 1440) * 100) + '%' }"
        aria-hidden="true">
        <div class="relative h-full flex flex-col items-center">
          <!-- Time badge on top -->
          <span class="absolute -top-3.5 -translate-x-1/2 text-[9px] font-bold font-mono px-1 py-0.5 rounded bg-red-500 text-white shadow-xs whitespace-nowrap">
            {{ nowLineLabel }}
          </span>
          <!-- Red dot at top of vertical line -->
          <span class="w-2 h-2 -mt-0.5 rounded-full bg-red-500 shadow-xs shrink-0"></span>
          <!-- Crisp red vertical line through planned and logged lanes -->
          <div class="w-[2px] flex-1 bg-red-500 shadow-xs"></div>
        </div>
      </div>
      <!-- planned lane -->
      <div class="relative h-7">
        <div v-for="(r, i) in dayTimeline.planned" :key="'p' + i"
          class="absolute top-0 h-7 rounded-md border text-[10px] font-bold px-1.5 leading-7 truncate cursor-pointer hover:brightness-95"
          :style="Object.assign({ left: r.left, width: r.width }, timelinePlannedStyle(r.block))"
          tabindex="0"
          :aria-label="blockTitle(r.block) + ' ' + formatBlockRange(r.block)"
          @mouseenter="showBlockHover($event, r, 'timeline')"
          @mouseleave="hideBlockHover"
          @focus="showBlockHover($event, r, 'timeline')"
          @blur="hideBlockHover"
          @keydown.enter.prevent="openBlockDrawer(r.block)"
          @click="openBlockDrawer(r.block)">{{ blockTitle(r.block, 'Block') }}</div>
      </div>
      <!-- logged lane -->
      <div class="relative h-6 mt-1.5">
        <div v-for="(r, i) in dayTimeline.logged" :key="'l' + i"
          class="absolute top-0 h-6 rounded-md text-[10px] font-bold text-white px-2 leading-6 truncate cursor-pointer hover:brightness-110 shadow-xs flex items-center select-none"
          :class="r.is_live_active ? 'rounded-r-none z-10' : ''"
          :style="Object.assign({ left: r.left, width: r.width }, timelineLoggedStyle(r))"
          tabindex="0"
          :aria-label="'Logged: ' + loggedName(r) + ', ' + loggedLength(r) + (r.is_live_active ? ', live' : '')"
          @mouseenter="showBlockHover($event, r, 'logged')"
          @mouseleave="hideBlockHover"
          @focus="showBlockHover($event, r, 'logged')"
          @blur="hideBlockHover"
          @keydown.enter.prevent="openLogged(r)"
          @click="openLogged(r)">
          <span v-if="r.is_live_active" class="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1.5 shrink-0"></span>
          <span class="truncate">{{ loggedName(r) }}</span>
        </div>
        <!-- Interactive 1-Click Gap Booking Pills -->
        <div v-for="(g, gi) in (dayTimeline.gaps || [])" :key="'gap' + gi"
          class="absolute top-0 h-6 rounded-md border border-dashed text-[9px] font-bold px-1.5 leading-6 truncate cursor-pointer hover:scale-102 transition-transform flex items-center justify-center select-none z-10"
          :class="isDarkMode ? 'border-amber-700/80 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60' : 'border-amber-300 bg-amber-50/90 text-amber-800 hover:bg-amber-100'"
          :style="{ left: g.left, width: g.width }"
          tabindex="0"
          :title="'Click to quickly log ' + g.label + ' (' + g.from_time + '–' + g.to_time + ')'"
          :aria-label="'Quickly log ' + g.label"
          @keydown.enter.prevent="quickLogTimelineGap(g)"
          @click.stop="quickLogTimelineGap(g)">
          <span>{{ g.label }}</span>
        </div>
        <div v-if="!dayTimeline.logged.length"
          class="absolute inset-0 rounded-md border border-dashed flex items-center justify-center text-[10px] font-semibold"
          :class="isDarkMode ? 'border-amber-800 text-amber-400' : 'border-amber-300 text-amber-600'">No sessions logged</div>
      </div>
      <!-- hour labels -->
      <div class="relative h-4 mt-0.5" aria-hidden="true">
        <span v-for="t in dayTimeline.ticks" :key="'lb' + t.m"
          class="absolute -translate-x-1/2 text-[9px] font-mono text-gray-600" :style="{ left: t.left }">{{ t.label }}</span>
      </div>
    </div>
    </div>
    </div>
    </div>
  </div>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import { blockTitle } from '../../utils/blockTitle.js';
import { noteHeading } from '../../utils/wrapNote.js';
import { durationLabel } from '../../utils/clockTime.js';

export default {
  name: 'DashboardTimeline',
  methods: {
    blockTitle,
    // A logged bar is named like its block, never by its whole notes (they start with that name
    // and go on with every step); the hover card lists the steps.
    loggedName(r) {
      return blockTitle(r.block, '') || noteHeading(r.notes) || (r.timesheet ? 'ERPNext Timesheet ' + r.timesheet : 'Logged work');
    },
    loggedLength(r) { return durationLabel(Math.max(1, Math.round((Number(r.hours) || 0) * 60))); },
    // Each lane opens what it draws. A planned bar is the block; a logged bar is one
    // session of it, so it opens that session's details, and the running bar opens the live one.
    openLogged(r) {
      if (r.is_live_active) this.openAdjustModal();
      else if (r.session && r.session.name) this.openSessionDrawer(r.block, r.session);
      else this.openBlockDrawer(r.block);
    },
  },
  setup() {
    return useWorkstationContext([
      'attendancePresence',
      'dayTimeline',
      'formatBlockRange',
      'hideBlockHover',
      'isDarkMode',
      'nowLineLabel',
      'nowMinute',
      'nudgeTimeline',
      'openAdjustModal',
      'onTimelineZoomKey',
      'openBlockDrawer',
      'openSessionDrawer',
      'quickLogTimelineGap',
      'selectedDashboardDate',
      'selectedDashboardDateLabel',
      'showBlockHover',
      'syncTimelineEdges',
      'timelineCanScrollLeft',
      'timelineCanScrollRight',
      'timelineLoggedStyle',
      'timelinePlannedStyle',
      'timelineScroller',
      'timelineTrackWidth',
      'timelineZoom',
      'timelineZoomOptions',
      'todayDate'
    ]);
  },
};
</script>
