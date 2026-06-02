import { exportMyData } from "@/app/settings/dataActions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// A second user, to prove every action is scoped by userId.
const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

async function seedFinancialData(userId: string) {
  const account = await prisma.account.create({
    data: { userId, name: "Current" },
  });
  const category = await prisma.category.create({
    data: { userId, type: "EXPENSE", category: "VARIABLE", label: "Food" },
  });
  const period = await prisma.financialPeriod.create({
    data: {
      userId,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      label: "Mar 2026",
    },
  });
  await prisma.financialItem.create({
    data: { periodId: period.id, type: "EXPENSE", label: "Rent", budget: 1000 },
  });
  await prisma.balanceItem.create({
    data: {
      periodId: period.id,
      type: "ASSET",
      category: "CURRENT",
      label: "Cash",
      value: 500,
    },
  });
  await prisma.transaction.create({
    data: {
      userId,
      accountId: account.id,
      categoryId: category.id,
      date: new Date("2026-03-02"),
      amount: -25.5,
      description: "Groceries",
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
    expect(dump.financialItems).toHaveLength(1);
    expect(dump.balanceItems).toHaveLength(1);
    expect(dump.transactions).toHaveLength(1);
    expect(dump.transactions[0].amount).toBe("-25.5");
    expect(
      dump.accounts.every((a: { userId: string }) => a.userId === TEST_USER_ID),
    ).toBe(true);
  });
});
