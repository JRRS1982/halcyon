// The ledger's "Possible transfers" filter, as pure functions. A transfer the
// user has not tagged reads as spending in one account and income in another;
// this finds both sides so they can be dealt with together.
//
// A pair is two rows in different accounts, the same size with opposite
// signs, dated within PAIR_WINDOW_DAYS: the rule the import review's
// pairOpposites uses, plus the different-account condition a ledger needs.
// Matching runs on read and nothing here is stored, except the pairs a user
// dismissed (see liveDismissals).

import { PAIR_WINDOW_DAYS } from "./import";

export type PairCandidate = {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  amount: number;
  accountId: string;
  transferAccountId: string | null;
};

/** A dismissed pair as stored: both rows in id order, as they were then. */
export type PairSnapshot = {
  firstId: string;
  secondId: string;
  firstAmount: number;
  firstDate: string;
  firstAccountId: string;
  secondAmount: number;
  secondDate: string;
  secondAccountId: string;
};

export type PossiblePair = {
  /** The money-out row (negative). */
  outId: string;
  /** The money-in row (positive). */
  inId: string;
  /** Magnitude: both rows carry it, one each way. */
  amount: number;
  daysApart: number;
  earlierDate: string;
  /** Distinct other rows that could match either side instead. */
  otherMatches: number;
  /** A row is tagged as a transfer to some account other than its match's. */
  isTaggedElsewhere: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const cents = (amount: number): number => Math.round(amount * 100);
const dayNumber = (isoDate: string): number =>
  Date.parse(`${isoDate}T00:00:00.000Z`) / DAY_MS;
const daysBetween = (a: PairCandidate, b: PairCandidate): number =>
  Math.abs(dayNumber(a.date) - dayNumber(b.date));

/** Two row ids in the order a dismissal stores them: plain string order. */
export function orderedIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export const pairKey = (a: string, b: string): string =>
  orderedIds(a, b).join("|");

export function isMatch(a: PairCandidate, b: PairCandidate): boolean {
  return (
    cents(a.amount) !== 0 &&
    cents(a.amount) === -cents(b.amount) &&
    a.accountId !== b.accountId &&
    daysBetween(a, b) <= PAIR_WINDOW_DAYS
  );
}

function toPair(
  a: PairCandidate,
  b: PairCandidate,
  otherMatches: number,
): PossiblePair {
  const [out, into] = a.amount < 0 ? [a, b] : [b, a];
  const isStrayTag = (row: PairCandidate, other: PairCandidate) =>
    row.transferAccountId !== null && row.transferAccountId !== other.accountId;
  return {
    outId: out.id,
    inId: into.id,
    amount: Math.abs(out.amount),
    daysApart: daysBetween(out, into),
    earlierDate: out.date.localeCompare(into.date) <= 0 ? out.date : into.date,
    otherMatches,
    isTaggedElsewhere: isStrayTag(out, into) || isStrayTag(into, out),
  };
}

const newestFirst = (a: PossiblePair, b: PossiblePair): number =>
  b.earlierDate.localeCompare(a.earlierDate) || a.outId.localeCompare(b.outId);

/**
 * Pairs the rows deterministically, the way pairOpposites does: in date order
 * (ties by id), each row takes the nearest-dated unpaired match after it.
 * Edges in `hidden` (pairKeys of live dismissals) are skipped, so hiding A–B
 * leaves A free to pair with C. Returns the pairs newest first.
 */
export function pairPossibleTransfers(
  rows: readonly PairCandidate[],
  hidden: ReadonlySet<string>,
): PossiblePair[] {
  const ordered = [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const byCents = new Map<number, PairCandidate[]>();
  for (const row of ordered) {
    const bucket = byCents.get(cents(row.amount)) ?? [];
    bucket.push(row);
    byCents.set(cents(row.amount), bucket);
  }
  const position = new Map(ordered.map((row, i) => [row.id, i]));
  const matchesOf = (row: PairCandidate) =>
    (byCents.get(-cents(row.amount)) ?? []).filter(
      (other) => isMatch(row, other) && !hidden.has(pairKey(row.id, other.id)),
    );

  const paired = new Set<string>();
  const pairs: PossiblePair[] = [];
  for (const row of ordered) {
    if (paired.has(row.id)) continue;
    const at = position.get(row.id) ?? 0;
    const match = matchesOf(row).find(
      (other) => !paired.has(other.id) && (position.get(other.id) ?? 0) > at,
    );
    if (!match) continue;
    paired.add(row.id);
    paired.add(match.id);
    const rivals = new Set(
      [...matchesOf(row), ...matchesOf(match)]
        .map((other) => other.id)
        .filter((id) => id !== row.id && id !== match.id),
    );
    pairs.push(toPair(row, match, rivals.size));
  }
  return pairs.sort(newestFirst);
}

/** The snapshot a dismissal stores, in id order whichever row is named first. */
export function snapshotOf(a: PairCandidate, b: PairCandidate): PairSnapshot {
  const [first, second] = orderedIds(a.id, b.id)[0] === a.id ? [a, b] : [b, a];
  return {
    firstId: first.id,
    secondId: second.id,
    firstAmount: first.amount,
    firstDate: first.date,
    firstAccountId: first.accountId,
    secondAmount: second.amount,
    secondDate: second.date,
    secondAccountId: second.accountId,
  };
}

/**
 * The dismissals that still hide their pair: both rows are present (live)
 * and unchanged in amount, date and account. Editing either row ends it.
 */
export function liveDismissals(
  rows: readonly PairCandidate[],
  dismissals: readonly PairSnapshot[],
): PairSnapshot[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const unchanged = (
    row: PairCandidate | undefined,
    amount: number,
    date: string,
    accountId: string,
  ) =>
    row !== undefined &&
    cents(row.amount) === cents(amount) &&
    row.date === date &&
    row.accountId === accountId;
  return dismissals.filter(
    (d) =>
      unchanged(
        byId.get(d.firstId),
        d.firstAmount,
        d.firstDate,
        d.firstAccountId,
      ) &&
      unchanged(
        byId.get(d.secondId),
        d.secondAmount,
        d.secondDate,
        d.secondAccountId,
      ),
  );
}

/** The live dismissals as pairs, newest first, for the "Show hidden pairs" view. */
export function hiddenPairs(
  rows: readonly PairCandidate[],
  live: readonly PairSnapshot[],
): PossiblePair[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return live
    .flatMap((d) => {
      const first = byId.get(d.firstId);
      const second = byId.get(d.secondId);
      return first && second ? [toPair(first, second, 0)] : [];
    })
    .sort(newestFirst);
}

export function daysApartLabel(days: number): string {
  if (days === 0) return "same day";
  return `${days} day${days === 1 ? "" : "s"} apart`;
}

export function pairWarnings(pair: PossiblePair): string[] {
  const n = pair.otherMatches;
  return [
    ...(n > 0 ? [`${n} other row${n === 1 ? "" : "s"} could also match`] : []),
    ...(pair.isTaggedElsewhere ? ["Tagged to a different account"] : []),
  ];
}
