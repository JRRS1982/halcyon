import type { AccountKind, BalanceItemType, Prisma } from "@prisma/client";
import { inferWrapper } from "@/lib/plan/seed";
import { prisma } from "@/lib/prisma";

export type BackfillResult = { accountsCreated: number; itemsLinked: number };

const KIND_BY_BALANCE_TYPE: Record<BalanceItemType, AccountKind> = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
};

// Two rows are the same thing when they share a type and a case-insensitive,
// trimmed label — which is exactly how copy-forward already relates a month's
// rows to the previous month's.
const keyFor = (type: BalanceItemType, label: string): string =>
  `${type}::${label.trim().toLowerCase()}`;

type ExistingAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  linkedAccountId: string | null;
};

type MortgageLinkCandidate = {
  liabilityAccountId: string;
  liabilityAccountLinkedAccountId: string | null;
  propertyAccountId: string;
};

// Decides which mortgage -> property links are safe to write, given what's
// already on file. Never overwrites a link that's already set (a second run
// must fight nothing), and never lets two liability accounts claim the same
// property or one liability account claim two properties — Account.linkedAccountId
// is @unique, so a second claim on an already-claimed side is dropped here
// rather than left to blow up as a database error.
function resolveMortgageLinks(
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

/**
 * Lifts `PlanLiability.linkedAssetId` pairings onto `Account.linkedAccountId`,
 * matching each side to an account by the same normalised (kind, label) key
 * the balance-item backfill above already uses — the plan row's `label`
 * against the account's `name`. A pairing whose asset or liability side has
 * no matching account (no balance row ever created one) is left unlinked
 * rather than guessed at.
 */
async function linkMortgagesToProperties(
  tx: Prisma.TransactionClient,
  userId: string,
  existingByName: Map<string, ExistingAccount[]>,
): Promise<void> {
  const pairings = await tx.planLiability.findMany({
    where: {
      deletedAt: null,
      linkedAssetId: { not: null },
      plan: { userId, deletedAt: null },
    },
    select: {
      label: true,
      linkedAsset: { select: { label: true, deletedAt: true } },
    },
  });
  if (pairings.length === 0) return;

  const accountByKey = new Map<string, ExistingAccount>();
  for (const bucket of existingByName.values()) {
    for (const account of bucket) {
      if (account.kind === "NONE") continue;
      accountByKey.set(keyFor(account.kind, account.name), account);
    }
  }

  const candidates: MortgageLinkCandidate[] = [];
  for (const pairing of pairings) {
    if (!pairing.linkedAsset || pairing.linkedAsset.deletedAt !== null) {
      continue;
    }
    const liabilityAccount = accountByKey.get(
      keyFor("LIABILITY", pairing.label),
    );
    const propertyAccount = accountByKey.get(
      keyFor("ASSET", pairing.linkedAsset.label),
    );
    if (!liabilityAccount || !propertyAccount) continue;

    candidates.push({
      liabilityAccountId: liabilityAccount.id,
      liabilityAccountLinkedAccountId: liabilityAccount.linkedAccountId,
      propertyAccountId: propertyAccount.id,
    });
  }

  const alreadyLinkedPropertyIds = new Set(
    [...accountByKey.values()]
      .map((a) => a.linkedAccountId)
      .filter((id): id is string => id !== null),
  );

  const links = resolveMortgageLinks(candidates, alreadyLinkedPropertyIds);
  for (const link of links) {
    await tx.account.update({
      where: { id: link.liabilityAccountId },
      data: { linkedAccountId: link.propertyAccountId },
    });
  }
}

/**
 * Give every unlinked balance row an Account, creating one per distinct
 * (type, label) pair for the user.
 *
 * Idempotent: it only ever reads rows with `accountId: null` and only ever
 * creates an account when no account of that name exists, so a second run over
 * the same data is a no-op — including a run that resumes after a previous one
 * failed partway through, since every write happens inside one transaction.
 * Safe to run against live data, which is the point — this is the only
 * irreversible step in the phase.
 */
export async function backfillAccountsForUser(
  userId: string,
): Promise<BackfillResult> {
  return prisma.$transaction((tx) => runBackfill(tx, userId), {
    timeout: 60_000,
  });
}

async function runBackfill(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<BackfillResult> {
  const items = await tx.balanceItem.findMany({
    where: {
      accountId: null,
      deletedAt: null,
      period: { userId, deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, category: true, label: true },
  });

  const existing = await tx.account.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, kind: true, linkedAccountId: true },
  });

  // Grouped by name rather than a single best match, because nothing stops a
  // user (or an earlier partial run) from holding two accounts with the same
  // name — an asset and a liability, or two plain "NONE" accounts. Each
  // group's entries are mutated in place as they get claimed below, so a
  // later balance row never sees a stale "NONE" for an account this same run
  // already promoted.
  const existingByName = new Map<string, ExistingAccount[]>();
  for (const account of existing) {
    const nameKey = account.name.trim().toLowerCase();
    const bucket = existingByName.get(nameKey);
    if (bucket) {
      bucket.push(account);
    } else {
      existingByName.set(nameKey, [account]);
    }
  }

  const resolved = new Map<string, string>();
  let accountsCreated = 0;
  let itemsLinked = 0;

  for (const item of items) {
    const key = keyFor(item.type, item.label);
    let accountId = resolved.get(key);

    if (!accountId) {
      const kind = KIND_BY_BALANCE_TYPE[item.type];
      const nameKey = item.label.trim().toLowerCase();
      const candidates = existingByName.get(nameKey) ?? [];
      // An account with no kind yet is a plain transaction account that turns
      // out to be a balance-sheet line too; match it by name and promote it
      // rather than creating a second record for the same thing. A
      // kind-matching candidate is preferred over a "NONE" one so a name with
      // several existing accounts doesn't promote the wrong one.
      const match =
        candidates.find((a) => a.kind === kind) ??
        candidates.find((a) => a.kind === "NONE");

      if (match) {
        await tx.account.update({
          where: { id: match.id },
          data: {
            kind,
            category: item.category,
            // The `match.kind === kind` branch can only be reached by an
            // account this function itself created on an earlier, partial
            // run — nothing else sets `kind` yet — so overwriting
            // category/wrapper unconditionally is safe today. Revisit this
            // once something else can set `kind` on an existing account.
            wrapper:
              kind === "ASSET" ? inferWrapper(item.label, item.category) : null,
          },
        });
        // Mutated in place: `match` is the same object stored in
        // `existingByName`, so a later row with a different type sees the
        // real, post-promotion kind instead of the stale "NONE" read at the
        // top of this function.
        match.kind = kind;
        accountId = match.id;
      } else {
        const created = await tx.account.create({
          data: {
            userId,
            name: item.label.trim(),
            kind,
            category: item.category,
            wrapper:
              kind === "ASSET" ? inferWrapper(item.label, item.category) : null,
            // A backfilled balance-sheet line has never had a statement
            // imported to it; the user opts in afterwards if they want one.
            canImportTransactions: false,
          },
        });
        accountsCreated += 1;
        accountId = created.id;
        candidates.push({
          id: created.id,
          name: item.label.trim(),
          kind,
          linkedAccountId: null,
        });
        existingByName.set(nameKey, candidates);
      }
      resolved.set(key, accountId);
    }

    await tx.balanceItem.update({
      where: { id: item.id },
      data: { accountId },
    });
    itemsLinked += 1;
  }

  await linkMortgagesToProperties(tx, userId, existingByName);

  return { accountsCreated, itemsLinked };
}
