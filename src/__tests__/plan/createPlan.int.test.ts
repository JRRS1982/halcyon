import { createPlan, getPrimaryPlan } from "@/app/(app)/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("createPlan (integration)", () => {
  it("seeds a primary plan from the user's latest balance + budget period", async () => {
    // Sync's source of truth is the Account/Category, not the balance sheet
    // row's label — the observation just links to the account, and the
    // account carries the wrapper the user chose in the Add drawer.
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Cash savings",
        kind: "ASSET",
        wrapper: "CASH",
      },
    });
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        section: "SALARY",
        label: "Salary",
      },
    });
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        label: "Jan 2026",
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "ASSET",
        category: "OTHER",
        label: "Cash savings",
        value: 10000,
        sortOrder: 0,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "INCOME",
        section: "SALARY",
        label: "Salary",
        budget: 3000,
        actual: 3000,
        sortOrder: 0,
      },
    });

    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });

    const plan = await getPrimaryPlan();
    expect(plan).not.toBeNull();
    expect(plan?.isPrimary).toBe(true);
    expect(plan?.assets.length).toBeGreaterThan(0);
    // The wrapper is the fact the user stated on the Account, not a guess
    // read out of the balance sheet label, and not the schema default.
    expect(plan?.assets[0]?.wrapper).toBe("CASH");
    expect(Number(plan?.assets[0]?.openingValue)).toBe(10000);
    expect(plan?.incomes.length).toBeGreaterThan(0);
    expect(Number(plan?.incomes[0]?.annualAmount)).toBe(36000);
  });

  it("does not create a second plan when a primary already exists", async () => {
    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });
    await createPlan({ dateOfBirth: "1990-01-01", retirementAge: 60 });
    const count = await prisma.plan.count({
      where: { userId: TEST_USER_ID, isPrimary: true, deletedAt: null },
    });
    expect(count).toBe(1);
  });

  it("returns only the signed-in user's plan, never another user's", async () => {
    // A different user with their own primary plan.
    const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherPlan = await prisma.plan.create({
      data: {
        userId: OTHER_USER_ID,
        dateOfBirth: new Date("1970-01-01"),
        retirementAge: 60,
        isPrimary: true,
      },
    });

    // The signed-in user (mocked session = TEST_USER_ID) creates their own.
    await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        label: "Jan 2026",
      },
    });
    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });

    // getPrimaryPlan derives identity from the session — it must never return
    // the other user's plan (regression for the getPrimaryPlan(userId) IDOR).
    const plan = await getPrimaryPlan();
    expect(plan?.userId).toBe(TEST_USER_ID);
    expect(plan?.id).not.toBe(otherPlan.id);
  });
});
