// Direct tests of applySyncPlan, bypassing syncPlan()'s own resolution step.
// syncPlan() only ever builds a SyncPlan from the calling user's own rows, so
// none of syncAction.int.test.ts's eight tests can reach a cross-tenant write
// — they prove reality.ts's read-side fences, not applySyncPlan's write-side
// ones. These tests hand applySyncPlan a SyncPlan that references another
// user's row directly, exactly as a differently-wired future caller (Task 6)
// might, to prove the write fences reject it on their own.
import { applySyncPlan } from "@/lib/plan/applySyncPlan";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

async function ownPlan() {
  return prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1985-01-01"),
      retirementAge: 60,
    },
  });
}

async function theirAsset(label: string, openingValue: number) {
  await prisma.user.upsert({
    where: { id: OTHER_USER_ID },
    create: { id: OTHER_USER_ID },
    update: {},
  });
  const theirPlan = await prisma.plan.create({
    data: {
      userId: OTHER_USER_ID,
      dateOfBirth: new Date("1980-01-01"),
      retirementAge: 65,
    },
  });
  return prisma.planAsset.create({
    data: { planId: theirPlan.id, label, openingValue },
  });
}

describe("applySyncPlan (integration, direct)", () => {
  it("rejects an update targeting another user's row", async () => {
    const plan = await ownPlan();
    const asset = await theirAsset("Their pension", 500000);

    await expect(
      applySyncPlan(
        prisma,
        plan.id,
        TEST_USER_ID,
        {
          updates: [{ id: asset.id, value: 1, label: "hijacked" }],
          removals: [],
          additions: [],
          unchanged: [],
        },
        new Map([[asset.id, "ASSET"]]),
      ),
    ).rejects.toThrow();

    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(Number(after.openingValue)).toBe(500000);
    expect(after.label).toBe("Their pension");
  });

  it("rejects a removal targeting another user's row", async () => {
    const plan = await ownPlan();
    const asset = await theirAsset("Their pension", 500000);

    await expect(
      applySyncPlan(
        prisma,
        plan.id,
        TEST_USER_ID,
        {
          updates: [],
          removals: [{ id: asset.id, label: "Their pension", reason: "gone" }],
          additions: [],
          unchanged: [],
        },
        new Map([[asset.id, "ASSET"]]),
      ),
    ).rejects.toThrow();

    expect(
      await prisma.planAsset.findUnique({ where: { id: asset.id } }),
    ).not.toBeNull();
  });

  it("rejects when planId itself does not belong to userId", async () => {
    await ownPlan();
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      create: { id: OTHER_USER_ID },
      update: {},
    });
    const theirPlan = await prisma.plan.create({
      data: {
        userId: OTHER_USER_ID,
        dateOfBirth: new Date("1980-01-01"),
        retirementAge: 65,
      },
    });

    await expect(
      applySyncPlan(
        prisma,
        theirPlan.id,
        TEST_USER_ID,
        { updates: [], removals: [], additions: [], unchanged: [] },
        new Map(),
      ),
    ).rejects.toThrow("Plan not found");
  });
});
