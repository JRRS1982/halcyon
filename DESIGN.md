---
version: alpha
name: Halcyon-design-system
description: Halcyon's design language — a personal-finance app whose primary surface is a real spreadsheet (column headers, row indices, a formula bar, focused-cell selection, dark full-width section bands that group rows). Two faces carry every page — Inter for headlines and body, a system monospace face used uppercase for every label that touches data. One muted blue accent reserved for interaction and wayfinding; positive and negative variance amounts use sign-only muted green and red.

# Type scale — only six sizes anywhere in the system:
#   28 → page h1
#   18 → section heading h2, grand-total amount
#   14 → cell body, lead, nav brand, formula value
#   13 → dense data UI — ledger/import tables, popover options, inline notes
#   11 → ALL mono caps (column headers, section labels, eyebrows, button labels, status pips)
#   96 → footer wordmark stencil
# (Chart internals — axis ticks, legends, tooltips — render at 11–12px inside the
# chart surface and don't count against the scale.)
# If a new size is needed, prefer adjusting one of these before introducing a seventh.

colors:
  primary: "#000000"
  on-primary: "#FFFFFF"
  ink: "#000000"
  ink-soft: "#1B1B1B"
  body: "#525252"
  body-muted: "#8A8A8A"
  dim: "#999999"
  hairline: "#E5E5E5"
  hairline-strong: "#D4D4D4"
  hairline-dark: "#1F242C"
  canvas: "#FFFFFF"
  canvas-soft: "#F7F7F7"
  canvas-dark: "#0F1116"
  surface-dark-soft: "#1A1D23"
  on-dark: "#FFFFFF"
  body-on-dark: "#A8AFBC"
  positive: "#1F8A4C"
  negative: "#B33B3B"
  focus: "#0F1116"
  accent: "#1E5BC6"
  chart-rate: "#D97706"

typography:
  display-xxl:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 96px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.04em
  display-xl:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.012em
  body-md:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.003em
  body-md-strong:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: -0.003em
  body-sm:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: -0.003em
  amount:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    fontVariantNumeric: tabular-nums
  amount-strong:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    fontVariantNumeric: tabular-nums
  amount-xl:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.012em
    fontVariantNumeric: tabular-nums
  mono-caps:
    fontFamily: ui-monospace, SF Mono, Menlo, Consolas, monospace
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.2
    textTransform: uppercase
    letterSpacing: 0.055em

rounded:
  none: 0px
  sm: 4px
  full: 9999px

spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 44px
  5xl: 48px
  section: 80px

