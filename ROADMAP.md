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

### Frappe UI Component Standardization — shipped 2026-09-13
- ✅ **Component Abstractions Added**: `<f-card>`, `<f-dropdown>`, and enhanced `<f-input>` registered into Vue component ecosystem matching official Frappe UI component specifications (sizes, themes, variants, keyboard accessibility, dark mode).
- ✅ **Active Timesheet Card & Session Log Standardized**: Outer card wrapped in `<f-card>`, line item counts and indices rendered via `<f-badge>`, deliverable task title input refactored to `<f-input>`, and project and activity nature selectors refactored to `<f-dropdown>`.
- ✅ **Template Size & Complexity Reduced**: Replaced ~70 lines of verbose, duplicated raw Tailwind markup with clean, declarative, reusable components while preserving 100% of shortcut ergonomics (`/`, `Enter`, `Shift+Enter`, `Cmd+S`) and cross-device sync.

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

### Planner gestures + session toolbar (2026-09-13, later)

- **Press-and-hold to grab.** Drag-to-move, edge-resize and drag-to-select on the
  planner grid no longer fire on a plain pointerdown. The pointer must be held still
  (touch 400ms, mouse 200ms, 8px slop) before anything is grabbed, so a swipe to scroll
  the grid on mobile — or a stray mouse-down on desktop — scrolls instead of
  rescheduling. The armed block gets a ring + slight scale and a haptic tick;
  `touch-action` flips to `none` only once armed, and back on release.
- **`pointercancel` aborts instead of committing.** Found while verifying the hold gate:
  a browser-cancelled gesture (system gesture, palm, scroll takeover) was running the
  same end handler as `pointerup`, so it saved the move / opened the booking modal.
  Both `endBlockDrag` and `endSlotSelect` now discard on `pointercancel` and unregister
  their sibling listener.
- **Session toolbar is one tab stop.** Discard + Stop & Save are a WAI-ARIA toolbar with
  roving tabindex: Tab reaches the group once (landing on Stop & Save), ArrowLeft moves to
  Discard, ArrowRight back, Home/End jump. Tab can no longer land on Discard by accident.

### Cross-Device Active Session Synchronization & Guard Invariants (2026-09-13)

- **Seamless Computer ↔ Mobile Phone Stopwatch Handoff.** Previously, an active session
  started on a computer was stored only in the browser's local `localStorage`. Walking
  outside with a mobile phone resulted in a blank/standby HUD with no way to add lines
  or close the session from the phone.
  - Backend: Added `sync_active_session` and `get_active_session` endpoints using a
    dual-tier persistence model (sub-millisecond Redis cache `frappe.cache` + durable
    database persistence `tabDefaultValue` scoped to `frappe.session.user`).
  - Auto-delivery: Server injects active session directly into `window.OMNITRACK_SESSION`
    on initial SSR and delivers it in `get_workstation_data()["active_session"]`.
  - Multi-device syncing: Starting or updating notes/lines from any device (desktop or mobile)
    persists to server and broadcasts via Frappe realtime WebSockets (`omnitrack:active_session_updated`).
  - Safe lifecycle: Stopping or discarding the session on mobile automatically logs the
    full timesheet (including lines logged across both devices), clears the server session,
    and broadcasts `omnitrack:active_session_cleared` so the computer HUD resets to standby.
- **Defensive KPI Merging & Null Guarding.** Fixed template crash risk if partial KPI
  payloads are returned. Deep per-section merge ensures `dashboardKPIs.today`, `week`,
  and `month` are always fully-formed objects with fallback values.
- **Automated Template Tag-Balance & Setup Export Guard Tests.** Added Python AST/HTML
  parsing regression tests in `test_planned_work_block.py` (`test_omnitrack_html_tag_balance`
  and `test_omnitrack_template_setup_exports`) preventing broken markup or unexported
  setup helpers from reaching production.
- **Frappe UI Component Primitives.** Introduced `FButton`, `FBadge`, and `FInput`
  primitives matching Frappe UI's design token API (`variant`, `theme`, `size`), eliminating
  boilerplate Tailwind strings in the HUD while retaining 100% native portal compatibility.

### Timesheet line input is a real text field (2026-09-13, later)

- The session-log "add a line" field is a `<textarea>`, not a single-line `<input>`:
  **Enter** files the entry, **Shift+Enter** starts a new line, and the field grows with
  the text (one row at rest, up to ~8 rows, then it scrolls). Placeholder and an
  `sr-only` hint say so. ArrowUp only jumps to the log when the caret is at position 0,
  so it stays normal cursor movement inside a paragraph.
- Log rows render with `whitespace-pre-line` instead of `truncate`, so a multi-line entry
  keeps the author's breaks instead of collapsing to one clipped line.
- **Fixed: a live session could not be restored after a reload.** `restoreActiveSession`
  required `status === 'active'`, but a payload written by an older build of the page has
  only `startTime` — so a genuinely running clock was silently dropped on reload. Missing
  status now counts as active (only an explicit non-active status refuses), and the
  echoed-back record is re-stamped with `status: 'active'` so the next load sees a
  current-shape payload.

### Adjust modal + shortcut discoverability (2026-09-13, later)

- **Fixed: an adjusted timesheet could fail silently.** The unbound branch of
  `submitAdjustedTimesheet` used a bare `fetch()` and never checked the response, so a
  rejected save still showed "Logged successfully" and wiped the running session. It now
  goes through `postJSON` (which throws on a non-OK response); on failure the clock is
  deliberately left running and the toast says so, with the real Frappe message unwrapped
  out of `_server_messages` by a new `_errText` helper.
- **The two blue footer buttons were indistinguishable.** "Update Running Clock" and
  "Save & Log Timesheet" sat side by side in the same colour — clicking the wrong one
  looks exactly like "it didn't save and it keeps running". They are now
  "Fix start, keep running" (outline/grey) and "Stop & log 13h 18m" (solid blue, states
  the duration it will write).
- **Stop & Save → "Stop ⌘S".** Everything typed in the session log is already persisted
  as it is typed, so "Save" implied work was at risk. The button carries the real
  platform modifier (⌘ on Mac, Ctrl elsewhere) and names the shortcut in its title and
  aria-label.
- **Discard and Adjust got shortcuts of their own**, since a labelled key is the only
  kind anyone discovers: `⌘/Ctrl+D` discards (safe — `discardSession` still asks once and
  only throws the session away on the second press) and `⌘/Ctrl+E` opens Adjust. Both are
  `preventDefault`-ed away from the browser's own bindings, both refuse with "No session
  is running" when idle, and both carry a `⌘D` / `⌘E` chip on the button plus the
  shortcut in the title and aria-label.
- **Shortcut legend** moved out of the left pane to one quiet line under the whole card,
  ordered the way the work flows: `/` → `Shift+Enter` → `Enter` → `⌘S` → `⌘E` → `⌘D` → `Shift+S/P/T/D`.
  Hidden below `lg`, along with the button's ⌘S chip — none of it is pressable on a phone.

### Keyboard affordances stay on the keyboard (done)

A phone has no `/` key, so the shortcut hints were noise on mobile — and the
long placeholder naming Enter/Shift+Enter was clipped mid-sentence at 375px.

- Session-log empty state now reads "write your first one below" under `lg`,
  and keeps "press `/` to start" from `lg` up.
- The `/` chip inside the add-line box is `hidden lg:block`, and the right
  padding reserved for it (`pr-9`) is now `pr-3.5 lg:pr-9` so the phone gets
  the width back.
- Placeholder shortened to "What did you just complete?" everywhere; the
  Enter / Shift+Enter rules live in the desktop shortcut legend under the card.

Verified at 375px (all hidden, no overflow, live session untouched) and at
1334px (all present, `pr` back to 36px).

### Frappe UI Modals & FDialog Abstraction (2026-09-13, shipped)

Expanded Frappe UI component architecture to modal dialogs across OmniTrack:
- **`FDialog` (`<f-dialog>`):** Reusable modal dialog abstraction with accessible ARIA
  dialog semantics (`role="dialog"`, `aria-modal="true"`), smooth backdrop blur transitions,
  automatic Escape key dismissal, `@click.self` backdrop closing, custom header slot /
  header icon support, configurable sizes (`sm`, `md`, `lg`, `xl`), and dark mode theme parity.
- **Refactored 3 Heavy Modals to `<f-dialog>`:**
  1. **Book Work Block Modal (`showBookModal`):** Streamlined using `<f-dialog size="sm">`
     and `<f-button>`.
  2. **Define Planned Task Dialog (`showNewTaskModal`):** Streamlined using `<f-dialog size="md">`,
     `<f-input>`, and `<f-button>`.
  3. **Adjust Timesheet Timing Dialog (`showAdjustModal`):** Streamlined using `<f-dialog size="md">`,
     integrating duration hero card, quick nudge chips, and action buttons.
- **Strict Tag Balance & Regression Verification:** Fully validated with 28 passing unit tests
  in `test_planned_work_block.py` including `test_omnitrack_html_tag_balance`.


### A timesheet with no description cannot be saved (done)

An hour with nothing written against it is not a record. A manager reading it
cannot tell what was done, and once that hour reaches a client's invoice it
reads as time billed for no work. So this is a rule, not a confirmation.

Server (`api.py::_require_session_notes`, the real invariant): `quick_timer_punch`
on stop and `log_work_session` both throw unless the notes carry ≥3 characters
of substance. Bullet/dash scaffolding is stripped first, so `"• \n• "` does not
pass. The old `deliverable_notes or "Stopwatch log recorded from Desk Navbar"`
placeholder is gone — that fallback was manufacturing exactly the empty record
this rule exists to prevent.

Client: Stop, the planner's stop-this-block button, the Adjust modal (its own
notes box satisfies the rule) and the planner session modal all refuse early,
before the clock is torn down, so a refused stop loses nothing. The session-log
empty state says the rule while the clock is running, and Stop's tooltip says
why it will refuse.

Covered by `test_timesheet_without_a_description_is_refused` and
`test_log_work_session_without_a_description_is_refused`; mutation-verified
(disabling the guard fails 7 assertions). 30 tests pass.

### Day at a glance reads as two lines (done)

The planned and logged lanes existed but stacked into one anonymous band, and
were flat blue/emerald while the planner grid next to them colours by project.

- A label gutter outside the scroller names the two lines, PLANNED over LOGGED,
  and stays put while the day scrolls.
- Both lanes now use the planner's colour language via `projectHue`: hollow
  tinted bar = planned, solid bar of the same hue = logged. A short or missing
  session shows as bare outline.
- Off-plan time stays rose in the logged lane — the one thing the project hue
  must not disguise — and the legend gained an "Off plan" swatch.

### The 6h / 12h / 24h zoom actually zooms (done)

The control claimed to set "hours visible across the timeline" but did nothing:
the window was fitted to the data (`lo`/`hi` from the first and last block, floor
180 min), so a day whose blocks span 3h gave `3/zoom*100` — under 100 at every
setting — and `Math.max(100, …)` clamped all three buttons to the same 100%.

- The window is now midnight to midnight, always. A day at a glance is the day.
- `timelineTrackWidth` is purely the zoom ratio: 24h → 100%, 12h → 200%,
  6h → 400%, so the track genuinely overflows and scrolls horizontally.
- Hour labels follow the zoom (every 2h at 24-across, hourly below it) instead
  of following the old span.
- Zoomed in, the left edge is empty small hours, so the scroller auto-scrolls to
  just before the first block of the day on mount and on every zoom change.

Gotcha worth remembering: the `watch` source must be `() => dayTimeline.value`,
not `dayTimeline`. This block sits above the `const dayTimeline` declaration, and
naming the ref directly evaluates it during setup — a TDZ throw that takes the
whole page down with "Cannot access 'dayTimeline' before initialization".

Verified live at 1134px: 100/200/400%, track 1130/2260/4520px, all scrollable,
auto-scroll landing on the 11:00 block at each zoom.

### Frappe UI Marketplace Architecture & Timesheet Session Box (2026-09-13, shipped)

