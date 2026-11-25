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

/** What a row's category cell holds: a category, a transfer, or neither. */
export type RowTag = {
  categoryId: string | null;
  transferAccountId: string | null;
  isCategoryConfirmed: boolean;
};

export type TaggedRow = RowTag & { id: string };

/** A pair marked as a transfer, with what each row held before it was. */
export type MarkedPair = {
  outId: string;
  inId: string;
  outBefore: RowTag;
  inBefore: RowTag;
};

/** No category and no transfer; such a row is stored as confirmed. */
export const UNTAGGED: RowTag = {
  categoryId: null,
  transferAccountId: null,
  isCategoryConfirmed: true,
};

type Side = { id: string; accountId: string };
type TaggedSide = Side & { transferAccountId: string | null };

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

const isStrayTag = (row: TaggedSide, other: TaggedSide): boolean =>
  row.transferAccountId !== null && row.transferAccountId !== other.accountId;

/** A row is tagged as a transfer to some account other than its match's. */
export const isTaggedElsewhere = (a: TaggedSide, b: TaggedSide): boolean =>
  isStrayTag(a, b) || isStrayTag(b, a);

/** Both rows are tagged as a transfer to the other row's account. */
export const isMarkedAsTransfer = (a: TaggedSide, b: TaggedSide): boolean =>
  a.transferAccountId === b.accountId && b.transferAccountId === a.accountId;

function toPair(
  a: PairCandidate,
  b: PairCandidate,
  otherMatches: number,
): PossiblePair {
  const [out, into] = a.amount < 0 ? [a, b] : [b, a];
  return {
    outId: out.id,
    inId: into.id,
    amount: Math.abs(out.amount),
    daysApart: daysBetween(out, into),
    earlierDate: out.date.localeCompare(into.date) <= 0 ? out.date : into.date,
    otherMatches,
    isTaggedElsewhere: isTaggedElsewhere(out, into),
  };
}

const newestFirst = (a: PossiblePair, b: PossiblePair): number =>
  b.earlierDate.localeCompare(a.earlierDate) ||
  a.outId.localeCompare(b.outId) ||
  a.inId.localeCompare(b.inId);

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

/**
 * The live dismissals as pairs, newest first, for the "Show hidden pairs"
 * view. A row hidden in two pairs (A–B hidden, then A–C) is listed once, in
 * the first pair the list shows; unhiding that one reveals the next.
 */
export function hiddenPairs(
  rows: readonly PairCandidate[],
  live: readonly PairSnapshot[],
): PossiblePair[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const all = live
    .flatMap((d) => {
      const first = byId.get(d.firstId);
      const second = byId.get(d.secondId);
      return first && second ? [toPair(first, second, 0)] : [];
    })
    .sort(newestFirst);
  const shown = new Set<string>();
  return all.filter((pair) => {
    if (shown.has(pair.outId) || shown.has(pair.inId)) return false;
    shown.add(pair.outId);
    shown.add(pair.inId);
    return true;
  });
}

/**
 * The page's pairs plus the held ones it no longer lists, newest first, so a
 * pair the user just approved keeps its place when a filter drops it.
 */
export function withHeldPairs<P extends PossiblePair>(
  listed: readonly P[],
  held: readonly P[],
): P[] {
  const onPage = new Set(listed.map((pair) => pairKey(pair.outId, pair.inId)));
  return [
    ...listed,
    ...held.filter((pair) => !onPage.has(pairKey(pair.outId, pair.inId))),
  ].sort(newestFirst);
}

/**
 * The transfer a pair suggests for `row`: to the other row's account when
 * `row` is money out, from it when money in. Null when `row` already has a
 * category or a transfer, which a suggestion never covers.
 */
export function transferSuggestion(
  row: Pick<RowTag, "categoryId" | "transferAccountId"> & { amount: number },
  other: { accountName: string },
): string | null {
  if (row.categoryId !== null || row.transferAccountId !== null) return null;
  return `Transfer ${row.amount < 0 ? "to" : "from"} ${other.accountName}`;
}

/** What marking a pair leaves: each row a transfer to the other's account. */
export function transferTags(out: Side, into: Side): TaggedRow[] {
  const pointAt = (row: Side, other: Side): TaggedRow => ({
    id: row.id,
    transferAccountId: other.accountId,
    categoryId: null,
    isCategoryConfirmed: true,
  });
  return [pointAt(out, into), pointAt(into, out)];
}

/** What withdrawing a marked pair puts back on each row. */
export function beforeTags(marked: MarkedPair): TaggedRow[] {
  return [
    { id: marked.outId, ...marked.outBefore },
    { id: marked.inId, ...marked.inBefore },
  ];
}

export function daysApartLabel(days: number): string {
  if (days === 0) return "same day";
  return `${days} day${days === 1 ? "" : "s"} apart`;
}

type PairFlags = Pick<PossiblePair, "otherMatches" | "isTaggedElsewhere">;

export function pairWarnings(pair: PairFlags): string[] {
  const n = pair.otherMatches;
  return [
    ...(n > 0 ? [`${n} other row${n === 1 ? "" : "s"} could also match`] : []),
    ...(pair.isTaggedElsewhere ? ["Tagged to a different account"] : []),
  ];
}

