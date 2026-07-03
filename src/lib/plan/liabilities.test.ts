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

describe("liabilityStep startAge + external payments", () => {
  const mortgage = {
    id: "m1",
    label: "Mortgage",
    openingBalance: 100000,
    interestPct: 10,
    monthlyRepayment: 100,
    startAge: 50,
  };

  it("accrues no interest and takes no repayment before startAge", () => {
    const r = liabilityStep([mortgage], { m1: 100000 }, 49);
    expect(r.balances.m1).toBe(100000);
    expect(r.repaid).toBe(0);
  });

  it("operates normally from startAge", () => {
    const r = liabilityStep([mortgage], { m1: 100000 }, 50);
    expect(r.balances.m1).toBe(100000 * 1.1 - 1200);
    expect(r.repaid).toBe(1200);
  });

  it("uses a provided annual payment over monthlyRepayment", () => {
    const r = liabilityStep([mortgage], { m1: 100000 }, 50, { m1: 20000 });
    expect(r.balances.m1).toBe(100000 * 1.1 - 20000);
    expect(r.repaid).toBe(20000);
  });

  it("caps the provided payment at the post-interest balance", () => {
    const r = liabilityStep([mortgage], { m1: 100 }, 50, { m1: 99999 });
    expect(r.balances.m1).toBe(0);
    expect(r.repaid).toBeCloseTo(110);
  });
});
