import { TEST_USER_ID } from "@test/support/helpers";
import {
  createPlanEvent,
  createPlanExpense,
  createPlanIncome,
} from "@/app/(app)/plan/actions";
import { MAX_PLAN_ROWS_PER_KIND } from "@/lib/plan/limits";
import { prisma } from "@/lib/prisma";

// createPlanIncome, createPlanExpense and createPlanEvent take no arguments at
// all, so before the ceiling a signed-in account could loop any of them and
// grow the shared Plan* tables without limit. Worse than the other caps,
// because the projection is O(rows x years to death age) — a bloated plan
// makes that user's own /plan page run a multi-million-cell calculation.
async function makePrimaryPlan() {
  return prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1986-06-01"),
      retirementAge: 65,
      isPrimary: true,
    },
  });
}

const fillIncomes = (planId: string, count: number) =>
  prisma.planIncome.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      planId,
      label: `Income ${i}`,
      kind: "OTHER" as const,
      annualAmount: 0,
      growthKind: "INFLATION" as const,
      taxable: true,
      sortOrder: i,
    })),
  });

describe("plan row ceilings (integration)", () => {
  it("creates rows while the plan is under the ceiling", async () => {
    await makePrimaryPlan();
    await expect(createPlanIncome()).resolves.toEqual(expect.any(String));
    await expect(createPlanExpense()).resolves.toEqual(expect.any(String));
    await expect(createPlanEvent()).resolves.toEqual(expect.any(String));
  });

  it("refuses to add an income past the ceiling", async () => {
    const plan = await makePrimaryPlan();
    await fillIncomes(plan.id, MAX_PLAN_ROWS_PER_KIND);

    await expect(createPlanIncome()).rejects.toThrow(/maximum of \d+ income/i);

    expect(await prisma.planIncome.count({ where: { planId: plan.id } })).toBe(
      MAX_PLAN_ROWS_PER_KIND,
    );
  });

  // The ceiling is per kind, not per plan: filling incomes must not stop
  // someone adding the expense they actually came to add.
  it("counts each kind separately", async () => {
    const plan = await makePrimaryPlan();
    await fillIncomes(plan.id, MAX_PLAN_ROWS_PER_KIND);

    await expect(createPlanExpense()).resolves.toEqual(expect.any(String));
  });

  // Soft-deleted rows are excluded, so deleting one makes room again rather
  // than leaving the plan permanently wedged at the ceiling.
  it("lets a deleted row free up space", async () => {
    const plan = await makePrimaryPlan();
    await fillIncomes(plan.id, MAX_PLAN_ROWS_PER_KIND);
    await prisma.planIncome.update({
      where: { id: (await prisma.planIncome.findFirstOrThrow()).id },
      data: { deletedAt: new Date() },
    });

    await expect(createPlanIncome()).resolves.toEqual(expect.any(String));
  });
});
