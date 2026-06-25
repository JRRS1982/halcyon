# Plan Draggable Timeline Events — Design (Phase 3c v1)

**Date:** 2026-06-25
**Status:** Approved (brainstorm)
**Feature area:** `/plan` life-planning. The direct-manipulation half of the
sliders vision: drag a one-off **event marker** on the timeline to delay/advance
it and watch the forecast recompute live. First slice of Phase 3c; income/expense/
liability **bar-edge** dragging is the deferred 3c-2 slice.

## Problem

Phase 3b made the plan-level *assumptions* draggable (sliders). But a one-off
event ("buy a car at 50") has no slider — to move it you open the drawer and type
a new age. Direct manipulation on the timeline ("grab the marker, slide it to 54")
is the natural interaction and shows the cash-flow/net-worth impact of *when* a
one-off happens. The pure engine already re-runs client-side (Phase 3b), so we can
do this live.

## Decisions (from brainstorm)

- **Scope v1:** draggable **event markers** only (single-point drag). Income/
  expense/liability bar-edge dragging is deferred to 3c-2.
- **Commit model:** dragging shows a live client-side preview (instant recompute);
  releasing persists `event.age` via the existing `updatePlanEvent` action +
  `router.refresh()` — same commit-on-release + reconciliation as the sliders.
- **Accessibility:** each marker is a keyboard-operable slider (arrow keys nudge
  the age), not pointer-only.
- **Demo:** the demo plan must demonstrate the feature — it currently has no
  events, so the plan bootstrap gains a representative example event.

## Architecture

### 1. Extend the live-recompute overrides to per-entity (events)

Phase 3b's `usePlanProjection` / `computeLiveBand` override only plan-level
assumptions. Widen the override value to carry event overrides too:

```ts
// liveBand.ts
export type LiveOverrides = {
  assumptions: AssumptionOverrides;
  events: Record<string, number>; // event id → overridden age
};
```

`computeLiveBand(plan, overrides, serverBand, asOfYear)`:
- returns `serverBand` by reference when **both** `assumptions` and `events` are
  empty (unchanged zero-compute-on-idle guarantee),
- otherwise merges assumption overrides onto `plan.assumptions` (as today) **and**
  maps event overrides onto `plan.events` (`events.map(e => id in ov ? {...e, age:
  ov[e.id]} : e)`), then `serializedToPlanInput` → `projectWithBand(input, {
  withEarliest: false })` → `toTodaysMoneyBand`, carrying `serverBand`'s
  earliest-retirement value.

This is a small refactor of the 3b override object; the hook + its tests update to
the new shape. The event's `age` flows into the engine's per-year event handling
(`eventsNet = Σ events where age === year`), so moving it shifts which year the
in/outflow lands — changing the net-worth trajectory and possibly feasibility.

### 2. `usePlanProjection` gains event setters

The hook adds, alongside the slider `setOverride`/`commit`:
- `setEventOverride(id, age)` — live preview (rAF-throttled, same path),
- `commitEvent(id, age)` — `updatePlanEvent({ eventId: id, label, age, direction,
  amount })` (full event from the serialized record + new age) then
  `router.refresh()`.

