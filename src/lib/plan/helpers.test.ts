// src/lib/plan/helpers.test.ts
import { amountThisYear, grow, isActive, round, sum } from "./helpers";

describe("plan helpers", () => {
  it("round → nearest whole pound", () => {
    expect(round(100.4)).toBe(100);
    expect(round(100.5)).toBe(101);
  });
  it("grow → applies a percentage", () => {
    expect(grow(10000, 10)).toBeCloseTo(11000);
    expect(grow(10000, 0)).toBe(10000);
  });
  it("amountThisYear → compounds growth over elapsed years", () => {
    expect(amountThisYear(1000, 0, 5)).toBeCloseTo(1000);
    expect(amountThisYear(1000, 10, 2)).toBeCloseTo(1210);
  });
  it("isActive → respects optional age bounds", () => {
    expect(isActive(40)).toBe(true);
    expect(isActive(40, 41)).toBe(false);
    expect(isActive(45, 41, 49)).toBe(true);
    expect(isActive(50, 41, 49)).toBe(false);
  });
  it("sum → totals an array", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});
