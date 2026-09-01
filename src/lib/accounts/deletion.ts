import type { AccountKind, AccountSection } from "@prisma/client";

// The property side of a mortgaged pair is the ASSET row filed under
// PROPERTY — never the LIABILITY row, even though isValidBalanceCategory
// lets that combination exist. Deleting the property pre-ticks its mortgage
// (you rarely keep a debt secured on a house you no longer hold); deleting
// the mortgage leaves the property unticked (the commoner reason is that
// it's paid off).
export function isPropertyRow(
  type: AccountKind,
  category: AccountSection,
): boolean {
  return type === "ASSET" && category === "PROPERTY";
}

export type DeletionMode = "archive" | "everywhere";

// "Stop tracking" needs no confirmation — it's reversible. "Delete it
// everywhere" is the one hard delete in a codebase that soft-deletes
// everything else, so it's gated on typing the literal string DELETE.
export function canConfirmDeletion(
  mode: DeletionMode,
  confirmText: string,
): boolean {
  return mode === "archive" || confirmText === "DELETE";
}
