<template>
  <section aria-labelledby="attention-tasks-heading"
    class="rounded-2xl border p-4 sm:p-5"
    :class="isDarkMode ? 'bg-[#1E1F22] border-amber-500/40 text-white' : 'bg-amber-50/60 border-amber-200 text-gray-900'">
    
    <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <FeatherIcon name="alert-triangle" class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <h3 id="attention-tasks-heading" class="text-base font-semibold tracking-tight truncate"
          title="Tasks that are past due, or have fewer hours booked in your calendar than they need">
          Needs your attention
        </h3>
      </div>
      <Button variant="ghost" theme="blue" icon-right="arrow-right"
        label="Open planner calendar to allocate time"
        @click="openPlannerWithFilter(attentionFilter)">
        Open planner
      </Button>
    </div>

    <!-- Real-world Quick Filter Bar & Search -->
    <div class="flex items-center justify-between gap-2.5 flex-wrap pt-2.5 pb-1 mb-2 border-t border-amber-200/60 dark:border-amber-900/40">
      <div class="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Filter action required tasks" @keydown="onAttentionTabKeydown">
        <Button
          type="button"
          role="tab"
          size="sm"
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
        </Button>
        <Button
          v-if="overdueTasksCount > 0"
          type="button"
          role="tab"
          size="sm"
          :variant="attentionFilter === 'overdue' ? 'solid' : 'subtle'"
          theme="red"
          :aria-selected="attentionFilter === 'overdue'"
          :tabindex="attentionFilter === 'overdue' ? 0 : -1"
          data-attention-tab="overdue"
          @click="setAttentionFilter('overdue')"
        >
          <span>Overdue</span>
          <template #suffix>
            <span class="text-[10px] font-mono opacity-80">({{ overdueTasksCount }})</span>
          </template>
        </Button>
        <Button
          v-if="underplannedTasksCount > 0"
          type="button"
          role="tab"
          size="sm"
          :variant="attentionFilter === 'underplanned' ? 'solid' : 'subtle'"
          theme="gray"
          :aria-selected="attentionFilter === 'underplanned'"
          :tabindex="attentionFilter === 'underplanned' ? 0 : -1"
          data-attention-tab="underplanned"
          @click="setAttentionFilter('underplanned')"
        >
          <span>Underplanned</span>
          <template #suffix>
            <span class="text-[10px] font-mono opacity-80">({{ underplannedTasksCount }})</span>
          </template>
        </Button>
        <Button
          v-if="dueSoonTasksCount > 0"
          type="button"
          role="tab"
          size="sm"
          :variant="attentionFilter === 'due_soon' ? 'solid' : 'subtle'"
          theme="blue"
          :aria-selected="attentionFilter === 'due_soon'"
          :tabindex="attentionFilter === 'due_soon' ? 0 : -1"
          data-attention-tab="due_soon"
          @click="setAttentionFilter('due_soon')"
        >
          <span>Due Soon</span>
          <template #suffix>
            <span class="text-[10px] font-mono opacity-80">({{ dueSoonTasksCount }})</span>
          </template>
        </Button>
      </div>

      <!-- Quick Search -->
      <div class="relative w-full sm:w-48 ml-auto">
        <TextInput
          size="sm"
          v-model="attentionSearch"
          placeholder="Search tasks..."
          aria-label="Search action required tasks"
        >
          <template #prefix>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </template>
          <template #suffix>
            <Button v-if="attentionSearch" variant="ghost" size="sm" icon="x" label="Clear search" @click="attentionSearch = ''" />
          </template>
        </TextInput>
      </div>
    </div>

    <!-- Attention Task Cards Grid with 2D Roving Tabindex -->
    <div v-if="visibleAttentionTasks.length === 0" class="text-center py-6 border border-dashed rounded-2xl"
      :class="isDarkMode ? 'border-gray-700 text-gray-300' : 'border-amber-200 text-gray-700'">
      <span>No tasks match this filter.</span>
      <Button variant="ghost" theme="blue" class="ml-1" @click="attentionFilter = 'all'; attentionSearch = ''">Clear filter</Button>
    </div>
    <ul v-else role="grid" class="space-y-2.5" :aria-rowcount="visibleAttentionTasks.length" aria-colcount="3" aria-label="Action required overdue and underplanned task table. Use arrow keys to navigate rows and actions.">
      <li 
        v-for="(t, rIdx) in visibleAttentionTasks" 
        :key="t.ref || t.id || t.docname"
        role="row"
        :aria-rowindex="rIdx + 1"
        @click="openTaskDetails(t)"
        class="rounded-xl p-3 sm:p-3.5 border transition-shadow cursor-pointer hover:shadow-md"
        :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-white border-gray-200'">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1.5 flex-1 min-w-0">
            <!-- One status per fact; dates, project and hours live in the hover tooltip -->
            <div class="flex items-center gap-1.5 flex-wrap" :title="taskDetails(t)">
              <Badge v-if="t.days_overdue > 0" theme="red" variant="subtle">Overdue {{ t.days_overdue }}d</Badge>
              <Badge v-else-if="t.is_due_today" theme="orange" variant="subtle">Due today</Badge>
              <Badge v-if="t.deficit_hours > 0" theme="orange" variant="subtle">{{ Number(t.deficit_hours).toFixed(1) }}h short</Badge>
              <Badge v-else-if="t.is_unplanned" theme="orange" variant="subtle">Unplanned</Badge>
              <Badge v-if="t.priority === 'Urgent' || t.priority === 'High'" theme="red" variant="outline">{{ t.priority }}</Badge>
            </div>

            <!-- Subject (Column 0 in Roving Tabindex) -->
            <h4 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white leading-snug flex items-center gap-1.5 group">
              <button
                type="button"
                @click.stop="openTaskDetails(t)"
                :title="taskDetails(t)"
                :tabindex="attentionTabindex(rIdx, 0)"
                :data-attention-row="rIdx"
                :data-attention-col="0"
                @focus="setAttentionRoving(rIdx, 0)"
                @keydown="onAttentionGridKey($event, rIdx, 0)"
                class="text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer">
                {{ t.subject }}
              </button>
              <a
                :href="getTaskDeskUrl(t)"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
                tabindex="-1"
                :title="'Open ' + (t.doctype || 'Task') + ' ' + (t.docname || t.id) + ' in Desk'"
                class="shrink-0 text-gray-700 dark:text-gray-300 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded"
                :aria-label="'Open ' + (t.doctype || 'Task') + ' in Desk'">
                <FeatherIcon name="external-link" class="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </h4>
            <p v-if="t.project_name || t.project" class="text-xs text-gray-700 dark:text-gray-300 truncate">
              {{ t.project_name || t.project }}
            </p>
          </div>

          <!-- Action Buttons (Columns 1 and 2 in Roving Tabindex). Discussion and the
               workflow moves live in the task form the row opens. -->
          <div class="flex items-center gap-2 self-stretch sm:self-center flex-wrap sm:flex-nowrap pt-1 sm:pt-0">
            <!-- Schedule in Planner (Col 1) -->
            <Button
              variant="outline"
              theme="gray"
              size="sm"
              @click.stop="planAttentionTask(t)"
              :tabindex="attentionTabindex(rIdx, 1)"
              :data-attention-row="rIdx"
              :data-attention-col="1"
              @focus="setAttentionRoving(rIdx, 1)"
              @keydown="onAttentionGridKey($event, rIdx, 1)"
              icon-left="calendar"
              :label="'Schedule ' + t.subject + ' into planner calendar'">
              Plan
            </Button>

            <!-- Immediate Focus Session (Col 2). frappe-ui's solid blue is 3.5:1 under
                 white text; blue-700 reaches AA. -->
            <Button
              variant="solid"
              theme="blue"
              size="sm"
              class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800"
              @click.stop="startTaskImmediately(t)"
              :tabindex="attentionTabindex(rIdx, 2)"
              :data-attention-row="rIdx"
              :data-attention-col="2"
              @focus="setAttentionRoving(rIdx, 2)"
              @keydown="onAttentionGridKey($event, rIdx, 2)"
              icon-left="play"
              :label="'Start session on ' + t.subject">
              Start session
            </Button>

          </div>
        </div>

      </li>
    </ul>

    <!-- Google Meet-Style Show More / Show Less Toggle -->
    <div v-if="attentionTasks.length > 3" class="pt-2.5 flex justify-center">
      <Button
        variant="ghost"
        data-attention-show-more
        :icon-left="showAllAttentionTasks ? 'chevron-up' : 'chevron-down'"
        :aria-expanded="showAllAttentionTasks ? 'true' : 'false'"
        :label="showAllAttentionTasks ? 'Show fewer tasks' : ('Show ' + remainingAttentionTasksCount + ' more tasks')"
        @click="toggleShowAllAttentionTasks">
        {{ showAllAttentionTasks ? 'Show less' : 'Show ' + remainingAttentionTasksCount + ' more' }}
      </Button>
    </div>

  </section>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

