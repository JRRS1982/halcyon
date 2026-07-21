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

describe("PlanLiability.linkedAsset relation", () => {
  it("resolves the linked property via the relation and nulls it on asset delete", async () => {
    const plan = await makePrimaryPlan();
    const property = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 300000,
      },
    });
    const mortgage = await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "Mortgage",
        openingBalance: 200000,
        linkedAssetId: property.id,
      },
    });

    const withAsset = await prisma.planLiability.findUniqueOrThrow({
      where: { id: mortgage.id },
      include: { linkedAsset: true },
    });
    expect(withAsset.linkedAsset?.id).toBe(property.id);

    await prisma.planAsset.delete({ where: { id: property.id } });
    const after = await prisma.planLiability.findUniqueOrThrow({
      where: { id: mortgage.id },
    });
    expect(after.linkedAssetId).toBeNull();
  });
});
