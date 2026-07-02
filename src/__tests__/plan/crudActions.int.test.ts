import {
  createPlan,
  createPlanEvent,
  createPlanExpense,
  createPlanIncome,
  deletePlanIncome,
  updatePlanEvent,
  updatePlanExpense,
  updatePlanIncome,
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

  it("createPlanIncome returns the new row id", async () => {
    await makePrimaryPlan(TEST_USER_ID);
    const id = await createPlanIncome();
    expect(typeof id).toBe("string");
    const row = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(row.label).toBe("New income");
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

  it("createPlan seeds one example New car OUTFLOW event", async () => {
    await createPlan({ dateOfBirth: "1986-06-01", retirementAge: 65 });
    const events = await prisma.planEvent.findMany({
      where: { plan: { userId: TEST_USER_ID }, deletedAt: null },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      label: "New car",
      direction: "OUTFLOW",
    });
    expect(Number(events[0]?.amount)).toBe(15000);
    expect(events[0]?.age).toBeGreaterThan(0);
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

describe("plan update actions for income/expense/event (integration)", () => {
  it("updatePlanIncome round-trips for the owner", async () => {
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
    await updatePlanIncome({
      incomeId: id,
      label: "Rent",
      kind: "RENTAL",
      annualAmount: 12000,
      startAge: 60,
      endAge: 90,
      growthKind: "FIXED",
      growthPct: 3,
      taxable: false,
    });
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.kind).toBe("RENTAL");
    expect(Number(after.annualAmount)).toBe(12000);
    expect(after.taxable).toBe(false);
    expect(Number(after.growthPct)).toBe(3);
  });

  it("rejects updating another user's income", async () => {
    const other = await prisma.user.create({
      data: { id: "88888888-8888-8888-8888-888888888888" },
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
    await expect(
      updatePlanIncome({
        incomeId: id,
        label: "hacked",
        kind: "OTHER",
        annualAmount: 0,
        startAge: null,
        endAge: null,
        growthKind: "NONE",
        growthPct: null,
        taxable: true,
      }),
    ).rejects.toThrow();
    const after = await prisma.planIncome.findUniqueOrThrow({ where: { id } });
    expect(after.label).toBe("Salary");
  });

  it("updatePlanExpense and updatePlanEvent round-trip", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 65,
        expenses: {
          create: [{ label: "Food", category: "FIXED", annualAmount: 5000 }],
        },
        events: {
          create: [
            { label: "Car", age: 70, direction: "OUTFLOW", amount: 20000 },
          ],
        },
      },
      include: { expenses: true, events: true },
    });
    await updatePlanExpense({
      expenseId: plan.expenses[0]?.id ?? "",
      label: "Groceries",
      category: "VARIABLE",
      annualAmount: 6000,
      startAge: null,
      endAge: null,
      inflationLinked: false,
    });
    await updatePlanEvent({
      eventId: plan.events[0]?.id ?? "",
      label: "New car",
      age: 72,
      direction: "OUTFLOW",
      amount: 25000,
    });
    const e = await prisma.planExpense.findUniqueOrThrow({
      where: { id: plan.expenses[0]?.id ?? "" },
    });
    const ev = await prisma.planEvent.findUniqueOrThrow({
      where: { id: plan.events[0]?.id ?? "" },
    });
    expect(e.category).toBe("VARIABLE");
    expect(e.inflationLinked).toBe(false);
    expect(ev.age).toBe(72);
    expect(Number(ev.amount)).toBe(25000);
  });
});
