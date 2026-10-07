<template>
  <!-- A document's activity, as Desk's timeline keeps it: what people said (Frappe comments) and
       what happened to it (changes, workflow moves, assignments). The box to say something comes
       first and the newest entry right under it, so what was just said is what is seen.
       Comments land on the document itself, so Desk shows the same thread.
       Used by every details panel: Work Block, Work Session (its block's), Task and To-Do. -->
  <section class="space-y-3" :aria-labelledby="headId">
    <h3 :id="headId" class="text-sm font-medium" :class="mutedText">Activity<template v-if="comments"> ({{ comments }} {{ comments === 1 ? 'comment' : 'comments' }})</template></h3>
    <p v-if="note" class="text-sm" :class="mutedText">{{ note }}</p>

    <!-- Say something. Ctrl+Enter posts; an unsent draft is kept if the panel closes. -->
    <form v-if="!failed || items.length" class="space-y-2" @submit.prevent="post">
      <Textarea
        v-model="draft"
        variant="outline"
        size="md"
        :rows="2"
        :label="'Comment on this ' + noun"
        placeholder="Add a comment. Ctrl+Enter posts it."
        :disabled="posting"
        @keydown.meta.enter.prevent="post"
        @keydown.ctrl.enter.prevent="post"
      />
      <p v-if="error" class="text-sm" :class="lateText" role="alert">{{ error }}</p>
      <div class="flex justify-end">
        <Button type="submit" variant="solid" size="md" theme="blue" class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800" label="Post comment" :loading="posting" :disabled="!draft.trim()">Comment</Button>
      </div>
    </form>

    <p v-if="loading && !items.length" class="text-sm" :class="mutedText" role="status">Loading activity…</p>
    <p v-else-if="failed && !items.length" class="text-sm" :class="mutedText">
      Activity could not be loaded. <Button variant="ghost" size="sm" label="Try again" @click="load">Try again</Button>
    </p>

    <template v-else-if="items.length">
      <ol class="space-y-3" :aria-label="'Activity on this ' + noun + ', newest first'">
        <li v-for="it in shown" :key="it.id || it.at + it.text">
          <!-- Said by someone: who, when, and what, as they wrote it -->
          <div v-if="it.kind === 'comment'" class="flex items-start gap-2.5">
            <Avatar :label="it.by" :image="it.image" size="md" class="shrink-0 mt-0.5" aria-hidden="true" />
            <div class="min-w-0 flex-1 rounded-lg px-3 py-2" :class="bubble">
              <p class="flex items-baseline gap-2 text-sm">
                <span class="font-medium min-w-0 truncate" :class="strongText">{{ it.by }}</span>
                <span class="sr-only">, </span>
                <time class="shrink-0 tabular-nums" :class="mutedText" :datetime="it.at" :title="fullTime(it.at)">{{ ago(it.at) }}</time>
              </p>
              <div class="prose prose-sm max-w-none break-words mt-0.5" :class="isDarkMode ? 'prose-invert' : ''" v-html="it.html"></div>
            </div>
          </div>
          <!-- Done to it: one line, who first unless Frappe's own sentence already says who -->
          <p v-else class="flex items-baseline gap-2 text-sm pl-1">
            <span class="min-w-0 flex-1 break-words" :class="mutedText"><template v-if="!it.sentence"><span class="font-medium" :class="strongText">{{ it.by }}</span>{{ ' ' }}</template>{{ it.text }}</span>
            <span class="sr-only">, </span>
            <time class="shrink-0 tabular-nums" :class="mutedText" :datetime="it.at" :title="fullTime(it.at)">{{ ago(it.at) }}</time>
          </p>
        </li>
      </ol>
      <Button v-if="hidden" variant="ghost" size="sm" icon-left="chevron-down" :label="'Show ' + hidden + ' older'" @click="showAll = true">Show {{ hidden }} older</Button>
    </template>

    <p class="sr-only" role="status">{{ said }}</p>
  </section>
</template>

<script>
import { useWorkstationContext } from '../../composables/useWorkstationContext.js';

// Unsent words, by document, so closing a panel by accident loses nothing
const drafts = new Map();
// The newest few are what a panel is opened for; the rest are a click away
const RECENT = 15;
const NOUNS = { 'Planned Work Block': 'work block', ToDo: 'to-do', Task: 'task' };

export default {
  name: 'DocActivity',
  props: {
    doctype: { type: String, required: true },
    name: { type: String, required: true },
    // What the panel is, when it is not the document itself (a Work Session shows its block's)
    note: { type: String, default: '' },
    // Changes when the document changes, so what just happened shows up
    stamp: { type: [String, Number, Object], default: null },
    isDarkMode: { type: Boolean, default: false },
  },
  setup() {
    return useWorkstationContext(['postJSON']);
  },
  data() {
    return { items: [], comments: 0, loading: false, failed: false, posting: false, error: '', said: '', showAll: false, seq: 0, draft: '' };
  },
  computed: {
    key() { return this.doctype + '\n' + this.name; },
    headId() { return 'doc-activity-' + this.$.uid; },
    noun() { return NOUNS[this.doctype] || 'document'; },
    hidden() { return this.showAll ? 0 : Math.max(0, this.items.length - RECENT); },
    // The server sends oldest first; the panel reads newest first, under the comment box
    newest() { return [...this.items].reverse(); },
    shown() { return this.hidden ? this.newest.slice(0, RECENT) : this.newest; },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-800'; },
    mutedText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    lateText() { return this.isDarkMode ? 'text-red-200' : 'text-red-700'; },
    bubble() { return this.isDarkMode ? 'bg-gray-800' : 'bg-gray-50'; },
  },
  watch: {
    key: { immediate: true, handler() { this.draft = drafts.get(this.key) || ''; this.items = []; this.comments = 0; this.showAll = false; this.error = ''; this.load(); } },
    stamp() { this.load(); },
    draft(v) { if (v.trim()) drafts.set(this.key, v); else drafts.delete(this.key); },
  },
  methods: {
    async load() {
      if (!this.doctype || !this.name) return;
      const seq = ++this.seq;
      this.loading = true;
      this.failed = false;
      try {
        const res = await this.postJSON('activity.get_activity', { doctype: this.doctype, name: this.name });
        if (seq === this.seq) this.take(res);
      } catch (e) {
        if (seq === this.seq) this.failed = true;
      } finally {
        if (seq === this.seq) this.loading = false;
      }
    },
    take(res) {
      this.items = (res && res.items) || [];
      this.comments = (res && res.comments) || 0;
    },
    async post() {
      const text = this.draft.trim();
      if (!text || this.posting) return;
      this.posting = true;
      this.error = '';
      this.said = '';
      try {
        const res = await this.postJSON('activity.add_comment', { doctype: this.doctype, name: this.name, content: text });
        ++this.seq;
        this.take(res);
        this.draft = '';
        this.said = 'Comment posted';
      } catch (e) {
        // The words stay in the box to try again
        this.error = (e && e.message) || 'The comment could not be posted.';
      } finally {
        this.posting = false;
      }
    },
    when(at) { return new Date(String(at).replace(' ', 'T')); },
    // "just now", "5m ago", "3h ago", "Tue", "Oct 6": the exact time is on hover
    ago(at) {
      const t = this.when(at), now = new Date();
      const mins = Math.round((now - t) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      if (mins < 24 * 60 && t.getDate() === now.getDate()) return Math.round(mins / 60) + 'h ago';
      if (mins < 6 * 24 * 60) return t.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + this.clock(t);
      return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: t.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    },
    clock(t) { return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase(); },
    fullTime(at) { const t = this.when(at); return t.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ', ' + this.clock(t); },
  },
};
</script>
