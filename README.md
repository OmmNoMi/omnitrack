# OmniTrack: Universal Workforce, Task Sync & Split-Shift Engine

<div align="center">

<p align="center">
  <span style="font-family:'Roboto',sans-serif;font-weight:900;font-size:24px;">
    <span style="color:#4285f4;">Omm</span><span style="color:#34a853;">No</span><span style="color:#ea4335;">M</span><span style="color:#fbbc05;">i</span>
  </span> 
  <span style="font-family:'Roboto',sans-serif;font-weight:700;font-size:24px;color:#1e293b;">Automation</span>
</p>

[![Frappe Framework](https://img.shields.io/badge/Frappe%20Framework-v15%20%7C%20v16-4285F4.svg?style=for-the-badge&logo=frappe&logoColor=white)](https://frappeframework.com)
[![ERPNext](https://img.shields.io/badge/ERPNext-v15%20%7C%20v16-34A853.svg?style=for-the-badge&logo=frappe&logoColor=white)](https://erpnext.com)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-EA4335.svg?style=for-the-badge)](https://www.gnu.org/licenses/gpl-3.0)
[![Status: Production Ready](https://img.shields.io/badge/Status-Production%20Ready-673AB7.svg?style=for-the-badge)](#)
[![Sync Latency](https://img.shields.io/badge/Sync%20Latency-%3C%202.0s-FBBC05.svg?style=for-the-badge)](#)

<p align="center">
  <strong>Enterprise-grade, open-source Frappe application bridging internal workforce agility, split-shift flexibility, external client transparency, and live bidirectional cross-instance task synchronization.</strong>
</p>

---

</div>

## 📑 Document & Product Metadata

| Attribute | Specification |
| :--- | :--- |
| **Product Name** | **OmniTrack** (`omnitrack`) |
| **Document Ref** | `SRS-OMNITRACK-2026-V1.0.1` |
| **Standard** | IEEE 830-1998 / ISO/IEC/IEEE 29148 |
| **Publisher & Maintainer** | **OmmNoMi Automation LLP** |
| **Contact Email** | `omnitrack@ommnomi.com` / `ommnomi.automation@gmail.com` |
| **Sister Project** | **OmniDesk** (UI/UX & Productivity Enhancement Layer for Frappe Desk) |
| **Target Platform** | Frappe Cloud Marketplace, Frappe Framework v15/v16+, ERPNext v15/v16+ |
| **License** | GNU General Public License v3.0 (GPLv3) |

---

## 🌟 Executive Summary & Core Pillars

**OmniTrack** is engineered for modern knowledge work, consulting, software engineering, and digital agency operations where discontinuous working blocks, client transparency, and cross-site synchronization are essential.

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                     OmniTrack Core Pillars                                      │
 ├───────────────────────────────┬─────────────────────────────────┬───────────────────────────────┤
 │  🛡️ Configurable RBAC Matrix  │  ⚡ Instant Web Push Engine     │  ⏳ Discontinuous Split-Shift │
 │  • Granular capability flags  │  • W3C Web Push & VAPID RFC8291 │  • Non-linear 12h AM/PM blocks│
 │  • Multi-tier role governance │  • Smart leave-aware silencing  │  • Zero shift overlap errors  │
 │  • Tenant isolation queries   │  • Closed-tab OS notification   │  • Overlap & concurrency calc │
 ├───────────────────────────────┼─────────────────────────────────┼───────────────────────────────┤
 │  🔗 Dynamic Document Links    │  🌐 Subdomain Client Portals    │  🔄 Site-to-Site Live Sync    │
 │  • ERPNext doc attachments    │  • `clientdomain.ommnomi.com`   │  • Field-Level Merge engine   │
 │  • Figma, GitHub, Loom URLs   │  • White-label custom branding  │  • Non-destructive cancellation│
 │  • Native Frappe File engine  │  • Dual internal/external mode  │  • Bi-directional HMAC REST   │
 └───────────────────────────────┴─────────────────────────────────┴───────────────────────────────┘
```

---

## 🏛️ System Architecture

```
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                      User Client Workstations                                           │
 │   Chromebook (ChromeOS)   │   Windows 11 Workstation   │   macOS Studio   │   Mobile Browser (PWA)      │
 └───────────────────────────┬───────────────────────────────────────────────┬─────────────────────────────┘
                             │                                               │
            ┌────────────────▼────────────────┐             ┌────────────────▼────────────────┐
            │    Google Chrome Extension      │             │  Native Frappe Desk PWA / Web   │
            │   (Manifest V3 Multi-Profile)   │             │   (Enhanced with OmniDesk)      │
            │                                 │             │                                 │
            │  • OAuth2 PKCE One-Click Auth   │             │  • Native Calendar & Split Grid │
            │  • Quick-Link HUD (Cmd/Ctrl+K)  │             │  • Dynamic Document Linker      │
            │  • Contextual Gmail Clipper     │             │  • Native Frappe File Manager   │
            │  • Direct Timeline Commenter    │             │  • Web Push Service Worker      │
            │  • Email File Attachment Relay  │             │  • Smart Leave-Aware Silencing  │
            └────────────────┬────────────────┘             └────────────────┬────────────────┘
                             │                                               │
                             └───────────────────────┬───────────────────────┘
                                                     │ Frappe REST API (OAuth2 / Token) / Web Push
 ┌───────────────────────────────────────────────────▼─────────────────────────────────────────────────────┐
 │                           OmniTrack Core App Package (`omnitrack`)                                      │
 │                               (Published by OmmNoMi Automation LLP)                                     │
 │                                                                                                         │
 │   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │
 │   │               OmniTrack Settings Engine (100% Declarative Configuration)                        │   │
 │   │   • Multi-Tier RBAC & Policy Guard    • Push Notification Gateway     • Split-Shift Engine     │   │
 │   │   • User/Role Capability Matrix       • Timesheet Lifecycle Rules     • White-Label Branding   │   │
 │   │   • Field-Level Merge Sync Protocol   • Plan Adherence (PAI) Rules    • Attachment Sync Rules  │   │
 │   └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
 │                                                                                                         │
 │   ┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌─────────────────────────────┐   │
 │   │ Role & Capability Guard       │ │ To-Do Change & Push Dispatch  │ │ Expectation Variance Engine │   │
 │   │ (Admin/Mgr/User/Client/Audit) │ │ (VAPID Web Push, Raven, Desk) │ │ (Expected vs Actual Hours)  │   │
 │   └───────────────────────────────┘ └───────────────────────────────┘ └─────────────────────────────┘   │
 │                                                                                                         │
 │   ┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌─────────────────────────────┐   │
 │   │ Planned Work Block Processor  │ │ Attendance Synthesizer        │ │ Task Connection & Files     │   │
 │   │ (Discontinuous 12h AM/PM)     │ │ (ERPNext Punch -> Attendance) │ │ (Files, ERPNext Docs, URLs) │   │
 │   └───────────────────────────────┘ └───────────────────────────────┘ └─────────────────────────────┘   │
 │                                                                                                         │
 │   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐   │
 │   │ Client Engagement & Hybrid Tenancy Layer                                                        │   │
 │   │   ┌──────────────────────────────────────────────┐ ┌─────────────────────────────────────────┐ │   │
 │   │   │ Subdomain SaaS Workspace (Option A)          │ │ Site-to-Site Live Sync Hub              │ │   │
 │   │   │ (`clientdomain.ommnomi.com`)                 │ │ (Frappe-to-Frappe OmniTrack Link)       │ │   │
 │   │   │ Frappe Permission Query isolation            │ │ Field-Level Merges & Soft Unlinking     │ │   │
 │   │   │ White-labeled theme & internal client tasks  │ │ Live bidirectional task & file sync     │ │   │
 │   │   └──────────────────────────────────────────────┘ └─────────────────────────────────────────┘ │   │
 │   └─────────────────────────────────────────────────────────────────────────────────────────────────┘   │
 └───────────────────────────────────────────────────▲─────────────────────────────────────────────────────┘
                                                     │
                                                     │ Bi-Directional Event Stream / REST
                                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                External Client Frappe / ERPNext Site                                    │
 │                       (Client's Self-Hosted or Frappe Cloud OmniTrack Instance)                         │
 │                                                                                                         │
 │  • Client Internal Tasks & To-Dos          • Live Mirrored Tasks, Files & Links from OmmNoMi            │
 │  • Synchronized Statuses & Progress        • Real-Time Threaded Timeline Comments & Push Alerts         │
 └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Capabilities & Functional Specifications

### 1. 100% Declarative Configuration Engine
Governed centrally by the **`OmniTrack Settings`** Single DocType:
- **Feature Switches**: Toggle Split Shifts, PAI Engine, Task Variance, Dynamic Links, Attendance Synthesizer, Subdomain Workspaces, White-Labeling, Live Site Sync, and Web Push.
- **Entitlement Matrix**: Granular per-user and per-role flags for timesheet tracking, task creation, split planning, manager overrides, and push alert subscription.
- **Configurable Timesheet Lifecycle**:
  - *Modes*: `Off`, `Manual On-Demand`, `Auto Draft`, `Auto Sync Draft`.
  - *Frequencies*: `Timelog (Per Work Block)`, `Daily Consolidated`, `Weekly Consolidated`, `Bi-Weekly Consolidated`, `Monthly Consolidated`.
  - *Aggregation*: `Individual User` vs `Consolidated Project`.
  - *Manager Sign-Off*: Mandatory pricing and rate sign-off before submission to core ERPNext accounting/payroll.

### 2. Frappe-Native Discontinuous Split-Shift Engine
- Register $N \ge 1$ discontinuous planned work intervals per day via the **`Planned Work Block`** DocType.
- Native 12-hour AM/PM time representation (`hh:mm A`).
- Automatic duration calculation, flexible re-scheduling, location tagging (Office / Remote / Hybrid), and nature categorization (🎯 Planned vs ⚠️ Unplanned).
- Concurrency and meeting overlap calculation:
  $$	ext{Concurrency}(h) = \sum_{i=1}^{M} 	ext{IsActive}(employee_i, h) \quad 	ext{for } h \in [0, 23]$$

### 3. Plan Adherence (PAI $\ge 85\%$) & Task Variance Engine
- **Plan Adherence Index**:
  $$	ext{PAI} = \left(rac{\sum 	ext{Planned Hours Completed}}{\sum 	ext{Total Hours Logged}}ight) 	imes 100$$
- **Task Estimation Variance**: Computes $\Delta = 	ext{Actual Hours} - 	ext{Expected Hours}$. If $\Delta > 	ext{threshold}$, mandates an explanatory Form Timeline comment and dispatches an alert to the project manager.

### 4. Dynamic Context, Files & Document Linking
- Direct links to standard Frappe DocTypes (*Sales Order, Issue, Quotation, Purchase Order, Sales Invoice, Lead*).
- Support for external URLs (*Figma, Google Drive, GitHub PRs/Issues, Loom*).
- Native Frappe File engine integration with Form Timeline logging.

### 5. Multi-Tenant Subdomain SaaS Workspaces & White-Labeling
- Single-bench deployment with dedicated subdomain routing (`clientdomain.ommnomi.com`).
- Enforced tenant isolation via Frappe `get_permission_query_conditions`.
- White-label custom client logos, brand accent colors, custom welcome headers, and support URLs.
- Dual mode: Contracted deliverable tracking + Internal client workforce tool.

### 6. Site-to-Site Live Sync (Frappe-to-Frappe)
- Live bidirectional REST sync between independent benches.
- **Field-Level Merge Engine**: Cleanly merges disjoint concurrent updates without overwriting.
- **Non-Destructive Deletion**: Remote deletions transition records to `Cancelled`/`Archived`, preserving historical logs and timesheets.
- Rate sanitization to protect commercial pricing confidentiality during sync.

### 7. Native Web & Mobile Push Notification Engine
- Standards-compliant W3C Web Push using RFC 8291 / RFC 8292 encryption with VAPID.
- **Leave-Aware Silencing**: Integrates with ERPNext Leave Applications to automatically silence push notifications on approved leaves while delivering during unplanned shift gaps.
- OS-level closed-tab notifications with interactive actions (*View Task, Mark Completed, Acknowledge*).

---

## 👥 Multi-Tier Role Governance Matrix

| Role | Target Workspace | Primary Responsibilities & Capabilities |
| :--- | :--- | :--- |
| **OmniTrack Admin** | `OmniTrack Command Center` | Full system governance, VAPID key generation, subdomain provisioning, remote connections, global policies. |
| **OmniTrack Manager** | `Operations & Delivery Hub` | Team task orchestration, timesheet review & rate sign-off, variance & PAI analytics ($\ge 85\%$), capacity allocation. |
| **OmniTrack User** | `My Workstation` | Personal discontinuous split planner, stopwatch timer, assigned To-Dos/Tasks, personal GitHub-style streak. |
| **OmniTrack Client** | `Client Transparency Portal` | Subdomain portal access, live milestone ETAs, public deliverables, white-labeled interface. |
| **OmniTrack Auditor** | `Audit & Compliance Matrix` | Read-only compliance review, cryptographic check-in hashes (`chk-8a1f9e`), variance overrun justifications. |
| **OmniTrack Sync Agent** | *Headless / API Only* | Machine-to-machine authenticated REST synchronization and HMAC payload verification. |

---

## 🚀 Installation & Quick Start

### 1. Fetch and Install App
```bash
# In your Frappe bench directory:
bench get-app https://github.com/OmmNoMi/omnitrack

# Install on your target site:
bench --site ommnomi.local install-app omnitrack

# Run site migrations:
bench --site ommnomi.local migrate
```

### 2. Verify Installation
```bash
# Check app status via bench console:
bench --site ommnomi.local execute omnitrack.api.get_system_status
```

---

## ⚙️ Configuration Guide

1. Navigate to **OmniTrack Command Center** or search for **OmniTrack Settings** in Frappe Desk.
2. Enable desired feature switches (*Split-Shifts, PAI, Live Sync, Push Notifications*).
3. Generate or configure your **VAPID Keys** for Web Push.
4. Set your organizational **User Entitlements** and **Project Timesheet Policies**.
5. If connecting external Frappe instances, create an **OmniTrack Remote Connection** record with remote API credentials.

---

## 📄 License & Attribution

- **License**: GNU General Public License v3.0 (GPLv3)
- **Author & Copyright**: © 2026 **OmmNoMi Automation LLP** (`omnitrack@ommnomi.com`)
- Mahunag · Karsog · Mandi, HP, India · **OmmNoMi Automation LLP**
