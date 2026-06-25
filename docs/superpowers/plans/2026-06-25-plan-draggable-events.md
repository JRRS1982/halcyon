# Plan Draggable Timeline Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one-off event markers on the `/plan` timeline draggable (and keyboard-operable) so the user can slide an event to a new age and watch the forecast recompute live, persisting on release.

**Architecture:** Extends the Phase 3b client-recompute foundation from assumption-only overrides to per-entity (event-age) overrides. Dragging a marker sets an event-age override → live `computeLiveBand` (reusing the `withEarliest:false` + rAF path) and re-positions the marker; releasing persists `event.age` via `updatePlanEvent` + `router.refresh()`. `createPlan` seeds one example event so the demo/new plans demonstrate the feature.

**Tech Stack:** Next.js 16 / React 19, TypeScript, styled-components, Recharts 3, Jest + RTL (unit, jsdom), Playwright (e2e), Biome. Local React state (no Redux). Pointer Events + ARIA slider for the drag handle.

## Global Constraints

- **Reuse the 3b live path:** event recompute MUST go through `computeLiveBand` → `projectWithBand(input, { withEarliest: false })` (never the O(years²) earliest sweep on a drag frame); rAF-throttled; idle (no overrides at all) returns the server band by reference.
- **Commit on release:** pointer drag previews live; `pointerup`/`keyup` persists `event.age` via `updatePlanEvent` + `router.refresh()`. Overrides clear only when fresh `serverBand` props arrive (existing effect).
- **Accessibility:** each event marker is a keyboard-operable slider — `role="slider"`, `tabIndex={0}`, `aria-label`/`aria-valuemin`/`aria-valuemax`/`aria-valuenow`; Arrow keys nudge ±1 year (live), commit on `keyup`.
- **Scope v1:** event markers only. Income/expense/liability bar edges stay read-only (3c-2).
- **`pnpm verify` (`typecheck && biome ci && test`) is the finish gate.** `biome ci` is stricter; run `pnpm format` if needed. **Implementers run `pnpm check`, not just `pnpm typecheck`.**
- **Biome bans the non-null assertion `!`** — use guards / `?.` / `??`.
- **Charts/timeline-drag/hooks aren't unit-tested** (Recharts/rAF/DOM-rect under jsdom — established convention); pure logic IS unit-tested; the interaction is covered by e2e + a live pass.
- **Co-Authored-By trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `ageFromOffset` — pure pixel→age inverse

**Files:**
- Modify: `src/lib/plan/timelineData.ts`
- Test: `src/lib/plan/timelineData.test.ts`

**Interfaces:**
- Produces: `ageFromOffset(clientX: number, trackLeft: number, trackWidth: number, minAge: number, maxAge: number): number` — the inverse of the existing `pct()`; rounds to a whole year, clamps to `[minAge, maxAge]`, returns `minAge` when `trackWidth <= 0`.

- [ ] **Step 1: Write the failing test**

In `src/lib/plan/timelineData.test.ts`, add:

```ts
import { ageFromOffset } from "./timelineData";

describe("ageFromOffset", () => {
  // track spans 44..95 over 0..1000px from x=100
  it("maps the track left edge to minAge and right edge to maxAge", () => {
    expect(ageFromOffset(100, 100, 1000, 44, 95)).toBe(44);
    expect(ageFromOffset(1100, 100, 1000, 44, 95)).toBe(95);
  });
  it("maps the midpoint to the rounded middle age", () => {
    // halfway = 44 + 0.5*51 = 69.5 → round → 70
    expect(ageFromOffset(600, 100, 1000, 44, 95)).toBe(70);
  });
  it("clamps below minAge and above maxAge", () => {
    expect(ageFromOffset(0, 100, 1000, 44, 95)).toBe(44);
    expect(ageFromOffset(5000, 100, 1000, 44, 95)).toBe(95);
  });
  it("returns minAge for a degenerate track width", () => {
    expect(ageFromOffset(300, 100, 0, 44, 95)).toBe(44);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `make test name="ageFromOffset"`
Expected: FAIL — `ageFromOffset` not exported.

- [ ] **Step 3: Implement it**

In `src/lib/plan/timelineData.ts`, after the `toTimelineModel` function (or near the top, beside the layout maths), add:

```ts
// Inverse of the layout pct(): given a pointer x and the track's left/width
// (from getBoundingClientRect), return the whole-year age under the cursor,
// clamped to the range. Degenerate width → minAge.
export function ageFromOffset(
  clientX: number,
  trackLeft: number,
  trackWidth: number,
  minAge: number,
  maxAge: number,
): number {
  if (trackWidth <= 0) return minAge;
  const fraction = (clientX - trackLeft) / trackWidth;
  const age = Math.round(minAge + fraction * (maxAge - minAge));
  return Math.min(Math.max(age, minAge), maxAge);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `make test name="ageFromOffset"` then `pnpm typecheck && pnpm check`
Expected: PASS; clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/timelineData.ts src/lib/plan/timelineData.test.ts
git commit -m "feat(plan): ageFromOffset — pure pixel→age inverse for timeline drag

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `createPlan` seeds one example event

**Files:**
- Modify: `src/app/plan/actions.ts` (`createPlan`)
- Test: `src/__tests__/plan/crudActions.int.test.ts` (or the existing create-plan integration test — see Step 4)

**Interfaces:**
- Produces: newly-created plans contain one example event — `{ label: "New car", direction: "OUTFLOW", amount: 15000, age: min(currentAge + 5, planToAge − 1) }`.

- [ ] **Step 1: Add the example event to `createPlan`**

In `src/app/plan/actions.ts`, inside `createPlan`'s `tx.plan.create({ data: { ... } })`, alongside the existing `assets`/`liabilities`/`incomes`/`expenses` create blocks, add an `events` block. Compute the age from the provided `dateOfBirth` (the plan's `planToAge` defaults to 95 via the schema, so clamp below that):

```ts
    const currentAge =
      new Date().getUTCFullYear() - new Date(dateOfBirth).getUTCFullYear();
    const carAge = Math.min(currentAge + 5, 94); // planToAge default 95 − 1

    await tx.plan.create({
      data: {
        userId,
        dateOfBirth: new Date(dateOfBirth),
        retirementAge,
        returnSpreadPct: 2,
        statePensionAge: 67,
        statePensionAnnual: 11500,
        assets: { create: seeded.assets },
        liabilities: { create: seeded.liabilities },
        incomes: { create: seeded.incomes },
        expenses: { create: seeded.expenses },
        events: {
          create: [
            {
              label: "New car",
              age: carAge,
              direction: "OUTFLOW",
              amount: 15000,
            },
          ],
        },
      },
    });
```

(Match the exact existing `data` block in the file — add only the `events` create + the two `const` lines above the `tx.plan.create` call. Keep every other field as-is.)

- [ ] **Step 2: Write/extend the integration test**

In the integration test that exercises `createPlan` (search `src/__tests__/plan/` for the existing `createPlan` test; it lives in `crudActions.int.test.ts`), after the plan is created assert the example event exists:

```ts
const events = await prisma.planEvent.findMany({
  where: { plan: { userId: TEST_USER_ID }, deletedAt: null },
});
expect(events).toHaveLength(1);
expect(events[0]).toMatchObject({
  label: "New car",
  direction: "OUTFLOW",
});
expect(Number(events[0]?.amount)).toBe(15000);
expect(events[0]?.age).toBeGreaterThan(0);
```

(If there is no existing `createPlan` integration test, add a minimal one mirroring the file's other create tests — call `createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 })` as the seeded `TEST_USER_ID`, then the assertions above. Reuse the file's existing setup/helpers.)

- [ ] **Step 3: Run integration test + typecheck + format**

Run:
```bash
pnpm typecheck && pnpm check
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public DIRECT_URL=postgresql://postgres:postgres@localhost:5432/halcyon_test?schema=public pnpm test:int -- crudActions
```
Expected: PASS (the new event is created + asserted).

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/actions.ts src/__tests__/plan/crudActions.int.test.ts
git commit -m "feat(plan): createPlan seeds one example event (demo shows the feature)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `LiveOverrides` + event-merge in `computeLiveBand`

