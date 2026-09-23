---
name: omnitrack-combobox-architecture
description: Standard Operating Procedure and architectural design system for Frappe UI Searchable Comboboxes (f-combobox), keyboard navigation invariants, and zero-native-select enforcement in OmniTrack.
---

# OmniTrack Searchable Combobox Architecture & Anti-Native-Select SOP

## 1. Architectural Mandate
In OmniTrack, raw HTML `<select>` tags are strictly prohibited for dynamic entities (such as tasks, to-dos, projects, team members, reasons, or document links).

### Rationale
- **Friction**: In lists larger than 5 items, scrolling through native browser pickers is slow and error-prone.
- **Label Truncation**: Native `<option>` tags truncate long strings (such as task subjects or project hierarchies).
- **Metadata Blindness**: Native `<option>` cannot render badges, status pills, or secondary subtitle lines.
- **Theme Inconsistency**: Native select popup menus bleed operating-system widgets (light chrome in dark mode).

---

## 2. Component Specification: `FCombobox` (`f-combobox`)

The standard reusable combobox is registered in Vue as both `FCombobox` and `f-combobox`.

### Props Contract
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `modelValue` | `String \| Number \| Object` | `''` | Two-way reactive value (`v-model`). |
| `options` | `Array` | `[]` | Array of objects `{ value, label, kind, project, description, disabled }` or plain strings. |
| `placeholder` | `String` | `'Select an option...'` | Trigger placeholder text when `modelValue` is empty. |
| `searchPlaceholder` | `String` | `'Search...'` | Input placeholder inside popover. |
| `disabled` | `Boolean` | `false` | Disables trigger and interactions. |
| `clearable` | `Boolean` | `true` | Displays clear `✕` button when a value is selected. |
| `ariaLabel` | `String` | `'Select'` | Accessible label for screen readers. |
| `size` | `String` | `'md'` | `'sm'` (tight padding) or `'md'` (default). |

### Emitted Events
- `update:modelValue (val)`: Standard `v-model` updater.
- `change (val, optionObject)`: Emitted on selection or clear.
- `clear ()`: Emitted when selection is cleared.

---

## 3. Keyboard & Accessibility Lifecycle (WCAG 2.2 AA)

1. **Trigger Keydown**:
   - `ArrowDown`, `ArrowUp`, `Enter`, `Space` opens the combobox popover and automatically focuses the search input.
2. **Search Input Keydown**:
   - `ArrowDown`: Moves `highlightedIdx` to the next option with circular wrapping, scrolling the item into view.
   - `ArrowUp`: Moves `highlightedIdx` to the previous option with circular wrapping, scrolling the item into view.
   - `Enter`: Selects the highlighted option, closes the popover, and returns DOM focus to the trigger element.
   - `Escape`: Closes the popover without making a selection and returns DOM focus to the trigger element.
   - `Tab`: Closes the popover gracefully.
3. **Event Shielding**:
   - Every navigation keydown (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`) inside the popover or trigger **MUST call `e.stopPropagation()`** so keystrokes do not leak into parent containers (such as the attention task grid or calendar roving focus).

---

## 4. HTML5 Tree Parsing Invariants

- **No Nested Interactive Elements**:
  - The clear button (`✕`) must **NEVER** be nested inside the trigger `<button>`. Doing so causes the browser HTML5 parser to prematurely close the trigger button, corrupting the subsequent closing `</div>` tags and ejecting the component into `<body>`.
  - The clear button is positioned as an absolute sibling over the trigger.
- **Explicit Closing Tags**:
  - In-DOM templates must always use `<f-combobox ...></f-combobox>`, never self-closing `<f-combobox />`.

---

## 5. Verification Checklist

Whenever adding or refactoring an entity picker:
1. Verify template contains no raw `<select>` tags via `test_workstation_interactions.cjs`.
2. Verify HTML5 tree validity with `python apps/omnitrack/scripts/check_www_html.py`.
3. Verify JS execution with `node apps/omnitrack/scripts/check_www_js.cjs`.
4. Ensure dark and light themes render with high contrast borders and zero text truncation.
