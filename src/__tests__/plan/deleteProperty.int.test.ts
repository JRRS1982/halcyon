import { createMortgage, deletePlanAsset } from "@/app/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function makePrimaryPlan() {
  return prisma.plan.create({
    data: { userId: TEST_USER_ID, dateOfBirth: new Date("1986-06-01"), retirementAge: 65, isPrimary: true },
  });
}

describe("deletePlanAsset cascade to mortgage", () => {
  it("soft-deletes the linked mortgage and its repayment expense", async () => {
    await makePrimaryPlan();
    const assetId = await createMortgage();
    const liability = await prisma.planLiability.findFirstOrThrow({ where: { linkedAssetId: assetId } });
    const expense = await prisma.planExpense.findFirstOrThrow({ where: { liabilityId: liability.id } });

    await deletePlanAsset({ id: assetId });

    const asset = await prisma.planAsset.findUniqueOrThrow({ where: { id: assetId } });
    const liab = await prisma.planLiability.findUniqueOrThrow({ where: { id: liability.id } });
    const exp = await prisma.planExpense.findUniqueOrThrow({ where: { id: expense.id } });
    expect(asset.deletedAt).not.toBeNull();
    expect(liab.deletedAt).not.toBeNull();
    expect(liab.linkedAssetId).toBeNull();
    expect(exp.deletedAt).not.toBeNull();
  });

  it("leaves a non-property asset delete unchanged", async () => {
    const plan = await makePrimaryPlan();
    const cash = await prisma.planAsset.create({
      data: { planId: plan.id, label: "Savings", wrapper: "CASH", openingValue: 0 },
    });
    await deletePlanAsset({ id: cash.id });
    const row = await prisma.planAsset.findUniqueOrThrow({ where: { id: cash.id } });
    expect(row.deletedAt).not.toBeNull();
  });
});
