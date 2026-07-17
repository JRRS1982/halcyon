import type { Wrapper, YearProjection } from "@/lib/plan";
import {
  cashFlowKeysPresent,
  liquidWrappersPresent,
  summariseCashFlow,
  toCashFlowChartData,
  toLiquidAssetsBandData,
  toLiquidAssetsChartData,
  toNetWorthBandData,
  toNetWorthChartData,
  wrappersPresent,
} from "./chartData";

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

describe("toCashFlowChartData", () => {
  const asset = (
    over: Partial<YearProjection["assets"][number]> & { id: string },
  ): YearProjection["assets"][number] => ({
    label: over.id,
    wrapper: "PENSION",
    value: 0,
    contributed: 0,
    withdrawn: 0,
    ...over,
  });

  it("splits withdrawals into positive per-asset segments and expenses/tax negative", () => {
    const rows = toCashFlowChartData([
      year({
        age: 70,
        incomeByKind: { STATE_PENSION: 9000 },
        expensesByCategory: { FIXED: 18000, DISCRETIONARY: 4000 },
        tax: 3000,
        assets: [
          asset({
            id: "pen",
            label: "SIPP",
            wrapper: "PENSION",
            withdrawn: 15000,
          }),
          asset({ id: "isa", label: "ISA", wrapper: "ISA", withdrawn: 5000 }),
        ],
      }),
    ]);
    expect(rows[0]).toMatchObject({
      age: 70,
      STATE_PENSION: 9000,
      "wd:pen": 15000,
      "wd:isa": 5000,
      FIXED: -18000,
      DISCRETIONARY: -4000,
      TAX: -3000,
      shortfall: false,
    });
  });

  it("splits contributions into negative per-asset segments", () => {
    const rows = toCashFlowChartData([
      year({
        age: 40,
        incomeByKind: { SALARY: 50000 },
        expensesByCategory: { FIXED: 20000 },
        tax: 8000,
        assets: [asset({ id: "pen", label: "SIPP", contributed: 5000 })],
      }),
    ]);
    expect(rows[0]).toMatchObject({
      SALARY: 50000,
      "co:pen": -5000,
      FIXED: -20000,
      TAX: -8000,
    });
  });

  it("computes net as the algebraic sum of the drawn segments (in − out)", () => {
    const rows = toCashFlowChartData([
      year({
        age: 40,
        incomeByKind: { SALARY: 50000 },
        expensesByCategory: { FIXED: 20000 },
        tax: 8000,
        liabilityRepayments: 6000,
        assets: [asset({ id: "pen", contributed: 5000 })],
      }),
    ]);
    // 50000 − (20000 + 8000 + 6000 + 5000) = 11000
    expect(rows[0]).toMatchObject({ net: 11000 });
  });

  it("carries the shortfall flag through", () => {
    const rows = toCashFlowChartData([year({ age: 90, shortfall: true })]);
    expect(rows[0]).toMatchObject({ shortfall: true });
  });

  it("cashFlowKeysPresent returns fixed keys plus per-asset segments in wrapper order", () => {
    const years = [
      year({
        age: 65,
        incomeByKind: { SALARY: 0, STATE_PENSION: 9000 },
        expensesByCategory: { FIXED: 15000 },
        tax: 2000,
        assets: [
          asset({ id: "isa", label: "ISA", wrapper: "ISA", withdrawn: 4000 }),
          asset({
            id: "pen",
            label: "SIPP",
            wrapper: "PENSION",
            withdrawn: 8000,
          }),
          asset({ id: "gia", label: "GIA", wrapper: "GIA", contributed: 3000 }),
        ],
      }),
    ];
    const rows = toCashFlowChartData(years);
    expect(cashFlowKeysPresent(rows, years)).toEqual({
      income: ["STATE_PENSION"],
      outflow: ["FIXED", "TAX"],
      withdrawals: [
        { key: "wd:pen", assetId: "pen", label: "SIPP", wrapper: "PENSION" },
        { key: "wd:isa", assetId: "isa", label: "ISA", wrapper: "ISA" },
      ],
      contributions: [
        { key: "co:gia", assetId: "gia", label: "GIA", wrapper: "GIA" },
      ],
    });
  });
});

