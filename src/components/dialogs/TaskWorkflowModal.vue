<template>
  <f-dialog
    :model-value="modelValue"
    :title="(targetAction ? targetAction.action : 'Workflow Action')"
    :subtitle="targetTask ? targetTask.subject : ''"
    size="md"
    z-index="z-[60]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="space-y-3.5 text-xs py-1">
      <div
        class="p-3 rounded-xl border flex items-start gap-3"
        :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'"
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
          :class="isDarkMode ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'"
        >
          {{ targetAction ? getActionIcon(targetAction.action) : '→' }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>{{ targetAction ? targetAction.action : '' }}</span>
            <f-badge v-if="targetAction && targetAction.next_state" theme="blue" variant="subtle" size="xs">
              Target: {{ targetAction.next_state }}
            </f-badge>
          </div>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Apply workflow transition to <strong class="text-gray-800 dark:text-gray-200">{{ targetTask ? (targetTask.doctype || 'Task') : 'Task' }}</strong>:
            <code class="font-mono text-[11px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">{{ targetTask ? (targetTask.docname || targetTask.id) : '' }}</code>
          </p>
        </div>
      </div>

      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
          Handoff / Transition Comment (optional)
        </label>
        <f-input
          :model-value="comment"
          @update:model-value="$emit('update:comment', $event)"
          placeholder="Add any context, completion notes, or reason for this status change..."
          size="md"
        ></f-input>
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2 w-full">
        <f-button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)" :disabled="busy">
          Cancel
        </f-button>
        <f-button variant="solid" theme="blue" size="sm" @click="$emit('confirm')" :disabled="busy">
          Confirm {{ targetAction ? targetAction.action : 'Action' }}
        </f-button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "TaskWorkflowModal",
  props: {
    modelValue: { type: Boolean, default: false },
    targetAction: { type: Object, default: null },
    targetTask: { type: Object, default: null },
    comment: { type: String, default: "" },
    busy: { type: Boolean, default: false },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "update:comment", "confirm"],
  methods: {
    getActionIcon(action) {
      if (!action) return "→";
      const a = action.toLowerCase();
      if (a.includes("submit") || a.includes("complete") || a.includes("done")) return "✓";
      if (a.includes("cancel") || a.includes("reject")) return "✕";
      if (a.includes("start") || a.includes("review")) return "▶";
      return "→";
    },
  },
};
</script>
