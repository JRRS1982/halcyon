import { createTransaction } from "@/app/(app)/transactions/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// The quick-add path: one transaction typed straight into the ledger, no CSV.
// Ownership is enforced the same way the import path enforces it — an account
// or category the user doesn't own is a hard error, not a silent null.

describe("createTransaction (integration)", () => {
  const seedAccount = () =>
    prisma.account.create({ data: { userId: TEST_USER_ID, name: "Wallet" } });

  test("creates a categorised transaction outside any import batch", async () => {
    const account = await seedAccount();
    const category = await prisma.category.create({
      data: { userId: TEST_USER_ID, type: "EXPENSE", label: "Coffee" },
    });

    const created = await createTransaction({
      accountId: account.id,
      date: "2026-08-14",
      description: "Corner cafe",
      amount: -3.5,
      categoryId: category.id,
    });

    const row = await prisma.transaction.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.userId).toBe(TEST_USER_ID);
    expect(row.accountId).toBe(account.id);
    expect(row.categoryId).toBe(category.id);
    expect(row.importBatchId).toBeNull();
    expect(Number(row.amount)).toBe(-3.5);
    expect(row.date.toISOString()).toBe("2026-08-14T00:00:00.000Z");
    expect(row.description).toBe("Corner cafe");
  });

  test("category is optional — the row lands uncategorised for later review", async () => {
    const account = await seedAccount();
    const created = await createTransaction({
      accountId: account.id,
      date: "2026-08-14",
      description: "Cash from a mate",
      amount: 20,
      categoryId: null,
    });
    const row = await prisma.transaction.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.categoryId).toBeNull();
  });

  test("someone else's account is a hard error", async () => {
    const other = await prisma.user.create({
      data: { id: "00000000-0000-0000-0000-0000000000bb" },
    });
    const foreign = await prisma.account.create({
      data: { userId: other.id, name: "Not yours" },
    });

    await expect(
      createTransaction({
        accountId: foreign.id,
        date: "2026-08-14",
        description: "Nope",
        amount: -1,
        categoryId: null,
      }),
    ).rejects.toThrow(/account not found/i);
  });

  test("a deleted or foreign category is a hard error", async () => {
    const account = await seedAccount();
    const dead = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        label: "Gone",
        deletedAt: new Date(),
      },
    });

    await expect(
      createTransaction({
        accountId: account.id,
        date: "2026-08-14",
        description: "Nope",
        amount: -1,
        categoryId: dead.id,
      }),
    ).rejects.toThrow(/category not found/i);
  });

  test("a zero amount is rejected", async () => {
    const account = await seedAccount();
    await expect(
      createTransaction({
        accountId: account.id,
        date: "2026-08-14",
        description: "Nothing happened",
        amount: 0,
        categoryId: null,
      }),
    ).rejects.toThrow();
  });
});
