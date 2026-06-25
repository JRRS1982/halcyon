# Plan Real-time Sliders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/plan` forecast's key assumptions draggable sliders that recompute the chart, verdict, and timeline in real time client-side, persisting on release.

**Architecture:** The pure engine runs in the browser. `page.tsx` still computes the band server-side for first paint; `PlanView` recomputes locally from the `SerializedPlan` + a live "overrides" layer only while a slider is active. A new pure `serializedToPlanInput` maps `SerializedPlan` → `PlanInput`. Live recompute skips the O(years²) earliest-retirement sweep (the server computes it on release). Commit-on-release reuses the existing `updatePlanAssumptions` action + `router.refresh()`.

**Tech Stack:** Next.js 16 / React 19, TypeScript, styled-components, Recharts 3, Jest + RTL (unit, jsdom), Playwright (e2e), Biome. Local React state (no Redux).

## Global Constraints

- **Performance is a first-class requirement:**
  - Live recompute MUST call `projectWithBand(input, { withEarliest: false })` — never run `earliestSustainableRetirementAge` (O(years²)) on a drag frame. The server computes it on release via `router.refresh()`; the live verdict carries the server's last earliest-retirement value.
  - Recompute is throttled to one per animation frame (`requestAnimationFrame`, cancelling the prior frame).
  - With no overrides, the hook returns the server band unchanged (zero client compute on load / first paint).
- **Commit on release:** `onChange` previews (live); `onPointerUp`/`onKeyUp` persists via `updatePlanAssumptions` + `router.refresh()`. Overrides clear only when fresh server props arrive (no flash-back).
- **No Redux** — page-scoped ephemeral state via local React state / a hook.
- **`pnpm verify` (`typecheck && biome ci && test`) is the finish gate.** `biome ci` is stricter — run `pnpm format` if needed. **Implementers run `pnpm check`, not just `pnpm typecheck`.**
- **Biome bans the non-null assertion `!`** — use guards / `?.` / `??`.
- **Charts/hooks aren't unit-tested** (Recharts + rAF don't run under jsdom — established convention); pure logic IS unit-tested; the interaction is covered by e2e + a live pass.
- **Editing→chart convention:** a mutating server action is followed by `router.refresh()`.
- **Co-Authored-By trailer** on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `serializedToPlanInput` (client-side plan mapping)

**Files:**
- Create: `src/lib/plan/serializedInput.ts`
- Modify: `src/lib/plan/toPlanInput.ts` (export the existing private `growthOf` for reuse)
- Test: `src/lib/plan/serializedInput.test.ts`

**Interfaces:**
- Consumes: `SerializedPlan` (`@/app/plan/serialized`), `PlanInput`/`Growth` (`@/lib/plan`), `growthOf` (toPlanInput).
- Produces: `serializedToPlanInput(plan: SerializedPlan, asOfYear: number): PlanInput`.

- [ ] **Step 1: Export `growthOf` from `toPlanInput.ts`**

In `src/lib/plan/toPlanInput.ts`, change `const growthOf = (` to `export const growthOf = (`. (No other change; it already maps `(growthKind, pct?) => Growth`.)

- [ ] **Step 2: Write the failing test**

Create `src/lib/plan/serializedInput.test.ts`:

