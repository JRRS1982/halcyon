import { createPlan, getPrimaryPlan } from "@/app/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("createPlan (integration)", () => {
  it("seeds a primary plan from the user's latest balance + budget period", async () => {
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
        type: "INCOME",
        incomeCategory: "SALARY",
        label: "Salary",
        budget: 3000,
        actual: 3000,
        sortOrder: 0,
      },
    });

    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });

    const plan = await getPrimaryPlan(TEST_USER_ID);
    expect(plan).not.toBeNull();
    expect(plan?.isPrimary).toBe(true);
    expect(plan?.assets.length).toBeGreaterThan(0);
    // "Cash savings" infers the CASH wrapper (label keyword beats the bucket).
    expect(plan?.assets[0]?.wrapper).toBe("CASH");
    expect(plan?.incomes.length).toBeGreaterThan(0);
  });

  it("does not create a second plan when a primary already exists", async () => {
    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });
    await createPlan({ dateOfBirth: "1990-01-01", retirementAge: 60 });
    const count = await prisma.plan.count({
      where: { userId: TEST_USER_ID, isPrimary: true, deletedAt: null },
    });
    expect(count).toBe(1);
  });
});
