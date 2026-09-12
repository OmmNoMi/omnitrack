# Changelog

All notable changes to **OmniTrack** will be documented in this file.

## [1.2.0] - 2026-09-12
### Added
- **Timesheet Horizon Governance**: Enforced temporal restriction where an `OmniTrack User` can only log, edit, or modify timesheets/work sessions for **today and yesterday** (`session_date >= add_days(nowdate(), -1)`). All historical entries and modifications prior to yesterday strictly require an `OmniTrack Manager` (or System Manager/Administrator).
- **Past Planned Work Blocks Immutable Lock**: In the past (`work_date < nowdate()`), **NO ONE** (neither User nor Manager nor Admin) can create, move, reschedule, or delete planned work blocks. Historical plan commitments are permanently immutable once their calendar day has elapsed.
- **Expanded Test Suite (22 Unit Tests)**: Added test cases covering user timesheet date boundaries, manager historical timesheet override, past block modification/reschedule locks, past block booking rejection, past block deletion protection, and standard `Timesheet` DocEvent validation (100% passing).

### Changed
- **Workstation Drawer Temporal Awareness**: Drawer clearly demarcates past planned blocks with an immutable commitment notice (`🔒 Planned work blocks in the past are immutable commitments and cannot be rescheduled or deleted`), and provides historical warning banner when timesheet entries are restricted to managers (`⏳ Historical Timesheet: OmniTrack Users can only log or modify timesheets for today and yesterday`).

## [1.1.0] - 2026-09-12
### Added
- **2-Pane Left-and-Right Workstation Timesheet HUD**: Left pane handles session context, digital stopwatch (`00:43:34`), Start/Stop action, task title, project picker, and activity nature dropdown; Right pane features incremental subtask lines logger (`+ Add Line` / <kbd>Enter</kbd>) for progressive logging every 5–10 minutes.
- **Project Inheritance & Multi-Tier Permissions**: Strict project association and permission inheritance from Tasks/Blocks to Timesheets (`permissions.py`), providing scoped access for `Project User`, project owners, and external clients (`Customer`/`Contact`).
- **15 Automated Unit Tests**: Comprehensive regression suite in `test_planned_work_block.py` covering split shifts, project permissions, midnight session splits, quick timer punches, and dashboard KPI calculations (100% passing).
- **Centered Date Picker Strip**: Planner date strip centers around Today (3 days past, Today in center, 3 days future) with a dedicated `Today` jump button.
- **Project-Hued Block Visual Language**: Dynamic calendar styling based on project hues and visual states (`planned`, `logged`, `missed`, `away`, `cancelled`).

### Changed
- **Executive KPI Cards Streamlined**: Eliminated parameter repetition across dashboard cards; hero strictly displays `Worked Hours` without fraction clutter; secondary metrics standardized into `Planned` | `Target` | `Variance`.
- **Card Standard Renaming**: Renamed top cards to `Today's Hours & Commitment` (% ToDo Done), `Weekly Velocity` (% Adherence), and `Monthly Capacity` (% Utilized).
- **Clean Footer Badges**: Removed redundant `0.0h Non-Working` badges; contextual badges (`Standard Day`, `Full Work Week`, `Full Capacity`) display when non-working time is zero.
- **Action Terminology & Play Icon**: Renamed "Join Focus Session" (with video camera icon) to "Start Session" with a crisp Play icon (`▶`), properly reflecting task session initiation.
- **Activity Nature Dropdown**: Replaced 6 bulky buttons with a standard `<select>` dropdown defaulted to `Planned Work`.
- **Non-Working & Non-Paid Logic**: Classified `Break`, `Leave`, `Absent`, and `Out-of-Office` strictly as non-working and non-paid.

### Fixed
- **Bullet Concatenation Fix**: Auto-separates legacy concatenated bullet points (`•`) from task titles into distinct subtask lines upon block load and `localStorage` session recovery.
- **Overnight Session Splitting**: `log_work_session` automatically splits sessions crossing midnight into separate child timesheets for Day N and Day N+1.

## [1.0.0] - 2026-09-04
### Added
- Initial release of OmniTrack (Universal Workforce, Task Sync & Split-Shift Engine).
- 100% Configuration-Driven Architecture via `OmniTrack Settings`.
- Frappe-native Discontinuous Split-Shift Engine (`Planned Work Block`).
- Plan Adherence Index (PAI >= 85%) & Task Estimation Variance Engine.
- Multi-tier Declarative Role Governance (`OmniTrack User Entitlement`).
- Subdomain SaaS Multi-Tenant Workspaces (`OmniTrack Workspace`) with white-label branding.
- Site-to-Site Live Sync Engine (`OmniTrack Remote Connection`) with Field-Level Merges.
- Automated ERPNext Attendance Synthesizer & GitHub-style activity heatmaps.
- Web & Mobile PWA Push Notification Engine with Leave-Aware Silencing.
