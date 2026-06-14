# Life Planning — Phase 0: Projection Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, deterministic, fully-tested lifetime cashflow projection engine in `src/lib/plan/` — no UI, no Prisma, no I/O.

**Architecture:** Small pure modules composed by a single `project(input)` year loop (the "waterfall" from the design spec §5). Helpers (`helpers`, `tax`, `streams`, `assets`, `liabilities`, `verdict`) are each built and unit-tested in isolation, then assembled in `project.ts`. Being pure means the identical code later runs client-side for Phase 3 live sliders.

**Tech Stack:** TypeScript, Jest (unit tests, `src/` only). No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-06-14-life-planning-forecast-design.md`](../specs/2026-06-14-life-planning-forecast-design.md) §5, §7, §9.

**Deviations from spec (intentional, YAGNI):**
- Engine `AssetInput` omits `monthlyContribution` — explicit per-asset contributions are Phase 2; v1 routes all positive surplus to a single destination asset.
- `PlanInput` adds `startYear: number` so `YearProjection.year` is emitted purely (the spec's age-only contract + a calendar base). Update spec §7 to match (done as final step).

**Conventions:**
- All money is plain `number` (pounds); outputs rounded to whole pounds.
- Run a single test file with: `pnpm test src/lib/plan/<file>.test.ts`
- Commit after every green task.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/plan/types.ts` | All contract types + the `WRAPPERS` constant. No logic. |
| `src/lib/plan/helpers.ts` | Tiny pure maths: `round`, `grow`, `amountThisYear`, `isActive`. |
| `src/lib/plan/tax.ts` | `blendedRateTax(ratePct)` → `TaxFn` (the swappable seam, stub impl). |
| `src/lib/plan/streams.ts` | `activeIncome(...)`, `activeExpenses(...)` — per-year stream amounts. |
| `src/lib/plan/assets.ts` | `contributionTargetId(...)`, `drawDown(...)` — surplus/deficit asset ops. |
| `src/lib/plan/liabilities.ts` | `liabilityStep(...)` — annual interest accrual + repayment. |
| `src/lib/plan/verdict.ts` | `summarise(years)` — feasibility, first shortfall, peak net worth. |
| `src/lib/plan/project.ts` | `project(input)` waterfall loop + `earliestSustainableRetirementAge(input)`. |
| `src/lib/plan/index.ts` | Public barrel: re-export `project`, `blendedRateTax`, types. |

---

## Task 1: Types

**Files:**
- Create: `src/lib/plan/types.ts`

- [ ] **Step 1: Write the types module**

```ts
// src/lib/plan/types.ts

export type Wrapper =
  | "PENSION" | "ISA" | "GIA" | "CASH" | "PROPERTY" | "DB_PENSION" | "OTHER";

export const WRAPPERS: Wrapper[] = [
  "PENSION", "ISA", "GIA", "CASH", "PROPERTY", "DB_PENSION", "OTHER",
];

export type IncomeKind =
  | "SALARY" | "SELF_EMPLOYMENT" | "STATE_PENSION" | "DB_PENSION" | "RENTAL" | "OTHER";

export type ExpenseCategory = "FIXED" | "VARIABLE" | "DISCRETIONARY";

export type Growth =
  | { kind: "INFLATION" }
  | { kind: "FIXED"; pct: number }
  | { kind: "NONE" };

export interface AssetInput {
  id: string;
  label: string;
  wrapper: Wrapper;
  openingValue: number;
  expectedReturnPct?: number; // undefined ⇒ PlanInput.defaultReturnPct
  drawdownPriority: number; // ascending = drawn first
}

export interface LiabilityInput {
  id: string;
  label: string;
  openingBalance: number;
  interestPct: number;
  monthlyRepayment: number;
  endAge?: number;
  linkedAssetId?: string;
}

export interface IncomeInput {
  id: string;
  label: string;
  kind: IncomeKind;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  growth: Growth;
  taxable: boolean;
}

export interface ExpenseInput {
  id: string;
  label: string;
  category?: ExpenseCategory;
  annualAmount: number;
  startAge?: number;
  endAge?: number;
  inflationLinked: boolean;
}

export interface EventInput {
  id: string;
  label: string;
  age: number;
  direction: "INFLOW" | "OUTFLOW";
  amount: number;
}

export interface TaxContext {
  age: number;
  taxableIncomeByKind: Partial<Record<IncomeKind, number>>;
  pensionWithdrawal: number;
  isaWithdrawal: number;
  giaWithdrawal: number;
  retired: boolean;
}

export type TaxFn = (ctx: TaxContext) => number;

export interface PlanInput {
  currentAge: number;
  startYear: number; // calendar year of currentAge
  retirementAge: number;
  planToAge: number;
  inflationPct: number;
  defaultReturnPct: number;
  statePension?: { startAge: number; annualAmount: number };
  assets: AssetInput[];
  liabilities: LiabilityInput[];
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  events: EventInput[];
  tax: TaxFn;
}

export interface YearProjection {
  age: number;
  year: number;
  grossIncome: number;
  tax: number;
  netIncome: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  liabilityRepayments: number;
  surplus: number;
  contributions: number;
  withdrawals: number;
  assetsByWrapper: Record<Wrapper, number>;
  liabilitiesTotal: number;
  netWorth: number;
  shortfall: boolean;
}

export interface Verdict {
  feasible: boolean;
  firstShortfallAge: number | null;
  peakNetWorth: { age: number; value: number };
  earliestSustainableRetirementAge: number | null;
}

export interface PlanProjection {
  years: YearProjection[];
  verdict: Verdict;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/plan/types.ts
git commit -m "feat(plan): add projection engine contract types"
```

---

## Task 2: Maths helpers

