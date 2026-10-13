import { z } from "zod";

// Bounds for a monetary amount, matched to the Postgres column it lands in.
//
// A bare z.number() passes any magnitude, so the value reached a DECIMAL column
// and Postgres raised `numeric field overflow` — the user met a 500 where they
// should have met "that number is too large". A validation boundary that hands
// the database something it will refuse has not validated anything.
//
// (zod 4 already rejects NaN and Infinity at z.number(); .finite() is kept only
// because it says so at the call site.)
//
// Named after the column width rather than the field, because that is what
// actually sets the ceiling: DECIMAL(14,2) holds twelve digits before the
// point, DECIMAL(12,2) holds ten. Mirrors how `pct` in accounts/schemas.ts
// already bounds DECIMAL(5,2).
const boundedMoney = (integerDigits: number) => {
  const limit = 10 ** integerDigits - 0.01;
  return (
    z
      .number()
      .finite()
      .min(-limit)
      .max(limit)
      // Compared with a tolerance, not Number.isInteger(value * 100). Multiplying
      // a float by 100 lands just off an integer for 9,175 of the 100,000 penny
      // amounts between 0.01 and 1000.00 — 0.07, 0.29 and 1.1 among them, since
      // 1.1 * 100 === 110.00000000000001 — so the strict test rejected about one
      // amount in eleven that a person could actually type.
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
        {
          message: "Amounts are held to the penny",
        },
      )
  );
};

// DECIMAL(14,2) — balances, transaction amounts, plan opening figures.
export const money14 = boundedMoney(12);

// DECIMAL(12,2) — budgeted and actual figures, annual amounts, contributions.
export const money12 = boundedMoney(10);