components:
  nav-bar:
    description: "Top app navigation. Brand left, mono-caps link row centre, single primary pill right."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderBottom: "1px solid {colors.hairline}"
    height: 56px
    padding: "0 {spacing.2xl}"

  nav-link:
    description: "Each link inside nav-bar. Active state changes colour only — no underline."
    typography: "{typography.mono-caps}"
    textColor: "{colors.body}"
    activeTextColor: "{colors.ink}"
    gap: "{spacing.2xl}"

  button-primary:
    description: "Black pill. The single primary action per visible viewport."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.mono-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.lg}"

  button-outline:
    description: "White-on-white with a hairline border. Secondary action paired beside button-primary."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.mono-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.lg}"

  button-destructive:
    description: "Outline button with red text. Always paired with a confirm modal — never one-click destructive."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.negative}"
    borderColor: "{colors.hairline}"
    typography: "{typography.mono-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.lg}"

  status-pip:
    description: "Inline status indicator with a coloured dot. Used in the page action cluster (Saved · 2m ago)."
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.body}"
    typography: "{typography.mono-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xs} {spacing.sm}"
    dotSize: 6px
    dotColor: "{colors.positive}"

  text-input:
    description: "Default form input. Used in auth, modals, settings."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    focusBorderColor: "{colors.accent}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.md}"

  form-field:
    description: "Label + input + helper/error stack. Label is mono-caps."
    labelTypography: "{typography.mono-caps}"
    labelColor: "{colors.body}"
    helperTypography: "{typography.body-md}"
    helperColor: "{colors.body}"
    errorColor: "{colors.negative}"
    gap: "{spacing.xs}"

  badge-neutral:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.mono-caps}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xxs} {spacing.sm}"

  toolbar:
    description: "Spreadsheet toolbar above the sheet. Mono-caps button chips grouped by purpose with hairline dividers between groups."
    backgroundColor: "{colors.canvas}"
    borderBottom: "1px solid {colors.hairline}"
    padding: "{spacing.xs} 0 {spacing.md}"
    groupDivider: "1px solid {colors.hairline}"

  toolbar-tool:
    description: "Single tool button in the toolbar. Active state inverts to primary/on-primary."
    height: 30px
    padding: "0 {spacing.md}"
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.mono-caps}"
    rounded: "{rounded.sm}"
    activeBackgroundColor: "{colors.primary}"
    activeTextColor: "{colors.on-primary}"
    activeBorderColor: "{colors.primary}"

  formula-bar:
    description: "Below the toolbar. Left: cell reference (e.g. C4). Middle: italic fx glyph. Right: editable formula value with a blinking caret."
    backgroundColor: "{colors.canvas-soft}"
    borderBottom: "1px solid {colors.hairline}"
    height: 36px

  formula-bar-cell-ref:
    description: "Reads the currently focused cell — 'C4', 'B7' — in mono-caps."
    width: 80px
    padding: "0 {spacing.md}"
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.body}"
    typography: "{typography.mono-caps}"
    borderRight: "1px solid {colors.hairline}"

  formula-bar-formula:
    description: "Editable value of the focused cell. Mono face, 14px, ink colour."
    flex: 1
    padding: "0 {spacing.md}"
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    fontFamily: ui-monospace, SF Mono, Menlo, Consolas, monospace
    fontSize: 14px

  sheet:
    description: "The bordered spreadsheet grid that holds all rows. Joins the formula bar above as a single chrome unit."
    backgroundColor: "{colors.canvas}"
    border: "1px solid {colors.hairline}"
    rounded: "0 0 {rounded.sm} {rounded.sm}"

  sheet-cell:
    description: "Default cell inside the sheet. Right-aligned tabular numerals for amount columns; left-aligned ink for label cells."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    padding: "{spacing.sm} {spacing.md}"
    borderRight: "1px solid {colors.hairline}"
    borderBottom: "1px solid {colors.hairline}"

  sheet-cell-amount:
    description: "Cells in the Budget / Actual / Variance / % columns. Always right-aligned, always tabular numerals."
    typography: "{typography.amount}"
    align: right

  sheet-cell-dim:
    description: "Cell whose value is $0 or empty — fades to body-muted so it doesn't pretend to be data."
    textColor: "{colors.dim}"

  sheet-cell-focused:
    description: "The active editing cell. 2px focus ring inside the cell, plus a 7px filled drag-handle at the bottom-right corner."
    outline: "2px solid {colors.focus}"
    outlineOffset: "-2px"
    handleSize: 7px
    handleColor: "{colors.focus}"
    fontWeight: 500

  sheet-row-head:
    description: "Column header row — Category · Budget · Actual · Variance · %. Mono-caps labels on canvas-soft, with a stronger hairline below."
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.body}"
    typography: "{typography.mono-caps}"
    borderBottom: "1px solid {colors.hairline-strong}"

  sheet-row-section:
    description: "Section group header (Income, Expenses). Full-width dark band — the page's primary visual separator. Mono-caps label, amount cells already populated with section roll-ups."
    backgroundColor: "{colors.canvas-dark}"
    textColor: "{colors.on-dark}"
    borderColor: "{colors.hairline-dark}"
    labelTypography: "{typography.mono-caps}"
    valueTypography: "{typography.amount-strong}"
    padding: "{spacing.md} {spacing.md}"

  sheet-row-item:
    description: "Default line-item row. Label indented from the panel edge by indent-1 ({spacing.3xl})."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    valueTypography: "{typography.amount}"
    indent-1: "{spacing.3xl}"
    indent-2: "{spacing.5xl}"
    indent-2-textColor: "{colors.body}"
    padding: "{spacing.sm} {spacing.md}"

  sheet-row-totals:
    description: "Section subtotal row (Income subtotal, Expenses subtotal). Soft canvas, stronger top hairline, mono-caps label, medium-weight amount."
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    borderTop: "1px solid {colors.hairline-strong}"
    labelTypography: "{typography.mono-caps}"
    labelColor: "{colors.body}"
    valueTypography: "{typography.amount-strong}"

  sheet-row-grand:
    description: "Grand total row at the very bottom (Net income). Black band, mono-caps label, large amount. The single heaviest moment on the page."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    borderColor: "{colors.primary}"
    labelTypography: "{typography.mono-caps}"
    valueTypography: "{typography.amount-xl}"
    padding: "{spacing.md} {spacing.md}"

  period-tab:
    description: "One tab inside the historic-records segmented control. Three lines stacked: month (mono-caps), net amount (Inter 14), status (mono-caps)."
    backgroundColor: "{colors.canvas}"
    borderRight: "1px solid {colors.hairline}"
    padding: "{spacing.md} {spacing.lg}"
    currentBackgroundColor: "{colors.canvas-soft}"
    monthTypography: "{typography.mono-caps}"
    monthColor: "{colors.body}"
    currentMonthColor: "{colors.ink}"
    netTypography: "{typography.amount-strong}"
    netColor: "{colors.ink}"
    statusTypography: "{typography.mono-caps}"
    statusColor: "{colors.body-muted}"

  card:
    description: "Generic card primitive. Base for auth cards, period detail surfaces, settings sections."
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"

  toast:
    description: "Flash notification anchored bottom-right with a soft drop shadow."
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md} {spacing.lg}"
    shadow: "rgba(15, 17, 22, 0.08) 0px 4px 12px 0px"

  modal:
    description: "Confirm or form dialog centred over a tinted scrim."
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3xl}"
    scrim: "rgba(15, 17, 22, 0.5)"
    maxWidthConfirm: 480px
    maxWidthForm: 640px

  empty-state:
    description: "Placeholder shown when a list / sheet has no rows yet."
    backgroundColor: "{colors.canvas-soft}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.sm}"
    padding: "{spacing.section}"
    captionTypography: "{typography.body-md}"
    captionColor: "{colors.body}"

  footer:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    borderTop: "1px solid {colors.hairline}"
    typography: "{typography.body-md}"
    padding: "{spacing.section} {spacing.3xl}"

  wordmark-footer:
    description: "Giant lowercase 'halcyon' tinted to hairline grey at the bottom of long pages. Faint stencil signature."
    typography: "{typography.display-xxl}"
    color: "{colors.hairline}"
    padding: "{spacing.4xl} 0 {spacing.3xl}"

  # ─── Examples (illustrative) — kit-mirror surfaces composed from primitives above ───
  ex-budget-page:
    description: "The Budget page top-to-bottom: nav-bar → page header → toolbar → formula-bar → sheet (head, section, items, totals, grand) → period-tabs → wordmark-footer."
    pageMaxWidth: 1240px
    pagePadding: "{spacing.3xl} {spacing.2xl} {spacing.5xl}"

  ex-auth-form-card:
    description: "Sign-in / sign-up. A card chromed at 360px wide, centred. Inside: display-xl headline → form-field stack → button-primary → 'or' divider → button-outline (Google) → small body-md link to switch flow."
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.sm}"
    padding: "{spacing.3xl}"
    maxWidth: 360px

  ex-amount-positive:
    description: "Positive variance amount. Same typography as sheet-cell-amount; colour swap to positive."
    color: "{colors.positive}"
    typography: "{typography.amount}"

  ex-amount-negative:
    description: "Negative variance amount. Same typography as sheet-cell-amount; colour swap to negative."
    color: "{colors.negative}"
    typography: "{typography.amount}"
---


## Overview

