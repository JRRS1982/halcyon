// Turns transfer-tagged transactions into per-account net flow. Signed: money
// out of an account reads negative, money in positive. Rounded to cents to
// avoid float drift, normalising -0 to 0.

export type TransferLeg = {
  accountId: string;
  accountName: string;
  counterpartyId: string;
  counterpartyName: string;
  amount: number;
};

const round = (n: number): number => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
};

// Net flow per account, signed relative to that account.
//
// Two sources exist for one real movement: the leg the target account owns,
// and the leg on the other account pointing at it. Summing both would
// double-count, so exactly one is consulted — per COUNTERPARTY PAIR, not per
// account. For account X and counterparty C: X's own legs aimed at C when it
// has any, otherwise C's legs aimed at X, sign-flipped.
//
// Per pair rather than per account because owning one leg must not silence
// every other counterparty. A pension that pays a fee to an ISA and receives a
// contribution from the current account would otherwise report only the fee —
// the wrong sign, not merely a low reading. Each pair still resolves to one
// source, so double-counting remains impossible by construction.
//
// Deterministic on purpose. Pairing the two legs of one movement by opposite
// amount and nearby date is a heuristic, and it would fail silently and
// differently every month.
//
// Accepted limitation: a single pair that records some of its movements on one
// side and some on the other counts only the owned legs, so that pair reads
// low. Narrow, visible, and it fails safe — under-reporting a transfer never
// inflates net worth.
export function netTransfersForAccounts(
  ownLegs: TransferLeg[],
  legsPointingAt: TransferLeg[],
): Map<string, number> {
  const pairKey = (accountId: string, counterpartyId: string): string =>
    `${accountId}|${counterpartyId}`;

  const net = new Map<string, number>();
  const ownedPairs = new Set(
    ownLegs.map((leg) => pairKey(leg.accountId, leg.counterpartyId)),
  );

  for (const leg of ownLegs) {
    net.set(leg.accountId, round((net.get(leg.accountId) ?? 0) + leg.amount));
  }
  for (const leg of legsPointingAt) {
    // The pair from the target's side: it is the counterparty's account.
    if (ownedPairs.has(pairKey(leg.counterpartyId, leg.accountId))) continue;
    net.set(
      leg.counterpartyId,
      round((net.get(leg.counterpartyId) ?? 0) - leg.amount),
    );
  }
  return net;
}
