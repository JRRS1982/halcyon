import { updatePlanEvent } from "@/app/(app)/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function fixture() {
  const plan = await prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1986-06-01"),
      retirementAge: 65,
      isPrimary: true,
    },
  });
  const prop = await prisma.planAsset.create({
    data: {
      planId: plan.id,
      label: "Home",
      wrapper: "PROPERTY",
      openingValue: 300000,
    },
  });
  const cash = await prisma.planAsset.create({
    data: { planId: plan.id, label: "Cash", wrapper: "CASH", openingValue: 0 },
  });
  const event = await prisma.planEvent.create({
    data: { planId: plan.id, label: "E", age: 70, direction: "OUTFLOW" },
  });
  return { plan, prop, cash, event };
}
const base = (id: string) => ({
  eventId: id,
  label: "Downsize",
  age: 70,
  direction: "INFLOW" as const,
  amount: 0,
});

describe("updatePlanEvent PROPERTY_SALE", () => {
  it("persists a property-sale event linked to a PROPERTY asset", async () => {
    const { prop, event } = await fixture();
    await updatePlanEvent({
      ...base(event.id),
      kind: "PROPERTY_SALE",
      assetId: prop.id,
    });
    const row = await prisma.planEvent.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(row.kind).toBe("PROPERTY_SALE");
    expect(row.assetId).toBe(prop.id);
  });
  it("rejects a PROPERTY_SALE whose asset is not a PROPERTY", async () => {
    const { cash, event } = await fixture();
    await expect(
      updatePlanEvent({
        ...base(event.id),
        kind: "PROPERTY_SALE",
        assetId: cash.id,
      }),
    ).rejects.toThrow("Sale must reference a property");
  });
  it("rejects a PROPERTY_SALE with no asset", async () => {
    const { event } = await fixture();
    await expect(
      updatePlanEvent({
        ...base(event.id),
        kind: "PROPERTY_SALE",
        assetId: null,
      }),
    ).rejects.toThrow();
  });
});
