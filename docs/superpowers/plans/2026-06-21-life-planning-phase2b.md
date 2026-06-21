# Life Planning Phase 2b — Cash-flow & Liquid-assets Charts + View Switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cash-flow chart and a Liquid-assets chart to `/plan`, behind a Net worth / Cash flow / Liquid assets view switcher.

**Architecture:** Pure presentation over the existing engine output. All data already exists on `YearProjection`; this slice adds pure transforms in `src/lib/plan/chartData.ts`, two presentational Recharts components, a thin switcher container, and a shared amount-tick formatter. No engine, schema, server-action, or validation changes.

**Tech Stack:** Next.js 16 App Router / React 19, TypeScript, Recharts 3, styled-components, Jest (unit), Playwright (e2e), Biome (lint/format), pnpm.

## Global Constraints

- **Biome bans non-null assertions (`!`).** Never write `x!`. (Applies to every task.)
- **TypeScript:** prefer `satisfies` over `as`; derive types rather than restating them; no enums.
- **Pure transforms hold all shaping logic** (no React); chart components are presentational only; `ChartPanel` is a switch only; `colours.ts` is the single palette source. (Spec §6.1.)
- **Charts are not unit-tested** — Recharts does not render meaningfully under jsdom (repo convention). Chart components are gated by `pnpm typecheck` + `pnpm lint`; runtime verification is the e2e task.
- **Commit message trailer** (every commit): `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Default view is Net worth** (so existing e2e net-worth assertions still pass).
- Spec: `docs/superpowers/specs/2026-06-21-life-planning-phase2b-design.md`.

---

### Task 1: Cash-flow chart transform

**Files:**
- Modify: `src/lib/plan/index.ts` (add `ExpenseCategory` to the exported types)
- Modify: `src/lib/plan/chartData.ts` (add cash-flow transform + key helpers + types)
- Test: `src/lib/plan/chartData.test.ts` (extend)

**Interfaces:**
- Consumes: `YearProjection` from `@/lib/plan` (`incomeByKind`, `expensesByCategory`, `tax`, `liabilityRepayments`, `contributions`, `withdrawals`, `shortfall`, `age`).
- Produces:
  - `type CashFlowDatum = { age: number; net: number; shortfall: boolean } & Partial<Record<IncomeFlowKey | OutflowKey, number>>`
  - `type IncomeFlowKey` (union: `"SALARY" | "SELF_EMPLOYMENT" | "STATE_PENSION" | "DB_PENSION" | "RENTAL" | "OTHER" | "WITHDRAWAL"`)
  - `type OutflowKey` (union: `"FIXED" | "VARIABLE" | "DISCRETIONARY" | "TAX" | "REPAYMENT" | "CONTRIBUTION"`)
  - `function toCashFlowChartData(years: YearProjection[]): CashFlowDatum[]`
  - `function cashFlowKeysPresent(rows: CashFlowDatum[]): { income: IncomeFlowKey[]; outflow: OutflowKey[] }`

- [ ] **Step 1: Export `ExpenseCategory` from the barrel**

In `src/lib/plan/index.ts`, add `ExpenseCategory` to the `export type { … } from "./types"` list (alphabetically, after `EventInput`):

```ts
export type {
  AssetBalance,
  AssetInput,
  EventInput,
  ExpenseCategory,
  ExpenseInput,
  Growth,
  IncomeInput,
  IncomeKind,
  LiabilityBalance,
  LiabilityInput,
  PlanInput,
  PlanProjection,
  Verdict,
  Wrapper,
  YearProjection,
} from "./types";
```

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/plan/chartData.test.ts` (the file already imports `YearProjection` and defines a `year()` factory; add the new imports to the existing top import line, then append the describe block):

