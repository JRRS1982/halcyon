import { TEST_USER_ID } from "@test/support/helpers";
import type { ReactElement } from "react";
import { getActualBreakdown } from "@/app/(app)/budget/actions";
import TransactionsPage from "@/app/(app)/transactions/page";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

// The popover on a budget Actual lists the transactions behind it, and its
// "Open in ledger" link shows the same rows. If either drifts from the figure,
// a user checking their month is shown transactions that don't add up to it.

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";
const MARCH = new Date("2026-03-01");

const account = (name: string, type: "CURRENT_ACCOUNT" | "SAVINGS") =>
  prisma.account.create({
    data: { userId: TEST_USER_ID, name, ...buildAccountData({ type }) },
  });

const period = (userId = TEST_USER_ID) =>
  prisma.financialPeriod.create({
    data: {
      userId,
      granularity: "MONTH",
      startDate: MARCH,
      endDate: new Date("2026-03-31"),
      label: "March 2026",
    },
  });

async function seedGroceries() {
  const current = await account("Current", "CURRENT_ACCOUNT");
  const groceries = await prisma.category.create({
    data: {
      userId: TEST_USER_ID,
      label: "Groceries",
      type: "EXPENSE",
      section: "VARIABLE",
    },
  });
  const p = await period();
  const item = await prisma.budgetItem.create({
    data: {
      periodId: p.id,
      categoryId: groceries.id,
      type: "EXPENSE",
      section: "VARIABLE",
      label: "Groceries",
      budget: 400,
    },
  });
  const base = { userId: TEST_USER_ID, accountId: current.id };
  await prisma.transaction.createMany({
    data: [
      {
        ...base,
        categoryId: groceries.id,
        date: new Date("2026-03-02"),
        amount: -64.2,
        description: "TESCO",
      },
      {
        ...base,
        categoryId: groceries.id,
        isCategoryConfirmed: false,
        date: new Date("2026-03-06"),
        amount: -38.75,
        description: "SAINSBURYS",
      },
      // Outside the month, and in another category: neither counts.
      {
        ...base,
        categoryId: groceries.id,
        date: new Date("2026-04-01"),
        amount: -10,
        description: "APRIL",
      },
      {
        ...base,
        date: new Date("2026-03-03"),
        amount: -5,
        description: "UNCATEGORISED",
      },
    ],
  });
  return { groceries, item };
}

async function seedSavings() {
  const current = await account("Current", "CURRENT_ACCOUNT");
  const monzo = await account("Monzo", "CURRENT_ACCOUNT");
  const savings = await account("Savings", "SAVINGS");
  const p = await period();
  const item = await prisma.budgetItem.create({
    data: {
      periodId: p.id,
      accountId: savings.id,
      type: "TRANSFER",
      direction: "INFLOW",
      label: "Savings",
      budget: 500,
    },
  });
  await prisma.transaction.createMany({
    data: [
      // Both sides of one movement: only the savings side counts.
      {
        userId: TEST_USER_ID,
        accountId: savings.id,
        transferAccountId: current.id,
        date: new Date("2026-03-03"),
        amount: 200,
        description: "From Current",
      },
      {
        userId: TEST_USER_ID,
        accountId: current.id,
        transferAccountId: savings.id,
        date: new Date("2026-03-03"),
        amount: -200,
        description: "To Savings",
      },
      // Recorded only on Monzo's side.
      {
        userId: TEST_USER_ID,
        accountId: monzo.id,
        transferAccountId: savings.id,
        date: new Date("2026-03-24"),
        amount: -50,
        description: "Pot to Savings",
      },
    ],
  });
  return { savings, item };
}

describe("getActualBreakdown (integration)", () => {
  test("a category row lists its month's transactions and sums to its Actual", async () => {
    const { groceries, item } = await seedGroceries();

    const breakdown = await getActualBreakdown({ itemId: item.id });

    expect(breakdown.actual).toBe(102.95);
    expect(
      breakdown.lines.map((l) => [l.description, l.amount, l.isPencilled]),
    ).toEqual([
      ["TESCO", -64.2, false],
      ["SAINSBURYS", -38.75, true],
    ]);
    expect(breakdown.lines[0]?.accountName).toBe("Current");
    expect(breakdown.ledgerHref).toBe(
      `/transactions?cat=${groceries.id}&from=2026-03-01&to=2026-03-31`,
    );
  });

  test("a transfer row counts one side per pair and labels the other side", async () => {
    const { savings, item } = await seedSavings();

    const breakdown = await getActualBreakdown({ itemId: item.id });

    expect(breakdown.actual).toBe(250);
    expect(
      breakdown.lines.map((l) => [l.description, l.amount, l.recordedOn]),
    ).toEqual([
      ["From Current", 200, null],
      ["Pot to Savings", 50, "Monzo"],
    ]);
    expect(breakdown.ledgerHref).toBe(
      `/transactions?counted=${savings.id}%3A2026-03`,
    );
  });

  test("refuses another user's row, and reads nothing of theirs", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirs = await period(OTHER_USER_ID);
    const item = await prisma.budgetItem.create({
      data: {
        periodId: theirs.id,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "Theirs",
      },
    });

    await expect(getActualBreakdown({ itemId: item.id })).rejects.toThrow(
      /^Item not found$/,
    );
  });

  test("refuses when transactions mode is off: the Actual is typed, not counted", async () => {
    const { item } = await seedGroceries();
    await prisma.userSettings.update({
      where: { userId: TEST_USER_ID },
      data: { transactionsEnabled: false },
    });

    await expect(getActualBreakdown({ itemId: item.id })).rejects.toThrow(
      /transactions/i,
    );
  });
});

describe("the ledger's counted filter (integration)", () => {
  const ledgerRows = async (
    searchParams: Record<string, string>,
  ): Promise<string[]> => {
    const element = (await TransactionsPage({
      searchParams: Promise.resolve(searchParams),
    })) as ReactElement<{ page: { items: { description: string }[] } }>;
    return element.props.page.items.map((t) => t.description).sort();
  };

  test("Open in ledger shows exactly the rows the popover lists", async () => {
    const { item } = await seedSavings();
    const breakdown = await getActualBreakdown({ itemId: item.id });
    const params = Object.fromEntries(
      new URL(breakdown.ledgerHref ?? "", "http://x").searchParams,
    );

    expect(await ledgerRows(params)).toEqual(
      breakdown.lines.map((l) => l.description).sort(),
    );
  });

  test("another user's account matches nothing", async () => {
    await seedSavings();
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirs = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: "Theirs",
        ...buildAccountData({ type: "SAVINGS" }),
      },
    });

    expect(await ledgerRows({ counted: `${theirs.id}:2026-03` })).toEqual([]);
  });
});
