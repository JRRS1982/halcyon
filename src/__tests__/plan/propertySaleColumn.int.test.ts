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

describe("PlanEvent.kind + assetId", () => {
  it("defaults kind to MANUAL with null assetId, and supports PROPERTY_SALE linked to an asset with SetNull on delete", async () => {
    const plan = await makePrimaryPlan();
    const def = await prisma.planEvent.create({
      data: { planId: plan.id, label: "E", age: 60, direction: "OUTFLOW" },
    });
    expect(def.kind).toBe("MANUAL");
    expect(def.assetId).toBeNull();

    const prop = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Home",
        wrapper: "PROPERTY",
        openingValue: 300000,
      },
    });
    const sale = await prisma.planEvent.create({
      data: {
        planId: plan.id,
        label: "Downsize",
        age: 70,
        direction: "INFLOW",
        kind: "PROPERTY_SALE",
        assetId: prop.id,
      },
    });
    expect(sale.kind).toBe("PROPERTY_SALE");

    await prisma.planAsset.delete({ where: { id: prop.id } });
    const after = await prisma.planEvent.findUniqueOrThrow({
      where: { id: sale.id },
    });
    expect(after.assetId).toBeNull();
  });
});
