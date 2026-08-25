import { createPlan, getPrimaryPlan } from "@/app/(app)/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("createPlan (integration)", () => {
  it("seeds a primary plan from the user's latest balance + budget period", async () => {
    // Sync's source of truth is the Account/Category, not the balance sheet
    // row's label — the observation just links to the account. The account
    // is given a wrapper here to prove applySyncPlan.addRow does NOT copy it
    // (see the assertion below) — only value/label/link come from reality;
    // wrapper is left at its schema default on every added row.
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
        incomeCategory: "SALARY",
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
    await prisma.financialItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "INCOME",
        incomeCategory: "SALARY",
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
    // NOT the old inferWrapper guess, but also not the Account's own
    // "CASH" wrapper (set above): applySyncPlan.addRow only carries
    // link/label/value from reality onto a new row, so wrapper takes the
    // PlanAsset schema default regardless of what the account is. See the
    // report's Concerns section — this is a gap between the design doc and
    // Task 3's (frozen) implementation, not something this task can fix.
    expect(plan?.assets[0]?.wrapper).toBe("OTHER");
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
