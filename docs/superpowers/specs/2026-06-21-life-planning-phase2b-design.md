# Life Planning — Phase 2b: Cash-flow & liquid-assets charts + view switcher

**Date:** 2026-06-21
**Status:** Design — approved for planning
**Branch:** `feat/life-planning-phase2`
**Predecessors:** Phase 0 engine (#58), 1a read-only `/plan` (#59), 1b editing + closeout (#60, #61)

## 1. Context & goal

`/plan` currently renders a single net-worth chart (stacked wrapper bars + debt +
net-worth line) above the editable assumptions/asset/liability panels. Voyant's
value is in showing the *same plan three ways*. This slice adds the other two
canonical views and a switcher between them:

1. **Cash flow** — where money comes from and goes, each year ("can I cover my
   spending, and which years fall short?").
2. **Liquid assets** — the drawdownable pots depleting over the plan ("does the
   money run out?").
3. A **view switcher** (Net worth / Cash flow / Liquid assets) above the chart.

## 2. Scope & non-goals

**Nature of this slice: pure presentation.** Every datum required already exists
on `YearProjection` (verified against `src/lib/plan/project.ts`). Therefore:

- **No** changes to the engine (`src/lib/plan/` projection modules).
- **No** Prisma schema / migration changes.
- **No** new or changed server actions.
- **No** new validation (no new user inputs).

Non-goals (later phases): income/expense/event CRUD (2a/2c), the life-events
Gantt (2c), real-time sliders (3). This slice only *reads* the existing
projection.

## 3. Data available (from `YearProjection`)

Per year the engine already emits:

| Field | Use |
| --- | --- |
| `incomeByKind: Record<string, number>` | cash-flow income bars (sums to `grossIncome`) |
| `withdrawals: number` (gross) | cash-flow income bar (drawdown from pots) |
| `expensesByCategory: Record<string, number>` | cash-flow outflow bars (sums to `totalExpenses`) |
| `tax: number` | cash-flow outflow bar (income tax **+** withdrawal tax) |
| `liabilityRepayments: number` | cash-flow outflow bar |
| `contributions: number` | cash-flow outflow bar (money paid into pots) |
| `shortfall: boolean` | red marker on cash-flow net line |
| `assets[]` `{ wrapper, value }` | liquid-assets stacked bars |
| `age` | x-axis (both) |

### 3.1 Known limitation — one-off events not surfaced

`YearProjection` does **not** expose per-year one-off event flows (`EventInput`
inflows/outflows are consumed internally in `project.ts` and never surfaced).
So the cash-flow chart cannot show one-off events, and in a plan containing
events the bars would not tie exactly to the net line.

**This is a non-issue for 2b:** events are not user-creatable until a later phase,
so every current plan has zero events. Flagged here to revisit when events CRUD
lands (the fix is to add an `eventsByDirection` / `eventInflow`/`eventOutflow`
field to `YearProjection` — an engine change, out of scope here).

## 4. Cash-flow chart — framing

**Money-in vs money-out, diverging about zero** (the most Voyant-faithful and
most complete of the framings considered):

- **Above zero (`stackId="in"`):** one stacked bar segment per income kind present
  (`incomeByKind`), plus a `WITHDRAWAL` segment (gross `withdrawals`).
- **Below zero (`stackId="out"`):** one stacked bar segment per expense category
  present (`expensesByCategory`), plus `TAX`, `REPAYMENT` (`liabilityRepayments`),
  and `CONTRIBUTION` (`contributions`) segments, drawn as negative values.
- **Net line:** `net = Σ(in) − Σ(out)`, computed in the transform so it ties to the
  drawn bars *by construction*. It approximates the engine's `surplus`: ≥0 in
  accumulation years, ≈0 in funded retirement, negative only in shortfall years.
- **Shortfall years:** marked with a red dot on the net line (`shortfall === true`).

Income is shown **gross** with `TAX` as an explicit outflow segment (rather than
showing net income), so tax is a visible cost and withdrawal tax is accounted for
exactly once (gross withdrawal in, total tax out — verified no double-count).

## 5. Liquid-assets chart — framing

Stacked **bars** of the **drawdownable pots** over time (same bar idiom and
`WRAPPER_COLOURS` as the net-worth chart, so the two views reconcile visually):

- `LIQUID_WRAPPERS = ["PENSION", "ISA", "GIA", "CASH"]` — the pots the engine
  actually draws down.
- PROPERTY (illiquid) and DB_PENSION (an income stream, not a pot) are **excluded**.
- A `total` line overlays the stack so depletion is legible at a glance.

This mirrors the engine's drawdown waterfall, so the chart literally shows the
pots being run down in retirement.

## 6. Components & files

### New / extended pure transforms — `src/lib/plan/chartData.ts`

```ts
// Diverging cash-flow rows. Income kinds + WITHDRAWAL are positive; expense
// categories + TAX + REPAYMENT + CONTRIBUTION are negative; `net` = sum of all
// drawn segments; `shortfall` carried through for the red marker.
export type CashFlowDatum = {
  age: number;
  net: number;
  shortfall: boolean;
} & Partial<Record<string, number>>; // income-kind + outflow keys

export function toCashFlowChartData(years: YearProjection[]): CashFlowDatum[];

// Which positive (income/withdrawal) and negative (expense/tax/repay/contrib)
// keys actually occur, so only those <Bar>s render.
export function cashFlowKeysPresent(rows: CashFlowDatum[]): {
  income: string[];   // canonical income-kind order + WITHDRAWAL last
  outflow: string[];  // canonical expense-category order + TAX/REPAYMENT/CONTRIBUTION
};

// Liquid pots per year, summed by wrapper over LIQUID_WRAPPERS only, plus total.
export const LIQUID_WRAPPERS: Wrapper[] = ["PENSION", "ISA", "GIA", "CASH"];

export type LiquidAssetsDatum = { age: number; total: number } & Partial<
  Record<Wrapper, number>
>;

export function toLiquidAssetsChartData(years: YearProjection[]): LiquidAssetsDatum[];

export function liquidWrappersPresent(rows: LiquidAssetsDatum[]): Wrapper[];
```

### New chart components

- **`src/app/plan/CashFlowChart.tsx`** — Recharts `ComposedChart`: positive stacked
  `Bar`s (`stackId="in"`), negative stacked `Bar`s (`stackId="out"`), a `net`
  `Line` with a custom red dot on shortfall years, `ReferenceLine y={0}`. Reuses the
  currency tick/tooltip formatting pattern from `NetWorthChart.tsx`.
- **`src/app/plan/LiquidAssetsChart.tsx`** — Recharts stacked bars/area of liquid
  wrappers + a `total` line, reusing `WRAPPER_COLOURS`.

### New container

- **`src/app/plan/ChartPanel.tsx`** (`"use client"`) — owns the view-switcher state
  (a segmented control with three options; **default Net worth**) and renders the
  selected chart. Receives `years`, `currency`, `numberFormat`. Switching is local
  React state — no server round-trip.

### Edited

- **`src/app/plan/PlanView.tsx`** — replace the bare `<NetWorthChart …>` with
  `<ChartPanel years={years} currency={currency} numberFormat={numberFormat} />`.
- **`src/app/plan/colours.ts`** — add two palettes within the existing token family:
  - `INCOME_COLOURS: Record<IncomeKind | "WITHDRAWAL", string>`
  - `OUTFLOW_COLOURS: Record<ExpenseCategory | "TAX" | "REPAYMENT" | "CONTRIBUTION", string>`

### 6.1 Modularity & clarity (design intent)

Strict, one-purpose units with typed interfaces — each understandable and testable
in isolation:

- **Transforms (`chartData.ts`)** hold *all* shaping logic, contain **no React**,
  and are the only place a `YearProjection` is read. One exported function per
  view, each pure and unit-tested.
- **Chart components** (`CashFlowChart`, `LiquidAssetsChart`) are **presentational
  only**: they accept an already-shaped, typed datum array (+ `currency`,
  `numberFormat`) and render Recharts. No filtering, summing, or `YearProjection`
  knowledge inside a component.
- **`ChartPanel`** is a thin switch: it owns *only* the selected-view enum and
  delegates. No transform or formatting logic.
- **`colours.ts`** is the single source of palette truth; components import, never
  inline, colours.
- Files stay small and single-responsibility; shared formatting (currency tick /
  tooltip) is reused from the existing pattern rather than duplicated.

## 7. Data flow

Unchanged server-side. `page.tsx` already passes `projection.years` into the
`"use client"` `PlanView`; `ChartPanel` feeds those years through the pure
transforms in `chartData.ts` and renders the selected chart. View switching is
purely local React state.

## 8. Testing

- **Unit (Jest), `src/lib/plan/chartData.test.ts`:**
  - `toCashFlowChartData`: income kinds positive; expense/tax/repay/contrib
    negative; `net === Σin − Σout`; `shortfall` carried; only-present keys via
    `cashFlowKeysPresent`.
  - `toLiquidAssetsChartData`: sums only the four liquid wrappers (PROPERTY +
    DB_PENSION excluded); `total` correct; `liquidWrappersPresent` returns present
    liquid wrappers in canonical order.
- **E2E (Playwright), extend `e2e/plan.spec.ts`:** after the plan renders, assert
  the three-way switcher exists; click **Cash flow** → its region/legend appears;
  click **Liquid assets** → appears; screenshot each. Existing net-worth legend
  assertions remain (default view = Net worth).
- **Charts themselves:** verified via e2e, matching repo convention — Recharts does
  not render meaningfully under jsdom, so no faked unit coverage of chart
  components.

## 9. Risks / edge cases

- **Empty / single-wrapper plans** — `cashFlowKeysPresent` / `liquidWrappersPresent`
  guard which bars render, so a CASH-only synthetic plan still renders cleanly.
- **All-zero outflow segments** (e.g. no debt → `REPAYMENT` always 0) are dropped by
  the present-keys filter.
- **Net line vs engine `surplus`** — net is defined as the sum of the drawn bars, so
  it always ties to the bars; it is *approximately* the engine surplus, not asserted
  equal (events/tax-timing differences). Documented, not a bug.