Halcyon is a personal-finance app — budgets, statements, financial documents you build month-by-month and then lock as the period ends — and the brand's primary surface is the thing it manipulates: **a real spreadsheet**. Column headers, row indices, a formula bar above, a focused cell with a drag-handle, full-width dark bands that group rows into sections (Income, Expenses), a single black band at the bottom for the grand total. The spreadsheet is not a metaphor; it is the page. Every other surface in the app (auth, settings, dashboards, modals) is supporting chrome around the sheet.

Type is the second decisive voice. Two faces carry every page: **Inter** (loaded via `next/font/google` in `src/app/layout.tsx`) for headlines, body, and amount cells with `font-variant-numeric: tabular-nums`; and a **system monospace** face (`ui-monospace, SF Mono, Menlo, Consolas, monospace`) used **uppercase** for every label that touches data — column headers, section row labels, button labels, eyebrows, status pips, period tabs, the row index column. Headlines are sentence case; everything technical is uppercase mono. That contrast is the brand's tonal joke — the app is serious enough to use a monospace label, modern enough not to put the headline in it.

Surfaces alternate at the row level, not the page level. A page is `{colors.canvas}` (white) end-to-end; within the sheet, `{colors.canvas-dark}` (`#0F1116`) bands sit as full-width section headers between groups of light rows. `{colors.canvas-soft}` is the single soft surface tone — used for the row-index column, the formula bar, column headers, and subtotal rows. `{colors.hairline}` is the one-and-only divider on light surfaces; `{colors.hairline-dark}` plays the same role inside dark bands. Cards and panels are universally lightly rounded (`{rounded.sm}` 4 px) with hairline borders — never floating with shadows.

**Key Characteristics:**

- A single black `{colors.primary}` CTA pill carries every primary action — Add row, Save changes, Sign in. One per visible viewport.
- No brand gradient. The dark section bands + black grand-total row are the decorative system; the single `{colors.accent}` blue is functional (interaction + wayfinding), never decorative.
- All-caps mono labels in `{typography.mono-caps}` for everything that names data — column headers, section rows, button labels, eyebrows, status pips, period months, the row-index column.
- The **type scale has six sizes only** — 96, 28, 18, 14, 13, 11 (chart internals may use 11–12px inside the chart surface). New sizes are added by adjusting one of the existing tokens; introducing a seventh is a design decision, not a default.
- Tabular numerals on every currency amount. Right-aligned in their columns; left-aligned amount cells are forbidden.
- Positive variance in `{colors.positive}` (`#1F8A4C`); negative in `{colors.negative}` (`#B33B3B`). Sign-only — never as brand colours or button fills.
- $0 / empty amounts dim to `{colors.dim}` (`#999999`) so they recede from real data.
- A `halcyon` wordmark at the very bottom of every long page in `{typography.display-xxl}` at 96 px, tinted to `{colors.hairline}` so it reads as a faint stencil signature.

## Colors

### Brand & Accent

