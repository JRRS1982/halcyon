import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// zod refuses an income section on an expense at every action; this pins
// that the database refuses it too, so a future write path that skips zod
// cannot put SALARY on an expense category.
describe("Category_section_matches_type", () => {
  it("rejects an income section on an EXPENSE category at the database", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "Category" ("id","userId","type","section","label","updatedAt")
         VALUES (gen_random_uuid(), $1::uuid, 'EXPENSE', 'SALARY', 'Wrong', now())`,
        TEST_USER_ID,
      ),
    ).rejects.toThrow(/Category_section_matches_type/);
  });

  it("rejects a section on a TRANSFER budget row", async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
        label: "March 2026",
      },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "BudgetItem" ("id","periodId","type","section","label","updatedAt")
         VALUES (gen_random_uuid(), $1::uuid, 'TRANSFER', 'FIXED', 'Wrong', now())`,
        period.id,
      ),
    ).rejects.toThrow(/BudgetItem_section_matches_type/);
  });

  it("rejects a NULL section on an INCOME budget row", async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-30"),
        label: "April 2026",
      },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "BudgetItem" ("id","periodId","type","label","updatedAt")
         VALUES (gen_random_uuid(), $1::uuid, 'INCOME', 'Wrong', now())`,
        period.id,
      ),
    ).rejects.toThrow(/BudgetItem_section_matches_type/);
  });

  it("rejects an income section on a PlanExpense", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1985-01-01"),
        retirementAge: 60,
      },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "PlanExpense" ("id","planId","label","section","updatedAt")
         VALUES (gen_random_uuid(), $1::uuid, 'Wrong', 'PENSIONS', now())`,
        plan.id,
      ),
    ).rejects.toThrow(/PlanExpense_section_is_expense/);
  });
});
