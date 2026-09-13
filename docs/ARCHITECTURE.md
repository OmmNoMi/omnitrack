# 🏛️ OmniTrack System Architecture

## Overview
OmniTrack is structured as a modular Frappe application designed to seamlessly extend Frappe HRMS, ERPNext, and Frappe Desk without invasive patches.

---

## 🏗️ DocType Ecosystem

```
+-------------------------------------------------------------+
|                      OmniTrack Settings                     |
|  (Split-Shift Engine, Midnight Cutoff, Cross-Site Policies)  |
+-------------------------------------------------------------+
         |                                           |
         v                                           v
+------------------------+                 +---------------------+
| OmniTrack Shift        |                 | OmniTrack Task      |
| Template               |                 | Sync                |
+------------------------+                 +---------------------+
         | (Child Table: Sessions)                   |
         v                                           v
+------------------------+                 +---------------------+
| OmniTrack Shift Split  |                 | OmniTrack Remote    |
| Assignment             |                 | Connection          |
+------------------------+                 +---------------------+
         |
         v (Synthesizer Engine)
+------------------------+-------------------+
| OmniTrack Attendance   | Standard Frappe   |
| Synthesizer Log        | Attendance        |
+------------------------+-------------------+
```

---

## ⚙️ Core Engines

### 1. Split-Shift Synthesizer Engine (`synthesizer.py`)
- Evaluates raw `Employee Checkin` logs across configured day windows.
- Correlates punches before `midnight_cutoff_hour` (default `04:00:00`) with the previous calendar day's shift.
- Pairs IN/OUT punch sequences and calculates net working hours.
- Computes Late Entry and Early Exit relative to scheduled session boundaries.
- Generates/updates standard Frappe `Attendance` and audit logs.

### 2. Cross-Site Task Sync Engine (`sync.py`)
- Master-Satellite and Peer-to-Peer replication.
- Cryptographic HMAC-SHA256 signature verification over REST endpoints.
- Monotonic payload hashing (`SHA-256`) and conflict resolution strategies.

### 3. Plan Adherence (PAI) & Variance Engine (`api.py`)
- Real-time computation of Plan Adherence Index:
  $$\text{PAI} = \frac{\sum \text{Planned Hours}}{\sum \text{Total Executed Hours}} \times 100\%$$
- Dynamic variance categorization against project thresholds.

### 4. Workstation Remote HUD & Timesheet Work Session Engine (`omnitrack.html`, `api.py`)
- **2-Pane Left-and-Right Architecture**:
  - **Left Pane (Context & Controls)**: Live high-contrast digital stopwatch (`00:43:34`), Start/Stop action, Deliverable / Task Title, Project picker, and Activity Nature dropdown defaulted to `Planned Work`.
  - **Right Pane (Progressive Work Log)**: Incremental subtask lines logger (`+ Add Line` / <kbd>Enter</kbd>) for logging accomplishments throughout a work session every 5–10 minutes.
- **Searchable ToDo / Task Dropdown**: Embedded search popover indexing Frappe `ToDo` and ERPNext `Task` doctypes. Selecting an open item auto-fills project, nature, and establishes bi-directional binding with calendar work blocks.
- **Full-Focus Elevation Mode (<kbd>Shift + S</kbd>)**: Elevates the active session box into a distraction-free dialog modal to protect deep-work focus.
- **Timesheet Aggregation & Safety Guards**:
  - Stopping the timer compiles subtask lines and task title into bulleted notes in `OmniTrack Work Session` child table (or ERPNext Timesheet).
  - 2-step Discard action allows abandoning false starts without polluting ERPNext timesheets.
  - Confirmation prompt protects against submitting blank line logs.
- **Midnight Boundary Splitting**: Work sessions crossing midnight are automatically split into discrete Day N and Day N+1 child records.

