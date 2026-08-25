import { getPlanSyncPreview, syncPlan } from "@/app/(app)/plan/syncActions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

async function period(label: string, start: string) {
  return prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      startDate: new Date(start),
      endDate: new Date(start),
      label,
    },
  });
}

async function accountWithValue(name: string, value: number, when: string) {
  const account = await prisma.account.create({
    data: { userId: TEST_USER_ID, name, kind: "ASSET" },
  });
  const p = await period(when, when);
  await prisma.balanceItem.create({
    data: {
      periodId: p.id,
      accountId: account.id,
      type: "ASSET",
      category: "LONG_TERM",
      label: name,
      value,
    },
  });
  return account;
}

async function emptyPlan() {
  return prisma.plan.create({
    data: {
      userId: TEST_USER_ID,
      dateOfBirth: new Date("1985-01-01"),
      retirementAge: 60,
    },
  });
}

describe("syncPlan (integration)", () => {
  it("adds a row for an account the plan does not have", async () => {
    await emptyPlan();
    const account = await accountWithValue("Vanguard ISA", 42300, "2026-03-01");

    const result = await syncPlan();

    expect(result.additions).toHaveLength(1);
    const assets = await prisma.planAsset.findMany({
      where: { accountId: account.id },
    });
    expect(assets).toHaveLength(1);
    expect(Number(assets[0]?.openingValue)).toBe(42300);
  });

  // The point of the whole feature: tuning survives.
  it("updates the value and preserves assumptions", async () => {
    const plan = await emptyPlan();
    const account = await accountWithValue("Vanguard ISA", 42300, "2026-03-01");
    const asset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Vanguard ISA",
        accountId: account.id,
        openingValue: 1,
        expectedReturnPct: 4.2,
        feePct: 0.22,
        drawdownPriority: 3,
      },
    });

    await syncPlan();

    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(Number(after.openingValue)).toBe(42300);
    expect(Number(after.expectedReturnPct)).toBe(4.2);
    expect(Number(after.feePct)).toBe(0.22);
    expect(after.drawdownPriority).toBe(3);
  });

  it("removes a plan-only row", async () => {
    const plan = await emptyPlan();
    const invented = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Buy-to-let at 50",
        openingValue: 250000,
      },
    });

    await syncPlan();

    expect(
      await prisma.planAsset.findUnique({ where: { id: invented.id } }),
    ).toBeNull();
  });

  it("removes a row whose account was archived", async () => {
    const plan = await emptyPlan();
    const account = await accountWithValue("Old car", 8000, "2026-03-01");
    const asset = await prisma.planAsset.create({
      data: { planId: plan.id, label: "Old car", accountId: account.id },
    });
    await prisma.account.update({
      where: { id: account.id },
      data: { deletedAt: new Date() },
    });

    await syncPlan();

    expect(
      await prisma.planAsset.findUnique({ where: { id: asset.id } }),
    ).toBeNull();
  });

  it("takes the most recent observation, not the first", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    for (const [when, value] of [
      ["2026-02-01", 41050],
      ["2026-03-01", 42300],
    ] as const) {
      const p = await period(when, when);
      await prisma.balanceItem.create({
        data: {
          periodId: p.id,
          accountId: account.id,
          type: "ASSET",
          category: "LONG_TERM",
          label: "Vanguard ISA",
          value,
        },
      });
    }

    await syncPlan();

    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(Number(asset.openingValue)).toBe(42300);
  });

  it("is a no-op when nothing has changed", async () => {
    await emptyPlan();
    await accountWithValue("Vanguard ISA", 42300, "2026-03-01");
    await syncPlan();

    const second = await syncPlan();

    expect(second.updates).toEqual([]);
    expect(second.additions).toEqual([]);
    expect(second.removals).toEqual([]);
  });

  it("never resolves another user's account into this plan", async () => {
    await emptyPlan();
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const foreign = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Their ISA", kind: "ASSET" },
    });
    const theirPeriod = await prisma.financialPeriod.create({
      data: {
        userId: OTHER_USER_ID,
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-01"),
        label: "March 2026",
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: theirPeriod.id,
        accountId: foreign.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Their ISA",
        value: 999999,
      },
    });

    const result = await syncPlan();

    expect(result.additions).toEqual([]);
    expect(await prisma.planAsset.count()).toBe(0);
  });

  it("previews without writing anything", async () => {
    await emptyPlan();
    await accountWithValue("Vanguard ISA", 42300, "2026-03-01");

    const preview = await getPlanSyncPreview();

    expect(preview?.additions).toHaveLength(1);
    expect(await prisma.planAsset.count()).toBe(0);
  });

  it("renames a plan row to match reality when the account's name changed", async () => {
    const plan = await emptyPlan();
    const account = await accountWithValue("Vanguard ISA", 42300, "2026-03-01");
    const asset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Old label",
        accountId: account.id,
        openingValue: 42300,
      },
    });

    await syncPlan();

    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(after.label).toBe("Vanguard ISA");
  });

  it("adds a PlanIncome row from a category's latest monthly budget × 12", async () => {
    await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        incomeCategory: "SALARY",
        label: "Salary",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.financialItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "INCOME",
        incomeCategory: "SALARY",
        label: "Salary",
        budget: 3000,
      },
    });

    const result = await syncPlan();

    expect(result.additions).toHaveLength(1);
    const incomes = await prisma.planIncome.findMany({
      where: { categoryId: category.id },
    });
    expect(incomes).toHaveLength(1);
    expect(Number(incomes[0]?.annualAmount)).toBe(36000);
    expect(incomes[0]?.kind).toBe("OTHER");
  });

  it("adds a PlanExpense row from a category's latest monthly budget × 12", async () => {
    await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.financialItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
        budget: 1200,
      },
    });

    const result = await syncPlan();

    expect(result.additions).toHaveLength(1);
    const expenses = await prisma.planExpense.findMany({
      where: { categoryId: category.id },
    });
    expect(expenses).toHaveLength(1);
    expect(Number(expenses[0]?.annualAmount)).toBe(14400);
  });

  it("adds a PlanLiability row for a liability account the plan does not have", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Mortgage", kind: "LIABILITY" },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Mortgage",
        value: 250000,
      },
    });

    const result = await syncPlan();

    expect(result.additions).toHaveLength(1);
    const liabilities = await prisma.planLiability.findMany({
      where: { accountId: account.id },
    });
    expect(liabilities).toHaveLength(1);
    expect(Number(liabilities[0]?.openingBalance)).toBe(250000);
  });

  // The defect this closes: an added PlanAsset used to always land as OTHER,
  // regardless of what the account actually is, because RealityRow carried
  // no wrapper at all.
  it("adds a PlanAsset with the account's stated wrapper, not OTHER", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "SIPP",
        kind: "ASSET",
        wrapper: "PENSION",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "SIPP",
        value: 78244,
      },
    });

    await syncPlan();

    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(asset.wrapper).toBe("PENSION");
  });

  // Wrapper is classification, not a one-time assumption — changing an
  // account's wrapper on the balance sheet must follow into the plan on the
  // next Sync, the same way a value or label change does.
  it("updates a plan row's wrapper when the account's wrapper changed", async () => {
    const plan = await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        kind: "ASSET",
        wrapper: "CASH",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: 42300,
      },
    });
    const asset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Vanguard ISA",
        accountId: account.id,
        openingValue: 42300,
        wrapper: "CASH",
      },
    });

    await prisma.account.update({
      where: { id: account.id },
      data: { wrapper: "ISA" },
    });
    const result = await syncPlan();

    expect(result.updates).toEqual([
      { id: asset.id, value: 42300, label: "Vanguard ISA", wrapper: "ISA" },
    ]);
    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(after.wrapper).toBe("ISA");
  });
});
