import { amountAxis, makeAmountTick } from "./chartFormat";

describe("makeAmountTick", () => {
  const tick = makeAmountTick("GBP");

  it("renders thousands rounded to k with the currency symbol", () => {
    expect(tick(1500)).toBe("£2k");
    expect(tick(80000)).toBe("£80k");
  });

  it("renders sub-1000 amounts in full", () => {
    expect(tick(500)).toBe("£500");
    expect(tick(0)).toBe("£0");
  });

  it("renders millions with an m suffix, trailing zeros trimmed", () => {
    expect(tick(1_000_000)).toBe("£1m");
    expect(tick(1_500_000)).toBe("£1.5m");
    expect(tick(12_250_000)).toBe("£12.25m");
    expect(tick(7_000_000)).toBe("£7m");
    expect(tick(-2_000_000)).toBe("-£2m");
  });

  it("prefixes negatives with an ASCII minus", () => {
    expect(tick(-2000)).toBe("-£2k");
  });

  it("falls back to $ for an unknown currency code", () => {
    expect(makeAmountTick("ZZZ")(1000)).toBe("$1k");
  });
});

describe("amountAxis", () => {
  it("rounds the domain outward to the step and lands ticks on it", () => {
    const { domain, ticks } = amountAxis(120_000, 610_000, 250_000);
    expect(domain).toEqual([0, 750_000]);
    expect(ticks).toEqual([0, 250_000, 500_000, 750_000]);
  });

  it("always includes 0 and spans negatives (cash-flow style)", () => {
    const { domain, ticks } = amountAxis(-32_000, 41_000, 10_000);
    expect(domain).toEqual([-40_000, 50_000]);
    expect(ticks[0]).toBe(-40_000);
    expect(ticks).toContain(0);
    expect(ticks[ticks.length - 1]).toBe(50_000);
  });

  it("collapses an all-zero / empty series to a single [0, step] interval", () => {
    expect(
      amountAxis(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 250_000),
    ).toEqual({
      domain: [0, 250_000],
      ticks: [0, 250_000],
    });
  });
});