```ts
// add toCashFlowChartData, cashFlowKeysPresent to the existing import from "./chartData"

describe("toCashFlowChartData", () => {
  it("puts income kinds + withdrawals positive and expenses/tax/repay/contrib negative", () => {
    const rows = toCashFlowChartData([
      year({
        age: 70,
        incomeByKind: { STATE_PENSION: 9000 },
        withdrawals: 20000,
        expensesByCategory: { FIXED: 18000, DISCRETIONARY: 4000 },
        tax: 3000,
        liabilityRepayments: 0,
        contributions: 0,
      }),
    ]);
    expect(rows[0]).toMatchObject({
      age: 70,
      STATE_PENSION: 9000,
      WITHDRAWAL: 20000,
      FIXED: -18000,
      DISCRETIONARY: -4000,
      TAX: -3000,
      shortfall: false,
    });
  });

  it("computes net as the algebraic sum of the drawn segments (in − out)", () => {
    const rows = toCashFlowChartData([
      year({
        age: 40,
        incomeByKind: { SALARY: 50000 },
        withdrawals: 0,
        expensesByCategory: { FIXED: 20000 },
        tax: 8000,
        liabilityRepayments: 6000,
        contributions: 5000,
      }),
    ]);
    // 50000 − (20000 + 8000 + 6000 + 5000) = 11000
    expect(rows[0].net).toBe(11000);
  });

  it("carries the shortfall flag through", () => {
    const rows = toCashFlowChartData([year({ age: 90, shortfall: true })]);
    expect(rows[0].shortfall).toBe(true);
  });

  it("cashFlowKeysPresent returns only non-zero keys in canonical order", () => {
    const rows = toCashFlowChartData([
      year({
        age: 65,
        incomeByKind: { SALARY: 0, STATE_PENSION: 9000 },
        withdrawals: 12000,
        expensesByCategory: { FIXED: 15000 },
        tax: 2000,
        liabilityRepayments: 0,
        contributions: 0,
      }),
    ]);
    expect(cashFlowKeysPresent(rows)).toEqual({
      income: ["STATE_PENSION", "WITHDRAWAL"],
      outflow: ["FIXED", "TAX"],
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test -- chartData`
Expected: FAIL — `toCashFlowChartData is not a function` (or import error).

- [ ] **Step 4: Implement the transform**

In `src/lib/plan/chartData.ts`, update the top import and append the new code. Change the first line's import to include the extra types:

```ts
import {
  type ExpenseCategory,
  type IncomeKind,
  WRAPPERS,
  type Wrapper,
  type YearProjection,
} from "@/lib/plan";
```

Then append:

