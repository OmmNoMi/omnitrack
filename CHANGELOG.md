# Changelog

All notable changes to **OmniTrack** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- **Three public Workspaces that were never requested**: `My Workstation`, `Operations & Delivery Hub` and `OmniTrack Command Center`. Their fixtures are deleted and `install.py::_ensure_workspaces()` no longer creates them, so `after_migrate` cannot bring them back; the corresponding Workspace, Desktop Icon and Workspace Sidebar records were cleared from ommnomi.local.

### Fixed
- **Duplicate `OmniTrack` desktop tile**: the exported fixture still carried the pre-rename identity `OmniTrack Operations & Workforce Cockpit` while `install.py` ensured `OmniTrack`, so the site maintained one record and shipped the other. Fixture and `install.py` now agree on `OmniTrack`.

### Added
- **`omnitrack/tests/test_workspace_fixtures.py`**: filesystem-only invariants (no DB) asserting that the only public Workspace shipped is `OmniTrack`, that each fixture's identity matches its own folder, that `install.py` ensures exactly the shipped names, and that the pre-rename string is gone from the app.
- **`npm run test:fixtures` / `test:fast`** wired in `package.json`.

## [1.2.1] - 2026-09-17

### Fixed
- **Workstation Dropdown Keyboard Trap & Shielding**: Added WAI-ARIA 1.2 deterministic focus management to `FDropdownMenu` with circular arrow-key navigation (<kbd>ArrowDown</kbd>, <kbd>ArrowUp</kbd>, <kbd>Home</kbd>, <kbd>End</kbd>), `e.stopPropagation()` isolation, and focus restoration to the trigger button upon close or <kbd>Escape</kbd>.
- **Truncated Option Visibility**: Added native HTML `title` attributes on truncated dropdown menuitem labels, ensuring long task and workflow labels remain readable via browser tooltips without expanding menu bounds.
- **2D Roving Grid Keyboard Isolation**: Shielded the attention tasks table keyboard handler (`onAttentionGridKey`) so keystrokes inside open dropdowns or workflow triggers do not trigger unwanted row jumps.
- **Automated Interaction Regression Suite**: Added `scripts/test_workstation_interactions.cjs` validating spatial bounding, WAI-ARIA focus contracts, and event isolation across the Workstation interface.

## [1.2.0] - 2026-09-13

### Added
- **Frappe Assistant Core (FAC) Integration**: Exposes 6 domain tools (`omnitrack_get_my_workspace`, `omnitrack_plan_work_blocks`, `omnitrack_log_work_session`, `omnitrack_quick_create_task`, `omnitrack_quick_timer_action`, `omnitrack_get_eod_reconciliation`) via Model Context Protocol (MCP) and whitelisted Frappe API methods.
- **Generic Permission-Based Cross-User Management**: Authorized users (managers, administrators, or users granted Frappe User Permissions / reporting hierarchy) can manage workstations, schedule blocks, create tasks, and log timesheets on behalf of any employee within their permitted scope.
- **Defensive ERPNext Timesheet Synchronization**: Automatically resolves and maps `Employee` records from user accounts, fallbacks for `Activity Type` records (`Execution`, `Break`, `Leave / Absence`), and ensures proper `from_time`/`to_time` intervals so duration hours are reliably preserved by the ERPNext timesheet controller.
- **Work Session Source Tagging**: Added `AI Assistant` to the `OmniTrack Work Session` `logged_via` Select field options and introduced automatic normalization of external client source labels.

### Fixed
- **Workstation Permission Queries**: Purged legacy hardcoded username filtering from `get_workstation_data`, `permissions.py`, and `www/omnitrack.py` in favor of generic Frappe role and user permission scoping.
- **Workstation Task List Parsing**: Corrected dictionary extraction in `get_my_workspace` so task rows and attention items are cleanly mapped for assistant context.

## [1.1.0] - 2026-09-13