To ensure OmniTrack satisfies Frappe Cloud Marketplace requirements and adheres to official Frappe frontend architecture:
- **Standard Vite + Frappe UI Build Pipeline:**
  - Standard `package.json` installed with `@frappe/ui` (`^0.1.278`), `vue` (`^3.5.13`), `lucide-vue-next`, `vite`, and `tailwindcss` using `frappe-ui/tailwind` preset.
  - Standard `vite.config.js` configured with `frappeui-build-config-plugin`.
  - Registered automatically with Frappe's asset pipeline: `bench build --app omnitrack` invokes `vite build` seamlessly during standard bench builds and asset linking.
- **Genuine Frappe UI Component Implementation:**
  - Created `src/timesheet_session/SessionBox.vue` using genuine Frappe UI components (`Button`, `Badge`, `TextInput` from `frappe-ui`).
  - Styled with high visual fidelity matching the established OmniTrack high-density layout, keyboard shortcuts (`/`, `Enter`, `Shift+Enter`, `⌘S`, `⌘E`, `⌘D`), and dark mode styling.
- **Dynamic Mount & Graceful Fallback:**
  - Bundled as an IIFE library exposing `window.OmniTrackSessionBox = { mount, update, unmount }`.
  - Portal template (`www/omnitrack.html`) renders via a dynamic Vue wrapper component `FrappeUITimesheetBox` when the bundle is loaded, with an automatic fallback to the native HUD if running without precompiled assets.
- **Comprehensive Verification:**
  - All 30 tests in `test_planned_work_block.py` pass (including template tag balance and exported setup invariants).
  - Assets verified via HTTP 200 checks on `ommnomi.local`.


### Day at a glance on mobile (done)

Checked at 375×812 and found two real faults, both fixed:

- The legend row (`Planned / Logged / Off plan / unlogged` + the zoom pills) had
  no `flex-wrap`. At 371px inside a 375px viewport it pushed the **whole page**
  into a horizontal scroll. Now wraps onto two rows.
- The auto-scroll-to-first-block never fired on first load: the card is created
  by `v-if` on the same tick the data arrives, so a single rAF attempt measured a
  track that had not taken its zoomed width and landed on 0. Now retries up to 8
  times at 120ms, instant on load and smooth on a zoom change.

Verified: `pageOverflow:false`, track 257/514/1028px at 24/12/6h, all scrollable,
initial `scrollLeft` 447 = exactly the 11:00 block.

### Tests must not commit (fixed — they were writing to real site data)

`quick_timer_punch(action="stop")` ends in `sync_active_session()`, which calls
`frappe.db.commit()`. That commit flushed everything the test had just inserted,
so `tearDown`'s `frappe.db.rollback()` could not undo it and every run left real
Planned Work Blocks in the site — inflating the dashboard's planned hours.

Fixed with a class-level `patch("frappe.db.commit")` in `setUp`. Patching
`sync_active_session` instead does NOT work: two tests assert on its real
behaviour and fail.

Worth noting for the app itself: that mid-request commit means a failure anywhere
after the block insert in `quick_timer_punch` cannot be rolled back either.

### Stop looked like it did nothing (fixed)

Root cause was not the button. The click reached `toggleTrack` every time
(verified by instrumenting the handler live). `toggleTrack` tears the session
down locally, fires `sync_active_session(null)` **without awaiting it**, and then
calls `fetchWorkstationData()`. That refresh hit `get_active_session` while the
clear was still in flight, found `status: 'active'`, and called
`restoreActiveSession()` — which had no stop guard of its own. The session came
back inside a few hundred ms, so the HUD never visibly changed.

Fixed by moving the guard into `restoreActiveSession` (the single choke point),
adding the same bar to the `fetchWorkstationData` restore branch, mirroring the
ended-session set into `localStorage` so other tabs honour it, and cancelling a
pending `_syncDebounceTimer` on stop/discard so a 500ms-old payload cannot
re-activate the session after the clear.

### Modals were dialogs in looks only (fixed)

`FDialog` had Esc but no scroll lock, no initial focus, no focus trap and no
focus restore — WCAG 2.4.3 and 2.1.2. Added all four to `FDialog` itself so every
dialog built on it inherits them, with a depth counter so a nested dialog closing
does not unlock the page. The lock sets `overflow:hidden` on `documentElement`
too, because `<html>` is this page's scrolling element.

Still open: the work-block drawer (`showBlockDrawer`) is its own `role="dialog"`
and does not go through `FDialog` — it still has no trap or scroll lock.

### The page froze after Stop in the 30-minute reminder (fixed 2026-10-07)

Not specific to Stop: closing any frappe-ui dialog left `body` at
`overflow:hidden`. Our dialog watcher (`useWorkstationEod.js`) and the session
popup watcher (`useWorkstationPickers.js`) each wrote `hidden` on both `<html>`
and `<body>`. Reka's own lock saved that `hidden` as the body's original and
restored it after our watchers had cleared it. Reproduced in memory, by
toggling `showInactivityModal`/`showEmptyStopModal`, without stopping a session.

Fixed at one choke point: `src/utils/scrollLock.js` locks `<html>` only, counted
per owner, so the dialogs closing no longer unlock the page under the open
session popup either. Guard: `scripts/check_scroll_lock.mjs` (in `npm test`) plus
5 mutants. The old Test 23 assertion, which *required* the body write, was
replaced. A tab already stuck from before needs one reload.

## Domain model written down (`docs/DOMAIN_MODEL.md`)

Project / Task / Planned Work Block / Work Session were being used
interchangeably, and "timesheet" meant three different objects depending on who
said it. Every metric on top of that — PAI, variance, "unlogged hours" — inherited
the ambiguity. The canonical definition now lives in `docs/DOMAIN_MODEL.md`; the
four-layer "for whom / what / when / did" framing is codified there.

### Still open, in priority order

- **Stop must not create a Planned Work Block.** `quick_timer_punch(action="stop")`
  calls `frappe.new_doc("Planned Work Block")` on the unbound path, setting
  `duration_hours = actual_hours` and `variance_hours = 0.0`. That fabricates a
  retroactive plan that perfectly fulfils itself, so PAI measures a tautology.
  Verified: 157 blocks against 158 session rows; one day holds 18 byte-identical
  `In Progress` 14:00–16:00 blocks plus 6 identical 12:58:15 blocks. An unbound
  stop should produce a session on a block explicitly marked `⚠️ Unplanned`.
- **"Xh unlogged" is meaningless.** `dayTimeline.gapH = Σ(block spans) − Σ(session
  spans)` with no overlap merging and no dedup — eighteen overlapping two-hour
  blocks sum to 36 planned hours inside a 24-hour day. Must be derived from the
  associate's commitment hours instead.
- **No commitment-hours source exists.** `commitment` appears only as prose in
  README / CHANGELOG / SRS / AGENTS.md — no field, no API, no calculation.
  `OmniTrack Shift Template` → `OmniTrack Shift Session` (`min_duration_hours`),
  assigned via `OmniTrack Shift Split Assignment`, is the nearest structure and is
  **never read by any Python or JavaScript in the app**. Wire it up or replace it
  with a per-user contracted-hours value; the day legend cannot be correct until
  one exists.
- **`employee` means two different things.** `Planned Work Block.employee` is a
  Link to `User`; `OmniTrack Shift Split Assignment.employee` is a Link to
  `Employee`. Same name, same module, different targets.
- **Duplicate blocks need cleanup.** PWB-2026-00160/00161/00162 (same 16:24
  session, created 10:10:32 / 10:23:06 / 10:23:59) and the 00163/00164 pair
  (19 s apart) were written by repeated Stop presses while the HUD appeared dead.
  Deletion is irreversible — needs an explicit go-ahead.
- **Regression tests** for the invariants in `docs/DOMAIN_MODEL.md` §10, mutation-
  verified and wired into CI alongside `scripts/check_www_html.py`.

---

## 🎯 Active Refactoring Backlog & Tracked GitHub Issues (October 2026)

### 1. Issue #16: Calendar Vertical Scroll & Independent Rail Scrolling
- **Problem:** Calendar grid stops scrolling past 3:00 PM on desktop displays because the container locks vertically; scrolling assigned work inappropriately shifts the calendar grid.
- **Solution:** Apply independent `overflow-y-auto` to both the left "Assigned Work" column and the 24-hour Calendar hour grid. Remove whole-page scroll lock so evening hours (3 PM - 11:59 PM) are fully accessible.

