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

type ExistingAccount = { id: string; name: string; kind: AccountKind };

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
  if (items.length === 0) return { accountsCreated: 0, itemsLinked: 0 };

  const existing = await tx.account.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, kind: true },
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
        candidates.push({ id: created.id, name: item.label.trim(), kind });
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

  return { accountsCreated, itemsLinked };
}
