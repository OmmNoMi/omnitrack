<template>
  <section class="rounded-2xl border overflow-hidden" :class="isDarkMode ? 'bg-[#1E1F22] border-gray-800' : 'bg-white border-gray-200'" aria-labelledby="timesheets-heading">
    <!-- Title, the period and its total; below it one line per person, each opening their days -->
    <div class="px-4 sm:px-6 pt-5 pb-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 id="timesheets-heading" class="text-xl font-normal" :class="strongText">TimeLog</h2>
          <p class="text-sm mt-0.5 tabular-nums" :class="mutedText">{{ periodLabel }}<template v-if="hours">{{ ' ' }}· {{ fmt(hours.total_worked) }}h worked</template></p>
        </div>
        <Button variant="ghost" icon="refresh-cw" label="Refresh hours" :loading="hoursLoading" @click="loadHours" />
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <!-- The app's own chips: one tab stop, arrows move and select -->
        <ChoiceChips :options="periodOptions" :model-value="timesheetHorizon" aria-label="Period" @update:model-value="timesheetHorizon = $event" />
        <!-- A range picks any stretch, such as last month while preparing salaries on the 1st -->
        <div v-if="timesheetHorizon === 'range'" class="flex items-center gap-2 flex-wrap" role="group" aria-label="Date range">
          <div v-for="f in rangeFields" :key="f.key" class="flex items-center gap-1.5">
            <span class="text-sm" :class="mutedText" aria-hidden="true">{{ f.label }}</span>
            <div v-input-attrs="{ 'aria-label': f.label, 'aria-haspopup': 'dialog', 'aria-invalid': rangeError ? 'true' : null, 'aria-describedby': rangeError ? 'hours-range-error' : null }" class="w-36" :data-range="f.key">
              <DatePicker variant="outline" :model-value="$data[f.key]" format="D MMM YYYY" :clearable="false" placeholder="Pick a day" @update:model-value="$data[f.key] = $event || ''" />
            </div>
          </div>
        </div>
        <div v-else class="flex items-center gap-1" role="group" aria-label="Move period">
          <Button variant="ghost" icon="chevron-left" :label="'Previous ' + unit" @click="offset -= 1" />
          <Button variant="ghost" icon="chevron-right" :label="'Next ' + unit" :disabled="offset >= 0" @click="offset += 1" />
          <Button v-if="offset < 0" variant="ghost" :label="currentLabel" @click="offset = 0">{{ currentLabel }}</Button>
        </div>
      </div>
      <!-- What is not approved yet, on any day, said once: who and how much is on each person's card.
           A manager reads what waits on them; anyone else, what of theirs waits. -->
      <div v-if="hours && hours.waiting" data-waiting class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <p v-if="!hours.waiting.length" :class="mutedText">{{ hours.can_review_team ? 'Nothing is waiting for your review.' : 'All your logged time is approved.' }}</p>
        <template v-else>
          <p class="tabular-nums" :class="strongText">
            <template v-for="(c, i) in waitingLine" :key="c.label"><span v-if="i" :class="mutedText" aria-hidden="true">{{ ' · ' }}</span><span :class="c.tone ? mark(c.tone).text : (i ? mutedText : 'font-medium')">{{ c.label }}</span></template>
          </p>
          <Button v-if="waitingOutside" variant="outline" size="sm" :label="hours.can_review_team ? 'Show all waiting' : 'Show waiting time'" @click="showWaiting()">{{ hours.can_review_team ? 'Show all waiting' : 'Show waiting time' }}</Button>
        </template>
      </div>
      <!-- The team's period: how much was planned ahead, and where the review stands -->
      <p v-if="hours && hours.can_review_team && hours.totals && hours.people.length > 1" data-totals class="text-sm tabular-nums" :class="mutedText">{{ totalsLine }}</p>
      <p v-if="hours && hours.people.length" class="text-sm" :class="mutedText">{{ hintLine }}</p>
    </div>

    <!-- Hours by person: counted on the server from every Work Session in the period -->
    <div aria-labelledby="team-hours-heading" role="region">
      <h3 id="team-hours-heading" class="sr-only">{{ hours && hours.can_review_team ? 'Hours by person' : 'My hours' }}</h3>
      <p v-if="rangeError" id="hours-range-error" role="alert" class="px-4 sm:px-6 pb-4 text-sm" :class="errorText">{{ rangeError }}</p>
      <p v-else-if="hoursError" role="alert" class="px-4 sm:px-6 pb-4 text-sm" :class="errorText">The time log could not be loaded. {{ hoursError }}</p>
      <p v-else-if="hours && !hours.people.length" class="px-4 sm:px-6 pb-8 text-sm" :class="mutedText">Nobody logged time in this period.</p>
      <ul v-else-if="hours" class="border-t divide-y" :class="lineTone" aria-labelledby="team-hours-heading">
        <li v-for="p in hours.people" :key="p.user">
          <button
            type="button"
            :data-person="p.user"
            class="w-full flex items-center gap-3 px-4 sm:px-6 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
            :class="hoverRow"
            :aria-expanded="openPerson === p.user ? 'true' : 'false'"
            :aria-controls="'team-hours-detail-' + rowId(p.user)"
            @click="openPerson = openPerson === p.user ? '' : p.user">
            <FeatherIcon :name="openPerson === p.user ? 'chevron-down' : 'chevron-right'" class="h-4 w-4 shrink-0" :class="mutedText" aria-hidden="true" />
            <Avatar :label="p.full_name" size="md" class="shrink-0" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block text-base font-medium truncate" :class="strongText" :title="p.full_name">{{ p.full_name }}</span>
              <span class="block text-sm tabular-nums" :class="mutedText">{{ planLine(p) }}</span>
            </span>
            <span class="shrink-0 flex flex-col sm:flex-row items-end gap-x-4 gap-y-0.5">
              <span v-for="c in personMarks(p)" :key="c.label" class="inline-flex items-center gap-1.5 text-sm tabular-nums" :class="mark(c.tone).text"><span class="h-2 w-2 rounded-full shrink-0" :class="mark(c.tone).dot" aria-hidden="true"></span>{{ c.label }}</span>
            </span>
          </button>

          <div v-if="openPerson === p.user" :id="'team-hours-detail-' + rowId(p.user)" class="px-4 sm:pl-[4.75rem] sm:pr-6 pb-6">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <p class="text-sm min-w-0" :class="mutedText"><template v-if="p.by_project.length">{{ projectLine(p) }}</template></p>
              <!-- Entries picked with Space (or their box) are approved together -->
              <div v-if="hours.can_review_team && picked(p).length" data-bulk class="flex items-center gap-2" role="group" aria-label="Selected entries">
                <span class="text-sm tabular-nums" :class="strongText" aria-live="polite">{{ picked(p).length }} selected</span>
                <Button variant="ghost" label="Clear selection" @click="selected = {}">Clear</Button>
                <Button
                  variant="solid" theme="blue" class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white"
                  :label="'Approve ' + picked(p).length + ' selected for ' + p.full_name"
                  :loading="busy === p.user"
                  @click="approveSelected(p)">Approve {{ picked(p).length }} selected</Button>
              </div>
              <Button
                v-else-if="hours.can_review_team && approvable(p).length > 1"
                variant="solid" theme="blue" class="enabled:!bg-blue-700 enabled:hover:!bg-blue-800 enabled:!text-white"
                :label="'Approve all ' + approvable(p).length + ' awaiting for ' + p.full_name"
                :loading="busy === p.user"
                @click="approveAll(p)">Approve all {{ approvable(p).length }} awaiting</Button>
            </div>
            <p v-if="!p.entries.length && !(p.not_logged || []).length" class="text-sm mt-3" :class="mutedText">No entries.</p>
            <!-- A heading per day with its total, newest day first; within a day, as the day went.
                 An entry opens the entry sheet, where Approve, Flag, Edit and Delete already are. -->
            <div v-else @keydown="onRowKey(p, $event)">
              <div v-for="g in layout[p.user]" :key="g.date" class="mt-4" :data-day="g.date">
                <div class="flex items-center justify-between gap-x-3 gap-y-1 flex-wrap pb-1.5 border-b" :class="lineTone">
                  <h4 :id="dayId(p, g.date)" class="text-sm font-medium" :class="strongText">{{ dayHeading(g) }}<span v-if="g.closed" class="font-normal" :class="mutedText">{{ ' ' }}· Payroll closed</span></h4>
                  <span class="flex items-center gap-3">
                    <span class="text-sm tabular-nums" :class="mutedText">{{ dayLine(g) }}</span>
                    <Button
                      v-if="hours.can_review_team && dayApprovable(g).length"
                      variant="ghost" size="sm"
                      :label="'Approve day, ' + longDay(g.date) + ', ' + dayApprovable(g).length + (dayApprovable(g).length === 1 ? ' entry' : ' entries')"
                      :loading="busy === p.user + g.date"
                      @click="approveDay(p, g)">Approve day</Button>
                  </span>
                </div>
                <!-- Working days with nothing on them: not entries, so nothing to open or delete. Days in a
                     row are one line, and the viewer's own newest day offers a way to fill it. -->
                <div v-if="g.missing" data-not-logged class="flex items-center justify-between gap-3 flex-wrap py-2.5">
                  <span class="inline-flex items-center gap-1.5 text-sm" :class="mutedText"><span class="h-2 w-2 rounded-full shrink-0" :class="mark('missing').dot" aria-hidden="true"></span>{{ g.count > 1 ? 'Nothing logged on ' + g.count + ' working days' : 'Nothing logged' }}</span>
                  <Button v-if="canLogDay(p, g.date)" variant="outline" size="sm" icon-left="plus" :label="'Log time for ' + longDay(g.date)" @click="logDay(p, g.date)">Log time</Button>
                </div>
                <ul v-else :aria-labelledby="dayId(p, g.date)">
                  <li v-for="r in g.rows" :key="r.key">
                    <!-- Written out: <component is="button"> would resolve to frappe-ui's global Button -->
                    <button
                      v-if="r.s"
                      type="button"
                      :data-row="r.i"
                      :data-entry="r.e.name"
                      :data-session="r.s.name"
                      :tabindex="r.i === rowStop(p) ? 0 : -1"
                      :class="[rowClass, hoverRow]"
                      @click="openEntry(p, r)"
                      @keyup.space="pickable(r) && $event.preventDefault()"
                      @focus="rowAt[p.user] = r.i">
                      <!-- The pointer's way to pick; from the keyboard, Space on the row -->
                      <span v-if="hours.can_review_team" class="shrink-0 -my-1 h-7 w-6 flex items-center justify-center" aria-hidden="true" @click.stop="pickable(r) ? togglePick(r.e) : openEntry(p, r)">
                        <span v-if="pickable(r)" data-pick class="h-4 w-4 rounded border flex items-center justify-center" :class="selected[r.e.name] ? 'bg-blue-700 border-blue-700' : pickBox">
                          <FeatherIcon v-if="selected[r.e.name]" name="check" class="h-3 w-3 text-white" />
                        </span>
                      </span>
                      <span class="hidden sm:block w-40 shrink-0 text-sm tabular-nums pt-0.5" :class="mutedText">{{ r.span }}</span>
                      <span class="min-w-0 flex-1">
                        <span class="block text-base truncate" :class="strongText" :title="blockTitle(r.e)">{{ blockTitle(r.e) }}</span>
                        <span v-if="r.note" data-note class="block text-sm break-words line-clamp-2" :class="noteText" :title="r.note">{{ r.note }}</span>
                        <span class="block text-sm truncate" :class="mutedText"><span class="sm:hidden tabular-nums">{{ r.span }}{{ ' · ' }}</span>{{ r.e.project }}<template v-if="r.e.unplanned">{{ ' · ' }}Unplanned</template></span>
                        <span v-if="r.e.review === 'flagged' && r.e.approval_notes" class="block text-sm break-words" :class="flagText">{{ r.e.approval_notes }}</span>
                        <span v-if="r.checks.length" data-check class="inline-flex items-center gap-1.5 text-sm" :class="mark('check').text"><span class="h-2 w-2 rounded-full shrink-0" :class="mark('check').dot" aria-hidden="true"></span>{{ r.checks.join(' · ') }}</span>
                        <span v-if="selected[r.e.name]" class="sr-only">, selected for approval</span>
                      </span>
                      <span class="shrink-0 flex flex-col items-end gap-1">
                        <span class="text-base font-medium tabular-nums" :class="strongText">{{ fmt(r.hours) }}h</span>
                        <span class="inline-flex items-center gap-1.5 text-sm" :class="status(r.e).text"><span class="h-2 w-2 rounded-full shrink-0" :class="status(r.e).dot" aria-hidden="true"></span>{{ status(r.e).label }}</span>
                      </span>
                    </button>
                    <!-- An entry from before sessions has no times to open -->
                    <div v-else :data-entry="r.e.name" :class="rowClass">
                      <span class="hidden sm:block w-40 shrink-0 text-sm tabular-nums pt-0.5" :class="mutedText">{{ r.span }}</span>
                      <span class="min-w-0 flex-1">
                        <span class="block text-base truncate" :class="strongText" :title="blockTitle(r.e)">{{ blockTitle(r.e) }}</span>
                        <span class="block text-sm truncate" :class="mutedText"><span class="sm:hidden tabular-nums">{{ r.span }}{{ ' · ' }}</span>{{ r.e.project }}<template v-if="r.e.unplanned">{{ ' · ' }}Unplanned</template></span>
                        <span v-if="r.e.review === 'flagged' && r.e.approval_notes" class="block text-sm break-words" :class="flagText">{{ r.e.approval_notes }}</span>
                      </span>
                      <span class="shrink-0 flex flex-col items-end gap-1">
                        <span class="text-base font-medium tabular-nums" :class="strongText">{{ fmt(r.hours) }}h</span>
                        <span class="inline-flex items-center gap-1.5 text-sm" :class="status(r.e).text"><span class="h-2 w-2 rounded-full shrink-0" :class="status(r.e).dot" aria-hidden="true"></span>{{ status(r.e).label }}</span>
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            <p v-if="p.away" class="text-sm mt-4" :class="mutedText">{{ fmt(p.away) }}h on break or away, not counted.</p>
          </div>
        </li>
      </ul>
      <p v-else-if="!hours" class="px-4 sm:px-6 pb-8 text-sm" :class="mutedText" aria-live="polite">Loading hours…</p>
    </div>
  </section>