### Added
- **Canonical Domain Model Codification**: Formally codified the 4-tier domain hierarchy (`Project` ──< `Task` ──< `Planned Work Block` ──< `OmniTrack Work Session`) grounded in the *"For Whom / What / When / Did"* operational taxonomy.
- **Dual-Mode Runtime Engine**: First-class support for both **Mode A (Pure Frappe Standalone)** using native Frappe `User`, `ToDo`, and `work_item`, and **Mode B (ERPNext Enterprise)** with bidirectional linkage to `tabProject`, `tabTask`, `tabTimesheet`, and `tabEmployee`.
- **2-Pane Focus Workstation (`/omnitrack`)**: Ergonomic split-interface featuring active session timer on the left and rapid progressive micro-line milestone logger on the right (<kbd>Enter</kbd> to log).
- **Full-Focus Elevation Mode (<kbd>Shift + S</kbd>)**: Elevates the running timer into a distraction-free modal dialog for deep-work focus.
- **Interval Union Overlap Algorithm**: Resolves overlapping calendar blocks via greedy interval union ($\mu \circ \bigcup$), ensuring aggregate daily commitment hours can never exceed 24.0h.
- **Official OmmNoMi Vector Branding**: Integrated official SVG vector lockups across documentation to guarantee crisp, theme-aware rendering on GitHub dark and light modes.
- **Spec-Compliant HTML5 Tree Verification**: Automated `scripts/check_www_html.py` using `html5lib` to prevent nested interactive controls from breaking Frappe in-DOM templates.

### Changed
- **De-Jargonized Human-Centric Terminology**: Replaced intimidating gaming/aerospace acronyms ("HUD") with "Focus Workstation", and replaced complex LaTeX formulas with intuitive "Promise vs. Reality" Plan Adherence scoring.
- **Positioning for Remote Teams & Multi-Client Agencies**: Redesigned README with clear persona value propositions for remote managers, multi-client agencies, freelancers, and clients demanding transparency.
- **Strict Plan vs. Actual Separation**: Unbound stopwatch sessions are authentically classified under `task_nature = 'Unplanned Work'`, eliminating retroactive plan fabrication.

### Fixed
- **Stop Button Resurrection Loop**: Fixed session stop state persistence in `api.py` and `omnitrack.html` by explicitly clearing user cache and default values upon session completion.
- **Child Session Enrichment**: Bulk-load `tabOmniTrack Work Session` child rows in `get_workstation_data`, ensuring the timeline accurately renders logged execution bars.
- **WHATWG HTML5 Parser Button Nesting**: Fixed button nesting in workstation filter dropdown trigger to prevent early tag ejection.

## [1.0.2] - 2026-09-13

### Added
- **Workstation Timesheet Adjust & Session Validation**: Added validation rules for session note entries and duration clamping.
- **Frappe UI Dialog Abstractions**: Native dialog wrappers for work block scheduling and cancellation.

### Changed
- **Cross-Device Sync Reliability**: Real-time event broadcasting over Frappe Socket.IO (`omnitrack_session_synced`) paired with explicit Redis cache eviction.

## [1.0.1] - 2026-09-04

### Added
- **GitHub Actions CI/CD Workflows**: Automated test runners, pull request labelers, release drafters, and issue templates.
- **Open-Source Governance & Community Guidelines**: Added `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `SUPPORT.md`.

## [1.0.0] - 2026-09-04

### Added
- **Initial Release**: Production release of OmniTrack (Universal Workforce, Task Sync & Split-Shift Engine).
- **Split-Shift Engine**: Discontinuous morning/evening shifts with automatic midnight boundary crossing.
- **Plan Adherence Index (PAI)**: Real-time execution tracking comparing planned calendar commitments against actual logged hours.
- **Anti-Fraud Temporal Governance**: 2-day user timesheet edit horizon and historical plan immutability.
- **Zero-Trust Cross-Site Sync**: Cryptographic HMAC-SHA256 signed replication between parent and branch Frappe sites.
- **Autonomous Attendance Synthesis**: Directly generates standard Frappe/ERPNext `Attendance` records from verified work sessions.