- **Ink** (`{colors.primary}` — `#000000`): The single primary CTA colour. Black pill carries every conversion action: Add row, Save changes, Sign in, Continue with Google. Also the fill of the grand-total row.
- **Accent** (`{colors.accent}` — `#1E5BC6`): A single muted blue that owns **interaction and wayfinding** — it marks where the user is and what responds to them. Sanctioned uses: inline links, focus rings on form inputs, active filter chips, active nav/toggle states, period identifiers in page eyebrows (e.g. "Budget · **January 2026**"), create/confirm actions *inside popovers* (where the black CTA system doesn't reach), and the Net/derived series in charts. Never on amounts or table data (those use sign-only positive/negative), never as a decorative tint or gradient, and never competing with a black `button-primary` on the same surface — the black pill stays the page's conversion moment; the accent is everything conversational around it.

### Surface

- **Canvas** (`{colors.canvas}` — `#FFFFFF`): The default page background and the default sheet-cell background.
- **Canvas Soft** (`{colors.canvas-soft}` — `#F7F7F7`): The single soft surface tone — used for the row-index column, column headers, the formula bar, subtotal rows, and current-period tab highlight.
- **Canvas Dark** (`{colors.canvas-dark}` — `#0F1116`): The dark fill for section header bands inside the sheet. Slightly warmer than pure navy so it feels less Silicon-Valley-AI, less cold than pure black.
- **Surface Dark Soft** (`{colors.surface-dark-soft}` — `#1A1D23`): A slightly lighter dark fill — used for the row-index column inside dark section bands.
- **Hairline** (`{colors.hairline}` — `#E5E5E5`): The default 1 px divider on light surfaces — every sheet cell border, card border, badge border.
- **Hairline Strong** (`{colors.hairline-strong}` — `#D4D4D4`): A stronger 1 px divider used at structural boundaries — the row-index column's right edge, the column-header row's bottom, subtotal-row top borders.
- **Hairline Dark** (`{colors.hairline-dark}` — `#1F242C`): 1 px dividers inside `sheet-row-section` dark bands.

### Text

- **Ink** (`{colors.ink}` — `#000000`): Every headline, every primary cell value on light surfaces.
- **Ink Soft** (`{colors.ink-soft}` — `#1B1B1B`): Reserved for prose body running > 200 characters where pure black feels harsh. Currently unused; available.
- **Body** (`{colors.body}` — `#525252`): Secondary text on light surfaces — line-item labels (`label-indent-2`), lead paragraphs, mono-caps eyebrow labels, status-pip text, nav-link inactive state, period-tab month label.
- **Body Muted** (`{colors.body-muted}` — `#8A8A8A`): A third tier of grey — used for the row-index column digits and period-tab status text.
- **Dim** (`{colors.dim}` — `#999999`): Reserved for $0 / no-data amount cells. Dimmer than body-muted; signals "this is not data" rather than "this is secondary data".
- **On Dark** (`{colors.on-dark}` — `#FFFFFF`): All primary text on `{colors.canvas-dark}` and `{colors.primary}` surfaces.
- **Body On Dark** (`{colors.body-on-dark}` — `#A8AFBC`): Secondary text on dark surfaces.

### Semantic

A deliberately small semantic palette — sign-only, never decorative.

- **Positive** (`{colors.positive}` — `#1F8A4C`): A muted green used **only** for positive variance amounts (under-budget expenses, surplus net income). Never used as a brand tint, button fill, or success banner background. Also the dot colour in `status-pip`.
- **Negative** (`{colors.negative}` — `#B33B3B`): A muted red used **only** for negative variance amounts and destructive-button text. Never used as a brand tint or hero accent.
- **Focus** (`{colors.focus}` — `#0F1116`): The 2 px outline ring on the focused **sheet cell** only. Matches `{colors.canvas-dark}` so cell focus reads as "this is where you're committing data". Form inputs outside the sheet take their focus ring from `{colors.accent}` instead — interaction belongs to the accent.
- No explicit warning / info / success colour beyond positive/negative.

## Typography

### Font Family

Two families carry the entire system:

1. **Inter** for every headline, lead paragraph, body, cell amount, and inline link. Weights 400 / 500 / 600. Already loaded via `next/font/google` in `src/app/layout.tsx`. Tight negative letter-spacing on display sizes (`-0.04em` at 96 px wordmark, `-0.02em` at 28 px page h1, `-0.003em` at 14 px body) gives the face its slightly-condensed feel.
2. **System monospace** (`ui-monospace, SF Mono, Menlo, Consolas, monospace`) used uppercase for every label that touches data. Weight 500 at 11 px; positive letter-spacing (`0.055em`). The mono carries the brand's technical voice — every label that says "BUDGET", "CATEGORY", "INCOME", "JAN 2025", "LOCKED", "FX" is set in this face.

The mono face is **never** used for body copy, never for cell amounts (amounts are Inter with `tabular-nums`), and never for headlines.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xxl}` | 96 px | 500 | 1 | -0.04 em | The footer wordmark stencil only. |
| `{typography.display-xl}` | 28 px | 500 | 1.1 | -0.02 em | Page headlines ("Budget overview"). |
| `{typography.display-lg}` | 18 px | 500 | 1.3 | -0.012 em | Section headings ("Historic records"). Also the typography of `amount-xl` on the grand-total row. |
| `{typography.body-md}` | 14 px | 400 | 1.5 | -0.003 em | Default cell body, lead paragraphs, nav brand, formula-bar formula value, period-tab net amount. |
| `{typography.body-md-strong}` | 14 px | 500 | 1.5 | -0.003 em | Emphasis inside body text. |
| `{typography.body-sm}` | 13 px | 400 | 1.45 | -0.003 em | Dense data UI — ledger and import-preview tables, popover/combobox options, inline notes. Not for prose. |
| `{typography.amount}` | 14 px | 400 | 1.5 | 0 | Default cell amount. Tabular numerals. |
| `{typography.amount-strong}` | 14 px | 500 | 1.5 | 0 | Section-row roll-up totals, subtotal-row values, period-tab net amount. Tabular numerals. |
| `{typography.amount-xl}` | 18 px | 500 | 1.3 | -0.012 em | Grand-total row amount only. Tabular numerals. |
| `{typography.mono-caps}` | 11 px | 500 | 1.2 | 0.055 em | Everything mono — column headers, section labels, button labels, eyebrows, status-pip text, period-tab month + status, row-index digits, formula-bar cell ref. |

**Six visual sizes total** (96 / 28 / 18 / 14 / 13 / 11). The `amount` variants share size with `body-md`; the `amount-xl` shares size with `display-lg`; `body-sm` is reserved for dense data UI. Chart internals (axis ticks, legends, tooltips) render at 11–12px inside the chart surface and don't count against the scale. New tokens reuse existing sizes by default.

### Voice

- **Headlines** — sentence case, never all-caps. "Budget overview" not "BUDGET OVERVIEW".
- **Labels** — uppercase mono. "CATEGORY", "BUDGET", "ACTUAL", "VARIANCE", "INCOME", "EXPENSES", "JAN 2025", "LOCKED".
- **Buttons** — uppercase mono. "ADD ROW", "EXPORT", "SAVE CHANGES", "SIGN OUT". Action verbs always; never "Submit".
- **Amounts** — Inter, tabular numerals, two decimal places (`$8,500.00`). Always show the currency symbol; never omit decimals on display. Sign on positive amounts only when variance is the subject of the field (`+$2,100.00` in a grand-total cell).
- **Cell references** — uppercase mono. `C4`, `B7`, `B5:B11`.

## Layout

### Spacing System

- **Base unit**: 4 px. Every token is a multiple of 4.
- **Tokens**: `{spacing.xxs}` 2 px · `{spacing.xs}` 4 px · `{spacing.sm}` 8 px · `{spacing.md}` 12 px · `{spacing.lg}` 16 px · `{spacing.xl}` 20 px · `{spacing.2xl}` 24 px · `{spacing.3xl}` 32 px · `{spacing.4xl}` 44 px · `{spacing.5xl}` 48 px · `{spacing.section}` 80 px.
- **Page padding**: pages use `{spacing.3xl}` 32 px top, `{spacing.2xl}` 24 px sides, `{spacing.5xl}` 48 px bottom on desktop. Mobile drops to `{spacing.lg}` 16 px sides.
- **Sheet cell padding**: `{spacing.sm}` 8 px top-bottom, `{spacing.md}` 12 px left-right. Section rows and grand-total row bump vertical padding to `{spacing.md}` 12-14 px for emphasis.
- **Sheet indent levels**: `indent-1` is `{spacing.3xl}` 32 px from the cell edge; `indent-2` is `{spacing.5xl}` 56 px. The parent / child relationship is conveyed by indent only — no tree-toggle glyph.
- **Toolbar gap**: tools within a group sit `{spacing.xs}` 6 px apart; groups are separated by `{spacing.md}` 12 px plus a 1 px right divider on the trailing group.

### Grid & Container

- **Max width**: 1240 px desktop container; nothing renders above that. Content centres with horizontal gutters of `{spacing.2xl}` 24 px on desktop, `{spacing.lg}` 16 px on mobile.
- **Sheet column template**: category (flex) · Budget 150 px · Actual 150 px · Variance 150 px · % 90 px. On mobile, fixed-width amount columns drop to 110 px each and the % column collapses behind a horizontal scroll. (An earlier draft included a 40 px row-index column; removed because spreadsheet-style row numbers added visual noise without earning their column.)
- **Auth form max-width**: 360 px (per `ex-auth-form-card`).
- **Page header**: headline + lead on the left, action cluster + status-pip on the right. Stacks on mobile.

### Whitespace Philosophy

Surface contrast does most of the separation. The sheet does not introduce visual sections via shaded backgrounds elsewhere — dark `sheet-row-section` bands group rows, soft `sheet-row-totals` rows close them. Outside the sheet, the page is mostly empty white with single-pixel hairline boundaries (nav, toolbar, formula bar, periods row). The historic-records section is set apart from the sheet by `{spacing.5xl}` 48 px of vertical breathing room — no banner, no shaded backdrop.

### Responsive Strategy

#### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 479 px | Page header stacks; action cluster wraps under headline. Sheet enables horizontal scroll inside its rounded container — the row-index and category columns stay sticky-left, amount columns scroll. Toolbar wraps to two lines if needed. Period tabs stack 1-up. |
| Mobile-Large | 479–767 px | Same as Mobile; period tabs go 2-up. |
| Tablet | 768–991 px | Sheet remains full-width within container padding; amount columns narrow to 120 px. Period tabs 3-up. Page header inline. |
| Desktop | 992–1239 px | Full sheet column template; period tabs 5-up (or however many months are shown). |
| Desktop-Large | ≥ 1240 px | Container caps at 1240 px; page bg stays edge-to-edge in white while content centres. |

#### Touch Targets

The mono-caps button label is set at 11 px; combined with `{spacing.sm}` 8 px vertical and `{spacing.lg}` 16 px horizontal padding, the primary pill renders at ~30 px tall on desktop. On mobile viewports, button height is inflated to ≥ 44 px through extra vertical padding inside the touch row.

The default sheet cell renders at ~36 px tall (14 px text + 8 px × 2 padding + line-height). On mobile, cell padding bumps to `{spacing.md}` 12 px vertical for a comfortable ≥ 44 px tap target.

#### Collapsing Strategy

- **Nav**: brand left, link row centre, single black "Sign out" pill right at desktop. Collapses to brand + hamburger at mobile; the menu opens as a full-overlay drawer with the link list stacked vertically.
- **Page header**: at desktop, headline + lead on the left, action cluster (status-pip + Export + Add row) on the right. At mobile, the action cluster wraps under the headline.
- **Toolbar**: at desktop, groups sit inline left-to-right. At mobile, the toolbar enables horizontal scroll; groups stay grouped but the row can pan.
- **Sheet**: at desktop, all six columns visible. At mobile, the row-index + category columns are sticky-left; amount columns scroll horizontally inside the sheet's rounded container.
- **Period tabs**: 5-up at desktop, 3-up at tablet, 1-up at mobile. Card chrome stays identical.
- **Footer wordmark**: scales fluidly — the giant `halcyon` wordmark stays edge-to-edge regardless of viewport. On mobile it drops to ~60 px font size to avoid clipping.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Level 0 — Flat | No shadow, no border. | Default page surface. Toolbar tools (single hairline border, no shadow). |
| Level 1 — Hairline | 1 px solid `{colors.hairline}` on `{colors.canvas}` cards. | `card`, `text-input`, `badge-neutral`, `period-tab`, sheet cells (all four sides). |
| Level 2 — Hairline Strong | 1 px solid `{colors.hairline-strong}` as a structural boundary. | Bottom of `sheet-row-head`; top of `sheet-row-totals`. |
| Level 3 — Filled Dark | `{colors.canvas-dark}` fill with internal dividers in `{colors.hairline-dark}`. | `sheet-row-section`. The dark fill is the elevation. |
| Level 4 — Filled Ink | `{colors.primary}` (`#000000`) fill. | `sheet-row-grand`, `button-primary`, `nav .pill`. The single heaviest treatment. |
| Level 5 — Soft Drop | `rgba(15, 17, 22, 0.08) 0px 4px 12px 0px` — barely-perceptible shadow tinted with `{colors.canvas-dark}`. | Floating elements only — `toast`, `modal` (modal also uses a scrim). Never on inline cards or sheet rows. |

