# 🏛️ OmniTrack Domain Model — Project, Task, Work Block, Work Session

<p align="center">
  <a href="https://ommnomi.in">
    <img src="../omnitrack/public/images/ommnomi_header.svg" height="36" alt="OmmNoMi OmniTrack">
  </a>
</p>

<p align="center">
  <b>The Enterprise Workforce Operating System for Frappe Framework & ERPNext</b><br>
  <i>Domain Model Specification · Entity Lifecycles · Forensic Schema Ground Truth</i>
</p>

---

**Status:** Canonical. This document defines what the four core nouns mean. Where code disagrees with this document, the code is wrong and is a bug.

**Why this exists:** The same four words were being used for different things by different people and different parts of the codebase — "timesheet" alone meant three separate objects depending on context. Every metric built on top of that ambiguity (PAI, variance, "unlogged hours") inherited it.

**Methodology & Synthesis:** The four-layer breakdown and the *"For Whom / What / When / Did"* framing below represent a major evolution over earlier drafts: earlier documentation described Work Block and Work Session primarily in terms of their database fields (`duration_hours` vs `hours`), which made them appear like redundant duplicates. Naming them by the **question each one answers** makes the distinction structurally clear and impossible to collapse. This document synthesizes the conceptual taxonomy with forensic database measurements on `ommnomi.local`, codifying the authoritative standard for all future development.

---

## 1. The Hierarchy

```
📁 PROJECT ─ the Macro Scope / Client Container
    │
    └── 🎯 TASK ─ the Deliverable / Goal (e.g. 10 hours of total work)
          │
          ├── 📅 PLANNED WORK BLOCK ─ the Calendar Commitment ("when I plan to work")
          │     │   Sunday 10:00–12:00  (2.0h planned)
          │     │
          │     └── ⏱️ WORK SESSION ─ the Execution Reality ("what actually happened")
          │           Stopwatch 10:05–11:35  (1.5h actual)
          │             • Fixed regex parser
          │             • Wrote unit tests
          │
          └── 📅 NEXT WORK BLOCK ─ split shift / tomorrow
                │   Monday 14:00–17:00  (3.0h planned)
                └── ⏱️ WORK SESSION ─ next sitting
```

### The Core Nouns at a Glance:

| Layer | Question it answers | Doctype | Kind |
|---|---|---|---|
| **Project** | **For whom** | `Project` (ERPNext) / `OmniTrack Workspace` | Document |
| **Task** | **What** | `Task` (ERPNext) / `ToDo` (core Frappe) / `work_item` | Document |
| **Planned Work Block** | **When** | `Planned Work Block` (`PWB-YYYY-#####`) | Document |
| **Work Session** | **Did** | `OmniTrack Work Session` | **Child table row** |

---

## 2. 📁 Project — The "For Whom"

A contract, client milestone, or major product initiative: *OmmNoMi Automation*, *Studio 0172 Migration*, *Gaonhae Taekwondo*.

**What it is not:** You never "work on a Project" for 45 minutes. A Project is too broad to be a unit of execution. It is the umbrella that holds tasks, invoices, and billing rules. Nothing logs time directly to a Project.

**Who sees a Project: one rule.** `permissions.projects_for(user)` is the only place that decides it, and it is used by the block query, opening one block, the workstation and the Projects page.
- Team members (anyone who is not a client) get `None`, meaning "no project filter": ordinary DocType permissions apply.
- A client (`OmniTrack Client` role) sees the projects where they are a Project User, plus the projects of every Customer their Contact is linked to. With `include_assigned=True` (the Projects page), a project where a Task is assigned to them counts too. Block visibility uses `include_assigned=False`, so one assigned task does not reveal everyone's time on that project (owner to confirm).
- A client with no shared project sees nothing, and a site without ERPNext gives clients no projects. No customer name is ever written into code.
- On a shared project, a client sees only tasks marked `custom_is_public_deliverable`, never planned hours, and no logged hours where their Project User row has `hide_timesheets`.

