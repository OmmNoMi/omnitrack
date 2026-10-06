<template>
  <div :class="['omni-card']" class="w-full flex flex-col space-y-2.5 !p-3.5 min-h-0 overflow-hidden max-h-[500px] lg:max-h-full lg:h-full lg:min-h-0 order-2 lg:order-1 h-full">
    <!-- Teammate switcher (managers): searchable, since teams outgrow a plain menu -->
    <div v-if="isManager" class="pb-2 border-b shrink-0" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
      <Combobox
        open-on-click
        :model-value="selectedEmployee"
        :options="employeeOptions"
        placeholder="Search teammates"
        aria-label="Show work for teammate"
        @update:model-value="setSelectedEmployee"
      />
    </div>

    <div class="flex items-center justify-between shrink-0">
      <h3 class="font-bold text-sm" :class="isDarkMode ? 'text-white' : 'text-gray-900'">
        {{ selectedEmployee === 'All' ? 'Team work' : (selectedEmployee === currentUserFullName ? 'My Assigned Work' : 'Assigned to ' + selectedEmployee.split('@')[0]) }}
      </h3>
      <Badge theme="gray" variant="subtle" size="sm">{{ filteredPlannerTasks.length }}</Badge>
    </div>

    <!-- Search + filter tabs; the tabs wrap instead of overflowing the narrow rail -->
    <div class="space-y-2 shrink-0">
      <TextInput
        size="sm"
        v-model="plannerTaskSearch"
        placeholder="Search assigned tasks..."
        aria-label="Search assigned tasks"
      >
        <template #prefix>
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </template>
        <template #suffix>
          <Button v-if="plannerTaskSearch" variant="ghost" size="sm" icon="x" label="Clear search" @click="plannerTaskSearch = ''" />
        </template>
      </TextInput>

      <div class="flex flex-wrap items-center gap-1" role="tablist" aria-label="Filter assigned work tasks" @keydown="onPlannerTaskTabKeydown">
        <Button
          v-for="tab in taskTabs"
          :key="tab.id"
          type="button"
          role="tab"
          size="sm"
          :variant="plannerTaskFilter === tab.id ? 'solid' : 'ghost'"
          :theme="tab.theme"
          :aria-selected="plannerTaskFilter === tab.id"
          :tabindex="plannerTaskFilter === tab.id ? 0 : -1"
          :data-planner-tab="tab.id"
          @click="setPlannerTaskFilter(tab.id)"
        >{{ tab.label }}</Button>
      </div>
    </div>

    <div v-if="!filteredPlannerTasks.length" class="text-xs py-6 text-center flex-1 flex flex-col items-center justify-center gap-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
      <span>No matching tasks found.</span>
      <Button
        v-if="plannerTaskFilter !== 'all' || plannerTaskSearch"
        variant="ghost"
        theme="blue"
        size="sm"
        @click="setPlannerTaskFilter('all'); plannerTaskSearch = ''"
      >Clear filters</Button>
    </div>
    <ul v-else class="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
      <li v-for="t in filteredPlannerTasks" :key="t.ref" class="group rounded-xl border transition-all flex items-start"
        :class="pickedTask && pickedTask.ref === t.ref
          ? (isDarkMode ? 'bg-blue-950/70 border-blue-600 ring-2 ring-blue-500/30' : 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20')
          : (isDarkMode ? 'bg-[#2B2D30] border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm')">
        <!-- Hours, id and due date live in the hover tooltip; the card shows only what decides the next action -->
        <button type="button"
          @click="pickTask(t)"
          :title="taskDetails(t)"
          class="flex-1 min-w-0 text-left p-3 cursor-pointer rounded-xl">
          <div class="text-xs font-bold leading-snug break-words [overflow-wrap:anywhere]" :class="isDarkMode ? 'text-gray-100' : 'text-gray-900'">{{ t.subject }}</div>
          <div v-if="t.project_name" class="text-[11px] mt-0.5 truncate" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">{{ t.project_name }}</div>
          <div v-if="shortBy(t) || isHigh(t)" class="flex flex-wrap items-center gap-1 mt-1.5">
            <Badge v-if="isHigh(t)" theme="red" variant="subtle" size="sm">{{ t.priority }}</Badge>
            <Badge v-if="shortBy(t)" theme="orange" variant="subtle" size="sm">{{ shortBy(t) }}h short</Badge>
          </div>
        </button>
        <div class="flex flex-col gap-0.5 p-1.5 shrink-0">
          <Button variant="ghost" size="sm" icon="info" tooltip="Details" :label="'Details for ' + t.subject" @click="openTaskDetails(t)" />
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

export default {
  name: 'CalendarAssignedTasks',
  setup() {
    return useWorkstationContext([
      'currentUserFullName',
      'employeeOptions',
      'filteredPlannerTasks',
      'fmtHrs',
      'isDarkMode',
      'isManager',
      'onPlannerTaskTabKeydown',
      'openTaskDetails',
      'pickTask',
      'pickedTask',
      'plannerTaskFilter',
      'plannerTaskSearch',
      'selectedEmployee',
      'setPlannerTaskFilter',
      'setSelectedEmployee'
    ]);
  },
  data() {
    return {
      taskTabs: [
        { id: 'all', label: 'All', theme: 'gray' },
        { id: 'underplanned', label: 'Underplanned', theme: 'gray' },
        { id: 'overdue', label: 'Overdue', theme: 'red' },
        { id: 'high', label: 'High', theme: 'blue' }
      ]
    };
  },
  methods: {
    isHigh(t) {
      return t.priority === 'High' || t.priority === 'Urgent';
    },
    // Hours still to plan, shown only when the estimate is not yet covered.
    shortBy(t) {
      const gap = Number(t.estimate_hours || 0) - Number(t.booked_hours || 0);
      return gap > 0.05 ? this.fmtHrs(gap) : '';
    },
    taskDetails(t) {
      const h = (v) => this.fmtHrs(v) + 'h';
      return [
        t.due_date ? `Due ${t.due_date}` : '',
        `Planned ${h(t.booked_hours)}`,
        `Logged ${h(t.logged_hours)}`,
        t.estimate_hours ? `Expected ${h(t.estimate_hours)}` : '',
        `#${t.name || t.ref}`
      ].filter(Boolean).join(' · ');
    }
  }
};
</script>
