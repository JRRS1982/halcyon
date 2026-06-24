# Plan Shared Age Axis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the `/plan` chart and timeline so a given age sits at the same horizontal position in both — two separate bordered cards sharing one horizontal coordinate space.

**Architecture:** Two shared constants (`PLOT_LEFT_INSET`/`PLOT_RIGHT_INSET`) define where the plot region begins and ends inside each panel's content box. A shared `PlanCard` styled component gives the chart panel and the timeline panel identical outer boxes (border + padding), so the same inset maps to the same absolute x. The chart configures Recharts margins + Y-axis width to hit those insets; the timeline configures its grid gutter + right inset to match. Pure presentation — no engine, data, or model change.

**Tech Stack:** Next.js 16 / React 19, TypeScript, styled-components, Recharts 3, Biome, Jest (unit, jsdom), Playwright (e2e).

## Global Constraints

- **Pure presentation:** no engine, schema, data, timeline-model, or band change.
- **No new unit tests:** chart components don't render under jsdom (established codebase convention). Verification = `pnpm verify` stays green (no regressions) + a live alignment pass.
- **`pnpm verify` (`typecheck && biome ci && test`) is the finish gate.** `biome ci` is stricter than `biome check` — run `pnpm format` to fix formatting before committing.
- **Biome bans the non-null assertion `!`** — use guards / `?.` / `??`.
- **Only `ChartPanel` and `Timeline` adopt `PlanCard`** — no wider refactor of the other panels (verdict/assumptions keep their own styling).
- **Alignment definition:** plot-left = `margin.left + YAxis width` must equal `PLOT_LEFT_INSET`; plot-right inset = `margin.right` must equal `PLOT_RIGHT_INSET`. Both panels must share the same outer box (border + horizontal padding) for the insets to coincide.
- **Co-Authored-By trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Shared geometry + PlanCard + chart side

**Files:**
- Create: `src/app/plan/axisGeometry.ts`
- Create: `src/app/plan/PlanCard.tsx`
- Modify: `src/app/plan/ChartPanel.tsx`
- Modify: `src/app/plan/NetWorthChart.tsx`
- Modify: `src/app/plan/CashFlowChart.tsx`
- Modify: `src/app/plan/LiquidAssetsChart.tsx`

**Interfaces:**
- Produces:
  - `PLOT_LEFT_INSET: number` (140) and `PLOT_RIGHT_INSET: number` (16) from `axisGeometry.ts`.
  - `PlanCard` — a `styled.section` (border + `rounded.sm` + `lg` padding + `display:grid` + `md` gap) from `PlanCard.tsx`. Task 2 extends it with `styled(PlanCard)`.

- [ ] **Step 1: Create the geometry constants**

Create `src/app/plan/axisGeometry.ts`:

```ts
// src/app/plan/axisGeometry.ts
// Single source of the horizontal plot geometry shared by the chart and the
// timeline so a given age lines up vertically between them. Measured in px from
// each panel's content-box (inside border + padding) — both panels use PlanCard,
// so their content-box left edges coincide and these insets map to the same x.

// Plot starts this far from the content-box left. Doubles as the timeline's
// label-gutter width and the chart's (margin.left + YAxis width).
export const PLOT_LEFT_INSET = 140;

// Plot ends this far from the content-box right (the chart's margin.right and the
// timeline track's right inset).
export const PLOT_RIGHT_INSET = 16;
```

- [ ] **Step 2: Create the shared card chrome**

Create `src/app/plan/PlanCard.tsx`:

```tsx
// src/app/plan/PlanCard.tsx
"use client";

import styled from "styled-components";

// Shared bordered-card chrome for the chart and timeline panels. Identical outer
// box (border + horizontal padding) on both is what makes PLOT_LEFT_INSET /
// PLOT_RIGHT_INSET line up between them. Other plan panels keep their own styling.
export const PlanCard = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
```

- [ ] **Step 3: ChartPanel uses PlanCard**

In `src/app/plan/ChartPanel.tsx`: remove the local `Panel` styled component and use `PlanCard` instead.

Delete:
```tsx
const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
```

Add the import (next to the other local imports):
```tsx
import { PlanCard } from "./PlanCard";
```

Change the two `<Panel>` / `</Panel>` tags in the returned JSX to `<PlanCard>` / `</PlanCard>`. (`styled` may now be unused — if so, remove the `import styled from "styled-components";` line; `Switcher`, `Tab`, `Caption` still use it, so keep it. Verify against the file.)

- [ ] **Step 4: Apply the insets to all three charts**

In **each** of `NetWorthChart.tsx`, `CashFlowChart.tsx`, `LiquidAssetsChart.tsx`:

Add the import:
```tsx
import { PLOT_LEFT_INSET, PLOT_RIGHT_INSET } from "./axisGeometry";
```

Change the `<ComposedChart>` margin from:
```tsx
        margin={{ top: 16, right: 16, bottom: 0, left: 8 }}
```
to:
```tsx
        margin={{ top: 16, right: PLOT_RIGHT_INSET, bottom: 0, left: 8 }}
```

Change the `<YAxis>` width from:
```tsx
          width={64}
```
to:
```tsx
          width={PLOT_LEFT_INSET - 8}
```

(Plot-left = `margin.left (8) + YAxis width (PLOT_LEFT_INSET - 8) = PLOT_LEFT_INSET`. Keep `left: 8` literal — it pairs with the `- 8` here.)

