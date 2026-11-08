import { fittedAxis } from "@/lib/dashboard/axis";

// The per-category charts fit their axis to the user's own figures. If this is
// wrong, a user reads gridlines labelled £342, £542, £742 — numbers that look
// like data rather than scale — or sees a flat debt drawn as a cliff.
describe("fittedAxis", () => {
  const every = (axis: { ticks: number[] }, step: number) =>
    axis.ticks.every((t) => t % step === 0);

  it("lands every gridline on a round step", () => {
    // The demo's current liabilities: the old padded domain drew £342…£968.
    const axis = fittedAxis([342, 640, 968, 530]);
    expect(axis.ticks).toEqual([200, 400, 600, 800, 1000, 1200]);
  });

  it("keeps every value inside the axis", () => {
    const values = [1560, 1610, 1815, 1700];
    const { domain } = fittedAxis(values);
    expect(domain[0]).toBeLessThan(Math.min(...values));
    expect(domain[1]).toBeGreaterThan(Math.max(...values));
  });

  it("starts the axis on the first tick and ends it on the last", () => {
    const axis = fittedAxis([1560, 1815]);
    expect(axis.domain).toEqual([axis.ticks[0], axis.ticks.at(-1)]);
    expect(every(axis, 200)).toBe(true);
  });

  // Padding by a tenth of the value, not of the range, is what keeps a nearly
  // flat £172k mortgage reading as nearly flat.
  it("draws a small move on a large balance as a small move", () => {
    const axis = fittedAxis([172_700, 170_600]);
    const span = axis.domain[1] - axis.domain[0];
    expect(span).toBeGreaterThanOrEqual(30_000);
  });

  it("never drops below zero for figures that never do", () => {
    const axis = fittedAxis([121, 300, 2300]);
    expect(axis.domain[0]).toBe(0);
  });

  it("anchors a series that touches zero at zero", () => {
    expect(fittedAxis([0, 450, 900]).domain[0]).toBe(0);
  });

  it("gives an empty or all-zero series a usable axis", () => {
    for (const values of [[], [0, 0, 0]]) {
      const { domain, ticks } = fittedAxis(values);
      expect(domain[1]).toBeGreaterThan(domain[0]);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
    }
  });
});
