---
version: beta
name: Halcyon-design-system
description: Balanced Money's design language, "Market Pages". Your money is set like the markets page of a serious financial paper — warm salmon paper, near-black warm ink, an editorial serif for headlines, section rows and big figures, a sturdy grotesk for tables and controls. Every category is a quoted line with its budget, its actual, its distance from plan and its share of spend. Oxford blue carries primary actions, claret is the house accent, teal-green and muted red carry sign. Hairline and ink rules do the structural work; corners are near-square and nothing on the page floats.

# Type scale, as built (sizes in use across the signed-in app):
#   40 → the brief's left-over figure (serif)
#   32 → page headline, key figures (serif)        display-xl
#   26 → masthead wordmark (serif; 21 on a phone)
#   20 → section heads, sheet section rows, grand total (serif)   display-lg / amount-xl
#   17 → standfirst under the headline (sans)
#   16 → sheet subhead rows: Fixed, Variable, Discretionary (serif)
#   15 → nav links, brief notes (sans)
#   14 → body, cells, amounts, buttons and toolbar controls (sans)   body-md / amount / control
#   13 → table column heads, deltas, share-of-spend %, dense UI (sans)
#   12 → caps labels over figures (sans)            kicker
# Chart internals (axis ticks, legends, tooltips) run at 11–12px inside the chart
# surface and sit outside the scale.

colors:
  primary: "#1B4E8A"
  on-primary: "#FFFFFF"
  ink: "#26211E"
  ink-soft: "#38302B"
  body: "#4D443E"
  body-muted: "#5E544C"
  dim: "#62574F"
  hairline: "#E9D2BE"
  hairline-strong: "#D8BBA2"
  canvas: "#FCEEE2"
  canvas-soft: "#F6E1CF"
  band: "#EED3BD"
  band-soft: "#F6E1CF"
  on-band: "#26211E"
  body-on-band: "#4D443E"
  hairline-band: "#D8BBA2"
  positive: "#0B6A4C"
  negative: "#A3271F"
  focus: "#1B4E8A"
  accent: "#8E1B3D"
  chart-rate: "#B4530A"
  chart-budget: "#776C63"
  chart-cash: "#0E7C96"
  chart-isa: "#15803D"
  chart-gia: "#7C3AED"
  chart-property: "#A66A00"
  chart-other-asset: "#BE185D"
  chart-pension: "#1D4ED8"
  chart-db-pension: "#C2410C"
  section-fixed: "#1B4E8A"
  section-variable: "#B4530A"
  section-discretionary: "#8E1B3D"

typography:
  display-xl:
    fontFamily: Source Serif 4, Georgia, Times New Roman, serif
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: -0.01em
  display-lg:
    fontFamily: Source Serif 4, Georgia, Times New Roman, serif
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.005em
  body-md:
    fontFamily: Libre Franklin, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.003em
  body-md-strong:
    fontFamily: Libre Franklin, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: -0.003em
  amount:
    fontFamily: Libre Franklin, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  amount-strong:
    fontFamily: Libre Franklin, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  amount-xl:
    fontFamily: Source Serif 4, Georgia, Times New Roman, serif
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0
  control:
    fontFamily: Libre Franklin, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: 0
  kicker:
    fontFamily: Libre Franklin, system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.04em
    textTransform: uppercase

