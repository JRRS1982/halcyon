import type { BalanceCategory, BalanceType } from "@/lib/balance/reorder";
import type { CreateAccountWithBalanceInput } from "./schemas";

type Wrapper = CreateAccountWithBalanceInput["wrapper"];

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
export type AccountTypeId =
  | "CURRENT_ACCOUNT"
  | "SAVINGS"
  | "CASH_ISA"
  | "STOCKS_ISA"
  | "SIPP"
  | "FINAL_SALARY"
  | "GIA"
  | "PROPERTY"
  | "OTHER_ASSET"
  | "MORTGAGE"
  | "CREDIT_CARD"
  | "LOAN"
  | "OVERDRAFT"
  | "OTHER_DEBT";

export type AccountTypeOption = {
  id: AccountTypeId;
  label: string;
  kind: BalanceType;
  /** Null for every liability — the wrapper enum is asset-only. */
  wrapper: Wrapper | null;
  namePlaceholder: string;
};

export const ACCOUNT_TYPES: readonly AccountTypeOption[] = [
  {
    id: "CURRENT_ACCOUNT",
    label: "Current account",
    kind: "ASSET",
    wrapper: "CASH",
    namePlaceholder: "e.g. Barclays current",
  },
  {
    id: "SAVINGS",
    label: "Savings / cash",
    kind: "ASSET",
    wrapper: "CASH",
    namePlaceholder: "e.g. Premium bonds",
  },
  {
    id: "CASH_ISA",
    label: "Cash ISA",
    kind: "ASSET",
    wrapper: "ISA",
    namePlaceholder: "e.g. Nationwide cash ISA",
  },
  {
    id: "STOCKS_ISA",
    label: "Stocks & shares ISA",
    kind: "ASSET",
    wrapper: "ISA",
    namePlaceholder: "e.g. Vanguard ISA",
  },
  {
    id: "SIPP",
    label: "Pension (SIPP)",
    kind: "ASSET",
    wrapper: "PENSION",
    namePlaceholder: "e.g. AJ Bell SIPP",
  },
  {
    id: "FINAL_SALARY",
    label: "Final salary pension",
    kind: "ASSET",
    wrapper: "DB_PENSION",
    namePlaceholder: "e.g. NHS pension",
  },
  {
    id: "GIA",
    label: "General investment account",
    kind: "ASSET",
    wrapper: "GIA",
    namePlaceholder: "e.g. Trading 212",
  },
  {
    id: "PROPERTY",
    label: "Property",
    kind: "ASSET",
    wrapper: "PROPERTY",
    namePlaceholder: "e.g. Home",
  },
  {
    id: "OTHER_ASSET",
    label: "Other asset",
    kind: "ASSET",
    wrapper: "OTHER",
    namePlaceholder: "e.g. Car",
  },
  {
    id: "MORTGAGE",
    label: "Mortgage",
    kind: "LIABILITY",
    wrapper: null,
    namePlaceholder: "e.g. Halifax mortgage",
  },
  {
    id: "CREDIT_CARD",
    label: "Credit card",
    kind: "LIABILITY",
    wrapper: null,
    namePlaceholder: "e.g. Amex",
  },
  {
    id: "LOAN",
    label: "Loan",
    kind: "LIABILITY",
    wrapper: null,
    namePlaceholder: "e.g. Car finance",
  },
  {
    id: "OVERDRAFT",
    label: "Overdraft",
    kind: "LIABILITY",
    wrapper: null,
    namePlaceholder: "e.g. Current account overdraft",
  },
  {
    id: "OTHER_DEBT",
    label: "Other debt",
    kind: "LIABILITY",
    wrapper: null,
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
// createAccountWithBalanceSchema's shape. Amounts stay as raw input strings
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

// What the "Import statements to this account" checkbox starts on, for a
// freshly chosen account type the user hasn't overridden. Keyed on the
// wrapper rather than the section: the user picks "Property" explicitly, and
// that is a more reliable signal than which section they then file it under.
export function defaultCanImportTransactions(
  type: BalanceType,
  wrapper: Wrapper | null,
): boolean {
  return type === "ASSET" && wrapper !== "PROPERTY";
}

// What the checkbox should read after the account type changes. A
// decision, not a derivation: once the user has touched the checkbox
// directly, their choice sticks — a later type/section change never
// overrides it, even to a type whose fresh default disagrees with what's
// currently checked. Untouched, it always mirrors the fresh default for
// whatever the draft has just become.
export function resolveCanImportTransactions(
  current: boolean,
  touched: boolean,
  type: BalanceType,
  wrapper: Wrapper | null,
): boolean {
  return touched ? current : defaultCanImportTransactions(type, wrapper);
}

// Whether the draft has everything createAccountWithBalance needs. Section
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
