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

describe("liabilityStep interest/principal split", () => {
  it("splits a repayment into interest then principal", () => {
    const r = liabilityStep([mortgage], { m: 100000 }, 40); // 5% on 100k = 5000 interest, 12000 paid
    expect(r.byLiability.m?.interest).toBeCloseTo(5000);
    expect(r.byLiability.m?.principal).toBeCloseTo(7000);
    expect(
      (r.byLiability.m?.interest ?? 0) + (r.byLiability.m?.principal ?? 0),
    ).toBeCloseTo(r.repaid);
  });
  it("counts an underpayment (below interest) as all interest, zero principal", () => {
    const r = liabilityStep(
      [{ ...mortgage, monthlyRepayment: 100 }],
      { m: 100000 },
      40,
    ); // 1200 paid < 5000 interest
    expect(r.byLiability.m?.interest).toBeCloseTo(1200);
    expect(r.byLiability.m?.principal).toBe(0);
  });
});

describe("liabilityStep interestOnly", () => {
  const io = { ...mortgage, interestOnly: true };
  it("pays only the interest and leaves the balance flat", () => {
    const r = liabilityStep([io], { m: 100000 }, 40); // 5% interest-only
    expect(r.balances.m).toBeCloseTo(100000);
    expect(r.repaid).toBeCloseTo(5000);
    expect(r.byLiability.m).toEqual({
      interest: expect.closeTo(5000),
      principal: 0,
    });
  });
  it("ignores the repayment amount when interest-only", () => {
    const r = liabilityStep(
      [{ ...io, monthlyRepayment: 9999 }],
      { m: 100000 },
      40,
    );
    expect(r.repaid).toBeCloseTo(5000); // still just the interest
    expect(r.balances.m).toBeCloseTo(100000);
  });
});
