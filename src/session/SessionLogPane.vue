<template>
  <!-- An entry is not stretched to the controls' height: its Log is as tall as its lines, and
       the block's tasks follow it, so the popup has no empty column on a wide screen -->
  <div class="lg:col-span-7 flex flex-col" :class="isEntry ? 'gap-5' : 'min-h-[16rem]'">
    <div class="min-h-0 flex flex-col" :class="isEntry ? '' : 'flex-1'">
      <!-- An entry has the Log only: a heading, as the Tasks below it have, not a bar of one tab -->
      <h3 v-if="isEntry" :id="idp + 'tab-session-notes'" class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Log<template v-if="(sessionNotesList || []).length"> ({{ sessionNotesList.length }})</template></h3>
      <!-- Log / Details / Chat: one WAI-ARIA tab group with arrow-key navigation. Material
           primary tabs: the whole tab is the target, hover and focus tint it, keyboard focus
           draws an inset ring that the bar cannot clip, and the active tab carries the bar. -->
      <div v-else class="mb-3 border-b border-gray-200 dark:border-gray-800">
        <div role="tablist" aria-label="Session pane views" class="flex items-end gap-1" @keydown="onPaneTabKeydown">
          <button
            ref="tabNotesRef"
            type="button"
            role="tab"
            :id="idp + 'tab-session-notes'"
            :aria-controls="idp + 'panel-session-notes'"
            :aria-selected="paneTab === 'notes'"
            :tabindex="paneTab === 'notes' ? 0 : -1"
            @click="selectPaneTab('notes')"
            :class="[TAB, tabTone('notes')]"
          >
            Log
            <span v-if="sessionNotesList && sessionNotesList.length" :class="[COUNT, countTone(paneTab === 'notes')]">{{ sessionNotesList.length }}</span>
            <span v-if="paneTab === 'notes'" :class="INDICATOR" aria-hidden="true"></span>
          </button>
          <button
            v-if="!isEntry"
            ref="tabDetailsRef"
            type="button"
            role="tab"
            id="tab-session-details"
            aria-controls="panel-session-details"
            :aria-selected="paneTab === 'details'"
            :tabindex="paneTab === 'details' ? 0 : -1"
            @click="selectPaneTab('details')"
            :class="[TAB, tabTone('details')]"
          >
            Details
            <span v-if="paneTab === 'details'" :class="INDICATOR" aria-hidden="true"></span>
          </button>
          <button
            v-if="isRavenAvailable && !isEntry"
            ref="tabChatRef"
            type="button"
            role="tab"
            id="tab-task-chat"
            aria-controls="panel-task-chat"
            :aria-selected="paneTab === 'chat'"
            :tabindex="paneTab === 'chat' ? 0 : -1"
            @click="selectPaneTab('chat')"
            :class="[TAB, tabTone('chat')]"
          >
            Task chat
            <span v-if="taskUnreadCount > 0" :class="[COUNT, 'bg-red-600 text-white']" :aria-label="taskUnreadCount + ' unread'">{{ taskUnreadCount }}</span>
            <span v-if="paneTab === 'chat'" :class="INDICATOR" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <!-- TAB 1: SESSION LOG -->
      <div
        v-if="paneTab === 'notes'"
        :id="idp + 'panel-session-notes'"
        :role="isEntry ? 'group' : 'tabpanel'"
        :aria-labelledby="idp + 'tab-session-notes'"
        class="flex flex-col min-h-0 justify-between"
        :class="isEntry ? '' : 'flex-1'"
      >
        <div
          v-if="!isEntry && (!sessionNotesList || sessionNotesList.length === 0)"
          class="flex-1 flex flex-col items-center justify-center gap-2 px-6 py-8 text-center"
        >
          <FeatherIcon name="edit-3" class="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <p class="text-sm text-gray-800 dark:text-gray-200">Note what you finish as you go.</p>
          <p class="text-xs text-gray-700 dark:text-gray-300">A session needs at least one line to save.</p>
        </div>

        <ol
          v-else-if="sessionNotesList && sessionNotesList.length"
          ref="notesListRef"
          role="feed"
          aria-label="Session Log Lines"
          class="max-h-[240px] min-h-0 overflow-y-auto -mx-1 px-1 py-0.5 space-y-0.5"
        >
          <li
            v-for="(line, idx) in sessionNotesList"
            :key="idx"
            data-log-row
            :tabindex="activeRowIndex === idx ? 0 : -1"
            @focus="activeRowIndex = idx"
            @keydown="onRowKeydown($event, idx)"
            :aria-label="'Line ' + (idx + 1) + ': ' + plainLine(line) + '. Press Enter or Delete to remove, Right Arrow for delete button.'"
            class="group flex items-start justify-between gap-2 px-2 py-1.5 rounded-lg text-sm outline-none transition-colors text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          >
            <div class="flex items-start gap-2.5 min-w-0">
              <span class="mt-0.5 w-5 h-5 shrink-0 rounded-full text-[11px] font-semibold tabular-nums inline-flex items-center justify-center bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" aria-hidden="true">{{ idx + 1 }}</span>
              <span class="leading-6 min-w-0 whitespace-pre-line break-words">{{ plainLine(line) }}</span>
            </div>
            <Button
              data-remove-line-btn
              variant="ghost"
              size="sm"
              icon="x"
              :tabindex="activeRowIndex === idx ? 0 : -1"
              @keydown="onRemoveBtnKeydown($event, idx)"
              @click.stop="emit('remove-line', idx)"
              class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity shrink-0"
              tooltip="Delete line"
              label="Delete line"
            />
          </li>
        </ol>

        <!-- Add a line: Enter adds, Shift+Enter breaks the line. The field and its Add button
             are one pill (a half circle at each end) so they read as a single control. A line
             must be at least minLineChars long (OmniTrack Settings); the counter says so. -->
        <div :class="isEntry && !(sessionNotesList || []).length ? '' : 'mt-auto pt-3'">
          <div class="flex items-stretch overflow-hidden rounded-[20px] border transition-colors bg-gray-50 focus-within:bg-white focus-within:ring-2 dark:bg-[#2B2D30]"
            :class="lineHint ? 'border-red-600 focus-within:ring-red-600/20 dark:border-red-400' : 'border-gray-200 focus-within:border-blue-500 focus-within:ring-blue-500/20 dark:border-gray-700'">
            <textarea
              :data-session-input="isEntry ? null : ''"
              :data-entry-line="isEntry ? '' : null"
              ref="lineInputRef"
              v-model="localLineText"
              @input="autoGrowTextarea"
              @keydown="handleTextareaKey"
              rows="1"
              aria-label="Add a line to the session log"
              :aria-keyshortcuts="isEntry ? null : '/'"
              :aria-invalid="lineHint ? 'true' : null"
              :aria-describedby="lineChars > 0 && lineTooShort ? idp + 'session-line-hint' : null"
              :placeholder="isEntry ? 'What did you get done?' : 'What did you just finish?'"
              class="peer flex-1 min-w-0 min-h-[38px] max-h-36 block resize-none overflow-y-auto bg-transparent border-0 shadow-none pl-4 pr-2 py-2.5 text-sm leading-5 outline-none focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-600 dark:text-white dark:placeholder-gray-400"
            ></textarea>
            <!-- The "/" shortcut, shown on wide screens while the field is empty and unfocused -->
            <kbd v-if="!isEntry" class="hidden sm:peer-placeholder-shown:inline-flex peer-focus:!hidden self-center mr-2 px-1.5 rounded border text-xs font-sans text-gray-700 border-gray-300 dark:text-gray-300 dark:border-gray-600" aria-hidden="true">/</kbd>
            <Button
              variant="solid"
              theme="blue"
              size="md"
              tabindex="-1"
              :disabled="lineTooShort"
              @click="submitLine"
              label="Add this line"
              tooltip="Enter"
              aria-keyshortcuts="Enter"
              :class="[DISABLED_SOLID, '!h-auto self-stretch shrink-0 !rounded-none !rounded-r-[19px] !px-4']"
            >Add</Button>
          </div>
          <p
            v-if="lineChars > 0 && lineTooShort"
            :id="idp + 'session-line-hint'"
            class="flex justify-between gap-3 mt-1 px-4 text-xs"
            :class="lineHint ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'"
          >
            <span>Write at least {{ minLineChars }} characters</span>
            <span class="tabular-nums"><span class="sr-only">, so far </span>{{ lineChars }}/{{ minLineChars }}</span>
          </p>
          <!-- What the empty state says on the clock, in one line: the placeholder asks the rest -->
          <p v-else-if="isEntry && !(sessionNotesList || []).length" class="mt-1 px-4 text-xs text-gray-700 dark:text-gray-300">A session needs at least one line to save.</p>
        </div>
      </div>

      <!-- TAB 2: DETAILS. The block this session logs to, from the same component as the
           block drawer: what the clock and task list above do not already say. -->
      <div
        v-else-if="paneTab === 'details'"
        id="panel-session-details"
        role="tabpanel"
        aria-labelledby="tab-session-details"
        class="flex-1 min-h-0 max-h-[320px] overflow-y-auto"
      >
        <BlockDetailDrawer
          v-if="trackerBoundBlock"
          inline
          show
          :block="trackerBoundBlock"
          :is-dark-mode="isDarkMode"
          :is-tracking="true"
          :tracker-block-name="trackerBoundBlock.name"
          :is-block-completed="isBlockCompleted"
          :can-log-timesheet="() => false"
          @open-full="openFullBlock"
        />
        <!-- With no block, the clock and the task list are the whole story: say what Stop does -->
        <div v-else class="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <FeatherIcon name="calendar" class="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <p class="text-sm text-gray-800 dark:text-gray-200">Not on a work block.</p>
          <p class="text-xs text-gray-700 dark:text-gray-300">Stop saves this time and its tasks as an unplanned block.</p>
        </div>
      </div>

      <!-- TAB 3: LIVE RAVEN TASK CHAT -->
      <div
        v-else-if="paneTab === 'chat'"
        id="panel-task-chat"
        role="tabpanel"
        aria-labelledby="tab-task-chat"
        class="flex-1 flex flex-col min-h-0 justify-between"
      >
        <div v-if="!connectedTaskId" class="flex-1 flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <FeatherIcon name="message-circle" class="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <p class="text-sm text-gray-800 dark:text-gray-200">Pick a task to chat with the team about it.</p>
        </div>

        <div v-else class="flex-1 min-h-0 flex flex-col justify-between">
          <div ref="chatStreamRef" class="flex-1 min-h-0 max-h-[240px] space-y-2 overflow-y-auto pr-1">
            <p v-if="chatLoading && taskMessages.length === 0" class="py-6 text-center text-sm text-gray-700 dark:text-gray-300">Loading…</p>
            <p v-else-if="taskMessages.length === 0" class="py-6 text-center text-sm text-gray-700 dark:text-gray-300">No messages yet.</p>
            <div
              v-for="msg in taskMessages"
              :key="msg.name"
              class="group rounded-2xl px-3 py-2 text-sm max-w-[85%]"
              :class="msg.is_self ? 'ml-auto bg-blue-600 text-white' : 'bg-gray-100 text-gray-900 dark:bg-[#2B2D30] dark:text-gray-100'"
              :title="formatMsgTime(msg.creation)"
            >
              <div v-if="!msg.is_self" class="flex items-center gap-1.5 text-xs font-semibold mb-0.5">
                <span class="truncate">{{ msg.sender_name }}</span>
                <Badge v-if="msg.is_bot_message" theme="gray" size="sm" variant="subtle">Bot</Badge>
              </div>
              <div class="whitespace-pre-line break-words leading-relaxed">{{ msg.content || msg.text }}</div>
              <a v-if="msg.file" :href="msg.file" target="_blank" rel="noopener" class="mt-1 flex items-center gap-1 text-xs underline truncate">
                <FeatherIcon name="paperclip" class="w-3 h-3 shrink-0" aria-hidden="true" />{{ msg.file.split('/').pop() }}
              </a>
              <button
                type="button"
                @click="pinSpec(msg.name)"
                class="mt-1 text-[11px] underline underline-offset-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >Pin as task spec</button>
            </div>
          </div>

          <div class="flex items-end gap-2 pt-3 mt-auto">
            <textarea
              v-model="chatInputText"
              @keydown.enter.exact.prevent="sendChatMessage"
              rows="1"
              aria-label="Message the team about this task"
              placeholder="Message the team"
              class="flex-1 min-h-[40px] max-h-36 block resize-none rounded-xl px-3.5 py-2.5 text-sm leading-5 outline-none border transition-colors bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-600 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:bg-[#2B2D30] dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
            ></textarea>
            <Button
              variant="solid"
              theme="blue"
              size="md"
              tabindex="-1"
              :disabled="!chatInputText.trim() || chatSending"
              :loading="chatSending"
              @click="sendChatMessage"
              label="Send message"
              class="!h-10 shrink-0"
            >Send</Button>
          </div>
        </div>
      </div>
    </div>

    <!-- An entry's block tasks sit under what got done: what and which task, then when (right) -->
    <BlockTasksSection v-if="isEntry && trackerBoundBlock" :block="trackerBoundBlock" :is-dark-mode="isDarkMode" />
  </div>
