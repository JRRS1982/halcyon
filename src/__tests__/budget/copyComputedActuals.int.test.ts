import { copyPeriodFrom, createItemForMonth } from "@/app/(app)/budget/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// A copy returns its new rows so the sheet can adopt them without a refetch.
// In transactions mode the stored `actual` column is dead data, so the copy
// computes each row's actual the way the budget page's overlay does — and for
// a long while it only did the category half. An account-keyed row has no
// categoryId, so a real £1,250 mortgage flow already recorded in the target
// month came back as £0.00: the row read zero, the Expenses actual read
// £1,250 low and "Left over" £1,250 high, until the user navigated away and
// back.

const SOURCE = { year: 2026, month: 2 };
const TARGET = { year: 2026, month: 3 };

// A day inside the target month, which is where the flow being adopted lives.
const IN_TARGET = new Date("2026-04-10");

describe("copyPeriodFrom computed actuals (integration)", () => {
  test("an account-keyed row adopts the target month's transfer flow", async () => {
    const current = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
      },
    });
    const isa = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        ...buildAccountData({ type: "STOCKS_ISA" }),
      },
    });

    const { periodId: sourcePeriodId } = await createItemForMonth({
      ...SOURCE,
      type: "REPAYMENT",
      label: "Mortgage",
      accountId: mortgage.id,
    });
    await createItemForMonth({
      ...SOURCE,
      type: "TRANSFER",
      label: "ISA saving",
      accountId: isa.id,
      direction: "INFLOW",
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: mortgage.id,
          date: IN_TARGET,
          amount: -1250,
          description: "Mortgage payment",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: isa.id,
          date: IN_TARGET,
          amount: -300,
          description: "To ISA",
        },
      ],
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    const byLabel = new Map(result.items.map((i) => [i.label, i.actual]));
    expect(byLabel.get("Mortgage")).toBe(1250);
    expect(byLabel.get("ISA saving")).toBe(300);
  });

  test("a category-keyed row still adopts its own transactions", async () => {
    const current = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const groceries = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        label: "Groceries",
        type: "EXPENSE",
        section: "VARIABLE",
      },
    });

    // createItemForMonth takes no categoryId — a row is linked to a Category
    // elsewhere — so the source row is written directly.
    const source = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
        label: "March 2026",
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: source.id,
        categoryId: groceries.id,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "Groceries",
        budget: 400,
      },
    });
    const sourcePeriodId = source.id;

    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: current.id,
        categoryId: groceries.id,
        date: IN_TARGET,
        amount: -420,
        description: "Sainsbury's",
      },
    });

    const result = await copyPeriodFrom({
      sourcePeriodId,
      targetYear: TARGET.year,
      targetMonth: TARGET.month,
    });

    expect(result.items[0]?.actual).toBe(420);
  });
});
