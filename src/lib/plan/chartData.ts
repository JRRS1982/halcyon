import {
  type ExpenseCategory,
  type IncomeKind,
  WRAPPERS,
  type Wrapper,
  type YearProjection,
} from "@/lib/plan";

export type NetWorthDatum = {
  age: number;
  debt: number;
  netWorth: number;
} & Partial<Record<Wrapper, number>>;

// One row per year: each wrapper's summed asset value (positive), the total
// debt as a single negative `debt` segment, and the net-worth line value.
export function toNetWorthChartData(years: YearProjection[]): NetWorthDatum[] {
  return years.map((y) => {
    const byWrapper: Partial<Record<Wrapper, number>> = {};
    for (const a of y.assets) {
      byWrapper[a.wrapper] = (byWrapper[a.wrapper] ?? 0) + a.value;
    }
    return {
      age: y.age,
      ...byWrapper,
      debt: -y.liabilitiesTotal,
      netWorth: y.netWorth,
    };
  });
}

// Which wrappers actually carry value anywhere in the series (for which <Bar>s
// to render), in canonical WRAPPERS order.
export function wrappersPresent(rows: NetWorthDatum[]): Wrapper[] {
  return WRAPPERS.filter((w) => rows.some((r) => (r[w] ?? 0) !== 0));
}

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
