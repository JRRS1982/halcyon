// src/lib/plan/liabilities.ts
import { grow } from "./helpers";
import type { LiabilityInput } from "./types";

export interface LiabilityStepResult {
  balances: Record<string, number>;
  repaid: number;
}

export const liabilityStep = (
  liabilities: LiabilityInput[],
  balances: Record<string, number>,
  age: number,
): LiabilityStepResult => {
  const next = { ...balances };
  let repaid = 0;
  for (const l of liabilities) {
    const balance = next[l.id] ?? 0;
    const pastEnd = l.endAge !== undefined && age > l.endAge;
    if (balance <= 0 || pastEnd) continue;
    const afterInterest = grow(balance, l.interestPct);
    const payment = Math.min(l.monthlyRepayment * 12, afterInterest);
    next[l.id] = afterInterest - payment;
    repaid += payment;
  }
  return { balances: next, repaid };
};
