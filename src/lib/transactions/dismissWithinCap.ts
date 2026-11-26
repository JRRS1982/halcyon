import type { Prisma } from "@prisma/client";
import { assertRoom } from "@/lib/limits/ceilings";
import { MAX_DISMISSED_PAIRS_PER_USER } from "./limits";
import type { PairSnapshot } from "./possibleTransfers";

// The only place in the app that writes a DismissedTransferPair, so the cap
// cannot be walked past by a second write site (tests/unit/createSites.test.ts
// fails the build on one). See categories/createWithinCap.ts for why.

export const dismissLimitError = `You can keep up to ${MAX_DISMISSED_PAIRS_PER_USER.toLocaleString("en-GB")} hidden pairs. Unhide some first.`;

/** Thrown when the new pairs would pass the cap; nothing has been stored. */
export class DismissLimitError extends Error {
  constructor() {
    super(dismissLimitError);
  }
}

const atUtcMidnight = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`);

const keyOf = (d: { firstId: string; secondId: string }) =>
  `${d.firstId}|${d.secondId}`;

/**
 * Stores each snapshot inside `tx`, refreshing any pair already stored, or
 * throws DismissLimitError when the new pairs would pass the cap.
 *
 * First it removes the user's dismissals that no longer hide anything: a row
 * deleted, or edited or moved so it no longer matches its snapshot. They are
 * invisible (Show hidden pairs lists only live ones), so left in place they
 * would fill the cap with records the user cannot see to unhide.
 */
export async function dismissWithinCap(
  tx: Prisma.TransactionClient,
  userId: string,
  requested: readonly PairSnapshot[],
): Promise<void> {
  // One record per pair, however often the request names it.
  const snapshots = [...new Map(requested.map((s) => [keyOf(s), s])).values()];

  await tx.$executeRaw`
    DELETE FROM "DismissedTransferPair" d
    USING "Transaction" f, "Transaction" s
    WHERE d."userId" = ${userId}::uuid
      AND f.id = d."firstId"
      AND s.id = d."secondId"
      AND (f."deletedAt" IS NOT NULL OR s."deletedAt" IS NOT NULL
        OR f.amount <> d."firstAmount" OR s.amount <> d."secondAmount"
        OR f.date <> d."firstDate" OR s.date <> d."secondDate"
        OR f."accountId" <> d."firstAccountId"
        OR s."accountId" <> d."secondAccountId")`;

  // Refreshing a pair already hidden adds no record, so only new pairs count.
  const existing = await tx.dismissedTransferPair.findMany({
    where: {
      userId,
      OR: snapshots.map(({ firstId, secondId }) => ({ firstId, secondId })),
    },
    select: { firstId: true, secondId: true },
  });
  const known = new Set(existing.map(keyOf));
  const fresh = snapshots.filter((s) => !known.has(keyOf(s)));
  const refreshed = snapshots.filter((s) => known.has(keyOf(s)));

  // Nothing here is soft deleted, so the live count is every record held and
  // the two ceilings read the same rows.
  const countAll = () => tx.dismissedTransferPair.count({ where: { userId } });
  await assertRoom({
    countLive: countAll,
    countStored: countAll,
    liveMax: MAX_DISMISSED_PAIRS_PER_USER,
    liveError: () => new DismissLimitError(),
    adding: fresh.length,
  });

  const asData = (snapshot: PairSnapshot) => ({
    ...snapshot,
    firstDate: atUtcMidnight(snapshot.firstDate),
    secondDate: atUtcMidnight(snapshot.secondDate),
  });
  await tx.dismissedTransferPair.createMany({
    data: fresh.map((snapshot) => ({ userId, ...asData(snapshot) })),
  });
  for (const snapshot of refreshed) {
    await tx.dismissedTransferPair.updateMany({
      where: {
        userId,
        firstId: snapshot.firstId,
        secondId: snapshot.secondId,
      },
      data: asData(snapshot),
    });
  }
}
