import type { AccountKind, BalanceItemType, Prisma } from "@prisma/client";
import { inferWrapper } from "@/lib/plan/seed";
import { prisma } from "@/lib/prisma";
import {
  keyFor,
  type MortgageLinkCandidate,
  resolveMortgageLinks,
} from "./mortgageLinks";

export type BackfillResult = { accountsCreated: number; itemsLinked: number };

const KIND_BY_BALANCE_TYPE: Record<BalanceItemType, AccountKind> = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
};

// Two rows are the same thing when they share a type and a case-insensitive,
// trimmed label — which is exactly how copy-forward already relates a month's
// rows to the previous month's.
type ExistingAccount = {
  id: string;
  name: string;
  kind: AccountKind;
  linkedAccountId: string | null;
};

/**
 * Lifts `PlanLiability.linkedAssetId` pairings onto `Account.linkedAccountId`.
 *
 * The property side is resolved via `PlanAsset.sourceBalanceItemId` first —
 * a fact rather than a guess, populated whenever the plan asset was seeded
 * from the balance sheet (src/lib/plan/seed.ts) — and only falls back to the
 * same normalised (kind, label) key the balance-item backfill above already
 * uses when `sourceBalanceItemId` is null. `PlanLiability` has no equivalent
 * source field, so the liability side is always label-matched; a liability
 * relabelled independently of its plan row after seeding could in principle
 * pair with the wrong property — a known, accepted residual risk (see the
 * task report). A pairing whose asset or liability side still has no
 * matching account (no balance row ever created one) is left unlinked
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
    // Deterministic winner when two pairings contend for one property or
    // one liability account (see resolveMortgageLinks) — first-created
    // wins, matching the balance-item loop above rather than leaving it to
    // whatever order Postgres happens to return.
    orderBy: { createdAt: "asc" },
    select: {
      label: true,
      linkedAsset: {
        select: { label: true, deletedAt: true, sourceBalanceItemId: true },
      },
    },
  });
  if (pairings.length === 0) return;

  // First-wins, matching the balance-item loop's `candidates.find` above:
  // each bucket is already createdAt-ascending, so keeping only the first
  // account seen per (kind, label) key picks the oldest, same as that loop.
  const accountByKey = new Map<string, ExistingAccount>();
  for (const bucket of existingByName.values()) {
    for (const account of bucket) {
      if (account.kind === "NONE") continue;
      const key = keyFor(account.kind, account.name);
      if (!accountByKey.has(key)) accountByKey.set(key, account);
    }
  }

  const sourceItemIds = pairings
    .map((p) => p.linkedAsset?.sourceBalanceItemId)
    .filter((id): id is string => id != null);
  const sourceItems =
    sourceItemIds.length > 0
      ? await tx.balanceItem.findMany({
          where: {
            id: { in: sourceItemIds },
            deletedAt: null,
            period: { userId, deletedAt: null },
          },
          select: { id: true, accountId: true },
        })
      : [];
  const accountIdBySourceItem = new Map<string, string>();
  for (const item of sourceItems) {
    if (item.accountId) accountIdBySourceItem.set(item.id, item.accountId);
  }

  const candidates: MortgageLinkCandidate[] = [];
  for (const pairing of pairings) {
    if (!pairing.linkedAsset || pairing.linkedAsset.deletedAt !== null) {
      continue;
    }
    const liabilityAccount = accountByKey.get(
      keyFor("LIABILITY", pairing.label),
    );
    const propertyAccountId = pairing.linkedAsset.sourceBalanceItemId
      ? accountIdBySourceItem.get(pairing.linkedAsset.sourceBalanceItemId)
      : accountByKey.get(keyFor("ASSET", pairing.linkedAsset.label))?.id;
    if (!liabilityAccount || !propertyAccountId) continue;

    candidates.push({
      liabilityAccountId: liabilityAccount.id,
      liabilityAccountLinkedAccountId: liabilityAccount.linkedAccountId,
      propertyAccountId,
    });
  }

  // Deliberately unfiltered by `deletedAt`, `kind` or name — see
  // resolveMortgageLinks' comment. An archived liability account still holds
  // its link and still occupies the unique index; existingByName can't see
  // it (it only reads `deletedAt: null`), so this reads the database again
  // rather than reusing that map.
  const alreadyLinked = await tx.account.findMany({
    where: { userId, linkedAccountId: { not: null } },
    select: { linkedAccountId: true },
  });
  const alreadyLinkedPropertyIds = new Set(
    alreadyLinked
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
    // Secondary sort for determinism: rows written by one transaction (a
    // month's worth of balance items, all created together) share an
    // identical createdAt, and that tie currently decides which row's
    // category seeds a new account.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
  const itemIdsByAccount = new Map<string, string[]>();
  let accountsCreated = 0;

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
          // Only a plain `kind: NONE` account — a transaction account with no
          // balance-sheet classification yet — is safe to classify from the
          // free-text label, so category/wrapper are only written together
          // with kind on that branch. A match that already carries a kind may
          // be an account the user created deliberately through the
          // Add-account drawer (createAccountWithBalance sets `kind` on every
          // account it creates) with their own choice of Section and
          // Wrapper — never overwrite that. The only other way to reach this
          // branch is a resumed partial run, where an earlier pass already
          // promoted this account to the same kind; writing `kind` again
          // there is a no-op.
          data:
            match.kind === "NONE"
              ? {
                  kind,
                  category: item.category,
                  wrapper:
                    kind === "ASSET"
                      ? inferWrapper(item.label, item.category)
                      : null,
                }
              : { kind },
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

    const ids = itemIdsByAccount.get(accountId);
    if (ids) {
      ids.push(item.id);
    } else {
      itemIdsByAccount.set(accountId, [item.id]);
    }
  }

  // One updateMany per account rather than one UPDATE per row: over a remote
  // connection at ~10-20ms per round trip, thousands of sequential per-row
  // UPDATEs is what makes the transaction's 60s cap a realistic failure for a
  // large user. Grouping by the already-resolved accountId turns that into a
  // handful of round trips.
  let itemsLinked = 0;
  for (const [accountId, ids] of itemIdsByAccount) {
    await tx.balanceItem.updateMany({
      where: { id: { in: ids } },
      data: { accountId },
    });
    itemsLinked += ids.length;
  }

  await linkMortgagesToProperties(tx, userId, existingByName);

  return { accountsCreated, itemsLinked };
}
