import { buildAccountData } from "@/lib/accounts/creation";
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
      data: {
        userId: TEST_USER_ID,
        name: "Cur",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
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

describe("ledger filters (integration)", () => {
  // Two accounts, two categories, a transfer, and both signs of amount — the
  // combinations the drawer's filters have to tell apart against real SQL.
  const seedMixed = async () => {
    const [current, savings] = await Promise.all([
      prisma.account.create({
        data: {
          userId: TEST_USER_ID,
          name: "Current",
          ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
        },
      }),
      prisma.account.create({
        data: {
          userId: TEST_USER_ID,
          name: "Savings",
          ...buildAccountData({ type: "SAVINGS" }),
        },
      }),
    ]);
    const [food, salary] = await Promise.all([
      prisma.category.create({
        data: {
          userId: TEST_USER_ID,
          type: "EXPENSE",
          section: "VARIABLE",
          label: "Food",
        },
      }),
      prisma.category.create({
        data: {
          userId: TEST_USER_ID,
          type: "INCOME",
          section: "SALARY",
          label: "Salary",
        },
      }),
    ]);

    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          categoryId: food.id,
          date: new Date("2026-01-01"),
          amount: -40,
          description: "Jan food",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          categoryId: salary.id,
          date: new Date("2026-02-15"),
          amount: 40,
          description: "Feb pay",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          categoryId: food.id,
          date: new Date("2026-03-31"),
          amount: -400,
          description: "Mar food",
        },
        {
          userId: TEST_USER_ID,
          accountId: savings.id,
          transferAccountId: current.id,
          date: new Date("2026-02-01"),
          amount: 200,
          description: "Feb sweep",
        },
      ],
    });
    return { current, savings, food };
  };

  test("a date range includes rows sitting exactly on both bounds", async () => {
    await seedMixed();
    const page = await getTransactionsPage(TEST_USER_ID, {
      from: "2026-01-01",
      to: "2026-03-31",
    });
    expect(page.total).toBe(4);

    const narrowed = await getTransactionsPage(TEST_USER_ID, {
      from: "2026-02-01",
      to: "2026-02-15",
    });
    expect(narrowed.items.map((t) => t.description).sort()).toEqual([
      "Feb pay",
      "Feb sweep",
    ]);
  });

  test("an account filter returns only that account's rows", async () => {
    const { savings } = await seedMixed();
    const page = await getTransactionsPage(TEST_USER_ID, {
      accountId: savings.id,
    });
    expect(page.items.map((t) => t.description)).toEqual(["Feb sweep"]);
  });

  test("a category filter returns only that category's rows", async () => {
    const { food } = await seedMixed();
    const page = await getTransactionsPage(TEST_USER_ID, {
      category: { kind: "category", categoryId: food.id },
    });
    expect(page.items.map((t) => t.description).sort()).toEqual([
      "Jan food",
      "Mar food",
    ]);
  });

  test("the transfers filter returns only rows with a counterparty", async () => {
    await seedMixed();
    const page = await getTransactionsPage(TEST_USER_ID, {
      category: { kind: "transfers" },
    });
    expect(page.items.map((t) => t.description)).toEqual(["Feb sweep"]);
  });

  test("an amount range matches magnitude, so it catches both signs", async () => {
    await seedMixed();
    // -40 and +40 are both "£40"; -400 and +200 are outside the range.
    const page = await getTransactionsPage(TEST_USER_ID, {
      amountMin: 30,
      amountMax: 50,
    });
    expect(page.items.map((t) => t.description).sort()).toEqual([
      "Feb pay",
      "Jan food",
    ]);
  });

  test("a lower bound alone keeps the large rows of either sign", async () => {
    await seedMixed();
    const page = await getTransactionsPage(TEST_USER_ID, { amountMin: 100 });
    expect(page.items.map((t) => t.description).sort()).toEqual([
      "Feb sweep",
      "Mar food",
    ]);
  });

  test("an upper bound alone keeps the small rows of either sign", async () => {
    await seedMixed();
    const page = await getTransactionsPage(TEST_USER_ID, { amountMax: 100 });
    expect(page.items.map((t) => t.description).sort()).toEqual([
      "Feb pay",
      "Jan food",
    ]);
  });

  test("the total counts filtered rows, not the whole ledger", async () => {
    const { current, food } = await seedMixed();
    const page = await getTransactionsPage(TEST_USER_ID, {
      accountId: current.id,
      category: { kind: "category", categoryId: food.id },
      from: "2026-03-01",
    });
    expect(page.total).toBe(1);
    expect(page.items.map((t) => t.description)).toEqual(["Mar food"]);
  });
});