```ts
import { serializedToPlanInput } from "./serializedInput";
import type { SerializedPlan } from "@/app/plan/serialized";

const plan: SerializedPlan = {
  assumptions: {
    id: "11111111-1111-4111-8111-111111111111",
    dateOfBirth: "1982-09-07",
    retirementAge: 60,
    planToAge: 95,
    inflationPct: 2.5,
    defaultReturnPct: 5,
    returnSpreadPct: 2,
    blendedTaxRatePct: 20,
    statePensionAge: 67,
    statePensionAnnual: 11500,
  },
  assets: [
    {
      id: "a1",
      label: "SIPP",
      wrapper: "PENSION",
      openingValue: 100000,
      expectedReturnPct: null,
      feePct: 0.5,
      annualContribution: 6000,
      contributionEndAge: null,
      minAccessAge: 57,
      drawdownPriority: 2,
    },
  ],
  liabilities: [
    {
      id: "l1",
      label: "Mortgage",
      openingBalance: 120000,
      interestPct: 4,
      monthlyRepayment: 1100,
      endAge: 60,
    },
  ],
  incomes: [
    {
      id: "i1",
      label: "Salary",
      kind: "SALARY",
      annualAmount: 36000,
      startAge: null,
      endAge: 60,
      growthKind: "INFLATION",
      growthPct: null,
      taxable: true,
    },
  ],
  expenses: [
    {
      id: "e1",
      label: "Rent",
      category: "FIXED",
      annualAmount: 14400,
      startAge: null,
      endAge: null,
      inflationLinked: true,
    },
  ],
  events: [
    { id: "ev1", label: "Car", age: 50, direction: "OUTFLOW", amount: 20000 },
  ],
};

describe("serializedToPlanInput", () => {
  it("maps assumptions, derives currentAge/startYear, and carries new fields", () => {
    const input = serializedToPlanInput(plan, 2026);
    expect(input.currentAge).toBe(2026 - 1982);
    expect(input.startYear).toBe(2026);
    expect(input.retirementAge).toBe(60);
    expect(input.taxRatePct).toBe(20); // blendedTaxRatePct → taxRatePct
    expect(input.returnSpreadPct).toBe(2);
    expect(input.statePension).toEqual({ startAge: 67, annualAmount: 11500 });
    expect(input.assets[0]).toMatchObject({
      expectedReturnPct: undefined, // null → undefined (engine default)
      feePct: 0.5,
      contributionEndAge: undefined,
      minAccessAge: 57,
    });
    expect(input.incomes[0]?.growth).toEqual({ kind: "INFLATION" });
    expect(input.events[0]).toMatchObject({ age: 50, direction: "OUTFLOW", amount: 20000 });
  });

  it("omits statePension when either field is null", () => {
    const input = serializedToPlanInput(
      { ...plan, assumptions: { ...plan.assumptions, statePensionAge: null } },
      2026,
    );
    expect(input.statePension).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `make test name="serializedToPlanInput"`
Expected: FAIL — module not found / not exported.

- [ ] **Step 4: Implement `serializedToPlanInput`**

Create `src/lib/plan/serializedInput.ts`:

```ts
// src/lib/plan/serializedInput.ts
// Client-side counterpart of toPlanInput: maps the serialized (plain-number)
// plan the client holds into the engine's PlanInput, so the pure engine can
// re-run in the browser for the real-time sliders. Parity with toPlanInput is
// covered by serializedInput.test.ts. (linkedAssetId is intentionally omitted:
// it is not present on SerializedPlanLiability and is unused by the engine.)
import type { PlanInput } from "@/lib/plan";
import type { SerializedPlan } from "@/app/plan/serialized";
import { growthOf } from "./toPlanInput";

