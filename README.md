# OmniTrack (Universal Workforce, Task Sync & Split-Shift Engine)

<p align="center">
  <a href="https://github.com/OmmNoMi/omnitrack">
    <img src="omnitrack/public/images/omnitrack_icon.svg" width="128" height="128" alt="OmniTrack Icon">
  </a>
</p>

<p align="center">
  <span style="font-family:'Roboto',sans-serif;font-weight:900;font-size:1.6rem;">
    <span style="color:#4285f4;">Omm</span><span style="color:#34a853;">No</span><span style="color:#ea4335;">M</span><span style="color:#fbbc05;">i</span>
  </span> 
  <b style="font-size:1.6rem;">OmniTrack</b>
</p>

<p align="center">
  <b>The Enterprise Workforce Operating System for Frappe Framework & ERPNext</b><br>
  <i>Discontinuous Split-Shifts · Real-Time Workstation HUD · Plan Adherence Engine · Cross-Site Cryptographic Sync</i>
</p>

<p align="center">
  <a href="https://github.com/OmmNoMi/omnitrack/actions/workflows/ci.yml"><img src="https://github.com/OmmNoMi/omnitrack/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/OmmNoMi/omnitrack/releases"><img src="https://img.shields.io/github/v/release/OmmNoMi/omnitrack?color=4285F4&label=version" alt="Latest Release"></a>
  <a href="license.txt"><img src="https://img.shields.io/badge/License-GPL%20v3.0-34A853.svg" alt="License: GPL v3.0"></a>
  <a href="https://frappe.io"><img src="https://img.shields.io/badge/Frappe-v15%20%7C%20v16-EA4335.svg" alt="Frappe Framework"></a>
  <a href="https://www.w3.org/WAI/standards-guidelines/wcag/"><img src="https://img.shields.io/badge/WCAG%202.2-AA%20Compliant-FBBC05.svg" alt="WCAG 2.2 AA Compliant"></a>
  <a href="https://ommnomi.in"><img src="https://img.shields.io/badge/Maintained%20by-OmmNoMi-673AB7.svg" alt="OmmNoMi Automation LLP"></a>
</p>

---

## ⚡ Executive Summary: Stop Guessing. Start Knowing.

Traditional ERP timesheets are broken. Associates fill out fictitious hours on Friday afternoon from memory, biometric clocks treat split shifts like unexcused absences, and managers have zero visibility into whether daily commitments were actually delivered.

**OmniTrack transforms this entire paradigm.**

Engineered by **OmmNoMi Automation**, OmniTrack is a production-grade workforce governance ecosystem that bridges high-level project planning with sub-second execution reality. It gives leadership mathematically truthful **Plan Adherence (PAI)** metrics while giving associates a sleek, distraction-free **Workstation Portal** designed for deep focus.

```
       PLANNED COMMITMENT                            REAL-TIME EXECUTION                         TRUTHFUL HARVEST
+-----------------------------+              +---------------------------------+              +-----------------------+
|  24-Hour Split-Shift Grid   |              |  Workstation Desk Remote HUD    |              |  Plan Adherence (PAI) |
|  • Morning / Evening Splits |  --------->  |  • Searchable ToDo Dropdown     |  --------->  |  • Actual vs Planned  |
|  • Overlap Lane Packing     |              |  • Live Micro-Line Logger       |              |  • Auto-Attendance    |
|  • Immutable Past Blocks    |              |  • Zero-Refresh Multi-Device    |              |  • Cross-Site Sync    |
+-----------------------------+              +---------------------------------+              +-----------------------+
```

---

## 💎 The Six Pillars of OmniTrack Power

### 1. 🎛️ The 2-Pane Workstation Remote HUD (`/omnitrack`)
A dedicated, lightning-fast Single Page Application (Vue 3 + Tailwind CSS + Frappe UI) engineered for associate productivity without Desk clutter.
* **Ergonomic 2-Pane Layout**: The Left Pane anchors operational context (digital stopwatch, project, task, activity nature). The Right Pane features a rapid chronological micro-logger where associates record milestones every 5–10 minutes with a single <kbd>Enter</kbd> keystroke.
* **Intelligent Searchable ToDo Picker**: Seamlessly searches open Frappe ToDos and assigned ERPNext Tasks. Selecting an item automatically binds the timesheet, fills the project, assigns the activity nature, and bi-directionally links to calendar blocks.
* **Deep Focus Elevation Mode (<kbd>Shift + S</kbd>)**: Tap <kbd>Shift + S</kbd> or click the header stopwatch timer to elevate the active session into a focused, distraction-free modal dialog. Hit <kbd>Esc</kbd> or <kbd>Shift + S</kbd> to minimize back into the workspace.
* **Multi-Device Instant Reflection**: Start or punch a session from your mobile phone on the shop floor or transit; the desktop workstation reflects the change instantly without requiring a full page refresh (powered by Socket.IO events and server-side Redis eviction).
* **Accidental Punch Protection**: Two-step Discard action to throw away false starts without creating ghost timesheets, paired with confirmation guards against accidental empty submits.

