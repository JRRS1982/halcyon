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
          updates: [
            {
              id: asset.id,
              value: 1,
              label: "hijacked",
              wrapper: null,
              flow: 0,
            },
          ],
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
          removals: [
            {
              id: asset.id,
              label: "Their pension",
              reason: "gone",
              dependsOn: null,
            },
          ],
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

  // Every comparable ownership read in plan/actions.ts carries deletedAt:
  // null. This one did not, so a deleted plan still counted as a plan to write
  // onto.
  it("rejects a plan the user has deleted", async () => {
    const plan = await ownPlan();
    // A real account, so the addition below would otherwise succeed and the
    // rejection can only have come from the ownership check.
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    await prisma.plan.update({
      where: { id: plan.id },
      data: { deletedAt: new Date() },
    });

    await expect(
      applySyncPlan(
        prisma,
        plan.id,
        TEST_USER_ID,
        {
          updates: [],
          removals: [],
          additions: [
            {
              linkId: account.id,
              kind: "ASSET",
              label: "Vanguard ISA",
              value: 1000,
              wrapper: "ISA",
              flow: 0,
              defaults: {
                drawdownPriority: 1,
                incomeKind: null,
                expenseCategory: null,
              },
            },
          ],
          unchanged: [],
        },
        new Map(),
      ),
    ).rejects.toThrow("Plan not found");

    expect(await prisma.planAsset.count()).toBe(0);
  });

  // Every added row shares sortOrder 0 unless it is set, and Array.sort is
  // stable: src/lib/plan/assets.ts then drains equal-priority assets in
  // whatever order the query happened to return them.
  it("gives each added row its own sortOrder, continuing from the plan's rows", async () => {
    const plan = await ownPlan();
    await prisma.planAsset.create({
      data: { planId: plan.id, label: "Existing", sortOrder: 4 },
    });
    const account = (name: string) =>
      prisma.account.create({
        data: { userId: TEST_USER_ID, name, kind: "ASSET" },
      });
    const first = await account("ISA");
    const second = await account("SIPP");

    await applySyncPlan(
      prisma,
      plan.id,
      TEST_USER_ID,
      {
        updates: [],
        removals: [],
        additions: [first, second].map((a) => ({
          linkId: a.id,
          kind: "ASSET" as const,
          label: a.name,
          value: 1000,
          wrapper: "ISA" as const,
          flow: 0,
          defaults: {
            drawdownPriority: 1,
            incomeKind: null,
            expenseCategory: null,
          },
        })),
        unchanged: [],
      },
      new Map(),
    );

    const added = await prisma.planAsset.findMany({
      where: { planId: plan.id, accountId: { not: null } },
      orderBy: { sortOrder: "asc" },
    });
    expect(added.map((a) => [a.label, a.sortOrder])).toEqual([
      ["ISA", 5],
      ["SIPP", 6],
    ]);
  });
});
