import { makeAmountTick } from "./chartFormat";

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

  it("prefixes negatives with an ASCII minus", () => {
    expect(tick(-2000)).toBe("-£2k");
  });

  it("falls back to $ for an unknown currency code", () => {
    expect(makeAmountTick("ZZZ")(1000)).toBe("$1k");
  });
});
