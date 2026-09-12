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
- **Timesheet Aggregation**: Upon stopping the timer, subtask lines and task title compile automatically into bulleted notes stored in the `OmniTrack Work Session` child table (or ERPNext Timesheet).
- **Midnight Boundary Splitting**: Work sessions crossing midnight are automatically split into discrete Day N and Day N+1 child records.

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

