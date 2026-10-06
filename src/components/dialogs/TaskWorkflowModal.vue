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
        class="p-3 rounded-xl border"
        :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'"
      >
        <div class="min-w-0 flex-1">
          <div class="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>{{ targetAction ? targetAction.action : '' }}</span>
            <Badge v-if="targetAction && targetAction.next_state" theme="blue" variant="subtle" size="sm">
              Target: {{ targetAction.next_state }}
            </Badge>
          </div>
          <p class="text-gray-700 dark:text-gray-300 mt-1">
            Apply workflow transition to <strong class="text-gray-800 dark:text-gray-200">{{ targetTask ? (targetTask.doctype || 'Task') : 'Task' }}</strong>:
            <code class="font-mono text-[11px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700">{{ targetTask ? (targetTask.docname || targetTask.id) : '' }}</code>
          </p>
        </div>
      </div>

      <div>
        <label class="block font-bold mb-1" :class="isDarkMode ? 'text-gray-300' : 'text-gray-700'">
          Handoff / Transition Comment (optional)
        </label>
        <TextInput
          :model-value="comment"
          @update:model-value="$emit('update:comment', $event)"
          placeholder="Add any context, completion notes, or reason for this status change..."
          size="md"
        ></TextInput>
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2 w-full">
        <Button variant="ghost" theme="gray" size="sm" @click="$emit('update:modelValue', false)" :disabled="busy">
          Cancel
        </Button>
        <Button variant="solid" theme="blue" size="sm" @click="$emit('confirm')" :disabled="busy">
          Confirm {{ targetAction ? targetAction.action : 'Action' }}
        </Button>
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
};
</script>
