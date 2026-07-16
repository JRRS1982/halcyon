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
  annualPayments?: Record<string, number>,
): LiabilityStepResult => {
  const next = { ...balances };
  let repaid = 0;
  for (const l of liabilities) {
    const balance = next[l.id] ?? 0;
    const notStarted = l.startAge !== undefined && age < l.startAge;
    const pastEnd = l.endAge !== undefined && age > l.endAge;
    if (balance <= 0 || notStarted || pastEnd) continue;
    const afterInterest = grow(balance, l.interestPct);
    const annual = annualPayments?.[l.id] ?? l.monthlyRepayment * 12;
    const payment = Math.min(annual, afterInterest);
    next[l.id] = afterInterest - payment;
    repaid += payment;
  }
  return { balances: next, repaid };
};
