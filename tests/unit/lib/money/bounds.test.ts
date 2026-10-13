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

  // zod 4's z.number() already rejects both — this pins that it stays true,
  // since an earlier version of this module carried a .finite() added on the
  // belief that Infinity got through, which was zod 3 behaviour.
  it("rejects the values that are not quantities", () => {
    expect(money14.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(money14.safeParse(Number.NEGATIVE_INFINITY).success).toBe(false);
    expect(money14.safeParse(Number.NaN).success).toBe(false);
  });

  it("rejects fractions of a penny, which the column would silently round", () => {
    expect(money14.safeParse(1.005).success).toBe(false);
    expect(money14.safeParse(0.001).success).toBe(false);
  });

  // The first version of this check was `Number.isInteger(value * 100)`, which
  // rejected 9,175 of the 100,000 penny amounts between 0.01 and 1000.00 —
  // every one where the float multiply lands just off an integer, including
  // 0.07, 0.29 and 1.1 (1.1 * 100 === 110.00000000000001). It passed its own
  // tests because they all used round numbers. Exhaustive here for that
  // reason: a sampled test is what missed it.
  it("accepts every penny amount in the ordinary range", () => {
    const rejected: number[] = [];
    for (let pennies = -100_000; pennies <= 100_000; pennies += 1) {
      const value = pennies / 100;
      if (!money14.safeParse(value).success) rejected.push(value);
    }
    expect(rejected).toEqual([]);
  });

  it("holds the narrower column to its narrower ceiling", () => {
    expect(money12.safeParse(9_999_999_999.99).success).toBe(true);
    expect(money12.safeParse(99_999_999_999).success).toBe(false);
    // Still fine in the wider one.
    expect(money14.safeParse(99_999_999_999).success).toBe(true);
  });
});
