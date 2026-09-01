import type { AccountType, BalanceItemCategory } from "@prisma/client";
import { cleanLabel } from "@/lib/categories/normalize";
import { defaultSectionOf, kindOf, wrapperOf } from "./accountDraft";

type MortgageInput = {
  name: string;
  canImportTransactions: boolean;
};

export type BuildAccountDataInput = {
  type: AccountType;
  section?: BalanceItemCategory;
};

// Build the type, section, and derived mirrors (kind/wrapper) for an account.
// kind/wrapper are legacy mirrors; dropped in the contract PR.
export function buildAccountData(input: BuildAccountDataInput) {
  const section = input.section ?? defaultSectionOf(input.type);
  return {
    type: input.type,
    section,
    kind: kindOf(input.type),
    wrapper: wrapperOf(input.type),
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

// sortOrder appends at the end of a (period, type, category) bucket — the
// same convention the budget/balance sheets' other row-creating actions use.
export function nextSortOrder(
  lastSortOrder: number | null | undefined,
): number {
  return (lastSortOrder ?? 0) + 1;
}
