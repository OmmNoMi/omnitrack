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

## Domain Model (read this first)
- **`docs/DOMAIN_MODEL.md` is canonical** for what Project, Task, Planned Work Block and Work Session mean. Where code disagrees with it, the code is the bug.
- The four layers answer four different questions — **Project = for whom, Task = what, Planned Work Block = when, Work Session = did**. Never collapse Block and Session: a Block is a *commitment made before* the work, a Session is a *child row recording* the work. `quick_timer_punch` creating a Planned Work Block on Stop is the defect that motivated the document.
- Never write the word "timesheet" unqualified. Say **Work Session** (child row), **Planned Work Block** (commitment), or **ERPNext Timesheet** (billing doc, absent on `ommnomi.local`).

## Frappe Engineering Rules
- **100% Configuration Driven**: Keep all features toggleable via `OmniTrack Settings`.
- **Zero Monkey Patching**: Standard hooks, DocEvents, and Permission Queries only.
- **REST & HMAC Security**: All inter-bench live sync endpoints must sign and verify payloads via SHA-256 HMAC.

## Deployment-Specific Gotchas (learned the hard way)
- **`ommnomi.local` has no ERPNext/HRMS.** No `Project`, `Task`, `Timesheet`, `Employee`, `Leave` doctypes — only core Frappe `ToDo`. Assigned work is sourced from `ToDo` (ids carry a `todo:` prefix). Guard every optional-doctype reference with `frappe.db.exists("DocType", "<name>")` or the page 500s on that site while working fine on ERPNext sites.
- **CSRF token on `www/` pages: never read `frappe.local.session.data.csrf_token` directly.** For Administrator / freshly-created sessions it is `None`, which renders as the literal string `"None"` (or `""`) into the page and makes client POSTs fail. Use `from frappe.sessions import get_csrf_token; ctx.csrf_token = get_csrf_token()` — it generates *and persists* a token so `X-Frappe-CSRF-Token` validates. (`omnitrack/www/omnitrack.py`.)
- **Frappe returns HTTP 417 for *any* server-side `frappe.throw` / `ValidationError`, not only CSRF failures.** When a whitelisted call 417s, read `response.exception` / `_server_messages` before assuming it is a token problem — it is usually a Select-field option mismatch or a validation error.
- **Select-field option changes need `bench --site <site> migrate`.** Editing `options` in `planned_work_block.json` (e.g. adding `🌴 Leave` / `🤒 Absent` to `task_nature`) does nothing until migrate syncs the DocType; until then inserts with the new value throw "cannot be … It should be one of …".

## Jinja2 & Vue.js 3 Template Rules
- **Escape Vue Mustache Syntax**: When building single-page applications or portals inside Frappe's `www/` directory (e.g., `omnitrack.html`), always wrap Vue 3 template tags in Jinja2 `{% raw %} ... {% endraw %}` blocks to prevent Jinja evaluation collisions and **Server Error 417**.
- **Responsive & Zero-Overflow UI**: All PWA UI components must use Vue 3 with responsive styling, Frappe UI design tokens, and no horizontal or vertical layout overflow.

## Historical Data Migration & Company Splitting
- **Company Splitting Cut-Off Date**: `2024-09-02`.
  - All timesheets, timelogs, and work blocks dated **before 2024-09-02** belong to company `Nomeshwer Sharma` (dynamically match `Nomeshwar Sharma` if needed).
  - All timesheets, timelogs, and work blocks dated **on or after 2024-09-02** belong to company `OmmNoMi Automation LLP`.
- **Native Project & Task Hierarchy**: Historical AppSheet phases are flattened and consolidated directly into native Frappe `Project` and `Task` documents. Do not create an intermediary `Phase` DocType.
- **Cryptographic Auditability**: All imported or synthesized `Planned Work Block` records must carry a SHA-256 hash in `cryptographic_hash`.

