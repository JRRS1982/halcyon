import type { AccountType } from "@prisma/client";
import { kindOf } from "@/lib/accounts/accountDraft";
import type { BalanceCategory } from "@/lib/balance/reorder";

// Pure derivations for the dashboard charts. Each takes already-normalized
// numeric inputs (Prisma Decimals converted to numbers in the page) and
// returns the shape its chart consumes. Kept pure so it stays unit-testable.

// Per-month balance buckets as stored: liabilities are positive magnitudes
// (the balance sheet keeps them positive and subtracts for net worth).
// PROPERTY is asset-only — see comments in src/lib/balance/reorder.ts.
export type BalanceSums = {
  month: string;
  assetCurrent: number;
  assetMediumTerm: number;
  assetLongTerm: number;
  assetProperty: number;
  assetOther: number;
  liabilityCurrent: number;
  liabilityMediumTerm: number;
  liabilityLongTerm: number;
  liabilityOther: number;
};

// One month's BalanceItems, each carrying its owning account's `type` — not
// the item's own `type`/`category` mirror columns, which can go stale (they
// are written at creation and on an explicit rename, but nothing keeps them
// in step with a later `setAccountType`/`setAccountSection` on the account).
// The account is the durable fact; the sums must follow it.
export type AccountBalanceItem = {
  value: number;
  account: { type: AccountType; section: BalanceCategory };
};

// Buckets a month's balance items by their *account's* derived kind/section,
// ignoring any stale mirror the item itself might still carry.
export function accountBalanceSums(
  items: AccountBalanceItem[],
): Omit<BalanceSums, "month"> {
  const sums = {
    assetCurrent: 0,
    assetMediumTerm: 0,
    assetLongTerm: 0,
    assetProperty: 0,
    assetOther: 0,
    liabilityCurrent: 0,
    liabilityMediumTerm: 0,
    liabilityLongTerm: 0,
    liabilityOther: 0,
  };
  for (const item of items) {
    const kind = kindOf(item.account.type);
    const section = item.account.section;
    if (kind === "ASSET") {
      if (section === "CURRENT") sums.assetCurrent += item.value;
      else if (section === "MEDIUM_TERM") sums.assetMediumTerm += item.value;
      else if (section === "LONG_TERM") sums.assetLongTerm += item.value;
      else if (section === "PROPERTY") sums.assetProperty += item.value;
      else sums.assetOther += item.value;
    } else {
      if (section === "CURRENT") sums.liabilityCurrent += item.value;
      else if (section === "MEDIUM_TERM")
        sums.liabilityMediumTerm += item.value;
      else if (section === "LONG_TERM") sums.liabilityLongTerm += item.value;
      // PROPERTY is asset-only in the UI; if a stray LIABILITY:PROPERTY
      // account ever exists, fold it into Other rather than dropping it.
      else sums.liabilityOther += item.value;
    }
  }
  return sums;
}

// Chart-ready balance point: liabilities are negated (debt sits below zero) and
// net = total assets − total liabilities.
export type BalancePoint = {
  month: string;
  assetCurrent: number;
  assetMediumTerm: number;
  assetLongTerm: number;
  assetProperty: number;
  assetOther: number;
  liabilityCurrent: number;
  liabilityMediumTerm: number;
  liabilityLongTerm: number;
  liabilityOther: number;
  net: number;
};

const neg = (v: number) => (v === 0 ? 0 : -v);

export function balanceSeries(sums: BalanceSums[]): BalancePoint[] {
  return sums.map((s) => {
    const assets =
      s.assetCurrent +
      s.assetMediumTerm +
      s.assetLongTerm +
      s.assetProperty +
      s.assetOther;
    const liabilities =
      s.liabilityCurrent +
      s.liabilityMediumTerm +
      s.liabilityLongTerm +
      s.liabilityOther;
    return {
      month: s.month,
      assetCurrent: s.assetCurrent,
      assetMediumTerm: s.assetMediumTerm,
      assetLongTerm: s.assetLongTerm,
      assetProperty: s.assetProperty,
      assetOther: s.assetOther,
      liabilityCurrent: neg(s.liabilityCurrent),
      liabilityMediumTerm: neg(s.liabilityMediumTerm),
      liabilityLongTerm: neg(s.liabilityLongTerm),
      liabilityOther: neg(s.liabilityOther),
      net: assets - liabilities,
    };
  });
}

export type ValuePoint = { month: string; value: number };
export type ValueAvgPoint = { month: string; value: number; avg: number };

const TRAILING_MONTHS = 6;

// Pairs each month's value with the trailing N-month average of the value
// (inclusive), so a per-category line can be shown against its own moving
// average. Before the window fills, averages over the months seen so far.
export function trailingAverageSeries(
  points: ValuePoint[],
  window: number = TRAILING_MONTHS,
): ValueAvgPoint[] {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - (window - 1)), i + 1);
    const sum = slice.reduce((acc, q) => acc + q.value, 0);
    return { month: p.month, value: p.value, avg: sum / slice.length };
  });
}

export type MonthFlow = { month: string; income: number; expense: number };

// One month's budget rows, as this chart sees them.
export type FlowRow = {
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "REPAYMENT";
  actual: number;
};

// Splits a month's rows into the chart's two series, on the same rule the
// budget sheet uses (`sectionOf`, `surplus`): a REPAYMENT is spending — the
// money genuinely left the account — and a TRANSFER is not, because a pension
// contribution is money you still own.
//
// Getting the repayment half wrong is not a rounding error: converting a
// mortgage from an EXPENSE category row to a REPAYMENT row, which is exactly
// what this feature invites, would otherwise halve the charted expenditure
// and jump the savings rate while the budget sheet's total stood still.
//
// A transfer is excluded rather than lumped in with expenses, which is what an
// `if INCOME … else expense` does the moment such a row exists. A transfers
// series would be its own chart; this is not it.
export function monthFlow(rows: FlowRow[]): {
  income: number;
  expense: number;
} {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.type === "INCOME") income += row.actual;
    else if (row.type === "EXPENSE" || row.type === "REPAYMENT")
      expense += row.actual;
  }
  return { income, expense };
}

export type CashFlowPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
  // Percentage points (e.g. 25 = 25%); negative when overspending. 0 when
  // there's no income, to avoid dividing by zero.
  savingsRatePct: number;
};

export function cashFlowSeries(months: MonthFlow[]): CashFlowPoint[] {
  return months.map((m) => {
    const net = m.income - m.expense;
    const savingsRatePct = m.income > 0 ? (net / m.income) * 100 : 0;
    return {
      month: m.month,
      income: m.income,
      expense: m.expense,
      net,
      savingsRatePct,
    };
  });
}

// Per-category expenditure point: actual, budget, and trailing-6-month average
// for each expense section. One element per recorded month.
export type ExpenditurePoint = {
  month: string;
  fixedActual: number;
  fixedBudget: number;
  fixedAvg: number;
  variableActual: number;
  variableBudget: number;
  variableAvg: number;
  discretionaryActual: number;
  discretionaryBudget: number;
  discretionaryAvg: number;
};