```ts
// ── Cash-flow chart ──────────────────────────────────────────────────────
// Diverging money-in / money-out. Income kinds + WITHDRAWAL are positive;
// expense categories + TAX + REPAYMENT + CONTRIBUTION are negative. `net` is
// the algebraic sum of the drawn segments, so the net line ties to the bars by
// construction. One-off events are not represented (the engine does not surface
// per-year event flows on YearProjection — see spec §3.1).

const INCOME_KEYS = [
  "SALARY",
  "SELF_EMPLOYMENT",
  "STATE_PENSION",
  "DB_PENSION",
  "RENTAL",
  "OTHER",
  "WITHDRAWAL",
] as const satisfies readonly (IncomeKind | "WITHDRAWAL")[];

const EXPENSE_KEYS = [
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
] as const satisfies readonly ExpenseCategory[];

const OUTFLOW_KEYS = [
  "FIXED",
  "VARIABLE",
  "DISCRETIONARY",
  "TAX",
  "REPAYMENT",
  "CONTRIBUTION",
] as const satisfies readonly (
  | ExpenseCategory
  | "TAX"
  | "REPAYMENT"
  | "CONTRIBUTION"
)[];

export type IncomeFlowKey = (typeof INCOME_KEYS)[number];
export type OutflowKey = (typeof OUTFLOW_KEYS)[number];

export type CashFlowDatum = {
  age: number;
  net: number;
  shortfall: boolean;
} & Partial<Record<IncomeFlowKey | OutflowKey, number>>;

export function toCashFlowChartData(years: YearProjection[]): CashFlowDatum[] {
  return years.map((y) => {
    const row: CashFlowDatum = { age: y.age, net: 0, shortfall: y.shortfall };

    let inTotal = 0;
    for (const key of INCOME_KEYS) {
      if (key === "WITHDRAWAL") continue;
      const amount = y.incomeByKind[key] ?? 0;
      if (amount !== 0) {
        row[key] = amount;
        inTotal += amount;
      }
    }
    if (y.withdrawals !== 0) {
      row.WITHDRAWAL = y.withdrawals;
      inTotal += y.withdrawals;
    }

    let outTotal = 0;
    for (const key of EXPENSE_KEYS) {
      const amount = y.expensesByCategory[key] ?? 0;
      if (amount !== 0) {
        row[key] = -amount;
        outTotal += amount;
      }
    }
    const synthetic: [OutflowKey, number][] = [
      ["TAX", y.tax],
      ["REPAYMENT", y.liabilityRepayments],
      ["CONTRIBUTION", y.contributions],
    ];
    for (const [key, amount] of synthetic) {
      if (amount !== 0) {
        row[key] = -amount;
        outTotal += amount;
      }
    }

    row.net = inTotal - outTotal;
    return row;
  });
}

// Which positive (income) and negative (outflow) keys actually occur anywhere
// in the series, in canonical order — so only those <Bar>s render.
export function cashFlowKeysPresent(rows: CashFlowDatum[]): {
  income: IncomeFlowKey[];
  outflow: OutflowKey[];
} {
  return {
    income: INCOME_KEYS.filter((k) => rows.some((r) => (r[k] ?? 0) !== 0)),
    outflow: OUTFLOW_KEYS.filter((k) => rows.some((r) => (r[k] ?? 0) !== 0)),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- chartData`
