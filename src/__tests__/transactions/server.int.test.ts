import { prisma } from "@/lib/prisma";
import {
  countUncategorized,
  getOrProvisionCategories,
  getTransactionsPage,
} from "@/lib/transactions/server";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const makePeriod = () =>
  prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      granularity: "MONTH",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      label: "Mar 2026",
    },
  });

const expenseItem = (periodId: string, label: string) =>
  prisma.budgetItem.create({
    data: { periodId, type: "EXPENSE", section: "VARIABLE", label, budget: 0 },
  });

describe("getOrProvisionCategories (integration)", () => {
  test("backfills categories from budget labels, deduped, and links items", async () => {
    const period = await makePeriod();
    await expenseItem(period.id, "Groceries");
    await expenseItem(period.id, "groceries "); // case/space variant → same
    await expenseItem(period.id, "Rent");

    const cats = await getOrProvisionCategories(TEST_USER_ID);

    expect(cats.map((c) => c.label).sort()).toEqual(["Groceries", "Rent"]);
    const items = await prisma.budgetItem.findMany({
      where: { period: { userId: TEST_USER_ID } },
      select: { categoryId: true },
    });
    expect(items.every((i) => i.categoryId !== null)).toBe(true);
  });

  test("is idempotent — a second call creates nothing new", async () => {
    const period = await makePeriod();
    await expenseItem(period.id, "Rent");
    const first = await getOrProvisionCategories(TEST_USER_ID);
    const second = await getOrProvisionCategories(TEST_USER_ID);
    expect(second).toHaveLength(first.length);
    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(first.length);
  });
});

describe("ledger queries (integration)", () => {
  const seedTxns = async () => {
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
    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: account.id,
          categoryId: cat.id,
          date: new Date("2026-03-03"),
          amount: -5,
          description: "Tesco",
        },
        {
          userId: TEST_USER_ID,
          accountId: account.id,
          categoryId: null,
          date: new Date("2026-03-02"),
          amount: -9,
          description: "Shell garage",
        },
        {
          userId: TEST_USER_ID,
          accountId: account.id,
          categoryId: null,
          date: new Date("2026-03-01"),
          amount: -3,
          description: "Greggs",
        },
      ],
    });
  };

  test("returns newest-first and counts uncategorized", async () => {
    await seedTxns();
    const page = await getTransactionsPage(TEST_USER_ID);
    expect(page.items.map((t) => t.description)).toEqual([
      "Tesco",
      "Shell garage",
      "Greggs",
    ]);
    expect(page.total).toBe(3);
    expect(await countUncategorized(TEST_USER_ID)).toBe(2);
  });

  test("filters by search and by uncategorized", async () => {
    await seedTxns();
    const search = await getTransactionsPage(TEST_USER_ID, { search: "shell" });
    expect(search.items.map((t) => t.description)).toEqual(["Shell garage"]);

    const uncategorized = await getTransactionsPage(TEST_USER_ID, {
      onlyUncategorized: true,
    });
    expect(uncategorized.items).toHaveLength(2);
  });

  test("sorts by amount ascending", async () => {
    await seedTxns();
    const page = await getTransactionsPage(TEST_USER_ID, {
      sortColumn: "amount",
      sortDir: "asc",
    });
    expect(page.items.map((t) => t.amount)).toEqual([-9, -5, -3]);
  });
});
