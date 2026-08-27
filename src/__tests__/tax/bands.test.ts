import { taxContextFor } from "@/lib/tax/bands";

// The anchor: 2025/26 ends in calendar 2026, so a projection year is served by
// the 2025/26 table unscaled through calendar 2026, and calendar 2027 is the
// first year one full year of inflation applies.

test("thresholdScale defaults to 1 for the anchor year, whether or not linked", () => {
  expect(
    taxContextFor({
      projectionYear: 2026,
      regime: "RUK",
      inflationPct: 2.5,
      inflationLinked: true,
    }).thresholdScale,
  ).toBe(1);
  expect(
    taxContextFor({
      projectionYear: 2026,
      regime: "RUK",
      inflationPct: 2.5,
      inflationLinked: false,
    }).thresholdScale,
  ).toBe(1);
});

test("toggle off: scale is 1 at any projection year, however far out", () => {
  for (const projectionYear of [2026, 2027, 2046, 2100]) {
    expect(
      taxContextFor({
        projectionYear,
        regime: "RUK",
        inflationPct: 2.5,
        inflationLinked: false,
      }).thresholdScale,
    ).toBe(1);
  }
});

test("toggle on: scale is 1 through the anchor year, then compounds from the year after", () => {
  const scaleAt = (projectionYear: number) =>
    taxContextFor({
      projectionYear,
      regime: "RUK",
      inflationPct: 2.5,
      inflationLinked: true,
    }).thresholdScale;

  expect(scaleAt(2025)).toBe(1);
  expect(scaleAt(2026)).toBe(1);
  expect(scaleAt(2027)).toBe(1.025 ** 1);
  expect(scaleAt(2046)).toBe(1.025 ** 20);
});