**Files:**
- Modify: `src/app/plan/liveBand.ts`
- Test: `src/app/plan/liveBand.test.ts`

**Interfaces:**
- Consumes: `serializedToPlanInput`, `projectWithBand`, `toTodaysMoneyBand`, `BandedProjection`, `SerializedPlan`.
- Produces:
  - `type AssumptionOverrides` (unchanged).
  - `type LiveOverrides = { assumptions: AssumptionOverrides; events: Record<string, number> }` (event id → overridden age).
  - `computeLiveBand(plan, overrides: LiveOverrides, serverBand, asOfYear): BandedProjection` — returns `serverBand` by reference when **both** maps are empty; otherwise merges assumption overrides onto `plan.assumptions` AND event-age overrides onto `plan.events`, then recomputes with `withEarliest:false` carrying the server earliest value.

- [ ] **Step 1: Update the failing test for the new shape + event override**

In `src/app/plan/liveBand.test.ts`, update the existing calls to the new `LiveOverrides` shape and add an event-override case. Replace the two existing `computeLiveBand(plan, {...}, ...)` calls:

```ts
  it("returns the server band unchanged when there are no overrides", () => {
    expect(
      computeLiveBand(plan, { assumptions: {}, events: {} }, serverBand, 2026),
    ).toBe(serverBand);
  });

  it("recomputes for an assumption override but carries the server earliest value", () => {
    const live = computeLiveBand(
      plan,
      { assumptions: { retirementAge: 68 }, events: {} },
      serverBand,
      2026,
    );
    expect(live).not.toBe(serverBand);
    expect(live.verdict.earliestSustainableRetirementAge).toBe(
      serverBand.verdict.earliestSustainableRetirementAge,
    );
    expect(live.mid).not.toEqual(serverBand.mid);
  });

  it("recomputes when an event age is overridden", () => {
    // plan must have an event for this; add one to the test plan fixture:
    const withEvent: SerializedPlan = {
      ...plan,
      events: [
        { id: "ev1", label: "Car", age: 50, direction: "OUTFLOW", amount: 20000 },
      ],
    };
    const base = computeLiveBand(
      withEvent,
      { assumptions: {}, events: {} },
      serverBand,
      2026,
    );
    const moved = computeLiveBand(
      withEvent,
      { assumptions: {}, events: { ev1: 60 } },
      serverBand,
      2026,
    );
    expect(moved).not.toBe(serverBand);
    expect(moved.mid).not.toEqual(base.mid);
  });
```

(`base` here recomputes too — both-empty returns serverBand, but for the comparison we want the event-moved band vs the un-moved band; since `withEvent` differs from `serverBand`'s plan, compare `moved.mid` against a freshly-computed un-moved band. If the fixture's `serverBand` already reflects the event at 50, you may instead assert `moved.mid !== serverBand.mid` — keep whichever the fixture supports; the point is the override changes the series.)

- [ ] **Step 2: Run to verify it fails**

Run: `make test name="computeLiveBand"`
Expected: FAIL — the `{assumptions, events}` shape isn't accepted; event override unsupported.

- [ ] **Step 3: Implement the new shape + event merge**

Replace `src/app/plan/liveBand.ts`'s type + function:

