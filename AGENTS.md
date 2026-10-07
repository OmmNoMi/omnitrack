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
- **Configuration changes behaviour, or it does not exist**: OmniTrack is one product configured per customer, for teams of any size and kind of work. A setting earns its place only if it changes what people see or what the app does. Today 15 of the 46 OmniTrack Settings fields are never read, and the 13 `enable_*` flags only feed `get_system_status`, which the app never calls (ROADMAP: "One app, configured per customer"). Never add a switch without the code that reads it. Prefer a few plain choices (how work is organised, who reviews time, whether clients see projects, where hours go) over many flags. Team size is never a setting: the app adapts to what it finds (managers get people pickers, a site with Projects gets the Projects page).
- **No customer is special in code**: who sees a project comes from `permissions.projects_for(user)`, never from a customer's name. `scripts/check_projects.mjs` fails on a customer name in `src/` or `omnitrack/`.
- **Zero Monkey Patching**: Standard hooks, DocEvents, and Permission Queries only.
- **REST & HMAC Security**: All inter-bench live sync endpoints must sign and verify payloads via SHA-256 HMAC.

## Deployment-Specific Gotchas (learned the hard way)
- **ERPNext and Frappe HR are optional.** `ommnomi.local` has ERPNext 16.50 (setup done, with demo data) and, since 2026-10-07, Frappe HR (`Employee Goal`, `Appraisal`, `Leave`). Other customer sites may have neither, and then assigned work comes from `ToDo` (ids carry a `todo:` prefix). Guard every optional-doctype reference with `frappe.db.exists("DocType", "<name>")` or the page 500s on one site while working on another. Never add them to `required_apps`. The boot's `has_projects` flag tells the app whether the Projects page exists. `scripts/check_optional_apps.mjs` guards the rules below.
- **`bench get-app` rewrites `sites/apps.txt`** from the `apps/` folder, so an app that is present but not installed (here `omniservey`) gets listed and every bench command fails importing it. Check `apps.txt` after any get-app.
- **ERPNext's asset build needs Node 24**, while the shell's default node is 18. OmniTrack's own `npm run build` works on 18. After `install-app`, restart the bench, or the running workers do not know the new app.
- **Adding a Project User sends a welcome email.** ERPNext's Project emails each new Project User whose `welcome_email_sent` is 0. When creating projects for a client from a script, set `welcome_email_sent=1` on each row unless the owner wants the invitation sent.
- **Frappe 16 `get_all` refuses an expression in `order_by`** ("Invalid field format in Order By"), for example `exp_end_date is null, exp_end_date asc`. Order by plain fields and sort in Python. `check_projects.mjs` guards it.
- **`Document._validate_links` runs before `validate`.** A controller cannot skip a link check from `validate` or `before_save`. A Link to a DocType the site lacks (Project, Task, Timesheet or Customer on a plain Frappe site) fails the save with "Options must be a valid DocType". Mix in `OptionalLinks` (`omnitrack/utils/optional_links.py`) before `Document` on any controller with such links.
- **Endpoints open to guests verify a signature first.** `receive_sync_event` accepts a payload only when an Active OmniTrack Remote Connection's HMAC secret signed it (`hmac.compare_digest`). There is no fallback secret. A whitelisted function that writes another person's records (`synthesize_employee_attendance`) checks the manager role itself, and internal callers use the unwrapped `_synthesize`.
- **A Time field keeps only the time of a date and time, with no error.** `start_time = "2026-10-08 10:45:00"` saves as 10:45 on the row's own `work_date`; the date is gone. Any hand parser that splits on ":" reads it as an hour of "2026-10-08 10" and fails, and `calculate_duration` used to swallow that and write 0.0. Read every incoming block time with `omnitrack/utils/block_slot.py` (`block_slot`, `split_stamp`, built on `frappe.utils` `get_time`/`get_datetime`/`getdate`), before any past-date check or write, and turn its `ValueError` into a `frappe.ValidationError`. Never write another parser (`time_math.pad_time`, `mins_of` and `time_str` use `get_time` too): `frappe.utils` already reads times, datetimes and the timedelta a Time field comes back as (`get_time(timedelta(days=1))` is midnight, MariaDB's 24:00:00).
- **Frappe's `assign_to.add` checks the caller, not the assignee, and it notifies.** It refuses only when the session user can't read the document; an assignee without access gets it shared (or a throw when document sharing is off), and Frappe sends an assignment notification. So never call it from a probe or a test on a real site. A planned block's person must be on its task: the Planned Work Block controller adds them with `assign_to.add` and refuses a block on someone else's to-do (`omnitrack/utils/task_parity.py`). Don't book blocks around it with `db_insert`.
- **`Project.actual_time` counts only ERPNext Timesheets.** OmniTrack's logged time lives in Planned Work Blocks, so the Projects page sums logged hours from blocks itself.
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
   - Action terminology for starting a timesheet session against a task/block is strictly **"Start Session"** with a play icon (FeatherIcon `play`, never a glyph). Never use meeting/video metaphors such as "Join Focus Session".
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