---

## 3. 🎯 Task / ToDo — The "What"

A specific deliverable or engineering goal assigned to an associate: *"Build searchable ToDo dropdown"*, *"Review cold-chain telemetry API"*.

**A Task almost always takes multiple sittings across multiple days.** A 12-hour task cannot and should not be completed in one continuous sitting. This is the defining property: a Task is a unit of *intent*, not a unit of *time*. It is the reason Work Block and Work Session must both exist below it.

The associate picks the Task from the searchable ToDo dropdown to declare what they are committing to. Selecting it binds the block, fills the project, and sets the activity nature.

**Decision (owner, 2026-10-06): the Task is the ERPNext `Task`, never a bare `ToDo`.** Work tracking exists to run the Project better, not only to count hours. A core Frappe `ToDo` cannot carry the work: it has no planned (start) date, no real description field of its own beyond the one line used as a title, no people in CC, and no project, milestone or estimate. The structure is ERPNext's own:

- **Project**: the client or initiative, its expected start and end, and the people on it.
- **Milestone**: a group Task (`is_group = 1`, see AGENTS.md) or a Task marked as a milestone, under the Project.
- **Task**: subject, description, planned start (`exp_start_date`), due date (`exp_end_date`), expected hours (`expected_time`), priority, dependencies, assignees.

Expected hours and progress belong to the Task and roll up to the Project in ERPNext. OmniTrack does not keep its own copy. A `ToDo` stays what Frappe uses it for: the assignment record that points at a Task (`reference_type = "Task"`). A standalone ToDo is not a task and does not appear as one.

Consequence: OmniTrack's project features need ERPNext's Projects module. `ommnomi.local` has no ERPNext (below), so until it is installed there, the app only has ToDos to show. See ROADMAP, "Tasks are ERPNext Tasks".

---

## 4. 📅 Planned Work Block — The "When"

A time-slot reservation on one person's calendar for one date and one interval: *Sunday 13 Sep, 10:00–13:00*.

- **Intent and commitment.** "I commit to spending three hours this morning on Task X." It is a promise made *before* the work.
- **Enables split shifts.** A morning block (09:00–13:00) and a night block (19:00–22:00) may both point at the *same* Task. This is the whole point of the split-shift engine: one deliverable, many discontinuous commitments.
- **Historically immutable.** Once the calendar day has elapsed (`work_date < nowdate()`), the block is permanently locked — no user, manager, or Administrator may create, move, reschedule, or delete it. You cannot retroactively edit what you originally promised. See `omnitrack/permissions.py`.

A block carries `duration_hours` (**planned**), `actual_hours` (**rolled up from its sessions**), and `variance_hours` (the difference). Those three fields are not interchangeable and must never be written from the same source value.

---

## 5. ⏱️ Work Session — The "Did"

The physical reality of sitting at the desk with the stopwatch running.

- `istable: 1`. **A Work Session is a child row inside a Planned Work Block, not a document of its own.** It has no independent name and cannot exist unparented.
- Concrete `from_time`, `to_time`, `hours` — *10:04 → 11:42 = 1.63h*.
- Carries the **progressive micro-log**: the bulleted lines typed every 5–10 minutes as milestones land. These are the deliverable notes.
- `logged_via` records provenance: `Stopwatch`, `Manual`, or `Import`.
- **It logs AGAINST a Planned Work Block.** If the associate had to jump on an emergency with no prior commitment, it is an *unplanned* session — recorded as such, on a block explicitly marked `⚠️ Unplanned`.
- **It rolls up.** Many sessions → parent block `actual_hours` → the official Timesheet for payroll and client billing.

### Correct Stop Sequence

1. **Planned lane (top)** shows today's calendar commitments — typically one or two.
2. Associate clicks **Start Session** on a block.
3. Stopwatch runs; micro-log lines accumulate.
4. Associate clicks **Stop**.
5. The system records a **Session inside that block**.
6. **Logged lane (bottom)** lights up with the 1.5h actually worked, and PAI computes *Planned 2.0h vs Actual 1.5h*.

