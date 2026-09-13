# 🗺️ OmniTrack Strategic Product Roadmap

```
+---------------------------------------------------------------------------------------+
|  v1.0.0 (Current)        |  v1.1.0                   |  v1.2.0              |  v2.0.0 |
|  Split-Shift Engine &   |  Cross-Site Task & Doc    |  GitHub Heatmaps &   |  AI     |
|  Attendance Synthesizer  |  Replication Gateway      |  Desk Live Timer UI  |  Fleet  |
+---------------------------------------------------------------------------------------+
```

## 🌐 Vision & Strategy
OmniTrack aims to be the universal standard for discontinuous workforce scheduling, multi-instance enterprise replication, and developer-grade productivity auditing on the Frappe Framework.

### Key Pillars:
1. **Zero Compromise Accuracy**: Split shifts, midnight spanning, and multi-session check-ins calculated with mathematical precision.
2. **Seamless Multi-Site Interoperability**: Decentralized, HMAC-secured bi-directional task sync between distributed branches and satellite instances.
3. **Developer-First UX**: High-density GitHub contribution heatmaps, live desk stopwatches, and commit-style audit trails.
4. **100% Frappe Native**: Extensible, clean architecture with zero monkey-patching and strict adherence to open-source governance.

For detailed breakdown per sprint and release, see [MILESTONES.md](MILESTONES.md).

---

## 📅 Planned: Calendar Work-Block Planner (Self-Booking)

**Status:** Not built. Today the only way to create a `Planned Work Block` from the
Workstation PWA is the **"+ Define Task"** modal, which writes a free-text note plus a
flat 4.0h duration (API defaults the window to 09:00–13:00). It does **not** let a user
pick from their assigned Frappe `Task`s, and it has no time-of-day picker or calendar
surface. The `get_active_tasks_and_projects` endpoint already returns the user's open
Tasks/Projects but is currently wired only to the desk-stopwatch autocomplete.

### Goal
A day/week calendar view where a user drags their **assigned tasks** (ToDo `_assign`
on `Task`, status Open/Working) onto time slots to create `Planned Work Block` rows —
booking their day against real commitments instead of typing notes.

### Requirements
- Left rail: "My Assigned Tasks" list (from `_assign` / ERPNext Task assignment),
  showing subject, project, and remaining estimate.
- Drag a task onto a calendar slot → creates a `Planned Work Block` with
  `task` (Link), `project`, `work_date`, `start_time`, `end_time`, `duration_hours`
  derived from the drop position/resize handles.
- **A single task can span multiple work blocks across multiple days/sessions.**
  The block ↔ task relation is many-to-one. Booking 2h today and 3h tomorrow against
  the same task must be first-class, not a workaround.
- Per-task progress: rolled-up "planned vs. estimate vs. actual logged" across all its
  blocks (reuse the `effective_sessions_completed` aggregation from the Split-Shift
  Synthesizer). Show "X of Y sessions", remaining hours, and over/under-run.
- Resize / move / delete blocks on the calendar; respect `Omnitrack Shift Session`
  windows and split-shift boundaries.
- Manager view: book on behalf of a team member (delegation already exists in
  `create_planned_work_block(employee=...)`).

### Planner calendar — follow-ups found while building (2026-09-10)
- **Midnight-crossing blocks:** a block whose `end_time < start_time` (e.g. an overnight
  stopwatch log 23:46–07:30) is drawn only on its start date as one tall bar. Proper fix:
  split into a tail segment on day N (start→24:00) and a head segment on day N+1
  (00:00→end), like real calendars. Interim fix shipped: grid is now a full 24h
  (12a–11p), internally scrollable (opens at ~7a), and `blockTop`/`blockHeight` are
  clamped so a block can never overflow the grid.
- **Overnight stopwatch logs:** `log_work_session` / the Desk-Navbar stopwatch-stop
  handler should split a session that crosses midnight into per-day `OmniTrack Work
  Session` rows at creation time, rather than storing one 7.7h block.
- **Overlapping blocks:** two blocks at the same time render on top of each other — need
  side-by-side lane layout (column split by overlap group).
- **Leave / absent in calendar:** `task_nature` now has 🌴 Leave / 🤒 Absent options and
  `get_planner_data` flags `is_away` + excludes those from plan-vs-actual totals. Still to
  do: render away blocks as a full-width all-day band at the top of the day column
  (not time-positioned), and surface an `away_count` chip on the summary cards.
- **"Time logged based on timesheets" (user ask):** on sites with an ERPNext/HRMS
  `Timesheet`, actual hours should come from Timesheet detail rows rather than only the
  manual Work Session child table. Needs design: the Work Session table is the de-facto
  timesheet on `ommnomi.local` (no Timesheet doctype there).