### 2. 📅 24-Hour Split-Shift & Calendar Commitment Engine
Say goodbye to the fiction that knowledge and modern service work fits into a single contiguous 9-to-5 box.
* **Discontinuous Split-Shifts**: Intelligently models discontinuous morning, afternoon, and night blocks with sub-minute precision.
* **Midnight-Crossing Boundary Engine**: Automatically detects sessions and shifts that cross midnight, mathematically splitting them into Day N (start→24:00) and Day N+1 (00:00→end) continuation records.
* **Smart Overlap Lane Packing**: Concurrent blocks are dynamically arranged using greedy interval graph coloring into clean, collision-free side-by-side sub-lanes.
* **Interactive Drag & Snap Rescheduling**: Drag blocks across days, resize bottom edges with 15-minute magnetic snapping, and view rich hover cards with real-time actuals vs planned progress bars.
* **All-Day Leave & Away Banners**: Dedicated top-level banner row isolating sick leave, vacations, and out-of-office blocks from working capacity calculations.

### 3. 🎯 Plan Adherence Index (PAI / PACI Engine)
How truthful is your company\'s execution velocity?
OmniTrack computes the **Plan Adherence Index (PAI)** in real time:

$$\\text{PAI} = \\left( \\frac{\\sum \\text{Planned Hours Worked Within Commitment}}{\\sum \\text{Total Logged Hours}} \\right) \\times 100\\%$$

* **Instant Header Gauge**: High-contrast pulse badge displaying live PAI percentage (e.g. `75%`, `100%`).
* **Underplanned & Overdue Radar**: Automatic scanning surfaces past-due or under-allocated tasks with instant one-click actions (`Plan in Calendar` or `Start Now`).
* **Velocity Variance Metrics**: Live calculation of Expected vs Actual vs $\\Delta\\text{ Variance}$ hours on every planned work block and ERPNext Timesheet.

### 4. ⚖️ Temporal Governance & Anti-Fraud Architecture
Enterprise timesheets require strict auditability. OmniTrack enforces strict business rules at the database engine level:
* **The 2-Day Timesheet Horizon**: Regular associates (`OmniTrack User`) can only create, edit, or adjust timesheet entries for **today and yesterday** (`session_date >= add_days(nowdate(), -1)`). Any historical back-filling strictly requires an `OmniTrack Manager` or System Administrator.
* **Historical Plan Immutability**: In the past (`work_date < nowdate()`), **NO ONE**—not even System Managers or Administrators—can modify, reschedule, move, or delete planned work blocks. Initial plan commitments remain permanent historical records.

### 5. 🌐 Zero-Trust Cross-Site Cryptographic Synchronization
Manage a parent headquarters with distributed regional branches, franchised studios, or offshore subsidiaries?
* **HMAC-SHA256 Signed Replication**: Peer-to-peer and master-satellite task and timesheet replication over secure Frappe REST APIs with zero database credential sharing.
* **Monotonic Checksum Verification**: Every payload is verified against a monotonic SHA-256 hash to guarantee zero in-transit tampering.
* **Granular White-Labeling**: Customer-facing workspace isolation ensuring clients only view their authorized deliverables.

### 6. 🤖 Autonomous Attendance Synthesis
Eliminate manual biometric punch reconciliation and attendance disputes.
* **Synthesis from Ground Truth**: Synthesizes standard Frappe/ERPNext `Attendance` records directly from validated timesheet sessions and check-in logs.
* **Configurable Cutoffs & Grace Windows**: Configurable midnight cutoff thresholds (default `04:00:00`) prevent graveyard and overnight shifts from falsely tripping "Absent" or "Late Entry" penalties.

---

## 🏛️ System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["Client & Associate Layer"]
        Workstation["💻 OmniTrack Workstation SPA (/omnitrack)"]
        MobilePWA["📱 Mobile Responsive PWA"]
        ElevationModal["🔍 Full-Focus Elevation Modal (Shift+S)"]
    end

    subgraph ControllerLayer ["Real-Time Controller & Event Bus"]
        SocketIO["⚡ Frappe Socket.IO Real-Time Engine"]
        RedisCache["🚀 Redis Cache & Session State"]
        API["⚙️ OmniTrack REST / Whitelisted API (api.py)"]
    end

    subgraph GovernanceLayer ["Temporal Governance & Validation"]
        HorizonGuard["⏳ 2-Day Horizon Guard (Today & Yesterday)"]
        ImmutabilityGuard["🔒 Historical Plan Immutability (work_date < today)"]
        HTML5ParserGuard["🛡️ Spec-Compliant HTML5 Tree Guard (check_www_html.py)"]
    end

    subgraph CoreDocTypes ["OmniTrack Core Domain"]
        PWB["📅 Planned Work Block (Split-Shifts)"]
        OWS["⏱️ OmniTrack Work Session (Incremental Lines)"]
        Settings["⚙️ OmniTrack Settings (Cutoffs & Tolerances)"]
    end

    subgraph ERPNextIntegration ["ERPNext & Frappe Integration"]
        Timesheet["📝 Standard ERPNext Timesheet"]
        Attendance["👤 Standard ERPNext Attendance"]
        SyncGateway["🔐 HMAC-SHA256 Cross-Site Sync Gateway"]
    end

    Workstation --> API
    MobilePWA --> API
    ElevationModal --> API
    API <--> RedisCache
    API --> SocketIO
    SocketIO -. Live Refresh .-> Workstation

    API --> HorizonGuard
    API --> ImmutabilityGuard
    HorizonGuard --> PWB
    ImmutabilityGuard --> PWB
    API --> OWS

    OWS --> Timesheet
    PWB --> Timesheet
    OWS --> Attendance
    PWB --> Attendance
    API --> SyncGateway
