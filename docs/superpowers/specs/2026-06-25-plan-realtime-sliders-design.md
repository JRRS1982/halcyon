# Plan Real-time Sliders — Design (Phase 3a + 3b)

**Date:** 2026-06-25
**Status:** Approved (brainstorm)
**Feature area:** `/plan` life-planning. The first interactive-forecast phase: drag a
slider and watch the chart, verdict, and timeline update in real time. Foundation
(client-side recompute) + assumption sliders. Draggable timeline handles (3c) and
saved scenarios (Phase 6) are deferred.

## Problem

The forecast is static: every edit goes through a server action + `router.refresh()`,
so exploring "what if I retire two years later?" means typing a number, waiting for a
round-trip, reading the result, repeating. The engine is pure and deterministic
(a locked design decision made precisely so it can re-run client-side), so we can
make the key levers **draggable with instant feedback**.

## Decisions (from brainstorm)

- **Slice:** foundation + assumption sliders now; draggable timeline handles later (3c).
- **Commit model:** dragging shows a live client-side preview; **releasing the slider
  persists** the new value via the existing `updatePlanAssumptions` action +
  `router.refresh()`. To undo, drag back. The slider is a fluid editor, not a separate
  sandbox. (Non-destructive multi-scenario exploration = Phase 6 saved scenarios.)
- **State:** page-scoped local React state via a hook — **not** Redux (installed but
  unused; ephemeral single-page state doesn't warrant it).

## Architecture

### 1. Compute the band in the browser (on demand)

Today `page.tsx` (server component) runs `projectWithBand` + `toTodaysMoneyBand` and
passes the computed `BandedProjection` to `PlanView` (client). Keep that for **first
paint** (SSR, no empty-chart flash) and keep passing the `SerializedPlan`. Add a
client recompute path used only while/after dragging:

- New pure `serializedToPlanInput(plan: SerializedPlan, asOfYear: number): PlanInput`
  in `src/lib/plan/serializedInput.ts` — mirrors the existing `toPlanInput` but maps
  from `SerializedPlan`'s plain numbers instead of Prisma `Decimal`s. Unit-tested for
  parity with `toPlanInput` on equivalent data.
- `PlanView` seeds from the server band; when a slider moves it recomputes locally and
  renders the children (`VerdictBanner` / `ChartPanel` / `Timeline`) from the live band
  instead of the server prop.

### 2. State + recompute hook

`usePlanProjection(plan: SerializedPlan, serverBand: BandedProjection, asOfYear)` in
`src/app/plan/usePlanProjection.ts`:

- holds `overrides: Partial<Pick<SerializedPlanAssumptions, "retirementAge" |
  "defaultReturnPct" | "returnSpreadPct" | "inflationPct">>` (empty when idle),
- `liveBand`: when `overrides` is empty, returns `serverBand` unchanged (no client
  compute on load); otherwise computes `toTodaysMoneyBand(projectWithBand(input, {
  withEarliest: false }), …)` from `serializedToPlanInput(plan)` with overrides merged
  over the assumptions,
- `earliestSustainableRetirementAge` is **carried over from `serverBand`** while
  overriding (see Performance), so that stat doesn't flicker,
- exposes `setOverride(key, value)` (live) and `commit(key, value)` (persist).

### 3. Sliders (commit on release)

`src/app/plan/Sliders.tsx` — a strip beside the chart, one range `<input>` per lever:

- `onChange` → `setOverride(key, n)` (live preview),
- `onPointerUp` / change-commit → `commit(key, n)`: call `updatePlanAssumptions` with
  the full assumptions (current + this override), then `router.refresh()`; clear the
  override once fresh server props arrive.
- Each slider shows its current value; min/max/step per lever (e.g. retirement age
  40–90 step 1; return −5..15 step 0.1; spread 0–10 step 0.1; inflation 0–10 step 0.1).

**Sliders (v1):** Retirement age (hero), Default return %, Return spread %, Inflation %.
The full numeric **Assumptions panel stays** for precise entry of these + everything
else (DOB, tax, state pension).

### 4. Persistence + reconciliation

On release: `updatePlanAssumptions(...)` (existing, ownership-scoped) → `router.refresh()`.
The server recomputes the full band (incl. earliest-retirement) and re-renders
`PlanView` with fresh props; the hook clears the matching override so the live band
falls back to the new server band. Net: live preview during drag, authoritative
server value after release.

## Performance (explicit — required)

The three band passes are cheap (~50 year-iterations each, sub-millisecond). The
expensive computation is `earliestSustainableRetirementAge`, which **re-runs a full
projection for every candidate retirement age** (currentAge→planToAge) — O(years²),
~50× one pass. Running it per drag frame would be the bottleneck.

- **Engine change:** `projectWithBand(input, opts?: { withEarliest?: boolean })`,
  default `true` (server/first-paint behavior unchanged). The client live path passes
  `{ withEarliest: false }`, so a drag frame costs only the 3 cheap passes; the
  earliest-retirement sweep runs **only on the server**, on release. The live
  `BandedVerdict.earliestSustainableRetirementAge` is taken from the last server band
  (carried in the hook), not recomputed — the "Earliest retirement" stat holds steady
  mid-drag and refreshes on release.
- **Throttle:** range inputs fire many `input` events; coalesce recompute to **one per
  animation frame** (`requestAnimationFrame`; cancel the prior frame). Drag end always
  computes the final value.
- **Memoize:** `serializedToPlanInput(plan)` for the unchanged base is memoized; only
  the overridden assumption fields change per frame, so the merge is shallow.
- **No layout thrash:** recompute updates React state once per frame; Recharts
  re-renders with `isAnimationActive={false}` (already set), so no animation queue
  builds up during rapid updates.
- The whole live path is allocation-light (one input object + three year arrays per
  frame); acceptable for 60fps on the ~50-year horizon.

## Files (anticipated)

- Create: `src/lib/plan/serializedInput.ts` (+ test) — `serializedToPlanInput`
- Modify: `src/lib/plan/project.ts` (+ test) — `projectWithBand` `withEarliest` opt
- Create: `src/app/plan/usePlanProjection.ts` (+ test for the pure merge/recompute parts)
- Create: `src/app/plan/Sliders.tsx`
- Modify: `src/app/plan/PlanView.tsx` (use the hook; render `Sliders`; feed children the live band)
- Modify: `e2e/plan.spec.ts` (drag a slider; assert live verdict change + persist-on-release)

`page.tsx` is unchanged (still computes the server band for first paint + passes the
serialized plan).

## Testing

- **Pure units:** `serializedToPlanInput` parity with `toPlanInput`; `projectWithBand`
  with `withEarliest:false` returns `earliestSustainableRetirementAge: null` on all
  passes and otherwise equals the `true` result; the override-merge (base + overrides
  → input) function.
- **Existing engine tests** unaffected (the new opt defaults to today's behavior).
- **E2E + live:** drag the retirement-age slider → the verdict headline / peak update
  live (no navigation); release → the value persists across a reload; the
  earliest-retirement stat updates after release. Charts aren't unit-tested (Recharts /
  jsdom — established convention).

## Backward compatibility

`projectWithBand`'s new option defaults to current behavior, so `page.tsx` and all
existing callers/tests are unchanged. No schema, data, or API change. First paint is
identical; the only new behavior is client-side recompute while a slider is active.