### 5. Multi-Device Real-Time Event Bus & Cache Eviction (`api.py`)
- **Instant Reflection Across Devices**: Sessions started or updated on a mobile device broadcast real-time events via Frappe Socket.IO (`publish_realtime('omnitrack_session_synced')`).
- **Redis Cache Invalidation**: Explicit `frappe.cache().delete_value(...)` and `frappe.db.commit()` in `sync_active_session()`, `log_work_session()`, and `quick_timer_punch()` guarantee that open desktop tabs immediately observe new sessions and line items without a full-page browser refresh.

### 6. In-DOM Web Template Validation & HTML5 Parser Guard (`scripts/check_www_html.py`)
- **Tree-Construction Verification**: Unlike Vite Single File Components (`.vue`), in-DOM templates (`www/*.html`) are parsed by the browser's native HTML5 parser before Vue evaluates them.
- **Strict Prohibition of Nested Interactive Controls**: Controls like `<button>` inside `<button>` cause WHATWG HTML5 parsers to force-close outer containers, desynchronizing `</div>` endings and prematurely ejecting components outside `<div id="app">`.
- **Automated Structural Linting**: `scripts/check_www_html.py` uses `html5lib` to assert zero `unexpected-end-tag` or `unexpected-start-tag-implies-end-tag` errors across all templates.

---

## 🔒 Security, Roles & Permission Scoping (`permissions.py`)

OmniTrack implements multi-tier declarative access control across 6 dedicated roles:

```
+-----------------------------------------------------------------------------+
|                                OmniTrack Admin                              |
|          (Global Control Plane: Settings, Work Blocks, Connections)         |
+-----------------------------------------------------------------------------+
        |                                                 |
        v                                                 v
+-------------------------------+                 +---------------------------+
|      OmniTrack Manager        |                 |    OmniTrack Auditor      |
| (Team Work Blocks, Velocity)  |                 | (Read-Only Organization)  |
+-------------------------------+                 +---------------------------+
        |                                                 |
        v                                                 v
+-------------------------------+                 +---------------------------+
|       OmniTrack User          |                 |     OmniTrack Client      |
| (Self Blocks, Stopwatch, ToDo)|                 | (Project & Customer Scope)|
+-------------------------------+                 +---------------------------+
```

### Permission Invariants
1. **Planned Work Blocks & Timesheets**:
   - `Admin`, `Manager`, and `Auditor` have global visibility across all associates.
   - `User` sees personal blocks plus blocks in projects where they are an assigned team member (`Project User`).
   - `Client` visibility is strictly filtered to projects linked to their Customer entity (`Project.customer` or `Contact.user`).
2. **Tasks & ToDos**:
   - `User` access is restricted to tasks allocated or assigned to them (`allocated_to` or `_assign`).
   - `Client` access is restricted strictly to tasks marked with `custom_is_public_deliverable = 1`.
3. **Non-Working & Non-Paid Logic**:
   - `Break`, `Leave`, `Absent`, and `Out-of-Office` are classified strictly as non-working and non-paid, automatically excluded from capacity consumption.
4. **Timesheet Horizon (Today & Yesterday Only for Users)**:
   - Regular `OmniTrack User` can only log, edit, or adjust timesheets and work sessions for today and yesterday (`session_date >= add_days(nowdate(), -1)`).
   - Historical entries prior to yesterday strictly require an `OmniTrack Manager` (or System Manager/Admin).
5. **Past Planned Work Blocks Lock (Historical Plan Immutability)**:
   - In the past (`work_date < nowdate()`), NO ONE (neither User nor Manager nor Admin) can create, move, reschedule, or delete planned work blocks.
   - Historical planning commitments are permanently locked once their calendar day has elapsed.

---

<p align="center">
  <span style="font-family:'Roboto',sans-serif;font-weight:900;">
    <span style="color:#4285f4;">Omm</span><span style="color:#34a853;">No</span><span style="color:#ea4335;">M</span><span style="color:#fbbc05;">i</span>
  </span> Automation LLP<br>
  <i>Architecting Next-Generation Operational Ecosystems</i>
</p>