</template>

<script>
import ChoiceChips from '../components/common/ChoiceChips.vue';
import { useWorkstationContext } from '../composables/useWorkstationContext.js';
import { blockTitle } from '../utils/blockTitle.js';
import { clock, toMin } from '../utils/clockTime.js';
import { noteLines } from '../utils/wrapNote.js';
import { vInputAttrs } from '../utils/popover.js';
import { logDayRefusal } from '../utils/timesheetEntry.js';
import { fmt, longDay, shortDate, lastMonth, periodFor, rangeRefusal, personDays, foldEmptyDays, planLine, dayLine, totalsLine, waitingLine, spanOf, logDayTimes, sheetBlock, personMarks } from '../utils/timeLog.js';

export default {
  name: 'TimesheetsView',
  components: { ChoiceChips },
  directives: { inputAttrs: vInputAttrs },
  data() {
    return {
      horizons: [
        { id: 'day', label: 'Today' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
        { id: 'range', label: 'Range' },
      ],
      rangeFields: [{ key: 'rangeFrom', label: 'From' }, { key: 'rangeTo', label: 'To' }],
      // The server reads at most this many days at once (team_hours.MAX_DAYS)
      maxDays: 92,
      // A range opens on last month: salaries are prepared on the 1st for the month before
      rangeFrom: lastMonth().from,
      rangeTo: lastMonth().to,
      offset: 0,
      hours: null,
      hoursLoading: false,
      hoursError: '',
      openPerson: '',
      hoursReq: 0,
      busy: '',
      focusAfterLoad: '',
      // The row each person's list is entered on (one tab stop, arrows move)
      rowAt: {},
      // Set when an entry was opened from here, so its changes are read back once it closes
      sheetFrom: false,
      // Blocks picked to approve together, by name (a block's sessions are picked as one)
      selected: {},
      // The waiting name the list is entered on
    };
  },
  computed: {
    periodOptions() { return this.horizons.map((h) => ({ label: h.label, value: h.id })); },
    unit() { return { day: 'day', week: 'week', month: 'month' }[this.timesheetHorizon] || 'period'; },
    currentLabel() { return { day: 'Today', week: 'This week', month: 'This month' }[this.timesheetHorizon] || ''; },
    period() { return periodFor(this.timesheetHorizon, this.offset, { from: this.rangeFrom, to: this.rangeTo }); },
    // Said in place, and nothing is asked of the server, until the range can be read
    rangeError() { return this.timesheetHorizon === 'range' ? rangeRefusal(this.rangeFrom, this.rangeTo, this.maxDays) : ''; },
    periodLabel() {
      // Say the period the numbers are for, as the server read it
      const { from, to } = this.hours ? { from: this.hours.from_date, to: this.hours.to_date } : this.period;
      return from === to ? this.longDay(from) : this.shortDate(from) + ' to ' + this.shortDate(to);
    },
    // Per person: one heading per day, newest first, with the days nothing was logged on (utils/timeLog.js)
    layout() {
      const out = {};
      const closedThrough = (this.hours && this.hours.payroll_closed_through) || '';
      const opts = { closedThrough, span: this.span, noteOf: this.noteOf };
      for (const p of (this.hours && this.hours.people) || []) out[p.user] = foldEmptyDays(personDays(p, opts));
      return out;
    },
    // Any of the entry's own sheets or dialogs still open
    sheetOpen() { return !!(this.showSessionDrawer || this.showEditSessionModal || this.deleteEntry || this.showBlockDrawer); },
    strongText() { return this.isDarkMode ? 'text-gray-100' : 'text-gray-900'; },
    mutedText() { return this.isDarkMode ? 'text-gray-400' : 'text-gray-600'; },
    noteText() { return this.isDarkMode ? 'text-gray-300' : 'text-gray-700'; },
    errorText() { return this.isDarkMode ? 'text-red-300' : 'text-red-700'; },
    flagText() { return this.isDarkMode ? 'text-orange-300' : 'text-orange-800'; },
    lineTone() { return this.isDarkMode ? 'border-gray-800 divide-gray-800' : 'border-gray-200 divide-gray-200'; },
    hoverRow() { return this.isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'; },
    // The days all waiting time falls on, at most the server's longest period (newest end kept)
    waitingSpan() {
      const ws = (this.hours && this.hours.waiting) || [];
      return ws.length ? spanOf(ws, this.maxDays) : null;
    },
    // Offered only when some of it is outside the period on screen
    waitingOutside() {
      const w = this.waitingSpan;
      return !!w && !(this.hours.from_date <= w.from && w.to <= this.hours.to_date);
    },
    rowClass() { return 'w-full flex items-start gap-3 rounded-lg -mx-2 px-2 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600'; },
    pickBox() { return this.isDarkMode ? 'border-gray-400' : 'border-gray-500'; },
    // What can be done here, for who is reading: changing someone's times is an OmniTrack Manager's or Admin's
    hintLine() {
      const h = this.hours;
      if (!h.can_review_team) return 'Open an entry to see or edit it.';
      return 'Open a person, then an entry to approve or flag it' + (h.can_edit_times ? ' or change its times' : '') + '. Space picks entries to approve together.';
    },
    totalsLine() { return totalsLine(this.hours.totals); },
    waitingLine() { const h = this.hours || {}; return waitingLine(h.waiting || [], !h.can_review_team); },
  },
  watch: {
    timesheetHorizon() { this.offset = 0; this.openPerson = ''; this.loadHours(); },
    // What is picked belongs to the person on screen
    openPerson() { this.selected = {}; },
    offset() { this.loadHours(); },
    rangeFrom() { this.loadHours(); },
    rangeTo() { this.loadHours(); },
    // Any approve, flag or undo (from the entry sheet, here, or a toast) reads the numbers again
    reviewRev() { this.loadHours(); },
    // An edit or a delete in the sheet does not bump reviewRev: read again once it is all closed
    sheetOpen(open) {
      if (open || !this.sheetFrom) return;
      this.sheetFrom = false;
      this.loadHours();
    },
  },
  mounted() { this.loadHours(); },
  methods: {
    blockTitle,
    fmt,
    longDay,
    shortDate,
    planLine,
    dayLine,
    rowId(user) { return String(user).replace(/[^a-zA-Z0-9_-]/g, '_'); },
    span(s) { return clock(toMin(s.from_time)) + '–' + clock(toMin(s.to_time)); },
    // What was written for that time, as one line: bullets dropped, a line that only repeats the title left out
    noteOf(s, e) { return noteLines(s.notes, blockTitle(e)).map((l) => l.text).join(' · '); },
    projectLine(p) { return p.by_project.map((x) => `${x.project} ${this.fmt(x.hours)}h`).join(' · '); },
    // A word with a small dot, not a pill: the page stays quiet and only a flag stands out
    mark(tone) {
      const text = this.isDarkMode ? 'text-gray-300' : 'text-gray-700';
      return {
        running: { text, dot: this.isDarkMode ? 'bg-blue-400 animate-pulse' : 'bg-blue-600 animate-pulse' },
        approved: { text, dot: this.isDarkMode ? 'bg-green-400' : 'bg-green-600' },
        flagged: { text: this.flagText, dot: this.isDarkMode ? 'bg-orange-400' : 'bg-orange-500' },
        awaiting: { text, dot: this.isDarkMode ? 'bg-blue-400' : 'bg-blue-600' },
        missing: { text, dot: this.isDarkMode ? 'bg-gray-500' : 'bg-gray-400' },
        check: { text, dot: this.isDarkMode ? 'bg-amber-400' : 'bg-amber-500' },
      }[tone];
    },
    status(e) {
      const tone = e.recording ? 'running' : e.review;
      return { label: { running: 'Running', approved: 'Approved', flagged: 'Flagged', awaiting: 'Awaiting' }[tone], ...this.mark(tone) };
    },
    personMarks(p) { return personMarks(p, this.layout[p.user]); },
    // A run of empty days names its first and last
    dayHeading(g) { return g.count > 1 ? shortDate(g.through) + ' to ' + shortDate(g.date) : longDay(g.date); },
    // Read the days all waiting time is on, open whoever comes first and put focus there
    showWaiting() {
      const w = this.waitingSpan;
      const person = this.hours.waiting[0].user;
      this.focusAfterLoad = { person, open: true };
      // Already on screen: open them without reading again
      if (this.hours.from_date <= w.from && w.to <= this.hours.to_date) {
        this.openPerson = person;
        this.placeFocus();
        return;
      }
      this.timesheetHorizon = 'range';
      this.rangeFrom = w.from;
      this.rangeTo = w.to;
    },
    // Only on the viewer's own day, and only a day they may still log on
    canLogDay(p, d) {
      const h = this.hours;
      return p.user === this.currentUser && !logDayRefusal(d, { daysBack: h.log_days_back, payrollClosedThrough: h.payroll_closed_through, isManager: h.log_any_day });
    },
    // The one entry box, on that day; read again once it closes
    logDay(p, d) {
      this.sheetFrom = true;
      this.focusAfterLoad = { person: p.user };
      this.quickLogTimelineGap(logDayTimes(d));
    },
    // A running session's block is approved once it stops; the server refuses it until then
    canReview(e) { return this.hours && this.hours.can_review_team && e.review !== 'approved' && !e.recording; },
    approvable(p) { return p.entries.filter((e) => this.canReview(e)); },
    // A day's entries still to approve, each block once (a block split over midnight is on two days)
    dayApprovable(g) {
      const seen = new Map();
      for (const r of g.rows) if (this.canReview(r.e)) seen.set(r.e.name, r.e);
      return [...seen.values()];
    },
    pickable(r) { return !!(r.s && this.canReview(r.e)); },
    togglePick(e) {
      const next = { ...this.selected };
      if (next[e.name]) delete next[e.name]; else next[e.name] = true;
      this.selected = next;
    },
    picked(p) { return this.approvable(p).filter((e) => this.selected[e.name]); },
    dayId(p, d) { return 'team-hours-day-' + this.rowId(p.user) + '-' + d; },
    sheetBlock,
    // The entry sheet already approves, flags, edits and deletes; TimeLog only opens it
    openEntry(p, r) {
      this.sheetFrom = true;
      this.focusAfterLoad = { session: r.s.name, person: p.user };
      const s = r.s;
      this.openSessionDrawer(this.sheetBlock(p, r.e), { name: s.name, session_date: s.date, from_time: s.from_time, to_time: s.to_time, hours: s.hours });
    },
    rowStop(p) {
      const n = this.layout[p.user] ? this.layout[p.user].reduce((t, g) => t + g.rows.filter((r) => r.s).length, 0) : 0;
      const at = this.rowAt[p.user] || 0;
      return at < n ? at : 0;
    },
    // Up/Down/Home/End move between a person's entries; Tab leaves the list
    onRowKey(p, ev) {
      const cur = ev.target.closest && ev.target.closest('[data-row]');
      if (!cur) return;
      const box = document.getElementById('team-hours-detail-' + this.rowId(p.user));
      const rows = box ? [...box.querySelectorAll('[data-row]')] : [];
      const at = rows.indexOf(cur);
      let to;
      if (ev.key === 'ArrowDown') to = Math.min(rows.length - 1, at + 1);
      else if (ev.key === 'ArrowUp') to = Math.max(0, at - 1);
      else if (ev.key === 'Home') to = 0;
      else if (ev.key === 'End') to = rows.length - 1;
      else if (ev.key === ' ' || ev.key === 'Spacebar') {
        // Space picks the entry to approve with others; Enter still opens it
        const r = this.rowOf(p, cur);
        if (!r || !this.pickable(r)) return;
        ev.preventDefault();
        this.togglePick(r.e);
        return;
      }
      else return;
      ev.preventDefault();
      this.rowAt = { ...this.rowAt, [p.user]: Number(rows[to].dataset.row) };
      rows[to].focus();
    },
    async loadHours() {
      const req = ++this.hoursReq;
      if (this.rangeError) { this.hours = null; this.hoursError = ''; this.hoursLoading = false; return; }
      this.hoursLoading = true;
      this.hoursError = '';
      try {
        const res = await this.postJSON('get_team_hours', { from_date: this.period.from, to_date: this.period.to });
        if (req !== this.hoursReq) return;
        this.hours = res;
        const people = (res && res.people) || [];
        const want = this.focusAfterLoad && this.focusAfterLoad.open && this.focusAfterLoad.person;
        if (want && people.some((p) => p.user === want)) this.openPerson = want;
        else if (people.length === 1) this.openPerson = people[0].user;
        else if (!people.some((p) => p.user === this.openPerson)) this.openPerson = '';
        this.placeFocus();
      } catch (e) {
        if (req === this.hoursReq) this.hoursError = this.extractErrorMessage(e, 'Try again.');
      } finally {
        if (req === this.hoursReq) this.hoursLoading = false;
      }
    },
    // Once read again, focus stays where it was: the entry's row, or the person if the row is gone
    placeFocus() {
      const want = this.focusAfterLoad;
      if (!want || this.sheetOpen) return;
      this.focusAfterLoad = '';
      this.$nextTick(() => {
        const box = document.getElementById('team-hours-detail-' + this.rowId(want.person));
        const row = want.session && box && box.querySelector(`[data-session="${CSS.escape(want.session)}"]`);
        if (row) { this.rowAt = { ...this.rowAt, [want.person]: Number(row.dataset.row) }; }
        const el = row || document.querySelector(`[data-person="${CSS.escape(want.person)}"]`);
        if (el) el.focus();
      });
    },
    rowOf(p, el) {
      const i = Number(el.dataset.row);
      for (const g of this.layout[p.user] || []) for (const r of g.rows) if (r.i === i) return r;
      return null;
    },
    approveSelected(p) { return this.approve(p, this.picked(p), p.user, `approved for ${p.full_name}`, true); },
    approveDay(p, g) { return this.approve(p, this.dayApprovable(g), p.user + g.date, `approved for ${longDay(g.date)}`); },
    approveAll(p) { return this.approve(p, this.approvable(p), p.user, `approved for ${p.full_name}`); },
    async approve(p, list, busy, said, clear) {
      this.busy = busy;
      this.focusAfterLoad = { person: p.user };
      const ok = await this.approveBlocks(list, (n) => `${n} ${n === 1 ? 'entry' : 'entries'} ${said}`);
      this.busy = '';
      if (!ok) this.focusAfterLoad = '';
      else if (clear) this.selected = {};
    },
  },
  setup() {
    return useWorkstationContext([
      'timesheetHorizon',
      'isDarkMode',
      'postJSON',
      'extractErrorMessage',
      'approveBlocks',
      'reviewRev',
      'openSessionDrawer',
      'showSessionDrawer',
      'showEditSessionModal',
      'showBlockDrawer',
      'deleteEntry',
      'quickLogTimelineGap',
      'currentUser'
    ]);
  },
}
</script>