Expected: PASS (existing net-worth tests + 4 new cash-flow tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/plan/index.ts src/lib/plan/chartData.ts src/lib/plan/chartData.test.ts
git commit -m "feat(plan): cash-flow chart transform

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Liquid-assets chart transform

**Files:**
- Modify: `src/lib/plan/chartData.ts`
- Test: `src/lib/plan/chartData.test.ts`

**Interfaces:**
- Consumes: `YearProjection.assets[]` (`{ wrapper, value }`), `Wrapper` from `@/lib/plan`.
- Produces:
  - `const LIQUID_WRAPPERS: Wrapper[]` = `["PENSION", "ISA", "GIA", "CASH"]`
  - `type LiquidAssetsDatum = { age: number; total: number } & Partial<Record<Wrapper, number>>`
  - `function toLiquidAssetsChartData(years: YearProjection[]): LiquidAssetsDatum[]`
  - `function liquidWrappersPresent(rows: LiquidAssetsDatum[]): Wrapper[]`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/plan/chartData.test.ts` (add `toLiquidAssetsChartData`, `liquidWrappersPresent` to the `./chartData` import):

```ts
const liquidAsset = (
  wrapper: Wrapper,
  value: number,
  id = wrapper,
): YearProjection["assets"][number] => ({
  id,
  label: id,
  wrapper,
  value,
  contributed: 0,
  withdrawn: 0,
});

describe("toLiquidAssetsChartData", () => {
  it("sums only liquid wrappers and excludes PROPERTY and DB_PENSION", () => {
    const rows = toLiquidAssetsChartData([
      year({
        age: 50,
        assets: [
          liquidAsset("PENSION", 80000),
          liquidAsset("ISA", 20000),
          liquidAsset("CASH", 10000),
          liquidAsset("PROPERTY", 300000),
          liquidAsset("DB_PENSION", 50000),
        ],
      }),
    ]);
    expect(rows[0]).toMatchObject({
      age: 50,
      PENSION: 80000,
      ISA: 20000,
      CASH: 10000,
      total: 110000,
    });
    expect(rows[0].PROPERTY).toBeUndefined();
    expect(rows[0].DB_PENSION).toBeUndefined();
  });

  it("liquidWrappersPresent lists present liquid wrappers in canonical order", () => {
    const rows = toLiquidAssetsChartData([
      year({ age: 50, assets: [liquidAsset("CASH", 10000), liquidAsset("PENSION", 5000)] }),
    ]);
    expect(liquidWrappersPresent(rows)).toEqual(["PENSION", "CASH"]);
  });
});
```

Add the `Wrapper` type to the existing top import if not already present:

```ts
import type { YearProjection, Wrapper } from "@/lib/plan";
```

(If `Wrapper` is already imported elsewhere in the test file, skip — do not duplicate.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- chartData`
Expected: FAIL — `toLiquidAssetsChartData is not a function`.

- [ ] **Step 3: Implement the transform**

Append to `src/lib/plan/chartData.ts`:

```ts
// ── Liquid-assets chart ────────────────────────────────────────────────────
// Drawdownable pots only — the wrappers the engine actually draws down.
// PROPERTY (illiquid) and DB_PENSION (an income stream, not a pot) are excluded.

export const LIQUID_WRAPPERS: Wrapper[] = ["PENSION", "ISA", "GIA", "CASH"];

export type LiquidAssetsDatum = { age: number; total: number } & Partial<
  Record<Wrapper, number>
>;

export function toLiquidAssetsChartData(
  years: YearProjection[],
): LiquidAssetsDatum[] {
  return years.map((y) => {
    const row: LiquidAssetsDatum = { age: y.age, total: 0 };
    for (const a of y.assets) {
      if (!LIQUID_WRAPPERS.includes(a.wrapper)) continue;
      row[a.wrapper] = (row[a.wrapper] ?? 0) + a.value;
      row.total += a.value;
    }
    return row;
  });
}

export function liquidWrappersPresent(rows: LiquidAssetsDatum[]): Wrapper[] {
  return LIQUID_WRAPPERS.filter((w) => rows.some((r) => (r[w] ?? 0) !== 0));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- chartData`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/chartData.ts src/lib/plan/chartData.test.ts
git commit -m "feat(plan): liquid-assets chart transform

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Shared amount-tick formatter

**Files:**
- Create: `src/app/plan/chartFormat.ts`
- Test: `src/app/plan/chartFormat.test.ts`
- Modify: `src/app/plan/NetWorthChart.tsx` (use the shared helper instead of the inline one)

**Interfaces:**
- Consumes: `symbolFor` from `@/lib/settings/currency`.
- Produces: `function makeAmountTick(currency: string): (v: number) => string` — formats a Y-axis tick like `£2k` / `-£2k` / `£500` (thousands rounded to `k`, plain below 1000). Uses ASCII `-` for negatives (matches the current axis behaviour).

- [ ] **Step 1: Write the failing test**

Create `src/app/plan/chartFormat.test.ts`:

```ts
import { makeAmountTick } from "./chartFormat";

describe("makeAmountTick", () => {
  const tick = makeAmountTick("GBP");

  it("renders thousands rounded to k with the currency symbol", () => {
    expect(tick(1500)).toBe("£2k");
    expect(tick(80000)).toBe("£80k");
  });

  it("renders sub-1000 amounts in full", () => {
    expect(tick(500)).toBe("£500");
    expect(tick(0)).toBe("£0");
  });

  it("prefixes negatives with an ASCII minus", () => {
    expect(tick(-2000)).toBe("-£2k");
  });

  it("falls back to $ for an unknown currency code", () => {
    expect(makeAmountTick("ZZZ")(1000)).toBe("$1k");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- chartFormat`
Expected: FAIL — cannot find module `./chartFormat`.

- [ ] **Step 3: Implement the helper**

Create `src/app/plan/chartFormat.ts`:

```ts
// src/app/plan/chartFormat.ts
import { symbolFor } from "@/lib/settings/currency";

// A Y-axis tick formatter for the plan charts: amounts ≥ 1000 collapse to a
// rounded `k` value, smaller amounts render in full. ASCII minus for negatives
// (axis ticks, not body copy). Shared by all three plan charts.
export const makeAmountTick =
  (currency: string) =>
  (v: number): string => {
    const sym = symbolFor(currency);
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    return abs >= 1000
      ? `${sign}${sym}${Math.round(abs / 1000)}k`
      : `${sign}${sym}${abs}`;
  };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- chartFormat`
Expected: PASS.

- [ ] **Step 5: Refactor NetWorthChart to use the shared helper**

In `src/app/plan/NetWorthChart.tsx`:

1. Add the import (after the existing imports):

```ts
import { makeAmountTick } from "./chartFormat";
```

2. Replace the inline `amountTick` definition:

```ts
  const amountTick = (v: number) => {
    const sym = symbolFor(currency);
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    return abs >= 1000
      ? `${sign}${sym}${Math.round(abs / 1000)}k`
      : `${sign}${sym}${abs}`;
  };
```

with:

```ts
  const amountTick = makeAmountTick(currency);
```

3. Remove `symbolFor` from the `@/lib/settings/currency` import if it is now unused (keep `formatAmount` and the `NumberFormat` type, which the tooltip still uses).

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors (in particular, no "unused import: symbolFor").

- [ ] **Step 7: Commit**

```bash
git add src/app/plan/chartFormat.ts src/app/plan/chartFormat.test.ts src/app/plan/NetWorthChart.tsx
git commit -m "refactor(plan): extract shared makeAmountTick chart formatter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Colours + Cash-flow chart component

**Files:**
- Modify: `src/app/plan/colours.ts` (add `INCOME_COLOURS`, `OUTFLOW_COLOURS`)
- Create: `src/app/plan/CashFlowChart.tsx`

**Interfaces:**
- Consumes: `toCashFlowChartData`, `cashFlowKeysPresent`, `CashFlowDatum`, `IncomeFlowKey`, `OutflowKey` (Task 1); `makeAmountTick` (Task 3); `NET_WORTH_COLOUR` (existing in `colours.ts`); `formatAmount`, `NumberFormat` from `@/lib/settings/currency`.
- Produces: `function CashFlowChart({ years, currency, numberFormat }: { years: YearProjection[]; currency: string; numberFormat: NumberFormat }): JSX.Element`

- [ ] **Step 1: Add the colour palettes**

In `src/app/plan/colours.ts`, change the import line and append the two palettes:

```ts
import type { ExpenseCategory, IncomeKind, Wrapper } from "@/lib/plan";
```

```ts
// Cash-flow chart — income sources (positive) and outflows (negative).
// Income keyed by IncomeKind + the synthetic WITHDRAWAL (drawdown from pots).
export const INCOME_COLOURS: Record<IncomeKind | "WITHDRAWAL", string> = {
  SALARY: "#1F8A4C",
  SELF_EMPLOYMENT: "#2BA35E",
  STATE_PENSION: "#1E5BC6",
  DB_PENSION: "#475569",
  RENTAL: "#0EA5A4",
  OTHER: "#94A3B8",
  WITHDRAWAL: "#7C3AED",
};

// Outflows keyed by ExpenseCategory + tax / loan repayments / contributions.
export const OUTFLOW_COLOURS: Record<
  ExpenseCategory | "TAX" | "REPAYMENT" | "CONTRIBUTION",
  string
> = {
  FIXED: "#B33B3B",
  VARIABLE: "#D97706",
  DISCRETIONARY: "#E0A458",
  TAX: "#6B7280",
  REPAYMENT: "#92400E",
  CONTRIBUTION: "#2563EB",
};
```

Note: `INCOME_COLOURS` is keyed by `IncomeKind | "WITHDRAWAL"`, which is exactly `IncomeFlowKey`; `OUTFLOW_COLOURS` is keyed by `ExpenseCategory | "TAX" | "REPAYMENT" | "CONTRIBUTION"`, exactly `OutflowKey`. So the component can index them with the keys from `cashFlowKeysPresent` without any cast.

- [ ] **Step 2: Create the chart component**

Create `src/app/plan/CashFlowChart.tsx`:

```tsx
// src/app/plan/CashFlowChart.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import {
  type CashFlowDatum,
  cashFlowKeysPresent,
  toCashFlowChartData,
} from "@/lib/plan/chartData";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";
import { makeAmountTick } from "./chartFormat";
import { INCOME_COLOURS, NET_WORTH_COLOUR, OUTFLOW_COLOURS } from "./colours";

