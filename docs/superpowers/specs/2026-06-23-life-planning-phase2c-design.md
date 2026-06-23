# Life Planning — Phase 2c: Life-events Gantt (read-only timeline)

**Date:** 2026-06-23
**Status:** Design — approved for planning
**Predecessors:** Phase 0 engine, 1a/1b, 2b charts+switcher (#62), 2a editing-completion CRUD (#67)

## 1. Context & goal

`/plan` now has the three chart views (net worth / cash flow / liquid assets) and full editing of every collection. The remaining signature Voyant element is the **life timeline**: a horizontal Gantt that shows, across the lifespan, *when* each income/expense stream is active, *when* debts are paid off, and *where* one-off events land — the "shape of your life" at a glance. This realises the original vision ("a Gantt chart linked to the line graph").

This slice is **read-only** (visualise; editing stays in the 2a tables). Drag-to-edit is explicitly a later phase.

## 2. Scope & non-goals

**Pure presentation. No engine / schema / migration / server-action changes** — every datum already exists on the serialized plan and the `years` array (the age axis).

In scope:
- A full-width **Timeline** section directly below the chart switcher, sharing the current-age → plan-to-age x-axis.
- **Income** and **expense** streams as horizontal bars (`startAge → endAge`); **liabilities** as bars (`now → endAge`); **one-off events** as point markers; a **retirement-age** reference line (and **state-pension-age** if set).
- Hover/title on a bar/marker shows its label + age span (native `title` attribute — no custom tooltip lib).

Non-goals (later phases): drag-to-edit bars/markers (2c-interactive), hover-sync between the timeline and the chart, asset accumulation/drawdown lanes (assets are stocks — already shown in the net-worth/liquid views), reordering.

## 3. Rendering approach

A Gantt is not a Recharts shape, and a Gantt library would violate the project's minimal-dependency ethos. So a **custom timeline driven by a pure layout model**, matching the project's established split:

- The **age → position** math (the load-bearing part) lives in a pure, unit-tested module `src/lib/plan/timelineData.ts`.
- The component `src/app/plan/Timeline.tsx` is dumb: absolutely-positioned `<div>` bars/markers inside relative tracks, fed entirely by the model.

(Considered and rejected: a Recharts horizontal-stacked-bar hack — awkward fit, no per-row labels/markers; a Gantt npm package — new dependency.)

## 4. The layout model — `src/lib/plan/timelineData.ts`

```ts
export type TimelineRange = { minAge: number; maxAge: number };

export type TimelineBar = {
  id: string;
  label: string;
  lane: "income" | "expense" | "liability";
  subKind: string | null; // income kind / expense category; null for liability — drives colour in the component
  startAge: number;       // resolved + clamped to range
  endAge: number;         // resolved + clamped to range
  leftPct: number;        // 0..100
  widthPct: number;       // 0..100 (>= 0)
};

export type TimelineMarker = {
  id: string;
  label: string;
  age: number;            // clamped to range
  direction: "INFLOW" | "OUTFLOW";
  leftPct: number;        // 0..100
};

export type TimelineTick = { age: number; leftPct: number };

export type TimelineRefLine = { label: string; age: number; leftPct: number };

export type TimelineModel = {
  range: TimelineRange;
  bars: { income: TimelineBar[]; expense: TimelineBar[]; liability: TimelineBar[] };
  events: TimelineMarker[];
  refLines: TimelineRefLine[]; // retirement (+ state pension if set), in range
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
}): TimelineModel;
```

**Resolution & geometry rules (the unit-test surface):**
- `agePct(age) = ((clamp(age, minAge, maxAge) − minAge) / span) * 100`, where `span = maxAge − minAge`. **Guard `span <= 0`** (degenerate single-year plan): all `leftPct = 0`, `widthPct = 0`, `ticks = [{ age: minAge, leftPct: 0 }]`.
- Income/expense bar: `start = startAge ?? minAge`, `end = endAge ?? maxAge`. Liability bar: `start = minAge`, `end = endAge ?? maxAge`.
- Clamp `[start, end]` to `[minAge, maxAge]`; `leftPct = agePct(start)`; `widthPct = agePct(end) − agePct(start)` (never negative — a fully out-of-range or inverted span yields `0`, which the component renders as nothing/a sliver).
- Bars keep their collection order (already `sortOrder`-ordered from `getPrimaryPlan`).
- Event marker: `leftPct = agePct(age)`; markers whose age is outside the range are clamped to the edge (kept, not dropped — a "car at 95" on a plan-to-90 still shows at the right edge).
- `refLines`: retirement always; state pension only when `statePensionAge !== null`. Each included only if within `[minAge, maxAge]` (a retirement age past plan-to-age just isn't drawn).
- `ticks`: every 10 years from the first multiple of 10 ≥ `minAge` up to `maxAge`, plus always `minAge` (so the axis starts labelled). Each with its `leftPct`.

No React, no colours in this module (colour is the component's concern); it imports the `Serialized*` types from `@/app/plan/serialized` to avoid duplicating the input shapes. (These are plain data types, so importing them into `src/lib/plan/` is acceptable; the engine's own input types in `types.ts` are unaffected.)

## 5. Component — `src/app/plan/Timeline.tsx`

`"use client"` (styled-components consistency; no interactivity, no hooks). Props: `{ incomes, expenses, liabilities, events, retirementAge, statePensionAge, minAge, maxAge }`. The component calls `toTimelineModel(...)` internally, mirroring how `CashFlowChart`/`LiquidAssetsChart` call their transforms (keeps all shaping in the pure module, the component dumb).

Structure:
- A `Panel`/`Heading` ("Timeline") matching the other plan sections.
- A relative **plot** area. Vertical **reference lines** (retirement, state pension) absolutely positioned at their `leftPct`, spanning all lanes, labelled at the top.
- Lane groups in order **Income → Expenses → Liabilities**, each: a small group label, then one row per bar — `label` (left gutter) + a relative `track` containing the absolutely-positioned bar (`left/width` = `leftPct/widthPct`%). Bar fill: income → `INCOME_COLOURS[subKind]`, expense → `OUTFLOW_COLOURS[subKind]`, liability → `DEBT_COLOUR` (reusing the cashflow palette so a Salary bar matches its cashflow segment). Each bar has a `title` = `"{label}: {startAge}–{endAge}"`.
- An **events** row: markers (small diamonds/pins) at their `leftPct`, `title` = `"{label} (age {age})"`, coloured by direction (inflow positive / outflow negative tokens).
- A bottom **axis**: tick labels at each `ticks[].leftPct`.
- **Empty state:** if there are no bars and no events, render a dim "Add income, expenses or events to see your timeline." hint (the seeded plan has ≥1 income, so this is the truly-empty case).
- Horizontal overflow guarded (`overflow-x: auto`) like the tables.

Colour additions in `colours.ts` if needed: an `EVENT_COLOUR`/reference-line colour (or reuse `positive`/`negative` + `dim`/`hairlineStrong` theme tokens — prefer existing tokens; add to `colours.ts` only a `RETIREMENT_LINE` constant if no token fits).

## 6. Wiring — `src/app/plan/PlanView.tsx`

Render `<Timeline … />` between `<ChartPanel … />` and `<AssumptionsPanel … />`. Feed it `plan.incomes/expenses/liabilities/events` + `plan.assumptions.retirementAge/statePensionAge` + the age range from `years`: `minAge = years[0].age`, `maxAge = years[years.length - 1].age` (guard empty `years` — though a rendered plan always has ≥1 year). `PlanView` already holds both `years` and `plan`.

## 7. Data flow

Unchanged server-side. `page.tsx` already serializes everything; `PlanView` passes the serialized collections + the `years`-derived range into `Timeline`, which builds the model client-side. No new queries, actions, or engine work.

## 8. Testing

- **Unit (Jest), `src/lib/plan/timelineData.test.ts`:** null-age resolution (income/expense start→minAge, end→maxAge; liability start=minAge, end=endAge??maxAge); clamping of out-of-range and inverted spans to `widthPct >= 0`; event-age clamping (kept at the edge, not dropped); `refLines` inclusion/exclusion by range + the state-pension-null case; `ticks` every 10y including `minAge`; the degenerate `span <= 0` guard.
- **E2E (`e2e/plan.spec.ts`, extend):** after the plan renders, assert the **Timeline** section is visible with the seeded **Salary** income row and a **Retirement** reference label; then add a liability via the 2a "Add liability" button and assert a liability row/bar appears in the timeline.
- **Component:** no jsdom unit test (positioned-div layout is low-value to assert under jsdom; repo convention — covered by e2e).

## 9. Decomposition

One slice, ~3 tasks: (1) `timelineData.ts` pure model + unit tests; (2) `Timeline.tsx` component (+ any `colours.ts` addition) + PlanView wiring; (3) e2e. Each independently testable.

## 10. Risks / edge cases

- **Degenerate range** (`maxAge === minAge`): guarded (all pct 0) — won't divide by zero.
- **Out-of-range / inverted spans**: clamp to `widthPct >= 0`; never negative widths.
- **Many rows**: the timeline grows with the number of streams; `overflow-x: auto` + natural vertical stacking handle it. No virtualization (YAGNI for a personal plan's handful of rows).
- **Colour coverage**: `INCOME_COLOURS`/`OUTFLOW_COLOURS` already cover every `PlanIncomeKind`/`ExpenseCategory` (added in 2b), so every bar has a fill with no `as`/fallback needed.
- **No events/bars at all**: empty-state hint.
