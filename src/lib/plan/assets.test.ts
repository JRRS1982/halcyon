// src/lib/plan/assets.test.ts
import { taxOn } from "@/lib/tax/compute";
import { contributionTargetId, fundDeficit } from "./assets";
import type { AssetInput } from "./types";

const asset = (over: Partial<AssetInput> & { id: string }): AssetInput => ({
  label: over.id,
  wrapper: "GIA",
  openingValue: 0,
  drawdownPriority: 0,
  ...over,
});

describe("contributionTargetId", () => {
  it("prefers the CASH account (the buffer)", () => {
    const assets = [
      asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 3 }),
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
    ];
    expect(contributionTargetId(assets)).toBe("cash");
  });
  it("falls back to the most-liquid non-PROPERTY asset when there is no cash", () => {
    const assets = [
      asset({ id: "gia", wrapper: "GIA", drawdownPriority: 2 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 0 }),
    ];
    expect(contributionTargetId(assets)).toBe("isa");
  });
  it("returns null when there are no assets", () => {
    expect(contributionTargetId([])).toBeNull();
  });
  it("returns null when the only assets are PROPERTY (never a contribution target)", () => {
    const assets = [
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 0 }),
      asset({ id: "flat", wrapper: "PROPERTY", drawdownPriority: 1 }),
    ];
    expect(contributionTargetId(assets)).toBeNull();
  });
  // A CASH account carrying an entitlement is reachable — a FINAL_SALARY
  // account corrected to SAVINGS keeps its annualIncome — and an entitled
  // row's balance is zeroed every year. Targeted, the year's surplus would be
  // paid in and then vanish, with no shortfall reported anywhere.
  it("skips a CASH account that carries an entitlement", () => {
    const assets = [
      asset({ id: "db", wrapper: "CASH", annualIncome: 9000 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
    ];
    expect(contributionTargetId(assets)).toBe("isa");
  });
  it("returns null when the only asset is an entitlement", () => {
    const assets = [asset({ id: "db", wrapper: "CASH", annualIncome: 9000 })];
    expect(contributionTargetId(assets)).toBeNull();
  });
});

