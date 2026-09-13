# 🏛️ OmniTrack Domain Model — Project, Task, Work Block, Work Session

<p align="center">
  <span style="font-family:'Roboto',sans-serif;font-weight:900;font-size:1.5rem;">
    <span style="color:#4285f4;">Omm</span><span style="color:#34a853;">No</span><span style="color:#ea4335;">M</span><span style="color:#fbbc05;">i</span>
  </span> 
  <b style="font-size:1.5rem;">OmniTrack</b>
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

---

## 3. 🎯 Task / ToDo — The "What"

A specific deliverable or engineering goal assigned to an associate: *"Build searchable ToDo dropdown"*, *"Review cold-chain telemetry API"*.

**A Task almost always takes multiple sittings across multiple days.** A 12-hour task cannot and should not be completed in one continuous sitting. This is the defining property: a Task is a unit of *intent*, not a unit of *time*. It is the reason Work Block and Work Session must both exist below it.

The associate picks the Task from the searchable ToDo dropdown to declare what they are committing to. Selecting it binds the block, fills the project, and sets the activity nature.

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

This bench has **no ERPNext and no HRMS**. The upper two layers of the hierarchy have no doctype to live in:

| Doctype | Exists on this site |
|---|---|
| `Project` | ❌ |
| `Task` | ❌ |
| `Timesheet` | ❌ |
| `Employee` | ❌ |
| `ToDo` (core Frappe) | ✅ — 121 rows, 120 open |
| `Planned Work Block` | ✅ — 157 rows |
| `OmniTrack Work Session` | ✅ — 158 child rows |

Of the 157 blocks: **0** populate `project`, **0** populate `task`, **0** populate `timesheet`. Seven populate `work_item` — the site-portable substitute, holding a `todo:<name>` string with the subject mirrored into `work_item_label`:

```
todo:1490i091br   Draft Q4 logistics SOP
todo:14b8bs1u9j   Review cold-chain telemetry API
todo:hl7hmckrdp   Manage icons and add missing home/dashboard file to FAH workspace
```

**On this site, the Task layer is `ToDo` and the Project layer is absent.** Every optional-doctype reference must stay guarded with `frappe.db.exists("DocType", "<name>")` — the page 500s on this site otherwise while working fine on an ERPNext bench.

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
  <span style="font-family:'Roboto',sans-serif;font-weight:900;">
    <span style="color:#4285f4;">Omm</span><span style="color:#34a853;">No</span><span style="color:#ea4335;">M</span><span style="color:#fbbc05;">i</span>
  </span> Automation LLP<br>
  <i>Architecting Next-Generation Operational Ecosystems</i><br>
  Mahunag · Karsog · Mandi, Himachal Pradesh, India<br>
  🌐 <a href="https://ommnomi.in">https://ommnomi.in</a> • 📧 <a href="mailto:omnitrack@ommnomi.com">omnitrack@ommnomi.com</a>
</p>
