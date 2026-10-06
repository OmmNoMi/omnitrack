<template>
  <f-dialog
    :model-value="modelValue"
    title="Timer Overflow Check"
    subtitle="Your stopwatch has been running for an unusually long duration."
    size="md"
    z-index="z-[85]"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header-icon>
      <FeatherIcon name="alert-triangle" class="w-5 h-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
    </template>
    <div class="space-y-4 py-1 text-xs">
      <div class="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
        <p class="font-bold">Elapsed: {{ guardData.elapsed_hours }} hours (Started at {{ guardData.started_at_str || 'earlier' }})</p>
        <p class="mt-1 text-gray-700 dark:text-gray-300">{{ guardData.reason || 'Did you work continuously on this block, or did you finish earlier?' }}</p>
      </div>

      <div class="space-y-2">
        <label class="block font-bold text-gray-700 dark:text-gray-300">Choose Resolution:</label>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            @click="$emit('select-option', 'keep')"
            class="p-3 rounded-xl border text-center transition-all cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="choice === 'keep' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-600' : 'border-gray-200 dark:border-gray-700'"
          >
            <div>Keep Full</div>
            <div class="text-[10px] text-gray-700 font-normal mt-0.5">{{ guardData.elapsed_hours }}h elapsed</div>
          </button>
          <button
            type="button"
            @click="$emit('select-option', 'cap')"
            class="p-3 rounded-xl border text-center transition-all cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="choice === 'cap' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' : 'border-gray-200 dark:border-gray-700'"
          >
            <div>Cap at Schedule</div>
            <div class="text-[10px] text-gray-700 font-normal mt-0.5">{{ guardData.suggested_cap_hours }}h planned</div>
          </button>
          <button
            type="button"
            @click="$emit('select-option', 'custom')"
            class="p-3 rounded-xl border text-center transition-all cursor-pointer font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            :class="choice === 'custom' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-600' : 'border-gray-200 dark:border-gray-700'"
          >
            <div>Adjust &amp; Stop</div>
            <div class="text-[10px] text-gray-700 font-normal mt-0.5">Open Slider</div>
          </button>
        </div>
      </div>
    </div>
    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button variant="solid" theme="blue" size="sm" @click="$emit('confirm')">
          Apply Resolution
        </Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
export default {
  name: "RunawayTimerModal",
  props: {
    modelValue: { type: Boolean, default: false },
    guardData: { type: Object, default: () => ({ elapsed_hours: 0, suggested_cap_hours: 0 }) },
    choice: { type: String, default: "keep" },
    isDarkMode: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "select-option", "confirm"],
};
</script>
