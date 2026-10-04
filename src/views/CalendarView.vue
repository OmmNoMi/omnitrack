<template>
  <div class="space-y-4 sm:space-y-5 lg:space-y-0 lg:flex-1 lg:min-h-0 lg:h-full lg:flex lg:flex-col">
<!-- 3-Column Responsive Grid on Big Large Screens: Left Assigned Work · Center Calendar · Right Stats -->
      <div class="grid grid-cols-1 lg:grid-cols-[240px_1fr_220px] xl:grid-cols-[280px_1fr_260px] gap-3.5 sm:gap-4 items-stretch lg:h-full lg:min-h-0 flex-1">

        <!-- Left rail: assigned tasks (Frappe UI FCard) -->
        <f-card :padded="true" class="w-full flex flex-col space-y-2.5 !p-3.5 min-h-0 overflow-hidden max-h-[500px] lg:max-h-full lg:h-full lg:min-h-0 order-2 lg:order-1 h-full">
          <!-- Teammate Switcher for Managers (Dynamically updates Assigned Work, Calendar, and Stats) -->
          <div v-if="isManager" class="space-y-1 pb-2 border-b shrink-0" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>👤 Team Teammate</span>
              <span class="text-blue-500 font-normal">Active Cockpit</span>
            </label>
            <f-dropdown-menu
              :items="employeeMenuItems"
              align="left"
              class="w-full"
              aria-label="Filter entire workspace by teammate"
            >
              <template #trigger="{ isOpen }">
                <f-button
                  variant="outline"
                  theme="gray"
                  size="sm"
                  class="w-full !justify-between !text-xs font-semibold cursor-pointer"
                  :aria-expanded="isOpen ? 'true' : 'false'"
                >
                  <span class="truncate flex items-center gap-1.5">
                    <span>👤</span>
                    <span>{{ selectedEmployee === 'All' ? 'All Team Members' : selectedEmployee }}</span>
                  </span>
                  <template #suffix>
                    <svg class="w-3.5 h-3.5 opacity-60 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </template>
                </f-button>
              </template>
            </f-dropdown-menu>
          </div>

          <div class="flex items-center justify-between shrink-0">
            <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
              {{ isManager && selectedEmployee !== 'All' ? 'Assigned to ' + (selectedEmployee.split('@')[0]) : 'My Assigned Work' }}
            </h3>
            <f-badge theme="gray" variant="subtle" size="xs">{{ filteredPlannerTasks.length }}</f-badge>
          </div>
          
          <!-- Quick Search & Filter in Planner Rail -->
          <div class="space-y-1.5 shrink-0">
            <f-input
              size="sm"
              v-model="plannerTaskSearch"
              placeholder="Search assigned tasks..."
              aria-label="Search assigned tasks"
            >
              <template #prefix>
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </template>
              <template #suffix>
                <button v-if="plannerTaskSearch" @click="plannerTaskSearch = ''" type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs cursor-pointer p-0.5" aria-label="Clear search">✕</button>
              </template>
            </f-input>
            
            <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5" role="tablist" aria-label="Filter assigned work tasks" @keydown="onPlannerTaskTabKeydown">
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'all' ? 'solid' : 'subtle'"
                theme="gray"
                :aria-selected="plannerTaskFilter === 'all'"
                :tabindex="plannerTaskFilter === 'all' ? 0 : -1"
                data-planner-tab="all"
                title="All assigned tasks"
                @click="setPlannerTaskFilter('all')"
              >
                <template #prefix><span aria-hidden="true">🌐</span></template>
                <span v-if="plannerTaskFilter === 'all'">All</span>
              </f-button>
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'underplanned' ? 'solid' : 'subtle'"
                theme="amber"
                :aria-selected="plannerTaskFilter === 'underplanned'"
                :tabindex="plannerTaskFilter === 'underplanned' ? 0 : -1"
                data-planner-tab="underplanned"
                title="Underplanned tasks"
                @click="setPlannerTaskFilter('underplanned')"
              >
                <template #prefix><span aria-hidden="true">⏱️</span></template>
                <span v-if="plannerTaskFilter === 'underplanned'">Underplanned</span>
              </f-button>
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'overdue' ? 'solid' : 'subtle'"
                theme="red"
                :aria-selected="plannerTaskFilter === 'overdue'"
                :tabindex="plannerTaskFilter === 'overdue' ? 0 : -1"
                data-planner-tab="overdue"
                title="Overdue tasks"
                @click="setPlannerTaskFilter('overdue')"
              >
                <template #prefix><span aria-hidden="true">⚠️</span></template>
                <span v-if="plannerTaskFilter === 'overdue'">Overdue</span>
              </f-button>
              <f-button
                type="button"
                role="tab"
                size="xs"
                :variant="plannerTaskFilter === 'high' ? 'solid' : 'subtle'"
                theme="purple"
                :aria-selected="plannerTaskFilter === 'high'"
                :tabindex="plannerTaskFilter === 'high' ? 0 : -1"
                data-planner-tab="high"
                title="High priority tasks"
                @click="setPlannerTaskFilter('high')"
              >
                <template #prefix><span aria-hidden="true">⭐</span></template>
                <span v-if="plannerTaskFilter === 'high'">High</span>
              </f-button>
            </div>
          </div>

          <div v-if="!filteredPlannerTasks.length" class="text-xs text-gray-400 py-6 text-center flex-1 flex flex-col items-center justify-center">
            <span>No matching tasks found.</span>
            <button v-if="plannerTaskFilter !== 'all' || plannerTaskSearch" type="button" 
              class="text-blue-500 font-bold hover:underline mt-1 text-[11px]" 
              @click="setPlannerTaskFilter('all'); plannerTaskSearch = ''">
              Clear filters
            </button>
          </div>
          <ul v-else class="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
            <li v-for="t in filteredPlannerTasks" :key="t.ref" class="rounded-2xl border transition-all overflow-hidden"
              :class="pickedTask && pickedTask.ref === t.ref
                ? (isDarkMode ? 'bg-blue-950/70 border-blue-600 ring-2 ring-blue-500/30' : 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20')
                : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 hover:border-gray-600' : 'bg-gray-50 border-gray-200 hover:border-gray-300')">
              <button type="button"
                @click="pickTask(t)"
                class="w-full text-left p-3 cursor-pointer">
                <div class="text-xs font-bold leading-snug" :class="isDarkMode ? 'text-gray-100' : 'text-gray-800'">{{ t.subject }}</div>
                <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <f-badge v-if="t.project_name" theme="gray" variant="outline" size="xs">{{ t.project_name }}</f-badge>
                  <f-badge v-if="t.priority" :theme="t.priority === 'High' || t.priority === 'Urgent' ? 'red' : 'amber'" variant="subtle" size="xs">{{ t.priority }}</f-badge>
                  <span v-if="t.due_date" class="text-[10px] text-gray-400 font-mono">due {{ t.due_date }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                  <span>planned <b :class="isDarkMode ? 'text-gray-200' : 'text-gray-700'">{{ fmtHrs(t.booked_hours) }}h</b></span>
                  <span>·</span>
                  <span>logged <b class="text-emerald-500">{{ fmtHrs(t.logged_hours) }}h</b></span>
                  <span>·</span>
                  <span>expected <b :class="t.estimate_hours ? (isDarkMode ? 'text-gray-200' : 'text-gray-700') : 'text-gray-400'">{{ fmtHrs(t.estimate_hours) }}h</b></span>
                </div>
              </button>
              <div class="px-3 py-1.5 border-t flex items-center justify-between" :class="isDarkMode ? 'border-gray-700/60 bg-black/10' : 'border-gray-200/60 bg-white/50'">
                <button type="button" @click.stop="openTaskDetails(t)" class="text-[10px] text-gray-400 font-mono truncate max-w-[120px] hover:text-blue-500 hover:underline cursor-pointer" title="View details in sidebar drawer">
                  #{{ t.name || t.ref }}
                </button>
                <div class="flex items-center gap-2">
                  <button type="button" @click.stop="openTaskDetails(t)" class="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer" title="Open full details panel">
                    <span>Details</span>
                  </button>
                  <button type="button" @click.stop="openTaskRavenDrawer(t)" class="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1 cursor-pointer" title="Discuss in Raven channel">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>Discuss</span>
                  </button>
                </div>
              </div>
            </li>
          </ul>
        </f-card>

        <!-- Calendar (Frappe UI FCard Container) -->
        <f-card :padded="false" class="-mx-3 sm:mx-0 rounded-none sm:rounded-3xl border-x-0 sm:border-x overflow-hidden flex flex-col min-h-0 h-[640px] lg:h-full lg:max-h-full lg:min-h-0 order-1 lg:order-2">
          <!-- toolbar (Frappe UI Controls) -->
          <div class="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 border-b transition-colors" :class="isDarkMode ? 'border-gray-800 bg-[#25262A]' : 'border-gray-200 bg-gray-50/60'">
            
            <!-- Left: Today Button, Period Navigation Chevrons, Date Range -->
            <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <!-- Jump to Today Button -->
              <f-button 
                variant="subtle" 
                theme="gray" 
                size="sm" 
                @click="plannerToday" 
                aria-label="Jump to current date in calendar"
              >
                Today
              </f-button>

              <!-- Grouped Navigation Chevrons -->
              <div class="inline-flex items-center rounded-xl border p-0.5 shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-white border-gray-300'" role="group" aria-label="Calendar period navigation">
                <f-button 
                  variant="ghost" 
                  theme="gray" 
                  size="sm" 
                  class="!w-7 !h-7 !p-0"
                  @click="plannerShift(-1)" 
                  :aria-label="'Previous ' + (plannerView === 'day' ? 'day' : (plannerView === '4days' ? '4 days' : 'week'))"
                >
                  <template #prefix>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </template>
                </f-button>

                <div class="w-[1px] h-4 mx-1" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" aria-hidden="true"></div>

                <h3 class="text-xs sm:text-sm font-extrabold tracking-tight text-center px-2 tabular-nums whitespace-nowrap flex-1 sm:flex-none sm:w-[168px]" :class="isDarkMode ? 'text-white' : 'text-gray-900'" aria-live="polite">
                  {{ plannerRangeLabel }}
                </h3>

                <div class="w-[1px] h-4 mx-1" :class="isDarkMode ? 'bg-gray-700' : 'bg-gray-200'" aria-hidden="true"></div>

                <f-button 
                  variant="ghost" 
                  theme="gray" 
                  size="sm" 
                  class="!w-7 !h-7 !p-0"
                  @click="plannerShift(1)" 
                  :aria-label="'Next ' + (plannerView === 'day' ? 'day' : (plannerView === '4days' ? '4 days' : 'week'))"
                >
                  <template #prefix>
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </template>
                </f-button>
              </div>

            </div>

            <!-- Right: Nature Filter & View Switcher (Day / 4 Days / Week) -->
            <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">

              <!-- Nature filter (Frappe UI FDropdownMenu) -->
              <f-dropdown-menu :items="plannerNatureMenuItems" align="right" :aria-label="'Filter calendar events by nature: ' + natureFilterLabel">
                <template #trigger="{ toggle, isOpen }">
                  <f-button
                    variant="outline"
                    :theme="natureFilter.length ? 'blue' : 'gray'"
                    size="sm"
                    class="min-w-[130px] max-w-[200px] !justify-between text-xs font-bold transition-all"
                    :class="natureFilter.length ? (isDarkMode ? 'bg-blue-950/40 border-blue-600 text-blue-300 font-extrabold ring-1 ring-blue-500/30' : 'bg-blue-50 border-blue-300 text-blue-800 font-extrabold ring-1 ring-blue-500/20') : ''"
                    :aria-expanded="isOpen"
                    :aria-label="'Filter calendar events by nature. Current filter: ' + natureFilterLabel"
                    @click="toggle"
                  >
                    <span class="truncate flex items-center gap-1.5">
                      <span v-if="natureFilter.length" class="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden="true"></span>
                      <span>{{ natureFilterLabel }}</span>
                    </span>
                    <template #suffix>
                      <svg class="w-3.5 h-3.5 opacity-60 ml-1 shrink-0 transition-transform" :class="isOpen ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.5 7.5l4.5 4.5 4.5-4.5z"></path></svg>
                    </template>
                  </f-button>
                </template>
              </f-dropdown-menu>


              <!-- View Switcher: Day / 4 Days / Week (Frappe UI Button Group) -->
              <div class="inline-flex items-center rounded-xl p-0.5 border shadow-xs" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700' : 'bg-gray-100 border-gray-300'" role="radiogroup" aria-label="Calendar view density" @keydown="onPlannerViewKey">
                <f-button 
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
                </f-button>
                <f-button 
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
                </f-button>
                <f-button 
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
                </f-button>
              </div>
            </div>
          </div>

          <!-- Banners & Feedback -->
          <div v-if="pastBookingHint" class="px-3 py-2 text-[11px] font-semibold flex items-center gap-2 border-b" :class="isDarkMode ? 'bg-amber-950/60 text-amber-200 border-amber-900/50' : 'bg-amber-50 text-amber-800 border-amber-200'" role="status">
            <f-badge theme="amber" variant="solid" size="xs">🔒</f-badge>
            <span>{{ pastBookingHint }}</span>
          </div>
          <div v-if="pickedTask" class="px-3 py-2 text-[11px] flex items-center justify-between gap-2 border-b" :class="isDarkMode ? 'bg-blue-950/50 text-blue-200 border-blue-900/50' : 'bg-blue-50 text-blue-700 border-blue-200'">
            <div class="flex items-center gap-2">
              <f-badge theme="blue" variant="solid" size="xs">📌 Booking</f-badge>
              <span><b>{{ pickedTask.subject }}</b> — click a time slot to place it.</span>
            </div>
            <f-button variant="ghost" theme="blue" size="xs" @click="pickedTask = null">Clear</f-button>
          </div>

          <!-- grid -->
          <div class="overflow-x-auto flex-1 min-h-0 flex flex-col">
            <div class="flex-1 min-h-0 flex flex-col" :class="plannerView === 'day' ? 'w-full min-w-0' : (plannerView === '4days' ? 'w-full min-w-[500px]' : 'min-w-[640px]')">
              <!-- day headers -->
              <div class="grid border-b shrink-0" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
                <div></div>
                <div v-for="d in plannerDays" :key="d" class="text-center py-2">
                  <div class="text-[10px] uppercase font-bold text-gray-400">{{ dowLabel(d) }}</div>
                  <div class="text-sm font-bold" :class="d === todayDate ? 'text-blue-500' : (isDarkMode ? 'text-gray-200' : 'text-gray-800')">{{ domLabel(d) }}</div>
                </div>
              </div>
              <!-- all-day / away row -->
              <div v-if="hasAwayBlocksInView" class="grid border-b text-[11px] shrink-0" :class="isDarkMode ? 'border-gray-800 bg-[#161719]' : 'border-gray-200 bg-gray-50/80'" :style="{ gridTemplateColumns: '48px repeat(' + plannerDays.length + ', minmax(0, 1fr))' }">
                <div class="flex items-center justify-end pr-2 text-[9px] font-bold uppercase tracking-wider text-gray-400">All Day</div>
                <div v-for="d in plannerDays" :key="'away-' + d" class="border-l p-1 min-h-[34px] min-w-0 flex flex-col gap-1 overflow-hidden" :class="isDarkMode ? 'border-gray-800' : 'border-gray-100'">
                  <button type="button" v-for="b in awayBlocksForDay(d)" :key="b.name"
                    @click="openBlockDrawer(b)"
                    class="w-full text-left rounded-md px-2 py-1 text-[10px] font-semibold truncate border cursor-pointer transition-transform hover:scale-[1.01] shadow-2xs flex items-center justify-between gap-1"
                    :class="b.task_nature && b.task_nature.includes('Absent')
                      ? (isDarkMode ? 'bg-rose-950/60 border-rose-800 text-rose-200' : 'bg-rose-50 border-rose-300 text-rose-800')
                      : (isDarkMode ? 'bg-amber-950/60 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-800')">
                    <span class="truncate">
                      <span>{{ b.task_nature || '🌴 Away' }}</span>
                      <span v-if="b.deliverable_notes && b.deliverable_notes !== b.task_nature" class="opacity-80 ml-1">· {{ b.deliverable_notes }}</span>
                    </span>
                    <span class="shrink-0 text-[8px] font-bold px-1 rounded uppercase tracking-wider bg-black/10 dark:bg-white/20">Non-Paid</span>
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
                    <div v-for="(h, i) in plannerHours" :key="h" class="absolute left-0 right-1 text-[10px] text-right -translate-y-1/2" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'" :style="{ top: (i * 44) + 'px' }">{{ hourLabel(h) }}</div>
                    <div v-for="m in officeMarks" :key="'oml-' + m.kind" class="absolute left-0 right-1 text-[8px] font-bold text-right -translate-y-1/2 text-emerald-600 dark:text-emerald-400" :style="{ top: m.top }" :title="m.title">🏢</div>
                  </div>
                  <!-- day columns -->
                  <div v-for="d in plannerDays" :key="d" data-day-col class="relative border-l" :class="isDarkMode ? 'border-gray-700' : 'border-gray-300'">
                    <!-- away day: stretch the all-day record across office hours -->
                    <div v-for="b in awayBlocksForDay(d)" :key="'awayband-' + b.name"
                      class="absolute left-0.5 right-0.5 rounded-lg border-2 border-dashed pointer-events-none z-0 flex items-center justify-center"
                      :class="b.task_nature && b.task_nature.includes('Absent')
                        ? (isDarkMode ? 'bg-rose-950/40 border-rose-800/70' : 'bg-rose-100/70 border-rose-300')
                        : (isDarkMode ? 'bg-amber-950/40 border-amber-800/70' : 'bg-amber-100/70 border-amber-300')"
                      :style="officeBandStyle" aria-hidden="true">
                      <span class="text-[10px] font-bold uppercase tracking-wider"
                        :class="b.task_nature && b.task_nature.includes('Absent')
                          ? (isDarkMode ? 'text-rose-300' : 'text-rose-700')
                          : (isDarkMode ? 'text-amber-300' : 'text-amber-700')">{{ b.task_nature || '🌴 Away' }}</span>
                    </div>
                    <!-- past time is shaded, so the eye avoids booking behind the now-line -->
                    <div class="absolute left-0 right-0 pointer-events-none z-0" :class="isDarkMode ? 'bg-black/35' : 'bg-gray-900/[0.07]'" :style="pastShadeStyle(d)" aria-hidden="true"></div>
                    <!-- office start/end: two hairlines instead of a banner above the grid -->
                    <div v-for="m in officeMarks" :key="'om-' + d + m.kind"
                      class="absolute left-0 right-0 border-t-2 pointer-events-none z-0"
                      :class="isDarkMode ? 'border-emerald-500/40' : 'border-emerald-500/50'"
                      :style="{ top: m.top }" :aria-hidden="true"></div>
                    <div v-for="(h, i) in plannerHours" :key="h"
                      class="absolute left-0 right-0 border-t cursor-cell transition-colors touch-pan-y"
                      :class="[isDarkMode ? 'border-gray-700 hover:bg-blue-950/30' : 'border-gray-300 hover:bg-blue-50/60']"
                      :style="{ top: (i * 44) + 'px', height: '44px' }"
                      role="button"
                      :aria-label="'Book work on ' + d + ' at ' + hourLabel(h) + ' — drag to cover more hours'"
                      tabindex="0"
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
                      <div class="relative text-[10px] font-bold leading-tight flex items-center justify-between gap-1">
                        <div class="truncate flex items-center gap-1 min-w-0">
                          <span v-if="isTracking && (trackerBlockName === seg.block.name || seg.block.is_live_active)" class="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-600 text-white shrink-0 shadow-xs animate-pulse">
                            <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            <span>REC {{ formattedTime }}</span>
                          </span>
                          <span v-if="seg.is_segment && seg.segment_type === 'head'" class="text-[9px] opacity-75 font-normal mr-1">↩ (cont.)</span>
                          <span class="truncate">{{ seg.block.task_subject || seg.block.work_item_label || seg.block.deliverable_notes || 'Work block' }}</span>
                          <span v-if="seg.block.pairing_partner" class="text-[9px] px-1 py-0.2 rounded bg-purple-500/30 text-purple-100 border border-purple-400/40 shrink-0 font-normal" :title="'Paired with ' + (seg.block.pairing_partner_name || seg.block.pairing_partner)">👥</span>
                          <span v-if="seg.is_segment && seg.segment_type === 'tail'" class="text-[9px] opacity-75 font-normal ml-1">↪</span>
                        </div>

                        <!-- Single Timesheet Approval Status Indicator (Read-only on Calendar) -->
                        <div class="flex items-center gap-1 shrink-0 z-30" v-if="seg.block.actual_hours > 0 || seg.block.approval_status === 'Approved' || seg.block.approval_status === 'Flagged'">
                          <!-- Approved Status Icon -->
                          <span v-if="seg.block.approval_status === 'Approved'"
                            class="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-600 text-white font-black text-[10px] shadow-xs"
                            title="Timesheet Approved">
                            ✓
                          </span>
                          <!-- Flagged Status Icon -->
                          <span v-else-if="seg.block.approval_status === 'Flagged'"
                            class="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500 text-black font-bold text-[9px] shadow-xs"
                            title="Timesheet Flagged for clarification">
                            🚩
                          </span>
                          <!-- Pending Timesheet Status Icon -->
                          <span v-else
                            class="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500/90 text-white font-bold text-[9px] shadow-xs"
                            title="Timesheet Logged (Pending Review)">
                            ⏳
                          </span>
                        </div>
                      </div>
                      <div class="relative text-[9px] opacity-80">{{ dragTimeLabel(seg) }}</div>
                      <div class="relative text-[9px] opacity-80" v-if="segHeight(seg) > 44">
                        <template v-if="isTracking && (trackerBlockName === seg.block.name || seg.block.is_live_active)">
                          <span class="text-red-500 font-extrabold">{{ fmtHrs(trackerSeconds / 3600) }}h running</span> / {{ fmtHrs(seg.block.duration_hours) }}h
                        </template>
                        <template v-else>
                          {{ fmtHrs(seg.block.actual_hours) }}/{{ fmtHrs(seg.block.duration_hours) }}h
                          <span v-if="seg.block.variance_hours" :class="seg.block.variance_hours < 0 ? 'text-amber-200' : 'text-rose-200'">({{ seg.block.variance_hours > 0 ? '+' : '' }}{{ fmtHrs(seg.block.variance_hours) }})</span>
                        </template>
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
        </f-card>  <!-- /planner calendar card -->

        <!-- Right side rail: Statistical Counts Cards (Right side panel on big screens) -->
        <div class="order-3 lg:col-span-1 xl:col-span-1 flex flex-col space-y-2.5 w-full min-h-0 lg:h-full lg:max-h-full overflow-hidden">
          <div class="flex items-center justify-between px-1 shrink-0">
            <h3 class="font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Week Performance</h3>
            <span class="text-[10px] font-mono text-gray-400 font-semibold" :class="isDarkMode ? 'text-gray-400' : 'text-gray-500'">Overview</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 content-start items-start gap-2 sm:gap-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
            <!-- Card 1: Planned this week -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="flex items-center justify-between">
                <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Planned this week</div>
                <f-badge v-if="plannerData.totals && plannerData.totals.away_count" theme="amber" variant="subtle" size="xs">
                  🌴 {{ plannerData.totals.away_count }} away
                </f-badge>
              </div>
              <div class="text-lg xl:text-xl font-extrabold mt-0.5" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
                {{ fmtHrs(plannerData.totals.planned_hours) }}<span class="text-xs font-normal text-gray-400">h</span>
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5">
                {{ plannerData.totals.block_count }} work block{{ plannerData.totals.block_count === 1 ? '' : 's' }}
              </div>
            </f-card>

            <!-- Card 2: Actually logged -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Actually logged</div>
              <div class="text-lg xl:text-xl font-extrabold text-emerald-500 mt-0.5">
                {{ fmtHrs(plannerData.totals.actual_hours) }}<span class="text-xs font-normal text-gray-400">h</span>
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5">across real sessions</div>
            </f-card>

            <!-- Card 3: Plan vs actual -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Plan vs actual</div>
              <div class="text-lg xl:text-xl font-extrabold mt-0.5" :class="plannerData.totals.variance_hours < 0 ? 'text-amber-500' : (plannerData.totals.variance_hours > 0 ? 'text-rose-500' : 'text-gray-400')">
                {{ plannerData.totals.variance_hours > 0 ? '+' : '' }}{{ fmtHrs(plannerData.totals.variance_hours) }}<span class="text-xs font-normal text-gray-400">h</span>
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5">
                {{ plannerData.totals.variance_hours < 0 ? 'under-logged vs plan' : (plannerData.totals.variance_hours > 0 ? 'overran the plan' : 'on plan') }}
              </div>
            </f-card>

            <!-- Card 4: Adherence -->
            <f-card :padded="true" class="!p-2.5 xl:!p-3 transition-all">
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">Adherence</div>
              <div class="text-lg xl:text-xl font-extrabold text-blue-500 mt-0.5">
                {{ plannerData.totals.adherence_pct }}<span class="text-xs font-normal text-gray-400">%</span>
              </div>
              <div class="mt-1 h-1.5 rounded-full overflow-hidden" :class="isDarkMode ? 'bg-gray-800' : 'bg-gray-100'">
                <div class="h-full bg-blue-500 rounded-full transition-all duration-300" :style="{ width: Math.min(100, plannerData.totals.adherence_pct) + '%' }"></div>
              </div>
            </f-card>
          </div>
        </div>
      </div>  <!-- /planner three-column grid -->
    </div>  <!-- /TAB 8: PLANNER -->
</template>

<script>
export default {
  name: 'CalendarView',
  props: {
    isDarkMode: { type: Boolean, default: false },
    isManager: { type: Boolean, default: false },
    employeeMenuItems: { type: Array, default: () => [] },
    selectedEmployeeName: { type: String, default: '' },
    assignedTasks: { type: Array, default: () => [] },
    plannerBusy: { type: Boolean, default: false },
    plannerData: { type: Object, default: () => ({ totals: {} }) },
    plannerDays: { type: Array, default: () => [] },
    displayDays: { type: Array, default: () => [] },
    plannerDate: { type: String, default: '' },
    calendarViewMode: { type: String, default: '4days' },
    viewModeOptions: { type: Array, default: () => [] },
    plannerHours: { type: Array, default: () => [] },
    isTracking: { type: Boolean, default: false },
    trackerBoundBlock: { type: Object, default: () => null },
    trackerBlockName: { type: String, default: '' },
    activeBlock: { type: Object, default: () => null },
    showBlockDrawer: { type: Boolean, default: false },
    dayPlannerStats: { type: Object, default: () => ({}) },
    adherenceTheme: { type: String, default: 'gray' },
    adherenceEmoji: { type: String, default: '⚪' },
    fmtHrs: { type: Function, default: (h) => (h != null ? Number(h).toFixed(2) : '0.00') },
    hhmm: { type: Function, default: (t) => (t ? t.slice(0, 5) : '') },
    isBlockCompleted: { type: Function, default: () => false },
    isBlockLocked: { type: Function, default: () => false },
    canLogTimesheet: { type: Function, default: () => true },
    segTimeTitle: { type: Function, default: () => '' }
  },
  emits: [
    'open-book-modal',
    'open-block-drawer',
    'open-task-details',
    'open-task-raven-drawer',
    'start-task-immediately',
    'plan-attention-task',
    'start-focus-session',
    'stop-focus-session',
    'toggle-task-expansion',
    'cell-drag-over',
    'cell-drop',
    'drag-start',
    'navigate-day',
    'navigate-today',
    'navigate-date',
    'set-view-mode',
    'show-block-hover',
    'hide-block-hover'
  ]
}
</script>
