# Life Planning Phase 2c — Life-events Gantt (read-only timeline) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only full-width timeline below the chart on `/plan` — income & expense streams as bars, liabilities as bars, one-off events as markers, with a retirement-age reference line — across the current-age → plan-to-age axis.

**Architecture:** Pure presentation. A unit-tested pure layout model (`src/lib/plan/timelineData.ts`) turns the serialized plan + age range into bars/markers/ticks with `leftPct`/`widthPct`; a dumb `"use client"` component (`src/app/plan/Timeline.tsx`) renders absolutely-positioned `<div>`s in a fixed-gutter CSS grid, with reference lines in an aligned overlay. No engine/schema/action changes.

**Tech Stack:** Next.js 16 App Router / React 19, TypeScript, styled-components, Jest (unit), Playwright (e2e), Biome, pnpm.

## Global Constraints

- **No engine / Prisma schema / migration / server-action changes.** Every datum already exists on the serialized plan + `years`.
- **Biome bans non-null assertions (`!`).** Never write `x!`. Prefer `satisfies` over `as`; the only permitted `as` is the single, commented colour-map widening in `Timeline.tsx` (`INCOME_COLOURS as Record<string, string>`) so a `string` `subKind` can index the exhaustive map with a `?? fallback`.
- **Read-only** — no drag/edit; editing stays in the 2a tables.
- **Reuse the cashflow palette** for bar fills so a Salary bar matches its cashflow segment: income → `INCOME_COLOURS[kind]`, expense → `OUTFLOW_COLOURS[category]`, liability → `DEBT_COLOUR`. Reference lines / event markers use existing theme tokens (`hairlineStrong`, `dim`, `positive`, `negative`) — no new colours.
- **The label-gutter width is a single source of truth** — `const GUTTER = "140px"` used by both the grid column and the reference-line overlay's `left`, so bars and ref-lines stay aligned.
- No unit test for the component (positioned-div layout — repo convention; covered by e2e). The pure model IS unit-tested.
- **Commit trailer** (every commit): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Spec: `docs/superpowers/specs/2026-06-23-life-planning-phase2c-design.md`.

---

### Task 1: Pure timeline layout model

**Files:**
- Create: `src/lib/plan/timelineData.ts`
- Test: `src/lib/plan/timelineData.test.ts`

**Interfaces:**
- Consumes: `SerializedPlanIncome/Expense/Liability/Event` from `@/app/plan/serialized` (plain data types).
- Produces: types `TimelineRange`, `TimelineBar`, `TimelineMarker`, `TimelineTick`, `TimelineRefLine`, `TimelineModel`; function `toTimelineModel(input)` (signature below).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/plan/timelineData.test.ts`:

```ts
import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "@/app/plan/serialized";
import { toTimelineModel } from "./timelineData";

const income = (over: Partial<SerializedPlanIncome>): SerializedPlanIncome => ({
  id: "i1",
  label: "Salary",
  kind: "SALARY",
  annualAmount: 1000,
  startAge: null,
  endAge: null,
  growthKind: "INFLATION",
  growthPct: null,
  taxable: true,
  ...over,
});
const expense = (over: Partial<SerializedPlanExpense>): SerializedPlanExpense => ({
  id: "e1",
  label: "Living",
  category: "FIXED",
  annualAmount: 1000,
  startAge: null,
  endAge: null,
  inflationLinked: true,
  ...over,
});
const liability = (
  over: Partial<SerializedPlanLiability>,
): SerializedPlanLiability => ({
  id: "l1",
  label: "Mortgage",
  openingBalance: 1000,
  interestPct: 3,
  monthlyRepayment: 100,
  endAge: null,
  ...over,
});
const event = (over: Partial<SerializedPlanEvent>): SerializedPlanEvent => ({
  id: "v1",
  label: "House",
  age: 50,
  direction: "OUTFLOW",
  amount: 1000,
  ...over,
});

const base = {
  incomes: [],
  expenses: [],
  liabilities: [],
  events: [],
  minAge: 40,
  maxAge: 90,
  retirementAge: 65,
  statePensionAge: null as number | null,
};

