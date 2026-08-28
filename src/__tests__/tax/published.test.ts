import { publishedRates } from "@/lib/tax/published";

// These are the figures HMRC and gov.scot publish for 2025/26, written out
// here rather than derived — so this file is an independent statement of what
// the table ought to hold, and fails if the stored bands drift from it.
describe("publishedRates — rest of UK", () => {
  const rates = publishedRates("2025/26", "RUK");

  test("states the personal allowance and the taper in published terms", () => {
    expect(rates.year).toBe("2025/26");
    expect(rates.personalAllowance).toBe(12_570);
    expect(rates.taper).toEqual({ from: 100_000, perPounds: 2 });
  });

  test("has three bands, at the published rates and thresholds", () => {
    expect(rates.bands).toEqual([
      { name: "Basic rate", ratePct: 20, from: 12_571, to: 50_270 },
      { name: "Higher rate", ratePct: 40, from: 50_271, to: 125_140 },
      { name: "Additional rate", ratePct: 45, from: 125_141, to: null },
    ]);
  });

  // The stored table models the taper as a 60% band. Nobody publishes a 60%
  // band, so it must not reach the card.
  test("shows no 60% band", () => {
    expect(rates.bands.map((b) => b.ratePct)).not.toContain(60);
  });
});

describe("publishedRates — Scotland", () => {
  const rates = publishedRates("2025/26", "SCOTLAND");

  test("has six bands, at the published rates and thresholds", () => {
    expect(rates.bands).toEqual([
      { name: "Starter rate", ratePct: 19, from: 12_571, to: 15_397 },
      { name: "Basic rate", ratePct: 20, from: 15_398, to: 27_491 },
      { name: "Intermediate rate", ratePct: 21, from: 27_492, to: 43_662 },
      { name: "Higher rate", ratePct: 42, from: 43_663, to: 75_000 },
      { name: "Advanced rate", ratePct: 45, from: 75_001, to: 125_140 },
      { name: "Top rate", ratePct: 48, from: 125_141, to: null },
    ]);
  });

  test("shows no 67.5% band", () => {
    expect(rates.bands.map((b) => b.ratePct)).not.toContain(67.5);
  });
});