rounded:
  none: 0px
  sm: 2px
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
  masthead:
    description: "Two-tier nav. Serif wordmark and the account action on the top tier; a plain text link row beneath. Closed by a 1px ink rule."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderBottom: "1px solid {colors.ink}"
    padding: "{spacing.lg} {spacing.5xl} 0"

  nav-link:
    description: "A link in the masthead's lower tier. Active page in claret with a 4px claret underline sitting on the ink rule."
    textColor: "{colors.ink}"
    activeTextColor: "{colors.accent}"
    activeBorderBottom: "4px solid {colors.accent}"
    gap: "{spacing.2xl}"

  footer:
    description: "A single ruled line of links under a 1px ink rule. Links hover to claret."
    textColor: "{colors.ink}"
    borderTop: "1px solid {colors.ink}"
    padding: "{spacing.2xl} {spacing.5xl}"

  button-primary:
    description: "Oxford blue fill. The primary action of a view (Add, Save, Get started)."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.lg}"

  button-outline:
    description: "Paper fill with a 1px ink border. Secondary actions and sign out."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.lg}"

  button-destructive:
    description: "Paper fill, red label, hairline border that turns red on hover. Always behind a confirm step."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.negative}"
    borderColor: "{colors.hairline}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.lg}"

  toolbar-tool:
    description: "A 34px control in the toolbar row above a sheet. Ink-bordered; an active toggle fills oxford blue."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    height: 34px
    padding: "0 {spacing.md}"

  text-input:
    description: "Form field. Strong hairline border; on focus the border and a 1px ring turn oxford blue."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline-strong}"
    focusBorderColor: "{colors.focus}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.md}"

  page-header:
    description: "Serif headline (display-xl) with a 17px standfirst, actions aligned to its foot."
    typography: "{typography.display-xl}"
    textColor: "{colors.ink}"
    standfirstColor: "{colors.body}"

  sheet-row-head:
    description: "Column heads: 13px sans semibold in body colour, closed by a 2px ink rule."
    textColor: "{colors.body}"
    borderBottom: "2px solid {colors.ink}"

  sheet-row-section:
    description: "Section row (Income, Expenses, Assets): display-lg serif in ink, 1px ink rule beneath."
    typography: "{typography.display-lg}"
    textColor: "{colors.ink}"
    borderBottom: "1px solid {colors.ink}"

  sheet-row-subhead:
    description: "Subhead row (Fixed / Variable / Discretionary): 16px serif label with a 4px bar in its section colour; figures stay in the sans."
    textColor: "{colors.ink}"

  sheet-row-item:
    description: "Line item. 1px hairline beneath, no vertical rules; amounts right-aligned in tabular figures."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    padding: "{spacing.sm} {spacing.md}"

  sheet-row-totals:
    description: "Section subtotal. 1px ink rule above, semibold label and figures."
    borderTop: "1px solid {colors.ink}"

  sheet-row-grand:
    description: "The bottom line (Left over, Net worth). amount-xl serif on canvas-soft between two 2px ink rules."
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.amount-xl}"
    padding: "{spacing.md} {spacing.md}"

  brief-strip:
    description: "The month in brief: a big serif figure, then up to three computed notes led in claret. Ink rule above, strong hairline below."
    borderTop: "1px solid {colors.ink}"
    borderBottom: "1px solid {colors.hairline-strong}"
    padding: "{spacing.lg} 0 {spacing.xl}"

  index-strip:
    description: "Ruled row of key figures: caps label, 32px serif figure, 13px delta with ▲▼. 2px ink rule above, 1px below, hairline-strong between tiles."
    borderTop: "2px solid {colors.ink}"
    borderBottom: "1px solid {colors.ink}"
    padding: "{spacing.lg}"

  ruled-section:
    description: "A page section opened by a 1px ink rule and a display-lg serif head. Dashboard panels, settings sections, plan sections."
    borderTop: "1px solid {colors.ink}"
    padding: "{spacing.lg} 0 {spacing.xl}"

  status-pip:
    description: "Save-state indicator in the toolbar row. Hairline box, coloured dot, caps label."
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.body}"
    typography: "{typography.kicker}"
    rounded: "{rounded.sm}"
    height: 30px
    padding: "0 {spacing.md}"
---
## Overview

**Creative North Star: "Market Pages"**

Balanced Money reads like the markets page of a serious financial paper. Each month is a page: a headline that states the verdict, a standfirst that says it in one sentence, a short brief explaining why, and below it a market-data table where every category is a quoted line with its budget, actual, distance from plan and share of spend. The aim is trust through formality, the register of a bank statement or a broadsheet, rather than the fintech default of KPI cards over a progress-bar table.

Every sentence of written feedback is computed. The budget headline, standfirst and brief notes come from pure functions in `src/lib/insights/` (`monthBrief`, `balanceBrief`, `overallBrief`) working on the user's own rows. A note can only say what a row beneath it already shows; nothing is invented, and the same month always reads the same way.

The page is flat paper. Structure comes from rules: hairlines between rows, ink rules to open sections, a heavy ink rule under table heads and a pair of them around the bottom line. Nothing floats except overlays.

**Key Characteristics:**

