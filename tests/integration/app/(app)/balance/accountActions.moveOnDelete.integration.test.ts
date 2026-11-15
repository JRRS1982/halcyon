import { resetDb, seedUser, TEST_USER_ID } from "@test/support/helpers";
import {
  accountDeletionCounts,
  deleteAccountEverywhere,
} from "@/app/(app)/balance/accountActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

// Deleting an account that still holds transactions used to be a dead end:
// "Reassign or remove them first", with no way to do either in bulk. Moving
// them to another account keeps the user's ledger whole while the account
// itself goes — the way to merge a duplicate account into the real one.

const account = (name: string) =>
  prisma.account.create({
    data: {
      userId: TEST_USER_ID,
      name,
      ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
    },
  });

const txn = (
  accountId: string,
  extra: { transferAccountId?: string; deletedAt?: Date } = {},
) =>
  prisma.transaction.create({
    data: {
      userId: TEST_USER_ID,
      accountId,
      date: new Date("2026-03-01"),
      amount: -10,
      description: "Tesco",
      ...extra,
    },
  });

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("deleting an account and moving its transactions", () => {
  test("moves every transaction and import to the chosen account, then deletes", async () => {
    const spare = await account("Joint Account 2");
    const real = await account("Joint Account");
    const batch = await prisma.importBatch.create({
      data: { userId: TEST_USER_ID, accountId: spare.id },
    });
    const a = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: spare.id,
        importBatchId: batch.id,
        date: new Date("2026-03-01"),
        amount: -4.35,
        description: "Pret",
        note: "kept",
      },
    });
    const b = await txn(spare.id);

    await deleteAccountEverywhere({
      accountId: spare.id,
      alsoLinked: false,
      moveTransactionsTo: real.id,
    });

    expect(
      await prisma.account.findUnique({ where: { id: spare.id } }),
    ).toBeNull();
    const moved = await prisma.transaction.findMany({
      where: { id: { in: [a.id, b.id] } },
    });
    expect(moved).toHaveLength(2);
    expect(moved.every((t) => t.accountId === real.id)).toBe(true);
    expect(moved.find((t) => t.id === a.id)?.note).toBe("kept");
    // The import moves with its rows, so Undo import still finds them.
    expect(
      (await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } }))
        .accountId,
    ).toBe(real.id);
  });

  test("a transfer to the deleted account now points at the account its rows moved to", async () => {
    const spare = await account("Old Savings");
    const real = await account("Savings");
    const current = await account("Current");
    const transfer = await txn(current.id, { transferAccountId: spare.id });

    await deleteAccountEverywhere({
      accountId: spare.id,
      alsoLinked: false,
      moveTransactionsTo: real.id,
    });

    expect(
      (
        await prisma.transaction.findUniqueOrThrow({
          where: { id: transfer.id },
        })
      ).transferAccountId,
    ).toBe(real.id);
  });

  test("a transfer between the two accounts stops being a transfer once they are one", async () => {
    const spare = await account("Old Savings");
    const real = await account("Savings");
    const out = await txn(spare.id, { transferAccountId: real.id });
    const back = await txn(real.id, { transferAccountId: spare.id });

    await deleteAccountEverywhere({
      accountId: spare.id,
      alsoLinked: false,
      moveTransactionsTo: real.id,
    });

    const rows = await prisma.transaction.findMany({
      where: { id: { in: [out.id, back.id] } },
    });
    expect(rows.map((t) => t.transferAccountId)).toEqual([null, null]);
  });

  test("refuses to move transactions to an account that is not yours, and changes nothing", async () => {
    const spare = await account("Spare");
    const t = await txn(spare.id);
    const stranger = await prisma.user.create({
      data: { id: "99999999-9999-9999-9999-999999999999" },
    });
    const theirs = await prisma.account.create({
      data: {
        userId: stranger.id,
        name: "Theirs",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });

    await expect(
      deleteAccountEverywhere({
        accountId: spare.id,
        alsoLinked: false,
        moveTransactionsTo: theirs.id,
      }),
    ).rejects.toThrow();

    expect(
      await prisma.account.findUnique({ where: { id: spare.id } }),
    ).not.toBeNull();
    expect(
      (await prisma.transaction.findUniqueOrThrow({ where: { id: t.id } }))
        .accountId,
    ).toBe(spare.id);
  });

  test("refuses to move transactions into the account being deleted", async () => {
    const spare = await account("Spare");
    await txn(spare.id);

    await expect(
      deleteAccountEverywhere({
        accountId: spare.id,
        alsoLinked: false,
        moveTransactionsTo: spare.id,
      }),
    ).rejects.toThrow();
    expect(
      await prisma.account.findUnique({ where: { id: spare.id } }),
    ).not.toBeNull();
  });

  test("the confirmation counts only live transactions, and the transfers that name it", async () => {
    const spare = await account("Spare");
    const current = await account("Current");
    await txn(spare.id);
    await txn(spare.id);
    await txn(spare.id, { deletedAt: new Date() });
    await txn(current.id, { transferAccountId: spare.id });

    const counts = await accountDeletionCounts({ accountId: spare.id });

    expect(counts.liveTransactions).toBe(2);
    expect(counts.incomingTransfers).toBe(1);
  });
});
