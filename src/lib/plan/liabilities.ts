// src/lib/plan/liabilities.ts
import { grow } from "./helpers";
import type { LiabilityInput } from "./types";

export interface LiabilityStepResult {
  balances: Record<string, number>;
  repaid: number;
  byLiability: Record<string, { interest: number; principal: number }>;
}

/**
 * The rate in force at this age. Exported because it is the whole of the
 * two-rate mortgage behaviour and deserves its own tests: liabilityStep
 * already receives `age`, so the engine change is this function and nothing
 * else.
 */
export const rateAt = (l: LiabilityInput, age: number): number =>
  l.revisionAge !== undefined &&
  l.revisionRate !== undefined &&
  age >= l.revisionAge
    ? l.revisionRate
    : l.interestPct;

export const liabilityStep = (
  liabilities: LiabilityInput[],
  balances: Record<string, number>,
  age: number,
  annualPayments?: Record<string, number>,
): LiabilityStepResult => {
  const next = { ...balances };
  const byLiability: Record<string, { interest: number; principal: number }> =
    {};
  let repaid = 0;
  for (const l of liabilities) {
    const balance = next[l.id] ?? 0;
    const notStarted = l.startAge !== undefined && age < l.startAge;
    const pastEnd = l.endAge !== undefined && age > l.endAge;
    if (balance <= 0 || notStarted || pastEnd) continue;
    const afterInterest = grow(balance, rateAt(l, age));
    const interestAccrued = afterInterest - balance;
    if (l.interestOnly) {
      // Pay only the interest; the balance stays flat. The stored repayment
      // amount is ignored — an interest-only payment IS the interest.
      next[l.id] = balance;
      byLiability[l.id] = { interest: interestAccrued, principal: 0 };
      repaid += interestAccrued;
      continue;
    }
    const annual = annualPayments?.[l.id] ?? l.monthlyRepayment * 12;
    const payment = Math.min(annual, afterInterest);
    const interest = Math.min(payment, interestAccrued);
    const principal = payment - interest;
    next[l.id] = afterInterest - payment;
    byLiability[l.id] = { interest, principal };
    repaid += payment;
  }
  return { balances: next, repaid, byLiability };
};
