# OmniTrack Developer & Agent Guidelines

These rules apply to all tasks and agents in the **`omnitrack`** repository.

## Brand Standards
- The company name MUST ALWAYS be written as **`OmmNoMi`** or **`OmmNoMi Automation LLP`** in footers.
- Brand Colors:
  - Blue (Ethical & Excellence): `#4285F4`
  - Green (Ecological & Equity): `#34A853`
  - Red (Entrepreneurial): `#EA4335`
  - Yellow (Enthusiasm): `#FBBC05`
  - Purple (Empowerment): `#673AB7`

## Git Attribution & Policy
- Follow strict OmmNoMi bench guidelines: do not include AI co-authorship trailers in git commits.
- Commits and pushes are strictly made on user instruction with author identity `OmmNoMi Automation <ommnomi.automation@gmail.com>`.
- Core branch flow: `develop` (active development), `feat/core-split-shift-engine` (feature work), `main` (production release).

## Frappe Engineering Rules
- **100% Configuration Driven**: Keep all features toggleable via `OmniTrack Settings`.
- **Zero Monkey Patching**: Standard hooks, DocEvents, and Permission Queries only.
- **REST & HMAC Security**: All inter-bench live sync endpoints must sign and verify payloads via SHA-256 HMAC.

## Jinja2 & Vue.js 3 Template Rules
- **Escape Vue Mustache Syntax**: When building single-page applications or portals inside Frappe's `www/` directory (e.g., `omnitrack.html`), always wrap Vue 3 template tags in Jinja2 `{% raw %} ... {% endraw %}` blocks to prevent Jinja evaluation collisions and **Server Error 417**.
- **Responsive & Zero-Overflow UI**: All PWA UI components must use Vue 3 with responsive styling, Frappe UI design tokens, and no horizontal or vertical layout overflow.

## Historical Data Migration & Company Splitting
- **Company Splitting Cut-Off Date**: `2024-09-02`.
  - All timesheets, timelogs, and work blocks dated **before 2024-09-02** belong to company `Nomeshwar Sharma`.
  - All timesheets, timelogs, and work blocks dated **on or after 2024-09-02** belong to company `OmmNoMi Automation LLP`.
- **Native Project & Task Hierarchy**: Historical AppSheet phases are flattened and consolidated directly into native Frappe `Project` and `Task` documents. Do not create an intermediary `Phase` DocType.
- **Cryptographic Auditability**: All imported or synthesized `Planned Work Block` records must carry a SHA-256 hash in `cryptographic_hash`.

## Confidential Data Protection
- Never commit raw customer timesheet CSVs or personal timelog dumps to git. Strict `.gitignore` rules must remain active for all `.csv`, `Empire_NoMi*`, and `media_*` files.
