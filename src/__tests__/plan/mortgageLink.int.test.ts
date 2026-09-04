import { updatePlanLiability } from "@/app/(app)/plan/actions";
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
  const property = await prisma.planAsset.create({
    data: {
      planId: plan.id,
      label: "Home",
      wrapper: "PROPERTY",
      openingValue: 300000,
    },
  });
  const cash = await prisma.planAsset.create({
    data: {
      planId: plan.id,
      label: "Savings",
      wrapper: "CASH",
      openingValue: 1000,
    },
  });
  const liability = await prisma.planLiability.create({
    data: {
      planId: plan.id,
      label: "Mortgage",
      openingBalance: 200000,
      interestPct: 4,
      monthlyRepayment: 1200,
    },
  });
  return { plan, property, cash, liability };
}

const base = (id: string) => ({
  liabilityId: id,
  label: "Mortgage",
  openingBalance: 200000,
  interestPct: 4,
  monthlyRepayment: 1200,
  startAge: null,
  endAge: null,
  interestOnly: false,
  revisionAge: null,
  revisionRate: null,
});

describe("updatePlanLiability linkedAssetId", () => {
  it("links to a PROPERTY asset and round-trips", async () => {
    const { property, liability } = await fixture();
    await updatePlanLiability({
      ...base(liability.id),
      linkedAssetId: property.id,
    });
    const row = await prisma.planLiability.findUniqueOrThrow({
      where: { id: liability.id },
    });
    expect(row.linkedAssetId).toBe(property.id);
  });

  it("rejects linking to a non-PROPERTY asset", async () => {
    const { cash, liability } = await fixture();
    await expect(
      updatePlanLiability({ ...base(liability.id), linkedAssetId: cash.id }),
    ).rejects.toThrow("Linked asset must be a property");
  });

  it("allows clearing the link with null", async () => {
    const { property, liability } = await fixture();
    await updatePlanLiability({
      ...base(liability.id),
      linkedAssetId: property.id,
    });
    await updatePlanLiability({ ...base(liability.id), linkedAssetId: null });
    const row = await prisma.planLiability.findUniqueOrThrow({
      where: { id: liability.id },
    });
    expect(row.linkedAssetId).toBeNull();
  });
});
