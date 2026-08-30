import { deletePlanAsset } from "@/app/(app)/plan/actions";
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

async function categoryWithBudget(label: string, budget: number, when: string) {
  const category = await prisma.category.create({
    data: {
      userId: TEST_USER_ID,
      type: "INCOME",
      section: "SALARY",
      label,
    },
  });
  const p = await period(when, when);
  await prisma.budgetItem.create({
    data: {
      periodId: p.id,
      categoryId: category.id,
      type: "INCOME",
      section: "SALARY",
      label,
      budget,
    },
  });
  return category;
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
    // Pence, not whole pounds: 833.33 * 12 is 9999.960000000001 in IEEE-754,
    // the numeric(12,2) column stores 9999.96, and an unrounded recomputation
    // would report this row as an update on every press, forever.
    await categoryWithBudget("Salary", 833.33, "2026-02-01");
    await syncPlan();

    const second = await syncPlan();

    expect(second.updates).toEqual([]);
    expect(second.additions).toEqual([]);
    expect(second.removals).toEqual([]);
  });

  it("annualises a pence budget to the value the column will store", async () => {
    await emptyPlan();
    const category = await categoryWithBudget("Salary", 833.33, "2026-03-01");

    const result = await syncPlan();

    // 833.33 * 12 === 9999.960000000001; the row must carry the 2dp figure.
    expect(result.additions[0]?.value).toBe(9999.96);
    const income = await prisma.planIncome.findFirstOrThrow({
      where: { categoryId: category.id },
    });
    expect(Number(income.annualAmount)).toBe(9999.96);
  });

  // Deleting a plan row is a soft delete that keeps its accountId, and
  // loadPrimaryPlanRows only reads live rows — so the account looks unmirrored
  // and the next Sync adds a fresh row beside the tombstone. Documented
  // behaviour; a naive unique index on (planId, accountId) would turn it into
  // a constraint violation instead.
  it("re-adds a row the user deleted from the plan", async () => {
    const plan = await emptyPlan();
    const account = await accountWithValue("Vanguard ISA", 42300, "2026-03-01");
    await syncPlan();
    const first = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    await deletePlanAsset({ id: first.id });

    await syncPlan();

    const live = await prisma.planAsset.findMany({
      where: { planId: plan.id, deletedAt: null },
    });
    expect(live).toHaveLength(1);
    expect(live[0]?.id).not.toBe(first.id);
    expect(live[0]?.accountId).toBe(account.id);
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
        section: "SALARY",
        label: "Salary",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "INCOME",
        section: "SALARY",
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
    // Was asserted as OTHER while addRow hard-coded it; the category's own
    // SALARY bucket is the fact seed.ts mapped through INCOME_KIND_BY_BUCKET.
    expect(incomes[0]?.kind).toBe("SALARY");
    // A salary stops at retirement. Without this the stream runs on to
    // expectedDeathAge (src/lib/plan/streams.ts → helpers.ts), overstating
    // lifetime income by decades.
    expect(incomes[0]?.endAge).toBe(60);
  });

  it("adds a non-salary income with no end age", async () => {
    await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        section: "PENSIONS",
        label: "Final salary pension",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "INCOME",
        section: "PENSIONS",
        label: "Final salary pension",
        budget: 800,
      },
    });

    await syncPlan();

    const income = await prisma.planIncome.findFirstOrThrow({
      where: { categoryId: category.id },
    });
    expect(income.kind).toBe("DB_PENSION");
    expect(income.endAge).toBeNull();
  });

  it("adds a PlanExpense row from a category's latest monthly budget × 12", async () => {
    await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "FIXED",
        label: "Rent",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "FIXED",
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
      {
        id: asset.id,
        value: 42300,
        label: "Vanguard ISA",
        wrapper: "ISA",
        flow: 0,
      },
    ]);
    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(after.wrapper).toBe("ISA");
  });
  it("adds a PlanAsset with the drawdown priority of its term bucket", async () => {
    await emptyPlan();
    const buckets = [
      ["CURRENT", 0],
      ["MEDIUM_TERM", 1],
      ["LONG_TERM", 2],
      ["OTHER", 3],
      ["PROPERTY", 9],
    ] as const;
    const p = await period("2026-03-01", "2026-03-01");
    const accounts = await Promise.all(
      buckets.map(async ([bucket]) => {
        const account = await prisma.account.create({
          data: {
            userId: TEST_USER_ID,
            name: `${bucket} account`,
            kind: "ASSET",
            category: bucket,
          },
        });
        await prisma.balanceItem.create({
          data: {
            periodId: p.id,
            accountId: account.id,
            type: "ASSET",
            category: bucket,
            label: `${bucket} account`,
            value: 1000,
          },
        });
        return account;
      }),
    );

    await syncPlan();

    for (const [index, [, priority]] of buckets.entries()) {
      const asset = await prisma.planAsset.findFirstOrThrow({
        where: { accountId: accounts[index]?.id },
      });
      expect(asset.drawdownPriority).toBe(priority);
    }
  });

  // Account.category is nullable — the Settings account form doesn't collect
  // one — so an account with no term bucket lands where OTHER does.
  it("gives an account with no term bucket the OTHER drawdown priority", async () => {
    await emptyPlan();
    const account = await accountWithValue("Premium bonds", 5000, "2026-03-01");

    await syncPlan();

    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(asset.drawdownPriority).toBe(3);
  });

  it("adds a PlanExpense carrying the category's own section", async () => {
    await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "DISCRETIONARY",
        label: "Holidays",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "DISCRETIONARY",
        label: "Holidays",
        budget: 150,
      },
    });

    await syncPlan();

    const expense = await prisma.planExpense.findFirstOrThrow({
      where: { categoryId: category.id },
    });
    expect(expense.section).toBe("DISCRETIONARY");
  });

  // provisionUserSettings seeds ~17 starter budget categories at £0. Without
  // the additions guard a brand-new user's plan opens on a table of empty
  // lines — the scenario seed.ts's comment named.
  it("adds nothing for a category budgeted at zero", async () => {
    await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "FIXED",
        label: "Childcare",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "FIXED",
        label: "Childcare",
        budget: 0,
      },
    });

    const result = await syncPlan();

    expect(result.additions).toEqual([]);
    expect(await prisma.planExpense.count()).toBe(0);
  });

  // The other half of the guard: an existing linked row falling to £0 is an
  // update. Treating it as a removal would delete a paid-off mortgage's row
  // and the assumptions on it, and the confirmation names only plan-only rows.
  it("updates a linked row whose budget has fallen to zero rather than removing it", async () => {
    const plan = await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "FIXED",
        label: "Childcare",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "FIXED",
        label: "Childcare",
        budget: 0,
      },
    });
    const expense = await prisma.planExpense.create({
      data: {
        planId: plan.id,
        label: "Childcare",
        categoryId: category.id,
        annualAmount: 9600,
      },
    });

    const result = await syncPlan();

    expect(result.removals).toEqual([]);
    expect(result.updates).toEqual([
      {
        id: expense.id,
        value: 0,
        label: "Childcare",
        wrapper: null,
        flow: null,
      },
    ]);
    const after = await prisma.planExpense.findUniqueOrThrow({
      where: { id: expense.id },
    });
    expect(Number(after.annualAmount)).toBe(0);
  });

  // The Kept guarantee. drawdownPriority and endAge are addition-time
  // defaults, never re-applied — a user who tuned them keeps them.
  it("does not reset a tuned drawdown priority or end age", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        kind: "ASSET",
        category: "LONG_TERM",
        wrapper: "ISA",
      },
    });
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        section: "SALARY",
        label: "Salary",
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
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "INCOME",
        section: "SALARY",
        label: "Salary",
        budget: 3000,
      },
    });

    await syncPlan();

    const seededAsset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    const seededIncome = await prisma.planIncome.findFirstOrThrow({
      where: { categoryId: category.id },
    });
    await prisma.planAsset.update({
      where: { id: seededAsset.id },
      data: { drawdownPriority: 7 },
    });
    await prisma.planIncome.update({
      where: { id: seededIncome.id },
      data: { endAge: 55 },
    });

    const second = await syncPlan();

    expect(second.updates).toEqual([]);
    const asset = await prisma.planAsset.findUniqueOrThrow({
      where: { id: seededAsset.id },
    });
    const income = await prisma.planIncome.findUniqueOrThrow({
      where: { id: seededIncome.id },
    });
    expect(asset.drawdownPriority).toBe(7);
    expect(income.endAge).toBe(55);
  });

  // A liability account may carry a stray Account.wrapper (nothing stops it),
  // and the wrapper enum is asset-only. Its row must round-trip clean rather
  // than flagging a phantom update on every Sync.
  it("leaves a liability alone when its account carries a wrapper", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
        category: "LONG_TERM",
        wrapper: "PROPERTY",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Halifax mortgage",
        value: 250000,
      },
    });
    await syncPlan();

    const second = await syncPlan();

    expect(second.updates).toEqual([]);
    expect(second.removals).toEqual([]);
    expect(second.unchanged).toHaveLength(1);
  });

  // The payoff. A budgeted pension contribution used to become a PlanExpense:
  // the money left the projection and never arrived in the pension, so the
  // user was £6,000/yr poorer *and* the pension never grew. It now rides on
  // the asset row that already mirrors the account.
  it("writes a TRANSFER INFLOW into the mirrored asset's annualContribution", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard SIPP",
        kind: "ASSET",
        category: "LONG_TERM",
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
        label: "Vanguard SIPP",
        value: 42300,
      },
    });
    // Pence, not whole pounds: 833.33 * 12 is 9999.960000000001 in IEEE-754
    // and 9999.96 in the numeric(12,2) column. An unrounded read would report
    // this row as an update on every press, forever.
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 833.33,
      },
    });

    await syncPlan();

    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(Number(asset.annualContribution)).toBe(9999.96);
    // And the money did not also leave as an expense.
    expect(await prisma.planExpense.count()).toBe(0);

    const second = await syncPlan();

    expect(second.updates).toEqual([]);
    expect(second.additions).toEqual([]);
    expect(second.removals).toEqual([]);
    expect(second.unchanged).toEqual([asset.id]);
  });

  // monthlyRepayment stayed 0 before this: cash went out every year and the
  // debt never moved. It is monthly, not annualised — liabilityStep does its
  // own × 12.
  it("writes a REPAYMENT into the mirrored liability's monthlyRepayment, unannualised", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
        category: "LONG_TERM",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Halifax mortgage",
        value: 250000,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "REPAYMENT",
        label: "Mortgage payment",
        budget: 1250,
      },
    });

    await syncPlan();

    const liability = await prisma.planLiability.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(Number(liability.monthlyRepayment)).toBe(1250);
    expect(await prisma.planExpense.count()).toBe(0);

    const second = await syncPlan();

    expect(second.updates).toEqual([]);
    expect(second.unchanged).toEqual([liability.id]);
  });

  // A flow change on an existing row is an update like any other: the Sync
  // button's count includes it, and the tuned assumptions around it survive.
  it("updates a contribution the user re-budgeted, keeping the row's assumptions", async () => {
    const plan = await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard SIPP",
        kind: "ASSET",
        category: "LONG_TERM",
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
        label: "Vanguard SIPP",
        value: 42300,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
      },
    });
    const asset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Vanguard SIPP",
        accountId: account.id,
        openingValue: 42300,
        wrapper: "PENSION",
        annualContribution: 2400,
        expectedReturnPct: 4.2,
        contributionEndAge: 55,
      },
    });

    const result = await syncPlan();

    expect(result.updates).toEqual([
      {
        id: asset.id,
        value: 42300,
        label: "Vanguard SIPP",
        wrapper: "PENSION",
        flow: 6000,
      },
    ]);
    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(Number(after.annualContribution)).toBe(6000);
    expect(Number(after.expectedReturnPct)).toBe(4.2);
    expect(after.contributionEndAge).toBe(55);
  });

  // Stopping a contribution has to reach the projection too. Left alone, the
  // plan would pay into an account the budget no longer funds, forever — the
  // same silent staleness the feature exists to remove.
  it("clears a contribution the budget no longer funds", async () => {
    const plan = await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard SIPP",
        kind: "ASSET",
        category: "LONG_TERM",
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
        label: "Vanguard SIPP",
        value: 42300,
      },
    });
    const asset = await prisma.planAsset.create({
      data: {
        planId: plan.id,
        label: "Vanguard SIPP",
        accountId: account.id,
        openingValue: 42300,
        wrapper: "PENSION",
        annualContribution: 6000,
      },
    });

    await syncPlan();

    const after = await prisma.planAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(Number(after.annualContribution)).toBe(0);
  });

  // An account opened at £0 and funded monthly is the case the feature exists
  // for. The additions guard drops zero-valued rows so a new user's plan does
  // not open on ~17 empty starter categories — but a row with a flow is not an
  // empty row. Dropped, this Sync would report "Up to date" while £6,000/yr
  // never reached the projection, self-healing only once the balance went
  // positive.
  it("adds a row for an account worth nothing that is being paid into", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard SIPP",
        kind: "ASSET",
        category: "LONG_TERM",
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
        label: "Vanguard SIPP",
        value: 0,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
      },
    });

    const result = await syncPlan();

    expect(result.additions).toHaveLength(1);
    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(Number(asset.openingValue)).toBe(0);
    expect(Number(asset.annualContribution)).toBe(6000);

    const second = await syncPlan();

    expect(second.additions).toEqual([]);
    expect(second.updates).toEqual([]);
    expect(second.unchanged).toEqual([asset.id]);
  });

  // The guard's original purpose still holds: provisionUserSettings seeds ~17
  // starter categories at £0, and a category has no flow to rescue it.
  it("still adds nothing for a category budgeted at zero", async () => {
    await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "FIXED",
        label: "Childcare",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "FIXED",
        label: "Childcare",
        budget: 0,
      },
    });

    const result = await syncPlan();

    expect(result.additions).toEqual([]);
    expect(await prisma.planExpense.count()).toBe(0);
  });

  // A withdrawal is not a contribution: TRANSFER OUTFLOW has no plan wiring,
  // and it must not reach annualContribution by the back door.
  it("does not turn a TRANSFER OUTFLOW into a contribution", async () => {
    await emptyPlan();
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Rainy day",
        kind: "ASSET",
        category: "CURRENT",
        wrapper: "CASH",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "ASSET",
        category: "CURRENT",
        label: "Rainy day",
        value: 8000,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "OUTFLOW",
        label: "Savings raid",
        budget: 300,
      },
    });

    await syncPlan();

    const asset = await prisma.planAsset.findFirstOrThrow({
      where: { accountId: account.id },
    });
    expect(Number(asset.annualContribution)).toBe(0);
    expect(await prisma.planExpense.count()).toBe(0);
  });

  it("carries the budget category's section onto PlanExpense unchanged", async () => {
    const plan = await emptyPlan();
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "DISCRETIONARY",
        label: "Eating out",
      },
    });
    const p = await period("2026-03-01", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: p.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "DISCRETIONARY",
        label: "Eating out",
        budget: 150,
      },
    });

    await syncPlan();

    const row = await prisma.planExpense.findFirstOrThrow({
      where: { planId: plan.id, categoryId: category.id },
    });
    expect(row.section).toBe("DISCRETIONARY");
  });
});