## Gotcha: frappe-ui Button names and icons (0.1.278)

* Button binds `:aria-label="label"` *after* `$attrs`, so a passed `aria-label` is replaced by `undefined`. Always name a Button with the `label` prop.
* With no default-slot text and no `icon` prop or `#icon` slot, Button renders `label` as **visible** text. An icon drawn only in `#prefix` therefore shows a truncated "P…" beside it. Icon-only Buttons use `icon="feather-name"`, which makes the label screen-reader-only. Test 1 guards this.
* `data-*` attributes keep their values (the older note saying they were dropped is wrong for 0.1.278).
* The `tooltip` prop is for a few words plus a shortcut. Never repeat the visible text.
* Blue fails contrast: subtle blue is about 4.1:1 and solid blue under white text about 3.5:1. A primary Button is `variant="solid" theme="blue" class="!bg-blue-700 hover:!bg-blue-800"`.
* frappe-ui's type scale is a step smaller than Tailwind's: `text-xs` 12px, `text-sm` 13px, `text-base` 14px. Card titles want `text-lg`.

## Gotcha: no emojis or glyphs, and old ones stay readable
`scripts/check_no_glyphs.cjs` fails on any emoji or pictograph in user-facing code (comments and docstrings are skipped). Older Raven recaps start with an emoji, so `collaborationStore` matches them through an escape (`'\u23F1'`), which the check does not see. Read legacy values that way; never write a new one.

## Gotcha: Dropdown vs Combobox

`Dropdown` has no search box. Use it only for short, fixed action menus (the `SHORT_MENUS` allow-list in `scripts/test_workstation_interactions.cjs`). Any list built from data (teammates, projects, activity types, tasks) must be a searchable `Combobox`.

A `Combobox` bound with `:model-value` + `@update:model-value` can emit its display text instead of an option value. Validate the emitted value against the options before acting on it (see `setSelectedEmployee`).

Every frappe-ui component a template uses, `FeatherIcon` included, must be listed in `src/frappeUiComponents.js`.

## Gotcha: tests must never leave data on ommnomi.local

ommnomi.local is the owner's shared, working site. Python tests that insert Planned Work Blocks, ToDos or Users must clean up in `tearDown` and must not commit. Run them on a throwaway site. Past runs left 147 test blocks and 255 test ToDos there. They were deleted on 2026-10-07 (see ROADMAP); do not refill it. A test that deletes a block must use `delete_doc` so its child rows go too. Raw deletes left 28 orphan Work Session rows.

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

## Gotcha: lock the page on `<html>` only, never write `body` overflow