At no point in that sequence is a new Planned Work Block created.

---

## 6. The Disconnect (The Defect This Document Resolves)

**Work Blocks and Work Sessions were being treated as the same thing.**

`quick_timer_punch(action="stop")` in `omnitrack/api.py` called `frappe.new_doc("Planned Work Block")` — it set `start_time`/`end_time` to the stopwatch window, set `duration_hours = actual_hours`, marked the block `Completed`, and appended a single session row.

The consequence was that **an unplanned stopwatch run manufactured a retroactive plan that it perfectly fulfilled**. Plan and actual became the same record, written from the same number, at the same instant. Every plan-vs-actual metric built on top was then measuring a tautology:

- **PAI** compared a plan to an actual that was copied from it → always 100%.
- **`variance_hours`** was hard-coded `0.0` on that path.
- The calendar filled with one "plan" per Stop press.

Only the *bound* path — the branch that reported `Logged Xh against focus block` — did the right thing and appended a session to an existing block. The unbound path fabricated.

### 6.1 Verified: Measured Evidence & Symptom Clarification

Queried against the live `ommnomi.local` database on 2026-09-13:

- **157** `Planned Work Block` rows and **158** `OmniTrack Work Session` rows — very nearly 1:1. The calendar bloat was verified in raw database counts.
- A single day (2026-09-13) held ~40 blocks, including **18 byte-identical `In Progress` 14:00–16:00 rows** and **6 identical 12:58:15 rows**.
- **Symptom Clarification:** The logged lane being empty while blocks piled up was caused by `get_workstation_data()` failing to bulk-load child session rows into the client payload. Once session loading was added to the query, the sessions were visible, confirming that Stop was creating duplicate blocks alongside single session rows.

### 6.2 Verified: The Second-Order Damage — "Unlogged Hours"

`dayTimeline` in `omnitrack/www/omnitrack.html` computed:

```js
plannedH = planned.reduce((t, r) => t + (r.e - r.s) / 60, 0)   // every block on the day
loggedH  = logged.reduce((t, r) => t + (r.e - r.s) / 60, 0)    // every session row
gapH     = Math.max(0, plannedH - loggedH)                     // rendered as "Xh unlogged"
```

`plannedH` was a **naive sum of every block's wall-clock span, with no overlap merging and no deduplication**. Eighteen overlapping two-hour blocks summed to 36 planned hours inside a 24-hour day. That is how the Day-at-a-glance legend reached an impossible two-digit "unlogged" figure for a single day. The number was an artifact of summing duplicate fabricated blocks.

**"Unlogged" must not be derived from naive `Σ(blocks)`.** It is computed via the Interval Union algorithm ($\mu \circ \bigcup$) against scheduled commitment hours.

---

## 7. Ground Truth on `ommnomi.local` (Verified)

Since 2026-10-06 this bench has **ERPNext 16.50**, set up with its demo data, and since 2026-10-07 **Frappe HR**. The counts below were taken before ERPNext was installed and are kept for the history they explain:

| Doctype | Exists on this site |
|---|---|
| `Project` | yes since 2026-10-06 (ERPNext); demo projects plus CampusCredit (2026-10-07) |
| `Task` | yes since 2026-10-06 (ERPNext) |
| `Timesheet` | yes since 2026-10-06 (ERPNext) |
| `Employee` | yes since 2026-10-06 (ERPNext) |
| `Employee Goal`, `Appraisal`, `Leave Application` | yes since 2026-10-07 (Frappe HR) |
| `ToDo` (core Frappe) | 121 rows, 120 open (before ERPNext) |
| `Planned Work Block` | 157 rows (before ERPNext) |
| `OmniTrack Work Session` | 158 child rows (before ERPNext) |

