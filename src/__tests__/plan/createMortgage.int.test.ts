import {
  createMortgageForProperty,
  createPlanAsset,
  deletePlanLiability,
} from "@/app/(app)/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

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

describe("property + mortgage create actions", () => {
  it("createPlanProperty makes a PROPERTY asset and returns its id", async () => {
    await makePrimaryPlan();
    const id = await createPlanAsset({
      label: "New property",
      wrapper: "PROPERTY",
      openingValue: 0,
    });
    const asset = await prisma.planAsset.findUniqueOrThrow({ where: { id } });
    expect(asset.wrapper).toBe("PROPERTY");
    expect(asset.label).toBe("New property");
  });

  it("createMortgageForProperty links a liability + repayment expense to the property", async () => {
    await makePrimaryPlan();
    const assetId = await createPlanAsset({
      label: "New property",
      wrapper: "PROPERTY",
      openingValue: 0,
    });
    const liabilityId = await createMortgageForProperty({ assetId });

    const liability = await prisma.planLiability.findUniqueOrThrow({
      where: { id: liabilityId },
    });
    expect(liability.linkedAssetId).toBe(assetId);

    const expense = await prisma.planExpense.findFirstOrThrow({
      where: { liabilityId },
    });
    expect(expense.label).toBe("Mortgage repayment");
    expect(expense.category).toBeNull();
    expect(expense.inflationLinked).toBe(false);
  });

  it("createMortgageForProperty rejects a non-PROPERTY asset", async () => {
    const plan = await makePrimaryPlan();
    const cash = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Savings",
        wrapper: "CASH",
        openingValue: 0,
      },
    });
    await expect(
      createMortgageForProperty({ assetId: cash.id }),
    ).rejects.toThrow("Property not found");
  });

  it("createMortgage makes property + mortgage + repayment and returns the property id", async () => {
    await makePrimaryPlan();
    const assetId = await createPlanAsset({
      label: "New property",
      wrapper: "PROPERTY",
      openingValue: 0,
      mortgage: { mode: "NEW", label: "Mortgage" },
    });
    const asset = await prisma.planAsset.findUniqueOrThrow({
      where: { id: assetId },
    });
    expect(asset.wrapper).toBe("PROPERTY");
    const liability = await prisma.planLiability.findFirstOrThrow({
      where: { linkedAssetId: assetId },
    });
    const expense = await prisma.planExpense.findFirstOrThrow({
      where: { liabilityId: liability.id },
    });
    expect(expense.label).toBe("Mortgage repayment");
  });

  it("allows adding a new mortgage after the previous one is removed", async () => {
    await makePrimaryPlan();
    const assetId = await createPlanAsset({
      label: "New property",
      wrapper: "PROPERTY",
      openingValue: 0,
    });
    const first = await createMortgageForProperty({ assetId });
    await deletePlanLiability({ id: first });
    // Must not throw on the unique index — the soft-deleted row's linkedAssetId is now null.
    const second = await createMortgageForProperty({ assetId });
    expect(second).not.toBe(first);
    const active = await prisma.planLiability.findMany({
      where: { linkedAssetId: assetId, deletedAt: null },
    });
    expect(active).toHaveLength(1);
  });
});
