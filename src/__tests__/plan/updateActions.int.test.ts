import {
  updatePlanAsset,
  updatePlanAssumptions,
  updatePlanLiability,
} from "@/app/plan/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

function defined<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Expected ${label} to be defined`);
  return value;
}

async function makePlan(userId: string) {
  return prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date("1986-06-01"),
      retirementAge: 65,
      assets: {
        create: [
          {
            label: "Pot",
            wrapper: "OTHER",
            openingValue: 1000,
            drawdownPriority: 0,
          },
        ],
      },
      liabilities: { create: [{ label: "Loan", openingBalance: 500 }] },
    },
    include: { assets: true, liabilities: true },
  });
}

describe("plan update actions (integration)", () => {
  it("updatePlanAssumptions persists changes for the owner", async () => {
    const plan = await makePlan(TEST_USER_ID);
    await updatePlanAssumptions({
      planId: plan.id,
      dateOfBirth: "1990-01-01",
      retirementAge: 60,
      planToAge: 100,
      inflationPct: 3,
      defaultReturnPct: 6,
      returnSpreadPct: 3,
      blendedTaxRatePct: 25,
      statePensionAge: 68,
      statePensionAnnual: 12000,
    });
    const after = await prisma.plan.findUniqueOrThrow({
      where: { id: plan.id },
    });
    expect(after.retirementAge).toBe(60);
    expect(after.planToAge).toBe(100);
    expect(Number(after.defaultReturnPct)).toBe(6);
    expect(Number(after.returnSpreadPct)).toBe(3);
  });

  it("updatePlanAsset sets the wrapper + return for the owner", async () => {
    const plan = await makePlan(TEST_USER_ID);
    const assetId = defined(plan.assets[0], "assets[0]").id;
    await updatePlanAsset({
      assetId,
      label: "SIPP",
      wrapper: "PENSION",
      openingValue: 2000,
      expectedReturnPct: 5,
      feePct: 0.5,
      annualContribution: 100,
      contributionEndAge: null,
      minAccessAge: 57,
      drawdownPriority: 3,
    });
    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: assetId },
    });
    expect(after.wrapper).toBe("PENSION");
    expect(Number(after.openingValue)).toBe(2000);
    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { id: assetId },
    });
    expect(Number(asset.feePct)).toBe(0.5);
    expect(asset.minAccessAge).toBe(57);
  });

  it("updatePlanLiability updates rates for the owner", async () => {
    const plan = await makePlan(TEST_USER_ID);
    const liabilityId = defined(plan.liabilities[0], "liabilities[0]").id;
    await updatePlanLiability({
      liabilityId,
      label: "Mortgage",
      openingBalance: 100000,
      interestPct: 4,
      monthlyRepayment: 1000,
      endAge: 60,
    });
    const after = await prisma.planLiability.findUniqueOrThrow({
      where: { id: liabilityId },
    });
    expect(Number(after.interestPct)).toBe(4);
  });

  it("rejects updating another user's asset (no cross-user write)", async () => {
    // Plan owned by a DIFFERENT user; the mocked auth user is TEST_USER_ID.
    const otherUser = await prisma.user.create({
      data: { id: "99999999-9999-9999-9999-999999999999" },
    });
    const plan = await makePlan(otherUser.id);
    const assetId = defined(plan.assets[0], "assets[0]").id;
    await expect(
      updatePlanAsset({
        assetId,
        label: "hacked",
        wrapper: "CASH",
        openingValue: 1,
        expectedReturnPct: null,
        feePct: 0,
        annualContribution: 0,
        contributionEndAge: null,
        minAccessAge: null,
        drawdownPriority: 0,
      }),
    ).rejects.toThrow();
    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: assetId },
    });
    expect(after.label).toBe("Pot"); // unchanged
  });
});