`document.scrollingElement` here is `<html>`, so `overflow:hidden` on
`documentElement` locks the page. Never write `body.style.overflow`: frappe-ui
dialogs (reka) lock `<body>` themselves and, on close, restore whatever
`body.style.overflow` was when they opened. If our code had already set it to
`hidden`, reka saves that as the "original" and puts it back after we unlock.
The page then stays frozen: with `<html>` visible, body's `hidden` propagates to
the viewport. This happened on every f-dialog close, and the user hit it after Stop
in the 30-minute reminder. All page locking goes through
`setScrollLock(owner, open)` in `src/utils/scrollLock.js`, counted per owner;
`scripts/check_scroll_lock.mjs` enforces it. Scripted `window.scrollTo` still
moves an `overflow:hidden` page, so verify with the inline styles and
`getComputedStyle(document.scrollingElement).overflowY`, not by scripting a scroll.

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


## 🏛️ World-Class Frappe Engineering, Reuse & Code Organization Invariants

### 1. Mandatory Reuse of Existing Built Functionality
* **Do Not Reinvent the Wheel**: Before introducing any new table, API endpoint, or UI modal, exhaustively inspect and reuse existing core structures:
  - Time Tracking & Plans: Always reuse `Planned Work Block`, `OmniTrack Work Session`, `OmniTrack Output Metric`, and standard `Timesheet`. Never create parallel data models.
  - UI Component Layer: Always reuse standardized workstation controls (frappe-ui `Dialog`, `Button`, `Combobox`, `Dropdown`, `TextInput`, registered in `src/frappeUiComponents.js`). Prohibit ad-hoc HTML native inputs that break WCAG 2.2 AA standards.
  - Work Session Logging: Consolidate all session logging through `log_work_session` and `quick_timer_punch`. Do not scatter divergent time-writing logic across different files.

### 2. Frappe Native, Efficient & Secure
* **Native ORM & Transaction Safety**: Always use Frappe document methods (`doc.append()`, `doc.save()`, `doc.insert()`) which automatically handle validation, timestamps, and database rollback on exceptions.
* **Strict Permission & Temporal Boundaries**:
  - Enforce `can_access_user_data()` and `check_timesheet_date_permission()` on every mutating endpoint.
  - Prohibit raw unparameterized SQL queries (`frappe.db.sql("... %s ...", (val,))`).
* **High-Performance Redis Caching**:
  - Store in-flight state (stopwatch ticks, heartbeats, pairing) in Redis cache (`frappe.cache.hget` / `frappe.cache.hset`) with graceful fallback to durable database persistence (`frappe.db.set_default`).
* **Realtime Pub/Sub**:
  - Broadcast multi-device events via native Frappe WebSocket rooms (`frappe.publish_realtime(...)`).

### 3. Clean Code Organization & Refactoring Invariants
* **Surgical Module Separation**:
  - Permissions and date rules belong strictly in `omnitrack/permissions.py`.
  - Notifications, push relays, and service worker bridges belong in `omnitrack/notifications.py`.
  - Core business logic, stopwatch APIs, and planner endpoints belong in `omnitrack/api.py`.
  - Background cron tasks belong in `omnitrack/tasks.py` / scheduled hooks.
* **Zero Debt Characterization**:
  - Every enhancement or refactor MUST include automated tests in `omnitrack/tests/` (Python backend) and `scripts/test_workstation_interactions.cjs` (Frontend & A11y).
  - Never accept changes that fail `check_www_html.py` (HTML5 spec parser) or `check_www_js.cjs` (VM compilation).



## Gotcha: an unregistered component is silent in production
A production Vue build renders an unregistered `<f-button>` as an inert custom element with no warning (this is how dialogs once rendered inline and buttons lost their styling). `scripts/check_component_registry.cjs` resolves every `_resolveComponent()` in every SFC template against `app.component(...)` in `src/main.js`, the SFC's `components`, and the frappe-ui globals. Register new shared components in `main.js` (Pascal and kebab names).

## Gotcha: views only see their own props and setup
Extracted SFC views get no access to the workstation. Declare dependencies with `useWorkstationContext([...names])`; `scripts/check_sfc_ctx.cjs` verifies the list covers every `_ctx.x` in the template. Also avoid passing values declared later in the facade into composable `opts` bags (const TDZ); pass functions.

