import type { BalancePoint, CashFlowPoint, ExpenditurePoint } from "./series";

/**
 * The four figures the dashboard leads with.
 *
 * The page is a wall of charts, and a chart answers "how has this moved"
 * without ever answering "where am I". These do that, so the charts become
 * supporting evidence rather than the only content.
 *
 * Everything here is derived from the series the page already builds — no
 * extra queries.
 */
export type SummaryKind = "amount" | "percent";

export type SummaryStat = {
  key: string;
  label: string;
  /** null when there is nothing to show yet; the tile renders a dash. */
  value: number | null;
  kind: SummaryKind;
  /** Change against the previous recorded month, in the same unit. */
  delta: number | null;
  /**
   * Which direction is good. Spending against budget is the odd one out —
   * a rise there is bad — so the tile can't just paint "up" green.
   */
  betterWhen: "higher" | "lower";
  /** Names the comparison, so a delta is never an unexplained number. */
  deltaLabel: string;
};

const last = <T>(xs: T[]): T | undefined => xs[xs.length - 1];
const previous = <T>(xs: T[]): T | undefined => xs[xs.length - 2];

// A delta is only meaningful against a real earlier figure. With one month of
// data there is no comparison to make, and showing "+100%" against nothing
// would be worse than showing nothing.
const change = (current: number | undefined, before: number | undefined) =>
  current === undefined || before === undefined ? null : current - before;

export function dashboardSummary({
  balance,
  cashFlow,
  expenditure,
}: {
  balance: BalancePoint[];
  cashFlow: CashFlowPoint[];
  expenditure: ExpenditurePoint[];
}): SummaryStat[] {
  const balanceNow = last(balance);
  const balanceBefore = previous(balance);

  const flowNow = last(cashFlow);
  const flowBefore = previous(cashFlow);

  const spendNow = spendAgainstBudget(last(expenditure));
  const spendBefore = spendAgainstBudget(previous(expenditure));

  return [
    {
      key: "netWorth",
      label: "Net worth",
      value: balanceNow?.net ?? null,
      kind: "amount",
      delta: change(balanceNow?.net, balanceBefore?.net),
      betterWhen: "higher",
      deltaLabel: "vs last month",
    },
    {
      key: "surplus",
      label: "Surplus",
      value: flowNow?.net ?? null,
      kind: "amount",
      delta: change(flowNow?.net, flowBefore?.net),
      betterWhen: "higher",
      deltaLabel: "vs last month",
    },
    {
      key: "savingsRate",
      label: "Savings rate",
      value: flowNow?.savingsRatePct ?? null,
      kind: "percent",
      delta: change(flowNow?.savingsRatePct, flowBefore?.savingsRatePct),
      betterWhen: "higher",
      deltaLabel: "vs last month",
    },
    {
      key: "spendVsBudget",
      label: "Spend vs budget",
      value: spendNow,
      kind: "percent",
      delta: change(spendNow ?? undefined, spendBefore ?? undefined),
      betterWhen: "lower",
      deltaLabel: "of budget used",
    },
  ];
}

/**
 * Actual spending as a percentage of what was budgeted, across all three
 * expense buckets. 100 means exactly on plan.
 *
 * Returns null rather than 0 when nothing was budgeted: "0% of budget used"
 * reads as excellent restraint when it actually means "no budget set".
 */
function spendAgainstBudget(
  point: ExpenditurePoint | undefined,
): number | null {
  if (!point) return null;

  const actual =
    point.fixedActual + point.variableActual + point.discretionaryActual;
  const budget =
    point.fixedBudget + point.variableBudget + point.discretionaryBudget;

  if (budget <= 0) return null;
  return (actual / budget) * 100;
}