export function serializedToPlanInput(
  plan: SerializedPlan,
  asOfYear: number,
): PlanInput {
  const a = plan.assumptions;
  const birthYear = Number(a.dateOfBirth.slice(0, 4));
  const statePension =
    a.statePensionAge !== null && a.statePensionAnnual !== null
      ? { startAge: a.statePensionAge, annualAmount: a.statePensionAnnual }
      : undefined;

  return {
    currentAge: asOfYear - birthYear,
    startYear: asOfYear,
    retirementAge: a.retirementAge,
    planToAge: a.planToAge,
    inflationPct: a.inflationPct,
    defaultReturnPct: a.defaultReturnPct,
    returnSpreadPct: a.returnSpreadPct,
    taxRatePct: a.blendedTaxRatePct,
    statePension,
    assets: plan.assets.map((x) => ({
      id: x.id,
      label: x.label,
      wrapper: x.wrapper,
      openingValue: x.openingValue,
      expectedReturnPct: x.expectedReturnPct ?? undefined,
      feePct: x.feePct,
      annualContribution: x.annualContribution,
      contributionEndAge: x.contributionEndAge ?? undefined,
      minAccessAge: x.minAccessAge ?? undefined,
      drawdownPriority: x.drawdownPriority,
    })),
    liabilities: plan.liabilities.map((x) => ({
      id: x.id,
      label: x.label,
      openingBalance: x.openingBalance,
      interestPct: x.interestPct,
      monthlyRepayment: x.monthlyRepayment,
      endAge: x.endAge ?? undefined,
    })),
    incomes: plan.incomes.map((x) => ({
      id: x.id,
      label: x.label,
      kind: x.kind,
      annualAmount: x.annualAmount,
      startAge: x.startAge ?? undefined,
      endAge: x.endAge ?? undefined,
      growth: growthOf(x.growthKind, x.growthPct ?? undefined),
      taxable: x.taxable,
    })),
    expenses: plan.expenses.map((x) => ({
      id: x.id,
      label: x.label,
      category: x.category ?? undefined,
      annualAmount: x.annualAmount,
      startAge: x.startAge ?? undefined,
      endAge: x.endAge ?? undefined,
      inflationLinked: x.inflationLinked,
    })),
    events: plan.events.map((x) => ({
      id: x.id,
      label: x.label,
      age: x.age,
      direction: x.direction,
      amount: x.amount,
    })),
  };
}
```

- [ ] **Step 5: Run to verify it passes + typecheck + format**

Run: `make test name="serializedToPlanInput"` then `pnpm typecheck && pnpm check`
Expected: PASS; clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/serializedInput.ts src/lib/plan/serializedInput.test.ts src/lib/plan/toPlanInput.ts
git commit -m "feat(plan): serializedToPlanInput — client-side plan→engine mapping

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `projectWithBand` `withEarliest` option (perf)

**Files:**
- Modify: `src/lib/plan/project.ts`
- Test: `src/lib/plan/project.test.ts`

**Interfaces:**
- Produces: `projectWithBand(input, opts?: { withEarliest?: boolean })` — `withEarliest` defaults `true` (unchanged behavior); `false` skips the earliest-retirement sweep on all passes (`earliestSustainableRetirementAge: null`).

- [ ] **Step 1: Write the failing test**

In `src/lib/plan/project.test.ts`, inside `describe("projectWithBand")`, add:

```ts
  it("skips the earliest-retirement sweep when withEarliest is false", () => {
    const input = banded();
    const fast = projectWithBand(input, { withEarliest: false });
    expect(fast.mid.verdict.earliestSustainableRetirementAge).toBeNull();
    // year series + peak/shortfall identical to the full compute
    const full = projectWithBand(input);
    expect(fast.mid.years).toEqual(full.mid.years);
    expect(fast.low.years).toEqual(full.low.years);
    expect(fast.high.years).toEqual(full.high.years);
    expect(fast.mid.verdict.feasible).toBe(full.mid.verdict.feasible);
  });
