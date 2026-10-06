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

### Dummy / test data on ommnomi.local (open — needs the owner's go-ahead)
- About 100 Planned Work Blocks on ommnomi.local come from test runs:
  - employees `test_partner@ommnomi.local` and `test1@example.com`
  - labels such as "TDD Immutability Test Deliverables…", "Test block for sync mode Never" and "Collaborative Sprint"
  - Administrator blocks with notes like "Ad-hoc debug punch"
- About 255 test ToDos ("test doctype", "sanity check from console", "Draft Q4 logistics SOP", "Review cold-chain telemetry API").
- A backup was taken before any cleanup: `sites/ommnomi.local/private/backups/20261006_013326-ommnomi_local-database.sql.gz`. The cleanup has NOT run.
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
- Open: `BlockHoverCard.vue` still shows emojis (🔴 ✓ 🔒 ⏱ 📁) and `text-[9px]` low-contrast text. Replace them with FeatherIcons and readable sizes.
- Open: the demo `timelineMembers` in `useWorkstationShortcuts.js` carry emojis.
- Open: `src/stores/workSessionStore.js` is not imported anywhere. Either wire it in or remove it (removal needs the owner's go-ahead).
