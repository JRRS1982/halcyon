# Life Planning — Phase 0: Projection Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, deterministic, fully-tested lifetime cashflow projection engine in `src/lib/plan/` — no UI, no Prisma, no I/O.

**Architecture:** Small pure modules composed by a single `project(input)` year loop (the "waterfall", spec §5). Each helper is unit-tested in isolation, then assembled. Purity means the identical code runs client-side for Phase 3 live sliders.

**Tech Stack:** TypeScript, Jest (`src/` only). No new dependencies.

**Spec:** [`../specs/2026-06-14-life-planning-forecast-design.md`](../specs/2026-06-14-life-planning-forecast-design.md) — §5 (waterfall), §7 (contract), §9 (tax).

**The model (spec §5), per projected year:**
1. `income` (streams, by kind) → `incomeTax` (blended rate on taxable streams) → `netIncome`.
2. `contributions` — each asset's `annualContribution` (inflation-grown), while `age < contributionEndAge` (default = retirementAge) — added to its pot.
3. `cashflow = netIncome − expenses − liabilityRepayments − contributions + events`.
4. `cashflow ≥ 0` → leftover into the **CASH buffer**. `cashflow < 0` → **fund the deficit** from assets in `drawdownPriority` order (CASH first), **grossing up** taxable-pot (PENSION/GIA) withdrawals at the blended rate; shortfall if assets exhausted.
5. Grow assets by return; record per-asset `value`/`contributed`/`withdrawn`, `incomeByKind`, totals, verdict.

**Conventions:** money is plain `number` (pounds), outputs **rounded to whole pounds**. Run one test file: `pnpm test src/lib/plan/<file>.test.ts`. Commit after every green task.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/plan/types.ts` | All contract types + `WRAPPERS`. No logic. |
| `src/lib/plan/helpers.ts` | `round`, `grow`, `amountThisYear`, `isActive`, `sum`. |
| `src/lib/plan/tax.ts` | `incomeTax`, `isTaxableOnWithdrawal`, `grossUp` (v1 blended-rate tax). |
| `src/lib/plan/streams.ts` | `activeIncome` (gross + by-kind + taxable), `activeExpenses`. |
| `src/lib/plan/assets.ts` | `contributionTargetId` (cash buffer), `fundDeficit` (drawdown + gross-up). |
| `src/lib/plan/liabilities.ts` | `liabilityStep` (interest + capped repayment). |
| `src/lib/plan/verdict.ts` | `summarise` (feasibility, first shortfall, peak). |
| `src/lib/plan/project.ts` | `project` waterfall + `earliestSustainableRetirementAge`. |
| `src/lib/plan/index.ts` | Public barrel. |

---

## Task 1: Types

**Files:** Create `src/lib/plan/types.ts`

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
  annualContribution?: number; // regular paying-in, inflation-grown; default 0
  contributionEndAge?: number; // default = PlanInput.retirementAge
  drawdownPriority: number; // ascending = drawn first (CASH buffer first)
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

export interface PlanInput {
  currentAge: number;
  startYear: number; // calendar year of currentAge
  retirementAge: number;
  planToAge: number;
  inflationPct: number;
  defaultReturnPct: number;
  taxRatePct: number; // v1 blended tax rate (spec §9)
  statePension?: { startAge: number; annualAmount: number };
  assets: AssetInput[];
  liabilities: LiabilityInput[];
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  events: EventInput[];
}

export interface AssetBalance {
  id: string;
  label: string;
  wrapper: Wrapper;
  value: number; // closing balance
  contributed: number; // paid in this year
  withdrawn: number; // drawn out this year (gross)
}

export interface LiabilityBalance {
  id: string;
  label: string;
  value: number;
}

export interface YearProjection {
  age: number;
  year: number;
  grossIncome: number;
  incomeByKind: Record<string, number>;
  tax: number;
  netIncome: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  liabilityRepayments: number;
  surplus: number;
  contributions: number;
  withdrawals: number;
  assets: AssetBalance[];
  liabilities: LiabilityBalance[];
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

- [ ] **Step 2: Verify it compiles** — `pnpm typecheck` → PASS.
- [ ] **Step 3: Commit**

```bash
git add src/lib/plan/types.ts
git commit -m "feat(plan): add projection engine contract types"
```

---

## Task 2: Maths helpers

**Files:** Create `src/lib/plan/helpers.ts`, `src/lib/plan/helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/helpers.test.ts
import { amountThisYear, grow, isActive, round, sum } from "./helpers";

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
    expect(amountThisYear(1000, 10, 2)).toBeCloseTo(1210);
  });
  it("isActive → respects optional age bounds", () => {
    expect(isActive(40)).toBe(true);
    expect(isActive(40, 41)).toBe(false);
    expect(isActive(45, 41, 49)).toBe(true);
    expect(isActive(50, 41, 49)).toBe(false);
  });
  it("sum → totals an array", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`pnpm test src/lib/plan/helpers.test.ts`, cannot find module).
- [ ] **Step 3: Implement**

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

export const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/helpers.ts src/lib/plan/helpers.test.ts
git commit -m "feat(plan): add maths helpers"
```

---

## Task 3: Tax (blended rate + withdrawal gross-up)

**Files:** Create `src/lib/plan/tax.ts`, `src/lib/plan/tax.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/tax.test.ts
import { grossUp, incomeTax, isTaxableOnWithdrawal } from "./tax";

