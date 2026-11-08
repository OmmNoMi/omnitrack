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

### 500-Line File-Size Limit (`scripts/check_file_size.cjs`)
- No source file under `src/**` may exceed 500 lines.
- Decompose large components and composables into focused context modules rather than letting them grow past the limit.

### Frappe v16 Desk Workspace & Branding Invariant
- `hooks.py` must define `app_home = "/desk/omnitrack"` and `add_to_apps_screen` so Frappe v16 populates `frappe.boot.app_data` and renders the brand logo in the Desk header and apps screen.
- Never expose technical sync tables (`OmniTrack Task Sync`, etc.) in primary sidebars; keep navigation streamlined with label lengths $\le 20$ chars.

### Tailwind Preset Breakpoint & Font-Weight Invariant
- The `frappe-ui` Tailwind preset overrides `screens` without a `2xl` breakpoint.
- Whenever using `2xl:` classes in `src/**`, ensure `tailwind.config.cjs` declares `'2xl': '1536px'` in `theme.extend.screens`.
- Breakpoint text sizes (e.g. `sm:text-xl`) reset font-weight to 400/420 in frappe-ui's preset. Always declare the font-weight at the breakpoint explicitly (e.g. `sm:font-bold`, `2xl:font-extrabold`).
- Run `npm run test:static` (`node scripts/check_palette_classes.cjs`) to verify that all 1,600+ color, radius, and breakpoint utilities resolve against the active theme.

### Mobile Overlay Back Navigation & Composable Standards
- Always use `useOverlayHistory` from `src/composables/useOverlayHistory.js` when creating modals, drawers, or floating HUDs.
- Never write manual `popstate` listeners or call raw `history.pushState` directly inside UI components.
- Never handle `popstate` without verifying that the event state ID matches the overlay.
- Never mark a PR as `Closes #X` if only a subset of acceptance scenarios are completed; use `Refs #X`.

### Comprehensive Governance SOP
- For full details on dual-lane timeline invariants, live active stopwatch sessions, ERPNext timesheet sync modes, audio accessibility (WCAG), and stage ladders, see:
  `omnitrack-workstation-governance` ([SKILL.md](../omnitrack-workstation-governance/SKILL.md)).

---

## 3. Useful Commands & Workflows

### Quality Gates & Verification
```bash
# Full 3-pillar pre-push gate (Security, A11y, TDD++)
npm run gate

# Fast unit tests & static syntax/template checks
npm run test:fast && npm run test:static

# Mutation testing verification (100% kill score required)
npm run test:mutation

# HTML5 spec-compliant tree validation
/Users/ommnomi/frappe-bench/version-16/env/bin/python ./scripts/check_www_html.py
```

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
