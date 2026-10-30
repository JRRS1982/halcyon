import type {
  BalancePoint,
  CashFlowPoint,
  ExpenditurePoint,
} from "@/lib/dashboard/series";
import { overallBrief } from "@/lib/insights/overallBrief";

const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const net = (month: string, value: number): BalancePoint => ({
  month,
  assetCurrent: value,
  assetMediumTerm: 0,
  assetLongTerm: 0,
  assetProperty: 0,
  assetOther: 0,
  liabilityCurrent: 0,
  liabilityMediumTerm: 0,
  liabilityLongTerm: 0,
  liabilityOther: 0,
  net: value,
});

const flow = (
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

const spend = (
  month: string,
  fixed: number,
  variable: number,
  discretionary: number,
): ExpenditurePoint => ({
  month,
  fixedActual: fixed,
  fixedBudget: 0,
  fixedAvg: 0,
  variableActual: variable,
  variableBudget: 0,
  variableAvg: 0,
  discretionaryActual: discretionary,
  discretionaryBudget: 0,
  discretionaryAvg: 0,
});

// The dashboard's headline is the overall picture across months. If it is
// wrong, a user is told their wealth grew when it fell.
describe("overallBrief", () => {
  test("leads with how net worth moved across the tracked months", () => {
    const brief = overallBrief({
      balance: [net("Nov 25", 300000), net("Oct 26", 348326)],
      cashFlow: [],
      expenditure: [],
      fmt,
    });
    expect(brief?.headline).toBe(
      "Net worth up £48,326 since Nov 25, to £348,326",
    );
  });

  test("says so when net worth fell", () => {
    const brief = overallBrief({
      balance: [net("Nov 25", 10000), net("Oct 26", 8000)],
      cashFlow: [],
      expenditure: [],
      fmt,
    });
    expect(brief?.headline).toBe(
      "Net worth down £2,000 since Nov 25, to £8,000",
    );
  });

  test("falls back to what was kept when there is no balance history", () => {
    const brief = overallBrief({
      balance: [],
      cashFlow: [flow("Sep 26", 4000, 3000), flow("Oct 26", 4000, 3000)],
      expenditure: [],
      fmt,
    });
    expect(brief?.headline).toBe("You kept 25% of your income over 2 months");
  });

  test("has nothing to say about an empty account", () => {
    expect(
      overallBrief({ balance: [], cashFlow: [], expenditure: [], fmt }),
    ).toBeNull();
  });

  test("totals what came in and what was kept", () => {
    const brief = overallBrief({
      balance: [],
      cashFlow: [flow("Sep 26", 4000, 3000), flow("Oct 26", 4000, 3500)],
      expenditure: [],
      fmt,
    });
    expect(brief?.standfirst).toBe(
      "Over 2 months you brought in £8,000 and kept £1,500 of it, 19% of your income.",
    );
  });

  test("counts the months that ended in surplus and names the weakest", () => {
    const brief = overallBrief({
      balance: [],
      cashFlow: [
        flow("Jul 26", 4000, 3000),
        flow("Aug 26", 4000, 4754),
        flow("Sep 26", 4000, 3500),
      ],
      expenditure: [],
      fmt,
    });
    expect(brief?.notes).toContainEqual({
      lead: "Months in surplus.",
      body: "2 of the last 3 months ended with money left over. The exception was Aug 26, £754 short.",
    });
  });

  test("names the spending section that has grown most lately", () => {
    const brief = overallBrief({
      balance: [],
      cashFlow: [flow("Oct 26", 4000, 3000)],
      expenditure: [
        spend("May 26", 1600, 600, 300),
        spend("Jun 26", 1600, 600, 300),
        spend("Jul 26", 1600, 600, 300),
        spend("Aug 26", 1600, 700, 300),
        spend("Sep 26", 1600, 700, 290),
        spend("Oct 26", 1600, 700, 310),
      ],
      fmt,
    });
    expect(brief?.notes).toContainEqual({
      lead: "What's growing.",
      body: "Variable spending averaged £700 a month over the last three months, up £100 on the three before.",
    });
  });

  test("names the strongest month", () => {
    const brief = overallBrief({
      balance: [],
      cashFlow: [flow("Feb 26", 4000, 3000), flow("Mar 26", 7200, 2400)],
      expenditure: [],
      fmt,
    });
    expect(brief?.notes).toContainEqual({
      lead: "Best month.",
      body: "Mar 26 left the most over: £4,800.",
    });
  });
});