describe("summariseCashFlow", () => {
  it("groups payload into money in/out with totals and net = in − out", () => {
    const model = summariseCashFlow([
      { name: "Salary", value: 50000, dataKey: "SALARY", color: "#1" },
      { name: "Withdraw SIPP", value: 5000, dataKey: "wd:pen", color: "#2" },
      { name: "Fixed", value: -20000, dataKey: "FIXED", color: "#3" },
      { name: "Tax", value: -8000, dataKey: "TAX", color: "#4" },
      { name: "Net", value: 27000, dataKey: "net", color: "#5" },
    ]);
    expect(model).toEqual({
      moneyIn: [
        { name: "Salary", value: 50000, color: "#1" },
        { name: "Withdraw SIPP", value: 5000, color: "#2" },
      ],
      moneyOut: [
        { name: "Fixed", value: 20000, color: "#3" },
        { name: "Tax", value: 8000, color: "#4" },
      ],
      totalIn: 55000,
      totalOut: 28000,
      net: 27000,
    });
  });

  it("excludes the net line and zero entries", () => {
    const model = summariseCashFlow([
      { name: "Salary", value: 40000, dataKey: "SALARY" },
      { name: "Withdraw GIA", value: 0, dataKey: "wd:gia" },
      { name: "Net", value: 40000, dataKey: "net" },
    ]);
    expect(model.moneyOut).toEqual([]);
    expect(model.totalIn).toBe(40000);
    expect(model.net).toBe(40000);
  });
});

const liquidAsset = (
  wrapper: Wrapper,
  value: number,
  id = wrapper,
): YearProjection["assets"][number] => ({
  id,
  label: id,
  wrapper,
  value,
  contributed: 0,
  withdrawn: 0,
});

describe("toLiquidAssetsChartData", () => {
  it("sums only liquid wrappers and excludes PROPERTY and DB_PENSION", () => {
    const rows = toLiquidAssetsChartData([
      year({
        age: 50,
        assets: [
          liquidAsset("PENSION", 80000),
          liquidAsset("ISA", 20000),
          liquidAsset("CASH", 10000),
          liquidAsset("PROPERTY", 300000),
          liquidAsset("DB_PENSION", 50000),
        ],
      }),
    ]);
    expect(rows[0]).toMatchObject({
      age: 50,
      PENSION: 80000,
      ISA: 20000,
      CASH: 10000,
      total: 110000,
    });
    const row = rows[0];
    if (row) {
      expect(row.PROPERTY).toBeUndefined();
      expect(row.DB_PENSION).toBeUndefined();
    }
  });

  it("liquidWrappersPresent lists present liquid wrappers in canonical order", () => {
    const rows = toLiquidAssetsChartData([
      year({
        age: 50,
        assets: [liquidAsset("CASH", 10000), liquidAsset("PENSION", 5000)],
      }),
    ]);
    expect(liquidWrappersPresent(rows)).toEqual(["PENSION", "CASH"]);
  });
});

describe("toNetWorthBandData", () => {
  it("carries a sorted [low, high] net-worth range alongside the mid composition", () => {
    const mk = (nw: number) => [
      {
        age: 40,
        netWorth: nw,
        liabilitiesTotal: 0,
        assets: [
          {
            id: "x",
            label: "X",
            wrapper: "GIA",
            value: nw,
            contributed: 0,
            withdrawn: 0,
          },
        ],
      } as unknown as YearProjection,
    ];
    const rows = toNetWorthBandData(mk(80), mk(100), mk(130));
    expect(rows[0]?.netWorth).toBe(100);
    expect(rows[0]?.nwRange).toEqual([80, 130]);
  });

  it("orders the range even if a low pass overtakes a high pass", () => {
    const mk = (nw: number) => [
      {
        age: 40,
        netWorth: nw,
        liabilitiesTotal: 0,
        assets: [],
      } as unknown as YearProjection,
    ];
    const rows = toNetWorthBandData(mk(130), mk(100), mk(80));
    expect(rows[0]?.nwRange).toEqual([80, 130]);
  });
});

describe("toLiquidAssetsBandData", () => {
  it("carries a [low, high] total range alongside the mid pots", () => {
    const mk = (v: number) => [
      {
        age: 40,
        netWorth: 0,
        liabilitiesTotal: 0,
        assets: [
          {
            id: "c",
            label: "Cash",
            wrapper: "CASH",
            value: v,
            contributed: 0,
            withdrawn: 0,
          },
        ],
      } as unknown as YearProjection,
    ];
    const rows = toLiquidAssetsBandData(mk(20), mk(50), mk(70));
    expect(rows[0]?.total).toBe(50);
    expect(rows[0]?.totalRange).toEqual([20, 70]);
  });
});
