import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function seedPlan() {
  return prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1985-01-01"),
      retirementAge: 60,
    },
  });
}

describe("plan row links (integration)", () => {
  it("links an asset to an account and a nulls it when the account goes", async () => {
    const plan = await seedPlan();
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    const asset = await prisma.planAsset.create({
      data: { planId: plan.id, label: "Vanguard ISA", accountId: account.id },
    });

    expect(asset.accountId).toBe(account.id);

    // SetNull, not Cascade: the row must survive so Sync can remove it
    // explicitly rather than it vanishing mid-projection.
    await prisma.account.delete({ where: { id: account.id } });
    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(after.accountId).toBeNull();
  });

  it("links a liability to an account", async () => {
    const plan = await seedPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
      },
    });
    const liability = await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "Halifax mortgage",
        accountId: account.id,
      },
    });
    expect(liability.accountId).toBe(account.id);
  });

  it("links incomes and expenses to a category", async () => {
    const plan = await seedPlan();
    const category = await prisma.category.create({
      data: { userId: TEST_USER_ID, type: "INCOME", label: "Salary" },
    });
    const income = await prisma.planIncome.create({
      data: {
        planId: plan.id,
        label: "Salary",
        kind: "SALARY",
        categoryId: category.id,
      },
    });
    const expense = await prisma.planExpense.create({
      data: { planId: plan.id, label: "Food", categoryId: category.id },
    });

    expect(income.categoryId).toBe(category.id);
    expect(expense.categoryId).toBe(category.id);
  });

  it("allows a plan-only row with no link", async () => {
    const plan = await seedPlan();
    const asset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Buy-to-let at 50",
        openingValue: 250000,
      },
    });
    expect(asset.accountId).toBeNull();
  });
});