- Warm salmon paper ground with near-black warm ink.
- Two faces: Source Serif 4 for headlines, section rows and big figures; Libre Franklin for tables, controls and body.
- Oxford blue for primary actions, claret as the house accent, teal-green and muted red for sign only.
- Ruled sections and ruled tables, no vertical rules, no card shadows.
- Near-square 2px corners.

## Colors

A paper-and-ink palette with three working hues: oxford blue for action, claret for the house accent, and a green/red pair that carries sign. Values are in the token contract above; dark-scheme values are under Colour Schemes.

### Primary

- **Oxford Blue** (`primary`): the fill of the primary button and the "Get started" link, the active state of a toolbar toggle, and the focus colour (`focus` shares the value) for inputs and the focused sheet cell. Label on top is `on-primary`.

### Accent

- **Claret** (`accent`): the house accent. The active nav link and its 4px underline, the bold lead-in of each brief note, footer link hover, focus outlines on the mobile menu, and the Net series on the cash-flow chart. It marks where to look; it never fills a button.

### Neutral

- **Salmon Paper** (`canvas`): the page and every table cell.
- **Deeper Paper** (`canvas-soft`): the grand-total row, group (parent) rows in a sheet, outline-button hover. `band-soft` shares the value.
- **Band** (`band`): the deepest paper tint. In the app it is not used; on the public landing page it fills the call-to-action band and the step markers. It is a tint of the paper, not a dark strip.
- **Ink** (`ink`): headlines, body figures, every structural rule (masthead, footer, section openers, table head rule, grand-total rules), outline-button borders. `ink-soft` is a half-step lighter for secondary emphasis; `on-band` matches ink.
- **Body** (`body`): standfirsts, table column heads, caps labels over figures, chart axis ticks. `body-on-band` matches it.
- **Body Muted** (`body-muted`) and **Dim** (`dim`): quieter text. Dim marks a £0 or empty amount and "On budget"; both clear 4.5:1 on canvas and canvas-soft.
- **Hairline** (`hairline`): row rules, card and overlay borders, the empty track behind a share bar, chart gridlines.
- **Hairline Strong** (`hairline-strong`): input borders, the rule closing the brief strip, dividers between index-strip tiles. `hairline-band` shares the value.

### Semantic

- **Positive** (`positive`): a teal-green for a favourable figure: under budget, money in, a rise in net worth, the left-over figure when there is one.
- **Negative** (`negative`): a muted red for an adverse figure, destructive button labels and errors.
- No warning, info or success colours beyond these two.

### Section Codes

- **Fixed** (`section-fixed`, oxford), **Variable** (`section-variable`, burnt orange), **Discretionary** (`section-discretionary`, claret). Each spending section keeps one colour wherever it appears: the 4px bar on its budget subhead row, its share-of-spend bars, and its dashboard spending chart. They are graphics, so they answer to 3:1 against the page.

### Named Rules

**The Sign Only Rule.** Green and red mean favourable and adverse, nothing else. They colour figures, deltas, variance words and chart series that are money in or out; never a button fill, a banner tint or a headline.

**The Claret Points Rule.** Claret locates: the page you are on, the lead-in of a note. If it is not helping the reader find something, use ink.

## Typography

**Display Font:** Source Serif 4 (with Georgia, Times New Roman), loaded by `next/font` as `--font-serif`.

**Body Font:** Libre Franklin (with system-ui), loaded as `--font-sans`.

**Character:** a newspaper's serif for what you read as a headline or a bottom line, a sturdy grotesk for what you scan in a column. The serif is always bold (700); the sans runs 400 to 700.

