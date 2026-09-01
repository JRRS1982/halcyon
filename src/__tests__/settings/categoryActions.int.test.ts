import { mergeCategories } from "@/app/(app)/settings/categoryActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const makeCategory = (label: string) =>
  prisma.category.create({
    data: {
      userId: TEST_USER_ID,
      type: "EXPENSE",
      section: "VARIABLE",
      label,
    },
  });

const makePeriod = (startDate: Date) =>
  prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      granularity: "MONTH",
      startDate,
      endDate: startDate,
      label: "Period",
    },
  });

const makeItem = (periodId: string, categoryId: string, budget: number) =>
  prisma.budgetItem.create({
    data: {
      periodId,
      categoryId,
      type: "EXPENSE",
      section: "VARIABLE",
      label: "x",
      budget,
    },
  });

describe("mergeCategories (integration)", () => {
  test("repoints transactions, combines same-period budgets, retires source", async () => {
    const survivor = await makeCategory("Groceries");
    const source = await makeCategory("Grocries");
    const period = await makePeriod(new Date("2026-03-01"));
    await makeItem(period.id, survivor.id, 100);
    const srcItem = await makeItem(period.id, source.id, 40);

    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const tx = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: account.id,
        categoryId: source.id,
        date: new Date("2026-03-05"),
        amount: -25,
        description: "Tesco",
      },
    });

    await mergeCategories({ sourceId: source.id, survivorId: survivor.id });

    const movedTx = await prisma.transaction.findUnique({
      where: { id: tx.id },
    });
    expect(movedTx?.categoryId).toBe(survivor.id);

    const survivorItem = await prisma.budgetItem.findFirst({
      where: { categoryId: survivor.id, periodId: period.id, deletedAt: null },
    });
    expect(Number(survivorItem?.budget)).toBe(140);

    const removedItem = await prisma.budgetItem.findUnique({
      where: { id: srcItem.id },
    });
    expect(removedItem?.deletedAt).not.toBeNull();

    const removedCategory = await prisma.category.findUnique({
      where: { id: source.id },
    });
    expect(removedCategory?.deletedAt).not.toBeNull();
  });

  test("repoints budget rows in periods the survivor has no row in", async () => {
    const survivor = await makeCategory("Groceries");
    const source = await makeCategory("Grocries");
    const period = await makePeriod(new Date("2026-04-01"));
    const srcItem = await makeItem(period.id, source.id, 30);

    await mergeCategories({ sourceId: source.id, survivorId: survivor.id });

    const moved = await prisma.budgetItem.findUnique({
      where: { id: srcItem.id },
    });
    expect(moved?.categoryId).toBe(survivor.id);
    expect(moved?.deletedAt).toBeNull();
  });
});
