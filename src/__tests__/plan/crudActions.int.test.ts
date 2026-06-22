import {
  createPlanEvent,
  createPlanExpense,
  createPlanIncome,
  deletePlanIncome,
} from "@/app/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function makePrimaryPlan(userId: string) {
  return prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date("1986-06-01"),
      retirementAge: 65,
      isPrimary: true,
    },
  });
}

describe("plan create/delete actions (integration)", () => {
  it("createPlanIncome inserts a default row on the owner's primary plan", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanIncome();
    const incomes = await prisma.planIncome.findMany({
      where: { plan: { userId: TEST_USER_ID } },
    });
    expect(incomes).toHaveLength(1);
    expect(incomes[0]?.label).toBe("New income");
    expect(incomes[0]?.sortOrder).toBe(0);
  });

  it("createPlanIncome appends with an incrementing sortOrder", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanIncome();
    await createPlanIncome();
    const orders = (
      await prisma.planIncome.findMany({
        where: { plan: { userId: TEST_USER_ID } },
        orderBy: { sortOrder: "asc" },
      })
    ).map((i) => i.sortOrder);
    expect(orders).toEqual([0, 1]);
  });

  it("createPlanExpense defaults category to FIXED", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanExpense();
    const e = await prisma.planExpense.findFirstOrThrow({
      where: { plan: { userId: TEST_USER_ID } },
    });
    expect(e.category).toBe("FIXED");
  });

  it("createPlanEvent defaults age to the plan's retirement age", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    await createPlanEvent();
    const ev = await prisma.planEvent.findFirstOrThrow({
      where: { plan: { userId: TEST_USER_ID } },
    });
    expect(ev.age).toBe(65);
  });

  it("create throws when the user has no primary plan", async () => {
    await expect(createPlanIncome()).rejects.toThrow();
  });

  it("deletePlanIncome soft-deletes for the owner", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        incomes: {
          create: [{ label: "Salary", kind: "SALARY", annualAmount: 1000 }],
        },
      },
      include: { incomes: true },
    });
    const id = plan.incomes[0]?.id ?? "";
    await deletePlanIncome({ id });
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.deletedAt).not.toBeNull();
  });

  it("rejects deleting another user's income (no cross-user delete)", async () => {
    const other = await prisma.user.create({
      data: { id: "99999999-9999-9999-9999-999999999999" },
    });
    const plan = await prisma.plan.create({
      data: {
        userId: other.id,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        incomes: {
          create: [{ label: "Salary", kind: "SALARY", annualAmount: 1000 }],
        },
      },
      include: { incomes: true },
    });
    const id = plan.incomes[0]?.id ?? "";
    await expect(deletePlanIncome({ id })).rejects.toThrow();
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.deletedAt).toBeNull(); // unchanged
  });
});