</template>

<script>
import { Button, Badge, FeatherIcon } from 'frappe-ui';
import { useSessionContext } from './useSessionContext.js';
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import BlockDetailDrawer from '../drawers/BlockDetailDrawer.vue';
import BlockTasksSection from '../drawers/BlockTasksSection.vue';
import { DISABLED_SOLID } from '../utils/sessionFrame.js';
import { TAB, INDICATOR, COUNT, tabTone, countTone } from '../utils/materialTab.js';

export default {
  name: 'SessionLogPane',
  components: { Button, Badge, FeatherIcon, BlockDetailDrawer, BlockTasksSection },
  setup() {
    const session = useSessionContext([
      'activePaneTab',
      'activeRowIndex',
      'autoGrowTextarea',
      'chatInputText',
      'chatLoading',
      'chatSending',
      'chatStreamRef',
      'connectedTaskId',
      'emit',
      'formatMsgTime',
      'handleTextareaKey',
      'isRavenAvailable',
      'lineInputRef',
      'lineChars',
      'lineHint',
      'lineTooShort',
      'localLineText',
      'minLineChars',
      'plainLine',
      'notesListRef',
      'onPaneTabKeydown',
      'onRemoveBtnKeydown',
      'onRowKeydown',
      'openChatTab',
      'pinSpec',
      'sendChatMessage',
      'sessionNotesList',
      'submitLine',
      'tabChatRef',
      'tabNotesRef',
      'taskMessages',
      'taskUnreadCount',
      'isDarkMode',
      'idp',
      'isEntry',
      'paneTab',
      'selectPaneTab',
      'tabDetailsRef',
      'trackerBoundBlock'
    ]);
    const ws = useWorkstationContext(['isBlockCompleted', 'openBlockDrawer', 'isSessionElevated']);
    return { ...session, ...ws, TAB, INDICATOR, COUNT, DISABLED_SOLID, countTone };
  },
  methods: {
    tabTone(id) { return tabTone(this.paneTab === id); },
    // The full block, with its actions: the popup steps aside for the drawer
    openFullBlock(block) {
      this.isSessionElevated = false;
      this.openBlockDrawer(block);
    },
  },
};
</script>
