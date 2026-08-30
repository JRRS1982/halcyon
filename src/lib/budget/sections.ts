import type { AccountKind, ItemType, TransferDirection } from "@prisma/client";
import { requiredAnchorKind } from "./anchors";

// Which of the sheet's three visible sections a row renders in. Presentation
// only — ItemType does not encode it, and nothing derived from the data (the
// plan wiring, the actual's source, the surplus) reads this.
export type BudgetSection = "INCOME" | "EXPENSES" | "TRANSFERS";

// A repayment is money out and people look for their mortgage under Expenses,
// so that is where it renders — and it counts in that total, so "what did I
// spend" includes the payment that actually left.
export function sectionOf(type: ItemType): BudgetSection {
  switch (type) {
    case "INCOME":
      return "INCOME";
    case "EXPENSE":
    case "REPAYMENT":
      return "EXPENSES";
    case "TRANSFER":
      return "TRANSFERS";
  }
}

// INFLOW/OUTFLOW are anchored to the named account, which is right for the
// data and confusing in a sheet about your money: money "into" your ISA is
// money out of your pocket. The sheet says where it goes.
export function transferRowLabel(
  direction: TransferDirection,
  accountName: string,
): string {
  return `${direction === "INFLOW" ? "To" : "From"} ${accountName}`;
}

// What an anchored row shows beside its editable label: the account it targets,
// read from the user's side. Null for the category-keyed kinds, which target no
// account at all.
//
// A TRANSFER that has lost its direction names the account and stops there:
// calling it an inflow because null is falsy is exactly the silent mis-signing
// this feature exists to avoid.
export function anchorTargetLabel(
  type: ItemType,
  direction: TransferDirection | null,
  accountName: string,
): string | null {
  if (type === "REPAYMENT") return `Towards ${accountName}`;
  if (type !== "TRANSFER") return null;
  return direction ? transferRowLabel(direction, accountName) : accountName;
}

// An account as the sheet needs it: enough to filter the Add drawer's picker,
// and to name the target of a row already anchored to it. Archived accounts are
// carried so an existing row still names where its money went; they are never
// offered as a new row's target.
export type AnchorAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  archived: boolean;
};

// The accounts a new row of this kind may target. A TRANSFER funds an asset, a
// REPAYMENT pays down a liability, and createItemForMonth rejects anything else
// — including kind NONE, which every onboarding-seeded account starts as. So an
// empty result is the ordinary state of a user who has never used the balance
// sheet, not an error.
//
// `alreadyAnchored` is the accounts the period's live rows already point at.
// One account carries at most one row per period, because the flow data yields
// one net per account: two rows on the same account could not be told apart,
// so each would render the whole figure and the section would count it twice.
// This is the picker's half of that rule — createItemForMonth holds the other,
// and it is the one that matters, since the picker can be bypassed.
export function eligibleAnchorAccounts(
  type: ItemType,
  accounts: AnchorAccount[],
  alreadyAnchored: Iterable<string>,
): AnchorAccount[] {
  const required = requiredAnchorKind(type);
  if (!required) return [];
  const taken = new Set(alreadyAnchored);
  return accounts.filter(
    (a) => !a.archived && a.kind === required && !taken.has(a.id),
  );
}

// Why the Add drawer has nothing to offer. The two cases need different words:
// one is fixed on the balance sheet, the other is the one-row-per-account rule
// working as intended, and telling someone to create an account they already
// have would be a lie.
export function anchorPickerEmptyReason(
  type: ItemType,
  accounts: AnchorAccount[],
  alreadyAnchored: Iterable<string>,
): "NO_ACCOUNTS" | "ALL_TAKEN" | null {
  if (eligibleAnchorAccounts(type, accounts, alreadyAnchored).length > 0) {
    return null;
  }
  return eligibleAnchorAccounts(type, accounts, []).length > 0
    ? "ALL_TAKEN"
    : "NO_ACCOUNTS";
}

type Row = { type: ItemType; sortOrder: number };

const bySortOrder = <T extends Row>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

// Every row that renders in one section, whatever its ItemType — which is why
// the Expenses section total includes repayments.
export function rowsInSection<T extends Row>(
  items: T[],
  section: BudgetSection,
): T[] {
  return bySortOrder(items.filter((i) => sectionOf(i.type) === section));
}

// The rows of one kind, for a group inside a section — repayments head their
// own group within Expenses.
export function rowsOfType<T extends Row>(items: T[], type: ItemType): T[] {
  return bySortOrder(items.filter((i) => i.type === type));
}

// A copy leaves behind any row whose anchor cannot be re-established, rather
// than copying it malformed (see withValidAnchorsOnly). It reaches here when
// the source month's row names an account that has since been archived,
// deleted or re-kinded.
//
// The count is the only trace of a skip, so the sheet says it out loud.
export function skippedRowsNotice(skipped: number): string | null {
  if (skipped <= 0) return null;
  return skipped === 1
    ? "1 row was skipped because its account could not be carried over."
    : `${skipped} rows were skipped because their accounts could not be carried over.`;
}