export default {
  name: 'DashboardAttentionTasks',
  methods: {
    // Secondary facts surface on hover instead of as extra chips on every row.
    taskDetails(t) {
      const h = (v) => Number(v || 0).toFixed(1) + 'h';
      return [
        t.due_date ? `Due ${t.due_date}` : '',
        t.project_name || t.project || '',
        `Booked ${h(t.booked_hours)}${t.estimate_hours > 0 ? ' of ' + h(t.estimate_hours) : ''}`,
        t.logged_hours > 0 ? `Logged ${h(t.logged_hours)}` : '',
      ].filter(Boolean).join(' · ');
    },
  },
  setup() {
    return useWorkstationContext([
      'attentionFilter',
      'attentionSearch',
      'attentionTabindex',
      'attentionTasks',
      'dueSoonTasksCount',
      'getTaskDeskUrl',
      'isDarkMode',
      'onAttentionGridKey',
      'onAttentionTabKeydown',
      'openPlannerWithFilter',
      'openTaskDetails',
      'overdueTasksCount',
      'planAttentionTask',
      'remainingAttentionTasksCount',
      'setAttentionFilter',
      'setAttentionRoving',
      'showAllAttentionTasks',
      'startTaskImmediately',
      'toggleShowAllAttentionTasks',
      'underplannedTasksCount',
      'visibleAttentionTasks'
    ]);
  },
};
</script>