## Gotcha: never take a calendar date from `toISOString()`
`new Date(ms).toISOString().split('T')[0]` is the **UTC** date. In IST, anything between 00:00 and 05:30 local comes out as yesterday. This made `restoreActiveSession` evict live sessions as "prior-day zombies". Use `getLocalTodayISO(date)` (useWorkstationShell) or build `YYYY-MM-DD` from `getFullYear/getMonth/getDate`.

## Gotcha: frappe-ui dialogs have no z-index (0.1.278)
`.dialog-overlay` stacks only by DOM order, so anything positioned with a z-index (the sticky header z-40, the planner now-line and hovered blocks z-20) paints over an open dialog. `src/styles/main.css` lifts `.dialog-overlay` to z-50. Keep page chrome below 50.

Every frappe-ui popover (TimePicker list, DatePicker calendar, Dropdown, Combobox) is portalled to `<body>` in a `[data-reka-popper-content-wrapper]`. reka copies the content's own `z-index` (auto) **inline** onto that wrapper, so once the overlay is lifted the popovers open behind their dialog. `main.css` sets the wrapper to `z-index: 60 !important`, and the `!important` is required. `scripts/check_dialog_popovers.cjs` guards it.

## Gotcha: a document-level Escape handler must skip `defaultPrevented`
frappe-ui popovers close themselves on Escape and call `preventDefault()` (TimePicker uses `@keydown.esc.prevent`). A `document.addEventListener('keydown')` handler that closes dialogs on Escape (`onPlannerKeydown` in `useWorkstationEod.js`) therefore sees that same key too, and one Escape closes both the list and the dialog. Start every such handler with `if (e.defaultPrevented) return;`. Guarding the dialog component alone is not enough. That was the first fix tried, and it did nothing.

reka's Combobox and MultiSelect are the exception: they close on Escape **without** `preventDefault`, so `defaultPrevented` is false when a bubble-phase document handler runs. Also return when `popoverOpen()` (`src/utils/popover.js`) is true. At that moment the list's content is still rendered. `_slashFocus` (`useWorkstationShortcuts.js`, which minimizes the session popup) checks both, and so does `onPlannerKeydown`, through its capture-phase `notePopoverEscape`. Test with a real key press in the browser. A synthetic `dispatchEvent` from a script does not open the list first, so it proves nothing.

## Gotcha: TimePicker and Combobox attrs (frappe-ui 0.1.278)
* `TimePicker` drops every attr (its Popover has `inheritAttrs: false`), so `aria-label`, `class` and `id` passed to it do nothing. Style its input from a wrapper (`[&_input]:h-9`).
* `TimePicker` with `:options` shows the option's `label` in the list but formats the input itself ("1:45 pm").
* `Combobox` accepts `variant` and `size` (they render as `data-variant`/`data-size` on its anchor). The anchor is `inline-flex`, so make it full width from a wrapper: `[&_div[data-variant]]:w-full`.

## Gotcha: Raven's routes
`/app/raven` (→ `/desk/raven`) is Raven's Desk *workspace*, a list of DocTypes. The chat app is `/raven`. The OmniTrack Desk workspace is `/desk/omnitrack`.

## Activity (task_nature) is Work, Break or Away
Planned-ness is the block's `unplanned` Check, never an activity. Every stored, remembered or emitted value goes through `to_kind` (`omnitrack/utils/activity.py`) / `toKind` (`src/utils/activity.js`). Never patch a stored live-session default (`omnitrack_active_session`); normalise on read. `scripts/check_activity_kinds.cjs` keeps py, js and the DocType options in step.

## Gotcha: migrate syncs a DocType only when its JSON `modified` is newer
Editing a DocType JSON without bumping `modified` past the database's value is silently skipped by `bench migrate`. Migrate also rewrites `dashboard_chart` JSONs on the way. A Single DocType has no table, so `frappe.db.has_column` throws on it.