```ts
export type AssumptionOverrides = Partial<
  Pick<
    SerializedPlanAssumptions,
    "retirementAge" | "defaultReturnPct" | "returnSpreadPct" | "inflationPct"
  >
>;

export type LiveOverrides = {
  assumptions: AssumptionOverrides;
  events: Record<string, number>; // event id → overridden age
};

export function computeLiveBand(
  plan: SerializedPlan,
  overrides: LiveOverrides,
  serverBand: BandedProjection,
  asOfYear: number,
): BandedProjection {
  const noAssumptions = Object.keys(overrides.assumptions).length === 0;
  const noEvents = Object.keys(overrides.events).length === 0;
  if (noAssumptions && noEvents) return serverBand;

  const input = serializedToPlanInput(
    {
      ...plan,
      assumptions: { ...plan.assumptions, ...overrides.assumptions },
      events: plan.events.map((e) =>
        e.id in overrides.events ? { ...e, age: overrides.events[e.id] ?? e.age } : e,
      ),
    },
    asOfYear,
  );
  const band = toTodaysMoneyBand(
    projectWithBand(input, { withEarliest: false }),
    input.inflationPct,
    input.currentAge,
  );
  return {
    ...band,
    verdict: {
      ...band.verdict,
      earliestSustainableRetirementAge:
        serverBand.verdict.earliestSustainableRetirementAge,
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `make test name="computeLiveBand"` then `pnpm typecheck`
Expected: PASS (note: `usePlanProjection.ts` will now have type errors against the new shape — that's Task 4; if you run a full `pnpm typecheck` it will flag `usePlanProjection.ts`. That is expected and fixed in Task 4. Confirm the only errors are in `usePlanProjection.ts`.)

- [ ] **Step 5: Commit**

```bash
git add src/app/plan/liveBand.ts src/app/plan/liveBand.test.ts
git commit -m "feat(plan): LiveOverrides shape + event-age merge in computeLiveBand

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `usePlanProjection` — event override API

**Files:**
- Modify: `src/app/plan/usePlanProjection.ts`

**Interfaces:**
- Consumes: `LiveOverrides`, `computeLiveBand` (Task 3); `updatePlanEvent` (`./actions`); `SerializedPlanEvent`.
- Produces: the hook returns `{ liveBand, effectiveAssumptions, liveEvents, setOverride, commit, setEventOverride, commitEvent }`, where `liveEvents: SerializedPlanEvent[]` is `plan.events` with event-age overrides applied; `setEventOverride(id, age)` previews live; `commitEvent(id, age)` persists via `updatePlanEvent` + refresh.

- [ ] **Step 1: Rework the override state to `LiveOverrides` + add the event API**

Rewrite `src/app/plan/usePlanProjection.ts`:

```ts
// src/app/plan/usePlanProjection.ts
"use client";

import type { BandedProjection } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { updatePlanAssumptions, updatePlanEvent } from "./actions";
import {
  type AssumptionOverrides,
  type LiveOverrides,
  computeLiveBand,
} from "./liveBand";
import type {
  SerializedPlan,
  SerializedPlanAssumptions,
  SerializedPlanEvent,
} from "./serialized";

type SliderKey = keyof AssumptionOverrides;
const EMPTY: LiveOverrides = { assumptions: {}, events: {} };

export function usePlanProjection(
  plan: SerializedPlan,
  serverBand: BandedProjection,
  asOfYear: number,
) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<LiveOverrides>(EMPTY);
  const [liveBand, setLiveBand] = useState<BandedProjection>(serverBand);
  const frame = useRef<number | null>(null);

  // Fresh server props reset the live state; the override persists through the
  // commit→refresh window (keyed on serverBand identity → no flash-back).
  useEffect(() => {
    setOverrides(EMPTY);
    setLiveBand(serverBand);
  }, [serverBand]);

  const scheduleRecompute = useCallback(
    (next: LiveOverrides) => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        setLiveBand(computeLiveBand(plan, next, serverBand, asOfYear));
      });
    },
    [plan, serverBand, asOfYear],
  );

  const setOverride = useCallback(
    (key: SliderKey, value: number) => {
      setOverrides((prev) => {
        const next: LiveOverrides = {
          ...prev,
          assumptions: { ...prev.assumptions, [key]: value },
        };
        scheduleRecompute(next);
        return next;
      });
    },
    [scheduleRecompute],
  );

  const setEventOverride = useCallback(
    (id: string, age: number) => {
      setOverrides((prev) => {
        const next: LiveOverrides = {
          ...prev,
          events: { ...prev.events, [id]: age },
        };
        scheduleRecompute(next);
        return next;
      });
    },
    [scheduleRecompute],
  );

  const commit = useCallback(
    async (key: SliderKey, value: number) => {
      const a = plan.assumptions;
      await updatePlanAssumptions({
        planId: a.id,
        dateOfBirth: a.dateOfBirth,
        retirementAge: a.retirementAge,
        planToAge: a.planToAge,
        inflationPct: a.inflationPct,
        defaultReturnPct: a.defaultReturnPct,
        returnSpreadPct: a.returnSpreadPct,
        blendedTaxRatePct: a.blendedTaxRatePct,
        statePensionAge: a.statePensionAge,
        statePensionAnnual: a.statePensionAnnual,
        [key]: value,
      });
      router.refresh();
    },
    [plan, router],
  );

  const commitEvent = useCallback(
    async (id: string, age: number) => {
      const ev = plan.events.find((e) => e.id === id);
      if (!ev) return;
      await updatePlanEvent({
        eventId: ev.id,
        label: ev.label,
        age,
        direction: ev.direction,
        amount: ev.amount,
      });
      router.refresh();
    },
    [plan, router],
  );

  const effectiveAssumptions: SerializedPlanAssumptions = {
    ...plan.assumptions,
    ...overrides.assumptions,
  };
  const liveEvents: SerializedPlanEvent[] = plan.events.map((e) =>
    e.id in overrides.events ? { ...e, age: overrides.events[e.id] ?? e.age } : e,
  );

  return {
    liveBand,
    effectiveAssumptions,
    liveEvents,
    setOverride,
    commit,
    setEventOverride,
    commitEvent,
  };
}
```

