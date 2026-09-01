import type { ReactElement } from "react";
import DashboardPage from "@/app/(app)/dashboard/page";
import { buildAccountData } from "@/lib/accounts/creation";
import type { CashFlowPoint } from "@/lib/dashboard/series";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// A REPAYMENT row is spending: the budget sheet files it under Expenses and
// `surplus` subtracts it. The dashboard used to drop it from the cash-flow
// chart, so a user who converted their mortgage from an EXPENSE category row
// to a REPAYMENT row saw their charted expenditure halve and their savings
// rate jump, with nothing about their finances changed.
//
// Two exclusions had to be lifted for that, and only one of them is
// `monthFlow`: in transactions mode the row's *actual* is netted by account,
// a source this page did not read at all, so a repayment charted zero however
// monthFlow classified it. The transactions-mode test below is the one that
// would still fail if only the pure function were fixed.

const MONTH = new Date();
const monthStart = new Date(
  Date.UTC(MONTH.getUTCFullYear(), MONTH.getUTCMonth(), 1),
);
const monthEnd = new Date(
  Date.UTC(MONTH.getUTCFullYear(), MONTH.getUTCMonth() + 1, 0),
);
const midMonth = new Date(
  Date.UTC(MONTH.getUTCFullYear(), MONTH.getUTCMonth(), 10),
);

async function seedPeriod() {
  return prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      granularity: "MONTH",
      startDate: monthStart,
      endDate: monthEnd,
      label: "This month",
    },
  });
}

async function cashFlow(): Promise<CashFlowPoint[]> {
  const element = (await DashboardPage()) as ReactElement<{
    cashFlowData: CashFlowPoint[];
  }>;
  return element.props.cashFlowData;
}

describe("dashboard cash flow counts repayments (integration)", () => {
  test("manual mode: the stored actual of a REPAYMENT row is expenditure", async () => {
    await prisma.userSettings.update({
      where: { userId: TEST_USER_ID },
      data: { transactionsEnabled: false },
    });
    const period = await seedPeriod();

    await prisma.budgetItem.createMany({
      data: [
        {
          periodId: period.id,
          type: "INCOME",
          section: "SALARY",
          label: "Salary",
          budget: 4000,
          actual: 4000,
        },
        {
          periodId: period.id,
          type: "EXPENSE",
          section: "FIXED",
          label: "Everything else",
          budget: 1250,
          actual: 1250,
        },
        {
          periodId: period.id,
          type: "REPAYMENT",
          label: "Mortgage",
          budget: 1250,
          actual: 1250,
        },
      ],
    });

    const [point] = await cashFlow();
    expect(point?.income).toBe(4000);
    expect(point?.expense).toBe(2500);
    expect(point?.savingsRatePct).toBe(37.5);
  });

  test("transactions mode: a repayment's actual comes from its account's transfer flow", async () => {
    const period = await seedPeriod();

    const salary = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        label: "Salary",
        type: "INCOME",
        section: "SALARY",
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
    const current = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
        canImportTransactions: true,
      },
    });
    const mortgage = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
      },
    });

    await prisma.budgetItem.createMany({
      data: [
        {
          periodId: period.id,
          categoryId: salary.id,
          type: "INCOME",
          section: "SALARY",
          label: "Salary",
          budget: 4000,
          // Dead data in transactions mode — the overlay must win. A stored
          // figure that happened to match would prove nothing.
          actual: 0,
        },
        {
          periodId: period.id,
          categoryId: groceries.id,
          type: "EXPENSE",
          section: "VARIABLE",
          label: "Groceries",
          budget: 1250,
          actual: 0,
        },
        {
          periodId: period.id,
          accountId: mortgage.id,
          type: "REPAYMENT",
          label: "Mortgage",
          budget: 1250,
          actual: 0,
        },
      ],
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          categoryId: salary.id,
          date: midMonth,
          amount: 4000,
          description: "Pay",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          categoryId: groceries.id,
          date: midMonth,
          amount: -1250,
          description: "Sainsbury's",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: mortgage.id,
          date: midMonth,
          amount: -1250,
          description: "Mortgage payment",
        },
      ],
    });

    const [point] = await cashFlow();
    expect(point?.income).toBe(4000);
    expect(point?.expense).toBe(2500);
    expect(point?.savingsRatePct).toBe(37.5);
  });

  test("transactions mode: a TRANSFER to an asset is neither income nor expense", async () => {
    const period = await seedPeriod();

    const current = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
        canImportTransactions: true,
      },
    });
    const pension = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Pension",
        ...buildAccountData({ type: "SIPP" }),
      },
    });
    const salary = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        label: "Salary",
        type: "INCOME",
        section: "SALARY",
      },
    });

    await prisma.budgetItem.createMany({
      data: [
        {
          periodId: period.id,
          categoryId: salary.id,
          type: "INCOME",
          section: "SALARY",
          label: "Salary",
          budget: 4000,
          actual: 0,
        },
        {
          periodId: period.id,
          accountId: pension.id,
          type: "TRANSFER",
          direction: "INFLOW",
          label: "Pension",
          budget: 500,
          actual: 0,
        },
      ],
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          categoryId: salary.id,
          date: midMonth,
          amount: 4000,
          description: "Pay",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: pension.id,
          date: midMonth,
          amount: -500,
          description: "To pension",
        },
      ],
    });

    const [point] = await cashFlow();
    expect(point?.income).toBe(4000);
    expect(point?.expense).toBe(0);
  });
});
