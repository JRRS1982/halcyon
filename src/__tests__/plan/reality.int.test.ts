import { latestReality } from "@/lib/plan/reality";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

async function monthPeriod(userId: string, label: string, start: string) {
  return prisma.financialPeriod.create({
    data: {
      userId,
      granularity: "MONTH",
      startDate: new Date(start),
      endDate: new Date(start),
      label,
    },
  });
}

describe("latestReality (integration)", () => {
  it("resolves a category's latest monthly budget × 12, tagged by ItemType", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        incomeCategory: "SALARY",
        label: "Salary",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.financialItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "INCOME",
        incomeCategory: "SALARY",
        label: "Salary",
        budget: 3000,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toContainEqual({
      linkId: category.id,
      kind: "INCOME",
      label: "Salary",
      value: 36000,
    });
  });

  it("skips a category with no budget row", async () => {
    await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });

  it("ignores a YEAR period's budget when computing the ×12 monthly figure", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
      },
    });
    const yearPeriod = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "YEAR",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        label: "2026",
      },
    });
    await prisma.financialItem.create({
      data: {
        periodId: yearPeriod.id,
        categoryId: category.id,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
        budget: 24000, // a full-year figure, not a monthly one
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    // No MONTH period exists for this category, so the YEAR-period row must
    // be skipped entirely rather than misread as a monthly budget.
    expect(rows).toEqual([]);
  });

  it("breaks a tie between two rows in the same period by createdAt", async () => {
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Current account", kind: "ASSET" },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Current account",
        value: 100,
        createdAt: new Date("2026-03-01T09:00:00Z"),
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Current account",
        value: 200,
        createdAt: new Date("2026-03-01T10:00:00Z"),
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toContainEqual({
      linkId: account.id,
      kind: "ASSET",
      label: "Current account",
      value: 200,
    });
  });

  // Isolates the account-level userId fence: this foreign account's only
  // observation sits under a period this user owns, so the period-level fence
  // (below) would not catch it on its own — only the account query's own
  // `userId` filter does.
  it("never surfaces another user's account, even when its balance item sits under this user's own period", async () => {
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      create: { id: OTHER_USER_ID },
      update: {},
    });
    const foreign = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Their ISA", kind: "ASSET" },
    });
    const ownPeriod = await monthPeriod(
      TEST_USER_ID,
      "March 2026",
      "2026-03-01",
    );
    await prisma.balanceItem.create({
      data: {
        periodId: ownPeriod.id,
        accountId: foreign.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Their ISA",
        value: 999999,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });

  // Isolates the period-level userId fence: this account belongs to the
  // querying user, so the account query's own filter (above) would not catch
  // this on its own — only the balance item's `period: { userId }` filter
  // does.
  it("never surfaces this user's own account through a balance item under another user's period", async () => {
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      create: { id: OTHER_USER_ID },
      update: {},
    });
    const own = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    const theirPeriod = await monthPeriod(
      OTHER_USER_ID,
      "March 2026",
      "2026-03-01",
    );
    await prisma.balanceItem.create({
      data: {
        periodId: theirPeriod.id,
        accountId: own.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: 999999,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });
});
