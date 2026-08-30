import {
  bulkDeleteTransactions,
  bulkSetTransactionCategory,
  bulkSetTransactionTransfer,
} from "@/app/(app)/transactions/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

// Seeds an account + three transactions for the signed-in user, plus one
// transaction owned by somebody else (to prove ownership scoping).
const seed = async () => {
  const account = await prisma.account.create({
    data: { userId: TEST_USER_ID, name: "Cur" },
  });
  const cat = await prisma.category.create({
    data: {
      userId: TEST_USER_ID,
      type: "EXPENSE",
      section: "VARIABLE",
      label: "Food",
    },
  });

  const mine = await Promise.all(
    ["Tesco", "Shell", "Greggs"].map((description, i) =>
      prisma.transaction.create({
        data: {
          userId: TEST_USER_ID,
          accountId: account.id,
          date: new Date(`2026-03-0${i + 1}`),
          amount: -5,
          description,
        },
      }),
    ),
  );

  await prisma.user.create({ data: { id: OTHER_USER_ID } });
  const otherAccount = await prisma.account.create({
    data: { userId: OTHER_USER_ID, name: "Other" },
  });
  const theirs = await prisma.transaction.create({
    data: {
      userId: OTHER_USER_ID,
      accountId: otherAccount.id,
      date: new Date("2026-03-01"),
      amount: -7,
      description: "Not mine",
    },
  });

  return { account, cat, mine, theirs };
};

describe("bulkSetTransactionCategory (integration)", () => {
  test("assigns the category to every selected row and clears transfers", async () => {
    const { cat, mine } = await seed();

    const res = await bulkSetTransactionCategory({
      transactionIds: mine.map((t) => t.id),
      categoryId: cat.id,
    });

    expect(res.updated).toBe(3);
    const rows = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(rows.every((t) => t.categoryId === cat.id)).toBe(true);
    expect(rows.every((t) => t.transferAccountId === null)).toBe(true);
  });

  test("null categoryId clears categories in bulk", async () => {
    const { cat, mine } = await seed();
    await bulkSetTransactionCategory({
      transactionIds: mine.map((t) => t.id),
      categoryId: cat.id,
    });

    const res = await bulkSetTransactionCategory({
      transactionIds: mine.map((t) => t.id),
      categoryId: null,
    });

    expect(res.updated).toBe(3);
    const rows = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(rows.every((t) => t.categoryId === null)).toBe(true);
  });

  test("skips transactions owned by another user", async () => {
    const { cat, theirs } = await seed();

    const res = await bulkSetTransactionCategory({
      transactionIds: [theirs.id],
      categoryId: cat.id,
    });

    expect(res.updated).toBe(0);
    const row = await prisma.transaction.findUnique({
      where: { id: theirs.id },
    });
    expect(row?.categoryId).toBeNull();
  });

  test("rejects a category belonging to another user", async () => {
    const { mine } = await seed();
    const foreignCat = await prisma.category.create({
      data: {
        userId: OTHER_USER_ID,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "Their cat",
      },
    });

    await expect(
      bulkSetTransactionCategory({
        transactionIds: mine.map((t) => t.id),
        categoryId: foreignCat.id,
      }),
    ).rejects.toThrow("Category not found");
  });
});

describe("bulkSetTransactionTransfer (integration)", () => {
  test("tags every selected row as a transfer and clears categories", async () => {
    const { cat, mine } = await seed();
    await bulkSetTransactionCategory({
      transactionIds: mine.map((t) => t.id),
      categoryId: cat.id,
    });
    const counterparty = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Savings" },
    });

    const res = await bulkSetTransactionTransfer({
      transactionIds: mine.map((t) => t.id),
      accountId: counterparty.id,
    });

    expect(res.updated).toBe(3);
    const rows = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(rows.every((t) => t.transferAccountId === counterparty.id)).toBe(
      true,
    );
    expect(rows.every((t) => t.categoryId === null)).toBe(true);
  });

  test("skips rows that belong to the target account (self-transfer)", async () => {
    const { account, mine } = await seed();

    const res = await bulkSetTransactionTransfer({
      transactionIds: mine.map((t) => t.id),
      accountId: account.id,
    });

    expect(res.updated).toBe(0);
    const rows = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(rows.every((t) => t.transferAccountId === null)).toBe(true);
  });

  test("skips transactions owned by another user", async () => {
    const { theirs } = await seed();
    const counterparty = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Savings" },
    });

    const res = await bulkSetTransactionTransfer({
      transactionIds: [theirs.id],
      accountId: counterparty.id,
    });

    expect(res.updated).toBe(0);
    const row = await prisma.transaction.findUnique({
      where: { id: theirs.id },
    });
    expect(row?.transferAccountId).toBeNull();
  });

  test("rejects an account belonging to another user", async () => {
    const { mine } = await seed();
    const foreignAccount = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Theirs" },
    });

    await expect(
      bulkSetTransactionTransfer({
        transactionIds: mine.map((t) => t.id),
        accountId: foreignAccount.id,
      }),
    ).rejects.toThrow("Account not found");
  });
});

describe("bulkDeleteTransactions (integration)", () => {
  test("soft-deletes selected rows only", async () => {
    const { mine } = await seed();
    const [first, second] = mine;
    if (!first || !second) throw new Error("Expected two seeded transactions");

    const res = await bulkDeleteTransactions({
      transactionIds: [first.id, second.id],
    });

    expect(res.deleted).toBe(2);
    const deleted = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID, deletedAt: { not: null } },
    });
    expect(deleted.map((t) => t.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    const live = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID, deletedAt: null },
    });
    expect(live).toHaveLength(1);
  });

  test("cannot delete another user's transactions", async () => {
    const { theirs } = await seed();

    const res = await bulkDeleteTransactions({ transactionIds: [theirs.id] });

    expect(res.deleted).toBe(0);
    const row = await prisma.transaction.findUnique({
      where: { id: theirs.id },
    });
    expect(row?.deletedAt).toBeNull();
  });

  test("already-deleted rows don't count twice", async () => {
    const { mine } = await seed();
    const ids = mine.map((t) => t.id);
    await bulkDeleteTransactions({ transactionIds: ids });

    const res = await bulkDeleteTransactions({ transactionIds: ids });

    expect(res.deleted).toBe(0);
  });
});
