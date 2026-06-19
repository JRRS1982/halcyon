// src/lib/plan/helpers.ts

export const round = (n: number): number => Math.round(n);

export const grow = (value: number, pct: number): number =>
  value * (1 + pct / 100);

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