// Income sources + withdrawals stack above zero; expenses + tax + repayments +
// contributions stack below zero; the net line is the algebraic sum and gets a
// red dot in shortfall years.
export function CashFlowChart({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();
  const data = toCashFlowChartData(years);
  const { income, outflow } = cashFlowKeysPresent(data);
  const amountTick = makeAmountTick(currency);

  const renderNetDot = (props: {
    cx?: number;
    cy?: number;
    payload?: CashFlowDatum;
  }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload?.shortfall) {
      return <g key={`net-${payload?.age ?? cx}`} />;
    }
    return (
      <circle
        key={`net-${payload.age}`}
        cx={cx}
        cy={cy}
        r={4}
        fill={theme.colors.negative}
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart
        data={data}
        stackOffset="sign"
        margin={{ top: 16, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={64}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <Tooltip
          formatter={(value, name) => [
            formatAmount(currency, Math.abs(Number(value)), numberFormat),
            name,
          ]}
          contentStyle={{
            border: `1px solid ${theme.colors.hairline}`,
            borderRadius: theme.rounded.sm,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke={theme.colors.hairlineStrong} />
        {income.map((k) => (
          <Bar
            key={k}
            dataKey={k}
            name={k}
            stackId="in"
            fill={INCOME_COLOURS[k]}
            isAnimationActive={false}
          />
        ))}
        {outflow.map((k) => (
          <Bar
            key={k}
            dataKey={k}
            name={k}
            stackId="out"
            fill={OUTFLOW_COLOURS[k]}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="net"
          name="Net"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={renderNetDot}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

Note: `stackOffset="sign"` makes Recharts stack positive values upward and negative values downward about zero — this is what produces the diverging in/out layout. The `Math.abs` in the tooltip formatter shows outflow magnitudes as positive numbers.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (If lint flags the `renderNetDot` return, ensure both branches return an SVG element with a `key`, as written.)

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/colours.ts src/app/plan/CashFlowChart.tsx
git commit -m "feat(plan): cash-flow chart component + income/outflow palettes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Liquid-assets chart component

**Files:**
- Create: `src/app/plan/LiquidAssetsChart.tsx`

**Interfaces:**
- Consumes: `toLiquidAssetsChartData`, `liquidWrappersPresent` (Task 2); `makeAmountTick` (Task 3); `WRAPPER_COLOURS`, `NET_WORTH_COLOUR` (existing in `colours.ts`); `formatAmount`, `NumberFormat`.
- Produces: `function LiquidAssetsChart({ years, currency, numberFormat }: { years: YearProjection[]; currency: string; numberFormat: NumberFormat }): JSX.Element`

- [ ] **Step 1: Create the chart component**

Create `src/app/plan/LiquidAssetsChart.tsx`:

```tsx
// src/app/plan/LiquidAssetsChart.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import {
  liquidWrappersPresent,
  toLiquidAssetsChartData,
} from "@/lib/plan/chartData";
import { type NumberFormat, formatAmount } from "@/lib/settings/currency";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "styled-components";
import { makeAmountTick } from "./chartFormat";
import { NET_WORTH_COLOUR, WRAPPER_COLOURS } from "./colours";

// Drawdownable pots stacked over time, with a total line so depletion in
// retirement is legible. Same wrapper colours as the net-worth chart.
export function LiquidAssetsChart({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const theme = useTheme();
  const data = toLiquidAssetsChartData(years);
  const wrappers = liquidWrappersPresent(data);
  const amountTick = makeAmountTick(currency);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart
        data={data}
        margin={{ top: 16, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid stroke={theme.colors.hairline} vertical={false} />
        <XAxis
          dataKey="age"
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={{ stroke: theme.colors.hairline }}
        />
        <YAxis
          width={64}
          tick={{ fontSize: 11, fill: theme.colors.body }}
          tickLine={false}
          axisLine={false}
          tickFormatter={amountTick}
        />
        <Tooltip
          formatter={(value, name) => [
            formatAmount(currency, Number(value), numberFormat),
            name,
          ]}
          contentStyle={{
            border: `1px solid ${theme.colors.hairline}`,
            borderRadius: theme.rounded.sm,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {wrappers.map((w) => (
          <Bar
            key={w}
            dataKey={w}
            name={w}
            stackId="liquid"
            fill={WRAPPER_COLOURS[w]}
            isAnimationActive={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="total"
          name="Total liquid"
          stroke={NET_WORTH_COLOUR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/plan/LiquidAssetsChart.tsx
git commit -m "feat(plan): liquid-assets chart component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: ChartPanel switcher + wire into PlanView

**Files:**
- Create: `src/app/plan/ChartPanel.tsx`
- Modify: `src/app/plan/PlanView.tsx`

**Interfaces:**
- Consumes: `NetWorthChart` (existing), `CashFlowChart` (Task 4), `LiquidAssetsChart` (Task 5); `YearProjection`, `NumberFormat`.
- Produces: `function ChartPanel({ years, currency, numberFormat }: { years: YearProjection[]; currency: string; numberFormat: NumberFormat }): JSX.Element` — segmented control (three `<button>`s named "Net worth", "Cash flow", "Liquid assets"), default Net worth, renders the selected chart.

- [ ] **Step 1: Create the ChartPanel**

Create `src/app/plan/ChartPanel.tsx`:

```tsx
// src/app/plan/ChartPanel.tsx
"use client";

import type { YearProjection } from "@/lib/plan";
import type { NumberFormat } from "@/lib/settings/currency";
import { useState } from "react";
import styled from "styled-components";
import { CashFlowChart } from "./CashFlowChart";
import { LiquidAssetsChart } from "./LiquidAssetsChart";
import { NetWorthChart } from "./NetWorthChart";

type View = "networth" | "cashflow" | "liquid";

const VIEWS: { id: View; label: string }[] = [
  { id: "networth", label: "Net worth" },
  { id: "cashflow", label: "Cash flow" },
  { id: "liquid", label: "Liquid assets" },
];

const Panel = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Switcher = styled.div`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  padding: ${({ theme }) => theme.spacing.xs};
  width: fit-content;
`;
const Tab = styled.button<{ $active: boolean }>`
  border: 0;
  cursor: pointer;
  font-size: 13px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.rounded.sm};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.ink : "transparent"};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.canvas : theme.colors.body};
`;

export function ChartPanel({
  years,
  currency,
  numberFormat,
}: {
  years: YearProjection[];
  currency: string;
  numberFormat: NumberFormat;
}) {
  const [view, setView] = useState<View>("networth");

  return (
    <Panel>
      <Switcher role="tablist">
        {VIEWS.map((v) => (
          <Tab
            key={v.id}
            type="button"
            $active={view === v.id}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </Tab>
        ))}
      </Switcher>
      {view === "networth" && (
        <NetWorthChart
          years={years}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
      {view === "cashflow" && (
        <CashFlowChart
          years={years}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
      {view === "liquid" && (
        <LiquidAssetsChart
          years={years}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
    </Panel>
  );
}
```

Note: the active tab is white text (`theme.colors.canvas` = `#FFFFFF`) on the ink background (`theme.colors.ink`). Both tokens are confirmed present in `src/lib/theme.ts`.

- [ ] **Step 2: Wire ChartPanel into PlanView**

In `src/app/plan/PlanView.tsx`:

1. Replace the import of `NetWorthChart` with `ChartPanel`:

```ts
import { ChartPanel } from "./ChartPanel";
```

(remove `import { NetWorthChart } from "./NetWorthChart";`)

2. Replace the `<NetWorthChart … />` element:

```tsx
      <NetWorthChart
        years={years}
        currency={currency}
        numberFormat={numberFormat}
      />
```

with:

```tsx
      <ChartPanel
        years={years}
        currency={currency}
        numberFormat={numberFormat}
      />
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors (NetWorthChart is still imported by ChartPanel, so it is not orphaned).

- [ ] **Step 4: Commit**

```bash
git add src/app/plan/ChartPanel.tsx src/app/plan/PlanView.tsx
git commit -m "feat(plan): chart view switcher (net worth / cash flow / liquid assets)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: E2E switcher coverage

**Files:**
- Modify: `e2e/plan.spec.ts`

**Interfaces:**
- Consumes: the wired `/plan` page (Task 6). The existing test seeds a plan with a SIPP asset (wrapper edited to PENSION) and a SALARY income, no expenses, no liabilities.

- [ ] **Step 1: Extend the existing test with switcher steps**

In `e2e/plan.spec.ts`, insert the following **before** the final `await page.screenshot(...)` line (after the assumption-edit assertions). It exercises all three views and screenshots each:

```ts
  // View switcher: Net worth (default) → Cash flow → Liquid assets.
  // Seeded plan has a SALARY income (cash-flow income bar) and a PENSION pot
  // (after the wrapper edit above), so each view has a distinctive legend entry.
  await expect(
    page.getByRole("button", { name: "Net worth" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cash flow" }).click();
  await expect(page.locator(".recharts-legend-wrapper")).toContainText(
    "SALARY",
  );
  await page.screenshot({
    path: "test-results/plan-2b-cashflow.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Liquid assets" }).click();
  await expect(page.locator(".recharts-legend-wrapper")).toContainText(
    "PENSION",
  );
  await page.screenshot({
    path: "test-results/plan-2b-liquid.png",
    fullPage: true,
  });
```

Keep the existing final net-worth screenshot line as-is (rename optional).

- [ ] **Step 2: Run the e2e test (local, system Chrome)**

Run: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"`
Expected: PASS — the test creates the plan, edits, exercises the switcher, and the cash-flow legend shows `SALARY`, the liquid legend shows `PENSION`. (If the local Playwright browsers are installed, plain `make test-e2e name="plan:"` also works.)

- [ ] **Step 3: Commit**

```bash
git add e2e/plan.spec.ts
git commit -m "test(e2e): exercise the /plan chart view switcher

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `pnpm verify` (typecheck + biome ci + unit tests) passes.
- [ ] `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome make test-e2e name="plan:"` passes.
- [ ] Live browser check (verify skill): on `/plan`, switch between all three views; confirm the cash-flow chart diverges about zero with a net line + red shortfall dots, and the liquid-assets chart shows pots depleting. Capture a screenshot of each.

## Notes / known limitations (from spec §3.1)

- One-off events (`EventInput`) are **not** represented in the cash-flow chart — `YearProjection` does not surface per-year event flows. Non-issue today (events are not user-creatable yet); revisit when events CRUD lands by adding an event-flow field to `YearProjection`.