## Gotcha: reka popovers read blurry
reka places `[data-reka-popper-content-wrapper]` with a fractional `translate()` and writes `will-change: transform` inline, so the list rasterises off the pixel grid. `main.css` sets `will-change: auto !important` on it; `check_dialog_popovers.cjs` guards it.

## Gotcha: focus after picking from a Dropdown
reka's DropdownMenu hands focus back to its trigger after the menu has closed, which is later than `nextTick` and later than `setTimeout(0)`. To move focus elsewhere after a pick, listen once for `focusin` on the trigger's wrapper and refocus from there (`TaskFormDialog.ask`).

## Gotcha: frappe-ui Tabs has no visible keyboard focus (0.1.278)
`Tabs` (reka TabsRoot/TabsList/TabsTrigger) gives roving focus and an animated indicator. Its default trigger, though, is a bare `<button>` with no focus style, and its list carries `p-1 px-5 gap-5`, which you cannot override from outside. Until that changes, the app's tab bars use the Material tab in `src/utils/materialTab.js` (`TAB`, `INDICATOR`, `COUNT`, `tabTone`, `countTone`), shared by the session pane and the Projects page. `check_dialog_popovers.cjs` fails if a view defines its own copy. On a tab, a focus ring must be **inset** (`focus-visible:ring-inset`) on a padded target. An outer ring on a bare label is clipped by the bar's underline into a broken box.

## Gotcha: there are two `planned_work_block.json` files
The DocType Frappe syncs is `omnitrack/omnitrack/doctype/planned_work_block/`. The top-level `omnitrack/doctype/` folder is a stale copy (it has a "Flagged" option the live one lacked, which is how Flag broke without anyone noticing). Edit only the inner one, bump `modified`, then migrate. `check_block_reminders.mjs` reads the inner one.

## Gotcha: an approval's undo lives in the cache
`approve_work_blocks` stores what each approval replaced under `omnitrack:undo-review:<block>` for `UNDO_REVIEW_SECONDS` (30 s; the toast offers 5). `undo_block_approval` reads it back. Do not widen the window into a general "unapprove". That is a separate product decision (ROADMAP).

## Gotcha: `data-cell` is used by more than one list
The live session popup's task checkboxes and the entry sheet's task list both use `data-cell="r:c"`. A browser probe must scope its query to the sheet (`[aria-labelledby="session-drawer-title"] [data-cell=...]`). An unscoped one focuses a checkbox outside the modal sheet. The sheet then closes on focus-out and the probe reports a roving bug that is not there.

## Gotcha: the entry sheet's task list
- `get_work_session` sends each task with `workflow`, `state` and `actions` (`_with_workflow`), only for tasks the viewer may read. The row's own `status` is a snapshot; the document is the truth.
- A move from the sheet calls `openTaskForm(task, { ask })`, which lands on that move's confirm step. Never call `execute_task_workflow_action` from a list.
- Task moves shown for an entry come from Version rows inside the session window. `frappe.db.set_value` writes no Version, so a move made that way does not show.

## Gotcha: bench console takes one line
`bench --site <site> console` reads stdin line by line, so multi-line Python breaks. Write the probe to a file and run `echo "exec(open('<file>').read())" | bench --site <site> console`.

The console is an IPython embed, so the exec'd file runs with locals separate from globals. Two traps follow:
- A flag typed before `exec` (`DELETE=1; exec(...)`) is not seen through `globals()`. Pass flags as environment variables (`echo "exec(...)" | FLAG=1 bench --site <site> console`).
- A comprehension or generator at the file's top level cannot see top-level variables (`NameError`). Put the probe's body in a `def main():` and call it.

`bench execute <method> --args '...'` reads `--args` with Python `eval`, not JSON. Write `None`, `True` and `False`. A JSON `null` raises `NameError`, and bench then quietly passes the whole string as one argument, so the call fails with "missing required positional arguments". It commits only when the call succeeds.

With piped stdin, the console exits by itself after the last line ("Do you really want to exit" needs no answer). It does not commit: a script that writes must call `frappe.db.commit()` itself, and one that raises halfway leaves the database unchanged.

