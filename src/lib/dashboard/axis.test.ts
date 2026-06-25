import { padAxisMax, padAxisMin } from "./axis";

describe("padded axis bounds", () => {
  it("drops the lower bound 10% below the data min", () => {
    expect(padAxisMin(500)).toBe(450);
  });

  it("lifts the upper bound 10% above the data max", () => {
    expect(padAxisMax(500)).toBe(550);
  });

  it("keeps the data inside the padded range for a narrow band", () => {
    // A line living in 400..520 should sit comfortably inside the axis.
    expect(padAxisMin(400)).toBeLessThan(400);
    expect(padAxisMax(520)).toBeGreaterThan(520);
  });

  it("rounds to whole currency units (floor low, ceil high)", () => {
    expect(padAxisMin(133)).toBe(119); // 133 - 13.3 = 119.7 -> floor 119
    expect(padAxisMax(133)).toBe(147); // 133 + 13.3 = 146.3 -> ceil 147
  });

  it("leaves a zero bound at zero so a category that touches zero still anchors", () => {
    expect(padAxisMin(0)).toBe(0);
  });

  it("pads symmetrically by magnitude for negative values", () => {
    expect(padAxisMin(-200)).toBe(-220);
    expect(padAxisMax(-200)).toBe(-180);
  });
});
