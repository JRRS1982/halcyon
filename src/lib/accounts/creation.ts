import type { AccountSection, AccountType } from "@prisma/client";
import { cleanLabel } from "@/lib/categories/normalize";
import { defaultSectionOf } from "./accountDraft";

type MortgageInput = {
  name: string;
  canImportTransactions: boolean;
};

export type BuildAccountDataInput = {
  type: AccountType;
  section?: AccountSection;
};

// Build the two facts an account is created with. kind/wrapper are derived
// on demand (kindOf/wrapperOf in accountDraft.ts), never stored.
export function buildAccountData(input: BuildAccountDataInput) {
  const section = input.section ?? defaultSectionOf(input.type);
  return {
    type: input.type,
    section,
  };
}

// What a mortgage account gets written with, always — a different (type,
// category) bucket from the property it's attached to: PROPERTY is
// asset-only, mortgage debt files under long-term liabilities (see
// BalanceSheet.tsx and prisma/schema.prisma), and a debt never carries a
// tax wrapper.
export function buildMortgageAccountData(mortgage: MortgageInput) {
  return {
    ...buildAccountData({ type: "MORTGAGE" }),
    name: cleanLabel(mortgage.name),
    canImportTransactions: mortgage.canImportTransactions,
  };
}

// sortOrder appends at the end of an account's (kind, section) bucket — the
// same convention createAccount and setAccountSection both use. No last row
// means the bucket is empty, so the first account is 0-based rather than
// skipping straight to 1.
export function nextSortOrder(
  lastSortOrder: number | null | undefined,
): number {
  if (lastSortOrder === null || lastSortOrder === undefined) return 0;
  return lastSortOrder + 1;
}