### Decorative Depth

- **Section + grand-total bands** are the page's primary depth cues. The dark `sheet-row-section` bands group rows; the single black `sheet-row-grand` row anchors the bottom. No shadow is involved.
- **Cell focus** is the only inset depth treatment — a 2 px outline ring inside the cell plus a 7 px filled drag-handle at the bottom-right corner. This is the only place where the focus colour overlaps cell content.
- **Wordmark stencil** at the bottom of long pages reads as a faint terminal depth — `{colors.hairline}` tint on white, no outline, edge-to-edge.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0 px | Sheet section bands, sheet grand-total row, page edges, footer wordmark. |
| `{rounded.sm}` | 4 px | The canonical radius — buttons, badges, cards, the sheet container (corners only), period-tab rail, text inputs, modals, toasts, status pips. |
| `{rounded.full}` | 9999 px | **Not used.** Halcyon does not ship pill-shaped CTAs, floating chat orbs, or avatar circles. Reserved for future status-dot or notification-dot use. |

### Photography Geometry

- **No editorial imagery in the product surface.** All product pages are text and tables.
- **Marketing thumbnails** (when present): 16:9 landscape with `{rounded.sm}` 4 px corners on the image only.

## Components

### Navigation

**`nav-bar`** — the top app nav.

- Background `{colors.canvas}`, 1 px bottom border `{colors.hairline}`, padding `0 {spacing.2xl}`, height 56 px. Layout: brand left, link row centre (`nav-link`), single black `button-primary` ("Sign out" or "Sign in") right.

**`nav-link`** — each link inside the nav-bar.

