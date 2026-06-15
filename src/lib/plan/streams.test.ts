// src/lib/plan/streams.test.ts
import { activeExpenses, activeIncome } from "./streams";
import type { ExpenseInput, IncomeInput } from "./types";

const salary: IncomeInput = {
  id: "s",
  label: "Salary",
  kind: "SALARY",
  annualAmount: 50000,
  endAge: 64,
  growth: { kind: "NONE" },
  taxable: true,
};

describe("activeIncome", () => {
  it("totals gross, by-kind, and taxable for an active salary", () => {
    const r = activeIncome([salary], undefined, 40, 0, 2.5);
    expect(r.gross).toBe(50000);
    expect(r.byKind.SALARY).toBe(50000);
    expect(r.taxableTotal).toBe(50000);
  });
  it("excludes a stream past its endAge", () => {
    expect(activeIncome([salary], undefined, 65, 25, 2.5).gross).toBe(0);
  });
  it("grows an inflation-linked stream over elapsed years", () => {
    const p: IncomeInput = {
      id: "p",
      label: "DB",
      kind: "DB_PENSION",
      annualAmount: 10000,
      startAge: 60,
      growth: { kind: "INFLATION" },
      taxable: true,
    };
    expect(activeIncome([p], undefined, 62, 22, 10).gross).toBeCloseTo(
      10000 * 1.1 ** 22,
      0,
    );
  });
  it("grows a fixed-growth stream by its own rate", () => {
    const rent: IncomeInput = {
      id: "r",
      label: "Rent",
      kind: "RENTAL",
      annualAmount: 12000,
      growth: { kind: "FIXED", pct: 3 },
      taxable: true,
    };
    expect(activeIncome([rent], undefined, 42, 2, 2.5).gross).toBeCloseTo(
      12000 * 1.03 ** 2,
      0,
    );
  });
  it("adds the state pension (taxable) from its start age", () => {
    const before = activeIncome(
      [],
      { startAge: 67, annualAmount: 11000 },
      66,
      26,
      0,
    );
    const after = activeIncome(
      [],
      { startAge: 67, annualAmount: 11000 },
      67,
      27,
      0,
    );
    expect(before.gross).toBe(0);
    expect(after.byKind.STATE_PENSION).toBe(11000);
    expect(after.taxableTotal).toBe(11000);
  });
  it("keeps non-taxable income in gross/byKind but out of taxableTotal", () => {
    const tf: IncomeInput = {
      id: "t",
      label: "TaxFree",
      kind: "OTHER",
      annualAmount: 5000,
      growth: { kind: "NONE" },
      taxable: false,
    };
    const r = activeIncome([tf], undefined, 40, 0, 2.5);
    expect(r.byKind.OTHER).toBe(5000);
    expect(r.taxableTotal).toBe(0);
  });
});

const living: ExpenseInput = {
  id: "l",
  label: "Living",
  category: "FIXED",
  annualAmount: 24000,
  inflationLinked: true,
};

describe("activeExpenses", () => {
  it("totals active expenses and groups by category", () => {
    const r = activeExpenses([living], 40, 0, 2.5);
    expect(r.total).toBe(24000);
    expect(r.byCategory.FIXED).toBe(24000);
  });
  it("inflates inflation-linked expenses", () => {
    expect(activeExpenses([living], 50, 10, 10).total).toBeCloseTo(
      24000 * 1.1 ** 10,
      0,
    );
  });
  it("does not inflate when inflationLinked is false", () => {
    expect(
      activeExpenses(
        [{ ...living, id: "f", inflationLinked: false }],
        50,
        10,
        10,
      ).total,
    ).toBe(24000);
  });
  it("excludes expenses outside their age window", () => {
    const uni: ExpenseInput = {
      id: "u",
      label: "Uni",
      category: "DISCRETIONARY",
      annualAmount: 13000,
      startAge: 54,
      endAge: 60,
      inflationLinked: true,
    };
    expect(activeExpenses([uni], 53, 13, 0).total).toBe(0);
    expect(activeExpenses([uni], 54, 14, 0).total).toBe(13000);
    expect(activeExpenses([uni], 61, 21, 0).total).toBe(0);
  });
  it("buckets uncategorised under UNCATEGORISED", () => {
    const m: ExpenseInput = {
      id: "m",
      label: "Misc",
      annualAmount: 1000,
      inflationLinked: false,
    };
    expect(activeExpenses([m], 40, 0, 2.5).byCategory.UNCATEGORISED).toBe(1000);
  });
});
