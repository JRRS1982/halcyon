# Plan Return Band — Design (D2)

**Date:** 2026-06-24
**Status:** Approved (brainstorm)
**Feature area:** `/plan` life-planning — first genuinely-new per-plan field after the D1 editing-drawer architecture (PR #70) and the drawer a11y close-out (PR #71).

## Problem

The forecast currently compounds every asset at a single return rate
(`grow(balance, expectedReturnPct ?? defaultReturnPct)` — `project.ts:126`),
producing one deterministic net-worth trajectory and a binary verdict ("your
money runs short at age 64"). Real outcomes depend heavily on market returns,
and a single line over-states the precision of the forecast. Voyant-style tools
show a **band** of outcomes so the user reads the forecast as a range, not a
promise.

## Decision summary (the forks, already chosen)

1. **Band meaning — plan-level spread (±%).** One spread number on the plan's
   assumptions. The engine runs **three deterministic passes** — pessimistic /
   expected / optimistic — applying the spread to every asset's return. The
   "expected" (mid) pass is *exactly* today's behaviour, so the change is purely
   additive.
2. **Verdict — range anchored on mid.** The headline still states the mid
   (expected) outcome as the primary answer, with the band as a qualifier; the
   pulled-out stats show the mid value with a low–high range beside it.
3. **Cone scope — net worth + liquid assets.** Both area-based chart views get a
   shaded cone. The cash-flow view (diverging bars) is unchanged.

## Out of scope (deliberately)

- Per-asset return bands (wider band for equities, narrow for cash). Set aside in
  favour of the simpler plan-level spread; revisit only if the uniform spread
  proves too blunt.
- Monte Carlo / percentile bands. Conflicts with the locked deterministic-engine
  decision (the engine re-runs client-side for future sliders) and is a much
  bigger build.
- A cone on the cash-flow view. A cone doesn't map cleanly onto stacked diverging
  bars; the band lives on the two area views where it reads naturally.

## Design

### 1. Data model — one migration

Add a single column to the `Plan` model, beside the other assumptions:

```prisma
returnSpreadPct  Decimal @default(0) @db.Decimal(5, 2)
```

- **DB default `0`** → the band is **opt-in**. A `±0` spread makes all three
  passes identical, collapsing the cone to today's single line, so no existing
  plan's chart changes silently on deploy.
- The **demo seed** (`prisma/seed.ts`) sets `returnSpreadPct: 2.0` so the feature
  is visibly showcased on the demo account.
- Migration authored container-only (`make migrate-create
  name=add_return_spread`), then applied to `halcyon_test` before `pnpm test:int`.

### 2. Engine — `projectWithBand`

The spread shifts **every asset's effective return** uniformly. Cash's return
moves the same ±% as equities — consistent with having set aside the per-asset
approach.

- Add an optional `returnDeltaPct = 0` parameter to the existing internal
  `projectYears`. The only behavioural change is line 126's grow call:
  `grow(balance, (a.expectedReturnPct ?? input.defaultReturnPct) + returnDeltaPct)`.
  With the default `0`, `projectYears` is byte-for-byte equivalent to today.
- Add `PlanInput.returnSpreadPct: number` (default 0 when absent).
- New pure function:

  ```ts
  projectWithBand(input: PlanInput): BandedProjection
  // spread = input.returnSpreadPct (>= 0)
  // mid  = projectYears(input, 0)        ← identical to today's project()
  // low  = projectYears(input, -spread)
  // high = projectYears(input, +spread)
  ```

- **No clamping** on the low pass — a negative low return is realistic and the
  arithmetic is harmless.
- New types:
  - `BandedProjection = { low: YearProjection[]; mid: YearProjection[]; high: YearProjection[]; verdict: BandedVerdict }`
  - `BandedVerdict` extends today's `Verdict` (computed on the **mid** pass) with:
    - `firstShortfallAgeRange: [number, number] | null` — `[min, max]` of the
      first-shortfall age across the three passes; `null` only when no pass ever
      shorts. (Shortfall age is an age, not a money amount, so it is
      deflation-invariant — no today's-money subtlety.)
    - `peakNetWorthRange: [number, number]` — `[min, max]` peak net-worth
      **value, in today's money**, across the three passes.
    - `earliestSustainableRetirementAge` stays **mid-only** (the "retire later"
      hint).
  - **Deflation order (removes ambiguity):** each pass's peak occurs at its own
    age, and deflation is age-dependent, so `peakNetWorthRange` must be derived
    from the three passes' *already-deflated* peak values — never by deflating a
    pre-computed nominal range (which has no single age). Concretely:
    `projectWithBand` assembles the three passes plus each pass's own (nominal)
    `Verdict`; the band-aware `toTodaysMoney` deflates each pass's
    `peakNetWorth.value` at *that pass's* peak age; then a small pure helper takes
    the min/max of the three deflated peaks and the min/max of the three shortfall
    ages to produce the `BandedVerdict` ranges. Keeping the range computation
    after deflation also keeps it independently unit-testable.
- Spread `0` ⇒ three identical passes ⇒ ranges collapse to the mid value. This is
  the backward-compat guarantee and a clean test assertion.
- `project()` is kept unchanged for existing callers / tests; `projectWithBand`
  is the new entry point the page uses.

### 3. Wiring — `page.tsx` + `toPlanInput`

- `toPlanInput` reads `plan.returnSpreadPct` into `PlanInput.returnSpreadPct`.
- `toTodaysMoney` is applied to **each** pass (low/mid/high) before display — the
  deflation is per-year nominal→today's-money and must run on all three. Extend
  it (or wrap it) to deflate a `BandedProjection`: deflate each pass's years and
  each pass's `peakNetWorth.value` at that pass's peak age, then compute the
  `BandedVerdict` ranges from the deflated peaks + shortfall ages (see §2).
- `page.tsx` swaps `project()` → `projectWithBand()` and threads low/mid/high
  year arrays + the banded verdict into `PlanView`.
- `serialized.ts` / `SerializedPlan.assumptions` gains `returnSpreadPct: number`.

### 4. Charts — net worth + liquid only

New **pure** transforms in `chartData.ts` (unit-tested):

- `toNetWorthBandData(low, mid, high)` → `[{ age, low, mid, high }]`
- `toLiquidAssetsBandData(low, mid, high)` → same shape (liquid total per pass)

Rendering (Recharts, in `NetWorthChart.tsx` + `LiquidAssetsChart.tsx`): the cone
is a transparent base `Area` at `low` plus a shaded stacked `Area` of height
`high − low`, with the existing `mid` line drawn on top. The cash-flow chart is
untouched. Charts are not unit-tested (Recharts doesn't render under jsdom) —
covered by e2e + a live browser pass, per the standing convention.

### 5. UI — assumptions editor + verdict

- **`AssumptionsPanel`**: one new "Return spread ±%" `NumberCell`, reusing
  `EditableCell` → `updatePlanAssumptions` action → `router.refresh()`. Extend
  `updatePlanAssumptionsSchema` with
  `returnSpreadPct: z.number().min(0).max(10)`, and the `updatePlanAssumptions`
  action's `update` data.
- **`VerdictBanner`**: the mid headline is unchanged; add a qualifier line
  ("between 61 and 71 depending on returns") and low–high ranges beneath the
  peak-net-worth and runs-out stats. When the spread is 0 the ranges equal the
  mid values; render the qualifier only when `low !== high` so a 0-spread plan
  reads exactly as today.

## Testing

- **Engine units** (`project.test.ts` or a new `band.test.ts`):
  - `projectWithBand(input).mid` deep-equals `project(input).years`.
  - Net worth is monotonic across passes each year: `low ≤ mid ≤ high`.
  - Spread `0` ⇒ all three passes equal and verdict ranges collapse to mid.
  - First-shortfall range: low pass shorts no later than mid, high no earlier.
- **`chartData` units**: band transforms produce aligned `{age, low, mid, high}`
  rows; `high − low ≥ 0`.
- **`schemas.test`**: `updatePlanAssumptionsSchema` accepts a valid spread,
  rejects negative and out-of-range.
- **Integration** (`updateActions.int.test.ts`): `updatePlanAssumptions`
  persists `returnSpreadPct`.
- **E2E + live**: the two cones render on the net-worth and liquid views; the
  verdict shows a range; editing the spread re-renders the cone width.

## Files touched (anticipated)

- `prisma/schema.prisma` + new migration; `prisma/seed.ts`
- `src/lib/plan/types.ts` (PlanInput, BandedProjection, BandedVerdict)
- `src/lib/plan/project.ts` (returnDeltaPct param, projectWithBand)
- `src/lib/plan/toPlanInput.ts` (read spread; band-aware toTodaysMoney)
- `src/lib/plan/chartData.ts` (+ test) — band transforms
- `src/lib/plan/schemas.ts` (+ test) — returnSpreadPct
- `src/app/plan/page.tsx`, `serialized.ts`
- `src/app/plan/actions.ts` (updatePlanAssumptions)
- `src/app/plan/AssumptionsPanel.tsx`, `VerdictBanner.tsx`
- `src/app/plan/NetWorthChart.tsx`, `LiquidAssetsChart.tsx`, `PlanView.tsx`
- `e2e/plan.spec.ts`

## Backward compatibility

A `±0` spread is indistinguishable from today at every layer: the engine returns
three identical passes, the cone collapses to the mid line, and the verdict omits
the range qualifier. Existing plans deploy with `0` and look unchanged; only the
demo seed and any plan the owner edits opt into a visible band.