## Gotcha: a block field must be added to every feed
The screens get Planned Work Blocks from five hand-written field lists: three in `api/workstation.py` (two SQL, one `get_all`), one in `api/planner.py` (the calendar) and one in `get_pending_approvals` in `api/timesheet.py`. A field missing from one of them is `undefined` on that screen only, with no error. This is how the calendar showed every logged block as awaiting approval. When a screen reads a new block field, add it to every list that feeds that screen. `check_block_reminders.mjs` guards `approval_status` and `approval_notes`.

## Gotcha: the agent's browser pane cannot reach socket.io
In the Claude desktop browser pane, `ws://ommnomi.local:9003/socket.io/` fails hundreds of times, and a `fetch` to port 9003 never leaves the page. The pane treats the second port as another origin. The server is fine: `curl -H "Origin: http://ommnomi.local:8003" "http://ommnomi.local:9003/socket.io/?EIO=4&transport=polling"` returns 200. Filter those errors out of console checks; do not debug them as an app bug.

## Gotcha: mutants must never touch the served files
`scripts/run_mutation_tests.cjs` used to rewrite real source files for a moment, the Python API files among them. `bench start` serves with the reloader, so each Python mutant restarted the web process, and pages loaded meanwhile came up as bare HTML. Mutant 1 also rebuilt the served bundle with a runtime-only Vue. The runner now copies the app to a temp directory (with `node_modules` symlinked), mutates and tests only there, and throws if a mutant names a file outside the copy. Build new mutants with `SRC(...)` or `path.resolve(omnitrackDir, ...)`, never `__dirname`. Side effect: you can keep editing `src/` while a run is going.

The old runs once left the web process broken, and reloading did not help. It cuts large responses off at random sizes, the stylesheet and sometimes the script, and logs `OSError: [Errno 9] Bad file descriptor` from `werkzeug/serving.py` `write` → `sendall` (Python 3.14, werkzeug threaded server). Every client sees it, not just the browser. To tell: `curl -o /dev/null -w "%{size_download}\n"` the bundle CSS ten times. Anything short of the size on disk means the process is broken, and only a full `bench start` restart fixes it. The extra 5 s on `http://ommnomi.local` URLs in curl is macOS trying mDNS for `.local` before `/etc/hosts`. It is unrelated, so use `--resolve ommnomi.local:8003:127.0.0.1` to skip it.

## Gotcha: `<component :is="'button'">` renders frappe-ui's Button
Vue resolves a string `is` through the registered components first, case-insensitively, and frappe-ui registers `Button` globally. So `<component :is="'button'">` becomes a frappe-ui Button with its padding, theme and slots, not a native button. Write the two elements out with `v-if`/`v-else`. `check_projects.mjs` guards ProjectsView.

## Gotcha: a page load must never end a running session
`restoreActiveSession` (`useWorkstationSessionSync.js`) used to evict a session that started on an earlier local day and had run 6 hours or more, and it deleted the server copy too. On 2026-10-07 an agent's verification reload at 04:29 erased the owner's session that had started at 20:39. Now a long or overnight session is restored, and the still-working dialog asks the person to stop at the last note, keep it running, or discard it. `get_active_session` only reads. Only the person's choice or Stop clears the stored copy. `check_session_restore.mjs` guards this. Still check `omnitrack_active_session` read-only before reloading the owner's browser, and never start a session to test.

## Gotcha: a teleported dialog loses `event.currentTarget` across `nextTick`
`currentTarget` is only set while the event is being dispatched. A roving-focus handler that waits for `nextTick` and then reads `e.currentTarget` gets `null`. Inside a frappe-ui Dialog (teleported to `body`) there is no component root to search from either. Capture `const list = e.currentTarget.closest(...)` before the `await`.


