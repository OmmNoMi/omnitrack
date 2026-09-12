# Software Requirements Specification (SRS)
## OmniTrack: Universal Workforce, Task Sync & Split-Shift Engine (`omnitrack`)

**Document Reference:** `SRS-OMNITRACK-2026-V1.0.1`  
**Version:** 1.0.1 • Frappe Cloud Marketplace & Enterprise Cross-Site Sync Edition  
**Standard:** IEEE 830-1998 / ISO/IEC/IEEE 29148  
**Publisher & Maintainer:** **OmmNoMi Automation LLP** (`omnitrack@ommnomi.com`)  
**License:** GNU General Public License v3.0 (GPLv3) Open Source  
**Target Platform:** Frappe Cloud Marketplace, Frappe Framework v15+, ERPNext v15+, Frappe HRMS  

---

## 1. Executive Summary & Vision

**OmniTrack** solves three structural gaps in the Frappe ecosystem:
1. **Discontinuous & Split-Shift Workforce Operations**: Native Frappe HR assumes contiguous work spans (09:00–18:00). OmniTrack natively supports discontinuous morning/evening split shifts, on-demand field assignments, and dynamic check-in hashing.
2. **Cross-Site & Multi-Company Bidirectional Sync**: Facilitates real-time, event-driven, or scheduled synchronization of Tasks, Timesheets, and Attendance between separate Frappe sites without database coupling.
3. **Desk Workstation UX & Client Transparency Portals**: Role-partitioned workspaces providing dedicated dashboards for Workers, Operations Managers, Auditors, and External Clients.

---

## 2. DocType Schema Architecture

### 2.1 Planned Work Block (`planned_work_block`)
* **Interval Structure**: Supports 12-hour AM/PM formats, automatic duration computation (`duration_hours`), and parent task variance updates.
* **Integrity**: Generates cryptographic check-in verification tokens (`chk-8a1f9e`).

### 2.2 OmniTrack Settings (`omnitrack_settings`)
* **Single DocType**: Central configuration for split-shift tolerance, auto-attendance synthesis, VAPID Web Push credentials, and default sync intervals.

### 2.3 OmniTrack Remote Connection (`omnitrack_remote_connection`)
* **Site-to-Site Integration**: Configurable remote URL, API Key/Secret, bidirectional event queueing, and HMAC-SHA256 payload verification.

### 2.4 OmniTrack Work Session (`omnitrack_work_session`)
* **Session Timesheet Child Table**: Captures discrete work session intervals (`from_time`, `to_time`, `hours`, `notes`), overnight session midnight splits, and incremental subtask accomplishment logs.

---

## 3. Security & Governance

* **GPL-3.0 Open Source**: Unrestricted freedom to inspect, modify, and deploy.
* **Granular RBAC**: 6 dedicated role profiles:
  - `OmniTrack Admin`: Complete system control over settings, work blocks, timesheets, and remote connections.
  - `OmniTrack Manager`: Team-wide planning, calendar allocation, project velocity, and timesheet review.
  - `OmniTrack User`: Personal work blocks, live stopwatch tracking, timesheet logging, and task ToDos.
  - `OmniTrack Client`: Read-only transparency restricted strictly to their customer projects and public deliverables.
  - `OmniTrack Auditor`: Read-only compliance oversight across all work sessions, logs, and attendance records.
  - `OmniTrack Sync Agent`: Headless service account for automated background sync and site-to-site replication.
* **Temporal Governance & Audit Invariants**:
  - **Timesheet Horizon (Today & Yesterday Only for Users)**: `OmniTrack User` can only log, edit, or adjust timesheet entries and work sessions for **today and yesterday** (`session_date >= add_days(nowdate(), -1)`). Historical logging or modifications prior to yesterday strictly require an `OmniTrack Manager` (or System Manager/Admin).
  - **Past Planned Work Blocks Lock (Historical Plan Immutability)**: In the past (`work_date < nowdate()`), **NO ONE** (neither User nor Manager nor Administrator) can create, move, reschedule, or delete planned work blocks. Plan commitments are permanently locked once their calendar day has elapsed.
* **Multi-Tier Scoping Invariants**:
  - `Project User` and project owners automatically inherit read/write permissions over all work blocks and sessions linked to their projects.
  - External clients (`Customer`/`Contact`) are strictly restricted to blocks matching their Customer link and tasks marked as public deliverables (`custom_is_public_deliverable = 1`).
* **Zero Overhead**: Fully asynchronous queue processing ensuring zero impact on transaction latency.

---

*Mahunag · Karsog · Mandi, HP, India · **OmmNoMi Automation LLP***