Of the 157 blocks: **0** populated `project`, **0** `task`, **0** `timesheet`. Seven populated `work_item`, the site-portable substitute, holding a `todo:<name>` string with the subject mirrored into `work_item_label`:

```
todo:1490i091br   Draft Q4 logistics SOP
todo:14b8bs1u9j   Review cold-chain telemetry API
todo:hl7hmckrdp   Manage icons and add missing home/dashboard file to OmniAssist workspace
```

**OmniTrack runs on sites with and without ERPNext and Frappe HR.** Without ERPNext, the Task layer is `ToDo` and the Project layer is absent. Every optional-doctype reference must stay guarded with `frappe.db.exists("DocType", "<name>")`, or the page 500s on one site while working on another. A block's `project`, `task` and `timesheet` links are kept as plain text where their DocType is absent (`OptionalLinks`).

**What a client sees.** A client sees a block only when its project is shared with them, its person is marked Visible to Clients (OmniTrack User Entitlement), and its task, if it has one, is Shared with Client. Nobody is visible until the owner says so.

Two further schema hazards, both verified:

- **`Planned Work Block.employee` is a `Link` to `User`, not to `Employee`.** `OmniTrack Shift Split Assignment.employee` *is* a Link to `Employee`. Same field name, two different meanings, same module.
- **`OmniTrack Shift Template` / `OmniTrack Shift Session` / `OmniTrack Shift Split Assignment` exist, are installed into the Desk workspace, and are never read by any Python or JavaScript in the app.** Pure inert schema.

---

## 8. Commitment Hours Resolution

There was previously **no source of truth for "how many hours was this person supposed to work today."** `commitment` appeared in README, CHANGELOG, SRS, and AGENTS.md as prose only — no field, no API, no calculation anywhere in the app.

The canonical resolution hierarchy is:
1. **Active Shift Assignment**: If an associate has an active `OmniTrack Shift Split Assignment`, commitment hours equal the sum of configured shift session durations.
2. **Default Associate Target**: In the absence of a shift assignment, default to the user's standard contracted baseline (default: `8.0h`).
3. **Daily Unlogged Calculation**:
   $$\text{Unlogged Gap} = \max(0, \text{Scheduled Baseline} - \text{Total Actual Logged Hours})$$

---

## 9. Vocabulary Discipline

The word **"timesheet"** is ambiguous and must be qualified everywhere — in UI copy, in code comments, and in conversation:

| Say this | Not "timesheet" |
|---|---|
| **Work Session** | The child row — one stopwatch run |
| **Planned Work Block** | The calendar commitment that holds sessions |
| **ERPNext Timesheet** | The billing document (absent on `ommnomi.local`) |

---

## 10. Architectural Invariants (Enforced via Regression Tests)

1. `quick_timer_punch(action="stop")` **never** creates a `Planned Work Block` when the session is bound to one.
2. An unbound stop produces a session whose `task_nature` is `⚠️ Unplanned` — never `🎯 Planned`. A plan cannot be fabricated retroactively.
3. `duration_hours` (planned) and `actual_hours` (logged) are never written from the same source value in the same operation.
4. `variance_hours == duration_hours - actual_hours` for every block.
5. `plannedH` in `dayTimeline` merges overlapping intervals; two identical blocks contribute their span once, not twice.
6. "Unlogged" is derived from commitment hours, never from naive `Σ(block spans)`.

---

<p align="center">
  <a href="https://ommnomi.in">
    <img src="../omnitrack/public/images/ommnomi_brand.svg" height="28" alt="OmmNoMi Automation LLP">
  </a><br>
  <i>Architecting Next-Generation Operational Ecosystems</i><br>
  Mahunag · Karsog · Mandi, Himachal Pradesh, India<br>
  🌐 <a href="https://ommnomi.in">https://ommnomi.in</a> • 📧 <a href="mailto:omnitrack@ommnomi.com">omnitrack@ommnomi.com</a>
</p>