- [ ] **Step 2: Typecheck + format + full suite**

Run: `pnpm typecheck && pnpm check && pnpm test`
Expected: PASS (the Task 3 type errors in this file are now resolved; the hook isn't consumed differently by PlanView yet — that's Task 5 — but `Sliders` still gets `setOverride`/`commit`, unchanged. Confirm green.)

- [ ] **Step 3: Commit**

```bash
git add src/app/plan/usePlanProjection.ts
git commit -m "feat(plan): usePlanProjection event-override API (setEventOverride/commitEvent/liveEvents)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Draggable + keyboard event markers (Timeline) + PlanView wiring

> Timeline and PlanView change together (Timeline gains props PlanView must supply); typecheck is green at the task boundary.

**Files:**
- Modify: `src/app/plan/Timeline.tsx`
- Modify: `src/app/plan/PlanView.tsx`

**Interfaces:**
- Consumes: `ageFromOffset` (Task 1); the hook's `liveEvents`, `setEventOverride`, `commitEvent` (Task 4).
- Produces: `Timeline` gains optional props `onEventInput?(id, age)` + `onEventCommit?(id, age)`; markers become `role="slider"` drag handles.

- [ ] **Step 1: Make the event markers interactive in `Timeline.tsx`**

Add the import:
```tsx
import { ageFromOffset, type TimelineBar, toTimelineModel } from "@/lib/plan/timelineData";
import { useRef } from "react";
```

Add the two optional props to the component signature (after `maxAge: number;`):
```tsx
  onEventInput,
  onEventCommit,
}: {
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  liabilities: SerializedPlanLiability[];
  events: SerializedPlanEvent[];
  retirementAge: number;
  statePensionAge: number | null;
  minAge: number;
  maxAge: number;
  onEventInput?: (id: string, age: number) => void;
  onEventCommit?: (id: string, age: number) => void;
}) {
```

Add a ref for the events track, just after `const theme = useTheme();`:
```tsx
  const eventTrackRef = useRef<HTMLDivElement>(null);
```

Make the `Marker` a focusable slider with pointer + keyboard handlers. Replace the events `<Track>` block (the `{model.events.length > 0 ? (...) : null}` section's `<Track>` and its markers) with:

```tsx
            {model.events.length > 0 ? (
              <div style={{ display: "contents" }}>
                <GroupLabel>Events</GroupLabel>
                <RowLabel />
                <Track ref={eventTrackRef}>
                  {model.events.map((m) => {
                    const ageAt = (clientX: number): number => {
                      const r = eventTrackRef.current?.getBoundingClientRect();
                      if (!r) return m.age;
                      return ageFromOffset(clientX, r.left, r.width, minAge, maxAge);
                    };
                    return (
                      <Marker
                        key={m.id}
                        $inflow={m.direction === "INFLOW"}
                        style={{ left: `${m.leftPct}%` }}
                        role="slider"
                        tabIndex={0}
                        aria-label={`${m.label} age`}
                        aria-valuemin={minAge}
                        aria-valuemax={maxAge}
                        aria-valuenow={m.age}
                        title={`${m.label} (age ${m.age})`}
                        onPointerDown={(e) => {
                          if (!onEventInput) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (!onEventInput || !e.currentTarget.hasPointerCapture(e.pointerId))
                            return;
                          onEventInput(m.id, ageAt(e.clientX));
                        }}
                        onPointerUp={(e) => {
                          if (!onEventCommit || !e.currentTarget.hasPointerCapture(e.pointerId))
                            return;
                          e.currentTarget.releasePointerCapture(e.pointerId);
                          onEventCommit(m.id, ageAt(e.clientX));
                        }}
                        onKeyDown={(e) => {
                          if (!onEventInput) return;
                          const delta =
                            e.key === "ArrowRight" || e.key === "ArrowUp"
                              ? 1
                              : e.key === "ArrowLeft" || e.key === "ArrowDown"
                                ? -1
                                : 0;
                          if (delta === 0) return;
                          e.preventDefault();
                          const next = Math.min(Math.max(m.age + delta, minAge), maxAge);
                          onEventInput(m.id, next);
                        }}
                        onKeyUp={(e) => {
                          if (!onEventCommit) return;
                          if (
                            ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(
                              e.key,
                            )
                          )
                            onEventCommit(m.id, m.age);
                        }}
                      />
                    );
                  })}
                </Track>
              </div>
            ) : null}
```

Add `cursor: ew-resize;` and a focus outline to the `Marker` styled component so it reads as draggable/focusable:
```tsx
const Marker = styled.div<{ $inflow: boolean }>`
  position: absolute;
  top: 3px;
  width: 12px;
  height: 12px;
  transform: translateX(-50%) rotate(45deg);
  cursor: ew-resize;
  touch-action: none;
  background: ${({ $inflow, theme }) =>
    $inflow ? theme.colors.positive : theme.colors.negative};
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;
```

(`SerializedPlanEvent` is already imported in this file. `touch-action: none` lets pointer-drag work on touch without the page scrolling.)

- [ ] **Step 2: Wire the hook's event API into `Timeline` from `PlanView`**

In `src/app/plan/PlanView.tsx`, the hook destructure becomes:
```tsx
  const {
    liveBand,
    effectiveAssumptions,
    liveEvents,
    setOverride,
    commit,
    setEventOverride,
    commitEvent,
  } = usePlanProjection(plan, band, asOfYear);
```

Change the `<Timeline>` usage to pass live events + the drag callbacks:
```tsx
      <Timeline
        incomes={plan.incomes}
        expenses={plan.expenses}
        liabilities={plan.liabilities}
        events={liveEvents}
        retirementAge={effectiveAssumptions.retirementAge}
        statePensionAge={effectiveAssumptions.statePensionAge}
        minAge={liveBand.mid[0]?.age ?? 0}
        maxAge={liveBand.mid[liveBand.mid.length - 1]?.age ?? 0}
        onEventInput={setEventOverride}
        onEventCommit={commitEvent}
      />
```

- [ ] **Step 3: Full pre-flight**

Run: `pnpm typecheck && pnpm check && pnpm test`
Expected: all PASS (no new unit tests — interaction is e2e/live; `pnpm format` first if `pnpm check` flags anything).

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/Timeline.tsx src/app/plan/PlanView.tsx
git commit -m "feat(plan): draggable + keyboard event markers on the timeline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: E2E + live verification

**Files:**
- Modify: `e2e/plan.spec.ts`

- [ ] **Step 1: Add an e2e test driving an event marker by keyboard**

In `e2e/plan.spec.ts`, mirror the existing plan-setup pattern. A freshly-created plan now has one example event ("New car"), so the timeline renders an event marker (`role="slider"`, `aria-label="New car age"`). Focus it and press ArrowRight to nudge the age, then assert persistence after reload. Keyboard (not synthetic pointer drag) keeps it deterministic:

```ts
test("dragging an event marker (keyboard) persists its age", async ({ page }) => {
  // (reuse the file's existing sign-in + plan-ready setup; the seeded plan has a "New car" event)
  const marker = page.getByRole("slider", { name: /new car age/i });
  await expect(marker).toBeVisible();
  const before = Number(await marker.getAttribute("aria-valuenow"));
  await marker.focus();
  await page.keyboard.press("ArrowRight");
  await expect(marker).toHaveAttribute("aria-valuenow", String(before + 1));
  await page.reload();
  await expect(
    page.getByRole("slider", { name: /new car age/i }),
  ).toHaveAttribute("aria-valuenow", String(before + 1));
});
```

Adjust the setup lines to match the nearest existing test (sign-in, navigation, plan-ready wait). Run `pnpm check` on the spec before committing.

- [ ] **Step 2: Run the e2e test**

Run: `make test-e2e name="plan"`
Expected: PASS. (Mock-auth + Next dev on `:3100` against `halcyon_test`; no new migration. Fallbacks if needed: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome`; if Turbopack hits the host inotify watch limit it's environmental — CI unaffected — report rather than weaken the test.)

- [ ] **Step 3: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): drive an event marker by keyboard on /plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Live pass (controller)**

NOTE: the existing local demo plan has no event; before the live pass either create a fresh plan or add an event via "+ Add event". (The container's Prisma client must be current — `docker compose exec app npx prisma generate` + restart if `/plan` 500s on a stale client.) On `/plan`:
1. Drag the "New car" event marker left/right — confirm the marker follows the cursor smoothly and the net-worth curve's dip moves in real time (validates the live recompute + rAF).
2. Release — confirm the new age persists across a reload (and the marker's tooltip/aria reflects it).
3. Tab to the marker, press Arrow keys — confirm it nudges ±1 year and commits.
4. Confirm the income/expense/liability bars are NOT draggable (still read-only — 3c-2).

Document the result for the PR.

---

## Self-Review

**Spec coverage:**
- §1 per-entity overrides (`LiveOverrides`, event merge, idle-by-both-empty) → Task 3. ✓
- §2 hook event API (`setEventOverride`/`commitEvent`/`liveEvents`) → Task 4. ✓
- §3 timeline drag + keyboard markers (pointer capture, `ageFromOffset`, `role="slider"`, arrows) → Task 1 (pure inverse) + Task 5. ✓
- §3 persistence (commit-on-release via `updatePlanEvent` + refresh; overrides clear on fresh serverBand) → Task 4 (`commitEvent`) + the existing reset effect. ✓
- §4 demo example event (`createPlan`) → Task 2. ✓
- §Performance (reuse `withEarliest:false` + rAF; idle by reference) → Task 3 (computeLiveBand) + Task 4 (hook rAF). ✓
- §Testing (ageFromOffset, computeLiveBand event override, createPlan int, e2e keyboard, live) → Tasks 1,2,3,6. ✓
- Backward compat (override-shape change internal; createPlan event only for new plans) → Tasks 3-4 internal; Task 2. ✓

**Placeholder scan:** No TBD/TODO; every code step shows code. Task 2 Step 2 and Task 6 Step 1 say "mirror the existing test/setup" because the exact int-test/e2e harness lines depend on current file contents — each points at a concrete neighbouring pattern with the new assertions given in full. Task 3 Step 1's comment about the event-comparison fixture flags a fixture-dependent choice and gives the fallback assertion explicitly.

**Type consistency:** `LiveOverrides = { assumptions, events }` (Task 3) is the override state in the hook (Task 4) and the param to `computeLiveBand` (Task 3, consumed Task 4). `ageFromOffset(clientX, trackLeft, trackWidth, minAge, maxAge)` (Task 1) is called in Timeline (Task 5) with the track rect. The hook returns `{ liveBand, effectiveAssumptions, liveEvents, setOverride, commit, setEventOverride, commitEvent }` (Task 4), consumed verbatim in PlanView (Task 5); `Sliders` still gets `setOverride`/`commit` unchanged. `Timeline`'s new `onEventInput`/`onEventCommit` (Task 5) are fed `setEventOverride`/`commitEvent`. Markers expose `role="slider"` + `aria-label`={label} age + `aria-valuenow`={age}, matching the e2e locator (Task 6). Consistent.