describe("incomeTax", () => {
  it("applies the blended rate to taxable income", () => {
    expect(incomeTax(50000, 20)).toBe(10000);
    expect(incomeTax(0, 40)).toBe(0);
  });
});

describe("isTaxableOnWithdrawal", () => {
  it("PENSION and GIA are taxed on withdrawal; ISA/CASH are not", () => {
    expect(isTaxableOnWithdrawal("PENSION")).toBe(true);
    expect(isTaxableOnWithdrawal("GIA")).toBe(true);
    expect(isTaxableOnWithdrawal("ISA")).toBe(false);
    expect(isTaxableOnWithdrawal("CASH")).toBe(false);
  });
});

describe("grossUp", () => {
  it("grosses up a net need so the withdrawal covers its own tax", () => {
    // net 8000 at 20% → gross 10000, tax 2000
    expect(grossUp(8000, 20)).toEqual({ gross: 10000, tax: 2000 });
  });
  it("is a no-op at 0%", () => {
    expect(grossUp(8000, 0)).toEqual({ gross: 8000, tax: 0 });
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/lib/plan/tax.ts
import { round } from "./helpers";
import type { Wrapper } from "./types";

// v1 blended-rate tax (spec §9). Phase 4 swaps in real UK bands.
export const incomeTax = (taxableIncome: number, ratePct: number): number =>
  round((taxableIncome * ratePct) / 100);

export const isTaxableOnWithdrawal = (wrapper: Wrapper): boolean =>
  wrapper === "PENSION" || wrapper === "GIA";

// To net `need` from a taxable pot at `ratePct`, withdraw gross = need / (1 − r);
// the tax is gross − need. Closed-form (no iteration) because the rate is flat.
export const grossUp = (
  need: number,
  ratePct: number,
): { gross: number; tax: number } => {
  const r = ratePct / 100;
  const gross = need / (1 - r);
  return { gross: round(gross), tax: round(gross - need) };
};
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/tax.ts src/lib/plan/tax.test.ts
git commit -m "feat(plan): add v1 blended tax + withdrawal gross-up"
```

---

## Task 4: Income streams

**Files:** Create `src/lib/plan/streams.ts`, `src/lib/plan/streams.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/streams.test.ts
import { activeIncome } from "./streams";
import type { IncomeInput } from "./types";

const salary: IncomeInput = {
  id: "s", label: "Salary", kind: "SALARY",
  annualAmount: 50000, endAge: 64, growth: { kind: "NONE" }, taxable: true,
};

describe("activeIncome", () => {
  it("totals gross, by-kind, and taxable for an active salary", () => {
    const r = activeIncome([salary], undefined, 40, 0, 2.5);
    expect(r.gross).toBe(50000);
    expect(r.byKind.SALARY).toBe(50000);
    expect(r.taxableTotal).toBe(50000);
  });
  it("excludes a stream past its endAge", () => {
    expect(activeIncome([salary], undefined, 65, 25, 2.5).gross).toBe(0);
  });
  it("grows an inflation-linked stream over elapsed years", () => {
    const p: IncomeInput = {
      id: "p", label: "DB", kind: "DB_PENSION", annualAmount: 10000,
      startAge: 60, growth: { kind: "INFLATION" }, taxable: true,
    };
    expect(activeIncome([p], undefined, 62, 22, 10).gross).toBeCloseTo(10000 * 1.1 ** 22, 0);
  });
  it("grows a fixed-growth stream by its own rate", () => {
    const rent: IncomeInput = {
      id: "r", label: "Rent", kind: "RENTAL", annualAmount: 12000,
      growth: { kind: "FIXED", pct: 3 }, taxable: true,
    };
    expect(activeIncome([rent], undefined, 42, 2, 2.5).gross).toBeCloseTo(12000 * 1.03 ** 2, 0);
  });
  it("adds the state pension (taxable) from its start age", () => {
    const before = activeIncome([], { startAge: 67, annualAmount: 11000 }, 66, 26, 0);
    const after = activeIncome([], { startAge: 67, annualAmount: 11000 }, 67, 27, 0);
    expect(before.gross).toBe(0);
    expect(after.byKind.STATE_PENSION).toBe(11000);
    expect(after.taxableTotal).toBe(11000);
  });
  it("keeps non-taxable income in gross/byKind but out of taxableTotal", () => {
    const tf: IncomeInput = {
      id: "t", label: "TaxFree", kind: "OTHER", annualAmount: 5000,
      growth: { kind: "NONE" }, taxable: false,
    };
    const r = activeIncome([tf], undefined, 40, 0, 2.5);
    expect(r.byKind.OTHER).toBe(5000);
    expect(r.taxableTotal).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

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
  byKind: Record<string, number>;
  taxableTotal: number;
}

export const activeIncome = (
  incomes: IncomeInput[],
  statePension: { startAge: number; annualAmount: number } | undefined,
  age: number,
  yearsElapsed: number,
  inflationPct: number,
): IncomeResult => {
  const result: IncomeResult = { gross: 0, byKind: {}, taxableTotal: 0 };

  const add = (kind: IncomeKind, amount: number, taxable: boolean) => {
    result.gross += amount;
    result.byKind[kind] = (result.byKind[kind] ?? 0) + amount;
    if (taxable) result.taxableTotal += amount;
  };

  for (const income of incomes) {
    if (!isActive(age, income.startAge, income.endAge)) continue;
    add(
      income.kind,
      amountThisYear(income.annualAmount, growthPctOf(income.growth, inflationPct), yearsElapsed),
      income.taxable,
    );
  }

  if (statePension && age >= statePension.startAge) {
    add("STATE_PENSION", amountThisYear(statePension.annualAmount, inflationPct, yearsElapsed), true);
  }

  return result;
};
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/streams.ts src/lib/plan/streams.test.ts
git commit -m "feat(plan): add activeIncome (by-kind, growth, state pension)"
```

---

## Task 5: Expense streams

**Files:** Modify `src/lib/plan/streams.ts`, `src/lib/plan/streams.test.ts`

- [ ] **Step 1: Add the failing test** (append to `streams.test.ts`)

```ts
import { activeExpenses } from "./streams";
import type { ExpenseInput } from "./types";

const living: ExpenseInput = {
  id: "l", label: "Living", category: "FIXED", annualAmount: 24000, inflationLinked: true,
};

describe("activeExpenses", () => {
  it("totals active expenses and groups by category", () => {
    const r = activeExpenses([living], 40, 0, 2.5);
    expect(r.total).toBe(24000);
    expect(r.byCategory.FIXED).toBe(24000);
  });
  it("inflates inflation-linked expenses", () => {
    expect(activeExpenses([living], 50, 10, 10).total).toBeCloseTo(24000 * 1.1 ** 10, 0);
  });
  it("does not inflate when inflationLinked is false", () => {
    expect(activeExpenses([{ ...living, id: "f", inflationLinked: false }], 50, 10, 10).total).toBe(24000);
  });
  it("excludes expenses outside their age window", () => {
    const uni: ExpenseInput = {
      id: "u", label: "Uni", category: "DISCRETIONARY",
      annualAmount: 13000, startAge: 54, endAge: 60, inflationLinked: true,
    };
    expect(activeExpenses([uni], 53, 13, 0).total).toBe(0);
    expect(activeExpenses([uni], 54, 14, 0).total).toBe(13000);
    expect(activeExpenses([uni], 61, 21, 0).total).toBe(0);
  });
  it("buckets uncategorised under UNCATEGORISED", () => {
    const m: ExpenseInput = { id: "m", label: "Misc", annualAmount: 1000, inflationLinked: false };
    expect(activeExpenses([m], 40, 0, 2.5).byCategory.UNCATEGORISED).toBe(1000);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`activeExpenses` not exported).
- [ ] **Step 3: Add the implementation** (append to `streams.ts`)

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
  for (const e of expenses) {
    if (!isActive(age, e.startAge, e.endAge)) continue;
    const amount = e.inflationLinked
      ? amountThisYear(e.annualAmount, inflationPct, yearsElapsed)
      : e.annualAmount;
    const key = e.category ?? "UNCATEGORISED";
    result.byCategory[key] = (result.byCategory[key] ?? 0) + amount;
    result.total += amount;
  }
  return result;
};
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/streams.ts src/lib/plan/streams.test.ts
git commit -m "feat(plan): add activeExpenses (inflation, age windows, categories)"
```

---

## Task 6: Contribution target (the cash buffer)

**Files:** Create `src/lib/plan/assets.ts`, `src/lib/plan/assets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/assets.test.ts
import { contributionTargetId } from "./assets";
import type { AssetInput } from "./types";

const asset = (over: Partial<AssetInput> & { id: string }): AssetInput => ({
  label: over.id, wrapper: "GIA", openingValue: 0, drawdownPriority: 0, ...over,
});

describe("contributionTargetId", () => {
  it("prefers the CASH account (the buffer)", () => {
    const assets = [
      asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 3 }),
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
    ];
    expect(contributionTargetId(assets)).toBe("cash");
  });
  it("falls back to the most-liquid non-PROPERTY asset when there is no cash", () => {
    const assets = [
      asset({ id: "gia", wrapper: "GIA", drawdownPriority: 2 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 0 }),
    ];
    expect(contributionTargetId(assets)).toBe("isa"); // lowest drawdownPriority, non-property
  });
  it("returns null when there are no assets", () => {
    expect(contributionTargetId([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (start `assets.ts`)

```ts
// src/lib/plan/assets.ts
import { isTaxableOnWithdrawal, grossUp } from "./tax";
import type { AssetInput } from "./types";

const drawable = (a: AssetInput): boolean => a.wrapper !== "PROPERTY";

// Where leftover surplus sits: the CASH buffer. Falls back to the most-liquid
// non-PROPERTY asset (lowest drawdownPriority), then the first asset; null only
// when there are no assets.
export const contributionTargetId = (assets: AssetInput[]): string | null => {
  if (assets.length === 0) return null;
  const cash = assets.find((a) => a.wrapper === "CASH");
  if (cash) return cash.id;
  const liquid = assets.filter(drawable);
  if (liquid.length === 0) return assets[0].id;
  return liquid.reduce((best, a) => (a.drawdownPriority < best.drawdownPriority ? a : best)).id;
};
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/assets.ts src/lib/plan/assets.test.ts
git commit -m "feat(plan): add cash-buffer contribution target"
```

---

## Task 7: Fund a deficit (drawdown with gross-up)

**Files:** Modify `src/lib/plan/assets.ts`, `src/lib/plan/assets.test.ts`

- [ ] **Step 1: Add the failing test** (append to `assets.test.ts`)

```ts
import { fundDeficit } from "./assets";

describe("fundDeficit", () => {
  it("draws tax-free pots in priority order, no gross-up", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
    ];
    const r = fundDeficit(assets, { cash: 5000, isa: 10000 }, 7000, 20);
    expect(r.shortfall).toBe(false);
    expect(r.withdrawalTax).toBe(0);
    expect(r.balances.cash).toBe(0);
    expect(r.balances.isa).toBe(8000);
    expect(r.withdrawnByAsset).toEqual({ cash: 5000, isa: 2000 });
    expect(r.totalWithdrawn).toBe(7000);
  });
  it("grosses up a taxable pot so the net need is met and books the tax", () => {
    const assets = [asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 0 })];
    // need net 8000 at 20% → gross 10000, tax 2000
    const r = fundDeficit(assets, { sipp: 50000 }, 8000, 20);
    expect(r.balances.sipp).toBe(40000);
    expect(r.withdrawnByAsset.sipp).toBe(10000);
    expect(r.withdrawalTax).toBe(2000);
    expect(r.totalWithdrawn).toBe(10000);
    expect(r.shortfall).toBe(false);
  });
  it("skips PROPERTY and flags a shortfall when liquid assets run out", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 1 }),
    ];
    const r = fundDeficit(assets, { cash: 3000, house: 400000 }, 5000, 20);
    expect(r.withdrawnByAsset.cash).toBe(3000);
    expect(r.balances.house).toBe(400000);
    expect(r.shortfall).toBe(true);
  });
  it("does not mutate the input balances", () => {
    const assets = [asset({ id: "cash", wrapper: "CASH" })];
    const balances = { cash: 1000 };
    fundDeficit(assets, balances, 500, 20);
    expect(balances.cash).toBe(1000);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`fundDeficit` not exported).
- [ ] **Step 3: Add the implementation** (append to `assets.ts`)

```ts
export interface FundResult {
  balances: Record<string, number>;
  withdrawnByAsset: Record<string, number>; // gross withdrawn per asset
  withdrawalTax: number;
  totalWithdrawn: number; // gross
  shortfall: boolean;
}

// Funds a net `need` from non-PROPERTY assets in ascending drawdownPriority.
// Taxable pots (PENSION/GIA) are grossed up at `ratePct` so the net delivered
// covers the spending need; the gross-up is booked as withdrawalTax. Input
// balances are not mutated.
export const fundDeficit = (
  assets: AssetInput[],
  balances: Record<string, number>,
  need: number,
  ratePct: number,
): FundResult => {
  const next = { ...balances };
  const withdrawnByAsset: Record<string, number> = {};
  let remaining = need;
  let withdrawalTax = 0;

  const order = assets.filter(drawable).sort((a, b) => a.drawdownPriority - b.drawdownPriority);

  for (const a of order) {
    if (remaining <= 0) break;
    const balance = next[a.id] ?? 0;
    if (balance <= 0) continue;

    if (isTaxableOnWithdrawal(a.wrapper)) {
      const r = ratePct / 100;
      const netAvailable = balance * (1 - r); // most net this pot can deliver
      const net = Math.min(netAvailable, remaining);
      const { gross, tax } = grossUp(net, ratePct);
      next[a.id] = balance - gross;
      withdrawnByAsset[a.id] = gross;
      withdrawalTax += tax;
      remaining -= net;
    } else {
      const take = Math.min(balance, remaining);
      next[a.id] = balance - take;
      withdrawnByAsset[a.id] = take;
      remaining -= take;
    }
  }

  const totalWithdrawn = Object.values(withdrawnByAsset).reduce((s, v) => s + v, 0);
  return { balances: next, withdrawnByAsset, withdrawalTax, totalWithdrawn, shortfall: remaining > 0 };
};
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/assets.ts src/lib/plan/assets.test.ts
git commit -m "feat(plan): add fundDeficit (priority drawdown + taxable gross-up)"
```

---

## Task 8: Liability step

**Files:** Create `src/lib/plan/liabilities.ts`, `src/lib/plan/liabilities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/liabilities.test.ts
import { liabilityStep } from "./liabilities";
import type { LiabilityInput } from "./types";

const mortgage: LiabilityInput = {
  id: "m", label: "Mortgage", openingBalance: 100000, interestPct: 5, monthlyRepayment: 1000,
};

describe("liabilityStep", () => {
  it("accrues interest then repays, returning the year's repayment", () => {
    const r = liabilityStep([mortgage], { m: 100000 }, 40);
    expect(r.repaid).toBe(12000);
    expect(r.balances.m).toBeCloseTo(93000); // 100000*1.05 − 12000
  });
  it("repays only down to zero and reports the smaller repayment", () => {
    const r = liabilityStep([mortgage], { m: 5000 }, 40);
    expect(r.balances.m).toBe(0);
    expect(r.repaid).toBeCloseTo(5250);
  });
  it("is inert once the balance is zero", () => {
    const r = liabilityStep([mortgage], { m: 0 }, 40);
    expect(r.repaid).toBe(0);
  });
  it("stops after endAge", () => {
    const r = liabilityStep([{ ...mortgage, endAge: 59 }], { m: 50000 }, 60);
    expect(r.repaid).toBe(0);
    expect(r.balances.m).toBe(50000);
  });
  it("does not mutate the input balances", () => {
    const balances = { m: 100000 };
    liabilityStep([mortgage], balances, 40);
    expect(balances.m).toBe(100000);
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/lib/plan/liabilities.ts
import { grow } from "./helpers";
import type { LiabilityInput } from "./types";

export interface LiabilityStepResult {
  balances: Record<string, number>;
  repaid: number;
}

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

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/liabilities.ts src/lib/plan/liabilities.test.ts
git commit -m "feat(plan): add liabilityStep (interest + capped repayment)"
```

---

## Task 9: Verdict summary

**Files:** Create `src/lib/plan/verdict.ts`, `src/lib/plan/verdict.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/verdict.test.ts
import { summarise } from "./verdict";
import type { YearProjection } from "./types";

const year = (over: Partial<YearProjection> & { age: number }): YearProjection => ({
  year: 2000 + over.age,
  grossIncome: 0, incomeByKind: {}, tax: 0, netIncome: 0,
  expensesByCategory: {}, totalExpenses: 0, liabilityRepayments: 0,
  surplus: 0, contributions: 0, withdrawals: 0,
  assets: [], liabilities: [], liabilitiesTotal: 0, netWorth: 0, shortfall: false, ...over,
});

describe("summarise", () => {
  it("is feasible with no shortfall and reports peak net worth", () => {
    const v = summarise([
      year({ age: 60, netWorth: 100000 }),
      year({ age: 61, netWorth: 250000 }),
      year({ age: 62, netWorth: 180000 }),
    ]);
    expect(v.feasible).toBe(true);
    expect(v.firstShortfallAge).toBeNull();
    expect(v.peakNetWorth).toEqual({ age: 61, value: 250000 });
  });
  it("reports the first shortfall age and is not feasible", () => {
    const v = summarise([
      year({ age: 88, netWorth: 20000 }),
      year({ age: 89, netWorth: 0, shortfall: true }),
    ]);
    expect(v.feasible).toBe(false);
    expect(v.firstShortfallAge).toBe(89);
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/lib/plan/verdict.ts
import type { Verdict, YearProjection } from "./types";

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

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/verdict.ts src/lib/plan/verdict.test.ts
git commit -m "feat(plan): add verdict summary"
```

---

## Task 10: The projection waterfall

**Files:** Create `src/lib/plan/project.ts`, `src/lib/plan/project.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/plan/project.test.ts
import { project } from "./project";
import type { PlanInput } from "./types";

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  currentAge: 40, startYear: 2026, retirementAge: 65, planToAge: 41,
  inflationPct: 0, defaultReturnPct: 0, taxRatePct: 0,
  assets: [], liabilities: [], incomes: [], expenses: [], events: [],
  ...over,
});

const wrapperTotal = (
  y: { assets: { wrapper: string; value: number }[] },
  w: string,
): number => y.assets.filter((a) => a.wrapper === w).reduce((s, a) => s + a.value, 0);

describe("project", () => {
  it("emits one row per year with calendar years", () => {
    const p = project(base({ currentAge: 40, planToAge: 42 }));
    expect(p.years.map((y) => y.age)).toEqual([40, 41, 42]);
    expect(p.years.map((y) => y.year)).toEqual([2026, 2027, 2028]);
  });

  it("grows an untouched asset by default return; per-asset override wins", () => {
    const p = project(base({
      planToAge: 40, defaultReturnPct: 10,
      assets: [
        { id: "a", label: "GIA", wrapper: "GIA", openingValue: 10000, drawdownPriority: 1 },
        { id: "b", label: "SIPP", wrapper: "PENSION", openingValue: 10000, expectedReturnPct: 0, drawdownPriority: 2 },
      ],
    }));
    expect(wrapperTotal(p.years[0], "GIA")).toBe(11000);
    expect(wrapperTotal(p.years[0], "PENSION")).toBe(10000);
  });

  it("leftover surplus sits in the CASH buffer, not the pension", () => {
    const p = project(base({
      planToAge: 40,
      incomes: [{ id: "s", label: "Salary", kind: "SALARY", annualAmount: 50000, growth: { kind: "NONE" }, taxable: true }],
      expenses: [{ id: "e", label: "Living", annualAmount: 30000, inflationLinked: false }],
      taxRatePct: 20, // tax 10000 → net 40000; surplus 10000
      assets: [
        { id: "cash", label: "Cash", wrapper: "CASH", openingValue: 0, drawdownPriority: 0 },
        { id: "sipp", label: "SIPP", wrapper: "PENSION", openingValue: 0, drawdownPriority: 5 },
      ],
    }));
    expect(p.years[0].surplus).toBe(10000);
    expect(wrapperTotal(p.years[0], "CASH")).toBe(10000);
    expect(wrapperTotal(p.years[0], "PENSION")).toBe(0);
  });

  it("applies a per-asset contribution into its pot and records it", () => {
    const p = project(base({
      planToAge: 40, retirementAge: 65,
      incomes: [{ id: "s", label: "Salary", kind: "SALARY", annualAmount: 40000, growth: { kind: "NONE" }, taxable: false }],
      assets: [
        { id: "cash", label: "Cash", wrapper: "CASH", openingValue: 0, drawdownPriority: 0 },
        { id: "sipp", label: "SIPP", wrapper: "PENSION", openingValue: 0, annualContribution: 6000, drawdownPriority: 5 },
      ],
    }));
    // 6000 into SIPP, remaining 34000 to cash
    expect(p.years[0].contributions).toBe(6000);
    expect(wrapperTotal(p.years[0], "PENSION")).toBe(6000);
    expect(p.years[0].assets.find((a) => a.id === "sipp")?.contributed).toBe(6000);
    expect(wrapperTotal(p.years[0], "CASH")).toBe(34000);
  });

  it("funds a deficit from the cash buffer and flags shortfall when exhausted", () => {
    const p = project(base({
      planToAge: 40,
      expenses: [{ id: "e", label: "Living", annualAmount: 30000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 20000, drawdownPriority: 0 }],
    }));
    expect(p.years[0].withdrawals).toBe(20000);
    expect(p.years[0].shortfall).toBe(true);
    expect(wrapperTotal(p.years[0], "CASH")).toBe(0);
  });

  it("taxes a pension drawdown (gross-up) and records it on the asset", () => {
    const p = project(base({
      planToAge: 40, taxRatePct: 20,
      expenses: [{ id: "e", label: "Living", annualAmount: 8000, inflationLinked: false }],
      assets: [{ id: "sipp", label: "SIPP", wrapper: "PENSION", openingValue: 50000, drawdownPriority: 0 }],
    }));
    // net need 8000 → gross 10000, tax 2000
    expect(p.years[0].withdrawals).toBe(10000);
    expect(p.years[0].tax).toBe(2000);
    expect(p.years[0].assets.find((a) => a.id === "sipp")?.withdrawn).toBe(10000);
  });

  it("captures income by kind", () => {
    const p = project(base({
      planToAge: 40,
      incomes: [{ id: "s", label: "Salary", kind: "SALARY", annualAmount: 40000, growth: { kind: "NONE" }, taxable: true }],
      statePension: { startAge: 40, annualAmount: 11000 },
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 0, drawdownPriority: 0 }],
    }));
    expect(p.years[0].incomeByKind.SALARY).toBe(40000);
    expect(p.years[0].incomeByKind.STATE_PENSION).toBe(11000);
  });

  it("reduces net worth by an outstanding liability", () => {
    const p = project(base({
      planToAge: 40,
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 100000, drawdownPriority: 0 }],
      liabilities: [{ id: "m", label: "Mortgage", openingBalance: 60000, interestPct: 0, monthlyRepayment: 0 }],
    }));
    expect(p.years[0].liabilitiesTotal).toBe(60000);
    expect(p.years[0].netWorth).toBe(40000);
  });

  it("applies a one-off inflow event the year it lands", () => {
    const p = project(base({
      currentAge: 40, planToAge: 41,
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 0, drawdownPriority: 0 }],
      events: [{ id: "inh", label: "Inheritance", age: 41, direction: "INFLOW", amount: 50000 }],
    }));
    expect(wrapperTotal(p.years[0], "CASH")).toBe(0);
    expect(wrapperTotal(p.years[1], "CASH")).toBe(50000);
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
// src/lib/plan/project.ts
import { contributionTargetId, fundDeficit } from "./assets";
import { amountThisYear, grow, round, sum } from "./helpers";
import { liabilityStep } from "./liabilities";
import { activeExpenses, activeIncome } from "./streams";
import { incomeTax } from "./tax";
import type { PlanInput, PlanProjection, YearProjection } from "./types";
import { summarise } from "./verdict";

const projectYears = (input: PlanInput): YearProjection[] => {
  const assetBal: Record<string, number> = {};
  for (const a of input.assets) assetBal[a.id] = a.openingValue;
  const liabBal: Record<string, number> = {};
  for (const l of input.liabilities) liabBal[l.id] = l.openingBalance;

  const years: YearProjection[] = [];

  for (let age = input.currentAge; age <= input.planToAge; age++) {
    const yearsElapsed = age - input.currentAge;

    const income = activeIncome(input.incomes, input.statePension, age, yearsElapsed, input.inflationPct);
    const incTax = incomeTax(income.taxableTotal, input.taxRatePct);
    const netIncome = income.gross - incTax;

    const expenses = activeExpenses(input.expenses, age, yearsElapsed, input.inflationPct);

    const liab = liabilityStep(input.liabilities, liabBal, age);
    Object.assign(liabBal, liab.balances);

    // Per-asset contributions (inflation-grown), while still paying in.
    const contributedByAsset: Record<string, number> = {};
    let contributions = 0;
    for (const a of input.assets) {
      const endAge = a.contributionEndAge ?? input.retirementAge;
      if (!a.annualContribution || age >= endAge) continue;
      const c = amountThisYear(a.annualContribution, input.inflationPct, yearsElapsed);
      assetBal[a.id] = (assetBal[a.id] ?? 0) + c;
      contributedByAsset[a.id] = c;
      contributions += c;
    }

    const eventsNet = sum(
      input.events.filter((e) => e.age === age).map((e) => (e.direction === "INFLOW" ? e.amount : -e.amount)),
    );

    const cashflow = netIncome - expenses.total - liab.repaid - contributions + eventsNet;

    let withdrawalTax = 0;
    let withdrawals = 0;
    let shortfall = false;
    const withdrawnByAsset: Record<string, number> = {};

    if (cashflow >= 0) {
      const targetId = contributionTargetId(input.assets);
      if (targetId) assetBal[targetId] = (assetBal[targetId] ?? 0) + cashflow;
    } else {
      const fund = fundDeficit(input.assets, assetBal, -cashflow, input.taxRatePct);
      Object.assign(assetBal, fund.balances);
      Object.assign(withdrawnByAsset, fund.withdrawnByAsset);
      withdrawalTax = fund.withdrawalTax;
      withdrawals = fund.totalWithdrawn;
      shortfall = fund.shortfall;
    }

    const yearTax = incTax + withdrawalTax;

    // End-of-year growth on resulting balances.
    for (const a of input.assets) {
      assetBal[a.id] = grow(assetBal[a.id] ?? 0, a.expectedReturnPct ?? input.defaultReturnPct);
    }

    const assets = input.assets.map((a) => ({
      id: a.id,
      label: a.label,
      wrapper: a.wrapper,
      value: round(assetBal[a.id] ?? 0),
      contributed: round(contributedByAsset[a.id] ?? 0),
      withdrawn: round(withdrawnByAsset[a.id] ?? 0),
    }));
    const liabilities = input.liabilities.map((l) => ({
      id: l.id,
      label: l.label,
      value: round(liabBal[l.id] ?? 0),
    }));
    const liabilitiesTotal = sum(liabilities.map((l) => l.value));
    const netWorth = sum(assets.map((a) => a.value)) - liabilitiesTotal;

    const expensesByCategory: Record<string, number> = {};
    for (const [k, v] of Object.entries(expenses.byCategory)) expensesByCategory[k] = round(v);
    const incomeByKind: Record<string, number> = {};
    for (const [k, v] of Object.entries(income.byKind)) incomeByKind[k] = round(v);

    years.push({
      age,
      year: input.startYear + yearsElapsed,
      grossIncome: round(income.gross),
      incomeByKind,
      tax: round(yearTax),
      netIncome: round(netIncome),
      expensesByCategory,
      totalExpenses: round(expenses.total),
      liabilityRepayments: round(liab.repaid),
      surplus: round(cashflow),
      contributions: round(contributions),
      withdrawals: round(withdrawals),
      assets,
      liabilities,
      liabilitiesTotal,
      netWorth: round(netWorth),
      shortfall,
    });
  }

  return years;
};

export const project = (input: PlanInput): PlanProjection => {
  const years = projectYears(input);
  return {
    years,
    verdict: { ...summarise(years), earliestSustainableRetirementAge: null },
  };
};
```

> Note: `project` returns `earliestSustainableRetirementAge: null` for now; Task 11 fills it in (kept separate so the recursion is introduced deliberately).

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/project.ts src/lib/plan/project.test.ts
git commit -m "feat(plan): add the projection waterfall (cash buffer, contributions, tax, events)"
```

---

## Task 11: Earliest-sustainable-retirement-age solver

**Files:** Modify `src/lib/plan/project.ts`, `src/lib/plan/project.test.ts`

- [ ] **Step 1: Add the failing test** (append to `project.test.ts`)

```ts
import { earliestSustainableRetirementAge } from "./project";

describe("earliestSustainableRetirementAge", () => {
  it("finds the earliest age at which stopping salary keeps the plan feasible", () => {
    const input = base({
      currentAge: 60, planToAge: 65, retirementAge: 65, taxRatePct: 0,
      incomes: [{ id: "s", label: "Salary", kind: "SALARY", annualAmount: 40000, growth: { kind: "NONE" }, taxable: false }],
      expenses: [{ id: "e", label: "Living", annualAmount: 20000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 40000, drawdownPriority: 0 }],
    });
    const age = earliestSustainableRetirementAge(input);
    expect(age).not.toBeNull();
    expect(age).toBeGreaterThanOrEqual(60);
    expect(age).toBeLessThanOrEqual(65);
  });

  it("returns currentAge when already feasible with no work", () => {
    const input = base({
      currentAge: 60, planToAge: 62, taxRatePct: 0,
      expenses: [{ id: "e", label: "Living", annualAmount: 10000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 1000000, drawdownPriority: 0 }],
    });
    expect(earliestSustainableRetirementAge(input)).toBe(60);
  });

  it("returns null when no retirement age in range is feasible", () => {
    const input = base({
      currentAge: 60, planToAge: 90, taxRatePct: 0,
      expenses: [{ id: "e", label: "Living", annualAmount: 50000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 1000, drawdownPriority: 0 }],
    });
    expect(earliestSustainableRetirementAge(input)).toBeNull();
  });

  it("is wired into project()'s verdict", () => {
    const input = base({
      currentAge: 60, planToAge: 62, taxRatePct: 0,
      expenses: [{ id: "e", label: "Living", annualAmount: 10000, inflationLinked: false }],
      assets: [{ id: "cash", label: "Cash", wrapper: "CASH", openingValue: 1000000, drawdownPriority: 0 }],
    });
    expect(project(input).verdict.earliestSustainableRetirementAge).toBe(60);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`earliestSustainableRetirementAge` not exported; verdict assertion fails).
- [ ] **Step 3: Update the implementation**

Add `IncomeInput` to the `./types` import in `project.ts`:

```ts
import type { IncomeInput, PlanInput, PlanProjection, YearProjection } from "./types";
```

Add the solver and wire it into `project` (replace the existing `project` export):

```ts
const EMPLOYMENT: IncomeInput["kind"][] = ["SALARY", "SELF_EMPLOYMENT"];

// Re-runs the projection with employment income ending at each candidate age,
// from currentAge to planToAge, returning the earliest age that keeps the plan
// feasible (or null). Uses projectYears directly, so it never recurses.
export const earliestSustainableRetirementAge = (input: PlanInput): number | null => {
  for (let candidate = input.currentAge; candidate <= input.planToAge; candidate++) {
    const incomes = input.incomes.map((i) =>
      EMPLOYMENT.includes(i.kind)
        ? { ...i, endAge: Math.min(i.endAge ?? candidate, candidate) }
        : i,
    );
    if (summarise(projectYears({ ...input, retirementAge: candidate, incomes })).feasible) {
      return candidate;
    }
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

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/project.ts src/lib/plan/project.test.ts
git commit -m "feat(plan): add earliest-sustainable-retirement-age solver"
```

---

## Task 12: Public barrel + realistic integration test

**Files:** Create `src/lib/plan/index.ts`, `src/lib/plan/engine.integration.test.ts`

- [ ] **Step 1: Write the barrel**

```ts
// src/lib/plan/index.ts
export { project, earliestSustainableRetirementAge } from "./project";
export { incomeTax, grossUp, isTaxableOnWithdrawal } from "./tax";
export { WRAPPERS } from "./types";
export type {
  AssetBalance, AssetInput, EventInput, ExpenseInput, IncomeInput, IncomeKind,
  LiabilityBalance, LiabilityInput, PlanInput, PlanProjection, Verdict, Wrapper, YearProjection,
} from "./types";
```

- [ ] **Step 2: Write a realistic end-to-end test**

```ts
// src/lib/plan/engine.integration.test.ts
import { project, type PlanInput } from "./index";

// Working person → retires at 65, state pension at 67, SIPP + ISA + cash,
// pension contributions while working, lifelong living costs, a temporary
// university expense, and a mortgage that clears mid-plan. Asserts the story.
const plan: PlanInput = {
  currentAge: 50, startYear: 2026, retirementAge: 65, planToAge: 95,
  inflationPct: 2.5, defaultReturnPct: 5, taxRatePct: 22,
  statePension: { startAge: 67, annualAmount: 11000 },
  assets: [
    { id: "cash", label: "Cash", wrapper: "CASH", openingValue: 30000, expectedReturnPct: 1, drawdownPriority: 0 },
    { id: "isa", label: "ISA", wrapper: "ISA", openingValue: 80000, drawdownPriority: 1 },
    { id: "sipp", label: "SIPP", wrapper: "PENSION", openingValue: 200000, annualContribution: 8000, drawdownPriority: 2 },
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
};

describe("plan engine — realistic integration", () => {
  it("projects every year from 50 to 95", () => {
    const { years } = project(plan);
    expect(years).toHaveLength(46);
    expect(years[0].age).toBe(50);
    expect(years.at(-1)?.age).toBe(95);
  });
  it("grows the SIPP via contributions while working", () => {
    const { years } = project(plan);
    const sippAt55 = years.find((y) => y.age === 55)!.assets.find((a) => a.id === "sipp")!;
    expect(sippAt55.contributed).toBeGreaterThan(0);
    expect(sippAt55.value).toBeGreaterThan(200000);
  });
  it("clears the mortgage by its endAge", () => {
    const { years } = project(plan);
    expect(years.find((y) => y.age === 64)!.liabilityRepayments).toBeGreaterThan(0);
    expect(years.find((y) => y.age === 70)!.liabilitiesTotal).toBe(0);
  });
  it("adds the state pension to income by kind from age 67", () => {
    const { years } = project(plan);
    expect(years.find((y) => y.age === 66)!.incomeByKind.STATE_PENSION ?? 0).toBe(0);
    expect(years.find((y) => y.age === 67)!.incomeByKind.STATE_PENSION).toBeGreaterThan(9000);
  });
  it("produces a verdict", () => {
    const { verdict } = project(plan);
    expect(verdict.peakNetWorth.value).toBeGreaterThan(0);
    expect(typeof verdict.feasible).toBe("boolean");
  });
});
```

- [ ] **Step 3: Run** `pnpm test src/lib/plan/engine.integration.test.ts` → PASS. If a story assertion surprises you, print a few `years` rows and check the accumulation→drawdown shape.
- [ ] **Step 4: Whole suite + typecheck** — `pnpm test src/lib/plan && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/index.ts src/lib/plan/engine.integration.test.ts
git commit -m "feat(plan): public barrel + realistic engine integration test"
```

---

## Self-review notes

- **Spec coverage:** §5 waterfall → Tasks 10–11; §7 contract → Tasks 1, 10–12; §9 tax (blended + drawdown gross-up) → Tasks 3, 7, 10. Sub-behaviours each have a task: income+by-kind (4), expenses (5), cash-buffer target (6), deficit/gross-up/property-exclusion (7), liabilities (8), verdict (9), contributions+events+growth (10), retirement solver (11).
- **Cash-buffer model:** surplus → CASH (Task 10 test "leftover surplus sits in the CASH buffer"); contributions grow pots (Task 10 test); deficits drain cash first then taxable pots grossed up (Tasks 7, 10).
- **Determinism:** no `Date.now()`/`Math.random()` — calendar year from `startYear`. Safe for client reuse (Phase 3).
- **Type consistency:** `project`, `earliestSustainableRetirementAge`, `incomeTax`, `grossUp`, `isTaxableOnWithdrawal`, `activeIncome`, `activeExpenses`, `contributionTargetId`, `fundDeficit`, `liabilityStep`, `summarise` are stable across tasks. `YearProjection` carries per-asset `assets[]` (with `contributed`/`withdrawn`), per-liability `liabilities[]`, and `incomeByKind`; the chart groups by wrapper at the display layer.
- **Out of scope (later phases):** Prisma persistence, seeding, the `plan/` route + charts, sliders, real UK tax, inflation feed, scenarios.
```
