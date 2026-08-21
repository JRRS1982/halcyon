import type { BalanceCategory, BalanceType } from "@/lib/balance/reorder";

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

// What the "Import statements to this account" checkbox starts on. A
// decision, not a derivation: once the user touches the checkbox directly,
// their choice sticks and this function is never consulted again for that
// draft, however type or section change afterwards.
export function defaultCanImportTransactions(
  type: BalanceType,
  category: BalanceCategory | null,
): boolean {
  return type === "ASSET" && category !== "PROPERTY";
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