describe("fundDeficit", () => {
  const ctx = (alreadyTaxed = 0, thresholdScale = 1) =>
    ({
      alreadyTaxed,
      year: "2025/26",
      regime: "RUK",
      thresholdScale,
    }) as const;

  it("draws tax-free pots in priority order, no gross-up", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
    ];
    const r = fundDeficit(assets, { cash: 5000, isa: 10000 }, 7000, ctx(), 40);
    expect(r.shortfall).toBe(false);
    expect(r.withdrawalTax).toBe(0);
    expect(r.balances.cash).toBe(0);
    expect(r.balances.isa).toBe(8000);
    expect(r.withdrawnByAsset).toEqual({ cash: 5000, isa: 2000 });
    expect(r.totalWithdrawn).toBe(7000);
  });
  it("grosses up a taxable pot so the net need is met and books the tax", () => {
    const assets = [
      asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 0 }),
    ];
    // 20000 of income has already used the allowance and 7430 of the 20% band,
    // so the whole draw sits at 20%: 8000 net costs 8000 / 0.8 = 10000 gross.
    const r = fundDeficit(assets, { sipp: 50000 }, 8000, ctx(20000), 65);
    expect(r.balances.sipp).toBe(40000);
    expect(r.withdrawnByAsset.sipp).toBe(10000);
    expect(r.withdrawalTax).toBe(2000);
    expect(r.totalWithdrawn).toBe(10000);
    expect(r.shortfall).toBe(false);
  });
  it("leaves a draw inside the unused personal allowance untaxed", () => {
    const assets = [
      asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 0 }),
    ];
    const r = fundDeficit(assets, { sipp: 50000 }, 8000, ctx(), 65);
    expect(r.withdrawnByAsset.sipp).toBe(8000);
    expect(r.withdrawalTax).toBe(0);
  });
  it("stacks a second taxable pot on the first, not on a fresh allowance", () => {
    const assets = [
      asset({ id: "p1", wrapper: "PENSION", drawdownPriority: 0 }),
      asset({ id: "p2", wrapper: "PENSION", drawdownPriority: 1 }),
    ];
    // p1 (20000) is drained: 1486 tax, 18514 net. p2 then covers the remaining
    // 21486 net starting at 20000 of income already taxed, costing 26857 gross
    // and 5371 tax. 46857 gross, 6857 tax — one income split in two.
    const r = fundDeficit(assets, { p1: 20000, p2: 100000 }, 40000, ctx(), 65);
    expect(r.withdrawnByAsset).toEqual({ p1: 20000, p2: 26857 });
    expect(r.totalWithdrawn).toBe(46857);
    expect(r.withdrawalTax).toBe(6857);
    expect(r.withdrawalTax).toBe(
      taxOn({
        income: r.totalWithdrawn,
        year: "2025/26",
        regime: "RUK",
        thresholdScale: 1,
      }).tax,
    );
    expect(r.shortfall).toBe(false);
  });
  // grossFor's never-under-fund nudge rounds up to the nearest whole pound,
  // so a need within £1 of what a full drain nets can round to a gross above
  // a non-integer balance. Left alone that closes the pot negative, and
  // grow() compounds a negative balance forever. balance=5000.01,
  // need=5000.009 previously produced gross=5001 (closing balance −£0.99);
  // widening the drain condition to catch a computed gross at or above the
  // balance must route this through the drain branch instead, closing at
  // exactly zero.
  it("never closes a pot below zero, even in grossFor's rounding knife-edge", () => {
    const assets = [
      asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 0 }),
    ];
    const r = fundDeficit(assets, { sipp: 5000.01 }, 5000.009, ctx(), 65);
    expect(r.balances.sipp).toBe(0);
    expect(r.withdrawnByAsset.sipp).toBe(5000.01);
  });
  it("skips PROPERTY and flags a shortfall when liquid assets run out", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 1 }),
    ];
    const r = fundDeficit(
      assets,
      { cash: 3000, house: 400000 },
      5000,
      ctx(),
      40,
    );
    expect(r.withdrawnByAsset.cash).toBe(3000);
    expect(r.balances.house).toBe(400000);
    expect(r.shortfall).toBe(true);
  });
  it("does not mutate the input balances", () => {
    const assets = [asset({ id: "cash", wrapper: "CASH" })];
    const balances = { cash: 1000 };
    fundDeficit(assets, balances, 500, ctx(), 40);
    expect(balances.cash).toBe(1000);
  });

  it("skips a pension before its access age, funds it at/after", () => {
    const pension = {
      id: "p",
      label: "SIPP",
      wrapper: "PENSION" as const,
      openingValue: 100000,
      drawdownPriority: 1,
    };
    const before = fundDeficit([pension], { p: 100000 }, 10000, ctx(), 55);
    expect(before.shortfall).toBe(true);
    expect(before.totalWithdrawn).toBe(0);

    const after = fundDeficit([pension], { p: 100000 }, 10000, ctx(), 57);
    expect(after.shortfall).toBe(false);
    expect(after.totalWithdrawn).toBeGreaterThan(0);
  });

  it("does not gate a non-pension asset and honours an explicit minAccessAge", () => {
    const isa = {
      id: "i",
      label: "ISA",
      wrapper: "ISA" as const,
      openingValue: 100000,
      drawdownPriority: 1,
    };
    expect(fundDeficit([isa], { i: 100000 }, 10000, ctx(), 40).shortfall).toBe(
      false,
    );

    const earlyPension = {
      id: "p",
      label: "SIPP",
      wrapper: "PENSION" as const,
      openingValue: 100000,
      minAccessAge: 50,
      drawdownPriority: 1,
    };
    expect(
      fundDeficit([earlyPension], { p: 100000 }, 10000, ctx(), 52).shortfall,
    ).toBe(false);
  });

  it("scales thresholds down the tax bill on a withdrawal that reaches beyond the basic band", () => {
    const pension = [
      asset({ id: "sipp", wrapper: "PENSION", drawdownPriority: 0 }),
    ];
    const balances = { sipp: 500000 };
    // £100,000 net on top of £30,000 already-taxed income, RUK, 2025/26 —
    // reaches through the 20/40/60 bands into the 45% top band either way.
    // Hand-derived from the band walk in src/lib/tax/compute.ts:
    //   unscaled (thresholdScale 1): allowance 12,570, used = 30,000 −
    //   12,570 = 17,430 already inside the 20% band. Remaining band widths
    //   post-`used`: 20,270 @20% (nets 16,216), 49,730 @40% (nets 29,838),
    //   25,140 @60% (nets 10,056) = 56,110 net across 95,140 gross, leaving
    //   43,890 net still owed at 45%: 43,890 / 0.55 = 79,800 gross. Total
    //   gross = 20,270 + 49,730 + 25,140 + 79,800 = 174,940; tax = 174,940 −
    //   100,000 = 74,940.
    //   scaled (thresholdScale = 1.03**30 ≈ 2.427262, 30 years of 3%
    //   inflation): every threshold above widens by that factor, so more of
    //   the withdrawal lands in the lower bands. Working the same walk with
    //   each ceiling multiplied by 2.427262 gives gross 135,823 and tax
    //   35,823 (verified by direct calculation against the same formulas as
    //   taxOn/grossFor, not read off a test run).
    const scale = 1.03 ** 30;
    const unscaled = fundDeficit(pension, balances, 100000, ctx(30000, 1), 65);
    const scaled = fundDeficit(
      pension,
      balances,
      100000,
      ctx(30000, scale),
      65,
    );

    expect(unscaled.totalWithdrawn).toBe(174940);
    expect(unscaled.withdrawalTax).toBe(74940);
    expect(scaled.totalWithdrawn).toBe(135823);
    expect(scaled.withdrawalTax).toBe(35823);
    expect(scaled.totalWithdrawn).toBeLessThan(unscaled.totalWithdrawn);
    expect(scaled.withdrawalTax).toBeLessThan(unscaled.withdrawalTax);
  });
});
