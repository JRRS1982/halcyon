import { updatePlanLiability } from "@/app/plan/actions";
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
  const liability = await prisma.planLiability.create({
    data: {
      planId: plan.id,
      label: "Mortgage",
      openingBalance: 200000,
      interestPct: 4,
      monthlyRepayment: 1200,
    },
  });
  return { plan, liability };
}

const base = (id: string) => ({
  liabilityId: id,
  label: "M",
  openingBalance: 1000,
  interestPct: 4,
  monthlyRepayment: 100,
  startAge: null,
  endAge: null,
  linkedAssetId: null,
  interestOnly: false,
});

describe("updatePlanLiability interestOnly", () => {
  it("persists interestOnly", async () => {
    const { liability } = await fixture();
    await updatePlanLiability({ ...base(liability.id), interestOnly: true });
    const row = await prisma.planLiability.findUniqueOrThrow({
      where: { id: liability.id },
    });
    expect(row.interestOnly).toBe(true);
  });
});
