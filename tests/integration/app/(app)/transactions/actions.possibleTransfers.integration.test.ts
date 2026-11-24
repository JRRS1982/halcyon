import { TEST_USER_ID } from "@test/support/helpers";
import {
  bulkDeleteTransactions,
  dismissPairs,
  markPairsAsTransfer,
  reverseImport,
  unhidePairs,
} from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { MAX_DISMISSED_PAIRS_PER_USER } from "@/lib/transactions/limits";
import { getTransactionsPage } from "@/lib/transactions/server";

const OTHER_USER = "00000000-0000-0000-0000-0000000000bb";

const account = (name: string, userId = TEST_USER_ID) =>
  prisma.account.create({
    data: { userId, name, ...buildAccountData({ type: "CURRENT_ACCOUNT" }) },
  });

const tx = (
  accountId: string,
  date: string,
  amount: number,
  extra: { userId?: string; importBatchId?: string } = {},
) =>
  prisma.transaction.create({
    data: {
      userId: extra.userId ?? TEST_USER_ID,
      accountId,
      date: new Date(date),
      amount,
      description: `${amount} on ${date}`,
      importBatchId: extra.importBatchId,
    },
  });

const pairsOnScreen = async () =>
  (await getTransactionsPage(TEST_USER_ID, { possibleTransfers: true })).pairs;

const seedPair = async () => {
  const current = await account("Current");
  const savings = await account("Savings");
  const out = await tx(current.id, "2026-11-03", -200);
  const into = await tx(savings.id, "2026-11-04", 200);
  return { current, savings, out, into };
};

describe("markPairsAsTransfer (integration)", () => {
  test("points each row at the other row's account and approves both", async () => {
    const { current, savings, out, into } = await seedPair();

    const result = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toEqual({ updated: 2 });
    const rows = await prisma.transaction.findMany({
      where: { id: { in: [out.id, into.id] } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(out.id)?.transferAccountId).toBe(savings.id);
    expect(byId.get(into.id)?.transferAccountId).toBe(current.id);
    expect(rows.every((row) => row.categoryId === null)).toBe(true);
    expect(rows.every((row) => row.isCategoryConfirmed)).toBe(true);
  });

  test("leaves another user's rows untouched", async () => {
    await prisma.user.create({ data: { id: OTHER_USER } });
    const theirsA = await account("A", OTHER_USER);
    const theirsB = await account("B", OTHER_USER);
    const out = await tx(theirsA.id, "2026-11-03", -5, { userId: OTHER_USER });
    const into = await tx(theirsB.id, "2026-11-03", 5, { userId: OTHER_USER });

    const result = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toEqual({ updated: 0 });
    const rows = await prisma.transaction.findMany({
      where: { id: { in: [out.id, into.id] } },
    });
    expect(rows.every((row) => row.transferAccountId === null)).toBe(true);
  });
});

describe("dismissPairs / unhidePairs (integration)", () => {
  test("a dismissed pair stops showing, and unhiding brings it back", async () => {
    const { out, into } = await seedPair();
    const pair = { outId: out.id, inId: into.id };

    expect(await dismissPairs({ pairs: [pair] })).toEqual({ dismissed: 1 });
    expect(await pairsOnScreen()).toEqual([]);

    expect(await unhidePairs({ pairs: [pair] })).toEqual({ unhidden: 1 });
    expect(await pairsOnScreen()).toHaveLength(1);
  });

  test("stores a snapshot of both rows, in id order", async () => {
    const { current, savings, out, into } = await seedPair();

    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });

    const [first, second] = [out, into].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const stored = await prisma.dismissedTransferPair.findFirstOrThrow();
    expect(stored).toMatchObject({
      userId: TEST_USER_ID,
      firstId: first?.id,
      secondId: second?.id,
      firstAccountId: first?.id === out.id ? current.id : savings.id,
    });
  });

  test("dismissing twice keeps one record", async () => {
    const { out, into } = await seedPair();
    const pair = { outId: out.id, inId: into.id };

    await dismissPairs({ pairs: [pair] });
    await dismissPairs({ pairs: [{ outId: into.id, inId: out.id }] });

    expect(await prisma.dismissedTransferPair.count()).toBe(1);
  });

  test("refuses two rows that are not a possible transfer, writing nothing", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    const out = await tx(current.id, "2026-11-03", -200);
    const unrelated = await tx(savings.id, "2026-11-03", 199);

    const result = await dismissPairs({
      pairs: [{ outId: out.id, inId: unrelated.id }],
    });

    expect(result).toEqual({ dismissed: 0 });
    expect(await prisma.dismissedTransferPair.count()).toBe(0);
  });

  test("refuses past the per-user cap, writing nothing", async () => {
    const { current, savings, out, into } = await seedPair();
    // The cap counts records, whatever they name: fill it with a cross join
    // of 100 x 100 real rows, as the foreign keys require.
    await prisma.$executeRaw`
      INSERT INTO "Transaction" (id, "userId", "accountId", date, amount, description, "updatedAt")
      SELECT gen_random_uuid(), ${TEST_USER_ID}::uuid, a.id, '2020-01-01', -1, 'filler', now()
      FROM "Account" a, generate_series(1, 100)
      WHERE a.id IN (${current.id}::uuid, ${savings.id}::uuid)`;
    await prisma.$executeRaw`
      INSERT INTO "DismissedTransferPair"
        (id, "userId", "firstId", "secondId", "firstAmount", "firstDate",
         "firstAccountId", "secondAmount", "secondDate", "secondAccountId")
      SELECT gen_random_uuid(), ${TEST_USER_ID}::uuid, f.id, s.id, -1,
             '2020-01-01', f."accountId", -1, '2020-01-01', s."accountId"
      FROM "Transaction" f, "Transaction" s
      WHERE f.description = 'filler' AND s.description = 'filler'
        AND f."accountId" = ${current.id}::uuid
        AND s."accountId" = ${savings.id}::uuid
      LIMIT ${MAX_DISMISSED_PAIRS_PER_USER}`;
    expect(await prisma.dismissedTransferPair.count()).toBe(
      MAX_DISMISSED_PAIRS_PER_USER,
    );

    await expect(
      dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] }),
    ).rejects.toThrow(/hidden pairs/);
    expect(
      await prisma.dismissedTransferPair.count({
        where: { OR: [{ firstId: out.id }, { secondId: out.id }] },
      }),
    ).toBe(0);
  });

  test("deleting a row removes the dismissal that named it", async () => {
    const { out, into } = await seedPair();
    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });

    await bulkDeleteTransactions({ transactionIds: [into.id] });

    expect(await prisma.dismissedTransferPair.count()).toBe(0);
  });

  test("undoing an import removes the dismissals naming its rows", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    const batch = await prisma.importBatch.create({
      data: { userId: TEST_USER_ID, accountId: savings.id },
    });
    const out = await tx(current.id, "2026-11-03", -200);
    const into = await tx(savings.id, "2026-11-03", 200, {
      importBatchId: batch.id,
    });
    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });

    await reverseImport({ batchId: batch.id });

    expect(await prisma.dismissedTransferPair.count()).toBe(0);
  });
});
