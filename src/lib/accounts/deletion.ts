// Which rows a delete-everywhere touches: the account itself, plus its
// linked partner when the caller asked to take it too and one was actually
// resolved. Callers still owe every query built from this list its own
// `userId` fence — this only decides which ids belong in it.
export function accountIdsForDeletion(
  accountId: string,
  partnerId: string | null,
): string[] {
  return partnerId ? [accountId, partnerId] : [accountId];
}

// Refuses a delete when some other, surviving account still names one of
// the ids as its transfer counterparty — deleting that reference would
// either destroy a ledger the user never asked to touch, or hit the
// `Restrict` the schema puts on `Transaction.transferAccount`. Returns the
// message the confirmation panel throws verbatim, or null to proceed.
export function deletionRefusalMessage(
  blockingTransfers: number,
): string | null {
  if (blockingTransfers === 0) return null;
  return "This account still has transactions. Reassign or remove them first.";
}
