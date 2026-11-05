import {
  ageTicks,
  amountAxis,
  makeAmountTick,
  niceStep,
} from "@/lib/charts/format";

describe("makeAmountTick", () => {
  const tick = makeAmountTick("GBP");

  it("renders thousands as k with the currency symbol", () => {
    expect(tick(1500)).toBe("£1.5k");
    expect(tick(80000)).toBe("£80k");
  });

  it("trims a trailing zero rather than printing £3.0k", () => {
    expect(tick(3000)).toBe("£3k");
  });

  // The bug this replaced: rounding to whole thousands gave two different
  // gridlines the same label. The dashboard's cash-flow axis leaves tick
  // selection to Recharts, so it really does land on values like these.
  it("gives distinct gridlines distinct labels", () => {
    const labels = [750, 1500, 2250, 3000].map(tick);
    expect(labels).toEqual(["£750", "£1.5k", "£2.3k", "£3k"]);
    expect(new Set(labels).size).toBe(labels.length);
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

// If this is wrong, a phone user reads a forecast axis of 18 crowded ages, or
// one that starts or ends at an age the plan never reaches.
describe("ageTicks", () => {
  test("lands on the multiples of five within the plan's ages", () => {
    expect(ageTicks([44, 45, 46, 60, 71])).toEqual([45, 50, 55, 60, 65, 70]);
  });

  test("takes a wider step, and gives nothing for no data", () => {
    expect(ageTicks([44, 95], 10)).toEqual([50, 60, 70, 80, 90]);
    expect(ageTicks([])).toEqual([]);
  });
});

// If this is wrong, the dashboard's balance axis reads £259.4k, £385.8k — real
// gridlines that no one can read a value off.
describe("niceStep", () => {
  test("rounds to 1, 2 or 5 times a power of ten", () => {
    expect(niceStep(-173_000, 350_000)).toBe(200_000);
    expect(niceStep(0, 9_000)).toBe(5_000);
    expect(niceStep(400, 1_000)).toBe(200);
  });

  test("survives a flat series", () => {
    expect(niceStep(5, 5)).toBe(1);
  });
});
