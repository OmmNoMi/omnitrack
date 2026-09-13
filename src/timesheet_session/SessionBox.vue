<template>
  <div
    v-if="isTracking"
    class="frappe-ui-session-hud w-full rounded-3xl border shadow-sm transition-all duration-200 bg-white border-gray-200 text-gray-900 dark:bg-[#1E1F22] dark:border-gray-800 dark:text-white p-5 sm:p-6"
    :class="{ 'ring-2 ring-blue-500/60': sessionCardFlash }"
  >
    <div class="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x transition-all px-0.5"
         :class="isDarkMode ? 'divide-gray-800' : 'divide-gray-200'">

      <!-- LEFT PANE: SESSION LOG -->
      <div class="lg:col-span-6 flex flex-col pb-5 lg:pb-0 lg:pr-6">
        <div class="flex-1 min-h-0 flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-gray-200/80 dark:border-gray-800">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Current Session Log
            </h4>
            <Badge
              :theme="sessionNotesList && sessionNotesList.length > 0 ? 'blue' : 'gray'"
              size="sm"
              variant="subtle"
              class="!rounded-full px-2"
            >
              {{ sessionNotesList ? sessionNotesList.length : 0 }}
            </Badge>
          </div>

          <!-- Empty State -->
          <div
            v-if="!sessionNotesList || sessionNotesList.length === 0"
            class="flex-1 flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-800"
          >
            <div class="text-xs text-gray-500 dark:text-gray-400">
              No lines yet — press <kbd class="px-1.5 py-0.5 rounded text-[10px] font-mono border bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">/</kbd> to start
            </div>
            <div class="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              At least one line is needed to save this session
            </div>
          </div>

          <!-- Running Lines List -->
          <div v-else class="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1 max-h-56">
            <div
              v-for="(line, idx) in sessionNotesList"
              :key="idx"
              class="group flex items-start justify-between gap-2 pl-2 pr-2.5 py-2 rounded-xl border text-xs transition-all bg-white border-gray-200/90 text-gray-800 shadow-2xs dark:bg-[#2B2D30] dark:border-gray-700/80 dark:text-gray-200"
            >
              <div class="flex items-start gap-2 min-w-0">
                <Badge theme="blue" size="sm" variant="subtle" class="!w-5 !h-5 !p-0 !gap-0 !rounded-full shrink-0 select-none justify-center text-center font-mono font-bold leading-none">
                  {{ idx + 1 }}
                </Badge>
                <span class="font-medium leading-5 min-w-0 whitespace-pre-line break-words text-gray-800 dark:text-gray-200">
                  {{ line }}
                </span>
              </div>
              <Button
                variant="ghost"
                theme="red"
                size="xs"
                @click="$emit('remove-line', idx)"
                class="opacity-0 group-hover:opacity-100 transition-opacity !p-1 !rounded-lg"
                title="Delete this line"
                aria-label="Delete line"
              >
                ✕
              </Button>
            </div>
          </div>

          <!-- Add Line Input Bar -->
          <div class="flex items-end gap-2 pt-3 border-t mt-2.5 border-gray-200/80 dark:border-gray-800">
            <div class="relative flex-1">
              <textarea
                ref="lineInputRef"
                v-model="localLineText"
                @input="autoGrowTextarea"
                @keydown="handleTextareaKey"
                rows="1"
                placeholder="What did you just complete?"
                class="w-full min-h-[38px] text-xs font-medium rounded-xl pl-3.5 pr-3.5 lg:pr-9 py-2 outline-none border transition-colors shadow-xs bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-[#2B2D30] dark:border-gray-700 dark:text-white dark:placeholder-gray-500 resize-none leading-relaxed max-h-36 block"
              ></textarea>
              <kbd
                v-if="!localLineText"
                title="Press / to start"
                class="hidden lg:block absolute right-2.5 bottom-[7px] pointer-events-none font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
              >/</kbd>
            </div>
            <Button
              variant="solid"
              theme="blue"
              size="sm"
              tabindex="-1"
              :disabled="!localLineText.trim()"
              @click="submitLine"
              title="Add this line (Enter)"
              aria-keyshortcuts="Enter"
              class="!h-[38px] !rounded-xl font-bold px-3.5 shadow-xs shrink-0 cursor-pointer"
            >
              Add
              <template #suffix>
                <kbd class="hidden lg:inline-block font-mono text-[10px] font-bold leading-none px-1.5 py-0.5 rounded border border-white/30 bg-white/20 text-white">
                  &crarr;
                </kbd>
              </template>
            </Button>
          </div>
        </div>
      </div>

      <!-- RIGHT PANE: CURRENT SESSION CONTROLS (ENLARGED TIME & TOOLBAR) -->
      <div class="lg:col-span-6 flex flex-col justify-between pt-5 lg:pt-0 lg:pl-6 space-y-4">
        <div>
          <!-- Integrated Timer & Action Hero Bar (More space for Time & Single Tab Group) -->
          <div class="flex items-center justify-between gap-x-4 gap-y-3 flex-wrap px-3.5 py-3 rounded-2xl border transition-colors bg-gray-50/80 border-gray-200/90 dark:bg-[#25262A] dark:border-gray-800">
            <!-- Digital Stopwatch Readout with generous space -->
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
              <!-- An elapsed count says how long, never since when. On a timesheet
                   the start is the fact that has to be defensible, so show it. -->
              <div class="min-w-0">
                <div class="font-mono text-xl sm:text-2xl font-black tracking-tight tabular-nums leading-none text-gray-900 dark:text-white">
                  {{ formattedDuration }}
                </div>
                <div v-if="sessionStart" class="text-[10px] font-semibold mt-1 whitespace-nowrap text-gray-500 dark:text-gray-400">
                  Started {{ sessionStart.date }} &middot; {{ sessionStart.time }}
                </div>
              </div>
              <Badge
                v-if="trackerBoundBlock"
                theme="blue"
                size="sm"
                variant="solid"
                class="!rounded-full px-2.5 ml-1 font-mono font-bold"
                :title="'Bound to Planned Work Block: ' + trackerBoundBlock.name"
              >
                📦 {{ trackerBoundBlock.name }}
              </Badge>
            </div>

            <!-- Toolbar Action Buttons (Single Tab Group with Arrow Key Navigation) -->
            <div
              ref="toolbarRef"
              class="flex items-center gap-1.5 shrink-0 ml-auto"
              role="toolbar"
              aria-orientation="horizontal"
              aria-label="Session controls"
              @keydown="onToolbarKey"
            >
              <!-- Discard button -->
              <Button
                data-session-tool
                :tabindex="activeToolIndex === 0 ? 0 : -1"
                :variant="discardConfirm ? 'solid' : 'outline'"
                :theme="discardConfirm ? 'amber' : 'gray'"
                size="sm"
                @click="$emit('discard')"
                :title="discardConfirm ? 'Press again to discard (' + (modKey || '⌘') + 'D)' : 'Discard without saving (' + (modKey || '⌘') + 'D)'"
                :aria-label="discardConfirm ? 'Press again to discard' : 'Discard without saving'"
                class="!rounded-xl font-bold py-2 px-3 border border-gray-300 dark:border-gray-700 shadow-2xs cursor-pointer transition-all"
              >
                <template #prefix>
                  <svg class="w-3.5 h-3.5 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </template>
                <span class="hidden min-[480px]:inline">{{ discardConfirm ? 'Discard?' : 'Discard' }}</span>
              </Button>

              <!-- Adjust timing button -->
              <Button
                data-session-tool
                :tabindex="activeToolIndex === 1 ? 0 : -1"
                variant="outline"
                theme="gray"
                size="sm"
                @click="$emit('adjust')"
                :title="'Adjust start/end time — ±5 min or backdate (' + (modKey || '⌘') + 'E)'"
                aria-label="Adjust start or end time"
                class="!rounded-xl font-bold py-2 px-3 border border-gray-300 dark:border-gray-700 shadow-2xs cursor-pointer transition-all"
              >
                <template #prefix>
                  <svg class="w-3.5 h-3.5 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </template>
                <span class="hidden min-[480px]:inline">Adjust</span>
              </Button>

              <!-- Stop button (Primary tab landing target) -->
              <Button
                data-session-tool
                :tabindex="activeToolIndex === 2 ? 0 : -1"
                variant="solid"
                theme="red"
                size="sm"
                @click="$emit('stop')"
                :title="'Stop the session (' + (modKey || '⌘') + 'S)'"
                aria-label="Stop the session"
                class="!rounded-xl font-bold py-2 px-3.5 shadow-sm bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-all"
              >
                <template #prefix>
                  <svg class="w-3 h-3 fill-current mr-0.5" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6h12v12H6z"/>
                  </svg>
                </template>
                <span class="hidden min-[480px]:inline">Stop</span>
              </Button>
            </div>
          </div>

          <!-- Bound Block Banner (Prominently displaying Work Block & Connected Task) -->
          <div v-if="trackerBoundBlock" class="mt-3 rounded-2xl border px-3.5 py-3 space-y-2 bg-blue-50/70 border-blue-200/90 dark:bg-blue-950/30 dark:border-blue-800/60 shadow-2xs">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <Badge theme="blue" size="sm" variant="solid" class="!rounded-lg font-mono font-bold shrink-0 shadow-2xs">
                  📦 {{ trackerBoundBlock.name }}
                </Badge>
                <Badge theme="gray" size="sm" variant="subtle" class="!rounded-md text-[10px] shrink-0">
                  {{ trackerBoundBlock.status || 'Planned' }}
                </Badge>
                <span class="text-xs font-bold text-blue-950 dark:text-blue-100 truncate" :title="trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label">
                  {{ trackerBoundBlock.task_subject || trackerBoundBlock.work_item_label || 'Work block' }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[11px] font-mono font-bold text-blue-800 dark:text-blue-300">
                  {{ trackerBoundBlock.start_time }}–{{ trackerBoundBlock.end_time }}
                </span>
                <button
                  type="button"
                  @click="$emit('unbind-block')"
                  class="text-gray-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 p-1 rounded-md hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  title="Unbind from this Planned Work Block"
                  aria-label="Unbind block"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Detailed Connected Task Row -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px] border-t border-blue-200/60 dark:border-blue-900/50 pt-2 text-blue-900 dark:text-blue-200">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-bold text-gray-500 dark:text-gray-400 shrink-0">🎯 Task:</span>
                <span class="font-semibold truncate text-blue-950 dark:text-blue-100" :title="connectedTaskName">
                  {{ connectedTaskName }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 min-w-0 sm:justify-end">
                <span class="font-bold text-gray-500 dark:text-gray-400 shrink-0">🗂 Project:</span>
                <span class="font-medium truncate text-blue-900 dark:text-blue-200" :title="trackerBoundBlock.project_name || trackerBoundBlock.project || 'General Work (Internal)'">
                  {{ trackerBoundBlock.project_name || trackerBoundBlock.project || 'General Work (Internal)' }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-blue-700/90 dark:text-blue-300/90 pt-0.5">
                <span>📅 {{ trackerBoundBlock.work_date }}</span>
                <span>🏷 {{ trackerBoundBlock.task_nature }}</span>
                <span v-if="trackerBoundBlock.duration_hours">⏱ planned {{ trackerBoundBlock.duration_hours }}h</span>
                <span v-if="trackerBoundBlock.actual_hours">· logged {{ trackerBoundBlock.actual_hours }}h</span>
              </div>
              <div class="sm:text-right text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                Timesheet will log against <strong class="font-mono">{{ trackerBoundBlock.name }}</strong>
              </div>
            </div>
          </div>

          <!-- Deliverable / Task Select Dropdown (Search-to-Select Open ToDo or Planned Block) -->
          <div class="mt-3.5 relative" ref="todoPickerContainerRef">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 shrink-0">
                  Task / Open ToDo
                </label>
                <Badge
                  v-if="trackerBoundBlock"
                  theme="blue"
                  size="sm"
                  variant="subtle"
                  class="!rounded-md text-[10px] px-1.5 py-0 font-medium truncate flex items-center gap-1"
                  :title="'Auto-filled with task connected to ' + trackerBoundBlock.name"
                >
                  <span>🔗 From {{ trackerBoundBlock.name }}</span>
                  <button type="button" @click="emit('unbind-block')" class="hover:text-red-500 font-bold ml-0.5" title="Unbind from block">✕</button>
                </Badge>
              </div>
              <div v-if="openTodos.length > 0" class="text-[10px] text-gray-400 font-medium">
                {{ openTodos.length }} open ToDo{{ openTodos.length > 1 ? 's' : '' }}
              </div>
            </div>

            <div class="relative">
              <button
                type="button"
                @click="toggleTodoPicker"
                class="w-full flex items-center justify-between text-xs font-medium rounded-xl px-3.5 py-2.5 outline-none border transition-colors shadow-xs !bg-white !border-gray-300 !text-gray-900 hover:!border-gray-400 focus:!border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:!bg-[#2B2D30] dark:!border-gray-700 dark:!text-white cursor-pointer"
                aria-label="Select open ToDo or Task"
              >
                <div class="flex items-center gap-2 truncate min-w-0 flex-1">
                  <span v-if="trackerBoundBlock" class="text-blue-500 shrink-0">📅</span>
                  <span v-else-if="trackerNotes" class="text-blue-500 shrink-0">📋</span>
                  <span v-else class="text-gray-400 shrink-0">🔍</span>
                  <span class="truncate" :class="trackerNotes ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'">
                    {{ trackerNotes || 'Select an open ToDo or search tasks...' }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    v-if="trackerNotes"
                    type="button"
                    @click.stop="clearSelectedTodo"
                    class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Clear selection"
                  >
                    ✕
                  </button>
                  <svg class="w-3.5 h-3.5 text-gray-400 transition-transform" :class="{ 'rotate-180': todoPickerOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </button>

              <!-- Popover Menu with Embedded Search -->
              <div
                v-if="todoPickerOpen"
                class="absolute left-0 right-0 top-full mt-1.5 w-full max-h-72 overflow-hidden rounded-2xl bg-white dark:bg-[#1E1F22] border border-gray-200 dark:border-gray-700 shadow-2xl z-50 flex flex-col"
              >
                <!-- Search Input at top of Popover -->
                <div class="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#25272B]">
                  <div class="relative flex items-center">
                    <svg class="w-3.5 h-3.5 absolute left-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                    <input
                      ref="todoSearchInputRef"
                      v-model="todoSearchQuery"
                      type="text"
                      placeholder="Type to search open ToDos..."
                      class="w-full pl-9 pr-7 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#16171A] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      @keydown.esc="todoPickerOpen = false"
                      @keydown.enter.prevent="onTodoSearchEnter"
                    />
                    <button v-if="todoSearchQuery" type="button" @click="todoSearchQuery = ''" class="absolute right-2.5 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                  </div>
                </div>

                <!-- Scrollable Options List -->
                <div class="overflow-y-auto flex-1 p-1.5 space-y-1">
                  <!-- Group: Open ToDos -->
                  <div v-if="filteredOpenTodos.length > 0">
                    <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center justify-between">
                      <span>📋 Open ToDos</span>
                      <span class="font-mono text-[9px]">{{ filteredOpenTodos.length }}</span>
                    </div>
                    <button
                      v-for="(t, idx) in filteredOpenTodos"
                      :key="'todo-' + idx"
                      type="button"
                      @click="selectTodo(t)"
                      class="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-blue-50/80 dark:hover:bg-blue-950/40 transition-colors flex flex-col gap-1 cursor-pointer group"
                      :class="trackerNotes === (t.subject || t.title || t.name) ? 'bg-blue-50 dark:bg-blue-950/60 font-semibold' : ''"
                    >
                      <div class="flex items-center justify-between gap-1">
                        <span class="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {{ t.subject || t.title || t.name }}
                        </span>
                        <span v-if="t.priority" class="text-[9px] font-bold px-1.5 py-0.2 rounded" :class="t.priority === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'">
                          {{ t.priority }}
                        </span>
                      </div>
                      <div class="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                        <span v-if="t.project_name || t.project" class="truncate font-medium text-blue-600 dark:text-blue-400">
                          🗂 {{ t.project_name || t.project }}
                        </span>
                        <span v-if="t.due_date">📅 Due {{ t.due_date }}</span>
                      </div>
                    </button>
                  </div>

                  <!-- Group: Today's Planned Blocks -->
                  <div v-if="filteredPlannedBlocks.length > 0" class="pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center justify-between">
                      <span>📅 Today's Planned Blocks</span>
                      <span class="font-mono text-[9px]">{{ filteredPlannedBlocks.length }}</span>
                    </div>
                    <button
                      v-for="(b, idx) in filteredPlannedBlocks"
                      :key="'block-' + idx"
                      type="button"
                      @click="selectPlannedBlock(b)"
                      class="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-blue-50/80 dark:hover:bg-blue-950/40 transition-colors flex flex-col gap-1 cursor-pointer group"
                      :class="trackerBoundBlock && trackerBoundBlock.name === b.name ? 'bg-blue-50 dark:bg-blue-950/60 font-semibold' : ''"
                    >
                      <div class="flex items-center justify-between gap-1">
                        <span class="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {{ blockTitle(b) }}
                        </span>
                        <span class="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">{{ b.name }}</span>
                      </div>
                      <div class="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                        <span class="font-mono">{{ b.start_time }}–{{ b.end_time }}</span>
                        <span v-if="b.project_name || b.project">🗂 {{ b.project_name || b.project }}</span>
                        <span v-if="b.task_nature">🏷 {{ b.task_nature }}</span>
                      </div>
                    </button>
                  </div>

                  <!-- Custom Title Option -->
                  <div v-if="showCustomOption" class="pt-1 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      @click="selectCustomTitle"
                      class="w-full text-left px-2.5 py-2 rounded-xl text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-200"
                    >
                      <span class="text-sm">✏️</span>
                      <span class="truncate">Use custom title: <strong class="text-blue-600 dark:text-blue-400">"{{ todoSearchQuery.trim() }}"</strong></span>
                    </button>
                  </div>

                  <!-- Empty State -->
                  <div v-if="filteredOpenTodos.length === 0 && filteredPlannedBlocks.length === 0 && !showCustomOption" class="py-6 text-center text-xs text-gray-400">
                    No open ToDos or planned blocks found
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Project & Activity Nature Dropdowns (Frappe UI Dropdowns) -->
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">
                Project
              </label>
              <Dropdown :options="projectDropdownOptions" class="w-full">
                <template #default="{ open }">
                  <button
                    type="button"
                    class="w-full flex items-center justify-between text-xs font-medium rounded-xl px-3.5 py-2.5 outline-none border transition-colors shadow-xs !bg-white !border-gray-300 !text-gray-700 hover:!border-gray-400 focus:!border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:!bg-[#2B2D30] dark:!border-gray-700 dark:!text-gray-200 cursor-pointer"
                  >
                    <span class="truncate">{{ currentProjectLabel }}</span>
                    <svg class="w-3.5 h-3.5 ml-2 text-gray-400 shrink-0 transition-transform" :class="{ 'rotate-180': open }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </template>
              </Dropdown>
            </div>

            <div>
              <label class="block text-[11px] font-bold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">
                Activity Nature
              </label>
              <Dropdown :options="natureDropdownOptions" class="w-full">
                <template #default="{ open }">
                  <button
                    type="button"
                    class="w-full flex items-center justify-between text-xs font-medium rounded-xl px-3.5 py-2.5 outline-none border transition-colors shadow-xs !bg-white !border-gray-300 !text-gray-700 hover:!border-gray-400 focus:!border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:!bg-[#2B2D30] dark:!border-gray-700 dark:!text-gray-200 cursor-pointer"
                  >
                    <span class="truncate">{{ currentNatureLabel }}</span>
                    <svg class="w-3.5 h-3.5 ml-2 text-gray-400 shrink-0 transition-transform" :class="{ 'rotate-180': open }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </template>
              </Dropdown>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Shortcut Legend -->
    <div class="mt-4 hidden border-t border-gray-100 pt-3 text-[11px] text-gray-400 lg:block dark:border-gray-800 dark:text-gray-500">
      <span class="font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Shortcuts</span>
      <span class="mx-1.5">·</span>
      <kbd class="font-mono text-gray-600 dark:text-gray-300">/</kbd> jump to line box
      <span class="mx-1.5">·</span>
      <kbd class="font-mono text-gray-600 dark:text-gray-300">Shift+Enter</kbd> newline
      <span class="mx-1.5">·</span>
      <kbd class="font-mono text-gray-600 dark:text-gray-300">Enter</kbd> add line
      <span class="mx-1.5">·</span>
      <kbd class="font-mono text-gray-600 dark:text-gray-300">{{ modKey || '⌘' }}S</kbd> stop session
      <span class="mx-1.5">·</span>
      <kbd class="font-mono text-gray-600 dark:text-gray-300">{{ modKey || '⌘' }}E</kbd> adjust times
      <span class="mx-1.5">·</span>
      <kbd class="font-mono text-gray-600 dark:text-gray-300">{{ modKey || '⌘' }}D</kbd> discard
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { Button, Badge, Dropdown } from 'frappe-ui';

const props = defineProps({
  isTracking: { type: Boolean, default: false },
  trackerSeconds: { type: Number, default: 0 },
  trackerNotes: { type: String, default: '' },
  trackerProject: { type: String, default: '' },
  trackerNature: { type: String, default: 'Planned Work' },
  trackerBoundBlock: { type: Object, default: null },
  sessionNotesList: { type: Array, default: () => [] },
  projects: { type: Array, default: () => [] },
  natureOptions: { type: Array, default: () => [] },
  assignedTasks: { type: Array, default: () => [] },
  workBlocks: { type: Array, default: () => [] },
  modKey: { type: String, default: '⌘' },
  isDarkMode: { type: Boolean, default: false },
  sessionCardFlash: { type: Boolean, default: false },
  discardConfirm: { type: Boolean, default: false },
  isElevated: { type: Boolean, default: false }
});

const emit = defineEmits([
  'stop',
  'adjust',
  'discard',
  'add-line',
  'remove-line',
  'bind-block',
  'unbind-block',
  'toggle-elevate',
  'update:notes',
  'update:project',
  'update:nature'
]);

const localLineText = ref('');
const lineInputRef = ref(null);
const toolbarRef = ref(null);
const activeToolIndex = ref(2); // Stop button is the default landing tab stop (index 2)

const formattedDuration = computed(() => {
  const sec = props.trackerSeconds || 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

// Read the start off the payload the tracker persists, so a session restored
// after a reload — or re-anchored by Adjust — shows its real start rather than
// one inferred from the tick count. trackerSeconds is touched deliberately: it
// is the dependency that makes this recompute as the session runs.
const sessionStart = computed(() => {
  void props.trackerSeconds;
  if (!props.isTracking) return null;
  let ms = 0;
  try {
    const p = JSON.parse(localStorage.getItem('omnitrack_active_session') || 'null');
    if (p && p.startTime) ms = Number(p.startTime);
  } catch (e) {}
  if (!ms) ms = Date.now() - (props.trackerSeconds || 0) * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  };
});

const currentProjectLabel = computed(() => {
  if (!props.trackerProject) return 'General Work (Internal)';
  const found = (props.projects || []).find(p => p.name === props.trackerProject);
  return found ? (found.project_name || found.name) : props.trackerProject;
});

const projectDropdownOptions = computed(() => {
  const opts = [
    {
      label: 'General Work (Internal)',
      onClick: () => emit('update:project', '')
    }
  ];
  (props.projects || []).forEach(p => {
    opts.push({
      label: p.project_name || p.name,
      onClick: () => emit('update:project', p.name)
    });
  });
  return opts;
});

const currentNatureLabel = computed(() => {
  if (!props.trackerNature) return 'Planned Work';
  const found = (props.natureOptions || []).find(n => n.label === props.trackerNature);
  if (found) {
    return `${found.label} ${!found.is_working ? '(Non-Paid)' : ''}`;
  }
  return props.trackerNature;
});

const natureDropdownOptions = computed(() => {
  return (props.natureOptions || []).map(n => ({
    label: `${n.label} ${!n.is_working ? '(Non-Paid)' : ''}`,
    onClick: () => emit('update:nature', n.label)
  }));
});

const openTodos = computed(() => {
  return (props.assignedTasks || []).filter(t => {
    const st = (t.status || '').toLowerCase();
    return st !== 'closed' && st !== 'cancelled' && st !== 'completed';
  });
});

const todayPlannedBlocks = computed(() => {
  return (props.workBlocks || []).filter(b => {
    return b.status !== 'Completed' && b.status !== 'Cancelled';
  });
});

// A block's title is whatever human text it carries; the record id is not a
// title. Server-side "None" strings and blanks both mean untitled, and an
// untitled block is named by when it runs, not by its primary key.
function blockTitle(b) {
  if (!b) return '';
  const clean = (v) => {
    const t = (v == null ? '' : String(v)).trim();
    return (!t || t === 'None' || t === 'null' || t === 'undefined') ? '' : t;
  };
  return (
    clean(b.task_subject) ||
    clean(b.work_item_label) ||
    clean(b.task) ||
    clean(b.deliverable_notes) ||
    clean(b.project_name) ||
    ('Untitled block ' + shortTime(b.start_time)).trim()
  );
}

const todoPickerOpen = ref(false);
const todoSearchQuery = ref('');
const todoSearchInputRef = ref(null);
const todoPickerContainerRef = ref(null);

function toggleTodoPicker() {
  todoPickerOpen.value = !todoPickerOpen.value;
  if (todoPickerOpen.value) {
    todoSearchQuery.value = '';
    nextTick(() => {
      if (todoSearchInputRef.value && todoSearchInputRef.value.focus) {
        todoSearchInputRef.value.focus();
      }
    });
  }
}

const filteredOpenTodos = computed(() => {
  const q = (todoSearchQuery.value || '').trim().toLowerCase();
  if (!q) return openTodos.value;
  return openTodos.value.filter(t => {
    const subj = (t.subject || t.title || t.name || '').toLowerCase();
    const proj = (t.project_name || t.project || '').toLowerCase();
    const prio = (t.priority || '').toLowerCase();
    return subj.includes(q) || proj.includes(q) || prio.includes(q);
  });
});

const filteredPlannedBlocks = computed(() => {
  const q = (todoSearchQuery.value || '').trim().toLowerCase();
  if (!q) return todayPlannedBlocks.value;
  return todayPlannedBlocks.value.filter(b => {
    const title = (blockTitle(b) || '').toLowerCase();
    const proj = (b.project_name || b.project || '').toLowerCase();
    return title.includes(q) || proj.includes(q);
  });
});

const showCustomOption = computed(() => {
  const q = (todoSearchQuery.value || '').trim();
  if (!q) return false;
  const qLower = q.toLowerCase();
  const matchesTodo = openTodos.value.some(t => (t.subject || t.title || t.name || '').toLowerCase() === qLower);
  const matchesBlock = todayPlannedBlocks.value.some(b => (blockTitle(b) || '').toLowerCase() === qLower);
  return !matchesTodo && !matchesBlock;
});

function selectTodo(t) {
  if (!t) return;
  emit('unbind-block');
  const title = t.subject || t.title || t.name || 'Untitled ToDo';
  emit('update:notes', title);
  if (t.project) {
    emit('update:project', t.project);
  }
  emit('update:nature', 'Planned Work');
  todoPickerOpen.value = false;
  todoSearchQuery.value = '';
}

function selectPlannedBlock(b) {
  if (!b) return;
  emit('bind-block', b);
  emit('update:notes', blockTitle(b));
  if (b.project) emit('update:project', b.project);
  if (b.task_nature) emit('update:nature', b.task_nature);
  todoPickerOpen.value = false;
  todoSearchQuery.value = '';
}

function selectCustomTitle() {
  const q = (todoSearchQuery.value || '').trim();
  if (!q) return;
  emit('unbind-block');
  emit('update:notes', q);
  todoPickerOpen.value = false;
  todoSearchQuery.value = '';
}

function onTodoSearchEnter() {
  if (filteredOpenTodos.value.length > 0) {
    selectTodo(filteredOpenTodos.value[0]);
  } else if (filteredPlannedBlocks.value.length > 0) {
    selectPlannedBlock(filteredPlannedBlocks.value[0]);
  } else if (showCustomOption.value) {
    selectCustomTitle();
  }
}

function clearSelectedTodo() {
  emit('unbind-block');
  emit('update:notes', '');
}

function onDocumentClick(ev) {
  if (!todoPickerOpen.value) return;
  if (todoPickerContainerRef.value && !todoPickerContainerRef.value.contains(ev.target)) {
    todoPickerOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentClick);
});

// Auto-fill connected task whenever a Planned Work Block is bound
watch(() => props.trackerBoundBlock, (newBlock) => {
  if (newBlock && !props.trackerNotes) {
    const taskTitle = newBlock.task_subject || newBlock.work_item_label || (newBlock.task ? (newBlock.task_subject || newBlock.task) : '') || newBlock.deliverable_notes || '';
    if (taskTitle) emit('update:notes', taskTitle);
    if (newBlock.project) emit('update:project', newBlock.project);
    if (newBlock.task_nature) emit('update:nature', newBlock.task_nature);
  }
}, { immediate: true });

function autoGrowTextarea(e) {
  const el = (e && e.target) || lineInputRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function handleTextareaKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitLine();
  } else if (e.key === 'Tab' && !e.shiftKey) {
    // Tab from input line focuses directly on the Stop button in the toolbar
    e.preventDefault();
    focusStopButton();
  }
}

function submitLine() {
  const text = localLineText.value.trim();
  if (!text) return;
  emit('add-line', text);
  localLineText.value = '';
  if (lineInputRef.value) {
    lineInputRef.value.style.height = 'auto';
  }
}

function onToolbarKey(ev) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(ev.key)) return;
  const bar = toolbarRef.value;
  if (!bar) return;
  const tools = [...bar.querySelectorAll('[data-session-tool]')];
  if (tools.length < 2) return;
  ev.preventDefault();

  const cur = Math.max(0, tools.findIndex(el => el === document.activeElement || el.contains(document.activeElement)));
  let next = cur;
  if (ev.key === 'ArrowLeft') next = (cur - 1 + tools.length) % tools.length;
  else if (ev.key === 'ArrowRight') next = (cur + 1) % tools.length;
  else if (ev.key === 'Home') next = 0;
  else if (ev.key === 'End') next = tools.length - 1;

  activeToolIndex.value = next;
  nextTick(() => {
    const target = tools[next];
    if (target) {
      target.focus();
    }
  });
}

function focusStopButton() {
  activeToolIndex.value = 2; // Stop button
  nextTick(() => {
    if (toolbarRef.value) {
      const tools = toolbarRef.value.querySelectorAll('[data-session-tool]');
      if (tools.length > 2) {
        tools[2].focus();
      }
    }
  });
}

function focusLineInput() {
  nextTick(() => {
    if (lineInputRef.value) {
      lineInputRef.value.focus();
    }
  });
}

defineExpose({
  focusLineInput,
  focusStopButton
});
</script>
