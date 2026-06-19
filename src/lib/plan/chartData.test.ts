import type { YearProjection } from "@/lib/plan";
import { toNetWorthChartData, wrappersPresent } from "./chartData";

const year = (
  over: Partial<YearProjection> & { age: number },
): YearProjection => ({
  year: 2000 + over.age,
  grossIncome: 0,
  incomeByKind: {},
  tax: 0,
  netIncome: 0,
  expensesByCategory: {},
  totalExpenses: 0,
  liabilityRepayments: 0,
  surplus: 0,
  contributions: 0,
  withdrawals: 0,
  assets: [],
  liabilities: [],
  liabilitiesTotal: 0,
  netWorth: 0,
  shortfall: false,
  ...over,
});

describe("toNetWorthChartData", () => {
  it("aggregates assets by wrapper (positive) and debt as one negative segment", () => {
    const rows = toNetWorthChartData([
      year({
        age: 40,
        netWorth: 90000,
        assets: [
          {
            id: "a",
            label: "SIPP",
            wrapper: "PENSION",
            value: 80000,
            contributed: 0,
            withdrawn: 0,
          },
          {
            id: "b",
            label: "Cash",
            wrapper: "CASH",
            value: 30000,
            contributed: 0,
            withdrawn: 0,
          },
        ],
        liabilities: [{ id: "m", label: "Mortgage", value: 20000 }],
        liabilitiesTotal: 20000,
      }),
    ]);
    expect(rows[0]).toMatchObject({
      age: 40,
      PENSION: 80000,
      CASH: 30000,
      debt: -20000,
      netWorth: 90000,
    });
  });

  it("wrappersPresent lists only wrappers with a non-zero value, in WRAPPERS order", () => {
    const rows = toNetWorthChartData([
      year({
        age: 40,
        assets: [
          {
            id: "b",
            label: "Cash",
            wrapper: "CASH",
            value: 30000,
            contributed: 0,
            withdrawn: 0,
          },
        ],
      }),
    ]);
    expect(wrappersPresent(rows)).toEqual(["CASH"]);
  });
});
