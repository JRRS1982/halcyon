// Pure arbitration for the backfill's mortgage-to-property linking.
//
// Deliberately free of any database import. `backfill.ts` pulls in
// `src/lib/prisma`, which validates environment variables at module load, so a
// unit test importing these helpers from there dragged a Prisma client and a
// full env check into a test that needs neither — and failed in CI, where those
// variables are not set. The rules below are data in, data out; they belong
// somewhere a test can reach without a database.

import type { BalanceItemType } from "@prisma/client";

// Two rows describe the same thing when they share a type and a trimmed,
// case-insensitive label — the same rule copy-forward already uses to relate
// one month's balance rows to the previous month's.
export const keyFor = (type: BalanceItemType, label: string): string =>
  `${type}::${label.trim().toLowerCase()}`;

export type MortgageLinkCandidate = {
  liabilityAccountId: string;
  liabilityAccountLinkedAccountId: string | null;
  propertyAccountId: string;
};

// Decides which mortgage -> property links are safe to write, given what's
// already on file. Never overwrites a link that's already set (a second run
// must fight nothing), and never lets two liability accounts claim the same
// property or one liability account claim two properties — Account.linkedAccountId
// is @unique, so a second claim on an already-claimed side is dropped here
// rather than left to blow up as a database error. `alreadyLinkedPropertyIds`
// must come from an unfiltered read of every account's *current*
// `linkedAccountId` (ignoring `deletedAt`, `kind`, and name-collision dedup)
// — an archived mortgage still holds its link (see resolveLinkedPartnerId's
// own comment in accountActions.ts), and the unique index enforces this
// regardless of soft-delete state. Exported for direct unit testing — the
// arbitration here is the part worth testing without a database.
export function resolveMortgageLinks(
  candidates: MortgageLinkCandidate[],
  alreadyLinkedPropertyIds: ReadonlySet<string>,
): { liabilityAccountId: string; propertyAccountId: string }[] {
  const claimedProperties = new Set(alreadyLinkedPropertyIds);
  const claimedLiabilities = new Set<string>();
  const links: { liabilityAccountId: string; propertyAccountId: string }[] = [];

  for (const candidate of candidates) {
    if (candidate.liabilityAccountLinkedAccountId !== null) continue;
    if (claimedLiabilities.has(candidate.liabilityAccountId)) continue;
    if (claimedProperties.has(candidate.propertyAccountId)) continue;
    claimedProperties.add(candidate.propertyAccountId);
    claimedLiabilities.add(candidate.liabilityAccountId);
    links.push({
      liabilityAccountId: candidate.liabilityAccountId,
      propertyAccountId: candidate.propertyAccountId,
    });
  }

  return links;
}
