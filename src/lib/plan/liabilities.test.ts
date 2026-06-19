// src/lib/plan/liabilities.test.ts
import { liabilityStep } from "./liabilities";
import type { LiabilityInput } from "./types";

const mortgage: LiabilityInput = {
  id: "m",
  label: "Mortgage",
  openingBalance: 100000,
  interestPct: 5,
  monthlyRepayment: 1000,
};

describe("liabilityStep", () => {
  it("accrues interest then repays, returning the year's repayment", () => {
    const r = liabilityStep([mortgage], { m: 100000 }, 40);
    expect(r.repaid).toBe(12000);
    expect(r.balances.m).toBeCloseTo(93000);
  });
  it("repays only down to zero and reports the smaller repayment", () => {
    const r = liabilityStep([mortgage], { m: 5000 }, 40);
    expect(r.balances.m).toBe(0);
    expect(r.repaid).toBeCloseTo(5250);
  });
  it("is inert once the balance is zero", () => {
    const r = liabilityStep([mortgage], { m: 0 }, 40);
    expect(r.repaid).toBe(0);
  });
  it("stops after endAge", () => {
    const r = liabilityStep([{ ...mortgage, endAge: 59 }], { m: 50000 }, 60);
    expect(r.repaid).toBe(0);
    expect(r.balances.m).toBe(50000);
  });
  it("does not mutate the input balances", () => {
    const balances = { m: 100000 };
    liabilityStep([mortgage], balances, 40);
    expect(balances.m).toBe(100000);
  });
});
