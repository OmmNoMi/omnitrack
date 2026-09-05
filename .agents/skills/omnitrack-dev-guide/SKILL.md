---
name: omnitrack-dev-guide
description: >-
  Comprehensive guide and operational runbook for OmniTrack development, split-shift engine,
  Vue 3 PWA Workstation, AppSheet historical data migration, and multi-bench synchronization.
---

# OmniTrack Developer & Engineering Guide

OmniTrack is a Universal Workforce, Split-Shift Engine, and Task Sync application for Frappe Framework v15 & v16, developed by **OmmNoMi Automation LLP**.

---

## 1. Architecture Overview

- **Core Module**: Split-shift synthesis, multi-session punch pairing, 04:00 AM cutoff tolerance, and Plan Adherence Index (PAI).
- **Frontend Interfaces**:
  - **Frappe Desk**: Workspace navigation (`/app/omnitrack`), custom navbar stopwatch widget, keyboard shortcut `Ctrl+Shift+T`.
  - **PWA Workstation**: Standalone Vue.js 3 single-page application at `/omnitrack`.
- **Inter-Bench Sync**: REST & SHA-256 HMAC signed payloads for multi-bench task synchronization.

---

## 2. Key Developer Rules & Invariants

### Jinja2 & Vue.js 3 Template Safety
When developing Frappe `www/` HTML pages (e.g. `omnitrack/www/omnitrack.html`):
- Jinja2 will attempt to evaluate Vue's `{{ ... }}` mustache tags on the server, causing **Server Error 417**.
- **Always** enclose Vue template sections and client scripts inside Jinja2 `{% raw %} ... {% endraw %}` blocks.
- Keep server-rendered variables (e.g., `{{ title }}`) outside raw blocks.

### Historical Data Migration & Company Splitting
- **Cut-Off Date**: `2024-09-02`.
  - Records before `2024-09-02` belong to company **`Nomeshwar Sharma`**.
  - Records on/after `2024-09-02` belong to company **`OmmNoMi Automation LLP`**.
- **Data Model**: AppSheet phases are mapped directly into native Frappe `Project` and `Task` documents. No standalone `Phase` DocType is used.
- **Audit Hash**: Every `Planned Work Block` record must have a deterministic SHA-256 hash stored in `cryptographic_hash`.

### Zero Confidential Data in Git
- Never stage or commit `.csv`, `Empire_NoMi*`, or personal customer time logs.
- Strict `.gitignore` must be maintained at the repository root.

---

## 3. Useful Commands & Workflows

### Bench Operations
```bash
# Start bench
bench start

# Clear cache & migrate
bench --site <site_name> clear-cache
bench --site <site_name> migrate

# Execute tests
bench --site <site_name> run-tests --app omnitrack
```

### Git Branching
```bash
# Active development
git checkout develop

# Split-shift engine feature branch
git checkout feat/core-split-shift-engine

# Release to main
git checkout main
git merge develop
git push origin main
```

### API Endpoints
- `GET /api/method/omnitrack.api.get_workstation_data`: Fetches today's planned blocks, heatmap, projects, tasks, PAI metrics, and synthesizer status.
- `POST /api/method/omnitrack.api.quick_timer_punch`: Records live punch in/out and updates active Planned Work Block.
- `POST /api/method/omnitrack.api.toggle_work_block_status`: Toggles block status between Planned / Completed / In Progress.
- `POST /api/method/omnitrack.api.create_planned_work_block`: Creates a new Planned Work Block linked to Project and Task.
