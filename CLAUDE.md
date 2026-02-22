# Lofi Books — Project Instructions

## UI / Layout Rules

- **Alignment is critical.** Content should be centered within its container — never left-hanging when there's available space. Always use `mx-auto` (or equivalent centering) on constrained-width containers (`max-w-*`).
- **Spacing and padding must be even and consistent.** Matching elements (cards, panels, sections) should have identical padding, gaps, and margins. Avoid asymmetric spacing unless there's a clear design reason.
- When in doubt, center it.

## Button Variant Rules

The `<Button>` component has four variants: `primary`, `secondary`, `ghost`, `danger`. Use them consistently:

- **`primary`** — The single main call-to-action on a page. Each page's TopBar should have **at most one** primary button (e.g. "Add Character", "New Chapter", "Add Event", "Make a Wish"). If a page has multiple creation actions (like Storyboard), use `ghost` for all of them instead of picking a favorite.
- **`ghost`** — All other non-destructive actions: secondary toolbar buttons, Edit, Cancel, panel toggles, and any page with multiple equal-weight actions side by side. Also used for toggle buttons in their "off" state (toggle "on" switches to `primary`).
- **`secondary`** — Rarely used. Only for a clearly secondary CTA that needs more visual weight than ghost but shouldn't compete with primary.
- **`danger`** — Destructive actions only: Delete buttons, destructive confirmations in dialogs.

**Size conventions:**
- `size="sm"` for TopBar actions and inline UI buttons.
- `size="md"` (default) for modal/form actions.
- `size="lg"` for prominent standalone CTAs (e.g. "Create New Book" on the home page).

## Focus / Keyboard Rules

- **Tab key must never escape text editors or writing areas.** Any TipTap editor, textarea used for long-form writing (notes, content), or contenteditable must intercept the Tab key and either insert a tab character or handle indentation. Without this, pressing Tab jumps focus to the sidebar/navigation which is disorienting for the user.
- For **TipTap editors**: use `handleKeyDown` in `editorProps` to catch `event.key === 'Tab'`, call `preventDefault()`, and insert a `\t` via `view.state.tr.insertText('\t')`.
- For **textarea elements used for writing** (e.g. notes sidebars): add an `onKeyDown` handler that inserts a tab at the cursor position.
- **Exception:** Short-form inputs in modal forms (title fields, description fields) should keep default Tab behavior so users can Tab between form fields as expected.