/** Approve all takes only the pairs with nothing for the user to check. */
export const isEligibleForApproveAll = (pair: PairFlags): boolean =>
  pairWarnings(pair).length === 0;

/**
 * Where a pair on screen stands for the page's Approve all, worked out from
 * its rows as they are now. `held` is what the ledger remembers of a pair it
 * approved or withdrew in this view.
 *
 * Approving a pair clears its "tagged to a different account" warning: both
 * rows then point at each other. So an approved pair answers with the
 * eligibility it had when it was approved, and a pair the user approved by
 * hand, warning and all, stays out of the page's batch.
 */
export function approvalState(
  listed: Pick<PossiblePair, "otherMatches">,
  out: TaggedSide,
  into: TaggedSide,
  held: { isEligible: boolean } | null,
): {
  isTaggedElsewhere: boolean;
  isApproved: boolean;
  isEligible: boolean;
  isHeld: boolean;
} {
  const isApproved = isMarkedAsTransfer(out, into);
  const now = {
    otherMatches: listed.otherMatches,
    isTaggedElsewhere: isTaggedElsewhere(out, into),
  };
  return {
    isTaggedElsewhere: now.isTaggedElsewhere,
    isApproved,
    isEligible:
      isApproved && held ? held.isEligible : isEligibleForApproveAll(now),
    isHeld: held !== null,
  };
}

/**
 * What the page's Approve all button does next: approve the eligible pairs
 * still waiting, or, with none waiting, withdraw the ones this view approved
 * (`isHeld`). A pair tagged before this view is never withdrawn in bulk. Null
 * when there is nothing to do either way.
 */
export function approveAllOffer<
  T extends { isEligible: boolean; isApproved: boolean; isHeld: boolean },
>(pairs: readonly T[]): { action: "approve" | "withdraw"; pairs: T[] } | null {
  const eligible = pairs.filter((pair) => pair.isEligible);
  const waiting = eligible.filter((pair) => !pair.isApproved);
  if (waiting.length > 0) return { action: "approve", pairs: waiting };
  const approvedHere = eligible.filter((pair) => pair.isHeld);
  return approvedHere.length > 0
    ? { action: "withdraw", pairs: approvedHere }
    : null;
}

const pairCount = (n: number) => `${n} pair${n === 1 ? "" : "s"}`;

/** After "Not a transfer": what was hidden, and what no longer matched. */
export function dismissNotice(hidden: number, skipped: number): string {
  const parts = [
    ...(hidden > 0 ? [`Hid ${pairCount(hidden)}: not a transfer.`] : []),
    ...(skipped > 0
      ? [
          `${pairCount(skipped)} no longer matched, so ${skipped === 1 ? "it is" : "they are"} still listed.`,
        ]
      : []),
  ];
  return parts.join(" ");
}

/** After "Mark as transfer": the pairs left alone, or null when none were. */
export function markNotice(skipped: number): string | null {
  if (skipped === 0) return null;
  const one = skipped === 1;
  return `${pairCount(skipped)} ${one ? "was" : "were"} not marked: ${one ? "it no longer matches" : "they no longer match"}, or one side is in an archived account.`;
}

function markedSentence(marked: number, left: number): string | null {
  if (marked === 0) return null;
  if (marked === 1 && left === 0) return "Both rows marked as a transfer.";
  const what =
    marked === 1
      ? "1 pair marked as a transfer"
      : `${marked} pairs marked as transfers`;
  return left > 0
    ? `${what}; ${left} with a warning left for you.`
    : `${what}.`;
}

/**
 * After approving: the pairs marked, the warned ones Approve all left for the
 * user, and any the server would not mark.
 */
export function approveNotice(
  marked: number,
  left: number,
  skipped: number,
): string {
  return [markedSentence(marked, left), markNotice(skipped)]
    .filter((sentence) => sentence !== null)
    .join(" ");
}

function withdrawnSentence(putBack: number, cleared: number): string | null {
  const total = putBack + cleared;
  if (total === 0) return null;
  const are = (n: number) => `${n} ${n === 1 ? "is" : "are"}`;
  if (putBack > 0 && cleared > 0)
    return `Approval withdrawn from ${total} pairs: ${are(putBack)} as they were, ${are(cleared)} uncategorised again.`;
  const outcome = cleared === 0 ? "as they were" : "uncategorised again";
  return total === 1
    ? `Approval withdrawn: both rows are ${outcome}.`
    : `Approval withdrawn from ${total} pairs: their rows are ${outcome}.`;
}

/**
 * After withdrawing: the pairs put back as they were, the ones with nothing
 * remembered (marked before this visit) and so left uncategorised, and any
 * changed since and so left alone.
 */
export function withdrawNotice(
  putBack: number,
  cleared: number,
  skipped: number,
): string {
  const one = skipped === 1;
  const leftAlone =
    skipped > 0
      ? `${pairCount(skipped)} ${one ? "was left as it is: its rows have" : "were left as they are: their rows have"} changed since.`
      : null;
  return [withdrawnSentence(putBack, cleared), leftAlone]
    .filter((sentence) => sentence !== null)
    .join(" ");
}
