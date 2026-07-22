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

describe("PlanLiability.interestOnly", () => {
  it("defaults to false and can be set true", async () => {
    const plan = await makePrimaryPlan();
    const def = await prisma.planLiability.create({
      data: { planId: plan.id, label: "L", openingBalance: 1 },
    });
    expect(def.interestOnly).toBe(false);
    const io = await prisma.planLiability.create({
      data: {
        planId: plan.id,
        label: "IO",
        openingBalance: 1,
        interestOnly: true,
      },
    });
    expect(io.interestOnly).toBe(true);
  });
});
