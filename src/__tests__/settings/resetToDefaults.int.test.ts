import { resetToDefaults } from "@/app/(app)/settings/dataActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// "Reset to defaults" is the only destructive action that puts something back.
// The half that matters is the seed: clearing is easy to get right, and a
// reset that leaves the user staring at an empty app has not reset anything.
describe("resetToDefaults (integration)", () => {
  it("clears the user's own data and lays the starter data back down", async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2020-01-31"),
        label: "An old month",
      },
    });
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "FIXED",
        label: "Something the user made",
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "FIXED",
        label: "Something the user made",
        budget: 1200,
      },
    });
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "An account they added",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });

    await resetToDefaults();

    // Past months go too: "from all history" is the point, and a stale 2020
    // sheet would otherwise outlive the reset.
    expect(
      await prisma.financialPeriod.count({
        where: { userId: TEST_USER_ID, label: "An old month" },
      }),
    ).toBe(0);
    expect(
      await prisma.account.count({
        where: { userId: TEST_USER_ID, name: "An account they added" },
      }),
    ).toBe(0);
    expect(
      await prisma.category.count({
        where: { userId: TEST_USER_ID, label: "Something the user made" },
      }),
    ).toBe(0);

    // And the starter data is back — categories, accounts and a budget sheet
    // for the current month, which is what a new account begins with.
    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBeGreaterThan(0);
    expect(
      await prisma.budgetItem.count({
        where: { period: { userId: TEST_USER_ID } },
      }),
    ).toBeGreaterThan(0);
  });

  // Seeding on top of the old categories would leave two of each — the reason
  // this path deletes Category where clearMyData deliberately keeps it.
  it("does not leave duplicate starter categories", async () => {
    await resetToDefaults();
    const before = await prisma.category.count({
      where: { userId: TEST_USER_ID },
    });

    await resetToDefaults();

    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(before);
  });
});
