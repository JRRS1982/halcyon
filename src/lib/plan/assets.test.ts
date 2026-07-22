// src/lib/plan/assets.test.ts
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
});

describe("fundDeficit", () => {
  it("draws tax-free pots in priority order, no gross-up", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "isa", wrapper: "ISA", drawdownPriority: 1 }),
    ];
    const r = fundDeficit(assets, { cash: 5000, isa: 10000 }, 7000, 20, 40);
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
    const r = fundDeficit(assets, { sipp: 50000 }, 8000, 20, 65);
    expect(r.balances.sipp).toBe(40000);
    expect(r.withdrawnByAsset.sipp).toBe(10000);
    expect(r.withdrawalTax).toBe(2000);
    expect(r.totalWithdrawn).toBe(10000);
    expect(r.shortfall).toBe(false);
  });
  it("skips PROPERTY and flags a shortfall when liquid assets run out", () => {
    const assets = [
      asset({ id: "cash", wrapper: "CASH", drawdownPriority: 0 }),
      asset({ id: "house", wrapper: "PROPERTY", drawdownPriority: 1 }),
    ];
    const r = fundDeficit(assets, { cash: 3000, house: 400000 }, 5000, 20, 40);
    expect(r.withdrawnByAsset.cash).toBe(3000);
    expect(r.balances.house).toBe(400000);
    expect(r.shortfall).toBe(true);
  });
  it("does not mutate the input balances", () => {
    const assets = [asset({ id: "cash", wrapper: "CASH" })];
    const balances = { cash: 1000 };
    fundDeficit(assets, balances, 500, 20, 40);
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
    const before = fundDeficit([pension], { p: 100000 }, 10000, 0, 55);
    expect(before.shortfall).toBe(true);
    expect(before.totalWithdrawn).toBe(0);

    const after = fundDeficit([pension], { p: 100000 }, 10000, 0, 57);
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
    expect(fundDeficit([isa], { i: 100000 }, 10000, 0, 40).shortfall).toBe(
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
      fundDeficit([earlyPension], { p: 100000 }, 10000, 0, 52).shortfall,
    ).toBe(false);
  });
});
