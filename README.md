# OmniTrack (Universal Workforce, Task Sync & Split-Shift Engine)

<p align="center">
  <a href="https://github.com/OmmNoMi/omnitrack">
    <img src="omnitrack/public/images/omnitrack_icon.svg" width="128" height="128" alt="OmniTrack Icon">
  </a>
</p>

<p align="center">
  <b>Universal Workforce, Task Sync & Split-Shift Engine for Frappe Framework & ERPNext</b>
</p>

<p align="center">
  <a href="https://github.com/OmmNoMi/omnitrack/actions/workflows/ci.yml"><img src="https://github.com/OmmNoMi/omnitrack/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/OmmNoMi/omnitrack/releases"><img src="https://img.shields.io/github/v/release/OmmNoMi/omnitrack?color=00E5FF&label=version" alt="Latest Release"></a>
  <a href="license.txt"><img src="https://img.shields.io/badge/License-GPL%20v3.0-blue.svg" alt="License: GPL v3.0"></a>
  <a href="https://frappe.io"><img src="https://img.shields.io/badge/Frappe-v15%20%7C%20v16-4285F4.svg" alt="Frappe Framework"></a>
  <a href="https://ommnomi.in"><img src="https://img.shields.io/badge/Maintained%20by-OmmNoMi-34A853.svg" alt="OmmNoMi Automation LLP"></a>
</p>

---

## 🌟 Overview

**OmniTrack** is an enterprise-grade Frappe Framework and ERPNext application engineered by **OmmNoMi Automation LLP**. It provides complete operational infrastructure for:

* **Discontinuous Split-Shift Management**: Seamlessly plan, track, and log morning, afternoon, and evening work intervals without forcing artificial full-day contiguous blocks.
* **Autonomous Cross-Site Data Synchronization**: Bidirectional, HMAC-SHA256 authenticated sync of Tasks, ToDos, Timesheets, and Attendance records across independent Frappe sites.
* **Task Variance & Velocity Engine**: Real-time variance tracking (`Expected Hours` vs `Actual Hours` vs `Δ Variance`), automated check-in hashing, and deadline management.
* **Granular Role-Based Access Control**: Tailored workspaces for Administrators, Delivery Managers, Field Workers, Compliance Auditors, and External Clients.

---

## 🚀 Key Modules & DocTypes

| DocType | Type | Description |
| :--- | :--- | :--- |
| **`Planned Work Block`** | Core Transaction | Tracks discontinuous split shifts with AM/PM support and check-in token generation. |
| **`OmniTrack Settings`** | Single Configuration | Central controls for auto-attendance synthesis, VAPID Web Push, and sync thresholds. |
| **`OmniTrack Remote Connection`** | Integration | Remote Frappe site connections with HMAC-SHA256 signature verification. |
| **`OmniTrack Workspace`** | Configuration | Client portal workspace definitions and white-labeling rules. |
| **`OmniTrack Context Link`** | Cross-Reference | Maps tasks to custom parent records (Projects, Sales Orders, Issues). |
| **`OmniTrack Linked Document`** | Child Table | Tracks individual document links across remote sites. |
| **`OmniTrack Push Subscription`** | System | Manages Web Push notification subscriptions. |

---

## 📦 Installation

### Using Frappe Bench

```bash
# 1. Fetch the app into your bench
bench get-app https://github.com/OmmNoMi/omnitrack.git

# 2. Install onto your target site
bench --site [your-site-name] install-app omnitrack

# 3. Run database migrations
bench --site [your-site-name] migrate
```

---

## 🧪 Testing & CI

Run the automated test suite locally:

```bash
bench --site [your-site-name] run-tests --app omnitrack
```

---

## 🤝 Contributing

We welcome community contributions! Please review:
* [CONTRIBUTING.md](CONTRIBUTING.md) for pull request guidelines and coding standards.
* [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community etiquette.
* [SECURITY.md](SECURITY.md) for reporting security vulnerabilities.

---

## 📄 License & Maintainer

Distributed under the **GNU General Public License v3.0 (GPLv3)**. See [license.txt](license.txt) for details.

Developed & Maintained with pride by:  
**<span style="font-family:'Roboto',sans-serif;font-weight:900;"><span style="color:#4285f4;">Omm</span><span style="color:#34a853;">No</span><span style="color:#ea4335;">M</span><span style="color:#fbbc05;">i</span></span> Automation LLP**  
Mahunag · Karsog · Mandi, Himachal Pradesh, India  
📧 Contact: [omnitrack@ommnomi.com](mailto:omnitrack@ommnomi.com) • 🌐 Website: [https://ommnomi.in](https://ommnomi.in)