### Planner calendar — shipped 2026-09-10 (session)
- ✅ Full 24h grid (12a–11p), internally scrollable, opens scrolled to ~7a; block
  position/height clamped to the grid.
- ✅ Drag a block to reschedule (move = shift start keeping duration, with day-column
  change in Week view; bottom edge = resize end). 15-min snap. Persists via
  `update_work_block`; click still opens the detail drawer.
- ✅ Toolbar "types" filter — multi-select popover (All / 🎯 Planned / ⚠️ Unplanned /
  🚫 Out-of-Office / 🌴 Leave / 🤒 Absent) filtering `blocksForDay` by `task_nature`.
- ✅ `omnitrack.py` csrf_token now `get_csrf_token()` (was rendering literal "None" /
  empty string → intermittent 417s on POST).
- ✅ Tracked time shows on the calendar as recorded-vs-planned. Header stopwatch can be
  started bound to a Planner block ("Start stopwatch for this block" in the detail
  drawer → `trackPlannerBlock`); on stop it logs an `OmniTrack Work Session` against
  that block via `log_work_session` (not a standalone Completed block). Calendar blocks
  now paint an actual-hours fill rising from the bottom (emerald, rose if over plan).
- ✅ Book modal has a Work / 🌴 Leave / 🤒 Absent toggle; `submitBooking` passes
  `task_nature`; `bench --site ommnomi.local migrate` run so the new Select options exist.

### Planner calendar — shipped 2026-09-12 (Track 1)
- ✅ **All-Day Away / Leave Bands**: Rendered in a dedicated top banner row above the 24h scrollable hour grid; `away_count` badge surfaced on summary cards; Leave/Absent modal prompts only for date & reason (omits start/end time pickers).
- ✅ **Smart Overlapping Block Sub-Lanes**: Greedy interval graph coloring packs concurrent/overlapping blocks side-by-side into dynamic width/left sub-lanes with zero visual collision.
- ✅ **Midnight-Crossing Segment Visuals**: Blocks spanning across midnight render as a tail segment on Day N (start→24:00) and a head continuation segment on Day N+1 (00:00→end) with continuation markers.
- ✅ **`quick_timer_punch` Reconciled**: Reconciled API signature with default `action="stop"`, flexible `duration_hours` / `duration_seconds`, DocType Select-option normalization (`work_nature`), and CSRF token propagation.
- ✅ **Backend Overnight Session Splitting**: `log_work_session` detects sessions crossing midnight and automatically splits them into distinct `OmniTrack Work Session` child rows for Day N and Day N+1.
- ✅ **Automated Test Coverage**: `test_planned_work_block.py` expanded to 7 tests covering midnight session splits, flexible quick punches, and `away_count` rollups.

### Planner calendar — remaining open items
- **"Time logged based on timesheets" (user ask):** on sites with an ERPNext/HRMS `Timesheet`, actual hours should come from Timesheet detail rows rather than only the manual Work Session child table. Needs design: the Work Session table is the de-facto timesheet on `ommnomi.local` (no Timesheet doctype there).
- **Manager Delegation in Calendar:** Allow team managers to switch target employee directly within the calendar view to plan or review blocks on behalf of team members.

### Planner calendar — shipped 2026-09-12 (Track 2: live verification + UX)
- ✅ **Unbalanced template fixed (app-blanking).** `www/omnitrack.html` was missing 5
  `</div>`s (1 in the Desk Remote HUD card, 4 at the end of the Planner tab), so every
  tab section after `activeTab === 'dashboard'` was parsed *inside* the dashboard `v-if`
  and `<main>` rendered as a single `<!---->`. Whole app looked blank with **no console
  error**. Guard: `python3` tag-balance scan over the template (see below).
- ✅ **`getBlockTimingInfo` implemented.** Template called `.pillClass`/`.label` in 4
  places but the function was never defined → `TypeError` blanked the Vue app.
- ✅ **Time padding at the source.** Frappe `Time` fields arrive as `timedelta`, and
  `str(timedelta)` drops the leading zero ("7:30:55"), so the old
  `String(t).slice(0,5)` rendered "07:30:" with a dangling colon. Added `_time_str()`
  in `api.py` (always `HH:MM:SS`) + a parsing `hhmm()` in the template. Regression test
  `test_planner_times_are_zero_padded` asserts the invariant over the **whole**
  `get_planner_data` payload (mutation-verified).
- ✅ **`1fr` → `minmax(0, 1fr)`** on all three planner grids (+ `min-w-0`/`overflow-hidden`
  on the all-day cell). `1fr` is `minmax(auto, 1fr)`, so the away-badge cell grew to its
  content width and pushed the all-day band a whole column left of its real date.