## Gotcha: Vue drops a space at the edge of a `<template>`
In `<template v-if="x"><b>{{ who }}</b> </template>{{ what }}`, the space is a whitespace-only text node at the end of the template's children, so Vue's compiler removes it. The page then reads "Youadded a task". A space at the start of a template is dropped the same way. Write `{{ ' ' }}`. `check_doc_activity.mjs` fails on the pattern in any `.vue` file.

## Gotcha: a Work Session has no Activity of its own
A Work Session is a child row (`OmniTrack Work Session`) of its Planned Work Block. A Comment pointed at a child row is never shown in Desk, so a session's talk is its block's Activity, and the session sheet says so. The block drawer used to create a Raven channel just by being opened. Raven is now for Tasks only (`raven_bridge.get_or_create_task_channel`).

## Gotcha: a custom sheet must sit below z-60
frappe-ui's `Dialog` ignores its `zIndex` prop, the dialog overlay is z-50 and every popover wrapper is z-60 (`main.css`). A sheet with its own z-index must stay below 60, or its date and time lists open behind it. The sheets use z-45 (block, session) and z-47 (task); the work-session entry popup (`WorkSessionEntry`, scrim and panel) is z-49, above the sheets it can be opened from. Test 26 in `test_workstation_interactions.cjs` checks it.

## Gotcha: the mutation runner finds the app from `__dirname`
`scripts/run_mutation_tests.cjs` copies `path.resolve(__dirname, '..')`. A copy of the runner kept elsewhere (to run a subset) must hard-code the app path, or it copies the wrong folder. Pointing `TMPDIR` inside the app fails with "copy to a subdirectory of self". A mutator that changes nothing aborts the run.

## Work sessions are past only
A Work Session records time already worked. An entry that ends after now is refused in the entry (`useSessionEntry.js` `entryCanSave`, and the running session's Adjust sheet in `TimesheetEntryDialog.vue`), in `saveEditSession`, and on the server (`timesheet._require_worked`, 5 minutes of slack). Time still ahead is logged by running a session. `check_entry_is_worked.mjs` guards all three.

Adding or editing a work session by hand is the timer's own session box: `WorkSessionEntry.vue` hosts `SessionBox mode="entry"`, so it reads as the session it becomes (Log lines, the block's tasks, Project and Activity). Only Adjust on the running session still opens the sheet. Do not build a second form for it.

## Gotcha: dark mode is two switches
The app's own `dark:` classes follow Tailwind `darkMode: "class"` (`.dark` on `<html>`). frappe-ui's preset uses `darkMode: ['selector', '[data-theme="dark"]']`, and its colour tokens (ink, surface, outline) are CSS variables defined under `[data-theme=dark]`. Setting only `.dark` leaves every frappe-ui Button, Dialog close x and input on light tokens over a dark page: invisible icons, glaring fills, buttons that do not look pressable. `applyTheme` (`useWorkstationShell.js`) and the first-paint script in `www/omnitrack.html` set both. `check_contrast_tokens.cjs` guards both.

## Gotcha: a frappe-ui solid Button's text goes near-black in dark mode
In dark mode frappe-ui's solid Button flips to a light background with `text-ink-white`, which resolves to near-black (#0F0F0F). Override only the background (our `enabled:!bg-blue-700`) and the label is near-black on blue, at 3.8:1. Every `enabled:!bg-blue-700` also carries `enabled:!text-white`. `check_contrast_tokens.cjs` enforces this, and it also flags a `text-gray-500…900` with no `dark:` colour, and a dark grey in an `isDarkMode ? '…'` dark branch.

## Gotcha: a name missing from the workstation context renders nothing in production
`useWorkstationContext([...])` throws in `setup` when App.vue does not expose a name. In development that is a loud error; in the production bundle Vue swallows it and the component renders empty, with nothing in the console a person would notice. When a component asks for a new name, add it to App.vue's provide in the same change and open that component in the browser.

## Gotcha: `npm test` reads the built bundle
`test_spa_smoke.cjs` checks `omnitrack/public/dist/omnitrack.bundle.js`, so a source change tested without `npm run build` first is tested against the old bundle. Build, then test.
