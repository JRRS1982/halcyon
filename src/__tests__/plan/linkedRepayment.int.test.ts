import {
  deletePlanExpense,
  deletePlanLiability,
  linkRepaymentExpense,
  unlinkRepaymentExpense,
} from "@/app/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function makePlanWithMortgage() {
  const plan = await prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1986-06-01"),
      retirementAge: 65,
      isPrimary: true,
      liabilities: {
        create: [
          {
            label: "Mortgage",
            openingBalance: 200000,
            interestPct: 4,
            monthlyRepayment: 1200,
          },
        ],
      },
    },
    include: { liabilities: true },
  });
  const liability = plan.liabilities[0];
  if (!liability) throw new Error("fixture liability missing");
  return { plan, liability };
}

describe("linked repayment expense actions (integration)", () => {
  it("linkRepaymentExpense creates a linked expense seeded from monthlyRepayment", async () => {
    const { liability } = await makePlanWithMortgage();
    const id = await linkRepaymentExpense({ liabilityId: liability.id });
    const expense = await prisma.planExpense.findUniqueOrThrow({
      where: { id },
    });
    expect(expense.label).toBe("Mortgage repayment");
    expect(Number(expense.annualAmount)).toBe(14400);
    expect(expense.liabilityId).toBe(liability.id);
    expect(expense.inflationLinked).toBe(false);
    expect(expense.category).toBeNull();
  });

  it("linkRepaymentExpense is idempotent (returns the existing link)", async () => {
    const { liability } = await makePlanWithMortgage();
    const first = await linkRepaymentExpense({ liabilityId: liability.id });
    const second = await linkRepaymentExpense({ liabilityId: liability.id });
    expect(second).toBe(first);
  });

  it("unlinkRepaymentExpense clears the link and copies the amount back", async () => {
    const { liability } = await makePlanWithMortgage();
    const id = await linkRepaymentExpense({ liabilityId: liability.id });
    await prisma.planExpense.update({
      where: { id },
      data: { annualAmount: 18000 },
    });
    await unlinkRepaymentExpense({ id });
    const expense = await prisma.planExpense.findUniqueOrThrow({
      where: { id },
    });
    const liab = await prisma.planLiability.findUniqueOrThrow({
      where: { id: liability.id },
    });
    expect(expense.liabilityId).toBeNull();
    expect(Number(liab.monthlyRepayment)).toBe(1500);
  });

  it("deletePlanLiability soft-deletes the linked expense too", async () => {
    const { liability } = await makePlanWithMortgage();
    const id = await linkRepaymentExpense({ liabilityId: liability.id });
    await deletePlanLiability({ id: liability.id });
    const expense = await prisma.planExpense.findUniqueOrThrow({
      where: { id },
    });
    expect(expense.deletedAt).not.toBeNull();
  });

  it("deletePlanExpense rejects a linked expense", async () => {
    const { liability } = await makePlanWithMortgage();
    const id = await linkRepaymentExpense({ liabilityId: liability.id });
    await expect(deletePlanExpense({ id })).rejects.toThrow(/managed by/);
    const expense = await prisma.planExpense.findUniqueOrThrow({
      where: { id },
    });
    expect(expense.deletedAt).toBeNull();
  });
});