- ✅ **Assigned-task card shows planned / logged / expected** (estimate no longer hidden at 0).
- ✅ **Readable gridlines**: hour borders gray-300/gray-700 + a dashed half-hour tick.
- ✅ **Drag across the grid to book a range** (15-min snap, ghost with `HH:MM–HH:MM`);
  a plain click still books a single hour.
- ✅ **Google-Calendar "now" line** (red, today's column, 30s tick) and **past time shaded**
  so the eye avoids booking behind it.
- ✅ **Office hours 10:00–18:00, user-editable** (per-browser `localStorage`); away/leave
  days stretch as a band across that span instead of only a chip in the all-day row.
- ✅ **Top resize handle** (`resize-start`) — start time is now draggable, not just end.
- ✅ **Book modal shows full task detail** (subject wraps, project/priority/due/status +
  planned·logged·expected) because a native `<select>` truncates long subjects.
- ✅ **Block visual language**: non-working = dotted + neutral light fill; planned = light
  project tint + solid project border; logged/completed = solid dark project colour;
  past-and-never-logged = subtle project-tinted diagonal hatch. Colours are inline
  `hsl()` from a project-name hash, so no Tailwind class needs to pre-exist.
- ✅ **Removed the duplicate floating tracker HUD** — the header pill already shows the
  live stopwatch.

- **The past is read-only** — `isPastSlot(iso, endMin)` / `isBlockLocked(block)` drive every edit
  affordance: block drag + both resize handles, the two book-modal entry points (amber
  `pastBookingHint` banner instead of a silent refusal), and the block drawer's stopwatch,
  "Log a real session manually" form, Cancel block and Delete (replaced by a 🔒 note).
  `submitSession` / `cancelActiveBlock` / `removeActiveBlock` also guard in JS, so a stale
  drawer cannot mutate history.
- **Desk Remote HUD dedupe + session log** — the left column is now a real card (the
  `justify-between` dead gap is gone), the duplicate ping dot and "🔴 Recording Live" caption
  are dropped (the red dot + red clock already say it), and the right side collapsed from
  icon + title + badge + subtitle to "Session Log" + a count. Lines render newest-first
  (`sessionNotesNewestFirst` keeps the original index for numbering and removal), the per-row
  ✓ gave way to a single numbered pill, `/` focuses the add-line input from anywhere (skipped
  while typing in a field), and adding a line scrolls the list back to the top.

- **Desk Remote HUD is one timesheet, not two cards (2026-09-12).** "Current Session" and
  "Session Log" were two bordered cards inside one card, reading as unrelated panels; they are
  now two panes of a single bordered card split by a vertical divider. Same pass: custom
  accessible listbox dropdowns replaced both native `<select>`s (Project, Activity Nature), the
  bound block's title/date/project/nature/planned-vs-logged/notes are shown in a context panel
  (`trackerBoundBlock`), the timer hero was calmed (one small dot, `text-xl`, no `ring-4`), the
  header was reordered to timer → + Task → theme → employee switcher, the stale header
  quick-tracker popup (duplicate nature chips + notes input) was deleted so the header pill and
  Shift+T both call `openSessionCard()`, and the log got `/` focus, newest-line-#1 numbering and
  ↑/↓ roving-focus rows with Enter/Delete to remove a line.
- **Planner chrome compacted (2026-09-12).** The range label moved inside the prev/next chevron
  group with a fixed width so switching Day/4 Days/Week cannot shift the buttons; the full-width
  "🏢 Office hours" banner was replaced by a compact pair of time inputs in the toolbar plus two
  emerald hairlines (`officeMarks`) drawn on every day column at office start/end; the
  Day/4 Days/Week segmented control is now a single tab stop with roving `tabindex` and
  ←/→/↑/↓/Home/End selection (`onPlannerViewKey`).
- **Bug — `saveNewPlannedTask` reports success from its `catch` block.** A failed POST still shows
  "Task created and assigned." Move the success toast into the try path and surface the real error.
- **Blocked — no project selection possible on this site.** There is no `Project` (or `Task`)
  DocType installed (no ERPNext), and all `Planned Work Block` rows have NULL `project` /
  `legacy_project_id`, so the Project dropdown can only offer "General Work (Internal)". It now
  says why in an empty-state row. Revisit if ERPNext Projects is ever installed.

### Planner calendar — remaining open items (added 2026-09-12)
- **No template-balance guard.** A missing `</div>` silently blanks the app with no
  console error. Wire the tag-balance scan into pre-commit + CI over `www/*.html`.
- **No regression test for `getBlockTimingInfo` / grid tracks.** Per "fixes must stay
  fixed": assert every template helper referenced in `www/omnitrack.html` is exported
  from `setup()`, and that planner grids use `minmax(0, 1fr)`.
- **`if (m.kpis) dashboardKPIs.value = m.kpis;`** replaces the whole initial shape, so a
  partial payload throws `Cannot read properties of undefined (reading 'today')`. Merge
  per-key instead.
- **Planner has no loading state.** First paint shows zeros while `fetchPlannerData`
  is in flight, which reads as "no data" rather than "loading".
- **Office hours are per-browser only.** Should move to an OmniTrack Settings / Employee
  shift field so they are shared and per-employee.
- **Test record `PWB-2026-00012`** ("Test leave — verifying all-day away band",
  2026-09-11) was created to exercise the away band; delete if not wanted.

### Dashboard & session UX pass (2026-09-13)

Shipped in `www/omnitrack.html`:
- Mobile FAB opens the session timesheet (HH:MM label, no icon/seconds); bottom nav no
  longer shifts (`flex-1 basis-0`, constant label weight).
- Full-width mobile planner toolbar; edge-to-edge calendar card; `touch-pan-y` cells plus
  horizontal swipe to move the period; nature filter widened and re-anchored (`left-0`).
- Custom "Viewing" listbox replaces the native `<select>` (desktop listbox + mobile
  `menuitemradio` list).
- Session Log is chronological (newest last) and scrolls to the bottom on add.
- Idle state: the HUD card is gone when nothing runs, the clock resets to 00:00:00 on stop,
  and the header pill / FAB / hamburger "timesheet" item starts an unplanned session
  (tooltip now says "Start an unplanned session" when idle).
- "Your Day" heading: title switches to the date when you leave today; subtitle summarises
  blocks / planned h / logged h.
- Day strip is one tab stop (`role="radiogroup"`, roving tabindex, Arrow/Home/End, rolls
  over into the previous/next week) and fits 375px; "Today" appears only when you are away
  from today, on the side today lies on.
- Focus block cards: the card and title are no longer click targets — Start/Stop lives on
  the button only. Active card is calm (left accent, one clock) and carries a
  "You are working on this" indicator instead of a duplicate scratchpad input.
- Stop guards: stopping a session with an empty log asks once ("Stop anyway"), and a
  **Discard** action (two-step) abandons a mis-started session without writing a timesheet.
- Planned blocks that are not in the past can be rescheduled: a Reschedule button on the
  dashboard cards opens the block drawer, which now has a date/start/end form posting to
  `update_work_block`.

- `Shift+D` jumps to the day view (scrolled just under the sticky header) and focuses the
  selected day, so ← → picks a day and Tab reaches its Start Session button.
- The week arrows now carry the selection with them (same weekday, one week over) and keep
  keyboard focus on it, instead of shifting the strip with nothing selected in view.

Open items from this pass:
- `getBlockTimingInfo is not a function` + 500s still appear in the cumulative console
  buffer; a fresh reload shows the function defined and all requests 200, so they look like
  stale entries from earlier loads — not yet proven.
- `bench --site … clear-website-cache` is needed for `www/*.html` edits to reach the
  browser; document in AGENTS.md.
- No regression test yet for the new stop/discard guards or the day-strip roving focus.

### Day view: plan vs timesheet (2026-09-13, later)
- Planner day / 4-day views showed an empty grid with no explanation when the anchor day had no blocks — added a "Nothing is planned for <range>" banner with a "Go to <nearest day with work>" jump (the fetch already returns the whole anchor week).
- Dashboard bucketing was time-of-day only, so blocks on a **past** date were listed under "Upcoming Focus Blocks". A block on a past date now always falls in the past bucket; the headings are date-aware ("Focus blocks that were planned" / "What happened · plan vs timesheet").
- Past-day cards now carry the calendar's reading in words: planned vs logged, a plan-vs-actual bar (emerald met / amber short / rose over), and the individual sessions with their times and notes — or "No timesheet was recorded against this block."
- "Day at a glance": one horizontal timeline per day — planned blocks on the top lane, logged sessions on the lane below, off-plan sessions in rose, with planned/logged/unlogged totals. Segments use the planner's rich hover card (lifted out of the planner tab so every view can use it), are keyboard-focusable and open the block drawer.
- Timeline has a 6h / 12h / 24h zoom toggle with horizontal scroll; default is device-based (6h mobile, 12h tablet, 24h desktop).
- Day block lists sort by start time, latest first.
- Past card meta row: project before status.
- Session-log toolbar (clock + Discard + Stop & Save) overlapped itself at 375px — now wraps instead.
