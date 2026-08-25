// A mortgaged property is four rows that cannot stand apart: the property
// asset, the mortgage liability that names it, the repayment expense the
// mortgage manages, and the PROPERTY_SALE event that sells it. Sync used to
// remove only the one reality had lost, leaving a mortgage on a house that is
// gone and a sale event whose assetId the FK had nulled — a zombie project.ts
// skips in three places, schemas.ts refuses to save, and EventsTable renders
// as a sale of "?". Net worth drops at the sale age with nothing on screen
// explaining why.
import { linkRepaymentExpense } from "@/app/(app)/plan/actions";
import { getPlanSyncPreview, syncPlan } from "@/app/(app)/plan/syncActions";
import { toPlanInput } from "@/lib/plan/toPlanInput";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

async function accountWithValue(
  periodId: string,
  name: string,
  kind: "ASSET" | "LIABILITY",
  category: "PROPERTY" | "LONG_TERM",
  value: number,
) {
  const account = await prisma.account.create({
    data: {
      userId: TEST_USER_ID,
      name,
      kind,
      category,
      wrapper: kind === "ASSET" ? "PROPERTY" : null,
    },
  });
  await prisma.balanceItem.create({
    data: {
      periodId,
      accountId: account.id,
      type: kind,
      category,
      label: name,
      value,
    },
  });
  return account;
}

// The whole shape: two linked accounts on the balance sheet, their two plan
// rows, the mortgage's repayment expense, and a sale event on the property.
async function mortgagedProperty() {
  const plan = await prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1985-01-01"),
      retirementAge: 60,
    },
  });
  const period = await prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      label: "March 2026",
    },
  });
  const houseAccount = await accountWithValue(
    period.id,
    "The house",
    "ASSET",
    "PROPERTY",
    400000,
  );
  const mortgageAccount = await accountWithValue(
    period.id,
    "Halifax mortgage",
    "LIABILITY",
    "LONG_TERM",
    180000,
  );
  const house = await prisma.planAsset.create({
    data: {
      planId: plan.id,
      label: "The house",
      accountId: houseAccount.id,
      openingValue: 400000,
      wrapper: "PROPERTY",
    },
  });
  const mortgage = await prisma.planLiability.create({
    data: {
      planId: plan.id,
      label: "Halifax mortgage",
      accountId: mortgageAccount.id,
      openingBalance: 180000,
      monthlyRepayment: 1000,
      linkedAssetId: house.id,
    },
  });
  const repaymentId = await linkRepaymentExpense({ liabilityId: mortgage.id });
  const sale = await prisma.planEvent.create({
    data: {
      planId: plan.id,
      label: "Sell the house at 60",
      age: 60,
      direction: "INFLOW",
      amount: 0,
      kind: "PROPERTY_SALE",
      assetId: house.id,
    },
  });
  return {
    plan,
    houseAccount,
    mortgageAccount,
    house,
    mortgage,
    repaymentId,
    sale,
  };
}

describe("syncPlan cascades (integration)", () => {
  it("takes the mortgage, its repayment and the sale event with an archived property", async () => {
    const { plan, houseAccount, house, mortgage, repaymentId, sale } =
      await mortgagedProperty();

    await prisma.account.update({
      where: { id: houseAccount.id },
      data: { deletedAt: new Date() },
    });

    const result = await syncPlan();

    expect(
      await prisma.planAsset.findUnique({ where: { id: house.id } }),
    ).toBeNull();
    expect(
      await prisma.planLiability.findUnique({ where: { id: mortgage.id } }),
    ).toBeNull();
    expect(
      await prisma.planExpense.findUnique({ where: { id: repaymentId } }),
    ).toBeNull();
    expect(
      await prisma.planEvent.findUnique({ where: { id: sale.id } }),
    ).toBeNull();

    // Nothing survives holding a nulled reference to what has gone — the
    // zombie state this fixes.
    expect(
      await prisma.planLiability.count({
        where: { planId: plan.id, linkedAssetId: null, deletedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.planEvent.count({
        where: { planId: plan.id, kind: "PROPERTY_SALE", deletedAt: null },
      }),
    ).toBe(0);

    expect(result.removals.map((r) => [r.id, r.reason])).toEqual([
      [house.id, "gone"],
      [repaymentId, "plan-only"],
      [mortgage.id, "cascade"],
      [sale.id, "cascade"],
    ]);
  });

  // The projection is the thing that was silently wrong: a sale event with a
  // nulled assetId contributes no proceeds, so net worth fell at that age with
  // nothing on screen to explain it.
  it("leaves a projection with no event whose asset is gone", async () => {
    const { plan, houseAccount } = await mortgagedProperty();
    await prisma.account.update({
      where: { id: houseAccount.id },
      data: { deletedAt: new Date() },
    });

    await syncPlan();

    const after = await prisma.plan.findUniqueOrThrow({
      where: { id: plan.id },
      include: {
        assets: { where: { deletedAt: null } },
        liabilities: { where: { deletedAt: null } },
        incomes: { where: { deletedAt: null } },
        expenses: { where: { deletedAt: null } },
        events: { where: { deletedAt: null } },
      },
    });
    const input = toPlanInput(after, 2026);
    const assetIds = new Set(input.assets.map((a) => a.id));

    for (const event of input.events) {
      if (event.kind !== "PROPERTY_SALE") continue;
      expect(event.assetId).toBeDefined();
      expect(assetIds.has(event.assetId as string)).toBe(true);
    }
    for (const liability of input.liabilities) {
      if (liability.linkedAssetId === undefined) continue;
      expect(assetIds.has(liability.linkedAssetId)).toBe(true);
    }
  });

  // Every removal is counted once, however many ways a row qualifies: the
  // repayment expense is both plan-only and dragged by its mortgage.
  it("counts and lists each dragged row once", async () => {
    const { houseAccount } = await mortgagedProperty();
    await prisma.account.update({
      where: { id: houseAccount.id },
      data: { deletedAt: new Date() },
    });

    const preview = await getPlanSyncPreview();

    const ids = (preview?.removals ?? []).map((r) => r.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it("leaves the whole shape alone while the property is still on the balance sheet", async () => {
    const { house, mortgage, repaymentId, sale } = await mortgagedProperty();

    await syncPlan();

    expect(
      await prisma.planAsset.findUnique({ where: { id: house.id } }),
    ).not.toBeNull();
    expect(
      await prisma.planLiability.findUnique({ where: { id: mortgage.id } }),
    ).not.toBeNull();
    expect(
      await prisma.planEvent.findUnique({ where: { id: sale.id } }),
    ).not.toBeNull();
    // The repayment expense is plan-only, so Sync removes it either way — the
    // behaviour that already shipped, restated here so the cascade above is
    // not read as the reason.
    expect(
      await prisma.planExpense.findUnique({ where: { id: repaymentId } }),
    ).toBeNull();
  });
});
