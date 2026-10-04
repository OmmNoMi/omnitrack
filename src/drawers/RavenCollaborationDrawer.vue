<template>
  <div>
    <!-- Backdrop for Task Raven Drawer -->
    <div v-if="show && task" @click="$emit('close')" class="fixed inset-0 z-[65] bg-black/40 backdrop-blur-xs transition-opacity" aria-hidden="true"></div>

    <transition enter-active-class="transition ease-out duration-150" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition ease-in duration-100" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="show && task" class="fixed inset-y-0 right-0 z-[70] w-full max-w-lg shadow-2xl overflow-y-auto flex flex-col" :class="isDarkMode ? 'bg-[#1E1F22] border-l border-gray-800 text-gray-100' : 'bg-white border-l border-gray-200 text-gray-900'" role="dialog" aria-modal="true" aria-label="Task Raven Collaboration">
        
        <!-- Drawer Header -->
        <div class="p-4 border-b shrink-0 flex items-start justify-between gap-3" :class="isDarkMode ? 'border-gray-800 bg-[#25262A]' : 'border-gray-200 bg-gray-50/70'">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Raven Collaboration
              </span>
              <span v-if="task.project_name || task.project" class="text-[10px] font-semibold text-gray-400">
                {{ task.project_name || task.project }}
              </span>
              <span class="text-[10px] font-mono text-gray-400">#{{ task.name || task.ref }}</span>
            </div>
            <h3 class="font-extrabold text-base leading-snug truncate" :title="task.subject">{{ task.subject }}</h3>
          </div>
          
          <div class="flex items-center gap-1.5 shrink-0">
            <a href="/raven" target="_blank" class="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors" title="Open Full Raven App ↗" aria-label="Open Full Raven App">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <button type="button" @click="$emit('close')" aria-label="Close" class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
          </div>
        </div>

        <!-- Task Metadata Strip -->
        <div class="px-4 py-2 border-b text-xs flex items-center justify-between gap-2 shrink-0" :class="isDarkMode ? 'border-gray-800 bg-[#1E1F22]' : 'border-gray-100 bg-white'">
          <div class="flex items-center gap-2 overflow-x-auto">
            <span v-if="task.status" class="px-2 py-0.5 rounded-md font-semibold text-[11px]" :class="task.status === 'Open' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'">
              {{ task.status }}
            </span>
            <span v-if="task.priority" class="px-2 py-0.5 rounded-md font-semibold text-[11px]" :class="task.priority === 'Urgent' ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : (task.priority === 'High' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300')">
              {{ task.priority }}
            </span>
            <span v-if="task.exp_end_date" class="text-gray-400 text-[11px]">
              Due: {{ task.exp_end_date }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              type="button" 
              class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 cursor-pointer"
              @click="$emit('start-task-immediately', task); $emit('close')">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Session
            </button>
            <button 
              type="button" 
              class="px-2.5 py-1 rounded-md text-[11px] font-bold border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center gap-1 cursor-pointer"
              @click="$emit('plan-attention-task', task); $emit('close')">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Plan
            </button>
          </div>
        </div>

        <!-- Raven Drawer Tabs Navigation -->
        <div class="flex items-center border-b px-4 shrink-0 bg-gray-50/50 dark:bg-[#25262A]/50" :class="isDarkMode ? 'border-gray-800' : 'border-gray-200'">
          <button 
            type="button" 
            class="px-3 py-2 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors cursor-pointer"
            :class="activeTab === 'chat' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="activeTab = 'chat'">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Discussion ({{ (messages || []).length }})
          </button>
          <button 
            type="button" 
            class="px-3 py-2 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors cursor-pointer"
            :class="activeTab === 'specs' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="activeTab = 'specs'">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Living Specs
          </button>
          <button 
            type="button" 
            class="px-3 py-2 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors cursor-pointer"
            :class="activeTab === 'blocks' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="activeTab = 'blocks'">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Planned Blocks ({{ (blocks || []).length }})
          </button>
          <button 
            type="button" 
            class="px-3 py-2 text-xs font-bold border-b-2 -mb-px flex items-center gap-1.5 transition-colors cursor-pointer"
            :class="activeTab === 'activity' ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="activeTab = 'activity'">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Recaps
          </button>
        </div>

        <!-- Tab Content: Live Chat / Discussion -->
        <div v-show="activeTab === 'chat'" class="flex-1 flex flex-col min-h-0">
          <div class="flex-1 p-4 overflow-y-auto space-y-3" ref="chatScrollContainer">
            <div v-if="loadingMessages" class="text-xs text-gray-400 py-8 text-center animate-pulse">
              Connecting to Raven thread...
            </div>
            <div v-else-if="!messages || !messages.length" class="text-xs text-gray-400 py-8 text-center">
              No messages yet in this task discussion. Send the first message below.
            </div>
            <div v-else v-for="msg in messages" :key="msg.name || msg.creation" class="flex gap-2.5 items-start text-xs">
              <div class="w-6 h-6 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-[10px] shrink-0 uppercase">
                {{ (msg.sender_name || msg.sender || 'U').charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="font-bold text-[11px]" :class="isDarkMode ? 'text-gray-200' : 'text-gray-800'">{{ msg.sender_name || msg.sender }}</span>
                  <span class="text-[10px] text-gray-400 font-mono">{{ (msg.creation || '').slice(11, 16) }}</span>
                </div>
                <div class="p-2.5 rounded-xl rounded-tl-xs whitespace-pre-wrap leading-relaxed" :class="isDarkMode ? 'bg-[#2B2D30] text-gray-100' : 'bg-gray-100 text-gray-800'">
                  {{ msg.content || msg.text }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Message Compose Bar -->
          <div class="p-3 border-t shrink-0 flex items-center gap-2" :class="isDarkMode ? 'border-gray-800 bg-[#25262A]' : 'border-gray-200 bg-gray-50'">
            <input 
              type="text" 
              v-model="newMessageText" 
              placeholder="Post an update, question, or living spec..." 
              @keydown.enter.prevent="sendMessage"
              class="flex-1 text-xs px-3 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-purple-500/50" 
              :class="isDarkMode ? 'bg-[#1E1F22] border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-800'">
            <button 
              type="button" 
              @click="sendMessage" 
              :disabled="!newMessageText.trim() || sendingMessage"
              class="px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white cursor-pointer transition-colors flex items-center gap-1">
              <span>Send</span>
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>

        <!-- Tab Content: Living Specs -->
        <div v-show="activeTab === 'specs'" class="flex-1 p-4 overflow-y-auto space-y-4">
          <div class="text-xs text-gray-500">Living specifications, user stories, and acceptance criteria linked to this task.</div>
          
          <div v-if="task.description" class="p-3.5 rounded-xl border text-xs" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <div class="font-bold text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Task Description / Spec</div>
            <div class="whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200" v-html="task.description"></div>
          </div>

          <div class="p-3.5 rounded-xl border text-xs space-y-2" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <div class="font-bold text-[11px] uppercase tracking-wider text-gray-400">Context & Scope</div>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div><span class="text-gray-400">Project:</span> <span class="font-bold">{{ task.project_name || task.project || 'General' }}</span></div>
              <div><span class="text-gray-400">Task Type:</span> <span class="font-bold">{{ task.type || 'Standard' }}</span></div>
              <div><span class="text-gray-400">Priority:</span> <span class="font-bold">{{ task.priority || 'Medium' }}</span></div>
              <div><span class="text-gray-400">Status:</span> <span class="font-bold">{{ task.status || 'Open' }}</span></div>
            </div>
          </div>
        </div>

        <!-- Tab Content: Linked Planned Blocks -->
        <div v-show="activeTab === 'blocks'" class="flex-1 p-4 overflow-y-auto space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs text-gray-500">Work blocks committed to this task.</span>
            <button type="button" @click="$emit('plan-attention-task', task); $emit('close')" class="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
              + Plan another block
            </button>
          </div>
          <div v-if="!blocks || !blocks.length" class="text-xs text-gray-400 py-8 text-center">
            No work blocks booked for this task yet.
          </div>
          <div v-else v-for="b in blocks" :key="b.name" class="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <div>
              <div class="font-bold text-gray-800 dark:text-gray-100">{{ b.work_date }} · {{ (b.start_time || '').slice(0, 5) }}–{{ (b.end_time || '').slice(0, 5) }}</div>
              <div class="text-[11px] text-gray-400 mt-0.5">{{ b.duration_hours }}h planned · {{ Number(b.actual_hours || 0).toFixed(2) }}h logged</div>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="b.status === 'Completed' || b.status === 'Logged (Full)' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'">
                {{ b.status }}
              </span>
              <button type="button" @click="$emit('open-block-drawer', b); $emit('close')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline p-1">View →</button>
            </div>
          </div>
        </div>

        <!-- Tab Content: Sprint Recaps -->
        <div v-show="activeTab === 'activity'" class="flex-1 p-4 overflow-y-auto space-y-3">
          <div class="text-xs text-gray-500 mb-2">Automated focus session recaps & accomplishments captured by OmniTrack stopwatch on this task.</div>
          <div v-if="!recaps || !recaps.length" class="text-xs text-gray-400 py-8 text-center">
            No focus session recaps yet for this task.
          </div>
          <div v-else v-for="r in recaps" :key="r.name" class="p-3 rounded-xl border text-xs" :class="isDarkMode ? 'bg-[#2B2D30] border-gray-700' : 'bg-gray-50 border-gray-200'">
            <div class="flex items-center justify-between font-bold text-[11px] text-gray-500 mb-1">
              <span>{{ r.sender_name }}</span>
              <span class="font-mono text-gray-400">{{ (r.creation || '').slice(0, 16) }}</span>
            </div>
            <div class="whitespace-pre-line text-gray-800 dark:text-gray-200">{{ r.content || r.text }}</div>
          </div>
        </div>

      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: 'RavenCollaborationDrawer',
  props: {
    show: { type: Boolean, default: false },
    task: { type: Object, default: () => null },
    isDarkMode: { type: Boolean, default: false },
    messages: { type: Array, default: () => [] },
    blocks: { type: Array, default: () => [] },
    recaps: { type: Array, default: () => [] },
    loadingMessages: { type: Boolean, default: false }
  },
  emits: [
    'close',
    'start-task-immediately',
    'plan-attention-task',
    'open-block-drawer',
    'send-message'
  ],
  data() {
    return {
      activeTab: 'chat',
      newMessageText: '',
      sendingMessage: false
    }
  },
  methods: {
    sendMessage() {
      if (!this.newMessageText.trim()) return
      this.$emit('send-message', {
        task: this.task,
        content: this.newMessageText.trim()
      })
      this.newMessageText = ''
    }
  }
}
</script>
