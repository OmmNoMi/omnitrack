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

### Planner calendar — still open after 2026-09-10
- **Away blocks still render as a timed bar**, not an all-day band; no `away_count` chip
  on the summary cards yet. Leave/Absent modal still asks for start/end times.
- **`quick_timer_punch` param mismatch:** the frontend's non-block stopwatch path posts
  `{task_nature, notes, duration_hours, project}` but the API signature is
  `quick_timer_punch(action, duration_seconds=0, ...)` — `action` is required and never
  sent, so that path silently relies on the `except` fallback. Reconcile the signature.
- **Regression test:** `test_planned_work_block.py` covers the rollup invariant
  (`actual_hours == sum(sessions.hours)`, `variance_hours == actual - planned`,
  midnight-split duration). Keep extending as calendar logic grows.