### 2. Issue #17: Simplified Work Nature Architecture (Work, Break, Leave)
- **Done 2026-10-06:** the activity is Work, Break or Away (Away is the owner's word for leave, absence and out-of-office). Planned-ness moved to the block's `unplanned` flag. See "Activity is Work, Break or Away" below.
- **Problem:** Cluttered work nature options (Planned, Virtual Meeting, Unplanned Ops, Review & Sync, Break, Leave, Absent).
- **Solution:** Consolidate into 3 canonical project planning modes:
  1. `Work` (Active execution & delivery)
  2. `Break` (Short breaks/pauses during the day)
  3. `Leave` (Longer absence; external HR rules/quotas govern whether paid/unpaid/absent).

### 3. Issue #18: Multi-Assignee Support for Shared Project Blocks
- **Problem:** Scheduling a project meeting, pair-programming session, or release requires 2+ people, but the assignee field only accepts one member.
- **Solution:** Enable multi-select assignee input that creates paired/mirrored Planned Work Blocks for all participants across identical time windows.

### 4. Issue #19: UX Enhancements & Modern SPA Cleanliness
- **Date Presets:** Add quick date pills (`Today`, `Tomorrow`, `+2d`) alongside existing duration presets (`30m`, `1h`, `1.5h`, `2h`, `3h`, `4h`) in the Plan Focus Block modal.
- **Icon-Only Inactive Filter Pills:** Assigned work filter pills (`All`, `Underplanned`, `Overdue`, `Star`) display compact icons when inactive, and expand with text only when active.
- **De-duplicate Task Drawer Actions:** Clean up duplicate action buttons and duplicate views in the task drawer.
- **Instant Reactive Booking:** Ensure booking a focus block instantly re-fetches and renders the block on the day calendar without delay.
- **Modern SPA Component Refactoring:** Retire monolithic HTML template rendering and transition runtime views entirely to the modular Vite SFC architecture under `src/views/` and `src/composables/`.

---

## 🏛️ Approved Strategic Architectural Tracks (October 2026)

### Track A: DocType Naming & Field Governance (Approved)
* **Reference**: [`doctype_naming_governance.md`](file:///Users/ommnomi/.gemini/antigravity/brain/32a545c2-e019-473f-b19e-e00d742041bd/doctype_naming_governance.md)
* **Objectives**:
  1. Standardize DocType naming convention: eliminate divergent prefixes, aligning all tables strictly under the `OmniTrack` namespace (e.g., `OmniTrack Work Session`, `OmniTrack Planned Work Block`).
  2. Normalize user and employee field schemas across doctypes (`employee` as Frappe `User` email reference vs `employee_doc` for HRMS Employee link).
  3. Safe database migration script with zero data loss or orphan timesheets.

### Track B: OmniQuery Reporting Engine & Performance Architecture (Approved)
* **Reference**: [`omniquery_audit_and_comparison.md`](file:///Users/ommnomi/frappe-bench/version-16/apps/omnitrack/.agents/skills/omniquery_audit_and_comparison.md)
* **Objectives**:
  1. Build a unified, hermetic querying service layer (`omnitrack/services/query.py`) replacing fragmented raw SQL across workstation, timesheets, and analytics.
  2. Implement caching with TTL and invalidation hooks on block/timesheet updates.
  3. Ensure 100% Frappe ORM compliance (`frappe.qb` / `frappe.get_all`) to preserve multi-tenant company and user permission scoping.

### Track C: Modular SPA Codebase & Directory Structure Reorganization (Approved)
* **Reference**: [`omnitrack_folder_structure.md`](file:///Users/ommnomi/.gemini/antigravity/brain/32a545c2-e019-473f-b19e-e00d742041bd/omnitrack_folder_structure.md)
* **Objectives**:
  1. Transition all views out of monolithic `omnitrack.html` into clean Vite Vue 3 SFCs:
     - `src/views/CalendarView.vue` (Calendar and timeline planner)
     - `src/views/TimesheetsView.vue` (Approvals and manager reconciliation)
     - `src/views/DashboardView.vue` (Personal and team performance analytics)
     - `src/views/AttendanceView.vue` (Presence and shifts)
  2. Centralize state in Vue composables (`src/composables/useSessionTimer.js`, `src/composables/usePlanner.js`, `src/composables/useWorkstation.js`).
  3. Maintain lightweight Jinja entry shell (<100 lines) with pure Vite bundle loading (`omnitrack.bundle.js`).



---

## 🛠️ Production-Readiness Plan: SPA Maintainability (October 2026)

Supersedes the M3b–M7 composable-slimming list. Goal: Helpdesk/CRM-style structure, OmniQuery-grade test discipline, nothing ships unverified in a browser.

**Found 2026-10-05 (fixed, now guarded):** const-TDZ from by-value `opts` bags; undefined helpers (`flt`, `_livePollTimer`, `stopSessionRemote`…); `<f-dialog>` never registered; four views used ~170 template names they never declared (blank Dashboard). Guards: `npm run test:static` (`check_undefined_refs.cjs`, `check_sfc_ctx.cjs`).

### Phase 0 — Safety net (DONE except Cypress login on a test site)
1. ✅ Runtime smoke test `scripts/test_spa_smoke.cjs` (jsdom, no new deps; `npm run test:smoke`): boots the real bundle + `omnitrack.html`, visits all 4 tabs, opens/closes every dialog flag, fails on console errors, unresolved custom elements, blank tabs.
2. ✅ `test:static` (undefined refs, SFC view contexts, **component registry**, file size) is in `npm test`, `run_quality_gate.cjs` and `.git/hooks/pre-commit`. Registry check mutation-verified (removing `FButton` registration fails 21 templates). The smoke test alone does NOT catch an unregistered component its fixtures never render, hence the static check.
3. 🟡 Cypress golden path `cypress/integration/golden_path.js` + `cypress.config.js` (runs via `bench --site <site> run-ui-tests omnitrack --headless`). Boots and reaches the login step; blocked because `ommnomi.local` has no `admin_password` in its site config. Run it on a dedicated test site (set `admin_password`). Covers: tabs render, book block, log session (API), approve. Not covered yet: clicking Start/Stop in the UI.
4. ✅ File-size gate `scripts/check_file_size.cjs` (500 lines, ceilings in `scripts/file_size_allowlist.json`, `--ratchet` lowers them). Current offenders: facade 4587, DashboardView 1949, SessionBox 1308, useWorkstationDashboard 680, CalendarView 664.

### Found during Phase 0 (fix in Phase 1)
- ✅ Fixed: App.vue wired the block and Raven drawers (and EOD "complete") to ~12 functions that never existed (`startSessionFromBlock`, `openRavenFromBlock`, `deleteSessionRow`, `submitBlockSession`, `showToast`, ...), so those actions were silent no-ops; arg order for edit/delete session was also wrong and DrawerCoordinator dropped the second arg. Now adapters in App.vue; `scripts/check_app_bindings.cjs` fails on any undefined template name. Block drawer actions verified statically only (no blocks today in the live site); Raven drawer → Plan verified in the browser.
- ✅ Fixed: the 25 props nobody passed (`attendanceLogs`, `displayDays`, `managerTimesheets`, timeline/adherence values, ...) were also unused in the templates, so they were dead and are deleted. All remaining view props moved to `useWorkstationContext`, the never-emitted `emits` were removed, and `ViewCoordinator.vue` is deleted (App.vue renders the four views directly). Browser: all 4 tabs render, no console errors.

### Phase 1 — Kill the bag-passing (Helpdesk pattern)
1. Replace the 480-name facade return with domain composables/stores used directly: `useSession`, `usePlanner`, `useTimesheets`, `useAttendance`, `useDashboard`, `useAssignments`, `useCollaboration`, `useTheme`. Each imports what it needs; no `opts` objects of 30 functions, no `typeof x === 'function'` guards.
2. Components call their composable (or `useWorkstationContext` as a stopgap), never prop-drill. ✅ Views done (ViewCoordinator deleted); DrawerCoordinator/dialogs still prop/emit.
3. Rule: composable deps are passed as functions or imported singletons, never as values declared later (no TDZ class).

### Phase 2 — Folder structure (feature-first, ≤500 lines/file)
```
src/
  features/{dashboard,calendar,timesheets,attendance,session,planner}/
     components/  composables/  api.js  index.js
  shared/{components,composables,utils}   (FDialog, FCombobox, …)
  app/{App.vue,router.js,providers.js}
```
- Split order: `useOmniTrackWorkstation.js` (4.6K) → per-feature composables; `DashboardView.vue` (1.9K) → ~10 section components (Hero/NowBlock, ClientMetrics, Timeline, Accomplishments, …); `SessionBox.vue` (1.3K) → header/timer/notes/binding parts; `CalendarView.vue` (663).
- One move per PR/commit-sized step, browser-verified each time.

### Phase 3 — Data layer on Frappe v16 idioms
1. Replace hand-rolled `postJSON` with frappe-ui `createResource`/`createListResource` (caching, loading/error state, dedupe).
2. Realtime via `frappe.realtime` wrapped in one `useRealtime` composable with cleanup.
3. Server: `services/query.py` hermetic ORM/`frappe.qb` layer + TTL cache + invalidation hooks (Track B); whitelisted APIs thin, permission-checked, `frappe.has_permission`/`get_list` scoped.
4. DocType naming/field governance migration (Track A) — only after Phase 0 tests exist.

### Phase 4 — OmniQuery/OmmNoMi product parity
- Same stack conventions as OmniQuery: Vitest + happy-dom `*.spec.js` beside source, `@/` alias, shared `FDialog/FCombobox/BaseModal` taken from one place (extract to a shared package or copy-with-sync, decide once), Dexie WAL for offline session start/stop, error-beacon telemetry, mutation tests in CI.
- Reporting: expose OmniTrack hours/adherence as OmniQuery data sources via the Track B service layer.
- A11y stays a gate (axe + keyboard/Esc/focus-trap invariants), dark mode tokens, mobile 375px check.

### Phase 5 — Release hygiene
- Build produces hashed assets (no stale-bundle surprises), `omnitrack.html` shell <100 lines, bundle-size budget, CHANGELOG, AGENTS.md updated with the gotchas above. Commit/push only on request.

### Order of work
Phase 0 → Phase 1 (dashboard first, as proof) → Phase 2 splits → Phase 3 → Phase 4/5. Each step ends with: `npm test`, mutation check for any new invariant, browser run of all tabs + dialogs with a clean console.

## Phase 2 progress: DashboardView split
- `DashboardView.vue` 1949 → 142 lines; ten section components in `src/views/dashboard/` (ClientPortal, HeroAgenda, AttentionTasks, DateSelector, Timeline, HappeningNow, UpcomingBlocks, PastBlocks, EodBanner, StatCards), each with its own `useWorkstationContext` list. Size ceiling ratcheted.
- Found: the Timeline's `ref="timelineScroller"` was never exposed to the view after the refactor (edge-shadow scrolling dead); now in the section's context list.
- `CalendarView.vue` 636 → 33 lines; `src/views/calendar/{AssignedTasks,PlannerGrid,WeekStats}`. Source-reading tests and the mutation target now follow the split files. Found: `plannerGridScroll` ref likewise had to be added to the grid section's context list.
- `SessionBox.vue` 1308 → 125 lines: `useSessionChat/Display/TodoPicker/Notes.js` composables + `SessionLogPane.vue` / `SessionControlsPane.vue`, wired by `provide`/`useSessionContext` (same explicit-names pattern as the workstation). Smoke test now starts a timer and renders the HUD (it was never rendered by any test); `check_sfc_ctx` understands `useSessionContext` (mutation-verified).
- Found: `blockTitle()` called an undefined `shortTime()` for untitled planned blocks (ReferenceError in the todo picker); now uses a local time formatter.
- **Facade split done:** `useOmniTrackWorkstation.js` (4587 lines) is now a 41-line composer over 15 `useWorkstation*` modules (all < 450 lines). Modules share one `w` bag (`Object.assign(w, {...})`); forward references use `lazy(w, name)` from `workstationBag.js`. `check_app_bindings` reads the `Object.assign` surface.
- Found: `session` falls back to a hardcoded personal email/name in `useWorkstationIdentity.js` when `window.OMNITRACK_SESSION` is missing. Remove before release.
- Next: useWorkstationDashboard.js (680), then UI/contrast pass, Phase 3-5.

## Progress — UI nativisation (this session)
- Done: Button/Badge/Card → frappe-ui + `.omni-card`; `FDialog` now an adapter over frappe-ui `Dialog` (reka-ui focus trap/Esc/scroll lock/return focus; safe initial focus kept). `check_contrast_tokens` guards low-contrast gray text.
- Done: UpcomingBlocks de-duplicated; secondary facts moved to hover `title`.
- Open: replace `FInput`/`FCombobox`/`FDropdownMenu` with frappe-ui `TextInput`/`Combobox`/`Dropdown`; extend de-duplication + hover details to PastBlocks, Hero, Calendar cards; Material-style polish (surface tokens, elevation, rounded-xl); migrate dialog bodies off the adapter to bare `Dialog`; remove hardcoded fallback email in `useWorkstationIdentity.js`.
- Done (2026-10-06): `FInput`/`FCombobox`/`FDropdownMenu` are gone. Every data list (teammate pickers in the planner rail, Timesheets and Attendance; the session's project and activity pickers) is now a searchable `Combobox`. `Dropdown` is kept only for short, fixed menus (the `SHORT_MENUS` allow-list in test 1; mutants 9 and 10 cover it).
- Fixed: planner prev/next drew their chevron in `#prefix` with no `icon` prop, so frappe-ui showed the label as text ("P…"/"N…"). A static guard and mutant 9 now cover this.
- Fixed: the planner rail filter tabs (emoji chips) overflowed the narrow rail. They are now plain text tabs that wrap. The card shows subject, project, and only an Urgent/High badge or an "Xh short" badge; planned/logged/expected hours and the id moved to the hover tooltip; Details and Discuss became icon Buttons.
- Fixed: the teammate Combobox can emit its display text ("Administrator (You)"), which went to `get_planner_data` as `employee` and blanked the calendar. `setSelectedEmployee` now accepts only known options, mapping a label back to its value.
- Fixed: opening `#/planner` directly (reload, bookmark) never fetched planner data, because `watch(activeTab)` only fires on change. It now also fetches in `onMounted`.
- Fixed: header tooltips were long sentences that repeated the button text. Tooltips are now a few words plus the shortcut, and "Alerts blocked" moved into the app menu.

### Dummy / test data on ommnomi.local
- Done (2026-10-07, run with a one-off bench-folder script, `cleanup_ommnomi_test_data.py`, removed afterwards): deleted 147 test Planned Work Blocks and 255 test ToDos. 134 blocks and 11 ToDos remain. The deleted items:
  - every block of `test_partner@ommnomi.local` and `test1@example.com`
  - "TDD Immutability Test Deliverables…", "Test block for sync mode Never" and "Collaborative Sprint" blocks
  - Administrator blocks with "Ad-hoc debug punch" notes
  - ToDos such as "test doctype", "sanity check from console", "Draft Q4 logistics SOP" and "Review cold-chain telemetry API"

  The owner's real block PWB-2026-00320 was kept. On 2026-10-07 the owner reverted its approval (made at 2026-10-06 20:56 as Administrator during testing) back to Draft. Its logged 1.44h is unchanged, and Logged shows it as "Awaiting approval". Backup taken before: `sites/ommnomi.local/private/backups/20261006_013326-ommnomi_local-database.sql.gz`.
- The "Collaborative Sprint" pairs point at each other through `paired_block`, so Frappe refused to delete either half. The script clears `paired_block` inside the same transaction first.
- Done (2026-10-07, second pass, on the owner's go-ahead): deleted six never-worked Administrator plans booked on the fake ToDos: PWB-2026-00007 to 00011 and 00318 ("Draft Q4 logistics SOP", "Review cold-chain telemetry API"). Also deleted 28 OmniTrack Work Session rows whose blocks (PWB-2026-00194 to 00222) an old test had removed with a raw delete on 2026-09-25. Now 128 blocks and 11 ToDos remain. No child rows are orphaned and no block points at a missing ToDo. Logged for this week went from 8.0h to 2.5h.
- Root cause to fix: these tests still write to the shared site and leave data behind. `tests/test_fac.py`, `test_collaborative_pairing.py`, and tests using `test1@example.com` (`test_timesheet_capture_perfection`, `test_block_notifications`, `test_temporal_governance`, `test_planned_work_block`) need tearDown cleanup with no commits, and should run on a throwaway site.
- Duplicate real ToDos, probably a double import ("invite all users of otc", "review data mapping sheet", "create the articulation A12345"). Owner to decide.
- Hardcoded fake people in code:
  - `api/workstation.py` adds a `standard_members` list (Alex Vance, Elena Rostova …) to the team, and its team query includes Guest and Website Users.
  - `useWorkstationIdentity.js` has a fake `teamMembers`/`hourlyPresence`, and falls back to "Hardik Sharma" as the current user.
  - `stores/collaborationStore.js` has a fake team list.
  - `useWorkstationShortcuts.js` has a fake team schedule.
  - Fix: query enabled System Users only.
- Open: the planner "All types" nature filter is multi-select, so it is still a `Dropdown`. Move it to a searchable multi-select.
- Open: re-verify every view at 375px (mobile) after this pass. Rail cards, the Combobox popover and the session pane pickers have not been checked on a phone yet.

### UI pass — overnight (2026-10-06)
- Fixed: **an active session vanished on reload if it started after local midnight but before the UTC offset (00:00–05:30 in IST) and had run 6h or more.** `restoreActiveSession`'s "prior-day zombie" check compared the session's start date in UTC (`toISOString`) with today's local date, so it read as yesterday and the session was evicted on both client and server (`sync_active_session(null)`). Both sides now use local dates. It killed one real 7h20m session with no log lines during this pass.
- Fixed (2026-10-06, by the activity split): the server default for `selectedNature` was still `"🎯 Planned"` (`api/stopwatch.py` `sync_active_session`, `useWorkstationSessionSync.js` restore). The current nature labels have no emoji ("Planned Work"), so this default matches no option. Normalise it to "Planned Work" (and migrate stored values).
- Open: zombie eviction on reload is silent: no toast and no "recover?" prompt. A session dropped for being stale should tell the user and offer to save it with an end time.
- Fixed: "Raven chat" opened `/app/raven`, which v16 redirects to Raven's **Desk workspace** (a DocType list), not the chat. It now opens `/raven`.
- Done: Raven moved off the header into the ☰ menu (owner's call; the header is now clock + menu). Added "OmniTrack Desk" (`/desk/omnitrack`) to the menu, hidden for client-portal users. Brand name enlarged to match the logo. Guarded by `test_mobile_navbar` test 2.
- Done: session HUD redesign. One frame, a clock card with a soft gradient, the log first on mobile, one-line "Logging to" binding, sentence-case labels, no emojis. Fixed a `<button>` nested inside the ToDo picker `<button>` (invalid HTML).
- Done: Timesheets rows open the block drawer (approve/flag inside it); the list shows a status badge only.
- Done: a frappe-ui `.dialog-overlay` has no z-index, so the sticky header (z-40) and the planner now-line painted over open dialogs. Fixed globally in `src/styles/main.css`.
- Open: `npm test`'s SPA smoke test runs against the existing `dist`, so it passes on a stale build. A Vite compile error (duplicate attribute in App.vue) went unnoticed this way. Make the smoke step build first, or fail if `dist` is older than `src`.
- Open (a11y): every planner hour slot is `tabindex=0`, which is 168 tab stops per week. It needs a roving grid (one tab stop, arrow keys move).
- Open: the `useWorkstationShell.js` fallback session (no `window.OMNITRACK_SESSION`) defaults `is_manager: true` with a real person's email. It should default to a non-manager with empty values.

### Plan dialog: time pickers and Google-style restyle (2026-10-06)
- Done: the plan dialog uses frappe-ui `TimePicker` for both ends. The End list starts 15 min after Start and shows each time with its length ("2:30 pm (1.5 hrs)"), like Google Calendar. Picking an end time lights the matching length chip. Guarded by `check_dialog_popovers.cjs` (mutant 18).
- Done: the gray `TabButtons` in the dialog became `ChoiceChips` (`src/components/common/ChoiceChips.vue`), a radio-group row of outline frappe-ui Buttons. Work is blue, Break green, Away amber. It has one tab stop, and the arrow keys and Home/End move the choice (mutant 17). Fields are outlined white and Save is solid blue.
- Fixed: every frappe-ui popover (the TimePicker list, DatePicker calendar, Combobox) opened **behind** its dialog once `.dialog-overlay` was lifted to z-50. reka writes `z-index: auto` inline on `[data-reka-popper-content-wrapper]`, so the fix in `main.css` needs `!important` (mutant 15).
- Fixed: Escape in an open TimePicker list closed the whole dialog. The cause was the document Escape handler `onPlannerKeydown` (`useWorkstationEod.js`), which now skips `e.defaultPrevented` (mutant 16). `FDialog` also ignores a close while a popover owns the Escape.
- Open (upstream candidate): `TimePicker` drops every attr (its Popover has `inheritAttrs: false`), so its input cannot get an `aria-label`. For now the visible placeholder ("Start"/"End") is its only name.
- Open (upstream candidate): after a TimePicker option is picked, focus falls to `<body>` instead of returning to the input. Keyboard users lose their place.
- Seen once, not reproduced: Start jumped to 3:30 after an End time was picked with a coordinate click. It did not happen again, including on mobile. Watch for it.
- Open: picking several tasks for one block (click the row's checkbox to multi-select, click the row body to pick just one). Proposal: a child table on Planned Work Block, with the first task kept as `work_item`. Waiting for the owner's view.

### Session popup: task list instead of "Working on" (2026-10-06)
- Done: the session popup's "Working on" Combobox is gone. It now shows the same `BlockTasksSection` a block shows. Bound to a block, it lists that block's tasks. Unbound, it lists the session's own tasks (`sessionTasks`, synced across devices), and Stop puts them on the new block (`quick_timer_punch` → `attach_session_tasks`). A session task opens the one `TaskFormDialog` (`onRemove` / `onChange`), so it moves through its workflow the same way everywhere. Guarded by `check_dialog_popovers.cjs` sections 13–15, with mutants.
- Fixed: on phones the three session tools (Discard / Adjust / Stop) were off centre. frappe-ui keeps the hidden label's wrapper and its 8px gap. Under 480px they are squared to 28×28 (`TOOL_SQUARE`).
- Fixed: one Escape closed both the Add tasks dialog and the session popup under it. `FDialog.keepEscape` stops the Escape at its panel and closes the dialog itself (reka's own close listens on the bubble path, so it never sees it).
- Open: `sessionTasks` are dropped when an unbound session is bound to a block mid-session, and when a bound session stops. `switch_active_session` does not carry them either, and nor does `writeEntry`'s `quick_timer_punch`.
- Open: ticking a session task does not close its ToDo until Stop.
- Open: `src/session/useSessionTodoPicker.js` is now unused. Delete it (waiting on the owner's OK). `SessionBox`'s `assignedTasks` / `workBlocks` props and the workstation-level ToDo picker (`assignmentStore`, `useWorkstationIdentity`) may be dead too.
- Open: in nested FDialogs, the outer dialog's `noteEscape` still fires `escBack` for the inner dialog's Escape.
- Done (Issue #17): **"Planned" is no longer an activity.** See the next section.

### Activity is Work, Break or Away (2026-10-06)
- Done: `task_nature` holds one plain kind: **Work, Break or Away**. Meeting and Review were work under another name. Leave and Absent were both time away; the owner asked for "only break and away". Planned-ness is the block's read-only `unplanned` Check. `quick_timer_punch`, its pairing partner and `log_work_session`'s auto-created block set it; a block made in the planner is a plan. The KPIs, the day timeline, analytics PAI and the workstation PACI all read the flag.
- Done: one mapping in `omnitrack/utils/activity.py` and `src/utils/activity.js` (`to_kind` / `toKind`). Every stored, remembered or emitted value goes through it, so a stale browser or a live session's stored default never needs patching. Patches `v1_5.split_activity_from_planned` and `v1_5.merge_activity_into_work_break_away` rewrote stored rows. On ommnomi.local that left 280 blocks and 305 sessions, all Work; 20 blocks carry `unplanned=1`. The 6 Meeting rows became Work.
- Done: the session picker shows "Break" / "Away" without the "(Non-Paid)" suffix. The block pill, the calendar away band and the card colour no longer tell Absent apart from Leave. The plan dialog's second Activity chip row is gone, because its Work / Break / Away chips already are the activity.
- Guarded by `scripts/check_activity_kinds.cjs` (kind parity across py/js/DocTypes, to_kind vectors, the flag being set, the readers using it, no legacy literal, both patches registered), plus 13 mutants. There was no guard before, which is how "🎯 Planned" outlived its option.
- Open: the Desk chart is still named "OmniTrack Work Nature Distribution". Rename it "Activity" (it is a fixture, so the rename needs a re-export).
- Open: `omnitrack/doctype/` is a stale copy of `omnitrack/omnitrack/doctype/` with the old emoji options. Nothing loads it; delete it (waiting on the owner's OK).
- Fixed: in the session popup, Escape on an open Combobox (Activity, Project) closed the list **and** minimized the popup. `_slashFocus` (`useWorkstationShortcuts.js`) now returns on `ev.defaultPrevented || popoverOpen()`. `defaultPrevented` alone did nothing here: reka's Combobox closes without `preventDefault`. Verified live: the first Escape closes the list and the popup stays, the second minimizes it. Guard 16 in `check_dialog_popovers.cjs`, plus a mutant.
- Fixed: Combobox / Dropdown / TimePicker lists looked blurry. reka places the portalled wrapper with a half-pixel `translate()` and writes `will-change: transform` inline, so the list was a raster layer resampled off the pixel grid. `main.css` sets `will-change: auto !important` on the wrapper; `check_dialog_popovers.cjs` guards it, with a mutant.
- Fixed: the planner's activity filter was announced as "Filter calendar events by nature".

### Task form and idle prompt, redone (2026-10-06)
- Done: the To-do / Task form follows Frappe CRM's task modal. Name, then one row: status (a menu of the workflow moves open to you), due day, priority. The grey status panel, the wall of outlined move buttons, the separate "Open" status text (now on hover), the left icon gutter and the resizable textarea are gone. A move still asks first, with an optional comment. From the keyboard, focus lands in the comment box, Escape steps back to the status button, and a second Escape closes the form. Checked at 375 px.
- Done: "Are you still working?" is one question and one sentence: "No note since 15:23, 47 min ago. The timer has run 3 h 34 min." The answers are Stop now / Stop at 15:38 / Still working. Discard appears only after 60 minutes, on the left in red. The tinted alert box, the key-value card and the "(+15m)" suffix are gone; the suffix is now a tooltip. It names the block's task, never the session notes (it used to print the notes, check marks included).
- Open: the prompt's subtitle is empty for a session that has no block. Name the session's first task once the session tasks list is the source of truth.


### Session popup: Details tab and Material tabs (2026-10-06)
- Done: a Details tab beside Log and Task chat. It is the block drawer itself (`BlockDetailDrawer` with `inline`), not a second component: facts only, with no sheet, title, actions, task list or discussion, because the popup already has those. Open block minimizes the popup and opens the full drawer. Unplanned sessions show one line, not the clock again. Left/Right wrap and Home/End move between the three tabs, and an unknown tab falls back to the Log. Guard 17 plus two mutants.
- Fixed: the tab focus ring was an outer ring on an unpadded label, and the bar's underline clipped it into a broken box round "Log 5". The tabs are now Material primary tabs: a padded target, a hover tint, an inset focus ring, and a shared 3px indicator under the active tab. The Log count is blue only while its tab is active. Guard 18 plus a mutant.
- Fixed: opening the session drew a blue ring round the popup's contents. That was `sessionCardFlash`, a "here it is" pulse from before the popup existed. Opening the popup already marks the moment, so the flash is removed everywhere (SessionBox, SessionOverlay, App, the pickers, the store). Guard 19 plus a mutant.
- Open: three other hand-rolled tab bars (`WorkstationBottomNav.vue`, `CalendarAssignedTasks.vue`, `DashboardAttentionTasks.vue`) should share this one Material tab look. Move all four to frappe-ui `Tabs` once its trigger has a visible keyboard focus. In 0.1.278 its default trigger has none, and its list pads 20px from the edge (see AGENTS.md).
- Done: `BlockHoverCard.vue` has no emojis left, and its footer shows only the ERPNext Timesheet reference (the day is already on screen).
- Done: the demo `timelineMembers` emojis are gone with the rest (see the glyph sweep below).
- Open: `src/stores/workSessionStore.js` is not imported anywhere. Either wire it in or remove it (removal needs the owner's go-ahead).


### No glyphs, readable cards, statuses that agree (2026-10-06)
- Done: every emoji and pictographic glyph is gone from what a person reads: the SPA, the Desk script (check mark and caret are now Frappe sprite icons), service-worker notification actions, heatmap badges, Raven recaps and API text. `scripts/check_no_glyphs.cjs` (in `test:static`) fails on any new one; two mutants. Stored recaps written before this still start with an emoji. `collaborationStore` reads them through escapes and the new marker "finished a session" and never writes one.
- Fixed: the recap filter never matched the stopwatch recap, so session recaps showed as ordinary chat. It now matches the new marker and the legacy glyph.
- Done: the switch dialog is "Switch to the next session": running section, a labelled frappe-ui `Textarea` "What you did" (no native textarea), next block or task, "Keep current" and "Save and start next". Test 37.
- Done: "Up next" reads as overline, title and time line on a plain card. Its primary button is solid blue-700, because frappe-ui's subtle blue Button is about 4.1:1 and fails AA. Every start button now says "Start session" with the play icon.
- Fixed: a past block that logged nothing said Missed, "Concluded 330m early", "Verified" and "1 completed" all at once. Variance now needs logged time, "Verified" is gone, and the header counts "done" (logged) and "missed" (nothing logged) separately. Notes that equal the card title are no longer shown a second time. "Show full details & breakdown" is "Show more".
- Fixed: the concluded grid's arrow keys skipped columns. Navigation now reads the DOM. Verified with real keys.
- Fixed: the Desk bundle 404'd because its hashed `dist/js/omnitrack.bundle.*.js` had been deleted while `assets.json` still pointed at it. `bench build --app omnitrack` regenerated it.
- Done: "Day at a glance" offers 3h, 6h, 12h and 24h on every screen, and phones (under 640px) open on 3h. The rule lives in `src/utils/timelineZoom.js` and is tested by running it (`scripts/check_timeline_zoom.mjs`, two mutants). The zoom chips are 12px with 24px targets (were 10px and 19px).
- Open: hashed `omnitrack/public/dist/js/*.bundle.*.js` files are tracked in git, so every build churns them. Untrack them and ignore `public/dist`.
- Fixed: the day subtitle said "0.0h logged" over a timeline legend saying "Logged 5.7h". The subtitle summed planned blocks only, while the legend also counts unplanned and running sessions. The subtitle now names the day and its block count, and the legend alone states the hours. Guarded in `check_timeline_zoom.mjs` with a mutant.
- Open: a block later today (7:30 PM, viewed at 6:20 PM) shows under "Done today" as "Logged (Full)" and "On plan" because a session was logged against it early. Decide whether time logged before a block starts counts as doing that block.
- Open: the live timeline bar says "(Recording...)" and "REC" in the same 10px pill. Keep one.
- Open: the EOD 8h target is hard-coded. Make it an OmniTrack Settings field.
- Open: `raven_bridge.post_session_accomplishment_recap` puts session-log text into Markdown unescaped. Escape it.
- Open: `CancelWorkBlockModal` still has a native textarea and 10px text.
- Open: `getBlockTimingInfo` pills (rose-600, slate-600 on tints) need a contrast check.
- Open: the Desk stopwatch settings menu's `menuitemradio` items have no `aria-checked`.
- Open: the hover card shows 24h times ("02:30–08:00") while cards show 12h. Use one format.
- Open: the CSS bundle is 4.7 MB, likely from inlined fonts.
- Open: socket.io on port 9003 refuses connections on ommnomi.local. Check the socketio worker.
- Open: the stop path writes session notes with "•" bullets that later code has to strip. Store plain lines.

### Entry sheet, task workflow, Undo approval (2026-10-06, late)
- Done: a logged bar opens the entry's own sheet (`SessionDetailDrawer`), never a form. It handles an entry with or without a planned block, and with or without tasks. One `get_work_session` read per open.
- Done: the sheet's tasks show where each document stands (`_with_workflow` in `timesheet.py`, readable tasks only) and offer that task's workflow moves. A move opens the one task form (`TaskFormDialog`) at its confirm step (`openTaskForm(t, { ask })`). It never runs a move directly. Verified with real keys: roving Up/Down/Home/End/Left/Right, Enter opens the menu, and a pick lands on "Approve? It moves to Approved." Cancel leaves the task unchanged.
- Done: task names in the sheet wrap in full. Planner block titles wrap to the lines the block has. A split lane drops its time line to the hover card.
- Done: managers get New task in the bottom bar as well as Team. The bar is a navigation landmark with `aria-current`, not a tablist.
- Done: Approve shows "Entry approved" with Undo for 5 seconds. The toast waits while it is hovered or focused. The server keeps what the approval replaced for 30 s (`_remember_review`). `undo_block_approval` restores it only for the approver, only while the block is still as they left it, and removes a draft Timesheet the approval made (it refuses a submitted one). Toast verified in the browser. The server undo is guarded and mutation-tested, but an actual approval was not exercised on ommnomi.local.
- Fixed in the JSON, needs a sync: `approval_status` had no "Flagged" option in the live DocType, so every Flag was rejected on save. The option is added and `modified` is bumped. It needs `bench --site ommnomi.local migrate` (or `reload-doctype "Planned Work Block"`) by the owner.
- Open: there is no way to take back an approval after the Undo window. Decide whether a manager can re-open an approved entry.
- Open: approval is per block, not per entry. A block with two entries is approved as one.
- Done: every screen now reads a Flag's reason from `approval_notes` (`src/utils/approval.js`, one wording for the calendar dot, the block's accessible name and the hover card). The calendar feed (`planner.py`) never sent `approval_status`, so every logged block in the calendar read as awaiting approval, approved ones included. It now sends `approval_status` and `approval_notes`, as do the dashboard and pending-approval feeds.
- Done: the hover card shows the full title and project, and says where the entry stands in review. It is placed by its measured height, never under the bottom bar's session button (it used to guess 85 px and covered the timer). The block drawer's task names and the entry sheet's project and person no longer cut off.
- Done: the second, unused workflow path is gone (`getTaskWorkflowMenuItems`, `promptWorkflowAction`, `submitWorkflowAction`, `showWorkflowModal` and its refs, the outside-click and Escape hooks, and the `TaskWorkflowModal` wiring in `DialogCoordinator`, `App.vue` and `main.js`). Interaction Test 2 now checks the two menus that replaced it, `statusMenu` (task form) and `taskMoves` (entry sheet): no next-state text, red for destructive moves. Two mutants guard it.
- Open (owner's go-ahead): `src/components/dialogs/TaskWorkflowModal.vue` is no longer imported anywhere and can be deleted.
- Corrected: `SwitchTaskModal.vue` is reachable (the switch button on the "Happening now" card) and `selectedDashboardDateLabel` names the timeline for screen readers. Neither is dead. The `pushManager.subscribe` call has no `applicationServerKey`, so Chrome refuses it. It stays until the phone-push decision below.
- Verified (2026-10-06): the entry sheet closes on Escape and on a scrim click, and both hand focus back to the logged bar that opened it.
- Done: the mutation suite mutates and tests a temp copy of the app and refuses any mutant aimed at a served file. Verified: 180 of 180 killed, web PIDs unchanged, served files' mtimes unchanged. Before this, every Python mutant restarted the dev server, and the run inside the pre-push hook (2026-10-06 22:08) left the web process truncating every large response (`Errno 9 Bad file descriptor`), so the page stayed bare HTML until a full `bench start` restart (AGENTS.md has the check).
- Open: `omnitrack.bundle.css` is 4.7 MB. (The "5 s" was macOS mDNS lookup of `.local` in curl, not the transfer, which takes about 10 ms.) Purge unused Tailwind and frappe-ui classes before production.
- Done: the calendar's approval dot no longer carries a `title` nobody can see; the block's name takes `approvalLabel`. The entry sheet's chip and line come from `approvalState` (with a `short` form for the chip), so the screens use one wording.
- Done: the entry sheet re-reads only when its own block comes back different from the dashboard feed (`blockStamp`), or when a task opened from it is saved or moved (`onChange`). It used to re-read on every timed refresh.
- Open: "Upcoming focus blocks" offers Start session on a block that is already Logged (Full). The block sheet says 0h of 1.5h while it lists a session. "Close your day" figures disagree with Today.
- Done: vocabulary. The app no longer says a bare "timesheet": Work Session (one recorded run), block, "Logged time" (the tab and page) or "ERPNext Timesheet" (the billing document). `scripts/check_vocabulary.cjs` fails `npm test` on a bare "timesheet" in any SPA string or template text; three mutants guard it. Mutation suite: 183 of 183 killed.
- Open: the Python API's messages (`frappe.throw`, `msgprint`) are not scanned for bare "timesheet" yet.
- Done: the block sheet takes focus when it opens (its Close button) and hands it back to the row that opened it, as the entry sheet does. Before this, Escape left focus on `<body>`. The inline details in the session popup never move focus. Guard in `check_block_reminders.mjs`, three mutants. Verified in the browser on the Oct 5 block in Logged time: Enter opens it with focus on Close, Escape returns focus to the row.
- Open: Logged time lists tomorrow's planned block as "Not logged". A future block should be left out, or say Planned.
- Done (verified): the block sheet of a past block (Oct 5) offered Start session. Start session now shows only on today's block (`canStart`). Guarded in `check_dialog_popovers.cjs`, with a mutant.
- Done (verified): the block sheet's empty line repeated "session". It now reads "Nothing logged yet. Start a session, or add one from More.", and a block that cannot be started says only how to add one.
- Open: phone push. The page plays a chime, but a closed app gets nothing. That needs FCM (Firebase) through the Frappe push relay, which means a new dependency, so it waits for the owner's decision. Production also needs deploying, the scheduler and the relay enabled.

### Tasks are ERPNext Tasks; tracking serves the Project (2026-10-06, night)

Owner direction, verbatim in substance: the Frappe ToDo is of no use as a task. It has no planned date, no description, no CC and none of what a task needs. Expected hours belong to the ERPNext Project, which holds milestones and the Tasks connected to them. Work tracking is not only time management. It is how the Project is managed better. Recorded in `docs/DOMAIN_MODEL.md` section 3.

- Done (in the working tree, not verified end to end): the bottom bar's "New task" is gone. It only opened the plan dialog under a task's name. Its place is a Tasks page (`src/views/TasksView.vue`, `#/tasks`, Shift+T) for everyone. It groups work into Overdue, Due today, Not planned yet and Planned, with search, a project Combobox, a person Combobox for managers, one tab stop with arrow roving, and the shared task form, plan dialog and start flow. The header menu item now says "Plan a block". Guards are in `check_block_reminders.mjs`, with six mutants.
- Open, blocked on owner: **install ERPNext** (at least its Projects module) on the bench and on `ommnomi.local`. There is no ERPNext checkout on this machine, and no site has it. Until then the Tasks page can only show ToDos, which is the thing the owner rejected.
- Open, after ERPNext: rebuild the Tasks page as Project, then milestone, then Task. Each project shows planned and logged hours against `expected_time`, plus percent complete. Each task shows its planned start, due date, description on hover, assignees and dependencies. Drop standalone ToDos from `get_assigned_tasks` (`omnitrack/api/tasks.py`). Keep a ToDo only as the assignment that points at a Task.
- Open, after ERPNext: "CC" on a task. A Task has no CC field. Candidates are more assignees (`_assign`), the Project's users table (Project User), or Frappe's document follow. Decide with the owner before building.
- Open, after ERPNext: create a Task (with project, milestone, dates and estimate) from OmniTrack without leaving it. Today the only way in is Desk.
- Open, after ERPNext: **reassign a Task** from OmniTrack. The owner listed this among the things a ToDo cannot do. Use Frappe's own assignment API (`frappe.desk.form.assign_to`: `add`, `remove`, `close`). It closes the old person's ToDo, opens the new one's, notifies both, and keeps `_assign` on the Task in step. Never write `allocated_to` by hand. Open questions: who may reassign (the manager, the project's users, or the assignee handing work back), and what happens to the old person's future Planned Work Blocks for that task (keep them, move them to the new person, or flag them for re-planning). Logged Work Sessions always stay with whoever did the work.
- Open: `get_assigned_tasks` runs one `frappe.db.get_value("Project", ...)` per task. Batch it when the Project layer is live.
- Open: the planner rail (CalendarAssignedTasks) and the dashboard's attention list overlap the Tasks page. They should share one list component.
- Open: completed tasks are not shown anywhere in the SPA.
- Open: the bottom bar's active `!text-blue-500` and dark inactive `!text-gray-600` may fail contrast. Measure them.

### Project management basics, all inside OmniTrack (owner, 2026-10-06, night)

Owner direction: everything basic to managing a project well is done here, not in Desk. ERPNext's Projects module is the data layer (Project, Task, Project Template, Project Update, Activity Type). OmniTrack is the place people work in. It never keeps a copy of ERPNext data. Each line says what OmniTrack has today.

| Basic | Native record | OmniTrack today |
|---|---|---|
| A list of projects, each with status, dates, % complete and health (on track, at risk, late) | Project | Nothing |
| Breaking work down: milestone, task, subtask | Task `is_group` / `parent_task` / `is_milestone` | Nothing |
| A full task: description, planned start, due date, estimate, priority, attachments | Task | Task form edits workflow state only |
| Assign, reassign, more than one person, followers (CC) | `assign_to`, `_assign`, follow | Assignment comes from Desk only |
| Dependencies: blocked by, blocking, and a warning when planning ahead of a blocker | Task `depends_on` | Nothing |
| Planning time against tasks | Planned Work Block | Done: blocks, calendar, plan dialog |
| Recording work | Work Session | Done: sessions, notes, approval |
| Estimate against planned against logged, per task and per project | Task `expected_time`, rolled up on Project | Per task only, in the attention list |
| Workload: each person's planned hours against their week | Planned Work Block per person | Partly: the Team view and adherence figure |
| Timeline (Gantt) of milestones and tasks | Task dates | Nothing |
| Discussion on a task or project, with mentions | Comment, Raven | Partly: the Raven drawer on a block |
| Status updates on a project (what moved, what is stuck) | Project Update | Nothing |
| Issues and risks tied to the project | Issue (`project`) | Nothing |
| Reports: time by project, person and week; variance; overdue | Built from the above | Partly: Logged time and the week figures |
| Starting a project from a template | Project Template | Nothing |
| Closing out: tasks done, time approved, and billing (ERPNext Timesheet) when it applies | Project, Timesheet | Approval done. Billing waits on ERPNext. |

Order once ERPNext is installed:
1. Projects page.
2. The Tasks page by milestone, with the full task form, create, reassign and dependencies.
3. Estimate against planned against logged.
4. Workload.
5. Timeline.
6. Project updates and issues.
7. Reports.
8. Templates.

Each step reuses frappe-ui and the existing roving list, form and plan patterns. Each step gets its guards and mutants.

### Projects page: built on OmniTrack's client and team access (2026-10-06, night)

Owner direction: OmniTrack already lets a client be added as a project user and see that project's data. The Projects page builds on that, and keeps the platform simple, secure and collaborative.

Who sees a project today (`omnitrack/permissions.py`, `api/workstation.py`):
- Managers (OmniTrack Manager or Admin, System Manager, HR Manager) see every project.
- The project's owner, and anyone in its **Project User** table, see it. That covers team members and client users alike.
- A client (OmniTrack Client role) sees a project whose Customer has a Contact linked to their user. Clients see only tasks marked `custom_is_public_deliverable`.

Plan: one function, `projects_for(user)` in `permissions.py`, answers "which projects may this person see". The Projects page, the block permission query and `get_workstation_data` all use it, in place of three hand-copied versions. A client sees status, % complete, milestones, public deliverables, and logged hours where the project allows it (Project User `hide_timesheets`). They never see internal tasks, other clients or anyone's personal week.

Found while reading, and where each stands (2026-10-07):
- Done (security): the Task and ToDo permission queries escape the user id (`frappe.db.escape`, `%` and `_` escaped in the `_assign` LIKE pattern).
- Done (bug): the dead `Project.customer = <user id>` branch is gone from the block query and `get_workstation_data`. The Contact join is the one path, inside `projects_for`.
- Done (security): on a site without ERPNext, a client no longer reads every block that has a project. `projects_for` returns no projects and the query denies.
- Done (security): the page boot (`www/omnitrack.py`) loaded today's blocks with `get_all`, skipping permissions. The client branch read every block of the day and the fallback read everyone's. Neither result was ever rendered. Removed, together with a second full `get_workstation_data` load that nothing showed.
- Done (bug): the `"CampusCredit"` fallback for a client with no project is gone. A client with no shared project sees no blocks. The client portal's hard-coded "CampusCredit CATMA" chip and vendor name are gone too. `scripts/check_projects.mjs` fails on any customer name in the code.
- Done: `projects_for(user)` is the one rule, used by the block query, opening one block, the workstation and the Projects page.
- **Behaviour change the owner must act on:** the CampusCredit client users now see no blocks until a real Project exists for them. Create the Project (and PROJ-0015, which 20 old blocks name but which does not exist). Then link the client's Contact to the Project's Customer, or add them as a Project User. That is the owner's data to enter.
- **Owner decision:** a client's block visibility uses `include_assigned=False`. Being assigned one task on a project does not show everyone's blocks on it. Confirm or change.
- Open: `custom_is_public_deliverable` on Task and ToDo is a custom field that nothing in the app creates. Add it as a fixture or in `install.py`, and give the task form a "Visible to the client" switch. Until then a client sees no tasks (the code denies when the column is missing).
- Open: `omnitrack/importer.py` still names the company "OmmNoMi Automation LLP" and a cut-off date. It is a one-off import script for this owner's history. Move it out of the shipped app, or read both values from settings.
- Open: `useWorkstationIdentity.js` defaults `selectedEmployee` to the literal name "Hardik Sharma" when the boot has no full name. Use the user id instead.

Bench note: `bench get-app erpnext` (2026-10-06) rewrote `sites/apps.txt` from the `apps/` folder and added `omniservey`, which is in `apps/` but not installed. Every bench command then failed importing it, and so did the ERPNext asset build. The owner approved removing the line, and it is done.

### Projects page shipped (2026-10-07)

`src/views/ProjectsView.vue` and `omnitrack/api/projects.py`. It appears in the bottom bar only when the site has the Project DocType (`has_projects` in the boot).
- The list shows each project's title and one meta line: customer, due date and open tasks. A Late or At risk badge sits beside it, with the reason on hover and for screen readers. Percent complete is a labelled progressbar. Estimate, planned and logged hours show on hover.
- Status tabs: Open (default), On hold, Completed, All. They share the Material tab look with the session pane through `src/utils/materialTab.js`. The count shows only on the selected tab, so four tabs fit at 375px.
- The order is: Late, then At risk, then the nearest end date.
- Opening a project shows its tasks in outline order, each subtask under its group task (milestone). Overdue tasks are marked. A task opens the one task form. A client reads the tasks but cannot open the form.
- Keyboard: the list, the task list and the tab bar are each one tab stop. Arrows, Home and End move within them.
- Clients see only shared deliverables and never see planned hours. Logged hours are hidden where their Project User row has `hide_timesheets`.
- Guards: `scripts/check_projects.mjs` (in `npm test`) plus 13 mutants.
- The bottom bar's 10px labels were blue-500 on white (3.7:1) and gray-600 on the dark bar (about 2.4:1). They are now blue-700/blue-300 and gray-700/gray-300.
- Verified in the browser at r=145 to r=148. I checked the empty state on the real site. Sample rows and tasks were injected in memory only, and nothing was written. I checked keyboard roving, the dialog, and mobile 375px in dark mode.

Follow-ups:
- The bottom bar now has six destinations plus the Log button at 375px, and each still fits (43 to 61px). Material recommends three to five. When the Tasks page becomes Project, then milestone, then Task, consider folding Tasks into Projects for teams that use Projects.
- A client's home is still the old "Project Pulse" portal (`DashboardClientPortal.vue`). It has uppercase micro-labels, gray-600 text on dark, and a pulsing dot. Make the Projects page the client's home and retire the portal.
- Create a project and a task from OmniTrack. Today they are created in Desk.
- A project-level discussion (Comment or Raven), and Project Updates.
- The CSS bundle is 4.7 MB (gzip 3.4 MB). Find what Tailwind is emitting (a safelist or a wide content glob) and cut it.

### Fixed: opening the app after midnight silently ended an evening session (found and fixed 2026-10-07)

`restoreActiveSession` (`useWorkstationSessionSync.js`) evicts a session as a "zombie" when it started on an earlier local day and has run for 6 hours or more. It also evicts any session over 10 hours. It does this with no question and no toast: it clears the local copy and posts `sync_active_session(null)`, which deletes the stored session on the server for every device.

What happened: the owner's session started 2026-10-06 at 20:39. It had no block and one ToDo ("Manage icons and add missing home/dashboard file to FAH workspace here"). At 04:29 I reloaded the page to check the Projects page. The rule fired, and the session's start time is gone from the server. Nothing had been logged from it. The ~7.8 hours have to be logged by hand if they were real work.

Fix:
- Never discard without asking. Treat a long or overnight session like the idle prompt: "This session has run since 20:39 yesterday. Log it up to the last activity, keep it running, or discard it." Default to the last activity, not the full span.
- Never clear the server copy from a page load. Only an explicit person's choice may do that.
- Guard and mutant: `restoreActiveSession` contains no `sync_active_session` call with `null` unless that call follows a choice the person made.
- Note, corrected: `lastActivityTime` is written into the stored copy on every session sync, which happens when a note or task changes. That session had no edits, so its last activity was its start. "Last activity" is therefore the last note, which is the wording the dialog now uses.

Shipped (owner agreed: "ask instead of evicting"):
- `restoreActiveSession` has no age limit and never calls `sync_active_session`. A long or overnight session is restored, and the still-working dialog offers: stop at the last note, keep it running, or discard it.
- `get_active_session` (`api/stopwatch.py`) only reads. It no longer deletes a day-old session.
- The dialog names the day ("21:05 yesterday") for both the last-note time and the Stop at time (`clockLabel` in `useWorkstationSessionClock.js`).
- Guards: `scripts/check_session_restore.mjs` plus 5 mutants. `omnitrack/tests/test_stopwatch.py` covers the read-only rule; run it on a throwaway site, never on ommnomi.local.
- Not yet checked in the browser with a real overnight session, because starting one to test is off limits on the owner's site. Check it the next time a session runs past midnight.

## One app, configured per customer (owner direction, 2026-10-07)

Owner: "make OmniTrack one simple software for managing the full team, for teams of different size and different nature, based on the configuration of this app for each customer."

Audit of today's settings:
- OmniTrack Settings has 46 fields. 15 are never read by any code.
- The 13 `enable_*` flags are read only by `get_system_status` (`api/analytics.py`), which the app never calls. They switch nothing. AGENTS.md said "keep all features toggleable via OmniTrack Settings", and the result is switches that do nothing.
- Other configuration DocTypes: OmniTrack Workspace (linked customer, branding, `allow_*` flags), OmniTrack User Entitlement, OmniTrack Project Policy.

Proposal: a few plain choices, each of which changes what people see.
1. **How work is organised:** Projects and tasks, or Tasks only, or Shifts. This picks the pages in the bar and the words used.
2. **Who reviews logged time:** no one, the person's manager, or the project manager.
3. **Do clients see their projects:** off, or on (Project Users and the Customer's contacts, as `projects_for` defines).
4. **Where hours go:** OmniTrack only, or OmniTrack and ERPNext Timesheet.

Team size is not a setting. The app adapts to the team:
- People pickers appear only for managers.
- The project filter appears only when there are more than two projects.
- Team is for managers only.
- Projects appears only on a site that has Projects.

Next steps:
- Build the four choices on OmniTrack Settings. This is a schema change, so it needs a migrate the owner runs.
- Remove or wire the 15 unread fields and the 13 decorative flags.
- Add a guard: every OmniTrack Settings field is read somewhere in the code.
- Employee goals: Frappe HR is installed on ommnomi.local since 2026-10-07 (owner: "yes install"), so Employee Goal and Appraisal now exist. Show a person's goals beside their work only when the DocType exists.
- Done: the owner completed ERPNext's setup wizard on ommnomi.local, with its demo data.

## Clients see the people and tasks you choose (2026-10-07)

Owner: "it depends on the task and person visibility to the client."

The rule (`permissions.client_block_condition` / `client_may_see_block`): a client sees a Planned Work Block when all three hold.
1. The block's project is shared with them (`projects_for`, with `include_assigned=False`).
2. The block's person is visible to clients: an OmniTrack User Entitlement row with **Visible to Clients** names their user or one of their roles.
3. If the block names a task, that task is **Shared with Client** (`custom_is_public_deliverable`). A block with no task follows rules 1 and 2.

On a shared task, a client sees only the visible people among its assignees.

- Secure default: nobody is visible until the owner turns it on, so today clients see no project blocks. The field needs `bench --site ommnomi.local migrate` (the owner runs it).
- `install.py` now creates the Task and ToDo "Shared with Client" field (it was referenced but never created), only where the DocType exists.
- Guards: `scripts/check_projects.mjs` plus 9 mutants.
- Simulated read-only before the migrate: with one person made visible, the CampusCredit client would see 9 blocks, all without a task.
- Later: a per-project override ("visible on this project only"). Today visibility is per person across every project they share with a client.

CampusCredit (owner: "Create it") exists as a Customer and Project, with its client users as Project Users. `welcome_email_sent=1` was set on each row so ERPNext sent no emails.

Bug fixed: the project detail returned 417 ("Invalid field format in Order By"). Frappe 16 refuses an expression such as `exp_end_date is null` in `order_by`, so tasks are now sorted in Python (soonest due first, undated last). `check_projects.mjs` fails on any `order_by` expression in the app.

## Works without ERPNext and Frappe HR (2026-10-07)

Owner: "build OmniTrack so it also works independent of ERPNext and Frappe HR."

An audit of every reference to an ERPNext or Frappe HR DocType found these, now fixed:
- Saving a Planned Work Block, an OmniTrack Workspace or a Remote Connection failed on a plain Frappe site, because their Project, Task, Timesheet and Customer links point at DocTypes that are not there. Frappe checks links before `validate`, so the controller cannot skip them. A mixin (`omnitrack/utils/optional_links.py`) keeps such a value as plain text; every other link is still checked.
- **Security:** the sync receiver (`omnitrack.sync.receive_sync_event`) is open to guests and verified nothing, so anyone could create or change Tasks. It now refuses any payload that an Active Remote Connection's HMAC secret did not sign (constant-time compare). The sender no longer falls back to a built-in `"default_secret"`. With no secret set, it stops and writes the reason on the connection.
- **Security:** `synthesize_employee_attendance` was whitelisted for any signed-in user, and it writes Attendance for anyone. It now needs an OmniTrack Manager. The scheduler's internal calls use `_synthesize`.
- The synthesizer, Task workflow actions and the Desk workspace content now check that Employee, Task, Employee Checkin and Attendance exist before using them.
- Guards: `scripts/check_optional_apps.mjs` plus 10 mutants.

Still open:
- OmniTrack Attendance Synthesizer Log (`employee`), OmniTrack Project Policy (`project`) and OmniTrack Shift Split Assignment (`employee`) have required links to Employee or Project. On a plain Frappe site they cannot be saved. Hide them from the workspace there, or link the person by User.
- `omnitrack/api/__init__.py` holds two hooked functions (`mark_past_unworked_blocks_missed`, `validate_task_variance`) that were not audited, because reading that file needs the owner's permission.
- Test on a real Frappe-only site: create a fresh site with only frappe and omnitrack, then book, log and approve a block.

## Activity on every details panel; Raven only for projects (2026-10-07)

Owner: a work block is not a Raven channel. Raven belongs to the Project, its Milestones and its ERPNext Tasks. Everything else talks through Frappe's own comments, shown as Activity inside OmniTrack, so nobody has to open Desk.

- Done: `DocActivity` (`src/components/common/DocActivity.vue`, server `omnitrack/api/activity.py`) on the Task, To-Do, Work Block and Work Session panels. A Work Session is a row of its block, so its Activity is the block's, and the panel says so.
- Done: the box to comment is on top and the list reads newest first (owner: "reverse chronological"). The server still sends oldest first; the panel reverses it.
- Fixed: "Youadded a task". Vue drops a space at the very edge of a `<template>`, so the name ran into the text. `check_doc_activity.mjs` now fails on that pattern in any `.vue` file.
- Fixed: "added a task (2)" now reads "added 2 tasks". The same event by the same person within 10 minutes is one line ("updated a task, twice"), at its latest time.
- Done: Raven is gone from blocks, sessions and To-Dos (client and server). `raven_bridge` makes channels for Tasks only, and Desk's timeline pulls Raven for Tasks only. Existing block and To-Do channels stay in Raven but are no longer opened from OmniTrack.
- Guards: `scripts/check_doc_activity.mjs` plus 30 mutants.

Open:
- Raven for a Project and its Milestones (a channel per project, opened from the Projects page). Not built yet.
- Activity does not update live. It refreshes when the panel opens or the block changes. Use `frappe.publish_realtime` on a new Comment.
- @mentions in a comment, and editing or deleting your own comment.
- Communications (emails) on a Task do not show in Activity.
- A session's recap could be posted to its block as an Info comment, so Desk shows it too.
- Name the task in a block's task events ("added Campus Credit: Create new …") instead of "added a task". Version rows carry the row's title.
- Security: `raven_bridge` writes some message content without escaping it, and `RavenCollaborationDrawer` renders message HTML. Review both for XSS.
- The block PWB-2026-00320's Version says Approved while the screen showed "Awaiting approval". Find which feed is stale.
- "planned(−0.1h)" on a block has no space before the bracket.
- The first `get_task_details` call after a restart is slow (cold cache).

## A work session is time already worked (2026-10-07)

Owner: "how can we know and charge for the timesheet in future which is not completed yet". And: adding a session must open the Work Session sheet, not a centred dialog, so people know it is a timesheet session.

- Done: one sheet for adding, editing, logging a free window and stopping the running session (`TimesheetEntryDialog.vue`). It slides in from the right, with the Work Session kind label, like a logged entry's sheet. Esc closes it (an open list takes its own Escape first), Tab stays inside, and focus goes back to what opened it.
- Done: an entry that ends after now cannot be saved. The sheet says why ("start a session when the work begins"), the save path refuses it, and the server refuses it too (`_require_worked` in `log_work_session` and `update_work_session`, 5 minutes of slack for clocks that differ). Past midnight counts as the next day.
- Done: "Edit block" and "Add work session" had the same pencil icon. Add work session uses the Work Session icon. `scripts/check_menu_icons.mjs` fails when two items in one file's menus share an icon.
- Guards: `scripts/check_entry_is_worked.mjs` plus 15 mutants.

Superseded later that day: owner, on the sheet, "this is not the main component for the timesheet creation which the user recognizes, which is used in the timer". Adding or editing a session is now the timer's session box (see "Adding a work session is the timer's box" below). The sheet is left only for Adjust on the running session.

Open:
- Fixed: `saveEditSession` refused an overnight span (`to <= from`), while the sheet accepted one. Both measure with `spanMins` now.
- The Away icon differs: sun in `DetailKind` and the dashboard, umbrella in `PlanWorkBlockDialog`. The sun is also the Today stat's icon. Pick one for Away.
- Not yet checked in the browser: the owner was working in the browser pane, with a session running, when this was built.

## The hover card reads like a card (2026-10-07)

Owner, on the logged bar's hover card: "see how bad it is lookign". Its title was the session's whole notes (the block name, then every "Completed: …" step) in bold, in a narrow card, with "0.03h logged".

- Done: `BlockHoverCard.vue` is a Material card: the time and one status chip, the block's name once, then up to three lines of what got done, then the project and review state. A ticked-off task shows a check; the block's own task reads "Completed" instead of its name again. "2m logged", not "0.03h logged". 18rem wide.
- Done: the logged bar on the dashboard timeline is named like its block (not by its notes), its screen-reader name says "2m", and the "REC •" tag is gone (the dot and the Live chip say it runs). The live bar no longer carries "(Recording...)" in its notes.
- Done: `wrapNote.noteLines` and `wrapNote.noteHeading` read notes back the way `composeWrapNote` writes them. The planner's live block uses `noteHeading` too.
- Guards: `check_block_reminders.mjs`, `check_dialog_popovers.cjs`, 29 mutants.

Open:
- Notes are still parsed in two more places, each its own way: `BlockDetailDrawer.notes` and `useWorkstationSessionModals.notesWithoutLines`. Move both onto `wrapNote.noteLines`.
- Done: the hover card is a plain tooltip. The "View details" button is gone (a keyboard user could never reach it), so nothing in the card takes focus; the block itself opens its details on click or Enter. While the card shows, the block carries `aria-describedby="block-hover-card"`, Escape dismisses only the card (a capture listener that exists only while the card is up), and the pointer can still rest on it (WCAG 1.4.13). The ERPNext Timesheet line now says "ERPNext Timesheet {ref}" instead of a bare reference. Test 35 plus 7 mutants guard it.
- `bench get-app` (15:44 today, `taniya_dsilva`) put `omniservey` back into `sites/apps.txt` and every bench command failed. Removed again. Happens after every get-app.

## Adding a work session is the timer's box (2026-10-07, evening)

Owner: the add-session sheet "is not the main component … used in the timer, so it doesn't feel like the work session at all"; then, on desktop, "this page doesn't look that good"; after the redesign, "this one looks much better".

- Done: Add and Edit work session open `WorkSessionEntry.vue`, which hosts `SessionBox mode="entry"`: the timer's own popup frame, with "When you worked" (day, from–to, length) where the clock sits, Cancel and Add session where Discard, Adjust and Stop sit, a blue wash instead of the live red. The Log is the same lines and "What did you get done?" field; a session needs at least one line, as when it is stopped. On a block, its tasks list under the Log; never the running session's tasks. A free entry asks for its own Project and Activity and files under them, never the running session's.
- Done: on desktop the Log heading reads "Log" (with a count only once there are lines), and an empty Log says "A session needs at least one line to save." under the field instead of a blank panel.
- Done: Cmd/Ctrl+Enter saves, Esc closes (an open list takes its Escape first), Tab stays inside, focus starts in the Log's field and goes back to the menu's button. The app's shortcuts (Cmd+S stops the running session) no longer reach past the entry.
- Fixed: a disabled solid button (Add session, the Log's Add) was pale blue under white text, about 1.6:1. It now greys out with dark text (`DISABLED_SOLID` in `utils/sessionFrame.js`).
- Fixed: editing a session that ran past midnight was refused as backwards (`saveEditSession` now uses `spanMins`).
- Fixed: a component that asked the workstation context for a name App.vue did not provide rendered empty in production with no visible error. Guarded, and written up in AGENTS.md.
- Guards: `check_entry_is_worked.mjs`, `check_dialog_popovers.cjs` (12c, 13), 28 retargeted or new mutants.

Open:
- The running session's Adjust is still the right-hand sheet (`TimesheetEntryDialog`). Move it into the session box too (adjust in place), then delete the sheet's add, edit and free code.
- The app's shortcuts still reach past the Adjust sheet (Cmd+S behind it stops the session). Fixed in the entry only.
- A free entry could take tasks too (pick existing ones, as a block does).
- `BlockDetailDrawer` shows a session's raw notes ("• Completed: …"). Read them with `wrapNote.noteLines`.

## Dark mode looked broken everywhere (fixed 2026-10-07)

Owner: "on dark mode the whole app looks very bad … this x button is not at all visible, and a few things are very highlighted, buttons don't look like they are clickable at all".

- Fixed: the app set only `.dark`. frappe-ui's colour tokens switch on `data-theme="dark"`, so every frappe-ui Button, close x and input stayed on light tokens over the dark page. `applyTheme` and the first-paint script now set both. `check_contrast_tokens.cjs` plus 2 mutants.

- Fixed (pills and faint labels): 66 greys in 9 files had no dark colour, or named a dark grey in the `isDarkMode` dark branch, and stayed gray-600 on the #1E1F22 page (the timeline's hour and lane labels, the week's Overview, attendance, the client portal, the cancel, runaway, switch and empty-stop popups, Raven). The selected zoom chip ("6h") was #1E1F22 on a #2B2D30 track, so it read as a hole: now gray-700 under white (7:1). The now badge's 9px time moved to red-600 (it read 4.4:1). frappe-ui's solid Button turns its text near-black in dark mode, because its own background turns light; ours stays blue-700, so Plan and Start session read 3.8:1. Every blue-700 Button now keeps `enabled:!text-white`.
- Guards: `check_contrast_tokens.cjs` now flags a grey with no dark colour, a dark grey in the dark branch, and a blue-700 Button without white text. `check_timeline_zoom.mjs` holds the zoom chip and the now badge. 6 mutants.
- Fixed: "Needs your attention". Its filter chips were frappe-ui red, orange and blue, and kept light-mode text on the dark page (Overdue 6 read 2.6:1). Now one grey v-for, the selected chip white on gray-700, and a kind with no tasks drops out. Start session keeps white text, and Open planner and Clear filter name their blue. The planner rail's chips in Calendar follow the same pattern.
- Fixed: every coloured ghost or subtle Button names its own text colour: Clear and Cancel in the planner, the activity filter, the inactivity popup's Discard, Happening now's Stop, the header's live stopwatch and a task's danger step. A Button whose theme only turns coloured with solid (a selected tab, a confirm press) needs nothing more.
- Guards: `check_contrast_tokens.cjs` now flags a ghost or subtle Button in a colour with no text colour of its own; `test_attention_filter_contrast.cjs` Test 3 used to *require* the red Overdue chip and now requires grey. 9 new or retargeted mutants.
- Done: "Day at a glance" got more room (owner: "a little bit more space in height … not too congested"). The lanes went from 28 and 24px to 36 and 32px, with 12px between them and more room for the now badge. The card is 216px, up from 174.

Open:
- Light mode, frappe-ui defaults that fail AA: a solid blue Button without our blue-700 (Review day 3.5:1, Happening now's Log 3.5:1, and RunawayTimerModal, PlanWorkBlockDialog), and the amber Badge ("Unplanned", "Not logged", 3.0:1). This wants one fix in one place, not a class on every Button.
- Walk every page in dark mode (Calendar, Tasks, Team, Projects, Logged time, each drawer).

## A planned block's date in start_time was dropped (fixed 2026-10-07)

Reported: `omnitrack_plan_work_blocks` with `start_time: "2026-10-08 10:45:00"` and no `work_date` answered `success: true`, `duration_hours: 0.0`, and the block drew on today as a past event. `pad_time` splits on ":", so the timestamp became an "hour" of "2026-10-08 10".

- Fixed: `omnitrack/utils/block_slot.py` reads a time or a date and time. A date in start_time sets the day when work_date is omitted, and is refused (ValidationError) when it disagrees with work_date; a block ending on another day (other than past midnight), with no length, or with no readable time is refused too. All blocks are checked before the first is booked; blocks on different days are refused, one day per call. `quick_create_task` checks its block the same way before it creates the task, so a bad time creates and assigns nothing.
- Every other way in reads the slot the same way, before anything is written: `book_work_block` (the SPA's own endpoint) checks it before the past-date lock and before it creates a typed new task; `update_work_block` and `reschedule_work_block` check new times before the past lock, so a dated new start moves the block to that day; and the Planned Work Block itself (`calculate_duration`) refuses a time it cannot read or one dated another day, where it used to write 0.0 hrs without a word. It strips a date only when it is the block's own day (or the next day for an end past midnight), and leaves a plain stored time untouched, so roll-up re-saves log no Version change.
- Frappe's own helpers, no hand parser: `block_slot.py` reads with `frappe.utils` `get_time`, `get_datetime`, `getdate` and `add_days`; the controller's `_to_secs` is gone, and its length comes from `time_math.duration_hours` (`time_diff_in_hours`). A stored `24:00:00` (read back as a one-day timedelta) is read as midnight.
- `time_math`'s own parsers are gone too (2026-10-07, late): `pad_time` and `mins_of` read with `get_time` instead of splitting on ":", and `time_str` is `pad_time` with empty kept empty. `api/planner.py`'s private `_time_str` copy is deleted; it imports `time_str`. A Time field's timedelta is still counted as it is in `mins_of`, so an end stored as 24:00:00 stays 1440 minutes (get_time would make it 0, and the midnight splitter would split it). Checked: the calendar endpoint returns every block and session time as HH:MM:SS (hours-only sessions stay empty, as before). Guard: `omnitrack/tests/test_time_math.py` plus 5 mutants.
- Guards: `omnitrack/tests/test_block_slot.py` (no site; `npm test` runs it on the bench's Python, `../../env/bin/python`, since it needs `frappe.utils`) plus 14 mutants. The two fac refusals were checked against the real endpoint and book nothing. The planner and controller refusals were not run on the site (the bench console probe was declined); they are covered by the source tests and mutants. No success path was run here, because it books a real block.

Open:
- `_duration_hours("11:00", "10:00")` is 23.0, read as overnight. A block planned backwards by mistake is booked as a 23-hour block. The SPA refuses it; the API does not.
- Duplicates in `api/planner.py` that shadow the shared helpers it imports (ruff F811): `_resolve_planner_user`, `_duration_hours`, and `_week_bounds` copying `time_math.week_bounds`. Delete the copies and use the shared ones.
- Run the planner refusal paths (`book_work_block` with a mismatched date, a garbage time) against a site once one may be probed; they throw before any write.

## The bottom bar holds only the daily pages (2026-10-07, evening)

Owner: "adding the Project and Logged option to the bottom bar has cluttered the UI, so put it behind the top three lines".

- Done: the bottom bar is Dashboard, Calendar, the session button, Tasks and Team (managers). Projects (only on a site that has ERPNext Projects) and Logged time open from the header's menu, first, set apart from its actions. Arrow keys and Enter work; focus goes back to the Menu button.
- Guards: `check_projects.mjs` (the menu offers both, Projects only with Projects, neither is back in the bar) plus 3 mutants.

Open:
- The header does not say which page is open once it is a menu page (Projects, Logged time). Show the page's name, or mark the current item in the menu.

## A block's person was not on its task (fixed 2026-10-08)

Reported: `omnitrack_plan_work_blocks` booked a block for Neha on a task assigned to Nomeshwer and answered `success: true`. The block sat on her calendar, the task never showed in her assigned work, and she could not finish it. "Plan with people" (pairing partner and team copies) did the same to every colleague on the block.

- Fixed in the Planned Work Block controller (`put_person_on_tasks`, after `sync_primary_task`), so the SPA, FAC, attach-tasks, edit and desk paths all pass through it. The decision is the site-free `omnitrack/utils/task_parity.py`.
- A Task can have many assignees, so the block's person is added to it with Frappe's own `assign_to.add`: whoever books must be able to read the task, the other assignees stay, and Frappe notifies the person as for any assignment. Reassigning instead would orphan Nomeshwer's own blocks the same way. `book_work_block` and each FAC planned block return `added_to_tasks`.
- A to-do is one person's list item, so a block on someone else's to-do is refused (ValidationError, naming the owner). Paired and team copies may show their owner's to-do.
- Only rows new to the block are checked, or all of them when its person changes, so an unrelated save never puts back someone a task was later taken off. Finished tasks are skipped.
- Checked: no existing block on ommnomi.local has a person missing from its open task (read-only SQL). The save path was not run on the site: it would assign and notify real people. Guards: `omnitrack/tests/test_task_parity.py` plus 9 mutants.

Open:
- `block_tasks.set_row_done` sets the Task's status with `frappe.db.set_value`, with no permission check, so anyone allowed to change a block can complete any task on it. Parity makes them an assignee now, but ticking should still go through the Task's own permission (and workflow, where one is set).
- Run the parity save path (the add and the to-do refusal) against a test site, never ommnomi.local: it creates ToDos and notifications.

## A refused Stop lost a session (fixed 2026-10-08)

Reported: a session from 23:45 (Oct 7) to 00:35 was lost. Stop said "Session notes must contain at least 15 words … (found 6 words) … Add it again from Log", and nothing was on the timeline. The owner had written about three lines; only the 6-word title reached the save.

Why it was lost:
- Stop cleared the session on the server, told other tabs it had ended, and only then saved. When the save was refused, nothing was left to go back to.
- The lines were gone before the save. The 2-second poll, a realtime push and a restore each replaced the log with whatever copy the server held, with no check of which copy was newer. A tab, or the Desk page (the bundle loads there too), holding an older copy could send it up and wipe the newer lines. A line typed but not added yet was also dropped on Stop.

Fixed:
- Stop adds a typed line to the log, then counts words the way the server does (`src/utils/sessionWords.js`, the same cases as `validators.count_session_words`). If there are too few, it asks for more before the clock stops: "Describe this session" with a live word count, and Save waits until there are enough. Keep running closes the dialog. A session with nothing written can be discarded; one with a log cannot, from there.
- The server copy stays until a save succeeds; both saves (`quick_timer_punch`, `log_work_session`) clear it themselves. A refused save puts the session back as it was and says "Not saved, the session is still running."
- Every edit to the title, log or tasks stamps `linesRev`. An older copy never replaces a newer one: not in the poll, the realtime push or a restore on the page (it sends the newer copy back up instead), and not on the server (`omnitrack/utils/session_lines.keep_newer_lines`).
- No more invented notes ("Focus session (…)", "Focus work session"): the page asks the person.
- The server's message is one short sentence: "Describe what you did in at least 15 words (you wrote 6)."
- Guards: `scripts/check_session_lines.mjs`, `omnitrack/tests/test_session_lines.py`, 20 mutants.
- The lost session was not recreated: it is the owner's own record to add from Log.

Open:
- `linesRev` is the device's clock. Two devices with clocks far apart could still pick the wrong copy. A server-issued counter would not.
- Switching to another block (`switch_active_session`) is refused by the same word rule, and when the person wrote nothing the server invents "Session completed before switching to …". The switch is atomic, so nothing is lost, but it should ask for words first, as Stop now does, and never invent a note.
- `src/stores/workSessionStore.js` repeats the session sync with none of this (no `linesRev`, and it clears the server copy before saving). Nothing imports it; it is on the list to delete.