- Text `{colors.body}` for inactive, `{colors.ink}` for active, set in `{typography.mono-caps}`. Links separate with `{spacing.2xl}` 24 px between siblings. Active state has no underline — colour change only.

**`footer`** — the bottom block before the wordmark.

- Background `{colors.canvas}`, text `{colors.body}`, padding `{spacing.section} {spacing.3xl}`. Mono-caps eyebrow column titles, body-md link rows.

**`wordmark-footer`** — the giant `halcyon` wordmark at the bottom of long pages.

- Background `{colors.canvas}`, wordmark colour `{colors.hairline}` (faint stencil tint), set in `{typography.display-xxl}` at 96 px. Edge-to-edge, square corners. Acts as the final page sign-off.

### Buttons

**`button-primary`** — the black pill that carries every primary CTA.

- Background `{colors.primary}`, text `{colors.on-primary}`, label set in `{typography.mono-caps}` (uppercase mono, 11 px / 500 / 0.06 em tracking), shape `{rounded.sm}` 4 px, padding `{spacing.sm} {spacing.lg}`. No shadow.

**`button-outline`** — the white outline button paired beside `button-primary`.

- Background `{colors.canvas}`, text `{colors.ink}`, 1 px solid `{colors.hairline}` border, same typography and shape as `button-primary`. Used for secondary actions: Export, Cancel, Discard.

**`button-destructive`** — the outline button with red text for destructive actions.

- Background `{colors.canvas}`, text `{colors.negative}`, 1 px solid `{colors.hairline}` border, same shape as `button-outline`. Used for: Delete period, Reset budget, Remove category. Never one-click destructive — always paired with a friction beat: a confirm modal, or (for the heaviest account-level actions, per settings → Data & privacy) an inline type-to-confirm panel where the user types the action name before the button arms.

**`status-pip`** — inline status indicator with a coloured dot.

- Background `{colors.canvas}`, 1 px solid `{colors.hairline}` border, text `{colors.body}`, set in `{typography.mono-caps}`, padding `{spacing.xs} {spacing.sm}`, shape `{rounded.sm}`. A 6 px dot in `{colors.positive}` (or `{colors.negative}` for an error pip) sits before the text. Used in the page action cluster: `● Saved · 2m ago`.

### The Sheet

The Budget page is built around a single bordered grid — the **sheet**. Every Halcyon screen that displays financial data uses this same grid vocabulary.

**`sheet`** — the bordered spreadsheet container.

- Background `{colors.canvas}`, 1 px solid `{colors.hairline}` on all four sides, `{rounded.sm}` 4 px bottom corners only (the top joins the formula bar above as a single chrome unit). Internal layout is a CSS grid.

**`sheet-cell`** — the default cell inside the sheet.

- Background `{colors.canvas}`, text `{colors.ink}`, set in `{typography.body-md}`, padding `{spacing.sm} {spacing.md}` (10 px 14 px), right + bottom borders `{colors.hairline}` 1 px. The right border is omitted on the last column.

**`sheet-cell-amount`** — cells in the Budget / Actual / Variance / % columns.

- Set in `{typography.amount}` (Inter, tabular numerals), justified right. Amount cells **never** left-align. Subtotal-row amounts use `{typography.amount-strong}`; grand-total uses `{typography.amount-xl}`.

**`sheet-cell-dim`** — modifier for `sheet-cell-amount` when the value is $0 or empty.

- Text colour swaps to `{colors.dim}` `#999999`. Signals "no data" so a row of zeros doesn't pretend to be real.

**`sheet-cell-focused`** — the active editing cell.

- 2 px solid `{colors.focus}` outline inside the cell (`outline-offset: -2px`), text weight bumps to 500, plus a 7 px filled drag-handle in `{colors.focus}` at the bottom-right corner (positioned `-4 px / -4 px` so it half-overflows the cell). Only one cell may be focused at a time; the cell reference (e.g. `C4`) appears in the formula bar.

**`sheet-row-head`** — the column header row.

- Background `{colors.canvas-soft}`, text `{colors.body}` in `{typography.mono-caps}`, bottom border `{colors.hairline-strong}` 1 px. Labels: Category · Budget · Actual · Variance · %.

**`sheet-row-section`** — a section group header (Income, Expenses).

- Background `{colors.canvas-dark}`, text `{colors.on-dark}`, borders `{colors.hairline-dark}`, padding `{spacing.md} {spacing.md}`. Label set in `{typography.mono-caps}` (uppercase), amount columns set in `{typography.amount-strong}` showing the section roll-up totals. Section bands are the page's primary visual separator.

**`sheet-row-item`** — the default line-item row.

- Inherits `sheet-cell` defaults. The category cell uses `indent-1` (`{spacing.3xl}` 32 px left padding) for parent items, or `indent-2` (`{spacing.5xl}` 56 px) for nested children. Indent-2 rows colour their label cell `{colors.body}` instead of ink, signalling subordination without needing a tree glyph.

**`sheet-row-totals`** — the section subtotal row (Income subtotal, Expenses subtotal).

- Background `{colors.canvas-soft}`, top border `{colors.hairline-strong}` 1 px (stronger than the default cell border, so the subtotal reads as a roll-up). Label in `{typography.mono-caps}` coloured `{colors.body}`; amount cells in `{typography.amount-strong}`. Variance / % cells may use `{colors.positive}` / `{colors.negative}` if the value is material.

**`sheet-row-grand`** — the grand total row at the very bottom (Net income).

- Background `{colors.primary}` `#000000`, text `{colors.on-primary}`, borders `{colors.primary}`, padding `{spacing.md} {spacing.md}` (14 px 14 px). Label in `{typography.mono-caps}`; amount in `{typography.amount-xl}` (18 px Inter strong). Always monochrome — no positive/negative colouring on a grand-total row; the black band is the heaviest treatment on the page and adding colour fights it.

### Toolbar & Formula Bar

**`toolbar`** — the spreadsheet toolbar above the sheet.

