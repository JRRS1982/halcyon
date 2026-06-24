# Plan Shared Age Axis — Design (E)

**Date:** 2026-06-24
**Status:** Approved (brainstorm)
**Feature area:** `/plan` life-planning — the last unbuilt piece of the redesign arc (after presentation polish #69, the editing drawer #70/#71, and the return band #72).

## Problem

The chart and the timeline both plot against age, but in different coordinate
spaces, so the same age sits at a different horizontal position in each:

- **Chart** (Recharts): the plot area starts ~72px from the left (`YAxis width=64`
  + `margin.left=8`) and ends `margin.right=16` from the right. No panel
  border/padding.
- **Timeline**: a CSS grid with a 140px left label gutter; bars/markers/ref-lines
  are percentage-positioned in the remaining `1fr` track. Lives in a bordered,
  `lg`-padded panel.

The approved redesign mockup paired them on one shared age axis. This makes a
given age (e.g. retirement at 60) line up vertically between the curve and the
timeline bars below it, so the two read as one picture.

## Decision

**Two separate panels, aligned** (chosen over merging into one panel or
relocating the timeline's row labels). Keep the chart and timeline as distinct
bordered cards, but force their plot regions into the same horizontal pixels so
ages align vertically. Timeline row labels stay in their left gutter. Purely
presentational — no engine/data/model change.

## Out of scope (deliberately)

- Merging chart + timeline into a single panel / single axis row.
- Relocating timeline row labels (e.g. captions above bars).
- Any engine, data, timeline-model, or band change.
- Drag-to-edit on the timeline (still deferred).

## Design

### 1. Single source of axis geometry — `src/app/plan/axisGeometry.ts`

```ts
export const PLOT_LEFT_INSET = 140;  // px from panel content-box left to plot start
export const PLOT_RIGHT_INSET = 16;  // px from panel content-box right to plot end
```

These two numbers are the only definition of alignment. Both panels import them;
changing one value moves both plot regions together.

### 2. Shared panel chrome

Alignment holds only if both panels' **content-box left edges coincide**. They
are already full-width siblings in the `PlanView` `Shell` grid (no horizontal
margin), so the only differences are border + horizontal padding. Today the chart
panel (`ChartPanel`) has neither; the timeline panel has a 1px border + `lg`
padding.

Extract the shared card chrome (border, `rounded.sm`, horizontal padding) into a
new `src/app/plan/PlanCard.tsx` styled component used by **both** `ChartPanel` and
`Timeline` (and only those two — the other panels keep their own styling; no wider
refactor). With identical outer boxes, `PLOT_LEFT_INSET` measured from each
content-box left maps to the same absolute x. The chart panel gains the
bordered-card look the verdict/assumptions/timeline panels already have — a
deliberate consistency improvement, not just incidental.

The chart's caption + view switcher remain above the plot, inside the chart card,
unaffected by the inset (they are not part of the plot region).

### 3. Chart side

All three chart views — `NetWorthChart`, `CashFlowChart`, `LiquidAssetsChart` —
swap into the same `ChartPanel` slot, so all three must use the same inset.
Configure Recharts so the plot starts at `PLOT_LEFT_INSET` and ends at
`PLOT_RIGHT_INSET`:

- plot-left = `margin.left + YAxis width` ⇒ set these to sum to `PLOT_LEFT_INSET`
  (e.g. `YAxis width = PLOT_LEFT_INSET - 8`, `margin.left = 8`), so the Y-axis tick
  labels stay right-aligned immediately left of the plot, with the remaining space
  reading as the label column.
- `margin.right = PLOT_RIGHT_INSET`.

The three charts currently share identical margin/axis settings, so this is the
same edit applied consistently to each.

### 4. Timeline side

- The grid gutter changes from the literal `140px` to `PLOT_LEFT_INSET` (≈ the
  same width — row labels keep their room).
- The bar track and the ref-line `Overlay` inset their right edge by
  `PLOT_RIGHT_INSET` (today the track runs to the panel's inner right edge).
- Bars, markers, ref-lines and the age-tick row are already percentage-positioned
  within the track, so they inherit the alignment with no further change.

### 5. Responsive behaviour

Alignment is exact at the shared content width. The timeline keeps its existing
`min-width` + `overflow-x: auto`; below that width it scrolls independently (as it
does today). The chart uses `ResponsiveContainer` and scales. This divergence
below the timeline's min-width is pre-existing and accepted — not introduced here.

## Files touched (anticipated)

- Create: `src/app/plan/axisGeometry.ts` (the two inset constants)
- Create: `src/app/plan/PlanCard.tsx` (shared bordered-card chrome)
- Modify: `src/app/plan/ChartPanel.tsx` (use `PlanCard`)
- Modify: `src/app/plan/Timeline.tsx` (use `PlanCard`; gutter + right inset from constants)
- Modify: `src/app/plan/NetWorthChart.tsx`, `CashFlowChart.tsx`, `LiquidAssetsChart.tsx` (margin + YAxis width from constants)

## Testing

Pure presentation; Recharts doesn't render under jsdom, so no new unit tests
(consistent with the established charts convention). Verification is a **live
browser pass**: confirm a known age (retirement 60, state pension 67) sits at the
same horizontal x in the chart and in the timeline below it, across all three
chart views and at a couple of viewport widths. `pnpm verify` (typecheck + biome
ci + existing unit suite) must stay green.

## Backward compatibility

No data, schema, or API change. The only user-visible changes are the chart panel
gaining a card border and the two plot regions lining up. Nothing to migrate.
