import type {
  BalancePoint,
  CashFlowPoint,
  ExpenditurePoint,
} from "@/lib/dashboard/series";
import { dashboardSummary } from "@/lib/dashboard/summary";

const balancePoint = (month: string, net: number): BalancePoint => ({
  month,
  assetCurrent: 0,
  assetMediumTerm: 0,
  assetLongTerm: 0,
  assetProperty: 0,
  assetOther: 0,
  liabilityCurrent: 0,
  liabilityMediumTerm: 0,
  liabilityLongTerm: 0,
  liabilityOther: 0,
  net,
});

const flowPoint = (
  month: string,
  income: number,
  expense: number,
): CashFlowPoint => ({
  month,
  income,
  expense,
  net: income - expense,
  savingsRatePct: income > 0 ? ((income - expense) / income) * 100 : 0,
});

const spendPoint = (
  month: string,
  actual: number,
  budget: number,
): ExpenditurePoint => ({
  month,
  fixedActual: actual,
  fixedBudget: budget,
  fixedAvg: 0,
  variableActual: 0,
  variableBudget: 0,
  variableAvg: 0,
  discretionaryActual: 0,
  discretionaryBudget: 0,
  discretionaryAvg: 0,
});

const statFor = (
  key: string,
  input: Parameters<typeof dashboardSummary>[0],
) => {
  const stat = dashboardSummary(input).find((s) => s.key === key);
  if (!stat) throw new Error(`no stat ${key}`);
  return stat;
};

const empty = { balance: [], cashFlow: [], expenditure: [] };

describe("dashboardSummary", () => {
  test("reports the latest month's figures", () => {
    const stats = dashboardSummary({
      balance: [balancePoint("Jan", 1000), balancePoint("Feb", 1500)],
      cashFlow: [flowPoint("Jan", 3000, 2000), flowPoint("Feb", 3000, 2400)],
      expenditure: [
        spendPoint("Jan", 900, 1000),
        spendPoint("Feb", 1100, 1000),
      ],
    });

    expect(stats.map((s) => s.key)).toEqual([
      "netWorth",
      "surplus",
      "savingsRate",
      "spendVsBudget",
    ]);
    expect(stats[0]?.value).toBe(1500);
    expect(stats[1]?.value).toBe(600);
    expect(stats[2]?.value).toBe(20);
    // Percentages come out of a division, so compare with tolerance.
    expect(stats[3]?.value).toBeCloseTo(110);
  });

  test("measures change against the previous month", () => {
    const input = {
      balance: [balancePoint("Jan", 1000), balancePoint("Feb", 1500)],
      cashFlow: [flowPoint("Jan", 3000, 2000), flowPoint("Feb", 3000, 2400)],
      expenditure: [
        spendPoint("Jan", 900, 1000),
        spendPoint("Feb", 1100, 1000),
      ],
    };

    expect(statFor("netWorth", input).delta).toBe(500);
    // Surplus fell from 1000 to 600.
    expect(statFor("surplus", input).delta).toBe(-400);
    expect(statFor("spendVsBudget", input).delta).toBeCloseTo(20);
  });

  // With one month there is nothing to compare against, and inventing a
  // baseline of zero would render "+100%" against nothing.
  test("withholds a delta until there are two months", () => {
    const input = {
      balance: [balancePoint("Jan", 1000)],
      cashFlow: [flowPoint("Jan", 3000, 2000)],
      expenditure: [spendPoint("Jan", 900, 1000)],
    };

    expect(statFor("netWorth", input).value).toBe(1000);
    expect(statFor("netWorth", input).delta).toBeNull();
    expect(statFor("surplus", input).delta).toBeNull();
  });

  test("returns nulls rather than zeroes when there is no data at all", () => {
    for (const stat of dashboardSummary(empty)) {
      expect(stat.value).toBeNull();
      expect(stat.delta).toBeNull();
    }
  });

  // "0% of budget used" reads as remarkable restraint when it actually means
  // nobody has set a budget.
  test("treats an unset budget as unknown, not as 0% used", () => {
    const input = {
      ...empty,
      expenditure: [spendPoint("Jan", 500, 0)],
    };
    expect(statFor("spendVsBudget", input).value).toBeNull();
  });

  test("spending against budget is the one stat where down is good", () => {
    const directions = Object.fromEntries(
      dashboardSummary(empty).map((s) => [s.key, s.betterWhen]),
    );

    expect(directions).toEqual({
      netWorth: "higher",
      surplus: "higher",
      savingsRate: "higher",
      spendVsBudget: "lower",
    });
  });

  test("sums spending across all three expense sections", () => {
    const point: ExpenditurePoint = {
      month: "Jan",
      fixedActual: 500,
      fixedBudget: 500,
      fixedAvg: 0,
      variableActual: 300,
      variableBudget: 250,
      variableAvg: 0,
      discretionaryActual: 200,
      discretionaryBudget: 250,
      discretionaryAvg: 0,
    };

    // 1000 spent against 1000 budgeted, even though the sections differ.
    expect(
      statFor("spendVsBudget", { ...empty, expenditure: [point] }).value,
    ).toBe(100);
  });
});
