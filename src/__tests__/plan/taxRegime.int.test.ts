import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("Plan.taxRegime / Plan.thresholdsInflationLinked", () => {
  it("a plan stores its regime and threshold assumption", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 67,
        isPrimary: true,
        taxRegime: "SCOTLAND",
      },
    });

    expect(plan.taxRegime).toBe("SCOTLAND");
    expect(plan.thresholdsInflationLinked).toBe(true); // the default
  });

  it("defaults taxRegime to RUK", async () => {
    const plan = await prisma.plan.create({
      data: {
        userId: TEST_USER_ID,
        dateOfBirth: new Date("1986-06-01"),
        retirementAge: 67,
        isPrimary: true,
      },
    });

    expect(plan.taxRegime).toBe("RUK");
  });
});
