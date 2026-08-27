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

// A leg with the date it fell on, so a multi-month window can be split into
// months before netting. Netting per month rather than over the whole window
// is what keeps each month's figure its own: the window-wide net of twelve
// mortgage payments is not any month's flow.
export type DatedTransferLeg = TransferLeg & { date: Date };

const utcMonth = (date: Date): string =>
  `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

// Key for one account's flow within one calendar month. Mirrors
// monthCategoryKey in ./actual — both a transaction date and a period start
// date resolve to the same key via the UTC month.
export function monthAccountKey(date: Date, accountId: string): string {
  return `${utcMonth(date)}:${accountId}`;
}

// Net transfer flow per (UTC month, account), so a whole window can be
// overlaid onto budget rows from one query. Each month is netted on its own by
// netTransfersForAccounts, so the per-counterparty-pair source rule — and with
// it the impossibility of double-counting — applies within each month.
export function netTransfersByMonthAndAccount(
  legs: DatedTransferLeg[],
): Map<string, number> {
  const byMonth = new Map<string, DatedTransferLeg[]>();
  for (const leg of legs) {
    const month = utcMonth(leg.date);
    const bucket = byMonth.get(month);
    if (bucket) bucket.push(leg);
    else byMonth.set(month, [leg]);
  }

  const flow = new Map<string, number>();
  for (const [month, bucket] of byMonth) {
    for (const [accountId, net] of netTransfersForAccounts(bucket, bucket)) {
      flow.set(`${month}:${accountId}`, net);
    }
  }
  return flow;
}
