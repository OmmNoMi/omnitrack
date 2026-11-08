---
name: omnitrack-workstation-governance
description: Architectural standards, operational invariants, and tool workflows for OmniTrack Workstation, Planned Work Blocks, active stopwatch sessions, and ERPNext Timesheet sync governance.
---

# OmniTrack Workstation & Timesheet Governance SOP

## 1. Architectural Mandate: The Plan vs. The Timesheet

OmniTrack maintains a strict architectural and visual separation between **"The Plan"** (pre-scheduled commitments) and **"The Timesheet"** (actual work delivered).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ WORKSTATION TIMELINE                                                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 🎯 Planned Lane:  [  09:00 - 10:30 Pre-booked Block  ]                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ⏱️ Logged Lane:   [ 09:02 - 10:28 Actual Session ] [ 11:12 - 12:20 Unplanned ]  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### The Dual-Lane Visual Model
The Workstation Vue timeline (`dayTimeline`) renders two distinct lanes:
1. **Planned Lane (`dayTimeline.planned`)**:
   - Filter criteria: Evaluates blocks where `!isUnplanned` (i.e. `task_nature != "⚠️ Unplanned"`).
   - Renders: A dashed/outline container indicating scheduled intention.
2. **Logged Lane (`dayTimeline.logged`)**:
   - Filter criteria: Evaluates child session rows where `_minsOf(x.to_time) > _minsOf(x.from_time)`.
   - Renders: A solid colored block indicating actual verified time spent.

### The Classification Invariant
* **`🎯 Planned`**: Pre-scheduled commitments established in advance (e.g. morning planning).
* **`⚠️ Unplanned`**: Spontaneous, emerging, reactive, or retrospective work that was not scheduled in advance (e.g. ad-hoc meetings, impromptu mentoring, urgent client incidents).
* **RULE**: Spontaneous or retrospective sessions **MUST ALWAYS** be classified as **`⚠️ Unplanned`** (`task_nature = "⚠️ Unplanned"`).
* **ANTI-PATTERN**: Never create a spontaneous or retrospective block with `🎯 Planned`. Doing so erroneously injects an unfulfilled planned container into the top lane, corrupts plan adherence metrics, and makes completed work look like a missed schedule.

---

## 2. Session Row Schema & Time Rendering Invariants

Every work session in OmniTrack is logged in the `sessions` child table (`OmniTrack Work Session`) of a `Planned Work Block`.

### Child Row Schema
| Field | Type | Invariant | Description |
| :--- | :--- | :--- | :--- |
| `session_date` | Date | Mandatory | Date of the session (restricted by temporal governance). |
| `from_time` | Time | Mandatory | Exact start time (e.g. `11:12:00`). |
| `to_time` | Time | **MANDATORY** | Exact completion time (e.g. `12:20:00`). **Never null.** |
| `hours` | Float | Mandatory | Calculated duration in decimal hours (e.g. `1.13`). |
| `notes` | Text | Mandatory | Bulleted accomplishment notes ($\ge 3$ characters). |
| `logged_via` | Select | Mandatory | `Stopwatch`, `Manual`, or `System`. |
| `task_nature` | Select | Mandatory | Matches parent block (`🎯 Planned` or `⚠️ Unplanned`). |

### The `to_time` Invariant
- The workstation frontend computes bar width and position via:
  ```javascript
  const startMins = _minsOf(session.from_time);
  const endMins = _minsOf(session.to_time);
  if (endMins <= startMins) return; // OMITTED FROM RENDER
  ```
- **Consequence of missing `to_time`**: If a session row is inserted with `to_time = null` (or missing), the timeline completely omits the solid timesheet bar in the `Logged` lane. The user will see an empty timeline despite data existing in the database.
- **Always supply both `from_time` and `to_time`** whenever concluding or logging a session.

