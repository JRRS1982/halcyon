import type { AccountKind, BalanceItemType } from "@prisma/client";
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

/**
 * Give every unlinked balance row an Account, creating one per distinct
 * (type, label) pair for the user.
 *
 * Idempotent: it only ever reads rows with `accountId: null` and only ever
 * creates an account when no account of that name exists, so a second run over
 * the same data is a no-op. Safe to run against live data, which is the point —
 * this is the only irreversible step in the phase.
 */
export async function backfillAccountsForUser(
  userId: string,
): Promise<BackfillResult> {
  const items = await prisma.balanceItem.findMany({
    where: {
      accountId: null,
      deletedAt: null,
      period: { userId, deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, category: true, label: true },
  });
  if (items.length === 0) return { accountsCreated: 0, itemsLinked: 0 };

  const existing = await prisma.account.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, name: true, kind: true },
  });

  // An account with no kind yet is a plain transaction account that turns out
  // to be a balance-sheet line too; match it by name and promote it rather than
  // creating a second record for the same thing.
  const byName = new Map(existing.map((a) => [a.name.trim().toLowerCase(), a]));

  const resolved = new Map<string, string>();
  let accountsCreated = 0;
  let itemsLinked = 0;

  for (const item of items) {
    const key = keyFor(item.type, item.label);
    let accountId = resolved.get(key);

    if (!accountId) {
      const kind = KIND_BY_BALANCE_TYPE[item.type];
      const match = byName.get(item.label.trim().toLowerCase());

      if (match && (match.kind === "NONE" || match.kind === kind)) {
        await prisma.account.update({
          where: { id: match.id },
          data: {
            kind,
            category: item.category,
            wrapper: inferWrapper(item.label, item.category),
          },
        });
        accountId = match.id;
      } else {
        const created = await prisma.account.create({
          data: {
            userId,
            name: item.label.trim(),
            kind,
            category: item.category,
            wrapper: inferWrapper(item.label, item.category),
            // A backfilled balance-sheet line has never had a statement
            // imported to it; the user opts in afterwards if they want one.
            canImportTransactions: false,
          },
        });
        accountsCreated += 1;
        accountId = created.id;
      }
      resolved.set(key, accountId);
    }

    await prisma.balanceItem.update({
      where: { id: item.id },
      data: { accountId },
    });
    itemsLinked += 1;
  }

  return { accountsCreated, itemsLinked };
}
