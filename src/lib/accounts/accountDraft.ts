import type { AccountType, PlanAssetWrapper } from "@prisma/client";
import type { BalanceCategory, BalanceType } from "@/lib/balance/reorder";

type Wrapper = PlanAssetWrapper;

/**
 * What the drawer's single "What are you adding?" picker offers.
 *
 * `kind` and `wrapper` used to be two questions. They are one fact: every
 * value of the wrapper enum is an asset kind — which is why liabilities store
 * `wrapper: null` — so asking for the wrapper already answers asset-or-liability.
 * Choosing an entry here sets both.
 *
 * Two wrappers appear twice on purpose. A cash ISA and an invested ISA share
 * `ISA` but are plainly different things, and they belong in different
 * sections — which is exactly why Section stays a separate question and is
 * never inferred from the wrapper.
 *
 * `OTHER` splits in two because it is the only wrapper that cannot imply a
 * kind on its own.
 *
 * The liability entries differ only in `kind`; nothing stores "mortgage"
 * versus "credit card". They exist to route the user, and to supply a name
 * placeholder — not as data.
 */
export type AccountTypeId = AccountType;

export type AccountTypeOption = {
  id: AccountTypeId;
  label: string;
  kind: BalanceType;
  /** Null for every liability — the wrapper enum is asset-only. */
  wrapper: Wrapper | null;
  /**
   * Where this kind of thing usually sits on the sheet. A *default*, not an
   * inference: the drawer pre-selects it, the user can change it, and once
   * they do their choice sticks through later type changes.
   *
   * This only became possible because the picker distinguishes a cash ISA from
   * an invested one. While "ISA" was a single option it implied nothing about
   * the section, which is why the section was originally left blank.
   */
  defaultSection: BalanceCategory;
  namePlaceholder: string;
};

export const ACCOUNT_TYPES: readonly AccountTypeOption[] = [
  {
    id: "CURRENT_ACCOUNT",
    label: "Current account",
    kind: "ASSET",
    wrapper: "CASH",
    defaultSection: "CURRENT",
    namePlaceholder: "e.g. Barclays current",
  },
  {
    id: "SAVINGS",
    label: "Savings / cash",
    kind: "ASSET",
    wrapper: "CASH",
    defaultSection: "MEDIUM_TERM",
    namePlaceholder: "e.g. Premium bonds",
  },
  {
    id: "CASH_ISA",
    label: "Cash ISA",
    kind: "ASSET",
    wrapper: "ISA",
    defaultSection: "MEDIUM_TERM",
    namePlaceholder: "e.g. Nationwide cash ISA",
  },
  {
    id: "STOCKS_ISA",
    label: "Stocks & shares ISA",
    kind: "ASSET",
    wrapper: "ISA",
    defaultSection: "LONG_TERM",
    namePlaceholder: "e.g. Vanguard ISA",
  },
  {
    id: "SIPP",
    label: "Pension (SIPP)",
    kind: "ASSET",
    wrapper: "PENSION",
    defaultSection: "LONG_TERM",
    namePlaceholder: "e.g. AJ Bell SIPP",
  },
  {
    id: "FINAL_SALARY",
    label: "Final salary pension",
    kind: "ASSET",
    wrapper: "DB_PENSION",
    defaultSection: "LONG_TERM",
    namePlaceholder: "e.g. NHS pension",
  },
  {
    id: "GIA",
    label: "General investment account",
    kind: "ASSET",
    wrapper: "GIA",
    defaultSection: "MEDIUM_TERM",
    namePlaceholder: "e.g. Trading 212",
  },
  {
    id: "PROPERTY",
    label: "Property",
    kind: "ASSET",
    wrapper: "PROPERTY",
    defaultSection: "PROPERTY",
    namePlaceholder: "e.g. Home",
  },
  {
    id: "OTHER_ASSET",
    label: "Other asset",
    kind: "ASSET",
    wrapper: "OTHER",
    defaultSection: "OTHER",
    namePlaceholder: "e.g. Car",
  },
  {
    id: "MORTGAGE",
    label: "Mortgage",
    kind: "LIABILITY",
    wrapper: null,
    defaultSection: "LONG_TERM",
    namePlaceholder: "e.g. Halifax mortgage",
  },
  {
    id: "CREDIT_CARD",
    label: "Credit card",
    kind: "LIABILITY",
    wrapper: null,
    defaultSection: "CURRENT",
    namePlaceholder: "e.g. Amex",
  },
  {
    id: "LOAN",
    label: "Loan",
    kind: "LIABILITY",
    wrapper: null,
    defaultSection: "MEDIUM_TERM",
    namePlaceholder: "e.g. Car finance",
  },
  {
    id: "OVERDRAFT",
    label: "Overdraft",
    kind: "LIABILITY",
    wrapper: null,
    defaultSection: "CURRENT",
    namePlaceholder: "e.g. Current account overdraft",
  },
  {
    id: "OTHER_DEBT",
    label: "Other debt",
    kind: "LIABILITY",
    wrapper: null,
    defaultSection: "OTHER",
    namePlaceholder: "e.g. Loan from family",
  },
] as const;

export function accountTypeById(
  id: AccountTypeId | null,
): AccountTypeOption | null {
  if (!id) return null;
  return ACCOUNT_TYPES.find((option) => option.id === id) ?? null;
}

// The AddAccountDrawer's in-progress form state, before it's parsed into
// createAccountSchema's shape. Amounts stay as raw input strings
// here — that's what the fields hold while the user is typing.
export type AccountDraft = {
  type: BalanceType | null;
  category: BalanceCategory | null;
  name: string;
  value: string;
  hasMortgage: boolean;
  mortgageName: string;
  mortgageValue: string;
};

function isNumericInput(raw: string): boolean {
  return raw.trim() !== "" && Number.isFinite(Number(raw));
}

// What the "Allow importing of statements" checkbox starts on, for a
// freshly chosen account type the user hasn't overridden. Keyed on the
// wrapper rather than the section: the user picks "Property" explicitly, and
// that is a more reliable signal than which section they then file it under.
export function defaultCanImportTransactions(
  type: BalanceType,
  wrapper: Wrapper | null,
): boolean {
  return type === "ASSET" && wrapper !== "PROPERTY";
}

// Whether the draft has everything createAccount needs. Section
// has no default (per the user's decision — see AddAccountDrawer), so its
// absence alone blocks submission; a mortgage, once switched on, is held to
// the same name+value bar as the primary account.
export function canSubmitAccountDraft(draft: AccountDraft): boolean {
  if (!draft.type || !draft.category) return false;
  if (!draft.name.trim()) return false;
  if (!isNumericInput(draft.value)) return false;
  if (!draft.hasMortgage) return true;
  return (
    Boolean(draft.mortgageName.trim()) && isNumericInput(draft.mortgageValue)
  );
}

const BY_ID = new Map(ACCOUNT_TYPES.map((t) => [t.id, t]));

function optionOf(type: AccountType): AccountTypeOption {
  const option = BY_ID.get(type);
  if (!option) throw new Error(`Unknown account type: ${type}`);
  return option;
}

export function kindOf(type: AccountType): BalanceType {
  return optionOf(type).kind;
}

export function wrapperOf(type: AccountType): PlanAssetWrapper | null {
  return optionOf(type).wrapper;
}

export function defaultSectionOf(type: AccountType): BalanceCategory {
  return optionOf(type).defaultSection;
}

export function accountTypesOfKind(kind: BalanceType) {
  return ACCOUNT_TYPES.filter((t) => t.kind === kind);
}