**Files:**
- Create: `src/lib/plan/helpers.ts`
- Test: `src/lib/plan/helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/helpers.test.ts
import { amountThisYear, grow, isActive, round } from "./helpers";

describe("plan helpers", () => {
  it("round → nearest whole pound", () => {
    expect(round(100.4)).toBe(100);
    expect(round(100.5)).toBe(101);
  });

  it("grow → applies a percentage", () => {
    expect(grow(10000, 10)).toBeCloseTo(11000);
    expect(grow(10000, 0)).toBe(10000);
  });

  it("amountThisYear → compounds growth over elapsed years", () => {
    expect(amountThisYear(1000, 0, 5)).toBeCloseTo(1000);
    expect(amountThisYear(1000, 10, 1)).toBeCloseTo(1100);
    expect(amountThisYear(1000, 10, 2)).toBeCloseTo(1210);
  });

  it("isActive → respects optional start/end age bounds", () => {
    expect(isActive(40)).toBe(true); // no bounds
    expect(isActive(40, 41)).toBe(false); // before start
    expect(isActive(41, 41)).toBe(true); // at start
    expect(isActive(50, 41, 49)).toBe(false); // after end
    expect(isActive(45, 41, 49)).toBe(true); // within
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/helpers.test.ts`
Expected: FAIL — cannot find module `./helpers`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/plan/helpers.ts

export const round = (n: number): number => Math.round(n);

export const grow = (value: number, pct: number): number => value * (1 + pct / 100);

export const amountThisYear = (
  base: number,
  growthPct: number,
  yearsElapsed: number,
): number => base * (1 + growthPct / 100) ** yearsElapsed;

export const isActive = (age: number, startAge?: number, endAge?: number): boolean =>
  (startAge === undefined || age >= startAge) && (endAge === undefined || age <= endAge);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/helpers.ts src/lib/plan/helpers.test.ts
git commit -m "feat(plan): add maths helpers (round, grow, amountThisYear, isActive)"
```

---

## Task 3: Tax seam (blended-rate stub)

**Files:**
- Create: `src/lib/plan/tax.ts`
- Test: `src/lib/plan/tax.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/tax.test.ts
import { blendedRateTax } from "./tax";
import type { TaxContext } from "./types";

const ctx = (over: Partial<TaxContext> = {}): TaxContext => ({
  age: 45,
  taxableIncomeByKind: {},
  pensionWithdrawal: 0,
  isaWithdrawal: 0,
  giaWithdrawal: 0,
  retired: false,
  ...over,
});

