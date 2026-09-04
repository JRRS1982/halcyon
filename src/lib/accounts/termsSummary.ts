import type { AccountType } from "@prisma/client";
import { termsFor } from "@/lib/accounts/accountDraft";
import type { AccountTermsInput } from "@/lib/accounts/schemas";

/**
 * The one-line preview `DrawerSection` shows while collapsed — the defaults
 * being accepted by not opening it. This is what makes skipping the section a
 * choice rather than a silent one, so it states the effective values, not the
 * typed ones.
 */
export function summariseTerms(
  type: AccountType,
  terms: AccountTermsInput,
): string {
  const parts: string[] = [];
  for (const field of termsFor(type)) {
    if (field === "expectedReturnPct") {
      parts.push(
        terms.expectedReturnPct == null
          ? "plan default growth"
          : `${terms.expectedReturnPct}% growth`,
      );
    }
    if (field === "feePct" && terms.feePct != null && terms.feePct > 0) {
      parts.push(`${terms.feePct}% fee`);
    }
    if (field === "interestPct") {
      parts.push(
        terms.interestPct == null
          ? "0% interest"
          : `${terms.interestPct}% interest`,
      );
    }
    if (field === "annualIncome" && terms.annualIncome != null) {
      parts.push(`${terms.annualIncome.toLocaleString()}/yr`);
    }
  }
  return parts.join(" · ");
}
