const mockDeleteUser = jest.fn(async () => ({ data: {}, error: null }));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: mockDeleteUser } },
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "00000000-0000-0000-0000-0000000000aa" } },
      }),
      signOut: async () => ({ error: null }),
    },
  }),
}));

import {
  clearMyData,
  deleteMyAccount,
  exportMyData,
} from "@/app/(app)/settings/dataActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// A second user, to prove every action is scoped by userId.
const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

async function seedFinancialData(userId: string) {
  const account = await prisma.account.create({
    data: {
      userId,
      name: "Current",
      ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
    },
  });
  const category = await prisma.category.create({
    data: { userId, type: "EXPENSE", section: "VARIABLE", label: "Food" },
  });
  const period = await prisma.financialPeriod.create({
    data: {
      userId,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      label: "Mar 2026",
    },
  });
  await prisma.budgetItem.create({
    data: {
      periodId: period.id,
      type: "EXPENSE",
      section: "FIXED",
      label: "Rent",
      budget: 1000,
    },
  });
  await prisma.balanceItem.create({
    data: {
      periodId: period.id,
      accountId: account.id,
      type: "ASSET",
      category: "CURRENT",
      label: "Cash",
      value: 500,
    },
  });
  const batch = await prisma.importBatch.create({
    data: { userId, accountId: account.id, fileName: "statement.csv" },
  });
  await prisma.transaction.create({
    data: {
      userId,
      accountId: account.id,
      categoryId: category.id,
      importBatchId: batch.id,
      date: new Date("2026-03-02"),
      amount: -25.5,
      description: "Groceries",
    },
  });
  await prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date("1990-01-01"),
      retirementAge: 65,
      assets: { create: { label: "ISA", openingValue: 10_000 } },
      liabilities: { create: { label: "Mortgage", openingBalance: 100_000 } },
      incomes: { create: { label: "Salary", kind: "SALARY" } },
      expenses: { create: { label: "Living costs", annualAmount: 12_000 } },
      events: {
        create: { label: "Inheritance", age: 50, direction: "INFLOW" },
      },
    },
  });
}

describe("exportMyData (integration)", () => {
  test("includes every user-owned table, scoped to the caller", async () => {
    await seedFinancialData(TEST_USER_ID);
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    await seedFinancialData(OTHER_USER_ID);

    const dump = JSON.parse(await exportMyData());

    expect(dump.user.id).toBe(TEST_USER_ID);
    expect(dump.accounts).toHaveLength(1);
    expect(dump.categories).toHaveLength(1);
    expect(dump.periods).toHaveLength(1);
    expect(dump.budgetItems).toHaveLength(1);
    expect(dump.balanceItems).toHaveLength(1);
    expect(dump.transactions).toHaveLength(1);
    expect(dump.transactions[0].amount).toBe("-25.5");
    expect(dump.importBatches).toHaveLength(1);
    expect(dump.importBatches[0].fileName).toBe("statement.csv");
    expect(dump.plans).toHaveLength(1);
    expect(dump.plans[0].assets).toHaveLength(1);
    expect(dump.plans[0].liabilities).toHaveLength(1);
    expect(dump.plans[0].incomes).toHaveLength(1);
    expect(dump.plans[0].expenses).toHaveLength(1);
    expect(dump.plans[0].events).toHaveLength(1);
    expect(
      dump.accounts.every((a: { userId: string }) => a.userId === TEST_USER_ID),
    ).toBe(true);
  });
});

describe("clearMyData (integration)", () => {
  test("removes financial rows but keeps User, settings, and categories", async () => {
    await seedFinancialData(TEST_USER_ID);
    // seedUser() (global beforeEach) already created UserSettings for TEST_USER_ID.

    await clearMyData();

    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.financialPeriod.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.budgetItem.count({
        where: { period: { userId: TEST_USER_ID } },
      }),
    ).toBe(0);
    expect(
      await prisma.balanceItem.count({
        where: { period: { userId: TEST_USER_ID } },
      }),
    ).toBe(0);
    expect(
      await prisma.importBatch.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(await prisma.plan.count({ where: { userId: TEST_USER_ID } })).toBe(
      0,
    );
    expect(
      await prisma.planAsset.count({
        where: { plan: { userId: TEST_USER_ID } },
      }),
    ).toBe(0);

    // Kept:
    expect(
      await prisma.user.findUnique({ where: { id: TEST_USER_ID } }),
    ).not.toBeNull();
    expect(
      await prisma.userSettings.findUnique({ where: { userId: TEST_USER_ID } }),
    ).not.toBeNull();
    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });

  test("does not touch another user's data", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    await seedFinancialData(OTHER_USER_ID);

    await clearMyData();

    expect(
      await prisma.transaction.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(
      await prisma.account.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(await prisma.plan.count({ where: { userId: OTHER_USER_ID } })).toBe(
      1,
    );
  });
});

describe("deleteMyAccount (integration)", () => {
  beforeEach(() => mockDeleteUser.mockClear());

  test("hard-deletes all rows, calls auth admin deleteUser, then redirects", async () => {
    await seedFinancialData(TEST_USER_ID);

    // redirect("/") is mocked to throw `redirect:/`.
    await expect(deleteMyAccount()).rejects.toThrow("redirect:/");

    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(TEST_USER_ID);

    expect(
      await prisma.user.findUnique({ where: { id: TEST_USER_ID } }),
    ).toBeNull();
    expect(
      await prisma.userSettings.findUnique({ where: { userId: TEST_USER_ID } }),
    ).toBeNull();
    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.importBatch.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(await prisma.plan.count({ where: { userId: TEST_USER_ID } })).toBe(
      0,
    );
  });

  test("does not touch another user's rows", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    await seedFinancialData(OTHER_USER_ID);

    await expect(deleteMyAccount()).rejects.toThrow("redirect:/");

    expect(
      await prisma.user.findUnique({ where: { id: OTHER_USER_ID } }),
    ).not.toBeNull();
    expect(
      await prisma.transaction.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(
      await prisma.category.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(
      await prisma.account.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
  });
});
