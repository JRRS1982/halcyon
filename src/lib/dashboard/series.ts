// Pure derivations for the dashboard charts. Each takes already-normalized
// numeric inputs (Prisma Decimals converted to numbers in the page) and
// returns the shape its chart consumes. Kept pure so it stays unit-testable.

// Per-month balance buckets as stored: liabilities are positive magnitudes
// (the balance sheet keeps them positive and subtracts for net worth).
export type BalanceSums = {
  month: string;
  assetCurrent: number;
  assetLongTerm: number;
  assetOther: number;
  liabilityCurrent: number;
  liabilityLongTerm: number;
  liabilityOther: number;
};

// Chart-ready balance point: liabilities are negated (debt sits below zero) and
// net = total assets − total liabilities.
export type BalancePoint = {
  month: string;
  assetCurrent: number;
  assetLongTerm: number;
  assetOther: number;
  liabilityCurrent: number;
  liabilityLongTerm: number;
  liabilityOther: number;
  net: number;
};

const neg = (v: number) => (v === 0 ? 0 : -v);

export function balanceSeries(sums: BalanceSums[]): BalancePoint[] {
  return sums.map((s) => {
    const assets = s.assetCurrent + s.assetLongTerm + s.assetOther;
    const liabilities =
      s.liabilityCurrent + s.liabilityLongTerm + s.liabilityOther;
    return {
      month: s.month,
      assetCurrent: s.assetCurrent,
      assetLongTerm: s.assetLongTerm,
      assetOther: s.assetOther,
      liabilityCurrent: neg(s.liabilityCurrent),
      liabilityLongTerm: neg(s.liabilityLongTerm),
      liabilityOther: neg(s.liabilityOther),
      net: assets - liabilities,
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