- [ ] **Step 5: Verify green**

Run: `pnpm typecheck && pnpm check && pnpm test`
Expected: all PASS. (No unit-test changes; this confirms no regression and clean formatting. If `pnpm check` reports formatting, run `pnpm format` and re-run.)

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/axisGeometry.ts src/app/plan/PlanCard.tsx src/app/plan/ChartPanel.tsx src/app/plan/NetWorthChart.tsx src/app/plan/CashFlowChart.tsx src/app/plan/LiquidAssetsChart.tsx
git commit -m "feat(plan): shared axis geometry + chart side (PlanCard, plot insets)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Timeline side + live alignment verification

**Files:**
- Modify: `src/app/plan/Timeline.tsx`

**Interfaces:**
- Consumes: `PLOT_LEFT_INSET`, `PLOT_RIGHT_INSET` (`axisGeometry.ts`); `PlanCard` (`PlanCard.tsx`).

- [ ] **Step 1: Import the shared geometry + card**

In `src/app/plan/Timeline.tsx`, add:
```tsx
import { PLOT_LEFT_INSET, PLOT_RIGHT_INSET } from "./axisGeometry";
import { PlanCard } from "./PlanCard";
```

- [ ] **Step 2: Use PlanCard for the panel, preserving horizontal scroll**

Replace the local `Panel` styled component:
```tsx
const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
```
with one that extends `PlanCard` (so the border/padding/grid match the chart card exactly) and keeps the timeline's horizontal scroll:
```tsx
const Panel = styled(PlanCard)`
  overflow-x: auto;
`;
```

- [ ] **Step 3: Drive the gutter from the shared constant**

Replace:
```tsx
const GUTTER = "140px";
```
with:
```tsx
const GUTTER = `${PLOT_LEFT_INSET}px`;
```

- [ ] **Step 4: Inset the track + overlay right edge**

The bar track and ref-line overlay currently run to the panel's inner right edge; inset them by `PLOT_RIGHT_INSET` so the track width matches the chart's plot width.

Add `padding-right` to the `Rows` grid:
```tsx
const Rows = styled.div`
  display: grid;
  grid-template-columns: ${GUTTER} 1fr;
  align-items: center;
  row-gap: ${({ theme }) => theme.spacing.xs};
  padding-right: ${PLOT_RIGHT_INSET}px;
`;
```

Change the `Overlay` right from `0` to the inset:
```tsx
const Overlay = styled.div`
  position: absolute;
  left: ${GUTTER};
  right: ${PLOT_RIGHT_INSET}px;
  top: 0;
  bottom: 0;
  pointer-events: none;
`;
```

(Bars, markers, ref-lines and the tick row are percentage-positioned within the `1fr` track, which now ends `PLOT_RIGHT_INSET` before the content-box right — matching the chart's `margin.right` — so they inherit the alignment.)

- [ ] **Step 5: Verify green**

Run: `pnpm typecheck && pnpm check && pnpm test`
Expected: all PASS. (`pnpm format` first if `pnpm check` flags formatting.)

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/Timeline.tsx
git commit -m "feat(plan): align timeline to the shared age axis (PlanCard + insets)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Live alignment pass (controller)**

This is the real verification (Recharts doesn't render under jsdom). With the app on `:3210` (Docker `app` container or `pnpm dev`) signed in as demo, on `/plan`:
1. Confirm a known age lines up vertically between the chart and the timeline below it — e.g. the retirement ref-line (age 60) and the state-pension ref-line (67) in the timeline sit at the same x as ages 60/67 on the chart's axis.
2. Switch the chart across all three views (Net worth / Cash flow / Liquid assets) and confirm alignment holds for each (all three use the same inset).
3. Confirm both panels are bordered cards and the timeline still scrolls horizontally when the window is narrow.

Document the result (alignment holds / any pixel drift) for the PR description. No commit unless a tweak is needed.

---

## Self-Review

**Spec coverage:**
- §1 geometry constants → Task 1 Step 1. ✓
- §2 shared `PlanCard` chrome on both panels → Task 1 Steps 2-3 (chart), Task 2 Step 2 (timeline). ✓
- §3 chart side (margin + YAxis width from constants, all three views) → Task 1 Step 4. ✓
- §4 timeline side (gutter = inset, track + overlay right inset) → Task 2 Steps 3-4. ✓
- §5 responsive (timeline keeps `overflow-x: auto`) → Task 2 Step 2 (`styled(PlanCard)` adds it back). ✓
- §6 testing (no new unit tests; live alignment pass) → Global Constraints + Task 2 Step 7. ✓
- Backward compat (no data/schema/API change) → nothing to migrate; the plan touches only presentation files. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows the exact code. Task 1 Step 3 notes "verify against the file" for whether `import styled` stays — this is a concrete conditional (keep it: `Switcher`/`Tab`/`Caption` still use `styled`), not a placeholder.

**Type consistency:** `PLOT_LEFT_INSET` / `PLOT_RIGHT_INSET` (numbers) and `PlanCard` (styled.section) are named identically in `axisGeometry.ts`/`PlanCard.tsx` (Task 1) and consumed under those exact names in the charts (Task 1) and `Timeline.tsx` (Task 2). `GUTTER` interpolates `${PLOT_LEFT_INSET}px`; `Overlay`/`Rows` use `${PLOT_RIGHT_INSET}px`. Consistent.
