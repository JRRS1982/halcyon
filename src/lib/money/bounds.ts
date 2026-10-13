import { z } from "zod";

// Bounds for a monetary amount, matched to the Postgres column it lands in.
//
// A bare z.number() passes anything finite — and Infinity too, since z.number()
// rejects NaN but not Infinity, and React's action encoding carries it. The
// value then reached a DECIMAL column and Postgres raised `numeric field
// overflow`, so the user met a 500 where they should have met "that number is
// too large". A validation boundary that hands the database something it will
// refuse has not validated anything.
//
// Named after the column width rather than the field, because that is what
// actually sets the ceiling: DECIMAL(14,2) holds twelve digits before the
// point, DECIMAL(12,2) holds ten. Mirrors how `pct` in accounts/schemas.ts
// already bounds DECIMAL(5,2).
const boundedMoney = (integerDigits: number) => {
  const limit = 10 ** integerDigits - 0.01;
  return z
    .number()
    .finite()
    .min(-limit)
    .max(limit)
    .refine((value) => Number.isInteger(value * 100), {
      message: "Amounts are held to the penny",
    });
};

// DECIMAL(14,2) — balances, transaction amounts, plan opening figures.
export const money14 = boundedMoney(12);

// DECIMAL(12,2) — budgeted and actual figures, annual amounts, contributions.
export const money12 = boundedMoney(10);
