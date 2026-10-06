<template>
  <div class="space-y-3">
    <!-- Accomplishment Header & Executive Tally -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
      <div class="flex items-center gap-2.5">
        <span class="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <div>
          <h4 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>{{ pastBlocksHeading }}</span>
          </h4>
        </div>
      </div>

      <!-- Executive Accomplishment Tally (Frappe UI FBadge) -->
      <div class="flex items-center gap-2 flex-wrap text-xs">
        <Badge theme="green" variant="subtle" size="sm">
          {{ pastDeliverablesStats.completedCount }} Completed
        </Badge>
        <Badge v-if="pastDeliverablesStats.cancelledCount > 0" theme="red" variant="subtle" size="sm">
          {{ pastDeliverablesStats.cancelledCount }} Cancelled
        </Badge>
        <Badge theme="gray" variant="subtle" size="sm">
          ⏱️ {{ pastDeliverablesStats.totalLogged }}h Logged
        </Badge>
        <Badge v-if="pastDeliverablesStats.totalPlanned > 0" theme="blue" variant="subtle" size="sm">
          {{ pastDeliverablesStats.adherencePct }}% Adherence
        </Badge>
      </div>
    </div>

    <!-- List of Completed / Concluded Blocks (Frappe UI FCard) -->
    <div 
      role="grid" 
      class="space-y-3.5"
      :aria-rowcount="visiblePastFocusBlocks.length"
      aria-colcount="4"
      aria-label="Daily accomplishments and concluded deliverables. Use arrow keys to navigate between cards and actions.">
      <div 
        v-for="(b, rIdx) in visiblePastFocusBlocks" 
        :key="b.name"
        role="row"
        :aria-rowindex="rIdx + 1"
        @click="openBlockDrawer(b)"
        :class="['omni-card', 'omni-card--' + getBlockCardAccent(b)]" class="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500/30">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1.5 flex-1 min-w-0">
            <!-- Badges & Taxonomy Row -->
            <div class="flex items-center gap-2 flex-wrap">
              <Badge theme="gray" variant="outline" size="sm">
                <span v-if="b.work_date && selectedDashboardDate && b.work_date !== selectedDashboardDate" class="text-blue-500 font-bold mr-1">↩ (cont.)</span>
                {{ formatBlockRange(b) }}
              </Badge>

              <!-- Dynamic Status Pill -->
              <Badge :theme="getBlockBadgeTheme(b)" variant="subtle" size="sm">
                {{ getBlockTimingInfo(b).label }}
              </Badge>

              <Badge v-if="b.task_nature" theme="gray" variant="outline" size="sm">
                {{ getNatureBadge(b.task_nature).label }}
              </Badge>

              <Badge v-if="b.project_name || b.project" theme="blue" variant="subtle" size="sm">
                📁 {{ b.project_name || b.project }}
              </Badge>
            </div>

            <!-- Block Title (Column 0 in Roving Tabindex) -->
            <h4 class="text-base sm:text-lg font-bold leading-snug">
              <button
                type="button"
                @click.stop="openBlockDrawer(b)"
                :title="'View audit details for ' + (b.task_subject || b.deliverable_notes || 'Focus Work Block')"
                :tabindex="concludedTabindex(rIdx, 0)"
                :data-concluded-row="rIdx"
                :data-concluded-col="0"
                @focus="setConcludedRoving(rIdx, 0)"
                @keydown="onConcludedGridKey($event, rIdx, 0)"
                class="text-left font-bold hover:underline hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer text-gray-900 dark:text-white">
                <span>{{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}</span>
                <span class="text-xs font-normal text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">View audit →</span>
              </button>
            </h4>

            <!-- Plan vs Actual Metadata Metrics -->
            <div class="flex items-center gap-2.5 text-xs text-gray-700 dark:text-gray-300 flex-wrap">
              <Badge v-if="b.task" theme="blue" variant="outline" size="sm">
                📋 Task: {{ b.task }}
              </Badge>
              <span>👤 {{ b.associate_name || b.employee }}</span>
              <span aria-hidden="true">·</span>
              <span>Planned: <strong class="font-mono font-bold" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
              <span aria-hidden="true">·</span>
              <span v-if="b.status === 'Cancelled'" class="font-bold text-rose-500">
                Cancelled ({{ b.cancel_reason || 'Client No-Show' }})
              </span>
              <span v-else-if="blockLogState(b) === 'none'" class="font-bold text-amber-500">
                Nothing logged
              </span>
              <span v-else>
                Logged: <strong class="font-mono font-bold" :class="blockLogState(b) === 'over' ? 'text-purple-500' : (isDarkMode ? 'text-gray-200' : 'text-gray-800')">{{ Number(b.actual_hours || 0).toFixed(1) }}h</strong>
              </span>
              <!-- Variance Chip -->
              <Badge v-if="getBlockVarianceBadge(b)" :theme="getBlockVarianceBadge(b).theme" variant="subtle" size="sm">
                {{ getBlockVarianceBadge(b).label }}
              </Badge>
            </div>
          </div>

          <!-- Actions Cluster (Frappe UI FButton) -->
          <div class="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <!-- 1-Click Plan-to-Actuals Catch-Up Action (Pillar 1) -->
            <Button
              v-if="blockLogState(b) === 'none' && b.status !== 'Cancelled'"
              theme="green"
              variant="solid"
              size="sm"
              @click.stop="quickConvertPlanToActual(b)"
              :tabindex="concludedTabindex(rIdx, 1)"
              :data-concluded-row="rIdx"
              :data-concluded-col="1"
              @focus="setConcludedRoving(rIdx, 1)"
              @keydown="onConcludedGridKey($event, rIdx, 1)"
              :label="'Log planned duration ' + Number(b.duration_hours || 0).toFixed(1) + 'h as completed timesheet'"
              title="1-Click convert planned commitment to actual logged timesheet">
              ⚡ Convert ({{ Number(b.duration_hours || 0).toFixed(1) }}h)
            </Button>
            <!-- Column 1: View Audit & Notes -->
            <Button
              theme="gray"
              variant="outline"
              size="sm"
              @click.stop="openBlockDrawer(b)"
              :tabindex="concludedTabindex(rIdx, 2)"
              :data-concluded-row="rIdx"
              :data-concluded-col="2"
              @focus="setConcludedRoving(rIdx, 2)"
              @keydown="onConcludedGridKey($event, rIdx, 2)"
              :label="'View audit details for ' + (b.task_subject || b.deliverable_notes || 'Block')">
              View Audit & Notes
            </Button>
            <!-- Column 2: Re-open (if permitted) -->
            <Button
              v-if="b.status !== 'Cancelled' && b.status !== 'Rescheduled'"
              theme="blue"
              variant="ghost"
              size="sm"
              @click.stop="startFocusBlock(b)"
              :tabindex="concludedTabindex(rIdx, 3)"
              :data-concluded-row="rIdx"
              :data-concluded-col="3"
              @focus="setConcludedRoving(rIdx, 3)"
              @keydown="onConcludedGridKey($event, rIdx, 3)"
              :label="'Re-open focus session for ' + (b.task_subject || b.deliverable_notes || 'Focus Work Block')"
              title="Re-open or append time to this completed block">
              ↺ Re-open
            </Button>
          </div>
        </div>

        <!-- Structured Cancellation Audit Callout -->
        <div v-if="b.status === 'Cancelled'" class="mt-3.5 p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs">
          <div class="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold mb-1">
            <svg class="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span>Cancellation Reason: {{ b.cancel_reason || 'Client No-Show / Cancelled' }}</span>
          </div>
          <p v-if="b.deliverable_notes" class="text-rose-900/80 dark:text-rose-200/80 whitespace-pre-line leading-relaxed font-sans"
            :style="!isBlockNotesExpanded(b.name) && isLongNote(b.deliverable_notes) ? '-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;' : ''">
            {{ b.deliverable_notes }}
          </p>
          <div v-if="isLongNote(b.deliverable_notes)" class="pt-1">
            <Button
              theme="gray"
              variant="ghost"
              size="sm"
              @click.stop="toggleBlockNotes(b.name)"
              :tabindex="concludedTabindex(rIdx, getConcludedNotesCol(b))"
              :data-concluded-row="rIdx"
              :data-concluded-col="getConcludedNotesCol(b)"
              @focus="setConcludedRoving(rIdx, getConcludedNotesCol(b))"
              @keydown="onConcludedGridKey($event, rIdx, getConcludedNotesCol(b))"
              :aria-expanded="isBlockNotesExpanded(b.name) ? 'true' : 'false'">
              <span v-if="!isBlockNotesExpanded(b.name)" class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span>Show full notes</span>
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
              <span v-else class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span>Show less</span>
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
              </span>
            </Button>
          </div>
          <!-- Wait time sessions -->
          <div v-if="b.sessions && b.sessions.length" class="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-[11px] text-rose-700 dark:text-rose-300">
            <span class="font-mono">Logged wait window: {{ hhmm(b.sessions[0].from_time) }}–{{ hhmm(b.sessions[0].to_time) }}</span>
            <Badge theme="red" variant="subtle" size="sm">{{ fmtHrs(b.sessions[0].hours) }}h wait</Badge>
          </div>
        </div>

        <!-- Accomplishment & Deliverable Notes Showcase (Non-Cancelled) -->
        <div v-else class="mt-3.5 space-y-2.5">
          <div v-if="b.deliverable_notes || (b.sessions && b.sessions.some(s => s.notes))" 
            class="rounded-2xl p-3.5 border transition-colors"
            :class="isDarkMode ? 'bg-[#25272B] border-gray-800' : 'bg-gray-50/70 border-gray-200/80'">
            
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                <svg class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Deliverables & Accomplished Outcomes</span>
              </div>
              <Badge theme="gray" variant="outline" size="sm">
                {{ (b.sessions && b.sessions.length) ? (b.sessions.length + ' session' + (b.sessions.length > 1 ? 's' : '')) : 'Verified' }}
              </Badge>
            </div>

            <!-- The actual deliverable note displayed with truncation toggle if long -->
            <p v-if="b.deliverable_notes" 
              class="text-xs sm:text-[13px] leading-relaxed whitespace-pre-line text-gray-800 dark:text-gray-100 font-sans"
              :style="!isBlockNotesExpanded(b.name) && isLongNote(b.deliverable_notes) ? '-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;' : ''">
              {{ b.deliverable_notes }}
            </p>

            <!-- Expand / Collapse Note Details Button (Frappe UI FButton) -->
            <div v-if="isLongNote(b.deliverable_notes) || (b.sessions && b.sessions.length > 1)" class="pt-1">
              <Button
                theme="gray"
                variant="ghost"
                size="sm"
                @click.stop="toggleBlockNotes(b.name)"
                :tabindex="concludedTabindex(rIdx, getConcludedNotesCol(b))"
                :data-concluded-row="rIdx"
                :data-concluded-col="getConcludedNotesCol(b)"
                @focus="setConcludedRoving(rIdx, getConcludedNotesCol(b))"
                @keydown="onConcludedGridKey($event, rIdx, getConcludedNotesCol(b))"
                :aria-expanded="isBlockNotesExpanded(b.name) ? 'true' : 'false'">
                <span v-if="!isBlockNotesExpanded(b.name)" class="inline-flex items-center gap-1 text-gray-700 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-200">
                  <span>Show full details & breakdown</span>
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
                <span v-else class="inline-flex items-center gap-1 text-gray-700 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-200">
                  <span>Show less</span>
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                </span>
              </Button>
            </div>

            <!-- Detailed Child Sessions (shown if expanded, or if single session with distinct notes) -->
            <div v-if="b.sessions && b.sessions.length && (isBlockNotesExpanded(b.name) || b.sessions.length === 1) && (b.sessions.length > 1 || (b.sessions[0].notes && b.sessions[0].notes !== b.deliverable_notes))" class="mt-2.5 pt-2.5 border-t space-y-1.5 border-gray-200/60 dark:border-gray-800">
              <div v-for="(s, i) in b.sessions" :key="i"
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] rounded-xl px-2.5 py-1.5 bg-white border border-gray-200/60 dark:bg-[#1E1F22] dark:border-gray-800">
                <div class="flex items-center gap-2 min-w-0">
                  <span v-if="s.from_time" class="font-mono text-gray-700 font-medium shrink-0">{{ hhmm(s.from_time) }}–{{ hhmm(s.to_time) }}</span>
                  <span v-if="s.notes" class="text-gray-700 dark:text-gray-300 break-words">· {{ s.notes }}</span>
                </div>
                <Badge theme="gray" variant="subtle" size="sm">{{ fmtHrs(s.hours) }}h</Badge>
              </div>
            </div>
          </div>

          <!-- Warning if nothing was logged -->
          <div v-else-if="blockLogState(b) === 'none'" class="rounded-xl p-2.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>No timesheet sessions were recorded against this planned block.</span>
          </div>
        </div>

      </div>
    </div>

    <!-- Show More / Show Less Toggle (Frappe UI FButton) -->
    <div v-if="pastFocusBlocks.length > 2" class="pt-2 flex justify-center">
      <Button
        theme="gray"
        variant="outline"
        size="sm"
        @click="toggleShowAllPastBlocks"
        :aria-expanded="showAllPastBlocks ? 'true' : 'false'"
        :label="showAllPastBlocks ? 'Show fewer completed deliverables' : ('Show ' + remainingPastBlocksCount + ' more completed deliverables')">
        <span v-if="!showAllPastBlocks" class="inline-flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          <span>Show {{ remainingPastBlocksCount }} more deliverables</span>
        </span>
        <span v-else class="inline-flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
          <span>Show less</span>
        </span>
      </Button>
    </div>
  </div>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

export default {
  name: 'DashboardPastBlocks',
  setup() {
    return useWorkstationContext([
      'blockLogState',
      'concludedTabindex',
      'fmtHrs',
      'formatBlockRange',
      'getBlockBadgeTheme',
      'getBlockCardAccent',
      'getBlockTimingInfo',
      'getBlockVarianceBadge',
      'getConcludedNotesCol',
      'getNatureBadge',
      'hhmm',
      'isBlockNotesExpanded',
      'isDarkMode',
      'isLongNote',
      'onConcludedGridKey',
      'openBlockDrawer',
      'pastBlocksHeading',
      'pastDeliverablesStats',
      'pastFocusBlocks',
      'quickConvertPlanToActual',
      'remainingPastBlocksCount',
      'selectedDashboardDate',
      'setConcludedRoving',
      'showAllPastBlocks',
      'startFocusBlock',
      'toggleBlockNotes',
      'toggleShowAllPastBlocks',
      'visiblePastFocusBlocks'
    ]);
  },
};
</script>