### Hierarchy

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `display-xl` | 32px serif | 700 | 1.12 | Page headline (the month's verdict on Budget); index-strip figures. |
| `display-lg` | 20px serif | 700 | 1.25 | Section heads: sheet section rows, dashboard panels, settings sections. |
| `amount-xl` | 20px serif | 700 | 1.25 | Grand-total row ("Left over", "Net worth"). |
| `body-md` | 14px sans | 400 | 1.5 | Body copy and sheet cells. |
| `body-md-strong` | 14px sans | 500 | 1.5 | Emphasis in body text. |
| `amount` | 14px sans | 400 | 1.5 | Cell figures. |
| `amount-strong` | 14px sans | 500 | 1.5 | Roll-up figures on group rows. |
| `control` | 14px sans | 600 | 1.15 | Buttons, toolbar tools and selects. Sentence case. |
| `kicker` | 12px sans caps | 700 | 1.2 | The label over a figure: index-strip labels, the brief's "Left over", plan verdict stats, the status pip. Tracked 0.04em. |

Sizes outside the tokens, each used in one role:

- **40px serif** for the brief strip's left-over figure, coloured by sign.
- **26px serif** for the masthead wordmark (21px on a phone).
- **17px sans** for the standfirst under a page headline, capped at 720px wide.
- **16px serif** for sheet subhead rows (Fixed, Variable, Discretionary).
- **15px sans** semibold for nav links, and regular for brief notes.
- **13px sans** for table column heads (semibold), deltas, share-of-spend percentages and dense UI.

### Figures

Every right-aligned cell sets `tabular-nums`, so a column of amounts lines up digit for digit. Amounts carry the currency symbol and two decimals. Amount columns are right-aligned; labels are left-aligned.

### Named Rules

**The Serif Is News Rule.** The serif sets what the page is telling you: headlines, section heads, the bottom line and the big figures. Table cells, controls and running text stay in the sans.

**The Sentence Case Rule.** Headlines, buttons, column heads and nav links are sentence case. Capitals belong only to the 12px label over a figure.

## Layout

### Spacing

A 4px base. Tokens run `xxs` 2px to `5xl` 48px, plus `section` 80px. Page shells use `3xl` 32px top, `2xl` 24px sides and `5xl` 48px bottom; sides drop to `lg` 16px on a phone. The masthead and footer use `5xl` 48px sides on desktop and `lg` 16px on a phone.

### Container

Page content caps at 1240px and centres. The masthead and footer run full width.

### The sheet grid

The budget sheet has six columns: Category · Budget · Actual · vs budget · Share of spend · Notes, at `minmax(180px, 1.2fr) 120px 120px 120px 150px minmax(160px, 1fr)`. Below 992px the columns narrow and the row takes an 860px floor, scrolling sideways with the Category cell pinned left. Below 768px the sheet keeps three columns (Category, Budget, Actual at `minmax(130px, 1fr) 95px 95px`, a 320px row) and hides the rest, so a 360px phone shows the whole row.

The balance sheet has four: Account · Value · Since (the previous month, such as "Since Sep 2026", or "Change" when there is none) · Notes.

### Page order

A signed-in page reads top to bottom: page header (headline, standfirst, actions), then the brief or index strip that states where you stand, then the toolbar row, then the table or ruled sections. The first answer comes before any control.

### Breakpoints

| Name | Width | Changes |
|---|---|---|
| Phone | up to 767px | Masthead becomes wordmark plus menu button; the link row moves into a full-screen menu. Page header stacks. Brief strip goes one column, index strip two-up. Sheets drop to three columns. Toolbar groups stretch to full-width rows. |
| Tablet | 768–991px | Brief strip two columns. Sheets narrow and pan with the first column pinned. |
| Desktop | 992px and up | Full six-column budget grid; brief strip is the figure plus three note columns. |

The plan's verdict banner stacks its figures two-up at 640px.

### Touch targets

Buttons and links in the mobile menu are at least 44px tall, and sheet cells reach 44px on a phone through 12px vertical padding. Toolbar tools stay at 34px because each stretches to a full-width share of its row, so the width carries the target.

## Colour Schemes

Two schemes, both first-class. Every colour token resolves to a CSS custom property (`--c-<token>`), so one set of components serves both and the browser does the switching.

- **Light** is the default and is the paper described above.
- **Dark** is its own ramp, not an inversion: a warm near-black page with light warm ink. Sign, section and chart hues are lightened until they clear the contrast floor on the dark page.

Surfaces rise in the same order in both: `canvas` → `canvas-soft` → `band`. In dark they get lighter as they rise.

| Token | Dark value |
|---|---|
| `primary` | #9DC1F0 |
| `on-primary` | #141A22 |
| `ink` | #F7EEE6 |
| `ink-soft` | #EADFD5 |
| `body` | #D3C5B8 |
| `body-muted` | #B8A99B |
| `dim` | #AE9F91 |
| `hairline` | #362E28 |
| `hairline-strong` | #4A3F37 |
| `canvas` | #1C1815 |
| `canvas-soft` | #27211D |
| `band` | #352C26 |
| `band-soft` | #27211D |
| `on-band` | #FFFFFF |
| `body-on-band` | #D3C5B8 |
| `hairline-band` | #4A3F37 |
| `positive` | #5FC79C |
| `negative` | #F38E80 |
| `focus` | #F7EEE6 |
| `accent` | #F28FAC |
| `chart-rate` | #E9A23B |
| `chart-budget` | #8C8177 |
| `chart-cash` | #359DD1 |
| `chart-isa` | #5AA33F |
| `chart-gia` | #9B7BE0 |
| `chart-property` | #C08329 |
| `chart-other-asset` | #D06B95 |
| `chart-pension` | #5B8DEF |
| `chart-db-pension` | #D96A45 |
| `section-fixed` | #7FA9E6 |
| `section-variable` | #E39A4F |
| `section-discretionary` | #E58AA6 |

Which scheme applies is decided by a `data-theme` attribute the server writes onto `<html>` from the user's stored preference:

| Preference | Attribute | Result |
|---|---|---|
| System (default) | *none* | `prefers-color-scheme` decides, and keeps deciding |
| Light | `light` | Light, whatever the OS says |
| Dark | `dark` | Dark, whatever the OS says |

Resolving this on the server avoids a flash of the wrong scheme. Every text token in both schemes is asserted against 4.5:1 and every graphic token against 3:1 in `src/lib/palette.contrast.test.ts`.

## Elevation & Depth

The page is flat. Depth is drawn with rules, not light.

| Weight | Treatment | Use |
|---|---|---|
| Hairline | 1px `hairline` | Between sheet rows, chart gridlines, card and overlay borders. |
| Strong hairline | 1px `hairline-strong` | Input borders, the foot of the brief strip, dividers between index-strip tiles. |
| Ink rule | 1px `ink` | Masthead foot, footer top, under a sheet section row, above a subtotal, above the brief strip, opening every ruled section. |
| Heavy ink rule | 2px `ink` | Under the table column heads, above the index strip and plan verdict, and both sides of the grand-total row. |
| Tint | `canvas-soft` fill | Grand-total row and group rows. |
| Float | soft shadow plus scrim | Overlays only: drawers, popovers, menus, toasts. |

### Named Rules

**The Rules Not Boxes Rule.** A section is opened by an ink rule and a serif head, not wrapped in a card. Dashboard panels, settings sections and plan sections all follow it.

**The Nothing Floats Rule.** Shadows belong to things that sit above the page: drawers, popovers, toasts, dialogs. Never on an inline card, a row or a panel.

## Shapes

Corners are near-square. `sm` 2px is the radius for buttons, toolbar tools, inputs, cards, status pips and overlays. `none` is used on rules and table rows. `full` appears only on dots: the status dot in the plan verdict and the drag handle on a mobile bottom sheet.

Lines are horizontal. Tables have no vertical rules; columns are held apart by alignment and padding. The only vertical marks are the hairline dividers between index-strip and verdict figures, and the 4px colour bar on a subhead row or the active item in the mobile menu.

## Components

### Masthead

Two tiers on a paper ground, sticky to the top. The upper tier is the "Balanced Money" wordmark in 26px bold serif on the left and the account action on the right (an outline "Sign out" button when signed in; a "Sign in" link and an oxford "Get started" link when signed out). The lower tier is a plain text link row in 15px semibold sans, 24px apart. The whole masthead closes on a 1px ink rule; the active page is set in claret with a 4px claret underline that sits on that rule. Hover draws a strong-hairline underline. Below 768px the masthead is 56px tall with the wordmark and a 44px menu button; the menu opens full-screen with 17px links ruled by hairlines and the active link marked with a 4px claret bar.

### Footer

One ruled line: a 1px ink rule above, "Balanced Money" in 13px dim, then links in 14px ink (Guide, Design, Engineering, Privacy, Cookies, Terms) that turn claret and underline on hover.

### Page Header

A claret kicker in 12px caps naming the page and its period ("Budget · October 2026"), then a 32px serif headline, a 17px body-colour standfirst up to 720px wide, and the page's actions aligned to the foot on the right (stacked below on a phone). The kicker is how a page is named: the headline under it is a sentence about the user's money, not the page title. Budget, Balance, Dashboard and Transactions compute their headline and standfirst from the user's own figures; Plan's headline is its verdict.

### Buttons

- **Shape:** 2px corners, 8px by 16px padding, `control` type (14px semibold, sentence case). Labels never wrap.
- **Primary:** oxford blue fill, white label. Hover drops to 85% opacity.
- **Outline:** paper fill, ink label, 1px ink border. Hover fills `canvas-soft`.
- **Destructive:** paper fill, red label, hairline border that turns red on hover. Always behind a confirm modal or, for account-level actions, a type-to-confirm panel.
- **Disabled:** 50% opacity, not-allowed cursor.

### Toolbar

One row above a sheet: the primary Add first, secondary actions after, the month stepper pushed right, Delete apart. Tools are 34px, ink-bordered, `control` type, 2px corners; an active toggle fills oxford blue. On a phone each group becomes a full-width row of evenly stretched tools, and row-scoped groups appear only while a row is selected. The status pip (30px, hairline box, 12px caps label and a coloured dot: green saved, muted saving, red error) sits in the same row.

### The Sheet

A market-data table on paper.

- **Column heads:** 13px semibold sans in body colour, closed by a 2px ink rule.
- **Section rows** (Income, Expenses, Assets, Liabilities): 20px serif in ink, 24px space above, a 1px ink rule beneath, carrying the section's totals.
- **Subhead rows** (Fixed, Variable, Discretionary, and the income sections): 16px serif label; figures stay in the sans at 600 so the column reads as one. Spending sections carry a 4px bar in their section colour on the left.
- **Item rows:** 14px sans, 8px by 12px padding (12px by 8px on a phone), a hairline beneath, no vertical rules. Nesting is shown by indent only: 32px, 48px, 64px.
- **Group rows:** a parent whose figures roll up its children is tinted `canvas-soft` with weight-500 figures.
- **Subtotal rows:** a 1px ink rule above, semibold label and figures.
- **Grand total:** "Left over" on Budget, "Net worth" on Balance. 20px serif on `canvas-soft` between two 2px ink rules. The balance sheet colours net worth by sign.
- **Focused cell:** a 2px oxford outline inside the cell and a 7px square handle at its bottom-right corner.
- **Zero cells:** a £0 or empty figure is set in `dim`.

The insight columns on Budget:

- **vs budget:** the distance from plan in words, such as "£12.00 over" or "£40.00 under", semibold and coloured favourable or adverse. A row that landed on plan reads "On budget" in dim; a row with nothing budgeted or spent is blank.
- **Share of spend:** a 64 by 8px bar on a hairline track, filled to scale in the row's section colour, followed by the percentage in 13px.

On Balance, the **Since** column shows each account's movement against the previous month as ▲ or ▼ and the amount.

### The Brief Strip

"The month in brief", under the Budget page header. An ink rule above and a strong hairline below. On the left, a 220px column with the 12px caps label "Left over" (or "Short"), the figure in 40px serif coloured by sign, and "£x planned" in 13px. Beside it, up to three notes in 15px ink, each opening with a bold claret lead-in, like a news brief. The dashboard uses the same strip without the figure, because its index strip already shows it. Notes come from `monthBrief`; the strip renders nothing when there is nothing to say.

### The Index Strip

The dashboard's key figures, set like a market index row: a 2px ink rule above, 1px below, tiles divided by strong hairlines. Each tile has a 12px caps label, the figure in 32px serif with tabular figures, and a 13px delta (▲, ▼ or →) coloured by whether the move is good, followed by its comparison in body colour. Two-up on a phone, with the second row ruled off.

### Plan Verdict

The plan opens with a verdict banner between a 2px ink rule and a 1px one: a status label with a coloured dot (green on track, red not), a serif headline, a short explanation, and on the right the pulled-out ages and figures under 12px caps labels, divided by hairlines.

### Ruled Sections

Dashboard chart panels, settings sections and plan sections each open with a 1px ink rule and a 20px serif head, with 16px above the content and 20px below. No card, no fill, no shadow.

### The Front Page

The landing page is a financial paper's front page, read in under a minute:

- **Skybox:** three text teasers under the nav, each a visitor's question in 20px serif with one line beneath, linking to the article that answers it. Hidden on a phone, where the headline leads.
- **Dateline:** one caps line under the nav, the edition on the left and "Always working for you" in claret on the right. The nav's wordmark is the only nameplate. The skybox below it closes on a 4px double ink rule. Both hide on a phone.
- **Lead story:** two-thirds width, beside a hairline. The h1 at front-page size, a 20px standfirst, Get started and Sign in at 44px, the no-bank-login line, and the lead picture with an italic serif caption. Promises are worded as lasting values (you choose what goes in, export or delete any time), never as features the app may later add.
- **Rail:** "Your month, at a glance", a tinted market-data box under a 2px ink rule with 28px serif figures and their moves coloured by whether they helped, labelled as a sample; then the monthly briefing, four numbered steps.
- **Inside pages:** each section opens with a 3px ink rule and a 40px serif head. A full-width chart story (the dashboard's cash-flow chart beside its headline) leads the feature section; articles sit in two columns divided by hairlines; the small print is ruled briefs in three columns; the page closes with a ruled story repeating the actions.
- **Pictures are plates,** never whole-app screenshots: a crop of one region of a screen, captured at 2x so its text is legible where it is shown, with a separate phone plate for the lead.

### Forms and Inputs

Inputs are paper with a 1px strong-hairline border, 2px corners and 8px by 12px padding in `body-md`. Placeholder text is dim. On focus the border turns oxford and a 1px oxford ring is added. Every link, button and field that receives keyboard focus without its own treatment gets a 2px `focus` outline offset 2px; text selection is claret on paper.

### Cards and Overlays

The `Card` primitive is paper with a 1px hairline border, 2px corners and 16px padding, used for auth forms and contained panels. Drawers, popovers and menus are paper with a hairline border and a soft shadow over a light scrim; on a phone a drawer becomes a bottom sheet with a round drag handle.

## Data visualization

Charts have their own colour grammar: series identity rather than sign on a figure.

- **Positive** for money in and what you own: income bars, asset lines.
- **Negative** for money out and what you owe: expense bars, liability lines.
- **Claret** (`accent`) for the derived line to read: Net on the cash-flow chart.
- **Burnt orange** (`chart-rate`) for a rate on a secondary axis, the savings rate. Dashed.
- **Body** for the net-worth line on the balance trend, above the coloured series, and for the zero reference line.
- **Section colours** for the three spending-section charts, with `chart-budget` for the budget reference line.
- **Plan wrapper hues** (`chart-cash`, `chart-isa`, `chart-gia`, `chart-property`, `chart-other-asset`, `chart-pension`, `chart-db-pension`) for the plan's stacked charts. Seven hues cannot all be told apart under colour-vision deficiency, so the stacked plan charts add a texture as a second channel.

Conventions:

- **Dash patterns are identity.** Where series share a colour the dash tells them apart, so every legend draws each entry's true colour and dash.
- **Gridlines** are horizontal hairlines only; axis ticks are 11px in body colour.
- **No animation.** Every chart sets `isAnimationActive={false}`.
- **No gradients or decorative fills.** Charts keep the same flat, ruled restraint as the sheet.
- Tooltips carry full-precision amounts; axis ticks abbreviate (£8k).

## Do's and Don'ts

### Do:

- **Do** lead every signed-in page with its answer: the headline, the brief or index strip, then the controls.
- **Do** compute every written sentence from the user's rows with a pure function in `src/lib/insights/`, and say only what a row on the page shows.
- **Do** open sections with a 1px ink rule and a 20px serif head, and close table heads with a 2px ink rule.
- **Do** keep the grand total between two 2px ink rules, one per table.
- **Do** set amounts right-aligned in tabular figures with the currency symbol and two decimals; dim a £0.
- **Do** carry a spending section's colour everywhere that section appears: subhead bar, share bars, dashboard chart.
- **Do** use oxford blue for the one primary action in a view, and ink-bordered outline buttons for the rest.
- **Do** keep 2px corners on every control and container.

### Don't:

- **Don't** wrap a page section in a card with a shadow; rule it instead.
- **Don't** draw vertical rules inside a table.
- **Don't** use green or red for anything but a favourable or adverse figure or a money-in or money-out series.
- **Don't** fill a button with claret; claret locates, oxford acts.
- **Don't** set table cells, controls or running text in the serif.
- **Don't** write a headline, standfirst or note that is not computed from the user's data.
- **Don't** shadow anything that does not float above the page.