```

---

## 👥 Enterprise Role Profiles & Matrix

OmniTrack ships with 6 purpose-built security roles:

| Role Profile | Desk Access | Scope & Functional Boundaries |
| :--- | :---: | :--- |
| **`OmniTrack Admin`** | ✅ Yes | Global control plane: system settings, remote site links, global timesheet approvals, and override authorities. |
| **`OmniTrack Manager`** | ✅ Yes | Team-wide planning: calendar allocation, project velocity review, past-horizon timesheet adjustments, and team reports. |
| **`OmniTrack User`** | ✅ Yes | Associate self-service: personal split-shift booking, live stopwatch logging, ToDo binding, and 2-day timesheet editing. |
| **`OmniTrack Client`** | ✅ Yes | Client portal transparency: strictly scoped to projects linked to their Customer entity and tasks marked `custom_is_public_deliverable = 1`. |
| **`OmniTrack Auditor`** | ✅ Yes | Read-only compliance oversight across all historical timesheets, work logs, plan revisions, and attendance records. |
| **`OmniTrack Sync Agent`** | ❌ No | Headless service identity strictly authenticated for background HMAC-SHA256 cross-site data replication. |

---

## ⌨️ Power-User Keyboard Navigation

OmniTrack Workstation is built for keyboard-first velocity:

| Shortcut | Context | Action |
| :---: | :---: | :--- |
| <kbd>Shift</kbd> + <kbd>S</kbd> | Anywhere | **Toggle Full-Focus Session**: Elevates active session into full-screen focus or starts an unplanned session. |
| <kbd>Esc</kbd> | Elevation Popup | **Minimize**: Returns the session box to the standard header view. |
| <kbd>Enter</kbd> | Micro-Logger Input | **Record Milestone**: Stamps line with current session duration and clears input for next line. |
| <kbd>Tab</kbd> | Micro-Logger Input | **Fast Navigation**: Steps directly to the Stop & Save action button. |
| <kbd>/</kbd> | Workstation | **Filter Screen**: Activates quick in-page search and filter dropdowns. |
| <kbd>Shift</kbd> + <kbd>`</kbd> | Desk | **Quick Menu**: Opens user profile, workspace settings, and theme dropdown. |

---

## 🚀 Quick Start & Installation

### 1. Installation via Frappe Bench

```bash
# Navigate to your frappe-bench directory
cd /path/to/frappe-bench

# Get the OmniTrack app
bench get-app https://github.com/OmmNoMi/omnitrack.git

# Install onto your target site
bench --site [your-site-name] install-app omnitrack

# Run database schema migrations
bench --site [your-site-name] migrate

# Clear application and website cache
bench --site [your-site-name] clear-cache
bench --site [your-site-name] clear-website-cache
```

### 2. Frontend Development & Building Assets

OmniTrack uses Vite and Tailwind CSS for high-performance frontend compilation:

```bash
# Navigate to the OmniTrack app directory
cd apps/omnitrack

# Install frontend dependencies
npm install

# Compile production bundles
npm run build
```

---

## 🧪 Testing & Verification Protocols

OmniTrack adheres to strict zero-regression engineering standards:

### 1. Spec-Compliant HTML5 Tree Verification
Because Frappe in-DOM templates (`www/*.html`) are parsed by the browser's native HTML5 parser, OmniTrack includes an automated tree-construction validator using `html5lib`:

```bash
# Verify all portal templates parse cleanly without premature tag closures
python3 apps/omnitrack/scripts/check_www_html.py
```

### 2. Automated Frappe Backend Test Suite
Run the automated Python unit tests covering split-shift synthesis, midnight splitting, and temporal governance:

```bash
bench --site [your-site-name] run-tests --app omnitrack
```

---

## 📄 License & Legal Notice

Distributed under the **GNU General Public License v3.0 (GPLv3)**. See [license.txt](license.txt) for details.

---

<p align="center">
  <span style="font-family:'Roboto',sans-serif;font-weight:900;">
    <span style="color:#4285f4;">Omm</span><span style="color:#34a853;">No</span><span style="color:#ea4335;">M</span><span style="color:#fbbc05;">i</span>
  </span> Automation LLP<br>
  <i>Architecting Next-Generation Operational Ecosystems</i><br>
  Mahunag · Karsog · Mandi, Himachal Pradesh, India<br>
  🌐 <a href="https://ommnomi.in">https://ommnomi.in</a> • 📧 <a href="mailto:omnitrack@ommnomi.com">omnitrack@ommnomi.com</a>
</p>