## Cloud & Production Migration Invariants
- **Desk File Manager Ingestion**: On Frappe Cloud, CSV files are uploaded via Desk File Manager (`/app/file`). Importers must resolve them from `frappe.get_site_path("private", "files")` without requiring SSH/root access.
- **System Console Sandbox (`safe_exec`)**: Whitelist methods with `@frappe.whitelist()` and execute via `frappe.call(...)` to avoid `__import__ not found` errors.
- **ERPNext Group Tasks**: Parent milestone/phase tasks must always have `is_group = 1` set before child tasks reference them.
- **Bulk Insert**: Use `frappe.db.bulk_insert()` for datasets >1,000 records to prevent 60-second Gunicorn/Nginx HTTP timeouts.
- **Clean Request Hooks**: Never place bare `print()` statements in `before_request` hooks to avoid fatal `BrokenPipeError: [Errno 32]`.

## Confidential Data Protection
- Never commit raw customer timesheet CSVs or personal timelog dumps to git. Strict `.gitignore` rules must remain active for all `.csv`, `Empire_NoMi*`, and `media_*` files.

## Temporal Governance & Workstation Invariants
1. **Timesheet Modification Horizon**:
   - An `OmniTrack User` can only log, edit, or adjust timesheet entries and real work sessions for **today and yesterday** (`session_date >= add_days(nowdate(), -1)`).
   - Any timesheet entry, adjustment, or back-fill prior to yesterday strictly requires an `OmniTrack Manager` (or System Manager / Administrator).
   - Enforce in Python backend (`permissions.check_timesheet_date_permission`, `api.log_work_session`, `PlannedWorkBlock.validate()`, and `Timesheet` DocEvents) and in the frontend workstation drawer.

2. **Past Planned Work Blocks Lock (Historical Plan Immutability)**:
   - In the past (`work_date < nowdate()`), **NO ONE** (neither User nor Manager nor Administrator) can create, modify, reschedule, move, or delete planned work blocks.
   - Historical plan commitments are permanently immutable once their calendar day has elapsed.
   - Enforce in `book_work_block`, `update_work_block`, `delete_work_block`, `PlannedWorkBlock.validate()`, and `PlannedWorkBlock.on_trash()`.

3. **Workstation Session Terminology & UX Protocol**:
   - Action terminology for starting a timesheet session against a task/block is strictly **"Start Session"** with a Play icon (`▶`). Never use meeting/video metaphors such as "Join Focus Session".
   - A session started by mistake or abandoned can be thrown away without creating an empty timesheet using the 2-step **Discard** action.
   - Stopping a session with an empty line log must prompt for confirmation (`Stop anyway`) to prevent accidental blank timesheets.
   - On session stop, immediately snapshot elapsed time and reset the live stopwatch display to `00:00:00` so a standby HUD is never mistaken for an active running session.

4. **Web & Template Cache Clearing**:
   - Whenever editing Frappe portal/web views (`www/*.html`), always clear the site cache (`bench --site [sitename] clear-cache`) and re-verify before claiming fixes.



## Gotcha: the session HUD is NOT in `www/omnitrack.html`

The live "Current Session" card is `src/timesheet_session/SessionBox.vue`, built by
`yarn build` into `omnitrack/public/dist/timesheet_session_box.bundle.{js,css}`.
Editing the matching-looking markup in `www/omnitrack.html` changes nothing.
`www/omnitrack.html` owns only the chrome around it (the elevated popup shell,
the FAB, the page app).

## Gotcha: Jinja inside `{% raw %}` is not substituted

`www/omnitrack.html` wraps its whole body in `{% raw %}` (line ~106 to ~6663).
Any `{{ ... }}` inside reaches the browser literally. Two live bugs came from this:

* `<script src=".../timesheet_session_box.bundle.js?v={{ ... }}">` — the src was a
  fixed literal string, so the browser cached the bundle forever and rebuilt HUD
  code never shipped. Now the tag steps out with `{% endraw %}...{% raw %}` and
  uses `asset_bust` (the bundle's mtime, set in `www/omnitrack.py`).
* `const socketPort = {{ frappe.conf.socketio_port or 9003 }};` — the literal
  braces were a `SyntaxError` that killed the entire inline script and blanked
  the page.

## Gotcha: Vue inline handlers must be expressions

`@click="if (x) y = false"` is compiled as `$event => (if ...)` — a template
compile error that renders an empty `#app` with no useful console message. Use
`@click="x && (y = false)"`.

## Gotcha: `watch()` evaluates its source once at creation

Even a getter source (`() => dayTimeline.value`) throws if the ref is declared
later in `setup()`. Register such watches inside `onMounted()`.

## Gotcha: Frappe UI's Button drops `data-*` values

`data-session-tool="stop"` renders as `data-session-tool=""`. Usable as a marker,
never as a label — resolve identity positionally.

## Workflow

After editing `www/*.html`: `bench --site <site> clear-website-cache`, then reload
with a cache-busting query. After editing anything under `src/`: `yarn build` first.

## Gotcha: in-DOM templates are parsed by the browser, not by Vue

Everything under `omnitrack/www/*.html` is an in-DOM template. The browser's HTML
parser sees it first, so two things an SFC tolerates silently destroy the page:

* self-closing a non-void element (`<f-dropdown … />`) — the browser keeps it
  open and it swallows the rest of the document;
* nesting a control in a control (`<button>` inside `<button>`) — the parser
  closes the outer one early, every following `</div>` lands on the wrong
  element, and the close walks up through `<main>` and `#app`.

The symptom is not an error: `#app` ends up holding only HEADER/NAV/MAIN, the
rest of the markup spills into `<body>`, and raw `{{ mustaches }}` render.

Run `env/bin/python scripts/check_www_html.py` before shipping any `www/*.html`
edit. It parses with html5lib and fails on exactly those structural errors;
regex balancers and Python's `html.parser` both report these files as balanced.

## Gotcha: `restoreActiveSession` must carry the stop guard itself

`fetchWorkstationData` restored the server's `active_session` with no stop guard,
and the stop path calls it right after `sync_active_session(null)` — which is
fire-and-forget. The refresh raced the clear, found the row still active and put
the session straight back, so **Stop looked like it did nothing at all**. Guards
belong in `restoreActiveSession`, the one choke point every caller passes
through, not in each caller. The ended-session set is mirrored into
`localStorage` (`omnitrack_ended_sessions`) so a second tab cannot push a
stopped session back either.

## Gotcha: `document.body.style.overflow = 'hidden'` does not lock this page

`document.scrollingElement` here is `<html>`. A modal must set `overflow:hidden`
on `documentElement` as well as `body`. Note that scripted `window.scrollBy`
still moves an `overflow:hidden` page — verify the lock with
`getComputedStyle(document.scrollingElement).overflowY`, not by scripting a
scroll.

## Gotcha: Dropdown keyboard navigation leaks into grid shortcuts

When an attention grid or list view listens to keyboard events (`ArrowUp`, `ArrowDown`, `Home`, `End`), opening a dropdown menu inside a cell can cause keystrokes to bleed into the grid handler, moving rows in the background.

Two defensive layers are mandatory:
1. **Grid Shielding**: Global/grid keydown listeners MUST immediately return if the event originated inside an active menu:
   ```javascript
   if (ev.target && (ev.target.closest('[role="menu"]') || ev.target.closest('[data-f-dropdown-menu] [role="menu"]'))) {
     return;
   }
   ```
2. **Menu Event Containment**: The dropdown component must call `e.stopPropagation()` on all internal menu navigation keys (`ArrowDown`, `ArrowUp`, `Home`, `End`, `Escape`, `Enter`).
3. **Deterministic Focus Restoration**: When closing via `Escape` or item selection, focus must restore back to the invoking trigger button (`_triggerEl.focus()`).

## Gotcha: Truncated option labels must carry native title tooltips

Long workflow action labels (e.g., *"Convert to Sales Invoice with Linked Delivery Note"*) and state transitions truncate with `.truncate`. Without `:title="item.label"`, users cannot inspect the full string on hover and must click blindly. Always bind `:title="item.label"` on truncated text elements and enforce responsive max-width bounds (`max-w-[min(30rem,calc(100vw-2rem))]`).