```

(The `banded()` helper already exists in this describe block from D2.)

- [ ] **Step 2: Run to verify it fails**

Run: `make test name="withEarliest"`
Expected: FAIL — `projectWithBand` ignores the second arg; mid earliest is a number, not null.

- [ ] **Step 3: Add the option**

In `src/lib/plan/project.ts`, change `projectWithBand`:

```ts
export const projectWithBand = (
  input: PlanInput,
  opts: { withEarliest?: boolean } = {},
): { low: PlanProjection; mid: PlanProjection; high: PlanProjection } => {
  const spread = input.returnSpreadPct ?? 0;
  const withEarliest = opts.withEarliest ?? true;
  const pass = (delta: number, computeEarliest: boolean): PlanProjection => {
    const years = projectYears(input, delta);
    return {
      years,
      verdict: {
        ...summarise(years),
        earliestSustainableRetirementAge: computeEarliest
          ? earliestSustainableRetirementAge(input)
          : null,
      },
    };
  };
  return {
    low: pass(-spread, false),
    mid: pass(0, withEarliest),
    high: pass(spread, false),
  };
};
```

(Only the mid pass ever computed earliest; now it's gated on `withEarliest`. Default `true` keeps `page.tsx` and all existing callers/tests unchanged.)

- [ ] **Step 4: Run to verify it passes + the full suite**

Run: `make test name="projectWithBand"` then `pnpm typecheck && pnpm check && pnpm test`
Expected: PASS (existing band tests still green; new test green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/project.ts src/lib/plan/project.test.ts
git commit -m "perf(plan): projectWithBand withEarliest opt to skip O(years^2) sweep

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Live recompute — `computeLiveBand` + `usePlanProjection`

**Files:**
- Create: `src/app/plan/liveBand.ts` (pure)
- Create: `src/app/plan/liveBand.test.ts`
- Create: `src/app/plan/usePlanProjection.ts` (React hook)

**Interfaces:**
- Consumes: `serializedToPlanInput` (Task 1), `projectWithBand` (Task 2), `toTodaysMoneyBand` (`@/lib/plan/toPlanInput`), `BandedProjection` (`@/lib/plan`), `SerializedPlan`/`SerializedPlanAssumptions` (`./serialized`), `updatePlanAssumptions` (`./actions`).
- Produces:
  - `type AssumptionOverrides = Partial<Pick<SerializedPlanAssumptions, "retirementAge" | "defaultReturnPct" | "returnSpreadPct" | "inflationPct">>`
  - `computeLiveBand(plan, overrides, serverBand, asOfYear): BandedProjection` — pure; returns `serverBand` unchanged when `overrides` is empty; otherwise recomputes with `withEarliest:false` and carries `serverBand`'s `earliestSustainableRetirementAge`.
  - `usePlanProjection(plan, serverBand, asOfYear)` → `{ liveBand: BandedProjection; effectiveAssumptions: SerializedPlanAssumptions; setOverride; commit }`.

- [ ] **Step 1: Write the failing test for the pure `computeLiveBand`**

Create `src/app/plan/liveBand.test.ts`:

```ts
import { computeLiveBand } from "./liveBand";
import { serializedToPlanInput } from "@/lib/plan/serializedInput";
import { projectWithBand } from "@/lib/plan";
import { toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
import type { SerializedPlan } from "./serialized";

// minimal serialized plan (reuse the shape from serializedInput.test.ts)
const plan: SerializedPlan = {
  assumptions: {
    id: "11111111-1111-4111-8111-111111111111",
    dateOfBirth: "1982-09-07",
    retirementAge: 60,
    planToAge: 95,
    inflationPct: 2.5,
    defaultReturnPct: 5,
    returnSpreadPct: 2,
    blendedTaxRatePct: 20,
    statePensionAge: 67,
    statePensionAnnual: 11500,
  },
  assets: [
    { id: "a1", label: "SIPP", wrapper: "PENSION", openingValue: 100000, expectedReturnPct: null, feePct: 0, annualContribution: 6000, contributionEndAge: null, minAccessAge: 57, drawdownPriority: 2 },
  ],
  liabilities: [],
  incomes: [
    { id: "i1", label: "Salary", kind: "SALARY", annualAmount: 36000, startAge: null, endAge: 60, growthKind: "INFLATION", growthPct: null, taxable: true },
  ],
  expenses: [
    { id: "e1", label: "Rent", category: "FIXED", annualAmount: 14400, startAge: null, endAge: null, inflationLinked: true },
  ],
  events: [],
};

const serverBand = toTodaysMoneyBand(
  projectWithBand(serializedToPlanInput(plan, 2026)),
  plan.assumptions.inflationPct,
  2026 - 1982,
);

describe("computeLiveBand", () => {
  it("returns the server band unchanged when there are no overrides", () => {
    expect(computeLiveBand(plan, {}, serverBand, 2026)).toBe(serverBand);
  });

  it("recomputes for an override but carries the server earliest-retirement value", () => {
    const live = computeLiveBand(plan, { retirementAge: 68 }, serverBand, 2026);
    expect(live).not.toBe(serverBand);
    // earliest-retirement is NOT recomputed live — carried from the server band
    expect(live.verdict.earliestSustainableRetirementAge).toBe(
      serverBand.verdict.earliestSustainableRetirementAge,
    );
    // retiring later changes the year series
    expect(live.mid).not.toEqual(serverBand.mid);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `make test name="computeLiveBand"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure `computeLiveBand`**

Create `src/app/plan/liveBand.ts`:

```ts
// src/app/plan/liveBand.ts
// Pure client-side recompute for the real-time sliders. Skips the O(years^2)
// earliest-retirement sweep (withEarliest:false) and carries the server band's
// earliest value, so a drag frame costs only the three cheap band passes.
import { type BandedProjection, projectWithBand } from "@/lib/plan";
import { serializedToPlanInput } from "@/lib/plan/serializedInput";
import { toTodaysMoneyBand } from "@/lib/plan/toPlanInput";
import type { SerializedPlan, SerializedPlanAssumptions } from "./serialized";

export type AssumptionOverrides = Partial<
  Pick<
    SerializedPlanAssumptions,
    "retirementAge" | "defaultReturnPct" | "returnSpreadPct" | "inflationPct"
  >
>;

export function computeLiveBand(
  plan: SerializedPlan,
  overrides: AssumptionOverrides,
  serverBand: BandedProjection,
  asOfYear: number,
): BandedProjection {
  if (Object.keys(overrides).length === 0) return serverBand;

  const input = serializedToPlanInput(
    { ...plan, assumptions: { ...plan.assumptions, ...overrides } },
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
Expected: PASS; clean.

- [ ] **Step 5: Implement the `usePlanProjection` hook**

Create `src/app/plan/usePlanProjection.ts`:

```ts
// src/app/plan/usePlanProjection.ts
"use client";

import type { BandedProjection } from "@/lib/plan";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { updatePlanAssumptions } from "./actions";
import { type AssumptionOverrides, computeLiveBand } from "./liveBand";
import type { SerializedPlan, SerializedPlanAssumptions } from "./serialized";

type SliderKey = keyof AssumptionOverrides;

export function usePlanProjection(
  plan: SerializedPlan,
  serverBand: BandedProjection,
  asOfYear: number,
) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<AssumptionOverrides>({});
  const [liveBand, setLiveBand] = useState<BandedProjection>(serverBand);
  const frame = useRef<number | null>(null);

  // Fresh server props (after a commit + refresh, or any external change) reset
  // the live state — overrides clear and the live band falls back to the server
  // band. Depending on serverBand identity means the override persists through
  // the commit→refresh window (no flash-back to the pre-drag value).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on serverBand only
  useEffect(() => {
    setOverrides({});
    setLiveBand(serverBand);
  }, [serverBand]);

  const setOverride = useCallback(
    (key: SliderKey, value: number) => {
      setOverrides((prev) => {
        const next = { ...prev, [key]: value };
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          setLiveBand(computeLiveBand(plan, next, serverBand, asOfYear));
        });
        return next;
      });
    },
    [plan, serverBand, asOfYear],
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

  const effectiveAssumptions: SerializedPlanAssumptions = {
    ...plan.assumptions,
    ...overrides,
  };

  return { liveBand, effectiveAssumptions, setOverride, commit };
}
```

- [ ] **Step 6: Typecheck + format + commit**

Run: `pnpm typecheck && pnpm check && pnpm test`
Expected: PASS (the hook isn't imported yet; `computeLiveBand` tests green).

```bash
git add src/app/plan/liveBand.ts src/app/plan/liveBand.test.ts src/app/plan/usePlanProjection.ts
git commit -m "feat(plan): live-band recompute + usePlanProjection hook (rAF-throttled)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `Sliders` + wire into `PlanView`

**Files:**
- Create: `src/app/plan/Sliders.tsx`
- Modify: `src/app/plan/PlanView.tsx` (use the hook; render `Sliders`; feed children the live band + effective assumptions; accept `asOfYear`)
- Modify: `src/app/plan/page.tsx` (pass `asOfYear` to `PlanView`)

**Interfaces:**
- Consumes: `usePlanProjection`, `AssumptionOverrides` (Task 3), `SerializedPlanAssumptions`.
- Produces: `Sliders` (`{ assumptions, onInput, onCommit }`); `PlanView` gains an `asOfYear: number` prop.

- [ ] **Step 1: Build the `Sliders` component**

Create `src/app/plan/Sliders.tsx`:

```tsx
// src/app/plan/Sliders.tsx
"use client";

import styled from "styled-components";
import { PlanCard } from "./PlanCard";
import type { AssumptionOverrides } from "./liveBand";
import type { SerializedPlanAssumptions } from "./serialized";

type Lever = {
  key: keyof AssumptionOverrides;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

const LEVERS: Lever[] = [
  { key: "retirementAge", label: "Retirement age", min: 40, max: 90, step: 1, suffix: "" },
  { key: "defaultReturnPct", label: "Return", min: -5, max: 15, step: 0.1, suffix: "%" },
  { key: "returnSpreadPct", label: "Return spread ±", min: 0, max: 10, step: 0.1, suffix: "%" },
  { key: "inflationPct", label: "Inflation", min: 0, max: 10, step: 0.1, suffix: "%" },
];

const Row = styled.label`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;
const Head = styled.div`
  display: flex;
  justify-content: space-between;
  grid-column: 1 / -1;
`;
const Value = styled.span`
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.ink};
  font-weight: 500;
`;
const Range = styled.input`
  grid-column: 1 / -1;
  width: 100%;
`;
const Hint = styled.p`
  grid-column: 1 / -1;
  margin: 0 0 ${({ theme }) => theme.spacing.xs};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim};
`;

export function Sliders({
  assumptions,
  onInput,
  onCommit,
}: {
  assumptions: SerializedPlanAssumptions;
  onInput: (key: keyof AssumptionOverrides, value: number) => void;
  onCommit: (key: keyof AssumptionOverrides, value: number) => void;
}) {
  return (
    <PlanCard aria-label="Quick adjustments">
      <Hint>Drag to explore — changes save when you release.</Hint>
      {LEVERS.map((l) => {
        const value = assumptions[l.key];
        return (
          <Row key={l.key}>
            <Head>
              <span>{l.label}</span>
              <Value>
                {value}
                {l.suffix}
              </Value>
            </Head>
            <Range
              type="range"
              min={l.min}
              max={l.max}
              step={l.step}
              value={value}
              aria-label={l.label}
              onChange={(e) => onInput(l.key, Number(e.target.value))}
              onPointerUp={(e) => onCommit(l.key, Number(e.currentTarget.value))}
              onKeyUp={(e) => onCommit(l.key, Number(e.currentTarget.value))}
            />
          </Row>
        );
      })}
    </PlanCard>
  );
}
```

- [ ] **Step 2: Wire the hook + Sliders into `PlanView`**

In `src/app/plan/PlanView.tsx`:

Add imports:
```tsx
import { Sliders } from "./Sliders";
import { usePlanProjection } from "./usePlanProjection";
```

Add `asOfYear` to the prop type and signature:
```tsx
export function PlanView({
  band,
  plan,
  currency,
  numberFormat,
  asOfYear,
}: {
  band: BandedProjection;
  plan: SerializedPlan;
  currency: string;
  numberFormat: NumberFormat;
  asOfYear: number;
}) {
```

Just after the existing `const router = useRouter();`, add:
```tsx
  const { liveBand, effectiveAssumptions, setOverride, commit } =
    usePlanProjection(plan, band, asOfYear);
```

Replace the `VerdictBanner` / `ChartPanel` / `Timeline` usages so they read from `liveBand` + `effectiveAssumptions`, and render `Sliders` directly above `ChartPanel`:
```tsx
      <VerdictBanner
        verdict={liveBand.verdict}
        currency={currency}
        numberFormat={numberFormat}
      />
      <Sliders
        assumptions={effectiveAssumptions}
        onInput={setOverride}
        onCommit={commit}
      />
      <ChartPanel
        low={liveBand.low}
        mid={liveBand.mid}
        high={liveBand.high}
        currency={currency}
        numberFormat={numberFormat}
      />
      <Timeline
        incomes={plan.incomes}
        expenses={plan.expenses}
        liabilities={plan.liabilities}
        events={plan.events}
        retirementAge={effectiveAssumptions.retirementAge}
        statePensionAge={effectiveAssumptions.statePensionAge}
        minAge={liveBand.mid[0]?.age ?? 0}
        maxAge={liveBand.mid[liveBand.mid.length - 1]?.age ?? 0}
      />
```

(Leave `AssumptionsPanel` and the tables reading `plan` as-is — they edit the persisted plan through their own paths.)

- [ ] **Step 3: Pass `asOfYear` from `page.tsx`**

In `src/app/plan/page.tsx`, the `asOfYear` const already exists (`const asOfYear = new Date().getUTCFullYear();`). Add it to the `PlanView` render:
```tsx
    <PlanView
      band={band}
      plan={serialized}
      currency={currency}
      numberFormat={numberFormat}
      asOfYear={asOfYear}
    />
```

- [ ] **Step 4: Full pre-flight**

Run: `pnpm typecheck && pnpm check && pnpm test`
Expected: all PASS (no new unit tests here — the pure logic was tested in Tasks 1-3; this is wiring. `pnpm format` first if `pnpm check` flags anything).

- [ ] **Step 5: Commit**

```bash
git add src/app/plan/Sliders.tsx src/app/plan/PlanView.tsx src/app/plan/page.tsx
git commit -m "feat(plan): real-time assumption sliders wired into PlanView

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: E2E + live verification

**Files:**
- Modify: `e2e/plan.spec.ts`

- [ ] **Step 1: Add an e2e test for the slider**

In `e2e/plan.spec.ts`, add a test that drives the retirement-age range input and asserts persistence on release. Mirror the existing assumption-edit test's setup/locators. Use Playwright's `fill` on the range input (sets the value and fires input+change), then assert the slider's value persists after a reload:

```ts
test("retirement-age slider persists on release", async ({ page }) => {
  // (reuse the file's existing sign-in + plan-ready setup)
  const slider = page.getByRole("slider", { name: /retirement age/i });
  await expect(slider).toBeVisible();
  await slider.fill("64");
  await slider.blur();
  await expect(slider).toHaveValue("64");
  await page.reload();
  await expect(
    page.getByRole("slider", { name: /retirement age/i }),
  ).toHaveValue("64");
});
```

Adjust the harness/setup lines to match the nearest existing test in the file (sign-in, navigation, plan-ready wait). `slider.fill` triggers the change/commit path; if the file's pattern uses an explicit commit (blur/pointer), follow it.

- [ ] **Step 2: Run the e2e test**

Run: `make test-e2e name="plan"`
Expected: PASS. (Mock-auth + Next dev on `:3100` against `halcyon_test`. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome` if the managed browser isn't installed; if Turbopack hits the host inotify watch limit, that's environmental — CI is unaffected — report it rather than weakening the test.) Run `pnpm check` on the spec file before committing.

- [ ] **Step 3: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): drive the retirement-age slider on /plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Live pass (controller)**

With the app on `:3210` signed in as demo, on `/plan`:
1. Drag **Retirement age** left/right — confirm the net-worth cone, the verdict headline + peak, and the timeline's retirement reference line update **smoothly in real time** (no per-frame stutter; this validates the `withEarliest:false` + rAF throttle).
2. Confirm the "Earliest retirement" stat holds steady during the drag and updates on release.
3. Release — confirm the value persists across a reload.
4. Drag **Return** and **Return spread** — confirm the cone widens/shifts live.
5. (Perf spot-check) In DevTools, a drag should not show long-task jank; recompute stays per-frame.

Document the result for the PR. No commit unless a tweak is needed.

---

## Self-Review

**Spec coverage:**
- §1 server-first-paint + client recompute, `serializedToPlanInput` → Task 1 + Task 4 (page.tsx unchanged except the `asOfYear` prop pass, which the spec's §Files implied via PlanView needing asOfYear). ✓
- §2 hook (overrides, liveBand===serverBand when idle, earliest carried, setOverride/commit) → Task 3. ✓
- §3 sliders (retire age/return/spread/inflation, commit on release) → Task 4. ✓
- §4 persistence + reconciliation (commit→refresh, overrides clear on fresh serverBand) → Task 3 (effect on serverBand identity). ✓
- §Performance (withEarliest:false live, rAF throttle, idle returns serverBand, isAnimationActive already false) → Task 2 (opt) + Task 3 (computeLiveBand uses it + rAF). ✓
- §Testing (serializedToPlanInput parity, withEarliest null, computeLiveBand idle/override, e2e+live) → Tasks 1,2,3,5. ✓
- Backward compat (withEarliest default true; first paint identical) → Task 2 default. ✓

**Placeholder scan:** No TBD/TODO; every code step shows code. Task 5 Step 1 says "mirror the existing test's setup/locators" because the sign-in/plan-ready harness lines depend on the current `plan.spec.ts` — it points at a concrete neighbouring pattern, with the actual slider assertion given in full.

**Type consistency:** `serializedToPlanInput(plan, asOfYear): PlanInput` (Task 1) consumed by `computeLiveBand` (Task 3) and the test (Task 3). `projectWithBand(input, { withEarliest })` (Task 2) used by `computeLiveBand` (Task 3). `AssumptionOverrides` + `computeLiveBand` (Task 3) consumed by `usePlanProjection` (Task 3) and `Sliders`/`PlanView` (Task 4). `usePlanProjection(plan, serverBand, asOfYear)` returns `{ liveBand, effectiveAssumptions, setOverride, commit }` — consumed verbatim in PlanView (Task 4). `Sliders` props `{ assumptions, onInput, onCommit }` match PlanView's wiring. `PlanView` gains `asOfYear: number`, passed from page.tsx (Task 4). The range input exposes `role="slider"` with `aria-label` = the lever label, matching the e2e locator (Task 5). Consistent.
