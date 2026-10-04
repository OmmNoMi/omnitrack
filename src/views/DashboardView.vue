<template>
  <div class="space-y-6">
<!-- ===================================================================== -->
      <!-- EXECUTIVE CLIENT PORTAL: PROJECT PULSE & DAILY SCORECARD              -->
      <!-- ===================================================================== -->
      <section v-if="isClient" class="space-y-6" aria-label="Project Pulse">
        <!-- Executive Welcome Banner -->
        <div class="rounded-3xl p-6 border shadow-sm transition-all"
          :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  CampusCredit CATMA
                </span>
                <span class="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Operations
                </span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black mt-2 tracking-tight">Executive Project Pulse</h2>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Real-time delivery status, engineering sprints, and support sessions managed by <strong class="text-gray-700 dark:text-gray-300">OmmNoMi Automation LLP</strong>.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <div class="text-[10px] font-bold uppercase text-gray-400">Selected Date</div>
                <div class="text-sm font-extrabold">{{ selectedDashboardDate === todayDate ? "Today (" + todayDate + ")" : selectedDashboardDate }}</div>
              </div>
            </div>
          </div>

          <!-- Quick Metrics Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Delivered Today</div>
              <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {{ fmtHrs(clientDeliveredHours) }}h
              </div>
            </div>
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Engineering</div>
              <div class="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {{ clientInProgressCount }} session{{ clientInProgressCount === 1 ? '' : 's' }}
              </div>
            </div>
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Planned Today</div>
              <div class="text-lg font-black text-gray-800 dark:text-gray-200 mt-0.5">
                {{ fmtHrs(clientTotalPlannedHours) }}h
              </div>
            </div>
            <div class="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Reliability Rate</div>
              <div class="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
                {{ clientReliabilityRate }}%
              </div>
            </div>
          </div>
        </div>

        <!-- Today's Story Scorecard -->
        <div class="space-y-4">
          <h3 class="text-sm font-extrabold uppercase tracking-wider text-gray-500 px-1">Today's Delivery Scorecard</h3>

          <!-- Card 1: Completed Deliverables -->
          <div v-if="clientCompletedBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Completed Deliverables ({{ clientCompletedBlocks.length }})</h4>
              </div>
              <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{{ fmtHrs(clientCompletedHours) }}h total</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientCompletedBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-gray-600 dark:text-gray-300">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">✓ {{ b.status || 'Completed' }}</span>
                    <span v-if="b.task_nature" class="text-[10px] text-gray-400">🏷 {{ b.task_nature }}</span>
                  </div>
                  <div class="text-sm font-bold text-gray-900 dark:text-white">{{ b.task_subject || b.deliverable_notes }}</div>
                  <div v-if="b.deliverable_notes && b.deliverable_notes !== b.task_subject" class="text-xs text-gray-500 dark:text-gray-400">{{ b.deliverable_notes }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{{ fmtHrs(b.actual_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">planned {{ fmtHrs(b.duration_hours) }}h</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: In Progress -->
          <div v-if="clientInProgressBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-blue-200 dark:border-blue-900 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">In Progress · Active Engineering ({{ clientInProgressBlocks.length }})</h4>
              </div>
              <span class="text-xs font-bold text-blue-600 dark:text-blue-400">Active</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientInProgressBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">🔄 In Progress</span>
                  </div>
                  <div class="text-sm font-bold text-gray-900 dark:text-white">{{ b.task_subject || b.deliverable_notes }}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ b.deliverable_notes || 'Active engineering sprint' }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-black font-mono text-blue-600 dark:text-blue-400">{{ fmtHrs(b.actual_hours || b.duration_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">allocated</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 3: Rescheduled & Cancelled -->
          <div v-if="clientCancelledBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Rescheduled & Cancelled ({{ clientCancelledBlocks.length }})</h4>
              </div>
              <span class="text-xs font-bold text-gray-400">Audited Schedule Variance</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientCancelledBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-gray-500 line-through">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="b.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'">
                      {{ b.status === 'Cancelled' ? (b.cancel_reason ? 'Cancelled (' + b.cancel_reason + ')' : 'Cancelled') : 'Rescheduled ↗' }}
                    </span>
                  </div>
                  <div class="text-sm font-bold text-gray-600 dark:text-gray-300 line-through">{{ b.task_subject || b.deliverable_notes }}</div>
                  <div class="text-xs text-gray-400">
                    <span v-if="b.cancel_reason">Reason: {{ b.cancel_reason }} · </span>
                    <span v-if="b.actual_hours > 0">{{ fmtHrs(b.actual_hours) }}h wait logged</span>
                    <span v-else>Freed capacity returned to engineering</span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-mono text-gray-400">{{ fmtHrs(b.actual_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">planned {{ fmtHrs(b.duration_hours) }}h</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 4: Upcoming Scheduled -->
          <div v-if="clientUpcomingBlocks.length" class="rounded-3xl p-5 border bg-white dark:bg-[#1E1F22] border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                <h4 class="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-400">Upcoming Scheduled ({{ clientUpcomingBlocks.length }})</h4>
              </div>
              <span class="text-xs font-mono font-bold text-gray-500">{{ fmtHrs(clientUpcomingHours) }}h total</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="b in clientUpcomingBlocks" :key="b.name" @click="openBlockDrawer(b)" class="py-3 first:pt-1 last:pb-1 flex items-start justify-between gap-3 cursor-pointer hover:opacity-90">
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{{ formatBlockRange(b) }}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">📅 Scheduled</span>
                  </div>
                  <div class="text-sm font-bold text-gray-900 dark:text-white">{{ b.task_subject || b.deliverable_notes }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-black font-mono text-gray-700 dark:text-gray-300">{{ fmtHrs(b.duration_hours) }}h</div>
                  <div class="text-[10px] text-gray-400">planned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================================================================== -->
      <!-- INTERNAL TEAM WORKSTATION (ENGINEER / MANAGER VIEW)                   -->
      <!-- ===================================================================== -->
      <div v-else class="space-y-6">

        <!-- 1. HERO AGENDA: HAPPENING NOW & UP NEXT (Top Priority - Instant Start) -->
      <!-- ===================================================================== -->
      <section v-if="untrackedCurrentBlocks.length > 0 || (selectedDashboardDate === todayDate && upNextBlock)" aria-labelledby="hero-now-heading" class="space-y-3">
        
        <!-- Case 1: Happening Now (Excludes block actively tracked in top cockpit) -->
        <div 
          v-for="b in untrackedCurrentBlocks" 
          :key="'hero-now-' + b.name"
          @click="openBlockDrawer(b)"
          class="rounded-3xl p-5 sm:p-6 border shadow-sm transition-all duration-200 border-l-4 cursor-pointer hover:shadow-md"
          :class="isTracking && trackerBlockName === b.name ? (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-red-500 text-white' : 'bg-white border-gray-200 border-l-red-500 text-gray-900') : (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-blue-500 text-white' : 'bg-white border-gray-200 border-l-blue-500 text-gray-900')">
          
          <div class="flex items-center justify-between gap-3 mb-2.5">
            <h3 id="hero-now-heading" class="text-xs font-black uppercase tracking-wider flex items-center gap-2"
              :class="isTracking && trackerBlockName === b.name ? 'text-red-500' : 'text-blue-500'">
              <span class="w-2.5 h-2.5 rounded-full" :class="isTracking && trackerBlockName === b.name ? 'bg-red-500 animate-pulse' : 'bg-blue-500'"></span>
              <span>{{ isTracking && trackerBlockName === b.name ? 'Recording Right Now' : 'Happening Now' }}</span>
            </h3>
            <span v-if="isTracking && trackerBlockName === b.name" class="font-mono font-bold text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
              ● Live Session Active
            </span>
          </div>

          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-2 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <!-- Start Time Pill -->
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black"
                  :class="isTracking && trackerBlockName === b.name ? 'bg-red-600 text-white' : (isDarkMode ? 'bg-blue-950/70 text-blue-300 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200')">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>{{ formatBlockRange(b) }}</span>
                </span>

                <!-- Dynamic Status Pill -->
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider" :class="getBlockTimingInfo(b).pillClass">
                  {{ getBlockTimingInfo(b).label }}
                </span>

                <!-- Nature Badge -->
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" :class="getNatureBadge(b.task_nature).badgeClass">
                  <span v-html="getNatureBadge(b.task_nature).svgIcon" class="w-3 h-3 flex items-center justify-center" aria-hidden="true"></span>
                  <span>{{ getNatureBadge(b.task_nature).label }}</span>
                </span>

                <!-- Project -->
                <span v-if="b.project_name || b.project" class="text-xs text-gray-500 dark:text-gray-400">
                  📁 {{ b.project_name || b.project }}
                </span>
              </div>

              <!-- Title -->
              <h3 class="text-lg sm:text-xl font-extrabold leading-snug transition-colors"
                :class="isTracking && trackerBlockName === b.name ? 'text-red-500 dark:text-red-400' : ''">
                {{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}
              </h3>

              <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <span v-if="b.task" class="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                  📋 Task: {{ b.task }}
                </span>
                <span>👤 {{ b.associate_name || b.employee }}</span>
                <span aria-hidden="true">·</span>
                <span>Expected: <strong class="font-mono font-bold">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
                <span v-if="b.actual_hours">· Logged: <strong class="text-emerald-500 font-mono font-bold">{{ Number(b.actual_hours).toFixed(1) }}h</strong></span>
                <span v-if="b.variance_hours !== undefined && b.actual_hours > 0" :class="b.variance_hours <= 0 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'">
                  ({{ b.variance_hours <= 0 ? '' : '+' }}{{ Number(b.variance_hours).toFixed(1) }}h variance)
                </span>
              </div>
            </div>

            <!-- Start / Stop Session Button -->
            <div class="flex items-center gap-3 self-stretch md:self-center justify-end">
              <template v-if="isTracking && trackerBlockName === b.name">
                <span class="font-mono font-bold text-sm tabular-nums" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'" aria-label="Elapsed time">{{ formattedTime }}</span>
                <button 
                  type="button"
                  @click.stop="requestStopFocusBlock(b)"
                  :aria-label="stopConfirmName === b.name ? 'Stop and save without any log lines' : 'Stop the session and save the timesheet'"
                  class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  :class="stopConfirmName === b.name ? 'bg-red-600 border-red-600 text-white hover:bg-red-700' : (isDarkMode ? 'border-red-800 text-red-300 hover:bg-red-950/40' : 'border-red-300 text-red-700 hover:bg-red-50')">
                  <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>
                  <span>{{ stopConfirmName === b.name ? 'Stop anyway' : 'Stop & save' }}</span>
                </button>
                <button
                  type="button"
                  @click.stop="discardSession"
                  :aria-label="discardConfirm ? 'Confirm discard: throw this session away without saving' : 'Discard this session without saving'"
                  class="inline-flex items-center justify-center px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  :class="discardConfirm ? 'bg-amber-500 border-amber-500 text-white' : (isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100')">
                  {{ discardConfirm ? 'Discard?' : 'Discard' }}
                </button>
                <button
                  type="button"
                  @click.stop="openAdjustModal"
                  aria-label="Adjust start and end datetime of this timesheet"
                  title="Adjust start/end time"
                  class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Adjust</span>
                </button>
              </template>
              <template v-else>
                <button
                  type="button"
                  v-if="!isBlockLocked(b)"
                  @click.stop="openBlockDrawer(b)"
                  :aria-label="'Reschedule ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                  title="Reschedule this planned block"
                  class="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-xs sm:text-sm font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  :class="isDarkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Reschedule</span>
                </button>
                <button 
                  type="button"
                  @click.stop="startFocusBlock(b)"
                  :aria-label="'Start session for ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                  class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-[#1A73E8] hover:bg-blue-700 ring-4 ring-blue-500/20 shadow-md transition-all cursor-pointer select-none active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <span>Start Session</span>
                </button>
              </template>
            </div>
          </div>

          <!-- Working-on-this indicator -->
          <div v-if="isTracking && trackerBlockName === b.name"
            class="mt-3.5 pt-3 border-t flex items-center gap-2 flex-wrap text-[11px] font-semibold"
            :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'"
            role="status" aria-live="polite">
            <span class="inline-flex items-center gap-1.5" :class="isDarkMode ? 'text-red-300' : 'text-red-600'">
              <span class="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden="true"></span>
              <span>{{ (b.associate_name || b.employee) === currentUserFullName ? 'You are working on this' : (b.associate_name || b.employee) + ' is working on this' }}</span>
            </span>
            <span aria-hidden="true" class="text-gray-300 dark:text-gray-700">·</span>
            <span class="text-gray-500 dark:text-gray-400" v-if="sessionNotesList.length">{{ sessionNotesList.length }} line{{ sessionNotesList.length === 1 ? '' : 's' }} in the session log</span>
            <button v-else type="button" @click.stop="focusSessionPointInput"
              class="underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              :class="isDarkMode ? 'text-blue-300' : 'text-blue-600'">Nothing logged yet — add a line</button>
          </div>
        </div>

        <!-- Case 2: Up Next Card (Next Scheduled Block on Today's Agenda) -->
        <div 
          v-if="upNextBlock && !isBlockInNow(upNextBlock)"
          class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200"
          :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          
          <div class="flex items-center justify-between gap-3 mb-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500/70"></span>
              <span>Up Next</span>
              <span class="text-gray-400 dark:text-gray-600">·</span>
              <span class="text-blue-600 dark:text-blue-400 font-semibold lowercase">{{ getStartsInText(upNextBlock) }}</span>
            </h4>
            <span class="text-[11px] font-mono text-gray-400 font-semibold">{{ formatBlockRange(upNextBlock) }}</span>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1.5 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" :class="getNatureBadge(upNextBlock.task_nature).badgeClass">
                  <span v-html="getNatureBadge(upNextBlock.task_nature).svgIcon" class="w-3 h-3 flex items-center justify-center" aria-hidden="true"></span>
                  <span>{{ getNatureBadge(upNextBlock.task_nature).label }}</span>
                </span>
                <span v-if="upNextBlock.project_name || upNextBlock.project" class="text-xs text-gray-500 dark:text-gray-400">
                  📁 {{ upNextBlock.project_name || upNextBlock.project }}
                </span>
                <span v-if="upNextBlock.task" class="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                  📋 Task: {{ upNextBlock.task }}
                </span>
              </div>

              <h4 class="text-base sm:text-lg font-bold leading-snug truncate">
                {{ upNextBlock.task_subject || upNextBlock.deliverable_notes || 'Focus Work Block' }}
              </h4>

              <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>Expected: <strong class="font-mono font-bold">{{ Number(upNextBlock.duration_hours || 0).toFixed(1) }}h</strong></span>
              </div>
            </div>

            <!-- Up Next Actions -->
            <div class="flex items-center gap-2 self-stretch sm:self-center justify-end">
              <a
                v-if="getMeetUrl(upNextBlock)"
                :href="getMeetUrl(upNextBlock)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all select-none cursor-pointer"
                aria-label="Open Meeting Link"
              >
                <span>Join Meet ↗</span>
              </a>
              <button
                type="button"
                v-if="!isBlockLocked(upNextBlock)"
                @click.stop="openBlockDrawer(upNextBlock)"
                :aria-label="'Reschedule ' + (upNextBlock.task_subject || 'Work Block')"
                class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                :class="isDarkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
                <span>Reschedule</span>
              </button>
              <button 
                type="button"
                @click.stop="startFocusBlock(upNextBlock)"
                :aria-label="'Start session now for ' + (upNextBlock.task_subject || 'Work Block')"
                class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#1A73E8] hover:bg-blue-700 ring-2 ring-blue-500/20 shadow-xs transition-all cursor-pointer select-none active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                <span>Start Session</span>
              </button>
            </div>
          </div>
        </div>

      </section>

      <!-- 2. Attention Needed: Overdue & Underplanned Tasks (WCAG 2.1 AA Compliant) -->
      <section v-if="attentionTasks && attentionTasks.length > 0" 
        aria-labelledby="attention-tasks-heading"
        class="rounded-3xl border-2 p-4 sm:p-5 transition-all shadow-sm"
        :class="isDarkMode ? 'bg-[#1E1F22] border-amber-500/50 text-white' : 'bg-amber-50/70 border-amber-400 text-gray-900'">
        
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3.5">
          <div class="flex items-center gap-2.5">
            <span class="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs" aria-hidden="true">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h3 id="attention-tasks-heading" class="text-sm sm:text-base font-extrabold tracking-tight">
                  Action Required: Overdue & Underplanned Tasks
                </h3>
                <f-badge theme="red" variant="solid" size="xs">
                  {{ attentionTasks.length }} {{ attentionTasks.length === 1 ? 'task' : 'tasks' }}
                </f-badge>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                Tasks that are past due or have fewer hours booked in your calendar than needed to complete them.
              </p>
            </div>
          </div>
          <f-button 
            variant="ghost"
            theme="blue"
            size="sm"
            @click="openPlannerWithFilter(attentionFilter)"
            aria-label="Open Planner Calendar to allocate time">
            <span>Open Planner Calendar</span>
            <template #suffix><span aria-hidden="true">→</span></template>
          </f-button>
        </div>

        <!-- Real-world Quick Filter Bar & Search -->
        <div class="flex items-center justify-between gap-2.5 flex-wrap pt-2.5 pb-1 mb-2 border-t border-amber-200/60 dark:border-amber-900/40">
          <div class="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Filter action required tasks" @keydown="onAttentionTabKeydown">
            <f-button
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'all' ? 'solid' : 'subtle'"
              theme="gray"
              :aria-selected="attentionFilter === 'all'"
              :tabindex="attentionFilter === 'all' ? 0 : -1"
              data-attention-tab="all"
              @click="setAttentionFilter('all')"
            >
              <span>All</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ attentionTasks.length }})</span>
              </template>
            </f-button>
            <f-button
              v-if="overdueTasksCount > 0"
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'overdue' ? 'solid' : 'subtle'"
              theme="red"
              :aria-selected="attentionFilter === 'overdue'"
              :tabindex="attentionFilter === 'overdue' ? 0 : -1"
              data-attention-tab="overdue"
              @click="setAttentionFilter('overdue')"
            >
              <template #prefix><span aria-hidden="true">⚠️</span></template>
              <span>Overdue</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ overdueTasksCount }})</span>
              </template>
            </f-button>
            <f-button
              v-if="underplannedTasksCount > 0"
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'underplanned' ? 'solid' : 'subtle'"
              theme="amber"
              :aria-selected="attentionFilter === 'underplanned'"
              :tabindex="attentionFilter === 'underplanned' ? 0 : -1"
              data-attention-tab="underplanned"
              @click="setAttentionFilter('underplanned')"
            >
              <template #prefix><span aria-hidden="true">⏱️</span></template>
              <span>Underplanned</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ underplannedTasksCount }})</span>
              </template>
            </f-button>
            <f-button
              v-if="dueSoonTasksCount > 0"
              type="button"
              role="tab"
              size="xs"
              :variant="attentionFilter === 'due_soon' ? 'solid' : 'subtle'"
              theme="blue"
              :aria-selected="attentionFilter === 'due_soon'"
              :tabindex="attentionFilter === 'due_soon' ? 0 : -1"
              data-attention-tab="due_soon"
              @click="setAttentionFilter('due_soon')"
            >
              <template #prefix><span aria-hidden="true">📅</span></template>
              <span>Due Soon</span>
              <template #suffix>
                <span class="text-[10px] font-mono opacity-80">({{ dueSoonTasksCount }})</span>
              </template>
            </f-button>
          </div>

          <!-- Quick Search -->
          <div class="relative w-full sm:w-48 ml-auto">
            <f-input
              size="sm"
              v-model="attentionSearch"
              placeholder="Search tasks..."
              aria-label="Search action required tasks"
            >
              <template #prefix>
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </template>
              <template #suffix>
                <button v-if="attentionSearch" @click="attentionSearch = ''" type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs cursor-pointer p-0.5" aria-label="Clear search">✕</button>
              </template>
            </f-input>
          </div>
        </div>

        <!-- Attention Task Cards Grid with 2D Roving Tabindex -->
        <div v-if="visibleAttentionTasks.length === 0" class="text-center py-6 border border-dashed rounded-2xl"
          :class="isDarkMode ? 'border-gray-800 text-gray-400' : 'border-amber-200 text-gray-500'">
          <span>No tasks found matching this filter.</span>
          <button type="button" class="ml-1.5 text-blue-500 font-bold hover:underline" @click="attentionFilter = 'all'; attentionSearch = ''">Clear filter</button>
        </div>
        <ul v-else role="grid" class="space-y-2.5" :aria-rowcount="visibleAttentionTasks.length" aria-colcount="4" aria-label="Action required overdue and underplanned task table. Use arrow keys to navigate rows and actions.">
          <li 
            v-for="(t, rIdx) in visibleAttentionTasks" 
            :key="t.ref || t.id || t.docname"
            role="row"
            :aria-rowindex="rIdx + 1"
            @click="openTaskDetails(t)"
            class="rounded-2xl p-3.5 sm:p-4 border transition-all cursor-pointer hover:shadow-md"
            :class="isDarkMode ? 'bg-[#2B2D30]/90 border-gray-700/80 hover:border-amber-500/50' : 'bg-white border-amber-200 hover:border-amber-400 shadow-xs'">
            
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-1.5 flex-1 min-w-0">
                <!-- Badges: Clean, Non-Redundant -->
                <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <f-badge v-if="t.days_overdue > 0" theme="red" variant="solid" size="xs">
                    Overdue {{ t.days_overdue }}d
                  </f-badge>
                  <f-badge v-else-if="t.is_due_today" theme="amber" variant="solid" size="xs">
                    Due Today
                  </f-badge>

                  <f-badge v-if="t.deficit_hours > 0" theme="amber" variant="subtle" size="xs">
                    {{ Number(t.deficit_hours).toFixed(1) }}h Deficit
                  </f-badge>
                  <f-badge v-else-if="t.is_unplanned" theme="amber" variant="subtle" size="xs">
                    Unplanned
                  </f-badge>

                  <f-badge v-if="t.priority === 'Urgent' || t.priority === 'High'" theme="red" variant="subtle" size="xs">
                    {{ t.priority }} Priority
                  </f-badge>

                  <f-badge v-if="t.due_date" theme="gray" variant="outline" size="xs">
                    📅 {{ t.due_date }}
                  </f-badge>

                  <f-badge v-if="t.project_name || t.project" theme="gray" variant="subtle" size="xs">
                    📁 {{ t.project_name || t.project }}
                  </f-badge>
                </div>

                <!-- Subject (Column 0 in Roving Tabindex) -->
                <h4 class="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-snug">
                  <button 
                    type="button"
                    @click.stop="openTaskDetails(t)"
                    :title="'Open details panel for ' + t.subject"
                    :tabindex="attentionTabindex(rIdx, 0)"
                    :data-attention-row="rIdx"
                    :data-attention-col="0"
                    @focus="setAttentionRoving(rIdx, 0)"
                    @keydown="onAttentionGridKey($event, rIdx, 0)"
                    class="text-left font-bold hover:underline hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer">
                    <span>{{ t.subject }}</span>
                    <span class="text-xs font-normal text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">View details →</span>
                  </button>
                  <a 
                    :href="getTaskDeskUrl(t)" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    @click.stop
                    :title="'Open ' + (t.doctype || 'Task') + ' ' + (t.docname || t.id) + ' in Desk'"
                    class="ml-1.5 inline-flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-40 hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                    :aria-label="'Open ' + (t.doctype || 'Task') + ' in Desk'">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </h4>

                <!-- Planning Metrics Pill (Zero Redundant Sentences) -->
                <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px]"
                    :class="t.is_unplanned ? 'bg-amber-100/70 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'">
                    <span>Booked:</span>
                    <strong :class="t.booked_hours > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'">{{ Number(t.booked_hours || 0).toFixed(1) }}h</strong>
                    <template v-if="t.estimate_hours > 0">
                      <span>/ {{ Number(t.estimate_hours).toFixed(1) }}h est.</span>
                    </template>
                  </span>
                  <span v-if="t.logged_hours > 0" class="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                    · Logged: {{ Number(t.logged_hours).toFixed(1) }}h
                  </span>
                </div>
              </div>

              <!-- Action Buttons (Columns 1, 2, 3 in Roving Tabindex) -->
              <div class="flex items-center gap-2 self-stretch sm:self-center flex-wrap sm:flex-nowrap pt-1 sm:pt-0">
                <!-- Schedule in Planner (Col 1) -->
                <f-button 
                  variant="subtle" 
                  theme="blue" 
                  size="sm" 
                  @click.stop="planAttentionTask(t)"
                  :tabindex="attentionTabindex(rIdx, 1)"
                  :data-attention-row="rIdx"
                  :data-attention-col="1"
                  @focus="setAttentionRoving(rIdx, 1)"
                  @keydown="onAttentionGridKey($event, rIdx, 1)"
                  :aria-label="'Schedule ' + t.subject + ' into planner calendar'">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </template>
                  <span>Plan in Calendar</span>
                </f-button>

                <!-- Immediate Focus Session (Col 2) -->
                <f-button 
                  variant="solid" 
                  theme="blue" 
                  size="sm" 
                  @click.stop="startTaskImmediately(t)"
                  :tabindex="attentionTabindex(rIdx, 2)"
                  :data-attention-row="rIdx"
                  :data-attention-col="2"
                  @focus="setAttentionRoving(rIdx, 2)"
                  @keydown="onAttentionGridKey($event, rIdx, 2)"
                  :aria-label="'Start focus session now for ' + t.subject">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
                  </template>
                  <span>Start Now</span>
                </f-button>

                <!-- Raven Task Discussion & Specs (Col 3) -->
                <f-button 
                  variant="subtle" 
                  theme="purple" 
                  size="sm" 
                  @click.stop="openTaskRavenDrawer(t)"
                  :tabindex="attentionTabindex(rIdx, 3)"
                  :data-attention-row="rIdx"
                  :data-attention-col="3"
                  @focus="setAttentionRoving(rIdx, 3)"
                  @keydown="onAttentionGridKey($event, rIdx, 3)"
                  :aria-label="'Discuss and view specs for ' + t.subject">
                  <template #prefix>
                    <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h6"/></svg>
                  </template>
                  <span>Discuss</span>
                </f-button>

                <!-- Encapsulated Workflow Actions Dropdown Menu (Col 4) -->
                <f-dropdown-menu
                  v-if="t.workflow_actions && t.workflow_actions.length > 0"
                  :items="getTaskWorkflowMenuItems(t)"
                  title="Workflow Actions"
                  @click.stop
                  :aria-label="'Workflow actions for ' + t.subject"
                  align="right">
                  <template #trigger="{ isOpen }">
                    <f-button
                      variant="outline"
                      theme="gray"
                      size="sm"
                      :tabindex="attentionTabindex(rIdx, 4)"
                      :data-attention-row="rIdx"
                      :data-attention-col="4"
                      @focus="setAttentionRoving(rIdx, 4)"
                      @keydown="onAttentionGridKey($event, rIdx, 4)"
                      :aria-expanded="isOpen ? 'true' : 'false'"
                      :aria-label="'Workflow actions for ' + t.subject">
                      <template #prefix>
                        <svg class="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                      </template>
                      <span>Workflow</span>
                      <template #suffix>
                        <svg class="w-3 h-3 transition-transform duration-150" :class="isOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                      </template>
                    </f-button>
                  </template>
                </f-dropdown-menu>
              </div>
            </div>

          </li>
        </ul>

        <!-- Google Meet-Style Show More / Show Less Toggle -->
        <div v-if="attentionTasks.length > 3" class="pt-2.5 flex justify-center">
          <button
            type="button"
            data-attention-show-more
            @click="toggleShowAllAttentionTasks"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full border transition-all shadow-xs cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 bg-white/95 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 dark:bg-gray-800/95 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-gray-700"
            :aria-expanded="showAllAttentionTasks ? 'true' : 'false'"
            :aria-label="showAllAttentionTasks ? 'Show fewer overdue tasks' : ('Show ' + remainingAttentionTasksCount + ' more overdue tasks')">
            <span v-if="!showAllAttentionTasks" class="inline-flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              <span>Show {{ remainingAttentionTasksCount }} more</span>
            </span>
            <span v-else class="inline-flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
              <span>Show less</span>
            </span>
          </button>
        </div>

      </section>

      <!-- 3. Google Meet-Style Agenda & Focus Work Blocks -->
      <div class="space-y-4">
        
        <!-- Google Meet Date & Day Selector Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          
          <!-- Selected Date Display with Explicit 'Today' Button -->
          <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap" data-day-section>
            <!-- Title says which day you are looking at; subtitle says what is in it -->
            <div>
              <h2 class="text-xl sm:text-2xl font-extrabold tracking-tight" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                {{ dashboardDayTitle }}
              </h2>
              <p class="text-[11px] font-semibold mt-0.5" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">
                {{ dashboardDaySummary }}
              </p>
              <p class="text-[10px] mt-1 hidden sm:block" :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'">
                Press <kbd class="px-1.5 py-0.5 rounded border font-mono text-[10px]" :class="isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'">Shift</kbd>
                + <kbd class="px-1.5 py-0.5 rounded border font-mono text-[10px]" :class="isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-600'">D</kbd>
                from anywhere, then ← → to pick a day
              </p>
            </div>
          </div>

          <!-- Google Meet Horizontal 7-Day Picker Strip (Today Centered in Middle) -->
          <div class="flex items-center gap-1 sm:gap-2 w-full sm:w-auto self-start sm:self-auto overflow-x-auto no-scrollbar py-1"
            aria-label="Pick a day" data-day-strip @keydown="onDashboardDayKey">
            <!-- Today only appears when you are away from it, on the side it lies on -->
            <button
              type="button"
              v-if="todayDirection === 'left'"
              @click="resetDashboardToToday"
              aria-label="Jump to today"
              title="Jump to today"
              class="inline-flex items-center gap-1.5 shrink-0 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-2xl border transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-95 shadow-xs mr-0.5 sm:mr-1"
              :class="isDarkMode ? 'bg-[#25262A] border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg><span>Today</span>
            </button>

            <!-- the 7 day buttons are the radiogroup; Today and the arrows are plain buttons -->
            <div class="flex items-center gap-0.5 sm:gap-2 min-w-0" role="radiogroup" aria-label="Day of the week">
            <!-- Prev Week Arrow -->
            <button 
              type="button"
              @click="shiftDashboardWeek(-1)"
              class="p-1 sm:p-2 shrink-0 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              :class="isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'"
              title="Previous 7 days"
              aria-label="Previous 7 days">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            <!-- 7 Days (Today is index 3 / Middle by default) -->
            <button 
              type="button"
              v-for="d in dashboardWeekDays" 
              :key="d.dateStr"
              @click="selectDashboardDate(d.dateStr)"
              data-day-btn
              role="radio"
              :aria-checked="d.isSelected ? 'true' : 'false'"
              :aria-label="d.dateStr"
              :tabindex="d.isSelected ? 0 : -1"
              class="flex flex-col items-center justify-center min-w-[34px] sm:min-w-[44px] py-1.5 px-0.5 sm:px-1 rounded-2xl text-center transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              :class="d.isSelected ? 'bg-[#1B64DA] text-white font-bold shadow-md scale-105 ring-2 ring-blue-500/30' : (isDarkMode ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700')">
              <span class="text-[10px] font-bold tracking-tight opacity-80">{{ d.dow }}</span>
              <span class="text-xs sm:text-sm font-extrabold mt-0.5" :class="d.isToday && !d.isSelected ? 'text-blue-500 font-black' : ''">{{ d.dayNum }}</span>
              <span v-if="d.isToday" class="w-1 h-1 rounded-full mt-0.5" :class="d.isSelected ? 'bg-white' : 'bg-blue-500'"></span>
            </button>

            <!-- Next Week Arrow -->
            <button 
              type="button"
              @click="shiftDashboardWeek(1)"
              class="p-1 sm:p-2 shrink-0 rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              :class="isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'"
              title="Next 7 days"
              aria-label="Next 7 days">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            </div>
            <button
              type="button"
              v-if="todayDirection === 'right'"
              @click="resetDashboardToToday"
              aria-label="Jump to today"
              title="Jump to today"
              class="inline-flex items-center gap-1.5 shrink-0 text-xs font-bold px-2.5 sm:px-3 py-2 rounded-2xl border transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-95 shadow-xs ml-0.5 sm:ml-1"
              :class="isDarkMode ? 'bg-[#25262A] border-gray-700 text-gray-200 hover:bg-gray-800' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'">
              <span>Today</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <!-- Define Task Action -->
          <div class="hidden sm:flex items-center gap-2">
            <button 
              @click="openNewTaskModal"
              aria-label="Plan a new focus block"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#1B64DA] hover:bg-blue-600 text-white transition-all shadow-md cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Plan Focus Block</span>
            </button>
          </div>

        </div>

        <!-- Google Meet-Style Focus Block Cards -->
        <div v-if="dayFocusBlocks.length > 0" class="space-y-4">

          <!-- Day at a glance: planned over logged, on one timeline -->
          <div v-if="dayTimeline" class="rounded-3xl p-4 sm:p-5 border shadow-xs"
            :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
            <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Day at a glance</h4>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 text-[11px] font-semibold">
                <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm border border-gray-400 bg-gray-400/20" aria-hidden="true"></span><span class="text-gray-500 dark:text-gray-400">Planned {{ dayTimeline.plannedH.toFixed(1) }}h</span></span>
                <span class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm bg-gray-500" aria-hidden="true"></span><span class="text-gray-500 dark:text-gray-400">Logged {{ dayTimeline.loggedH.toFixed(1) }}h</span></span>
                <span class="inline-flex items-center gap-1.5" title="Time logged when nothing was planned for it"><span class="w-3 h-2 rounded-sm bg-rose-500" aria-hidden="true"></span><span class="text-gray-500 dark:text-gray-400">Off plan</span></span>
                <span v-if="dayTimeline.gapH > 0.05" class="inline-flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm bg-amber-400" aria-hidden="true"></span><span class="text-amber-600 dark:text-amber-400">{{ dayTimeline.gapH.toFixed(1) }}h unlogged</span></span>
                <span v-if="attendancePresence && attendancePresence.shift_presence_hours > 0" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border" :class="attendancePresence.unallocated_presence_hours > 0.5 ? (isDarkMode ? 'bg-amber-950/60 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800') : (isDarkMode ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800')">
                  <span>🏢 Office Presence: {{ attendancePresence.shift_presence_hours }}h</span>
                  <span v-if="attendancePresence.unallocated_presence_hours > 0.5" class="ml-1 text-red-500 font-extrabold">({{ attendancePresence.unallocated_presence_hours }}h unallocated)</span>
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
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    :class="timelineZoom === z ? (isDarkMode ? 'bg-[#1E1F22] text-white' : 'bg-white text-gray-900 shadow-xs') : (isDarkMode ? 'text-gray-400' : 'text-gray-500')">{{ z }}h</button>
                </div>
              </div>
            </div>
            <!-- Two named lines, not one band: what was planned, and under it what was
                 actually logged. The gutter sits outside the scroller so the labels
                 stay put while the day scrolls. -->
            <div class="flex gap-2">
            <div class="shrink-0 w-[52px] select-none text-[9px] font-bold uppercase tracking-wider pt-3.5"
              :class="isDarkMode ? 'text-gray-500' : 'text-gray-400'" aria-hidden="true">
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
                  :aria-label="(r.block.task_subject || r.block.deliverable_notes || 'Work block') + ' ' + formatBlockRange(r.block)"
                  @mouseenter="showBlockHover($event, r, 'timeline')"
                  @mouseleave="hideBlockHover"
                  @focus="showBlockHover($event, r, 'timeline')"
                  @blur="hideBlockHover"
                  @keydown.enter.prevent="openBlockDrawer(r.block)"
                  @click="openBlockDrawer(r.block)">{{ r.block.task_subject || r.block.deliverable_notes || 'Block' }}</div>
              </div>
              <!-- logged lane -->
              <div class="relative h-6 mt-1.5">
                <div v-for="(r, i) in dayTimeline.logged" :key="'l' + i"
                  class="absolute top-0 h-6 rounded-md text-[10px] font-bold text-white px-2 leading-6 truncate cursor-pointer hover:brightness-110 shadow-xs flex items-center select-none"
                  :class="r.is_live_active ? 'rounded-r-none z-10' : ''"
                  :style="Object.assign({ left: r.left, width: r.width }, timelineLoggedStyle(r))"
                  tabindex="0"
                  :aria-label="'Logged: ' + (r.notes || r.block.task_subject || 'Session') + ' · ' + fmtHrs(r.hours) + 'h'"
                  @mouseenter="showBlockHover($event, r, 'logged')"
                  @mouseleave="hideBlockHover"
                  @focus="showBlockHover($event, r, 'logged')"
                  @blur="hideBlockHover"
                  @keydown.enter.prevent="openBlockDrawer(r.block)"
                  @click="openBlockDrawer(r.block)">
                  <span v-if="r.is_live_active" class="w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1.5 shrink-0"></span>
                  <span class="truncate">{{ r.notes || r.block.task_subject || (r.timesheet ? 'TS: ' + r.timesheet : 'Logged ' + fmtHrs(r.hours) + 'h') }}</span>
                  <span v-if="r.is_live_active" class="ml-auto text-[9px] font-mono tracking-tight text-white/90 font-black pl-1 shrink-0">REC &bull;</span>
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
                  class="absolute -translate-x-1/2 text-[9px] font-mono text-gray-400" :style="{ left: t.left }">{{ t.label }}</span>
              </div>
            </div>
            </div>
            </div>
            </div>
          </div>

          
          <!-- Category: Happening Now (Excludes block actively tracked in top cockpit) -->
          <div v-if="untrackedCurrentBlocks.length > 0" class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-blue-500">Happening Now</h4>
            <div class="space-y-3">
              <div 
                v-for="b in untrackedCurrentBlocks" 
                :key="b.name"
                class="rounded-3xl p-5 sm:p-6 border shadow-sm transition-all duration-200 border-l-4"
                :class="isTracking && trackerBlockName === b.name ? (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-red-500 text-white' : 'bg-white border-gray-200 border-l-red-500 text-gray-900') : (isDarkMode ? 'bg-[#1E1F22] border-gray-800 border-l-blue-500 text-white' : 'bg-white border-gray-200 border-l-blue-500 text-gray-900')">
                
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div class="space-y-2 flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <!-- Start Time Pill -->
                      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black"
                        :class="isTracking && trackerBlockName === b.name ? 'bg-red-600 text-white' : (isDarkMode ? 'bg-blue-950/70 text-blue-300 border border-blue-800' : 'bg-blue-50 text-blue-700 border border-blue-200')">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>{{ formatBlockRange(b) }}</span>
                      </span>

                      <!-- Dynamic Status Pill -->
                      <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider" :class="getBlockTimingInfo(b).pillClass">
                        {{ getBlockTimingInfo(b).label }}
                      </span>

                      <!-- Nature Badge -->
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border" :class="getNatureBadge(b.task_nature).badgeClass">
                        <span v-html="getNatureBadge(b.task_nature).svgIcon" class="w-3 h-3 flex items-center justify-center" aria-hidden="true"></span>
                        <span>{{ getNatureBadge(b.task_nature).label }}</span>
                      </span>

                      <!-- Project -->
                      <span v-if="b.project_name || b.project" class="text-xs text-gray-500 dark:text-gray-400">
                        📁 {{ b.project_name || b.project }}
                      </span>
                    </div>

                    <!-- Title is text, not a control: starting/stopping happens on the button only. -->
                    <h3 class="text-lg sm:text-xl font-extrabold leading-snug transition-colors"
                      :class="isTracking && trackerBlockName === b.name ? 'text-red-500 dark:text-red-400' : ''">
                      {{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}
                    </h3>

                    <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <span v-if="b.task" class="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                        📋 Task: {{ b.task }}
                      </span>
                      <span>👤 {{ b.associate_name || b.employee }}</span>
                      <span aria-hidden="true">·</span>
                      <span>Expected: <strong class="font-mono font-bold">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
                      <span v-if="b.actual_hours">· Logged: <strong class="text-emerald-500 font-mono font-bold">{{ Number(b.actual_hours).toFixed(1) }}h</strong></span>
                      <span v-if="b.variance_hours !== undefined && b.actual_hours > 0" :class="b.variance_hours <= 0 ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'">
                        ({{ b.variance_hours <= 0 ? '' : '+' }}{{ Number(b.variance_hours).toFixed(1) }}h variance)
                      </span>
                    </div>
                  </div>

                  <!-- Start / Stop Session Button -->
                  <div class="flex items-center gap-3 self-stretch md:self-center justify-end">
                    <template v-if="isTracking && trackerBlockName === b.name">
                      <!-- one clock per card: this is it -->
                      <span class="font-mono font-bold text-sm tabular-nums" :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'" aria-label="Elapsed time">{{ formattedTime }}</span>
                      <button 
                        type="button"
                        @click.stop="requestStopFocusBlock(b)"
                        :aria-label="stopConfirmName === b.name ? 'Stop and save without any log lines' : 'Stop the session and save the timesheet'"
                        class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        :class="stopConfirmName === b.name ? 'bg-red-600 border-red-600 text-white hover:bg-red-700' : (isDarkMode ? 'border-red-800 text-red-300 hover:bg-red-950/40' : 'border-red-300 text-red-700 hover:bg-red-50')">
                        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>
                        <span>{{ stopConfirmName === b.name ? 'Stop anyway' : 'Stop & save' }}</span>
                      </button>
                      <button
                        type="button"
                        @click.stop="discardSession"
                        :aria-label="discardConfirm ? 'Confirm discard: throw this session away without saving' : 'Discard this session without saving'"
                        :title="discardConfirm ? 'Press again to discard' : 'Discard without saving'"
                        class="inline-flex items-center justify-center px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        :class="discardConfirm ? 'bg-amber-500 border-amber-500 text-white' : (isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100')">
                        {{ discardConfirm ? 'Discard?' : 'Discard' }}
                      </button>
                      <button
                        type="button"
                        @click.stop="openAdjustModal"
                        aria-label="Adjust start and end datetime of this timesheet"
                        title="Adjust start/end time (±5 min or backdate)"
                        class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>Adjust</span>
                      </button>
                      <button
                        type="button"
                        @click.stop="openSwitchTaskModal"
                        aria-label="Switch to another task without losing time"
                        title="Switch task (⇄) — log current session and transition to target immediately"
                        class="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-100'">
                        <span class="font-bold" aria-hidden="true">⇄</span>
                        <span>Switch</span>
                      </button>
                    </template>
                    <template v-else>
                      <!-- A block that has not happened yet is still a plan: let it move. -->
                      <button
                        type="button"
                        v-if="!isBlockLocked(b)"
                        @click.stop="openBlockDrawer(b)"
                        :aria-label="'Reschedule ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                        title="Reschedule this planned block"
                        class="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-xs sm:text-sm font-bold border cursor-pointer transition-all active:scale-95 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        :class="isDarkMode ? 'border-gray-700 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span>Reschedule</span>
                      </button>
                      <button 
                        type="button"
                        @click.stop="startFocusBlock(b)"
                        :aria-label="'Start session for ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                        class="flex-1 md:flex-initial inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-[#1A73E8] hover:bg-blue-700 ring-4 ring-blue-500/20 shadow-md transition-all cursor-pointer select-none active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                        <span>Start Session</span>
                      </button>
                    </template>
                  </div>
                </div>

                <!-- Working-on-this indicator. The timesheet itself is filled in the
                     Session Log card above; this card does not duplicate that input. -->
                <div v-if="isTracking && trackerBlockName === b.name"
                  class="mt-3.5 pt-3 border-t flex items-center gap-2 flex-wrap text-[11px] font-semibold"
                  :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'"
                  role="status" aria-live="polite">
                  <span class="inline-flex items-center gap-1.5" :class="isDarkMode ? 'text-red-300' : 'text-red-600'">
                    <span class="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden="true"></span>
                    <span>{{ (b.associate_name || b.employee) === currentUserFullName ? 'You are working on this' : (b.associate_name || b.employee) + ' is working on this' }}</span>
                  </span>
                  <span aria-hidden="true" class="text-gray-300 dark:text-gray-700">·</span>
                  <span class="text-gray-500 dark:text-gray-400" v-if="sessionNotesList.length">{{ sessionNotesList.length }} line{{ sessionNotesList.length === 1 ? '' : 's' }} in the session log</span>
                  <button v-else type="button" @click.stop="focusSessionPointInput"
                    class="underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                    :class="isDarkMode ? 'text-blue-300' : 'text-blue-600'">Nothing logged yet — add a line</button>
                </div>

              </div>
            </div>
          </div>

          <!-- Category: Upcoming Focus Blocks -->
          <div v-if="upcomingFocusBlocks.length > 0" class="space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ focusBlocksHeading }}</h4>
            <div class="space-y-3">
              <f-card 
                v-for="b in upcomingFocusBlocks" 
                :key="b.name"
                :padded="true">
                
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div class="space-y-2 flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <f-badge theme="gray" variant="outline" size="xs">
                        {{ formatBlockRange(b) }}
                      </f-badge>

                      <!-- Dynamic Status Pill -->
                      <f-badge :theme="getBlockBadgeTheme(b)" variant="subtle" size="xs">
                        {{ getBlockTimingInfo(b).label }}
                      </f-badge>

                      <f-badge v-if="b.task_nature" theme="gray" variant="outline" size="xs">
                        {{ getNatureBadge(b.task_nature).label }}
                      </f-badge>

                      <f-badge v-if="b.project_name || b.project" theme="blue" variant="subtle" size="xs">
                        📁 {{ b.project_name || b.project }}
                      </f-badge>
                    </div>

                    <h3 class="text-base sm:text-lg font-bold leading-snug">
                      {{ b.task_subject || b.deliverable_notes || 'Focus Work Block' }}
                    </h3>

                    <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <f-badge v-if="b.task" theme="blue" variant="outline" size="xs">
                        📋 Task: {{ b.task }}
                      </f-badge>
                      <span>👤 {{ b.associate_name || b.employee }}</span>
                      <span aria-hidden="true">·</span>
                      <span>Expected: <strong class="font-mono font-bold">{{ Number(b.duration_hours || 0).toFixed(1) }}h</strong></span>
                    </div>
                  </div>

                  <!-- Actions Cluster (Frappe UI FButton) -->
                  <div class="flex items-center gap-2 self-stretch md:self-center justify-end">
                    <f-button
                      v-if="!isBlockLocked(b)"
                      theme="gray"
                      variant="outline"
                      size="sm"
                      @click.stop="openBlockDrawer(b)"
                      :aria-label="'Reschedule ' + (b.task_subject || b.deliverable_notes || 'Work Block')"
                      title="Reschedule this planned block">
                      Reschedule
                    </f-button>
                    <f-button 
                      theme="blue"
                      variant="solid"
                      size="sm"
                      @click.stop="startFocusBlock(b)"
                      :aria-label="'Start session for ' + (b.task_subject || b.deliverable_notes || 'Work Block')">
                      ▶ Start Session
                    </f-button>
                  </div>
                </div>

              </f-card>
            </div>
          </div>

          <!-- Category: Past / Completed Focus Blocks (Daily Accomplishments & Debrief) -->
          <div v-if="pastFocusBlocks.length > 0" class="space-y-3">
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
                <f-badge theme="green" variant="subtle" size="sm">
                  ✓ {{ pastDeliverablesStats.completedCount }} Completed
                </f-badge>
                <f-badge v-if="pastDeliverablesStats.cancelledCount > 0" theme="red" variant="subtle" size="sm">
                  🚫 {{ pastDeliverablesStats.cancelledCount }} Cancelled
                </f-badge>
                <f-badge theme="gray" variant="subtle" size="sm">
                  ⏱️ {{ pastDeliverablesStats.totalLogged }}h Logged
                </f-badge>
                <f-badge v-if="pastDeliverablesStats.totalPlanned > 0" theme="blue" variant="subtle" size="sm">
                  {{ pastDeliverablesStats.adherencePct }}% Adherence
                </f-badge>
              </div>
            </div>

            <!-- List of Completed / Concluded Blocks (Frappe UI FCard) -->
            <div 
              role="grid" 
              class="space-y-3.5"
              :aria-rowcount="visiblePastFocusBlocks.length"
              aria-colcount="4"
              aria-label="Daily accomplishments and concluded deliverables. Use arrow keys to navigate between cards and actions.">
              <f-card 
                v-for="(b, rIdx) in visiblePastFocusBlocks" 
                :key="b.name"
                role="row"
                :aria-rowindex="rIdx + 1"
                :accent="getBlockCardAccent(b)"
                :padded="true"
                @click="openBlockDrawer(b)"
                class="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500/30">
                
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="space-y-1.5 flex-1 min-w-0">
                    <!-- Badges & Taxonomy Row -->
                    <div class="flex items-center gap-2 flex-wrap">
                      <f-badge theme="gray" variant="outline" size="xs">
                        <span v-if="b.work_date && selectedDashboardDate && b.work_date !== selectedDashboardDate" class="text-blue-500 font-bold mr-1">↩ (cont.)</span>
                        {{ formatBlockRange(b) }}
                      </f-badge>

                      <!-- Dynamic Status Pill -->
                      <f-badge :theme="getBlockBadgeTheme(b)" variant="subtle" size="xs">
                        {{ getBlockTimingInfo(b).label }}
                      </f-badge>

                      <f-badge v-if="b.task_nature" theme="gray" variant="outline" size="xs">
                        {{ getNatureBadge(b.task_nature).label }}
                      </f-badge>

                      <f-badge v-if="b.project_name || b.project" theme="blue" variant="subtle" size="xs">
                        📁 {{ b.project_name || b.project }}
                      </f-badge>
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
                        <span class="text-xs font-normal text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">View audit →</span>
                      </button>
                    </h4>

                    <!-- Plan vs Actual Metadata Metrics -->
                    <div class="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <f-badge v-if="b.task" theme="blue" variant="outline" size="xs">
                        📋 Task: {{ b.task }}
                      </f-badge>
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
                      <f-badge v-if="getBlockVarianceBadge(b)" :theme="getBlockVarianceBadge(b).theme" variant="subtle" size="xs">
                        {{ getBlockVarianceBadge(b).label }}
                      </f-badge>
                    </div>
                  </div>

                  <!-- Actions Cluster (Frappe UI FButton) -->
                  <div class="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <!-- 1-Click Plan-to-Actuals Catch-Up Action (Pillar 1) -->
                    <f-button
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
                      :aria-label="'Log planned duration ' + Number(b.duration_hours || 0).toFixed(1) + 'h as completed timesheet'"
                      title="1-Click convert planned commitment to actual logged timesheet">
                      ⚡ Convert ({{ Number(b.duration_hours || 0).toFixed(1) }}h)
                    </f-button>
                    <!-- Column 1: View Audit & Notes -->
                    <f-button
                      theme="gray"
                      variant="outline"
                      size="sm"
                      @click.stop="openBlockDrawer(b)"
                      :tabindex="concludedTabindex(rIdx, 2)"
                      :data-concluded-row="rIdx"
                      :data-concluded-col="2"
                      @focus="setConcludedRoving(rIdx, 2)"
                      @keydown="onConcludedGridKey($event, rIdx, 2)"
                      :aria-label="'View audit details for ' + (b.task_subject || b.deliverable_notes || 'Block')">
                      View Audit & Notes
                    </f-button>
                    <!-- Column 2: Re-open (if permitted) -->
                    <f-button
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
                      :aria-label="'Re-open focus session for ' + (b.task_subject || b.deliverable_notes || 'Focus Work Block')"
                      title="Re-open or append time to this completed block">
                      ↺ Re-open
                    </f-button>
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
                    <f-button
                      theme="gray"
                      variant="ghost"
                      size="xs"
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
                    </f-button>
                  </div>
                  <!-- Wait time sessions -->
                  <div v-if="b.sessions && b.sessions.length" class="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-[11px] text-rose-700 dark:text-rose-300">
                    <span class="font-mono">Logged wait window: {{ hhmm(b.sessions[0].from_time) }}–{{ hhmm(b.sessions[0].to_time) }}</span>
                    <f-badge theme="red" variant="subtle" size="xs">{{ fmtHrs(b.sessions[0].hours) }}h wait</f-badge>
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
                      <f-badge theme="gray" variant="outline" size="xs">
                        {{ (b.sessions && b.sessions.length) ? (b.sessions.length + ' session' + (b.sessions.length > 1 ? 's' : '')) : 'Verified' }}
                      </f-badge>
                    </div>

                    <!-- The actual deliverable note displayed with truncation toggle if long -->
                    <p v-if="b.deliverable_notes" 
                      class="text-xs sm:text-[13px] leading-relaxed whitespace-pre-line text-gray-800 dark:text-gray-100 font-sans"
                      :style="!isBlockNotesExpanded(b.name) && isLongNote(b.deliverable_notes) ? '-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;' : ''">
                      {{ b.deliverable_notes }}
                    </p>

                    <!-- Expand / Collapse Note Details Button (Frappe UI FButton) -->
                    <div v-if="isLongNote(b.deliverable_notes) || (b.sessions && b.sessions.length > 1)" class="pt-1">
                      <f-button
                        theme="gray"
                        variant="ghost"
                        size="xs"
                        @click.stop="toggleBlockNotes(b.name)"
                        :tabindex="concludedTabindex(rIdx, getConcludedNotesCol(b))"
                        :data-concluded-row="rIdx"
                        :data-concluded-col="getConcludedNotesCol(b)"
                        @focus="setConcludedRoving(rIdx, getConcludedNotesCol(b))"
                        @keydown="onConcludedGridKey($event, rIdx, getConcludedNotesCol(b))"
                        :aria-expanded="isBlockNotesExpanded(b.name) ? 'true' : 'false'">
                        <span v-if="!isBlockNotesExpanded(b.name)" class="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <span>Show full details & breakdown</span>
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                        <span v-else class="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <span>Show less</span>
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                        </span>
                      </f-button>
                    </div>

                    <!-- Detailed Child Sessions (shown if expanded, or if single session with distinct notes) -->
                    <div v-if="b.sessions && b.sessions.length && (isBlockNotesExpanded(b.name) || b.sessions.length === 1) && (b.sessions.length > 1 || (b.sessions[0].notes && b.sessions[0].notes !== b.deliverable_notes))" class="mt-2.5 pt-2.5 border-t space-y-1.5 border-gray-200/60 dark:border-gray-800">
                      <div v-for="(s, i) in b.sessions" :key="i"
                        class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] rounded-xl px-2.5 py-1.5 bg-white border border-gray-200/60 dark:bg-[#1E1F22] dark:border-gray-800">
                        <div class="flex items-center gap-2 min-w-0">
                          <span v-if="s.from_time" class="font-mono text-gray-500 font-medium shrink-0">{{ hhmm(s.from_time) }}–{{ hhmm(s.to_time) }}</span>
                          <span v-if="s.notes" class="text-gray-700 dark:text-gray-300 break-words">· {{ s.notes }}</span>
                        </div>
                        <f-badge theme="gray" variant="subtle" size="xs">{{ fmtHrs(s.hours) }}h</f-badge>
                      </div>
                    </div>
                  </div>

                  <!-- Warning if nothing was logged -->
                  <div v-else-if="blockLogState(b) === 'none'" class="rounded-xl p-2.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>No timesheet sessions were recorded against this planned block.</span>
                  </div>
                </div>

              </f-card>
            </div>

            <!-- Show More / Show Less Toggle (Frappe UI FButton) -->
            <div v-if="pastFocusBlocks.length > 2" class="pt-2 flex justify-center">
              <f-button
                theme="gray"
                variant="outline"
                size="sm"
                @click="toggleShowAllPastBlocks"
                :aria-expanded="showAllPastBlocks ? 'true' : 'false'"
                :aria-label="showAllPastBlocks ? 'Show fewer completed deliverables' : ('Show ' + remainingPastBlocksCount + ' more completed deliverables')">
                <span v-if="!showAllPastBlocks" class="inline-flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                  <span>Show {{ remainingPastBlocksCount }} more deliverables</span>
                </span>
                <span v-else class="inline-flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                  <span>Show less</span>
                </span>
              </f-button>
            </div>
          </div>

          <!-- Category: Away / Leave Events -->
          <div v-if="awayFocusBlocks.length > 0" class="space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-amber-500">Time Away</h4>
            <div class="space-y-2">
              <div 
                v-for="b in awayFocusBlocks" 
                :key="b.name"
                class="rounded-2xl p-3.5 border flex items-center justify-between gap-3 text-xs"
                :class="isDarkMode ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50/70 border-amber-200 text-amber-900'">
                <div class="flex items-center gap-2">
                  <span class="text-base">🌴</span>
                  <div>
                    <span class="font-bold">{{ b.task_nature || 'Out-of-Office' }}</span>
                    <span v-if="b.deliverable_notes" class="ml-2 font-normal text-amber-600 dark:text-amber-400">({{ b.deliverable_notes }})</span>
                  </div>
                </div>
                <span class="font-mono font-bold">{{ b.start_time ? formatBlockRange(b) : 'All Day' }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Google Meet Empty State -->
        <div v-else class="rounded-3xl p-10 sm:p-14 border text-center space-y-4" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-blue-500/10 text-blue-500 text-2xl">
            📅
          </div>
          <div class="space-y-1">
            <h3 class="text-lg font-extrabold">No focus blocks scheduled for {{ selectedDashboardDateLabel }}</h3>
            <p class="text-xs text-gray-400 max-w-sm mx-auto">
              Schedule focus blocks just like meetings to protect your time and maintain high plan adherence.
            </p>
          </div>
          <div class="flex items-center justify-center gap-3 pt-2">
            <button 
              @click="openNewTaskModal"
              class="px-5 py-2.5 rounded-full text-xs font-bold bg-[#1B64DA] hover:bg-blue-600 text-white transition-all shadow-md cursor-pointer active:scale-95">
              + Plan Focus Block
            </button>
            <button 
              @click="activeTab = 'planner'"
              class="px-5 py-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer"
              :class="isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'">
              Open Week Planner →
            </button>
          </div>
        </div>

      </div>

      <!-- Pillar 5: End-of-Day (EOD) Wrap-Up Ritual Card (visible after 16:30 or when logged < 8.0h) -->
      <div v-if="eodSummary && (eodSummary.remaining_to_target > 0 || eodSummary.is_eod_time)" class="rounded-3xl p-4 sm:p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
        :class="isDarkMode ? 'bg-[#1E1F22] border-amber-800/60' : 'bg-gradient-to-r from-amber-50/80 to-blue-50/50 border-amber-200'">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 shadow-xs"
            :class="eodSummary.remaining_to_target === 0 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'">
            {{ eodSummary.remaining_to_target === 0 ? '🎉' : '🏁' }}
          </div>
          <div class="space-y-0.5 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">EOD Timesheet Reconciliation</span>
              <f-badge :theme="eodSummary.remaining_to_target === 0 ? 'green' : 'amber'" variant="subtle" size="xs">
                {{ eodSummary.remaining_to_target === 0 ? 'Goal Met: 8.0h Logged' : eodSummary.remaining_to_target + 'h remaining to 8.0h target' }}
              </f-badge>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-300 font-medium">
              Today: <strong class="font-bold">{{ eodSummary.total_actual_hours }}h</strong> logged of 8.0h target across <strong class="font-bold">{{ eodSummary.blocks_count }}</strong> session{{ eodSummary.blocks_count === 1 ? '' : 's' }}.
              <span v-if="eodSummary.unconverted_count > 0" class="text-amber-600 dark:text-amber-400 font-bold ml-1">({{ eodSummary.unconverted_count }} unlogged planned blocks pending).</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <f-button
            v-if="eodSummary.unconverted_count > 0"
            variant="solid"
            theme="green"
            size="sm"
            @click="convertAllPendingPlannedBlocks"
            title="Convert all unlogged planned blocks to logged actuals"
            class="font-bold">
            ⚡ Convert All ({{ eodSummary.unconverted_hours }}h)
          </f-button>
          <f-button
            variant="outline"
            theme="blue"
            size="sm"
            @click="openEODWrapUpDrawer"
            class="font-bold">
            <span>Review & Close Day →</span>
          </f-button>
        </div>
      </div>

      <!-- 4. Statistics last: the day's numbers, after the things you act on -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        
        <!-- Today Card: Today's Hours & Commitment -->
        <div class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div>
            <div class="flex items-center justify-between gap-2 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50"></span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Today's Hours & Commitment</h3>
              </div>
              <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full" :class="dashboardKPIs.today.todo_completed_pct >= 100 ? (isDarkMode ? 'bg-emerald-950 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (dashboardKPIs.today.todo_completed_pct > 0 ? (isDarkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-blue-700') : (isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'))">
                {{ dashboardKPIs.today.todo_completed_pct }}% ToDo Done
              </span>
            </div>

            <!-- Big Primary Metric: Worked Hours -->
            <div class="mt-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Worked Hours</div>
              <div class="flex items-baseline gap-1.5 mt-0.5">
                <span class="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-gray-900 dark:text-white">{{ Number(dashboardKPIs.today.actual_hours || 0).toFixed(1) }}h</span>
              </div>
            </div>

            <!-- Progress Bar towards Planned or Target -->
            <div class="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-3" title="Daily ToDo Completion Progress">
              <div class="h-full rounded-full transition-all duration-500"
                :class="dashboardKPIs.today.todo_completed_pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'"
                :style="{ width: Math.min(100, Math.round(dashboardKPIs.today.todo_completed_pct || ((dashboardKPIs.today.actual_hours || 0) / (dashboardKPIs.today.planned_hours || dashboardKPIs.today.target_hours || 8)) * 100)) + '%' }"></div>
            </div>

            <!-- Secondary Metrics: Planned, Target & Variance Pill Grid -->
            <div class="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t text-center text-[10.5px]" :class="isDarkMode ? 'border-gray-800/80' : 'border-gray-100'">
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Planned</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.today.planned_hours || 0).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Target</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.today.target_hours || 8).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="dashboardKPIs.today.variance_hours >= 0 ? (isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-amber-950/40 text-amber-300' : 'bg-amber-50 text-amber-700')">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Variance</div>
                <div class="font-mono font-bold mt-0.5">{{ dashboardKPIs.today.variance_hours >= 0 ? '+' : '' }}{{ Number(dashboardKPIs.today.variance_hours || 0).toFixed(1) }}h</div>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between text-[11px] font-medium pt-3 text-gray-500 dark:text-gray-400 border-t mt-3" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <span class="flex items-center gap-1">
              <span>🎯</span>
              <span>{{ dashboardKPIs.today.completed_count }}/{{ dashboardKPIs.today.block_count }} Sessions</span>
            </span>
            <span v-if="dashboardKPIs.today.non_working_hours > 0" class="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold">
              <span>☕</span>
              <span>{{ Number(dashboardKPIs.today.non_working_hours || 0).toFixed(1) }}h Non-Working</span>
            </span>
            <span v-else class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <span>⚡</span>
              <span>Standard Day</span>
            </span>
          </div>
        </div>

        <!-- This Week Card: Weekly Velocity -->
        <div class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div>
            <div class="flex items-center justify-between gap-2 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-xs shadow-indigo-500/50"></span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Weekly Velocity</h3>
              </div>
              <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {{ dashboardKPIs.week.adherence_pct }}% Adherence
              </span>
            </div>

            <!-- Big Primary Metric: Worked Hours -->
            <div class="mt-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Worked Hours</div>
              <div class="flex items-baseline gap-1.5 mt-0.5">
                <span class="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-gray-900 dark:text-white">{{ Number(dashboardKPIs.week.actual_hours || 0).toFixed(1) }}h</span>
              </div>
            </div>

            <!-- Progress Bar towards Weekly Adherence -->
            <div class="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-3" title="Weekly Velocity Adherence">
              <div class="bg-indigo-500 h-full rounded-full transition-all duration-500"
                :style="{ width: Math.min(100, dashboardKPIs.week.adherence_pct || 0) + '%' }"></div>
            </div>

            <!-- Secondary Metrics: Planned, Target & Variance Grid -->
            <div class="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t text-center text-[10.5px]" :class="isDarkMode ? 'border-gray-800/80' : 'border-gray-100'">
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Planned</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.week.planned_hours || 0).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Target</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.week.target_hours || 40).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="dashboardKPIs.week.variance_hours >= 0 ? (isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-amber-950/40 text-amber-300' : 'bg-amber-50 text-amber-700')">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Variance</div>
                <div class="font-mono font-bold mt-0.5">{{ dashboardKPIs.week.variance_hours >= 0 ? '+' : '' }}{{ Number(dashboardKPIs.week.variance_hours || 0).toFixed(1) }}h</div>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between text-[11px] font-medium pt-3 text-gray-500 dark:text-gray-400 border-t mt-3" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <span class="flex items-center gap-1">
              <span>⚖️</span>
              <span>{{ dashboardKPIs.week.block_count }} Active Blocks</span>
            </span>
            <span v-if="dashboardKPIs.week.non_working_hours > 0" class="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold">
              <span>🌴</span>
              <span>{{ Number(dashboardKPIs.week.non_working_hours || 0).toFixed(1) }}h Non-Working</span>
            </span>
            <span v-else class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <span>📅</span>
              <span>Full Work Week</span>
            </span>
          </div>
        </div>

        <!-- This Month Card: Monthly Capacity -->
        <div class="rounded-3xl p-4 sm:p-5 border shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900'">
          <div>
            <div class="flex items-center justify-between gap-2 pb-2">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50"></span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monthly Capacity</h3>
              </div>
              <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {{ dashboardKPIs.month.capacity_pct }}% Utilized
              </span>
            </div>

            <!-- Big Primary Metric: Worked Hours -->
            <div class="mt-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Worked Hours</div>
              <div class="flex items-baseline gap-1.5 mt-0.5">
                <span class="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-gray-900 dark:text-white">{{ Number(dashboardKPIs.month.actual_hours || 0).toFixed(1) }}h</span>
              </div>
            </div>

            <!-- Progress Bar towards Target Capacity -->
            <div class="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-3" title="Capacity Utilization against Target">
              <div class="bg-emerald-500 h-full rounded-full transition-all duration-500"
                :style="{ width: Math.min(100, dashboardKPIs.month.capacity_pct || 0) + '%' }"></div>
            </div>

            <!-- Secondary Metrics: Planned, Target & Variance Grid -->
            <div class="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t text-center text-[10.5px]" :class="isDarkMode ? 'border-gray-800/80' : 'border-gray-100'">
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Planned</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.month.planned_hours || 0).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="isDarkMode ? 'bg-gray-800/40' : 'bg-gray-50'">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Target</div>
                <div class="font-mono font-bold text-gray-700 dark:text-gray-200 mt-0.5">{{ Number(dashboardKPIs.month.target_hours || dashboardKPIs.month.capacity_hours || 160).toFixed(1) }}h</div>
              </div>
              <div class="p-1.5 rounded-xl" :class="(dashboardKPIs.month.actual_hours - dashboardKPIs.month.planned_hours) >= 0 ? (isDarkMode ? 'bg-emerald-950/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-amber-950/40 text-amber-300' : 'bg-amber-50 text-amber-700')">
                <div class="text-[9.5px] uppercase font-bold text-gray-400">Variance</div>
                <div class="font-mono font-bold mt-0.5">{{ (dashboardKPIs.month.actual_hours - dashboardKPIs.month.planned_hours) >= 0 ? '+' : '' }}{{ Number((dashboardKPIs.month.actual_hours || 0) - (dashboardKPIs.month.planned_hours || 0)).toFixed(1) }}h</div>
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between text-[11px] font-medium pt-3 text-gray-500 dark:text-gray-400 border-t mt-3" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
            <span class="flex items-center gap-1">
              <span>📋</span>
              <span>{{ dashboardKPIs.month.month || 'This Month' }}</span>
            </span>
            <span v-if="dashboardKPIs.month.non_working_hours > 0" class="flex items-center gap-1 text-rose-500 dark:text-rose-400 font-bold">
              <span>🌴</span>
              <span>{{ Number(dashboardKPIs.month.non_working_hours || 0).toFixed(1) }}h Non-Working</span>
            </span>
            <span v-else class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
              <span>🎯</span>
              <span>Full Capacity</span>
            </span>
          </div>
        </div>

      </div>

    </div>

  </div>  <!-- /TAB 1: DASHBOARD -->
</template>

<script>
export default {
  name: 'DashboardView',
  props: {
    isDarkMode: { type: Boolean, default: false },
    isManager: { type: Boolean, default: false },
    isClient: { type: Boolean, default: false },
    isTracking: { type: Boolean, default: false },
    trackerBoundBlock: { type: Object, default: () => null },
    trackerBlockName: { type: String, default: '' },
    clientMetrics: { type: Object, default: () => ({}) },
    clientCompletedBlocks: { type: Array, default: () => [] },
    clientInProgressBlocks: { type: Array, default: () => [] },
    clientCancelledBlocks: { type: Array, default: () => [] },
    clientUpcomingBlocks: { type: Array, default: () => [] },
    dayPlannerStats: { type: Object, default: () => ({}) },
    dayFocusBlocks: { type: Array, default: () => [] },
    showAllDayFocusBlocks: { type: Boolean, default: false },
    dailyAccomplishments: { type: Array, default: () => [] },
    timelineSegments: { type: Array, default: () => [] },
    timelineGridHours: { type: Array, default: () => [] },
    timelineZoomMode: { type: String, default: 'day' },
    isTodayTimeline: { type: Boolean, default: true },
    redLineLeftPct: { type: Number, default: 0 },
    currentTimelineTimeFormatted: { type: String, default: '' },
    adherenceTheme: { type: String, default: 'gray' },
    adherenceEmoji: { type: String, default: '⚪' },
    fmtHrs: { type: Function, default: (h) => (h != null ? Number(h).toFixed(2) : '0.00') },
    hhmm: { type: Function, default: (t) => (t ? t.slice(0, 5) : '') },
    isBlockCompleted: { type: Function, default: () => false },
    isBlockLocked: { type: Function, default: () => false }
  },
  emits: [
    'open-block-drawer',
    'open-task-raven-drawer',
    'open-book-modal',
    'open-eod-modal',
    'start-session',
    'stop-session',
    'switch-task',
    'toggle-all-blocks',
    'set-timeline-zoom',
    'navigate-timeline-day'
  ]
}
</script>
