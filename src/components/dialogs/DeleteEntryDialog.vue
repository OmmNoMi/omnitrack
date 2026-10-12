<template>
  <!-- One question; the buttons are the answers. Never the browser's confirm(): it cannot say
       which entry, blocks the page, and looks like nothing else here. Focus starts on Keep,
       so Enter never deletes. A refusal keeps the dialog open and says why inside it. -->
  <f-dialog
    :model-value="!!deleteEntry"
    title="Delete this entry?"
    size="sm"
    @update:model-value="!$event && closeDeleteEntry()"
  >
    <div v-if="deleteEntry" class="space-y-4">
      <div>
        <div class="text-base font-semibold text-ink-gray-9 break-words">{{ heading }}</div>
        <div class="text-sm text-ink-gray-7 tabular-nums">{{ span }}</div>
      </div>
      <p class="text-sm text-ink-gray-7">Its hours come off the block.</p>
      <p v-if="deleteEntryError" role="alert" class="text-sm text-ink-red-4">Not deleted. {{ deleteEntryError }}</p>
    </div>

    <template #actions>
      <div class="flex items-center justify-end gap-2 w-full">
        <Button variant="ghost" label="Keep entry" data-autofocus :disabled="isDeletingEntry" @click="closeDeleteEntry">Keep entry</Button>
        <Button variant="solid" theme="red" label="Delete entry" :loading="isDeletingEntry" @click="deleteSessionEntry">Delete entry</Button>
      </div>
    </template>
  </f-dialog>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';
import { blockTitle } from '../../utils/blockTitle.js';
import { whenLine } from '../../utils/clockTime.js';

export default {
  name: 'DeleteEntryDialog',
  setup() {
    return useWorkstationContext(['deleteEntry', 'deleteEntryError', 'isDeletingEntry', 'closeDeleteEntry', 'deleteSessionEntry', 'fmtHrs']);
  },
  computed: {
    heading() {
      const { block, session } = this.deleteEntry || {};
      return (block && blockTitle(block, '')) || String((session && session.notes) || '').split('\n')[0].trim() || 'Work session';
    },
    span() {
      const { block, session } = this.deleteEntry || {};
      if (!session) return '';
      const day = session.session_date || (block && block.work_date);
      // The day, the clock span and how long; an entry kept as hours alone shows its hours
      return session.from_time ? whenLine(day, session.from_time, session.to_time) : [whenLine(day), this.fmtHrs(session.hours) + 'h'].filter(Boolean).join(' · ');
    },
  },
};
</script>
