# 🚩 OmniTrack Release Milestones & Project Roadmap

This document defines the formal milestones, delivery targets, and functional scope for **OmniTrack: Universal Workforce, Task Sync & Split-Shift Engine**.

---

## 🎯 Milestone v1.0.0 — Foundation & Split-Shift Engine
**Target Release:** Q1 2026 • **Status:** Active / In Final Verification

### Objectives:
- [x] Frappe Framework v15 / v16 app initialization and asset bundling pipeline.
- [x] Control Plane: `OmniTrack Settings` with configurable `midnight_cutoff_hour`, `min_hours_present`, `min_hours_half_day`, `grace_period_mins`, and `sync_role_scope`.
- [x] Discontinuous Split-Shift Models: `OmniTrack Shift Template` with child table `OmniTrack Shift Session`.
- [x] Employee Assignment: `OmniTrack Shift Split Assignment` with rotation patterns (Fixed, Weekly, Bi-Weekly, Custom).
- [x] Split-Shift Synthesizer Engine: Real-time punch pairing with configurable `04:00:00` midnight cutoff correlation.
- [x] Audit Logging: `OmniTrack Attendance Synthesizer Log` capturing raw punch hashes and calculated durations.
- [x] Plan Adherence Index (PAI) & Task Variance tracking engine.

---

## 🚀 Milestone v1.1.0 — Enterprise Cross-Site Replication Engine
**Target Release:** Q2 2026 • **Status:** In Progress

### Objectives:
- [x] Queue & Hash Tracking: `OmniTrack Task Sync` with UUID and SHA-256 payload integrity hashing.
- [x] Secure REST Synchronization: HMAC-SHA256 request signing and secret verification.
- [x] Conflict Resolution Policies: Source Wins, Target Wins, Latest Timestamp, and Manual Review.
- [ ] Automated Background Sync Worker: Retry queue and exponential backoff scheduler.
- [ ] Bidirectional Timesheet & Project Replication across Master/Satellite topologies.

---

## 🎨 Milestone v1.2.0 — GitHub-Style Interactive Timesheet UI
**Target Release:** Q3 2026 • **Status:** Planned

### Objectives:
- [ ] **GitHub Contribution Heatmap**: Visual 7-day and 30-day streak cards with GitHub color progression (`#161b22`, `#0e4429`, `#006d32`, `#26a641`, `#39d353`).
- [ ] **Team-Wide Matrix Graph**: Side-by-side team attendance grid with `Less [ ] [ ] [ ] [ ] [ ] More` scale.
- [ ] **Git Commit-Style Audit Tags**: Monospace punch tags (`chk-8a1f`, `chk-9e32`) showing device and timestamp metadata.
- [ ] **Desk Live Timer Bar**: Persistent floating stopwatch in Frappe Desk with quick punches and task autocomplete switcher.
- [ ] **Mobile Touch Optimization**: Responsive UI with haptic/sound punch feedback.

---

## 🧠 Milestone v2.0.0 — AI Workforce Intelligence & Global Fleet Edition
**Target Release:** Q4 2026 • **Status:** Research / Backlog

### Objectives:
- [ ] Predictive Plan Adherence: AI-driven early detection of task slippage and schedule variance.
- [ ] Biometric Anomaly Detection: Automated flagging of buddy-punching and impossible travel velocities.
- [ ] Multi-Tenant SaaS Enterprise Portal: Subdomain white-label client workspaces.
- [ ] Global Cloud Marketplace release with 1-click deployment.