It also exposes `liveEvents` (the plan's events with overrides applied) so the
Timeline renders markers at their live ages. Overrides clear when fresh
`serverBand` props arrive (existing effect), so committed values reconcile with no
flash-back.

### 3. Timeline markers become draggable + keyboard sliders

The `Timeline` (today a dumb renderer) makes each event marker interactive:
- **Pointer:** `pointerdown` → `setPointerCapture`; `pointermove` → age from
  pointer-x; `pointerup` → commit.
- **Pixel→age** is the inverse of `timelineData`'s `pct()`. The pure part —
  `ageFromOffset(clientX, trackLeft, trackWidth, minAge, maxAge): number` (=
  `clamp(round(minAge + ((clientX − trackLeft) / trackWidth) × span)))`, with a
  degenerate-width guard) — lives in `timelineData.ts` and is unit-tested; the
  component supplies `trackLeft`/`trackWidth` from `getBoundingClientRect()` on a
  ref to the event track.
- **Keyboard:** each marker is `role="slider"`, `tabIndex={0}`,
  `aria-label`={event label}, `aria-valuemin/aria-valuemax/aria-valuenow` =
  `minAge`/`maxAge`/age; ArrowLeft/Right (and Down/Up) nudge ±1 year live, commit
  on `keyup`.
- The Timeline accepts `onEventInput(id, age)` + `onEventCommit(id, age)` and
  renders markers from the **live** event ages (passed in by `PlanView`).

`PlanView` wires the hook's `setEventOverride`/`commitEvent` + `liveEvents` to the
Timeline. The Timeline keeps rendering income/expense/liability bars and ticks
read-only (bar dragging is 3c-2).

### 4. Demo example event (keep the demo current)

The example event is created in **`createPlan`**, not `seedPlanChildren` — only
`createPlan` has the user's `dateOfBirth` (it needs `currentAge` to place the
event in range), and this leaves the pure, unit-tested `seedPlanChildren`
untouched. `createPlan` adds one representative example to its plan-creation
`events: { create: [...] }`: a `"New car"` `OUTFLOW` of `£15,000` at
`min(currentAge + 5, planToAge − 1)` (in-range, mid-term). New plans — including a
freshly-seeded demo — bootstrap with one event so the timeline isn't empty and the
drag feature is demonstrable. Existing plans are unaffected (this runs only at
plan creation); the deployed demo plan gets the example when next re-seeded (or
one can be added via "+ Add event").

## Performance

Reuses the 3b live path unchanged — `projectWithBand(input, { withEarliest:
false })`, rAF-throttled, idle returns the server band by reference. A marker drag
recomputes only the three cheap band passes; the O(years²) earliest-retirement
sweep runs only on the server on release.

## Files (anticipated)

- Modify: `src/lib/plan/timelineData.ts` (+ test) — `ageFromOffset` pure inverse
- Modify: `src/app/plan/liveBand.ts` (+ test) — `LiveOverrides` shape + event merge
- Modify: `src/app/plan/usePlanProjection.ts` — event override state, `setEventOverride`, `commitEvent`, `liveEvents`
- Modify: `src/app/plan/Timeline.tsx` — draggable + keyboard event markers
- Modify: `src/app/plan/PlanView.tsx` — wire event drag callbacks + live events to Timeline
- Modify: `src/app/plan/actions.ts` — `createPlan` creates one example event (dob-derived age)
- Modify: `e2e/plan.spec.ts` — drag/keyboard an event marker; assert persistence

## Testing

- **Pure units:** `ageFromOffset` (round, clamp to range, degenerate width → minAge);
  `computeLiveBand` with an event override (band changes; idle-by-both-empty still
  returns serverBand by reference; earliest carried). The `createPlan` example
  event is covered by the existing create-plan integration test (assert one event
  with the expected label/direction/amount and an in-range age).
- **E2E:** focus an event marker and press ArrowRight (keyboard path — deterministic,
  avoids synthetic-pointer flakiness) → assert the event's age persists across a
  reload. (Pointer drag is exercised in the live pass.)
- **Live:** drag the demo's example event marker → the net-worth dip moves; the
  verdict recomputes; release persists; arrow keys work. Charts/timeline drag
  aren't unit-tested (Recharts/rAF/DOM-rect under jsdom — established convention).

## Backward compatibility

`computeLiveBand`'s override shape changes (`AssumptionOverrides` → `LiveOverrides`)
— internal to the plan feature, updated at its call sites + tests; no external
surface. `createPlan` adding a seeded event affects only newly-created plans.
First paint, the engine, and existing plans are unchanged. No schema/DB migration.