### The Audit-Ready Timesheet Standard (Executive Quality Across All Industries)
All AI agents and team members recording sessions in OmniTrack must format `notes` to client-ready, audit-compliant executive standards applicable to any organization (tech, healthcare, legal, field services, manufacturing, consulting, education):
1. **Context Header**: Clear deliverable / workstream / patient / matter / project context.
2. **Concise Accomplishment Bullets**:
   - Concrete items: tasks completed, procedures performed, documents reviewed, deliverables produced, tickets resolved, or milestones achieved.
   - Exact outcomes: quantitative progress, operational decisions, stakeholder alignments, or verified results.
   - Minimum volume: at least 15 words by default (or the organization's threshold configured in `OmniTrack Settings > min_session_words`).
3. **Strict Anti-Pattern Avoidance**:
   - Never write vague one-liners like "worked on tasks", "general admin", or "attended meetings".
   - Never record time without linking to concrete business deliverables or operational outcomes.

---

## 3. Live Active Stopwatch Protocol

### In-Flight State vs. Future Timesheet Anti-Pattern
- An active, running timer is **NEVER** an ERPNext `Timesheet` document with a future scheduled end time.
- Live work exists exclusively in memory and Redis cache (`sync_active_session` / `omnitrack_start_timer`).
- Attempting to pre-create timesheet documents for running sessions pollutes accounting, breaks audit trails, and violates temporal immutability.

### Real-Time Session Log Streaming
While a session is active, live progress notes must be continuously streamed to the workstation HUD:
1. When calling `omnitrack_start_timer` or `sync_active_session`, initialize `sessionNotesList`.
2. As milestones are reached, append notes to `sessionNotesList` (or call `add_timer_note`).
3. The workstation HUD automatically polls `get_active_session` and renders these notes live in the **`SESSION LOG`** card as bullet points.

### Session Lifecycle Actions
- **Start Session (`▶`)**: Invokes `omnitrack_start_timer(work_block, task, deliverable_note)`.
- **Stop Session (`⏹`)**: Invokes `omnitrack_stop_timer(deliverable_note)`. Validates deliverable notes ($\ge 3$ chars), calculates exact elapsed time, records `to_time = nowtime()`, appends the row to `sessions`, and clears the active timer.
- **Discard Session**: If a session was started accidentally or abandoned, use the 2-step Discard action to throw away the elapsed timer without creating an empty session row or timesheet.
- **HUD Standby Reset**: On session stop or discard, the live stopwatch display must immediately snapshot and reset to `00:00:00` so an idle workstation is never mistaken for an active running session.

---

## 4. ERPNext Timesheet Sync Governance

OmniTrack decouples internal time tracking from ERPNext `Timesheet` documents via `OmniTrack Settings.default_timesheet_mode`:

```
┌────────────────────────────────────────────────────────┐
│ OmniTrack Settings                                     │
│ default_timesheet_mode: [ Never | On Approval | Immed ]│
└────────────────────────────────────────────────────────┘
```

### Sync Modes
1. **`Never` (or `Off`) — Default**:
   - Zero ERPNext `Timesheet` documents are created, updated, or submitted.
   - Work blocks and child session rows remain strictly self-contained within OmniTrack.
   - `create_timesheet_from_work_block()` returns `None` unless explicitly overridden with `force=True`.
2. **`On Approval`**:
   - Timesheets are decoupled during live tracking.
   - When a Manager signs off on a work block via `omnitrack_approve_work_blocks()`, OmniTrack automatically synthesizes and submits the formal ERPNext `Timesheet`.
3. **`Immediate`**:
   - Auto-creates/syncs an ERPNext `Timesheet` immediately upon stopping every session.

---

## 5. Temporal Governance, Horizon Policies & Deletion Protection

1. **Past Planned Blocks Lock (`work_date < nowdate()`)**:
   - Historical plan commitments are permanently immutable once their calendar day has ended (subject to `past_block_lock_grace_hours`, default: 24h).
2. **Timesheet Modification Horizon**:
   - Standard users (`OmniTrack User`) can only log, edit, or adjust timesheet entries within the configured horizon in hours (`OmniTrack Settings > timesheet_modification_horizon_hours`).
   - Default is 48 hours (2 days: today and yesterday). Configurable per organization / industry (e.g. 72h for 3 days, 168h for weekly review cycles).
   - Any historical logging or adjustment beyond the active horizon strictly requires an `OmniTrack Manager` or `System Manager`.
3. **Session Deletion Governance (`allow_session_deletion`)**:
   - Work sessions contain billable hours and financial payroll information.
   - Deletion of logged sessions is strictly restricted to `OmniTrack Manager` and `Administrator` by default.
   - Standard users cannot delete completed work sessions unless `OmniTrack Settings > allow_session_deletion` is explicitly enabled.
4. **Minimum Note Length (`min_session_words`)**:
   - Session deliverable notes require a meaningful explanation of work delivered (default: 15 words; configured via `OmniTrack Settings > min_session_words`).
   - Ensures high audit quality, transparent client billing, and operational clarity across tech, healthcare, legal, field services, manufacturing, and education.

---

## 6. Manager Delegation & Permission Scoping

Every OmniTrack FAC tool supports the `employee` parameter (User email or Employee ID).
- When a Manager or Administrator passes `employee="user@example.com"`, OmniTrack routes the operation through `_resolve_planner_user()` and checks `can_access_user_data()`.
- This allows managers to:
  - Plan work blocks for direct reports.
  - Review team timelines.
  - Sign off on completed blocks using `omnitrack_approve_work_blocks(block_names=[...], employee=...)`.

---

## 7. OmniTrack FAC Tool Cheatsheet (21 Tools)

| Tool Name | Key Arguments | Purpose |
| :--- | :--- | :--- |
| `omnitrack_book_work_block` | `work_date`, `from_time`, `to_time`, `task_nature`, `subject`, `employee` | Book a work block (`🎯 Planned` or `⚠️ Unplanned`). |
| `omnitrack_start_timer` | `work_block`, `task`, `deliverable_note`, `employee` | Start live stopwatch session. |
| `omnitrack_stop_timer` | `deliverable_note`, `employee` | Conclude active session, record `to_time`, append row. |
| `omnitrack_log_work_session` | `work_block`, `session_date`, `from_time`, `to_time`, `notes`, `employee` | Log manual completed session row. |
| `omnitrack_get_active_session` | `employee` | Inspect running timer and live `sessionNotesList`. |
| `omnitrack_get_daily_planner` | `work_date`, `employee` | Fetch day's planned blocks, logged sessions, and adherence. |
| `omnitrack_approve_work_blocks` | `block_names`, `approval_notes`, `employee` | Sign off on work blocks and synthesize timesheets if mode is `On Approval`. |
| `omnitrack_update_work_block` | `block_name`, `...fields`, `employee` | Update editable fields on today/future blocks. |
| `omnitrack_delete_work_block` | `block_name`, `employee` | Delete unstarted block (blocked for past dates). |
| `omnitrack_list_team_members` | `limit` | List active team members, user IDs, and roles. |
| `omnitrack_get_team_overview` | `work_date` | View cross-team work block allocations and status. |

---

## 8. Collaborative Pairing & Cross-Employee Timesheet Synchronization

When team members collaborate synchronously (e.g. mentoring, joint code review, data migration, pair programming):
1. **Reciprocal Block Creation**:
   - Create the primary user's `Planned Work Block` (`employee = primary_user`).
   - Create the reciprocal collaborator's `Planned Work Block` (`employee = collaborator_user`) with mirrored parameters:
     - Same `work_date`, `start_time`, `end_time`, `duration_hours`, and `project`.
     - Reciprocal `work_item_label` (e.g., `... (with Neha Thakur)` on Nomeshwer's block, and `... (with Nomeshwer)` on Neha's block).
2. **Synchronized Active Timers**:
   - Both users receive in-memory active session synchronization via `sync_active_session`:
     ```python
     sync_active_session(session_data, user="primary@example.com")
     sync_active_session(session_data, user="collaborator@example.com")
     ```
3. **Session Conclusion**:
   - Append identical completed session rows to both documents with explicit `from_time` and `to_time`, recalculating actual hours and advancing status simultaneously.

---

## 9. Real-Time In-Flight Timer Back-Filling (`startTime` Alignment)

When a user initiates or registers a timesheet session "on time" for a block that was scheduled in the past:
1. **Drift Avoidance**:
   - Never overwrite `startTime` with current timestamp `Date.now()`. Doing so erases elapsed time and creates an artificial negative variance against the plan.
2. **Timestamp Calculation**:
   - Convert the planned `start_time` (e.g., `12:40:00`) of the block on the target `work_date` into epoch milliseconds in the local timezone (`Asia/Kolkata`):
     ```python
     from datetime import datetime
     from zoneinfo import ZoneInfo
     ist = ZoneInfo("Asia/Kolkata")
     dt = datetime(year, month, day, hour, minute, second, tzinfo=ist)
     start_ms = int(dt.timestamp() * 1000)
     ```
3. **Payload Synchronization**:
   - Inject `startTime: start_ms` into `session_data` for `sync_active_session`.
   - The workstation HUD immediately computes `trackerSeconds = Math.floor((Date.now() - start_ms) / 1000)`, displaying exact elapsed time and ticking live.

---

## 10. Cross-Repository Stage Ladder Auditing & CI Artifact Disambiguation

When auditing multi-repository pull requests, issue stage ladders, and staging deployment status (e.g., `cctech`):

### A. CI / Repository Tooling (Non-Deployable)
- **Scope**: Changes modifying `.github/**` workflows, Actions scripts, or repository-level automations.
- **Runtime Environment**: Executes exclusively on GitHub-hosted or self-hosted runners upon PR / commit events.
- **Deployment Invariant**:
  - CI workflows are **never deployed to application servers** (`staging.*`, `prod.*`).
  - They become **100% active and live** the exact instant they merge into the base branch (`main`).
  - **Audit Rule**: Never count CI PRs as "un-deployed to staging" or "missing release tags" in release gap reports. Flag them as `CI / Internal Tooling (Active on Merge)`.

### B. Deployable Application Code
- **Scope**: Changes modifying `apps/**`, frontend UI (`web/`), backend services (`server/`), databases, or cloud infrastructure (`infra/`, `cdk/`).
- **Ladder Progression**:
  `stage:pr-raised` ➔ `stage:pr-approved` ➔ `stage:merged` (merged to main) ➔ `stage:our-uat` (deployed to staging) ➔ `stage:shipped` (live in production).
- **Staging Gate**: A PR cannot advance from `stage:merged` to `stage:our-uat` until the build containing its commit is confirmed running on the staging environment.

### C. Issue vs. PR Stage Decoupling
- Updating a PR's stage label does not automatically advance linked issue cards on GitHub project boards unless an automated event listener specifically cascades the label.
- When reconciling board columns, always audit both `is:pr` and `is:issue` separately to prevent orphaned `stage:merged` issues when their parent PR has already reached `stage:shipped`.

---

## 11. Acoustic Governance & WCAG Audio Accessibility (Issue #41)

### Zero Unaccompanied Audio Invariant (WCAG 1.1.1 / 1.4.1 / 4.1.3)
Every acoustic chime emitted by OmniTrack (T-10m, T-0, Overrun, Inactivity) **MUST** be paired with an immediate visual UI element:
1. **Live Region Toasts**: Trigger `showToast(msg, 'warning' | 'info' | 'success')` rendering within a container marked with `role="status" aria-live="polite"`.
2. **Dedicated Action Modals**: Surface explicit action modals (e.g. `showInactivityModal.value = true`) allowing user confirmation.
3. **Realtime Payload Transparency**: Realtime socket events (`omnitrack:block_alert`, `omnitrack:timesheet_reminder`) and push notifications must pass explicit `alert_type` metadata (`inactivity`, `block_overrun`, `upcoming_10m`, `start_on_time`) so client listeners render contextual visual banners rather than generic ephemeral alerts.

### Harmonic Tone Synthesis
- All audio cues use the Web Audio API (`useAudioSynthesizer.js`) with harmonic musical intervals (e.g., F#5 -> A#5 -> C#6 -> F#6 for T-10m; C5 -> E5 -> G5 for T-0; descending gongs for overrun; resonant two-tone pings for inactivity) and natural exponential decay curves. Flat, harsh single-frequency monospace beeps are prohibited.

### Sound Preference Governance
- All audio synthesis must check `isSoundEnabled()` before attempting playback, respecting the user's `omnitrack:sound_enabled` flag stored in `localStorage`.

### Mobile Web Push VAPID Invariant
- Calling `registration.pushManager.subscribe()` requires converting the server's VAPID public key (`window.OMNITRACK_SESSION.vapid_public_key`) from base64/hex into an `ArrayBuffer` (`Uint8Array`) as `applicationServerKey`.
- Omitting `applicationServerKey` causes silent subscription drops on iOS Safari and Chrome Mobile.

### Visual Stacking Invariant
- The floating toast notification container in `src/App.vue` must sit at `z-[70]` so alert toasts remain fully visible above high-z modal dialogs and session overlay backdrops (`z-50`).

---

## 12. Frappe v16 Desk Branding & Workspace Navigation Invariants (Issue #42)

### Desk App Logo Resolution (`add_to_apps_screen`)
In Frappe v16, the Desk sidebar header resolves logos via `frappe.utils.app_logo(sidebar.get_sidebar_app())`, which reads from `frappe.boot.app_data`.
- `omnitrack/hooks.py` **MUST** declare:
  ```python
  app_home = "/desk/omnitrack"
  add_to_apps_screen = [
      {
          "name": "omnitrack",
          "logo": "/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg",
          "title": "OmniTrack",
          "route": "/desk/omnitrack",
      }
  ]
  ```
- Omitting `add_to_apps_screen` or `app_home` causes the sidebar header to render bare plain text with an empty logo placeholder.
- Both `workspace_sidebar/omnitrack.json` and `workspace/omnitrack/omnitrack.json` must reference the official brand SVG asset (`/assets/omnitrack/icons/desktop_icons/solid/omnitrack.svg`) in `header_icon` and `icon`.

### Employee Session Timesheets Desk Access
- Both the Desk Workspace (`workspace/omnitrack/omnitrack.json`) and Workspace Sidebar (`workspace_sidebar/omnitrack.json`) must provide direct shortcuts and links to `Timesheet` (labeled `Employee Timesheets`) under *Workforce & Shifts*.
- Programmatic installation in `install.py` (`_ensure_workspaces` and `_ensure_workspace_sidebar`) must mirror these fixtures so new installs and migrations remain identical.

### Sidebar Cleanliness & Label Overflow Prevention
- **Low-Level Payload Exclusion**: Technical sync tables (`OmniTrack Task Sync`, `OmniTrack Remote Connection`, `OmniTrack Workspace`, `OmniTrack Push Subscription`) must **never** be exposed in primary sidebar navigation.
- **Label Width Limit**: Sidebar labels must stay $\le 20$ characters (e.g. `Synthesizer Logs` instead of `Attendance Synthesizer Logs`) to prevent ellipsis truncation (`Attendance Synthesizer Lo...`) in standard desktop views.

---

## 13. Codebase Quality Gates & File-Size Ratchet

### 500-Line File-Size Limit (`scripts/check_file_size.cjs`)
- No source file under `src/**` may exceed 500 lines.
- Files exceeding the limit prior to gate introduction are frozen at their ceiling in `scripts/file_size_allowlist.json` and ratcheted downward with `--ratchet`. New files can never be allowlisted.
- Large components and composables must be decomposed modularly into focused context helpers before touching the 500-line ceiling.

### 3-Pillar Pre-Push Gate (`npm run gate`)
Before any commit or push, the automated gate executes:
1. **Pillar 1: Security**: Bandit AST static security scan (`-ll`).
2. **Pillar 2: Accessibility & HTML5 Specs**: Spec-compliant HTML5 tree validation (`check_www_html.py`), Tier 3 keyboard interactions, and Axe-core WCAG 2.2 AA audit.
3. **Pillar 3: Code Quality & TDD++**: Ruff linting, hermetic filesystem unit tests, static template and SPA checks, smoke runtime tests, and 100% mutation test kill score.


