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

// Per-category expenditure point: actual, budget, and trailing-6-month average
// for each expense bucket. One element per recorded month.
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