- Background `{colors.canvas}`, 1 px bottom border `{colors.hairline}`, padding `{spacing.xs} 0 {spacing.md}` (6 px top, 14 px bottom). Tools are grouped by purpose (period picker · row operations · currency · sort/filter); groups are separated by 1 px right dividers `{colors.hairline}`.

**`toolbar-tool`** — a single tool button inside the toolbar.

- Height 30 px, padding `0 {spacing.md}` (12 px), background `{colors.canvas}`, text `{colors.ink}`, 1 px solid `{colors.hairline}` border, label in `{typography.mono-caps}`, shape `{rounded.sm}`. Active state inverts: background `{colors.primary}`, text `{colors.on-primary}`, border `{colors.primary}`. Used for sticky toggles like a currency unit (`$ USD` active vs `€ EUR` inactive).

**`formula-bar`** — the bar between the toolbar and the sheet.

- Background `{colors.canvas-soft}`, height 36 px, 1 px bottom border `{colors.hairline}`. Three slots: cell reference (left), `fx` glyph (middle), formula value (right).

**`formula-bar-cell-ref`** — the left slot showing the currently focused cell reference.

- Width 80 px, padding `0 {spacing.md}` (14 px), text `{colors.body}` in `{typography.mono-caps}`, right border `{colors.hairline}` 1 px. Reads `C4`, `B7`, etc.

**`formula-bar-formula`** — the right slot showing the editable formula value.