describe("toTimelineModel", () => {
  it("resolves null income start/end to the range edges (full-width bar)", () => {
    const m = toTimelineModel({ ...base, incomes: [income({})] });
    const bar = m.bars.income[0];
    expect(bar?.startAge).toBe(40);
    expect(bar?.endAge).toBe(90);
    expect(bar?.leftPct).toBe(0);
    expect(bar?.widthPct).toBe(100);
    expect(bar?.subKind).toBe("SALARY");
  });

  it("positions a bounded expense by age fraction", () => {
    const m = toTimelineModel({
      ...base,
      expenses: [expense({ startAge: 50, endAge: 60 })],
    });
    const bar = m.bars.expense[0];
    expect(bar?.leftPct).toBeCloseTo(20); // (50-40)/50
    expect(bar?.widthPct).toBeCloseTo(20); // (60-50)/50
  });

  it("spans a liability from minAge to its end age", () => {
    const m = toTimelineModel({
      ...base,
      liabilities: [liability({ endAge: 65 })],
    });
    const bar = m.bars.liability[0];
    expect(bar?.startAge).toBe(40);
    expect(bar?.endAge).toBe(65);
    expect(bar?.leftPct).toBe(0);
    expect(bar?.widthPct).toBeCloseTo(50); // (65-40)/50
    expect(bar?.subKind).toBeNull();
  });

  it("clamps out-of-range and inverted spans to widthPct 0", () => {
    const out = toTimelineModel({
      ...base,
      incomes: [income({ startAge: 100, endAge: 120 })],
    });
    expect(out.bars.income[0]?.widthPct).toBe(0);
    expect(out.bars.income[0]?.leftPct).toBe(100);

    const inverted = toTimelineModel({
      ...base,
      incomes: [income({ startAge: 80, endAge: 60 })],
    });
    expect(inverted.bars.income[0]?.widthPct).toBe(0);
  });

  it("keeps an out-of-range event at the edge (not dropped), with its real age", () => {
    const m = toTimelineModel({ ...base, events: [event({ age: 95 })] });
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.age).toBe(95);
    expect(m.events[0]?.leftPct).toBe(100);
  });

  it("includes retirement in range, excludes state pension when null", () => {
    const m = toTimelineModel({ ...base, retirementAge: 65 });
    expect(m.refLines.map((r) => r.label)).toEqual(["Retirement"]);
    expect(m.refLines[0]?.leftPct).toBeCloseTo(50); // (65-40)/50
  });

  it("includes state pension when set and in range; excludes a retirement past maxAge", () => {
    const m = toTimelineModel({
      ...base,
      retirementAge: 99,
      statePensionAge: 67,
    });
    expect(m.refLines.map((r) => r.label)).toEqual(["State pension"]);
  });

  it("emits 10-year ticks including minAge", () => {
    const m = toTimelineModel({ ...base, minAge: 40, maxAge: 90 });
    expect(m.ticks.map((t) => t.age)).toEqual([40, 50, 60, 70, 80, 90]);
  });

  it("guards a degenerate single-year range (no divide-by-zero)", () => {
    const m = toTimelineModel({
      ...base,
      minAge: 50,
      maxAge: 50,
      incomes: [income({})],
    });
    expect(m.bars.income[0]?.leftPct).toBe(0);
    expect(m.bars.income[0]?.widthPct).toBe(0);
    expect(m.ticks).toEqual([{ age: 50, leftPct: 0 }]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test -- timelineData`
Expected: FAIL — cannot find module `./timelineData`.

- [ ] **Step 3: Implement the model**

Create `src/lib/plan/timelineData.ts`:

```ts
import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "@/app/plan/serialized";

// Pure layout model for the read-only life timeline. All age→position maths
// live here so the Timeline component can stay a dumb renderer. No React, no
// colours (colour is the component's concern).

export type TimelineRange = { minAge: number; maxAge: number };

export type TimelineBar = {
  id: string;
  label: string;
  lane: "income" | "expense" | "liability";
  subKind: string | null; // income kind / expense category; null for liability
  startAge: number; // resolved + clamped to range
  endAge: number; // resolved + clamped to range
  leftPct: number; // 0..100
  widthPct: number; // 0..100, never negative
};

export type TimelineMarker = {
  id: string;
  label: string;
  age: number; // real age (may be outside range; title shows it)
  direction: "INFLOW" | "OUTFLOW";
  leftPct: number; // 0..100 (clamped position)
};

export type TimelineTick = { age: number; leftPct: number };
export type TimelineRefLine = { label: string; age: number; leftPct: number };

export type TimelineModel = {
  range: TimelineRange;
  bars: {
    income: TimelineBar[];
    expense: TimelineBar[];
    liability: TimelineBar[];
  };
  events: TimelineMarker[];
  refLines: TimelineRefLine[];
  ticks: TimelineTick[];
};

export function toTimelineModel(input: {
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  liabilities: SerializedPlanLiability[];
  events: SerializedPlanEvent[];
  minAge: number;
  maxAge: number;
  retirementAge: number;
  statePensionAge: number | null;
}): TimelineModel {
  const { minAge, maxAge } = input;
  const span = maxAge - minAge;

  const clamp = (age: number) => Math.min(Math.max(age, minAge), maxAge);
  const pct = (age: number) =>
    span <= 0 ? 0 : ((clamp(age) - minAge) / span) * 100;

  const makeBar = (
    id: string,
    label: string,
    lane: TimelineBar["lane"],
    subKind: string | null,
    rawStart: number,
    rawEnd: number,
  ): TimelineBar => ({
    id,
    label,
    lane,
    subKind,
    startAge: clamp(rawStart),
    endAge: clamp(rawEnd),
    leftPct: pct(rawStart),
    widthPct: Math.max(0, pct(rawEnd) - pct(rawStart)),
  });

  const income = input.incomes.map((i) =>
    makeBar(i.id, i.label, "income", i.kind, i.startAge ?? minAge, i.endAge ?? maxAge),
  );
  const expense = input.expenses.map((e) =>
    makeBar(
      e.id,
      e.label,
      "expense",
      e.category,
      e.startAge ?? minAge,
      e.endAge ?? maxAge,
    ),
  );
  const liability = input.liabilities.map((l) =>
    makeBar(l.id, l.label, "liability", null, minAge, l.endAge ?? maxAge),
  );

  const events = input.events.map((ev) => ({
    id: ev.id,
    label: ev.label,
    age: ev.age,
    direction: ev.direction,
    leftPct: pct(ev.age),
  }));

  const refLines: TimelineRefLine[] = [];
  const addRef = (label: string, age: number | null) => {
    if (age !== null && age >= minAge && age <= maxAge)
      refLines.push({ label, age, leftPct: pct(age) });
  };
  addRef("Retirement", input.retirementAge);
  addRef("State pension", input.statePensionAge);

  const ticks: TimelineTick[] = [{ age: minAge, leftPct: 0 }];
  if (span > 0) {
    for (let age = Math.ceil(minAge / 10) * 10; age <= maxAge; age += 10) {
      if (age !== minAge) ticks.push({ age, leftPct: pct(age) });
    }
  }

  return {
    range: { minAge, maxAge },
    bars: { income, expense, liability },
    events,
    refLines,
    ticks,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test -- timelineData`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/timelineData.ts src/lib/plan/timelineData.test.ts
git commit -m "feat(plan): pure layout model for the life-events timeline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Timeline component + PlanView wiring

**Files:**
- Create: `src/app/plan/Timeline.tsx`
- Modify: `src/app/plan/PlanView.tsx`

**Interfaces:**
- Consumes: `toTimelineModel`, `TimelineBar` (Task 1); `INCOME_COLOURS`, `OUTFLOW_COLOURS`, `DEBT_COLOUR` (`./colours`); `SerializedPlan*` (`./serialized`).
- Produces: `Timeline({ incomes, expenses, liabilities, events, retirementAge, statePensionAge, minAge, maxAge })`.

- [ ] **Step 1: Create the Timeline component**

Create `src/app/plan/Timeline.tsx`:

```tsx
// src/app/plan/Timeline.tsx
"use client";

import { type TimelineBar, toTimelineModel } from "@/lib/plan/timelineData";
import styled, { useTheme } from "styled-components";
import { DEBT_COLOUR, INCOME_COLOURS, OUTFLOW_COLOURS } from "./colours";
import type {
  SerializedPlanEvent,
  SerializedPlanExpense,
  SerializedPlanIncome,
  SerializedPlanLiability,
} from "./serialized";

// The exhaustive cashflow palettes are keyed by their literal unions; widen to
// a string index so a bar's `subKind` (typed `string | null`) can look up its
// colour, with a theme fallback. Safe: income/expense subKinds are always
// members of these maps (see colours.ts).
const INCOME = INCOME_COLOURS as Record<string, string>;
const OUTFLOW = OUTFLOW_COLOURS as Record<string, string>;

// Width of the left label gutter — single source so the bar tracks and the
// reference-line overlay share one coordinate space and stay aligned.
const GUTTER = "140px";

const Panel = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  overflow-x: auto;
`;
const Heading = styled.h2`
  font-size: ${({ theme }) => theme.typography.displayLg.size};
  font-weight: ${({ theme }) => theme.typography.displayLg.weight};
  color: ${({ theme }) => theme.colors.ink};
  margin: 0;
`;
const Plot = styled.div`
  position: relative;
  min-width: 480px;
`;
const Rows = styled.div`
  display: grid;
  grid-template-columns: ${GUTTER} 1fr;
  align-items: center;
  row-gap: ${({ theme }) => theme.spacing.xs};
`;
const GroupLabel = styled.div`
  grid-column: 1 / -1;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.dim};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;
const RowLabel = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: ${({ theme }) => theme.spacing.sm};
`;
const Track = styled.div`
  position: relative;
  height: 18px;
`;
const Bar = styled.div`
  position: absolute;
  top: 2px;
  height: 14px;
  border-radius: 3px;
  min-width: 2px;
`;
const Marker = styled.div<{ $inflow: boolean }>`
  position: absolute;
  top: 3px;
  width: 12px;
  height: 12px;
  transform: translateX(-50%) rotate(45deg);
  background: ${({ $inflow, theme }) =>
    $inflow ? theme.colors.positive : theme.colors.negative};
`;
const Overlay = styled.div`
  position: absolute;
  left: ${GUTTER};
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
`;
const RefLine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed ${({ theme }) => theme.colors.hairlineStrong};
`;
const RefLabel = styled.span`
  position: absolute;
  top: 0;
  left: 4px;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.dim};
  white-space: nowrap;
`;
const Tick = styled.span`
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 11px;
  color: ${({ theme }) => theme.colors.body};
`;
const Empty = styled.p`
  color: ${({ theme }) => theme.colors.dim};
  font-size: 13px;
  margin: 0;
`;

export function Timeline({
  incomes,
  expenses,
  liabilities,
  events,
  retirementAge,
  statePensionAge,
  minAge,
  maxAge,
}: {
  incomes: SerializedPlanIncome[];
  expenses: SerializedPlanExpense[];
  liabilities: SerializedPlanLiability[];
  events: SerializedPlanEvent[];
  retirementAge: number;
  statePensionAge: number | null;
  minAge: number;
  maxAge: number;
}) {
  const theme = useTheme();
  const model = toTimelineModel({
    incomes,
    expenses,
    liabilities,
    events,
    minAge,
    maxAge,
    retirementAge,
    statePensionAge,
  });

  const barColour = (b: TimelineBar): string => {
    if (b.lane === "liability") return DEBT_COLOUR;
    const map = b.lane === "income" ? INCOME : OUTFLOW;
    return map[b.subKind ?? ""] ?? theme.colors.dim;
  };

  const groups: [string, TimelineBar[]][] = [
    ["Income", model.bars.income],
    ["Expenses", model.bars.expense],
    ["Liabilities", model.bars.liability],
  ];
  const hasContent =
    groups.some(([, bars]) => bars.length > 0) || model.events.length > 0;

  return (
    <Panel>
      <Heading>Timeline</Heading>
      {hasContent ? (
        <Plot>
          <Rows>
            {groups.map(([label, bars]) =>
              bars.length === 0 ? null : (
                <div key={label} style={{ display: "contents" }}>
                  <GroupLabel>{label}</GroupLabel>
                  {bars.map((b) => (
                    <div key={b.id} style={{ display: "contents" }}>
                      <RowLabel title={b.label}>{b.label}</RowLabel>
                      <Track>
                        <Bar
                          style={{
                            left: `${b.leftPct}%`,
                            width: `${b.widthPct}%`,
                            background: barColour(b),
                          }}
                          title={`${b.label}: ${b.startAge}–${b.endAge}`}
                        />
                      </Track>
                    </div>
                  ))}
                </div>
              ),
            )}
            {model.events.length > 0 ? (
              <div style={{ display: "contents" }}>
                <GroupLabel>Events</GroupLabel>
                <RowLabel />
                <Track>
                  {model.events.map((m) => (
                    <Marker
                      key={m.id}
                      $inflow={m.direction === "INFLOW"}
                      style={{ left: `${m.leftPct}%` }}
                      title={`${m.label} (age ${m.age})`}
                    />
                  ))}
                </Track>
              </div>
            ) : null}
            <RowLabel />
            <Track>
              {model.ticks.map((t) => (
                <Tick key={t.age} style={{ left: `${t.leftPct}%` }}>
                  {t.age}
                </Tick>
              ))}
            </Track>
          </Rows>
          <Overlay>
            {model.refLines.map((r) => (
              <RefLine
                key={r.label}
                style={{ left: `${r.leftPct}%` }}
                title={`${r.label} (age ${r.age})`}
              >
                <RefLabel>{r.label}</RefLabel>
              </RefLine>
            ))}
          </Overlay>
        </Plot>
      ) : (
        <Empty>Add income, expenses or events to see your timeline.</Empty>
      )}
    </Panel>
  );
}
```

Note on the `display: contents` wrappers: each lane's group label + rows must be flat grid items in `Rows` (so `RowLabel`/`Track` land in the two columns), but React needs a keyed element per group/row. A wrapper with `display: contents` provides the key without creating a grid box of its own, so the children participate directly in the grid. This keeps bars and the reference-line overlay on one shared coordinate axis.

- [ ] **Step 2: Wire into PlanView**

In `src/app/plan/PlanView.tsx`:

1. Add the import: `import { Timeline } from "./Timeline";`
2. Render it between `<ChartPanel … />` and `<AssumptionsPanel … />`, deriving the age range from `years`:

```tsx
      <ChartPanel
        years={years}
        currency={currency}
        numberFormat={numberFormat}
      />
      <Timeline
        incomes={plan.incomes}
        expenses={plan.expenses}
        liabilities={plan.liabilities}
        events={plan.events}
        retirementAge={plan.assumptions.retirementAge}
        statePensionAge={plan.assumptions.statePensionAge}
        minAge={years[0]?.age ?? 0}
        maxAge={years[years.length - 1]?.age ?? 0}
      />
      <AssumptionsPanel assumptions={plan.assumptions} />
```

(`years[0]?.age ?? 0` / `years[years.length - 1]?.age ?? 0` satisfy `noUncheckedIndexedAccess` without `!`; a rendered plan always has ≥1 year, so the fallback is never hit.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. (The two `as Record<string, string>` widenings are the only casts; Biome permits `as`. No `!`.)

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/Timeline.tsx src/app/plan/PlanView.tsx
git commit -m "feat(plan): read-only life-events timeline below the chart

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: E2E coverage

**Files:**
- Modify: `e2e/plan.spec.ts`

**Interfaces:**
- Consumes: the wired `/plan` page (Tasks 1–2). The existing test seeds a plan with a "Salary" income (no liabilities); after its earlier CRUD steps the seeded Salary income remains.

- [ ] **Step 1: Add timeline assertions to the existing test**

In `e2e/plan.spec.ts`, insert before the final `await page.screenshot(...)` line:

```ts
  // Timeline (read-only Gantt): renders the seeded Salary income row + the
  // retirement reference line. Scope to the Timeline section so "Salary" /
  // "Retirement" don't collide with the income table / assumptions.
  const timeline = page.locator("section", { hasText: "Timeline" });
  await expect(timeline.getByText("Salary")).toBeVisible();
  await expect(timeline.getByText("Retirement")).toBeVisible();

  // A liability added via the 2a table appears on the timeline too.
  const liabilityPanel = page.locator("section", { hasText: "Liabilities" });
  await liabilityPanel.getByRole("button", { name: "+ Add liability" }).click();
  await expect(timeline.getByText("New liability")).toBeVisible();
```

- [ ] **Step 2: Run the e2e (local, system Chrome)**

Ensure the DB is up: `docker compose up -d db`
Run: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"`
Expected: PASS — the timeline shows the Salary row + Retirement line, and the newly-added liability appears as a timeline row.

- [ ] **Step 3: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): life-events timeline renders streams + reference line

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `docker compose up -d db` then `pnpm verify` (typecheck + biome ci + unit) passes.
- [ ] `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"` passes.
- [ ] Live browser check (verify skill): on `/plan`, confirm the Timeline sits below the chart, income/expense/liability bars span the right ages, event markers and the retirement line land correctly, bars share the cashflow colours, and the reference line aligns with the bars (gutter alignment).

## Notes

- Bars and the reference-line overlay share the `GUTTER` constant so they stay aligned; if a designer changes the gutter, change the one constant.
- The timeline is read-only; editing the underlying streams (which moves the bars after `router.refresh()`) happens in the 2a tables below.
