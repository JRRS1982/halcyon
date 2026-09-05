// src/lib/plan/helpers.ts

export const round = (n: number): number => Math.round(n);

export const grow = (value: number, pct: number): number =>
  value * (1 + pct / 100);

/**
 * The annual read-out for a monthly figure. Rounded to 2dp because the
 * multiplication happens in doubles — 833.33 × 12 is 9999.960000000001 — and
 * NOT rounded to a "nicer" number: twelve payments of £833.33 genuinely come
 * to £9,999.96, and rounding the display to £10,000 would make the label
 * disagree with the projection.
 */
export const annualFromMonthly = (monthly: number): number =>
  Math.round(monthly * 1200) / 100;

export const amountThisYear = (
  base: number,
  growthPct: number,
  yearsElapsed: number,
): number => base * (1 + growthPct / 100) ** yearsElapsed;

export const isActive = (
  age: number,
  startAge?: number,
  endAge?: number,
): boolean =>
  (startAge === undefined || age >= startAge) &&
  (endAge === undefined || age <= endAge);

export const sum = (values: number[]): number =>
  values.reduce((a, b) => a + b, 0);
