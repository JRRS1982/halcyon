import { TEST_USER_ID } from "@test/support/helpers";
import {
  setCategoryApproval,
  setTransactionCategory,
} from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

// Rows an import pencilled in: a category from memory, not yet ticked.
const seedSuggestions = async () => {
  const account = await prisma.account.create({
    data: {
      userId: TEST_USER_ID,
      name: "Current",
      ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
    },
  });
  const groceries = await prisma.category.create({
    data: {
      userId: TEST_USER_ID,
      type: "EXPENSE",
      section: "VARIABLE",
      label: "Groceries",
    },
  });
  const suggested = await Promise.all(
    ["TESCO 1", "TESCO 2"].map((description) =>
      prisma.transaction.create({
        data: {
          userId: TEST_USER_ID,
          accountId: account.id,
          date: new Date("2026-03-01"),
          amount: -10,
          description,
          categoryId: groceries.id,
          isCategoryConfirmed: false,
        },
      }),
    ),
  );
  return { account, groceries, suggested };
};

// "Approve" and "Approve all" on the ledger. If they misfire, a user's checked
// rows keep asking to be checked, or someone else's rows change.
describe("setCategoryApproval (integration)", () => {
  test("approves only the rows it is given", async () => {
    const { suggested } = await seedSuggestions();
    const [first, second] = suggested;
    if (!first || !second) throw new Error("seed failed");

    const res = await setCategoryApproval({
      transactionIds: [first.id],
      approved: true,
    });

    expect(res.updated).toBe(1);
    const rows = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { description: "asc" },
      select: { isCategoryConfirmed: true },
    });
    expect(rows.map((r) => r.isCategoryConfirmed)).toEqual([true, false]);
  });

  test("with no ids, approves every suggestion the user has and no one else's", async () => {
    await seedSuggestions();
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirAccount = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: "Theirs",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const theirCategory = await prisma.category.create({
      data: {
        userId: OTHER_USER_ID,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "Food",
      },
    });
    const theirs = await prisma.transaction.create({
      data: {
        userId: OTHER_USER_ID,
        accountId: theirAccount.id,
        date: new Date("2026-03-01"),
        amount: -1,
        description: "THEIRS",
        categoryId: theirCategory.id,
        isCategoryConfirmed: false,
      },
    });

    const res = await setCategoryApproval({ approved: true });

    expect(res.updated).toBe(2);
    const after = await prisma.transaction.findUnique({
      where: { id: theirs.id },
    });
    expect(after?.isCategoryConfirmed).toBe(false);
  });

  test("choosing a category yourself confirms it", async () => {
    const { suggested, groceries } = await seedSuggestions();
    const [first] = suggested;
    if (!first) throw new Error("seed failed");

    await setTransactionCategory({
      transactionId: first.id,
      categoryId: groceries.id,
    });

    const after = await prisma.transaction.findUnique({
      where: { id: first.id },
    });
    expect(after?.isCategoryConfirmed).toBe(true);
  });

  // Approval has to be undoable: a mis-click must not lock a wrong category in.
  test("withdrawing approval puts the row back in pencil", async () => {
    const { suggested } = await seedSuggestions();
    const [first] = suggested;
    if (!first) throw new Error("seed failed");
    await setCategoryApproval({ transactionIds: [first.id], approved: true });

    const res = await setCategoryApproval({
      transactionIds: [first.id],
      approved: false,
    });

    expect(res.updated).toBe(1);
    const after = await prisma.transaction.findUnique({
      where: { id: first.id },
    });
    expect(after?.isCategoryConfirmed).toBe(false);
  });

  test("refuses to withdraw approval from every row at once", async () => {
    await expect(setCategoryApproval({ approved: false })).rejects.toThrow();
  });
});
