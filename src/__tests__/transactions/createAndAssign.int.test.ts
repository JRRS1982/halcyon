import {
  createAccountAndTransfer,
  createAndAssignCategory,
} from "@/app/(app)/transactions/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// Creating a category (or account) and applying it to a transaction used to be
// two sequential actions with an optimistic UI update between them, so a user
// who navigated in the gap had the second request cancelled: the category
// existed, the transaction was never categorised, and the screen had already
// said otherwise. These are now single actions, and single transactions — which
// is what these tests pin down, since the atomicity is invisible from the UI.

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

const seedTransaction = async () => {
  const account = await prisma.account.create({
    data: { userId: TEST_USER_ID, name: "Current" },
  });
  const transaction = await prisma.transaction.create({
    data: {
      userId: TEST_USER_ID,
      accountId: account.id,
      date: new Date("2026-03-05"),
      amount: -7.5,
      description: "Coffee",
    },
  });
  return { account, transaction };
};

describe("createAndAssignCategory (integration)", () => {
  test("creates the category and assigns it in one call", async () => {
    const { transaction } = await seedTransaction();

    const created = await createAndAssignCategory({
      transactionIds: [transaction.id],
      label: "Coffee shops",
      type: "EXPENSE",
      section: "VARIABLE",
    });

    expect(created.label).toBe("Coffee shops");

    const row = await prisma.transaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });
    expect(row.categoryId).toBe(created.id);
  });

  test("clears any transfer, since the two are mutually exclusive", async () => {
    const { transaction } = await seedTransaction();
    const counterparty = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Savings" },
    });
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { transferAccountId: counterparty.id },
    });

    await createAndAssignCategory({
      transactionIds: [transaction.id],
      label: "Coffee shops",
      type: "EXPENSE",
      section: "VARIABLE",
    });

    const row = await prisma.transaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });
    expect(row.transferAccountId).toBeNull();
  });

  // The point of the merge: a failed assignment must not leave a category
  // behind. Two actions could not promise this — the first had already
  // committed by the time the second failed.
  test("rolls the category back when the transaction isn't the user's", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirAccount = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Theirs" },
    });
    const theirs = await prisma.transaction.create({
      data: {
        userId: OTHER_USER_ID,
        accountId: theirAccount.id,
        date: new Date("2026-03-05"),
        amount: -7.5,
        description: "Not mine",
      },
    });

    await expect(
      createAndAssignCategory({
        transactionIds: [theirs.id],
        label: "Sneaky",
        type: "EXPENSE",
        section: "VARIABLE",
      }),
    ).rejects.toThrow(/Transaction not found/);

    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    const untouched = await prisma.transaction.findUniqueOrThrow({
      where: { id: theirs.id },
    });
    expect(untouched.categoryId).toBeNull();
  });
});

describe("createAccountAndTransfer (integration)", () => {
  test("creates the account and tags the transfer in one call", async () => {
    const { transaction } = await seedTransaction();

    const created = await createAccountAndTransfer({
      transactionIds: [transaction.id],
      name: "Savings",
    });

    expect(created.name).toBe("Savings");
    // No kind is set on creation, so it defaults to NONE — the ledger picker
    // still offers it as a Transfers target (not Repayments); see
    // CategoryCombobox's kind split.
    expect(created.kind).toBe("NONE");

    const row = await prisma.transaction.findUniqueOrThrow({
      where: { id: transaction.id },
    });
    expect(row.transferAccountId).toBe(created.id);
    expect(row.categoryId).toBeNull();
  });

  test("rolls the account back when the transaction isn't the user's", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirAccount = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Theirs" },
    });
    const theirs = await prisma.transaction.create({
      data: {
        userId: OTHER_USER_ID,
        accountId: theirAccount.id,
        date: new Date("2026-03-05"),
        amount: -7.5,
        description: "Not mine",
      },
    });

    await expect(
      createAccountAndTransfer({ transactionIds: [theirs.id], name: "Sneaky" }),
    ).rejects.toThrow(/Transaction not found/);

    expect(
      await prisma.account.count({
        where: { userId: TEST_USER_ID, name: "Sneaky" },
      }),
    ).toBe(0);
  });
});
