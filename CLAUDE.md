# Lofi Books — Project Instructions

## UI / Layout Rules

- **Alignment is CRITICAL.** The owner is extremely detail-oriented about alignment. Elements that sit side-by-side MUST share the same height, padding, and vertical rhythm. If a toolbar row is next to a tab bar, they MUST produce identical heights. **Never eyeball it — verify the math.**
- Content should be centered within its container — never left-hanging when there's available space. Always use `mx-auto` (or equivalent centering) on constrained-width containers (`max-w-*`).
- When in doubt, center it.

## Spacing & Padding Standards

These are the **mandatory** spacing tokens for the project. Do NOT deviate without a clear reason.

| Context | Padding | Gap | Notes |
|---------|---------|-----|-------|
| **Page-level wrappers** | `p-6` or `p-8` | — | Outer page content area |
| **Cards / panels** | `p-4` or `p-6` | — | Inner card padding |
| **TopBar / toolbar rows** | `px-4 sm:px-6 lg:px-8`, `py-3` | `gap-3` | All page headers, editor toolbars |
| **Sidebar section headers** | `px-4 py-2` | — | Notes, drawings, panel section titles |
| **Tab bars** | `py-3` per tab button | `gap-1.5` (icon-text) | Must match adjacent toolbar height |
| **Inline icon buttons** | `w-9 h-9` with flexbox centering | — | 36px touch target, no raw `p-2` |
| **Compact button gaps** | — | `gap-1.5` to `gap-2` | Toolbar buttons, control clusters |
| **Relaxed element gaps** | — | `gap-3` | TopBar children, card grids |
| **Grid gaps (cards)** | — | `gap-3` | Navigation cards, illustration grids |

**Rules:**
- **Borders** are always `border border-primary/10` (1px, 10% opacity). Never `border-2` except on focus rings.
- **Border radius**: `rounded-lg` (8px) for buttons/inputs, `rounded-2xl` (16px) for cards/modals/panels.
- **Adjacent elements MUST align.** If a toolbar and a tab bar sit on the same horizontal line, they must produce the same total height. Calculate: padding-top + content-height + padding-bottom for both and ensure they match.
- **Symmetric padding only.** Never use `pl-14 pr-4` or `pt-3 pb-0`. If a direction needs different padding, there must be an explicit reason (e.g. accommodating a fixed sidebar width).
- **Consistent icon sizes** within the same bar: 16px for compact toolbars, 18px for editor toolbar buttons.

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
