import { money12, money14 } from "@/lib/money/bounds";

describe("money bounds", () => {
  it("accepts the amounts a person actually types", () => {
    for (const value of [0, 1, -1, 42300, -184200.55, 0.01]) {
      expect(money14.safeParse(value).success).toBe(true);
    }
  });

  // The defect these exist for: a bare z.number() let 1e30 through to a
  // DECIMAL(14,2) column, and Postgres answered with `numeric field overflow`
  // — a 500 where the user should have met a validation message.
  it("rejects a number the column cannot hold", () => {
    expect(money14.safeParse(1e30).success).toBe(false);
    expect(money14.safeParse(-1e30).success).toBe(false);
    expect(money14.safeParse(1_000_000_000_000).success).toBe(false);
    expect(money14.safeParse(999_999_999_999.99).success).toBe(true);
  });

  // z.number() rejects NaN but not Infinity, and the action payload carries it.
  it("rejects the values that are not quantities", () => {
    expect(money14.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(money14.safeParse(Number.NEGATIVE_INFINITY).success).toBe(false);
    expect(money14.safeParse(Number.NaN).success).toBe(false);
  });

  it("rejects fractions of a penny, which the column would silently round", () => {
    expect(money14.safeParse(1.005).success).toBe(false);
    expect(money14.safeParse(0.001).success).toBe(false);
  });

  it("holds the narrower column to its narrower ceiling", () => {
    expect(money12.safeParse(9_999_999_999.99).success).toBe(true);
    expect(money12.safeParse(99_999_999_999).success).toBe(false);
    // Still fine in the wider one.
    expect(money14.safeParse(99_999_999_999).success).toBe(true);
  });
});
