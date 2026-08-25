import type {
  BalanceItemCategory,
  BalanceItemType,
  PlanAssetWrapper,
} from "@prisma/client";
import { cleanLabel } from "@/lib/categories/normalize";

type PrimaryAccountInput = {
  name: string;
  type: BalanceItemType;
  category: BalanceItemCategory;
  wrapper: PlanAssetWrapper;
  canImportTransactions: boolean;
};

type MortgageInput = {
  name: string;
  canImportTransactions: boolean;
};

// What the primary account (the ISA, the property, the plain liability)
// gets written with. A tax wrapper describes what you own, not what you
// owe — meaningless on a liability, so only an asset entry carries one.
export function buildPrimaryAccountData(input: PrimaryAccountInput) {
  return {
    name: cleanLabel(input.name),
    kind: input.type,
    category: input.category,
    wrapper: input.type === "ASSET" ? input.wrapper : null,
    canImportTransactions: input.canImportTransactions,
  };
}

// What a mortgage account gets written with, always — a different (type,
// category) bucket from the property it's attached to: PROPERTY is
// asset-only, mortgage debt files under long-term liabilities (see
// BalanceSheet.tsx and prisma/schema.prisma), and a debt never carries a
// tax wrapper.
export function buildMortgageAccountData(mortgage: MortgageInput) {
  return {
    name: cleanLabel(mortgage.name),
    kind: "LIABILITY" as const,
    category: "LONG_TERM" as const,
    wrapper: null,
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