- Flex 1, padding `0 {spacing.md}` (14 px), background `{colors.canvas}`, text `{colors.ink}`. Set in the **mono face at 14 px** — the only place mono is used at body size (because it's a formula, not a label). A blinking caret indicates active editing.

### Forms & Inputs

**`text-input`** — every form field's input element.

- Background `{colors.canvas}`, text `{colors.ink}`, 1 px solid `{colors.hairline}` border, focus border `{colors.focus}`, body in `{typography.body-md}`, padding `{spacing.sm} {spacing.md}`, shape `{rounded.sm}` 4 px.

**`form-field`** — the composition: label + input + helper / error.

- Label set in `{typography.mono-caps}` coloured `{colors.body}`, helper set in `{typography.body-md}` at smaller size coloured `{colors.body}`, error set in `{typography.body-md}` coloured `{colors.negative}`. Gap between label / input / helper is `{spacing.xs}` 4 px.

### Cards & Period Surfaces

**`card`** — the generic card primitive.

- Background `{colors.canvas}`, 1 px solid `{colors.hairline}` border, padding `{spacing.lg}` 16 px, shape `{rounded.sm}` 4 px. The base for `ex-auth-form-card`, settings cards, modal contents.

**`period-tab`** — one tab inside the historic-records segmented control below the sheet.

- Background `{colors.canvas}`, 1 px right border `{colors.hairline}` (except the last tab), padding `{spacing.md} {spacing.lg}` (14 px 16 px), flex column with `{spacing.xs}` gap. Three stacked lines: month label in `{typography.mono-caps}` coloured `{colors.body}` (or `{colors.ink}` if current); net amount in `{typography.amount-strong}` coloured `{colors.ink}` always; status in `{typography.mono-caps}` coloured `{colors.body-muted}` ("Editing", "Locked"). Current-period tab's background is `{colors.canvas-soft}`. The tab rail is wrapped by a single bordered container in `{rounded.sm}`.

### Badges & Tags

**`badge-neutral`** — the inline tag pill on light surfaces.

- Background `{colors.canvas}`, text `{colors.ink}`, 1 px solid `{colors.hairline}` border, set in `{typography.mono-caps}`, padding `{spacing.xxs} {spacing.sm}`, shape `{rounded.sm}` 4 px.

### Overlays

**`toast`** — flash notification (success, error, info).

- Background `{colors.canvas}`, 1 px solid `{colors.hairline}` border, text `{colors.ink}`, padding `{spacing.md} {spacing.lg}`, shape `{rounded.sm}` 4 px, soft drop shadow `rgba(15, 17, 22, 0.08) 0px 4px 12px 0px`. Anchors to the bottom-right of the viewport with `{spacing.2xl}` 24 px inset.

**`modal`** — confirm dialog and form drawer.

- Background `{colors.canvas}`, 1 px solid `{colors.hairline}` border, padding `{spacing.3xl}` 32 px, shape `{rounded.sm}` 4 px. Anchored to viewport centre with an `rgba(15, 17, 22, 0.5)` scrim behind. Width caps at 480 px for confirms, 640 px for forms.

**`empty-state`** — the placeholder shown when a sheet or list has no rows yet.

- Background `{colors.canvas-soft}`, 1 px solid `{colors.hairline}` border, padding `{spacing.section}` 80 px, shape `{rounded.sm}` 4 px. Inside: a single mono-caps eyebrow label, a `display-lg` headline, body-md instruction, and a `button-primary` to bootstrap. No illustration imagery.

### Popovers & Comboboxes

**`combobox`** — the search-and-pick popover used to categorise ledger rows (and pick transfer accounts).

- A `{colors.canvas}` panel anchored under its trigger, 1 px solid `{colors.hairline-strong}` border, `{rounded.sm}` corners, and a soft drop shadow (popovers float, so Level 5 applies). Search input on top with a hairline bottom border; an option list below in `{typography.body-sm}` with `{colors.canvas-soft}` hover/keyboard-highlight; an optional create panel at the bottom on `{colors.canvas-soft}`. Create/confirm buttons inside the popover fill with `{colors.accent}` — the one sanctioned accent-filled button, because a black `button-primary` inside a floating panel would compete with the page's primary CTA. Fully keyboard-navigable: arrow keys move the highlight, Enter commits, Escape dismisses.

## Data visualization

Charts (the dashboard) have their own colour grammar — series identity, not value sign — so the "amounts only" rule for green/red is deliberately relaxed *inside chart surfaces only*:

- **`{colors.positive}` green** — series that represent money in / what you own: Income bars, asset lines.
- **`{colors.negative}` red** — series that represent money out / what you owe: Expense bars, liability lines.
- **`{colors.accent}` blue** — the derived headline series: Net / surplus lines. The accent's wayfinding job carries over: blue is "the line to read".
- **`{colors.chart-rate}` amber (`#D97706`)** — rate/percentage series on a secondary axis (savings rate). Always dashed, never filled.
- **`{colors.body}` near-black** — the net-worth line on the balance trend chart, where it must sit above many coloured series.

Conventions:

- **Dash patterns are series identity, not decoration.** When several series share a colour, the dash pattern is the only differentiator (asset/liability term categories; Budget `5 4` vs 6-month avg `2 3`) — so every legend must render each entry's true colour *and* dash pattern (see `ChartLegend`). A legend with identical icons is a defect.
- **Value labels** on a headline series render as bordered chips (canvas fill, 1 px series-coloured border, 11px bold) showing the actual value, coloured by sign.
- **Chart-internal type** — axis ticks, legends, tooltips — runs at 11–12px and doesn't count against the six-size scale.
- Tooltips carry full-precision amounts; axis ticks abbreviate (`£8k`).
- No gradients, no area fills, no animation (`isAnimationActive={false}` everywhere) — charts obey the same flat, hairline-grid restraint as the sheet.

### Examples (illustrative)

These are not new primitives; they are kit-mirror surfaces composed from the primitives above, used to demonstrate the system end-to-end.

**`ex-budget-page`** — the Budget page top-to-bottom.

- `nav-bar` → page header (eyebrow + `display-xl` headline + lead + action cluster with `status-pip` + `button-outline` + `button-primary`) → `toolbar` → `formula-bar` → `sheet` (head row → section → items with `indent-1`/`indent-2` → subtotal → section → items → subtotal → grand) → `period-tab` rail → `wordmark-footer`. Page maxWidth 1240 px, padding `{spacing.3xl} {spacing.2xl} {spacing.5xl}`.

**`ex-auth-form-card`** — the sign-in / sign-up card on `/sign-in` and `/sign-up`.

- A `card` chromed at 360 px max-width, centred in the viewport. Inside: `display-xl` headline, a stack of `form-field` rows, a `button-primary` for the primary action, an "or" divider, a `button-outline` for "Continue with Google", and a small `body-md` link to switch between sign-in and sign-up.

**`ex-amount-positive` / `ex-amount-negative`** — sign-coloured amount cells.

- Same typography as `sheet-cell-amount`. Colour swap to `{colors.positive}` or `{colors.negative}` based on the sign of the value. Only applied when the variance is **material** — a $0 variance row uses `sheet-cell-dim` instead of green.

## Do's and Don'ts

### Do

- Reserve `{colors.primary}` (`#000000`) for every primary CTA. One black pill per visible viewport — that consistency is the brand's whole conversion story.
- Set every label that touches data in `{typography.mono-caps}` — uppercase, mono, 11 px, positive tracking. Column headers, section labels, button labels, eyebrows, period tabs, status pips, row indices.
- Render every currency amount in Inter with `font-variant-numeric: tabular-nums`, two decimal places, right-aligned within its row.
- Use `sheet-row-section` (dark band) to group rows visually and `sheet-row-grand` (black band) for the final total. Those two bands plus hairline cell borders are the entire visual hierarchy of the sheet.
- Apply `{colors.positive}` and `{colors.negative}` to **amounts only** on page surfaces — never to button fills, badge backgrounds, banner tints, or headlines. (Inside chart surfaces they identify money-in/money-out series — see Data visualization.)
- Apply `{colors.accent}` to **interaction and wayfinding** — links, input focus rings, active filter/nav states, eyebrow period identifiers, create actions inside popovers, the Net series in charts. Keep it off amounts and table data, and never let it compete with a black `button-primary` on the same surface.
- Dim $0 or empty amount cells to `{colors.dim}` so they recede from real data.
- Use `{rounded.sm}` 4 px as the canonical card / button / panel radius across the system. Reach for `{rounded.none}` only on full-bleed edges (sheet section bands, sheet grand-total row, nav-bar bottom border, footer wordmark).
- Render the giant `halcyon` wordmark at the bottom of every long page in `{typography.display-xxl}` at 96 px, tinted to `{colors.hairline}` so it reads as a stencil — not as a heavy footer title.
- Pair every destructive button with a `modal` confirm. Money operations need a friction beat.
- Stay within the six-size type scale (96 / 28 / 18 / 14 / 13 / 11). If a seventh size feels necessary, prefer adjusting one of these tokens.

### Don't

- Don't introduce a second accent colour, and don't use `{colors.accent}` decoratively. The blue is functional — interaction and wayfinding only; the dark section bands + black grand-total row remain the entire decorative system. (`{colors.chart-rate}` amber exists only inside chart surfaces.)
- Don't set body paragraphs in the mono face. The mono is for labels only; long-form mono reads as a console log.
- Don't set headlines in all-caps mono. Every all-caps moment belongs to the mono face; every headline belongs to Inter in sentence case.
- Don't drop a soft drop-shadow on inline cards, sheet rows, or panels. Shadows belong only on overlays (`toast`, `modal`).
- Don't use `{rounded.full}` 9999 px on CTAs. Halcyon's button shape is a slightly-rounded rectangle, never a full pill.
- Don't colour the grand-total row's amount green or red. The black band is the heaviest treatment on the page — colour fights it. Variance + sign live in the row's data, the row itself stays monochrome.
- Don't left-align an amount column. Amounts are flush-right; labels are flush-left; the column reads top-to-bottom as a sum.
- Don't omit decimals on a displayed currency amount. `$8,500.00`, not `$8,500`. Missing zeros read as estimation.
- Don't bold a $0 cell to look like data. Dim it.
- Don't fill the row-index column with anything other than the row's index number. No icons, no checkboxes, no drag handles — that column is for navigation reference only.
- Don't tint the `halcyon` wordmark anything other than `{colors.hairline}`. The point is that it nearly disappears into the canvas.
- Don't introduce more than one `sheet-row-grand` per sheet. Two grand-totals on one page reads as confusion about which is the actual total.
