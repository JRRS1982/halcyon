import { TEST_USER_ID } from "@test/support/helpers";
import { z } from "zod";
import { createTransaction } from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

// The quick-add path: one transaction typed straight into the ledger, no CSV.
// Ownership is enforced the same way the import path enforces it — an account
// or category the user doesn't own is a hard error, not a silent null.

describe("createTransaction (integration)", () => {
  const seedAccount = () =>
    prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Wallet",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });

  test("creates a categorised transaction outside any import batch", async () => {
    const account = await seedAccount();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "Coffee",
      },
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
      data: {
        userId: other.id,
        name: "Not yours",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
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
        section: "VARIABLE",
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

  // The date field only checked its shape, so "2026-02-30" parsed, became
  // 2 March on the way to the database, and the user's row sat under a date
  // they never typed with nothing to say so.
  test("refuses a date the calendar does not have", async () => {
    const account = await seedAccount();

    await expect(
      createTransaction({
        accountId: account.id,
        date: "2026-02-30",
        description: "Corner cafe",
        amount: -3.5,
        categoryId: null,
      }),
    ).rejects.toBeInstanceOf(z.ZodError);

    expect(await prisma.transaction.count()).toBe(0);
  });

  // The other half of the same hole: an impossible month makes new Date()
  // return Invalid Date, which used to reach Prisma and surface as a 500
  // rather than as the validation error it is.
  test("refuses an impossible month without reaching the database", async () => {
    const account = await seedAccount();

    await expect(
      createTransaction({
        accountId: account.id,
        date: "2026-13-01",
        description: "Corner cafe",
        amount: -3.5,
        categoryId: null,
      }),
    ).rejects.toBeInstanceOf(z.ZodError);

    expect(await prisma.transaction.count()).toBe(0);
  });
});
