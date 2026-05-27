// Pure derivations for the dashboard charts. Each takes already-normalized
// numeric inputs (Prisma Decimals converted to numbers in the page) and
// returns the shape its chart consumes. Kept pure so it stays unit-testable.

export type BalanceBuckets = {
  month: string;
  assetCurrent: number;
  assetLongTerm: number;
  assetOther: number;
  liabilityCurrent: number;
  liabilityLongTerm: number;
  liabilityOther: number;
};

export type NetWorthPoint = {
  month: string;
  assets: number;
  liabilities: number;
  netWorth: number;
};

// Collapse the six balance buckets into one net-worth line, plus the asset
// and liability subtotals the chart draws as faint reference lines.
export function netWorthSeries(balance: BalanceBuckets[]): NetWorthPoint[] {
  return balance.map((b) => {
    const assets = b.assetCurrent + b.assetLongTerm + b.assetOther;
    const liabilities =
      b.liabilityCurrent + b.liabilityLongTerm + b.liabilityOther;
    return {
      month: b.month,
      assets,
      liabilities,
      netWorth: assets - liabilities,
    };
  });
}

export type MonthFlow = { month: string; income: number; expense: number };

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

export type BudgetActualPoint = {
  month: string;
  budget: number;
  actual: number;
};

const TREND_MONTHS = 6;

// The trailing window of months for the budget-vs-actual trend line.
export function budgetVsActualTrend(
  months: BudgetActualPoint[],
  trailing: number = TREND_MONTHS,
): BudgetActualPoint[] {
  return months.slice(Math.max(0, months.length - trailing));
}

export type CompositionSlice = { name: string; value: number };

// The latest month's spend split into donut slices, dropping any category
// with no spend so the chart shows no empty wedges.
export function composition(latest: {
  fixed: number;
  variable: number;
  discretionary: number;
}): CompositionSlice[] {
  return [
    { name: "Fixed", value: latest.fixed },
    { name: "Variable", value: latest.variable },
    { name: "Discretionary", value: latest.discretionary },
  ].filter((s) => s.value > 0);
}