describe("blendedRateTax", () => {
  it("taxes summed taxable income at the blended rate", () => {
    const tax = blendedRateTax(20);
    expect(tax(ctx({ taxableIncomeByKind: { SALARY: 50000 } }))).toBe(10000);
  });

  it("sums across income kinds", () => {
    const tax = blendedRateTax(25);
    expect(tax(ctx({ taxableIncomeByKind: { SALARY: 40000, RENTAL: 10000 } }))).toBe(12500);
  });

  it("is zero when there is no taxable income", () => {
    expect(blendedRateTax(40)(ctx())).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/tax.test.ts`
Expected: FAIL — cannot find module `./tax`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/plan/tax.ts
import { round } from "./helpers";
import type { TaxFn } from "./types";

// Phase-0 stub: a single blended effective rate on total taxable income.
// Phase 4 swaps in a UK-simplified TaxFn (bands, allowances, pension relief,
// 25% tax-free lump sum, state pension) with NO change to the engine — the
// withdrawal fields on TaxContext exist for that future implementation.
export const blendedRateTax =
  (ratePct: number): TaxFn =>
  (ctx) => {
    const taxable = Object.values(ctx.taxableIncomeByKind).reduce(
      (sum, v) => sum + (v ?? 0),
      0,
    );
    return round((taxable * ratePct) / 100);
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/tax.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/tax.ts src/lib/plan/tax.test.ts
git commit -m "feat(plan): add blended-rate tax stub behind the TaxFn seam"
```

---

## Task 4: Income streams

**Files:**
- Create: `src/lib/plan/streams.ts`
- Test: `src/lib/plan/streams.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/streams.test.ts
import { activeIncome } from "./streams";
import type { IncomeInput } from "./types";

const salary: IncomeInput = {
  id: "s", label: "Salary", kind: "SALARY",
  annualAmount: 50000, startAge: undefined, endAge: 64,
  growth: { kind: "NONE" }, taxable: true,
};

describe("activeIncome", () => {
  it("includes an active salary in gross and taxable", () => {
    const r = activeIncome([salary], undefined, 40, 0, 2.5);
    expect(r.gross).toBe(50000);
    expect(r.taxableByKind.SALARY).toBe(50000);
  });

  it("excludes a stream past its endAge", () => {
    const r = activeIncome([salary], undefined, 65, 25, 2.5);
    expect(r.gross).toBe(0);
  });

  it("grows an inflation-linked stream over elapsed years", () => {
    const pension: IncomeInput = {
      id: "p", label: "DB", kind: "DB_PENSION", annualAmount: 10000,
      startAge: 60, growth: { kind: "INFLATION" }, taxable: true,
    };
    const r = activeIncome([pension], undefined, 62, 22, 10); // 10% inflation, 22y elapsed
    // 10000 * 1.1^22
    expect(r.gross).toBeCloseTo(10000 * 1.1 ** 22, 0);
  });

  it("grows a fixed-growth stream by its own rate", () => {
    const rent: IncomeInput = {
      id: "r", label: "Rent", kind: "RENTAL", annualAmount: 12000,
      growth: { kind: "FIXED", pct: 3 }, taxable: true,
    };
    const r = activeIncome([rent], undefined, 42, 2, 2.5);
    expect(r.gross).toBeCloseTo(12000 * 1.03 ** 2, 0);
  });

  it("adds the state pension as a STATE_PENSION stream from its start age", () => {
    const before = activeIncome([], { startAge: 67, annualAmount: 11000 }, 66, 26, 0);
    const after = activeIncome([], { startAge: 67, annualAmount: 11000 }, 67, 27, 0);
    expect(before.gross).toBe(0);
    expect(after.taxableByKind.STATE_PENSION).toBe(11000);
  });

  it("keeps non-taxable income out of taxableByKind but in gross", () => {
    const taxFree: IncomeInput = {
      id: "t", label: "Tax-free", kind: "OTHER", annualAmount: 5000,
      growth: { kind: "NONE" }, taxable: false,
    };
    const r = activeIncome([taxFree], undefined, 40, 0, 2.5);
    expect(r.gross).toBe(5000);
    expect(r.taxableByKind.OTHER ?? 0).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/streams.test.ts`
Expected: FAIL — cannot find module `./streams`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/plan/streams.ts
import { amountThisYear, isActive } from "./helpers";
import type { Growth, IncomeInput, IncomeKind } from "./types";

const growthPctOf = (growth: Growth, inflationPct: number): number => {
  if (growth.kind === "INFLATION") return inflationPct;
  if (growth.kind === "FIXED") return growth.pct;
  return 0;
};

export interface IncomeResult {
  gross: number;
  taxableByKind: Partial<Record<IncomeKind, number>>;
}

export const activeIncome = (
  incomes: IncomeInput[],
  statePension: { startAge: number; annualAmount: number } | undefined,
  age: number,
  yearsElapsed: number,
  inflationPct: number,
): IncomeResult => {
  const result: IncomeResult = { gross: 0, taxableByKind: {} };

  const add = (kind: IncomeKind, amount: number, taxable: boolean) => {
    result.gross += amount;
    if (taxable) {
      result.taxableByKind[kind] = (result.taxableByKind[kind] ?? 0) + amount;
    }
  };

  for (const income of incomes) {
    if (!isActive(age, income.startAge, income.endAge)) continue;
    const amount = amountThisYear(
      income.annualAmount,
      growthPctOf(income.growth, inflationPct),
      yearsElapsed,
    );
    add(income.kind, amount, income.taxable);
  }

  if (statePension && age >= statePension.startAge) {
    const amount = amountThisYear(statePension.annualAmount, inflationPct, yearsElapsed);
    add("STATE_PENSION", amount, true);
  }

  return result;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/streams.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/streams.ts src/lib/plan/streams.test.ts
git commit -m "feat(plan): add activeIncome (age windows, growth, state pension)"
```

---

## Task 5: Expense streams

**Files:**
- Modify: `src/lib/plan/streams.ts`
- Modify: `src/lib/plan/streams.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `src/lib/plan/streams.test.ts`:

```ts
import { activeExpenses } from "./streams";
import type { ExpenseInput } from "./types";

describe("activeExpenses", () => {
  const living: ExpenseInput = {
    id: "l", label: "Living", category: "FIXED",
    annualAmount: 24000, inflationLinked: true,
  };

  it("totals active expenses and groups by category", () => {
    const r = activeExpenses([living], 40, 0, 2.5);
    expect(r.total).toBe(24000);
    expect(r.byCategory.FIXED).toBe(24000);
  });

  it("inflates inflation-linked expenses over elapsed years", () => {
    const r = activeExpenses([living], 50, 10, 10); // 10% inflation, 10y
    expect(r.total).toBeCloseTo(24000 * 1.1 ** 10, 0);
  });

  it("does not inflate when inflationLinked is false", () => {
    const flat: ExpenseInput = { ...living, id: "f", inflationLinked: false };
    const r = activeExpenses([flat], 50, 10, 10);
    expect(r.total).toBe(24000);
  });

  it("excludes expenses outside their age window (e.g. kids' university)", () => {
    const uni: ExpenseInput = {
      id: "u", label: "University", category: "DISCRETIONARY",
      annualAmount: 13000, startAge: 54, endAge: 60, inflationLinked: true,
    };
    expect(activeExpenses([uni], 53, 13, 0).total).toBe(0);
    expect(activeExpenses([uni], 54, 14, 0).total).toBe(13000);
    expect(activeExpenses([uni], 61, 21, 0).total).toBe(0);
  });

  it("buckets uncategorised expenses under UNCATEGORISED", () => {
    const misc: ExpenseInput = {
      id: "m", label: "Misc", annualAmount: 1000, inflationLinked: false,
    };
    const r = activeExpenses([misc], 40, 0, 2.5);
    expect(r.byCategory.UNCATEGORISED).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/streams.test.ts`
Expected: FAIL — `activeExpenses` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `src/lib/plan/streams.ts`:

```ts
import type { ExpenseInput } from "./types";

export interface ExpenseResult {
  total: number;
  byCategory: Record<string, number>;
}

export const activeExpenses = (
  expenses: ExpenseInput[],
  age: number,
  yearsElapsed: number,
  inflationPct: number,
): ExpenseResult => {
  const result: ExpenseResult = { total: 0, byCategory: {} };

  for (const expense of expenses) {
    if (!isActive(age, expense.startAge, expense.endAge)) continue;
    const amount = expense.inflationLinked
      ? amountThisYear(expense.annualAmount, inflationPct, yearsElapsed)
      : expense.annualAmount;
    const key = expense.category ?? "UNCATEGORISED";
    result.byCategory[key] = (result.byCategory[key] ?? 0) + amount;
    result.total += amount;
  }

  return result;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/streams.test.ts`
Expected: PASS (all income + expense tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/streams.ts src/lib/plan/streams.test.ts
git commit -m "feat(plan): add activeExpenses (inflation, age windows, categories)"
```

---

## Task 6: Asset operations (contribution target + drawdown)

**Files:**
- Create: `src/lib/plan/assets.ts`
- Test: `src/lib/plan/assets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/assets.test.ts
import { contributionTargetId, drawDown } from "./assets";
import type { AssetInput } from "./types";

const asset = (over: Partial<AssetInput> & { id: string }): AssetInput => ({
  label: over.id, wrapper: "GIA", openingValue: 0, drawdownPriority: 0, ...over,
});

describe("contributionTargetId", () => {
  it("picks the highest-drawdownPriority non-PROPERTY asset (long-term pot)", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "pension", wrapper: "PENSION", drawdownPriority: 3 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 9 }),
    ];
    expect(contributionTargetId(assets)).toBe("pension");
  });

  it("falls back to the first asset when all are PROPERTY", () => {
    const assets = [asset({ id: "house", wrapper: "PROPERTY" })];
    expect(contributionTargetId(assets)).toBe("house");
  });

  it("returns null when there are no assets", () => {
    expect(contributionTargetId([])).toBeNull();
  });
});

describe("drawDown", () => {
  it("draws in ascending drawdownPriority and skips PROPERTY", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 2 }),
    ];
    const balances = { cash: 5000, isa: 10000, house: 300000 };
    const r = drawDown(assets, balances, 7000);
    expect(r.withdrawn).toBe(7000);
    expect(r.shortfall).toBe(false);
    expect(r.balances.cash).toBe(0);
    expect(r.balances.isa).toBe(8000);
    expect(r.balances.house).toBe(300000); // untouched
  });

  it("flags a shortfall when liquid assets are exhausted", () => {
    const assets = [asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 })];
    const r = drawDown(assets, { cash: 3000 }, 5000);
    expect(r.withdrawn).toBe(3000);
    expect(r.shortfall).toBe(true);
    expect(r.balances.cash).toBe(0);
  });

  it("does not mutate the input balances", () => {
    const assets = [asset({ id: "cash", wrapper: "CASH" })];
    const balances = { cash: 1000 };
    drawDown(assets, balances, 500);
    expect(balances.cash).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/assets.test.ts`
Expected: FAIL — cannot find module `./assets`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/plan/assets.ts
import type { AssetInput } from "./types";

const drawable = (a: AssetInput): boolean => a.wrapper !== "PROPERTY";

// Where positive surplus goes: the non-PROPERTY asset drawn LAST (highest
// drawdownPriority = the long-term growth pot). Falls back to the first asset
// so surplus is never silently lost; null only when there are no assets.
export const contributionTargetId = (assets: AssetInput[]): string | null => {
  if (assets.length === 0) return null;
  const liquid = assets.filter(drawable);
  if (liquid.length === 0) return assets[0].id;
  return liquid.reduce((best, a) =>
    a.drawdownPriority > best.drawdownPriority ? a : best,
  ).id;
};

export interface DrawResult {
  balances: Record<string, number>;
  withdrawn: number;
  shortfall: boolean;
}

// Draws `amount` from non-PROPERTY assets in ascending drawdownPriority order.
// Returns new balances (input untouched), the total withdrawn, and whether the
// liquid assets ran out before the need was met (a shortfall).
export const drawDown = (
  assets: AssetInput[],
  balances: Record<string, number>,
  amount: number,
): DrawResult => {
  const next = { ...balances };
  let remaining = amount;

  const order = assets
    .filter(drawable)
    .sort((a, b) => a.drawdownPriority - b.drawdownPriority);

  for (const a of order) {
    if (remaining <= 0) break;
    const available = next[a.id] ?? 0;
    const take = Math.min(available, remaining);
    next[a.id] = available - take;
    remaining -= take;
  }

  return { balances: next, withdrawn: amount - remaining, shortfall: remaining > 0 };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/assets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/assets.ts src/lib/plan/assets.test.ts
git commit -m "feat(plan): add asset ops (contribution target, property-aware drawdown)"
```

---

## Task 7: Liability step (interest + repayment)

**Files:**
- Create: `src/lib/plan/liabilities.ts`
- Test: `src/lib/plan/liabilities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/liabilities.test.ts
import { liabilityStep } from "./liabilities";
import type { LiabilityInput } from "./types";

const mortgage: LiabilityInput = {
  id: "m", label: "Mortgage", openingBalance: 100000,
  interestPct: 5, monthlyRepayment: 1000, // £12k/yr
};

describe("liabilityStep", () => {
  it("accrues interest then repays, returning the year's repayment", () => {
    const r = liabilityStep([mortgage], { m: 100000 }, 40);
    // 100000 * 1.05 = 105000, minus 12000 repaid
    expect(r.repaid).toBe(12000);
    expect(r.balances.m).toBeCloseTo(93000);
  });

  it("repays only down to zero in the final year and reports the smaller repayment", () => {
    const r = liabilityStep([mortgage], { m: 5000 }, 40);
    // 5000 * 1.05 = 5250; repayment capped at 5250, balance 0
    expect(r.balances.m).toBe(0);
    expect(r.repaid).toBeCloseTo(5250);
  });

  it("makes no repayment once the balance is zero", () => {
    const r = liabilityStep([mortgage], { m: 0 }, 40);
    expect(r.repaid).toBe(0);
    expect(r.balances.m).toBe(0);
  });

  it("stops repaying after endAge", () => {
    const bounded: LiabilityInput = { ...mortgage, endAge: 59 };
    const r = liabilityStep([bounded], { m: 50000 }, 60);
    expect(r.repaid).toBe(0);
    expect(r.balances.m).toBe(50000); // frozen (no accrual or repayment past endAge)
  });

  it("does not mutate the input balances", () => {
    const balances = { m: 100000 };
    liabilityStep([mortgage], balances, 40);
    expect(balances.m).toBe(100000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/liabilities.test.ts`
Expected: FAIL — cannot find module `./liabilities`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/plan/liabilities.ts
import { grow } from "./helpers";
import type { LiabilityInput } from "./types";

export interface LiabilityStepResult {
  balances: Record<string, number>;
  repaid: number;
}

// One year per liability: if active (balance > 0 and not past endAge), accrue
// interest then repay up to the annual repayment, capped so the balance floors
// at zero. Past endAge or at zero, the liability is inert.
export const liabilityStep = (
  liabilities: LiabilityInput[],
  balances: Record<string, number>,
  age: number,
): LiabilityStepResult => {
  const next = { ...balances };
  let repaid = 0;

  for (const l of liabilities) {
    const balance = next[l.id] ?? 0;
    const pastEnd = l.endAge !== undefined && age > l.endAge;
    if (balance <= 0 || pastEnd) continue;

    const afterInterest = grow(balance, l.interestPct);
    const payment = Math.min(l.monthlyRepayment * 12, afterInterest);
    next[l.id] = afterInterest - payment;
    repaid += payment;
  }

  return { balances: next, repaid };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/liabilities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/liabilities.ts src/lib/plan/liabilities.test.ts
git commit -m "feat(plan): add liabilityStep (interest accrual + capped repayment)"
```

---

## Task 8: Verdict summary

**Files:**
- Create: `src/lib/plan/verdict.ts`
- Test: `src/lib/plan/verdict.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/verdict.test.ts
import { summarise } from "./verdict";
import type { YearProjection } from "./types";

const year = (over: Partial<YearProjection> & { age: number }): YearProjection => ({
  year: 2000 + over.age,
  grossIncome: 0, tax: 0, netIncome: 0,
  expensesByCategory: {}, totalExpenses: 0, liabilityRepayments: 0,
  surplus: 0, contributions: 0, withdrawals: 0,
  assetsByWrapper: { PENSION: 0, ISA: 0, GIA: 0, CASH: 0, PROPERTY: 0, DB_PENSION: 0, OTHER: 0 },
  liabilitiesTotal: 0, netWorth: 0, shortfall: false, ...over,
});

describe("summarise", () => {
  it("is feasible with no shortfall and reports peak net worth", () => {
    const years = [
      year({ age: 60, netWorth: 100000 }),
      year({ age: 61, netWorth: 250000 }),
      year({ age: 62, netWorth: 180000 }),
    ];
    const v = summarise(years);
    expect(v.feasible).toBe(true);
    expect(v.firstShortfallAge).toBeNull();
    expect(v.peakNetWorth).toEqual({ age: 61, value: 250000 });
  });

  it("reports the first shortfall age and is not feasible", () => {
    const years = [
      year({ age: 88, netWorth: 20000 }),
      year({ age: 89, netWorth: 0, shortfall: true }),
      year({ age: 90, netWorth: 0, shortfall: true }),
    ];
    const v = summarise(years);
    expect(v.feasible).toBe(false);
    expect(v.firstShortfallAge).toBe(89);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/verdict.test.ts`
Expected: FAIL — cannot find module `./verdict`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/plan/verdict.ts
import type { Verdict, YearProjection } from "./types";

// Derives the headline verdict from a completed projection. The retirement-age
// solver lives in project.ts (it re-runs the projection), so this stays a pure
// summary over the produced years.
export const summarise = (
  years: YearProjection[],
): Omit<Verdict, "earliestSustainableRetirementAge"> => {
  const shortfallYear = years.find((y) => y.shortfall);
  const peak = years.reduce(
    (best, y) => (y.netWorth > best.value ? { age: y.age, value: y.netWorth } : best),
    { age: years[0]?.age ?? 0, value: Number.NEGATIVE_INFINITY },
  );

  return {
    feasible: shortfallYear === undefined,
    firstShortfallAge: shortfallYear?.age ?? null,
    peakNetWorth: peak,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/verdict.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/verdict.ts src/lib/plan/verdict.test.ts
git commit -m "feat(plan): add verdict summary (feasibility, first shortfall, peak)"
```

---

## Task 9: The projection loop

**Files:**
- Create: `src/lib/plan/project.ts`
- Test: `src/lib/plan/project.test.ts`

This assembles the helpers into the year-by-year waterfall (spec §5). Per-year order: gross income → tax → net → expenses → liabilities → combined cashflow (incl. events) → contribute (surplus) or draw down (deficit) → grow assets → record closing balances.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/project.test.ts
import { project } from "./project";
import { blendedRateTax } from "./tax";
import type { PlanInput } from "./types";

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  currentAge: 40, startYear: 2026, retirementAge: 65, planToAge: 41,
  inflationPct: 0, defaultReturnPct: 0,
  assets: [], liabilities: [], incomes: [], expenses: [], events: [],
  tax: blendedRateTax(0),
  ...over,
});

describe("project", () => {
  it("emits one row per year from currentAge to planToAge with calendar years", () => {
    const p = project(base({ currentAge: 40, planToAge: 42, startYear: 2026 }));
    expect(p.years.map((y) => y.age)).toEqual([40, 41, 42]);
    expect(p.years.map((y) => y.year)).toEqual([2026, 2027, 2028]);
  });

  it("grows an untouched asset by the default return (per-asset override wins)", () => {
    const p = project(
      base({
        planToAge: 40,
        defaultReturnPct: 10,
        assets: [
          { id: "a", label: "GIA", wrapper: "GIA", openingValue: 10000, drawdownPriority: 1 },
          { id: "b", label: "SIPP", wrapper: "PENSION", openingValue: 10000, expectedReturnPct: 0, drawdownPriority: 2 },
        ],
      }),
    );
    expect(p.years[0].assetsByWrapper.GIA).toBe(11000); // default 10%
    expect(p.years[0].assetsByWrapper.PENSION).toBe(10000); // override 0%
  });

  it("invests a surplus (net income − expenses) into the long-term pot", () => {
    const p = project(
      base({
        planToAge: 40,
        incomes: [{ id: "s", label: "Salary", kind: "SALARY", annualAmount: 50000, growth: { kind: "NONE" }, taxable: true }],
        expenses: [{ id: "e", label: "Living", annualAmount: 30000, inflationLinked: false }],
        tax: blendedRateTax(20), // tax = 10000
        assets: [
          { id: "cash", label: "Cash", wrapper: "CASH", openingValue: 0, drawdownPriority: 0 },
          { id: "sipp", label: "SIPP", wrapper: "PENSION", openingValue: 0, drawdownPriority: 5 },
        ],
      }),
    );
    // net 40000 − expenses 30000 = surplus 10000 → into PENSION (highest priority)
    expect(p.years[0].surplus).toBe(10000);
    expect(p.years[0].contributions).toBe(10000);
    expect(p.years[0].assetsByWrapper.PENSION).toBe(10000);
  });

  it("draws a deficit from liquid assets and flags shortfall when exhausted", () => {
    const p = project(
      base({
        planToAge: 40,
        expenses: [{ id: "e", label: "Living", annualAmount: 30000, inflationLinked: false }],
        assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 20000, drawdownPriority: 0 }],
      }),
    );
    expect(p.years[0].withdrawals).toBe(20000);
    expect(p.years[0].shortfall).toBe(true);
    expect(p.years[0].assetsByWrapper.CASH).toBe(0);
  });

  it("applies a one-off inflow event in the year it lands", () => {
    const p = project(
      base({
        currentAge: 40, planToAge: 41,
        assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 0, drawdownPriority: 0 }],
        events: [{ id: "inh", label: "Inheritance", age: 41, direction: "INFLOW", amount: 50000 }],
      }),
    );
    expect(p.years[0].assetsByWrapper.CASH).toBe(0);
    expect(p.years[1].assetsByWrapper.CASH).toBe(50000);
  });

  it("reduces net worth by an outstanding liability", () => {
    const p = project(
      base({
        planToAge: 40,
        assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 100000, drawdownPriority: 0 }],
        liabilities: [{ id: "m", label: "Mortgage", openingBalance: 60000, interestPct: 0, monthlyRepayment: 0 }],
      }),
    );
    expect(p.years[0].liabilitiesTotal).toBe(60000);
    expect(p.years[0].netWorth).toBe(40000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/project.test.ts`
Expected: FAIL — cannot find module `./project`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/plan/project.ts
import { contributionTargetId, drawDown } from "./assets";
import { grow, round } from "./helpers";
import { liabilityStep } from "./liabilities";
import { activeExpenses, activeIncome } from "./streams";
import {
  type AssetInput,
  type PlanInput,
  type PlanProjection,
  type Wrapper,
  WRAPPERS,
  type YearProjection,
} from "./types";
import { summarise } from "./verdict";

const emptyByWrapper = (): Record<Wrapper, number> =>
  WRAPPERS.reduce(
    (acc, w) => {
      acc[w] = 0;
      return acc;
    },
    {} as Record<Wrapper, number>,
  );

const sumByWrapper = (
  assets: AssetInput[],
  balances: Record<string, number>,
): Record<Wrapper, number> => {
  const out = emptyByWrapper();
  for (const a of assets) out[a.wrapper] += round(balances[a.id] ?? 0);
  return out;
};

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

export const project = (input: PlanInput): PlanProjection => {
  const assetBal: Record<string, number> = {};
  for (const a of input.assets) assetBal[a.id] = a.openingValue;
  const liabBal: Record<string, number> = {};
  for (const l of input.liabilities) liabBal[l.id] = l.openingBalance;

  const years: YearProjection[] = [];

  for (let age = input.currentAge; age <= input.planToAge; age++) {
    const yearsElapsed = age - input.currentAge;

    const income = activeIncome(
      input.incomes,
      input.statePension,
      age,
      yearsElapsed,
      input.inflationPct,
    );
    const tax = input.tax({
      age,
      taxableIncomeByKind: income.taxableByKind,
      pensionWithdrawal: 0,
      isaWithdrawal: 0,
      giaWithdrawal: 0,
      retired: age >= input.retirementAge,
    });
    const netIncome = income.gross - tax;

    const expenses = activeExpenses(input.expenses, age, yearsElapsed, input.inflationPct);

    const liab = liabilityStep(input.liabilities, liabBal, age);
    Object.assign(liabBal, liab.balances);

    const eventsNet = sum(
      input.events
        .filter((e) => e.age === age)
        .map((e) => (e.direction === "INFLOW" ? e.amount : -e.amount)),
    );

    const cashflow = netIncome - expenses.total - liab.repaid + eventsNet;

    let contributions = 0;
    let withdrawals = 0;
    let shortfall = false;

    if (cashflow >= 0) {
      contributions = cashflow;
      const targetId = contributionTargetId(input.assets);
      if (targetId) assetBal[targetId] = (assetBal[targetId] ?? 0) + cashflow;
    } else {
      const draw = drawDown(input.assets, assetBal, -cashflow);
      Object.assign(assetBal, draw.balances);
      withdrawals = draw.withdrawn;
      shortfall = draw.shortfall;
    }

    // End-of-year growth on resulting balances.
    for (const a of input.assets) {
      assetBal[a.id] = grow(assetBal[a.id] ?? 0, a.expectedReturnPct ?? input.defaultReturnPct);
    }

    const assetsByWrapper = sumByWrapper(input.assets, assetBal);
    const liabilitiesTotal = round(sum(Object.values(liabBal)));
    const netWorth = sum(Object.values(assetsByWrapper)) - liabilitiesTotal;

    const expensesByCategory: Record<string, number> = {};
    for (const [k, v] of Object.entries(expenses.byCategory)) expensesByCategory[k] = round(v);

    years.push({
      age,
      year: input.startYear + yearsElapsed,
      grossIncome: round(income.gross),
      tax: round(tax),
      netIncome: round(netIncome),
      expensesByCategory,
      totalExpenses: round(expenses.total),
      liabilityRepayments: round(liab.repaid),
      surplus: round(cashflow),
      contributions: round(contributions),
      withdrawals: round(withdrawals),
      assetsByWrapper,
      liabilitiesTotal,
      netWorth: round(netWorth),
      shortfall,
    });
  }

  return {
    years,
    verdict: { ...summarise(years), earliestSustainableRetirementAge: null },
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/plan/project.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/project.ts src/lib/plan/project.test.ts
git commit -m "feat(plan): add the year-by-year projection waterfall"
```

---

## Task 10: Earliest-sustainable-retirement-age solver

**Files:**
- Modify: `src/lib/plan/project.ts`
- Modify: `src/lib/plan/project.test.ts`

The solver answers "when *can* I retire?" by re-running the projection with employment income (SALARY / SELF_EMPLOYMENT) ending at each candidate age, returning the earliest age the plan stays feasible.

- [ ] **Step 1: Add the failing test**

Append to `src/lib/plan/project.test.ts`:

```ts
import { earliestSustainableRetirementAge } from "./project";

describe("earliestSustainableRetirementAge", () => {
  it("finds the earliest age at which stopping salary keeps the plan feasible", () => {
    // £40k salary, £20k spend, a pot that must cover the gap to planToAge.
    const input = base({
      currentAge: 60, startYear: 2026, planToAge: 65, retirementAge: 65,
      incomes: [{ id: "s", label: "Salary", kind: "SALARY", annualAmount: 40000, growth: { kind: "NONE" }, taxable: false }],
      expenses: [{ id: "e", label: "Living", annualAmount: 20000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 40000, drawdownPriority: 0 }],
    });
    // Retiring at 60 needs 20k/yr for 6 yrs = 120k but only 40k saved → not feasible.
    // Working longer adds 20k surplus/yr; by some age the pot + remaining years balance out.
    const age = earliestSustainableRetirementAge(input);
    expect(age).not.toBeNull();
    expect(age).toBeGreaterThanOrEqual(63);
    expect(age).toBeLessThanOrEqual(65);
  });

  it("returns currentAge when already feasible with no work", () => {
    const input = base({
      currentAge: 60, planToAge: 62,
      expenses: [{ id: "e", label: "Living", annualAmount: 10000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 1000000, drawdownPriority: 0 }],
    });
    expect(earliestSustainableRetirementAge(input)).toBe(60);
  });

  it("returns null when no retirement age in range is feasible", () => {
    const input = base({
      currentAge: 60, planToAge: 90,
      expenses: [{ id: "e", label: "Living", annualAmount: 50000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 1000, drawdownPriority: 0 }],
    });
    expect(earliestSustainableRetirementAge(input)).toBeNull();
  });

  it("is wired into project()'s verdict", () => {
    const input = base({
      currentAge: 60, planToAge: 62,
      expenses: [{ id: "e", label: "Living", annualAmount: 10000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 1000000, drawdownPriority: 0 }],
    });
    expect(project(input).verdict.earliestSustainableRetirementAge).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/plan/project.test.ts`
Expected: FAIL — `earliestSustainableRetirementAge` is not exported (and the verdict wiring assertion fails).

- [ ] **Step 3: Update the implementation**

In `src/lib/plan/project.ts`, add `IncomeInput` to the type import from `./types`, then add the solver and wire it into the verdict.

Add to the imports:

```ts
import {
  type AssetInput,
  type IncomeInput,
  type PlanInput,
  type PlanProjection,
  type Wrapper,
  WRAPPERS,
  type YearProjection,
} from "./types";
```

Add the exported solver (above or below `project`):

```ts
const EMPLOYMENT: IncomeInput["kind"][] = ["SALARY", "SELF_EMPLOYMENT"];

// Re-runs the projection with employment income ending at each candidate age,
// from currentAge up to planToAge, returning the earliest age that keeps the
// plan feasible (or null if none does).
export const earliestSustainableRetirementAge = (input: PlanInput): number | null => {
  for (let candidate = input.currentAge; candidate <= input.planToAge; candidate++) {
    const incomes = input.incomes.map((i) =>
      EMPLOYMENT.includes(i.kind)
        ? { ...i, endAge: Math.min(i.endAge ?? candidate, candidate) }
        : i,
    );
    const trial = project({ ...input, retirementAge: candidate, incomes });
    if (trial.verdict.feasible) return candidate;
  }
  return null;
};
```

Then replace the `return` at the end of `project` so the verdict includes the solved age:

```ts
  const verdict = {
    ...summarise(years),
    earliestSustainableRetirementAge: earliestSustainableRetirementAge(input),
  };
  return { years, verdict };
```

> Note: `earliestSustainableRetirementAge` calls `project`, and `project` calls the solver — but the solver always calls `project` with mutated `incomes`, and the trial projections do not recurse into the solver because... they do. **To avoid infinite recursion**, the trial inside the solver must use a projection that does **not** re-run the solver. Implement that by extracting a private `projectYears(input): YearProjection[]` used by both, and only computing the solver in the public `project`. See Step 3b.

- [ ] **Step 3b: Break the recursion cleanly**

Refactor so the year loop is a private function and the solver uses it directly:

```ts
// Rename the existing loop body: extract everything that builds `years` into:
const projectYears = (input: PlanInput): YearProjection[] => {
  // ... the entire for-loop from Task 9 that builds and returns `years` ...
  return years;
};

export const earliestSustainableRetirementAge = (input: PlanInput): number | null => {
  for (let candidate = input.currentAge; candidate <= input.planToAge; candidate++) {
    const incomes = input.incomes.map((i) =>
      EMPLOYMENT.includes(i.kind)
        ? { ...i, endAge: Math.min(i.endAge ?? candidate, candidate) }
        : i,
    );
    const years = projectYears({ ...input, retirementAge: candidate, incomes });
    if (summarise(years).feasible) return candidate;
  }
  return null;
};

export const project = (input: PlanInput): PlanProjection => {
  const years = projectYears(input);
  return {
    years,
    verdict: {
      ...summarise(years),
      earliestSustainableRetirementAge: earliestSustainableRetirementAge(input),
    },
  };
};
```

`projectYears` contains the body written in Task 9 (the `assetBal`/`liabBal` init + the `for` loop that pushes to `years`), returning `years`. Neither `projectYears` nor `summarise` calls the solver, so there is no recursion.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/plan/project.test.ts`
Expected: PASS (Task 9 + Task 10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/project.ts src/lib/plan/project.test.ts
git commit -m "feat(plan): add earliest-sustainable-retirement-age solver"
```

---

## Task 11: Public barrel + realistic integration test

**Files:**
- Create: `src/lib/plan/index.ts`
- Test: `src/lib/plan/engine.integration.test.ts`

- [ ] **Step 1: Write the barrel**

```ts
// src/lib/plan/index.ts
export { project, earliestSustainableRetirementAge } from "./project";
export { blendedRateTax } from "./tax";
export type {
  AssetInput, EventInput, ExpenseInput, IncomeInput, LiabilityInput,
  PlanInput, PlanProjection, TaxContext, TaxFn, Verdict, Wrapper, YearProjection,
} from "./types";
```

- [ ] **Step 2: Write a realistic end-to-end test**

```ts
// src/lib/plan/engine.integration.test.ts
import { blendedRateTax, project, type PlanInput } from "./index";

// A coherent mini-plan: working person, salary to 65, state pension from 67,
// a SIPP and cash, lifelong living costs, a temporary university expense, and
// a mortgage that clears mid-plan. Asserts the headline story, not exact pennies.
const plan: PlanInput = {
  currentAge: 50, startYear: 2026, retirementAge: 65, planToAge: 95,
  inflationPct: 2.5, defaultReturnPct: 5,
  statePension: { startAge: 67, annualAmount: 11000 },
  assets: [
    { id: "cash", label: "Cash", wrapper: "CASH", openingValue: 30000, expectedReturnPct: 1, drawdownPriority: 0 },
    { id: "isa", label: "ISA", wrapper: "ISA", openingValue: 80000, drawdownPriority: 1 },
    { id: "sipp", label: "SIPP", wrapper: "PENSION", openingValue: 200000, drawdownPriority: 2 },
    { id: "house", label: "Home", wrapper: "PROPERTY", openingValue: 400000, expectedReturnPct: 2, drawdownPriority: 9 },
  ],
  liabilities: [
    { id: "mortgage", label: "Mortgage", openingBalance: 90000, interestPct: 4, monthlyRepayment: 1200, endAge: 64, linkedAssetId: "house" },
  ],
  incomes: [
    { id: "salary", label: "Salary", kind: "SALARY", annualAmount: 60000, endAge: 64, growth: { kind: "INFLATION" }, taxable: true },
  ],
  expenses: [
    { id: "living", label: "Living", category: "FIXED", annualAmount: 28000, inflationLinked: true },
    { id: "uni", label: "University", category: "DISCRETIONARY", annualAmount: 12000, startAge: 52, endAge: 57, inflationLinked: true },
  ],
  events: [],
  tax: blendedRateTax(22),
};

describe("plan engine — realistic integration", () => {
  it("projects every year from 50 to 95", () => {
    const { years } = project(plan);
    expect(years).toHaveLength(46);
    expect(years[0].age).toBe(50);
    expect(years.at(-1)?.age).toBe(95);
  });

  it("clears the mortgage by its endAge (liability gone, net worth reflects it)", () => {
    const { years } = project(plan);
    const at64 = years.find((y) => y.age === 64);
    const at70 = years.find((y) => y.age === 70);
    expect(at64?.liabilityRepayments).toBeGreaterThan(0);
    expect(at70?.liabilitiesTotal).toBe(0);
  });

  it("includes the state pension in gross income from age 67", () => {
    const { years } = project(plan);
    const at66 = years.find((y) => y.age === 66)!;
    const at67 = years.find((y) => y.age === 67)!;
    expect(at67.grossIncome - at66.grossIncome).toBeGreaterThan(9000);
  });

  it("produces a verdict with peak net worth at or before death", () => {
    const { verdict } = project(plan);
    expect(verdict.peakNetWorth.value).toBeGreaterThan(0);
    expect(verdict.peakNetWorth.age).toBeGreaterThanOrEqual(50);
    expect(verdict.peakNetWorth.age).toBeLessThanOrEqual(95);
    // feasibility is a boolean either way — just assert the field is set
    expect(typeof verdict.feasible).toBe("boolean");
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm test src/lib/plan/engine.integration.test.ts`
Expected: PASS. If `feasible`-dependent assertions surprise you, inspect a few `years` rows — the numbers should tell a coherent accumulation→drawdown story.

- [ ] **Step 4: Run the whole engine suite + typecheck**

Run: `pnpm test src/lib/plan && pnpm typecheck`
Expected: PASS across all `src/lib/plan` tests, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/index.ts src/lib/plan/engine.integration.test.ts
git commit -m "feat(plan): public barrel + realistic engine integration test"
```

---

## Task 12: Reconcile the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-06-14-life-planning-forecast-design.md`

- [ ] **Step 1:** In the spec's §7 `PlanInput`, add `startYear: number; // calendar year of currentAge` beneath `currentAge`, and remove `monthlyContribution?` from `AssetInput` (add a one-line note: "explicit contributions deferred to Phase 2; v1 invests all positive surplus"). This keeps the spec and the shipped engine in agreement.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-14-life-planning-forecast-design.md
git commit -m "docs(plan): reconcile spec engine contract with Phase 0 (startYear, no monthlyContribution)"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** Phase 0 maps to spec §5 (waterfall → Task 9), §7 (engine contract → Tasks 1, 9–11), §9 (tax seam → Task 3). The waterfall sub-behaviours each have a task: income (4), expenses (5), drawdown/contribution + property exclusion (6), liabilities (7), events + growth (9), verdict + retirement solver (8, 10).
- **Determinism:** no `Date.now()`/`Math.random()` anywhere — calendar year comes from `startYear`. Safe for the journaled/resumable workflows and for client reuse in Phase 3.
- **Type consistency:** `project`, `earliestSustainableRetirementAge`, `blendedRateTax`, `activeIncome`, `activeExpenses`, `contributionTargetId`, `drawDown`, `liabilityStep`, `summarise` — names are stable across tasks; `assetsByWrapper` always carries all `WRAPPERS` keys.
- **Out of scope (later phases):** persistence/Prisma, seeding from Balance/Budget, the `plan/` route and charts, sliders, UK tax depth, inflation API, scenarios.
