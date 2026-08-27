import { latestReality } from "@/lib/plan/reality";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

async function monthPeriod(userId: string, label: string, start: string) {
  return prisma.financialPeriod.create({
    data: {
      userId,
      granularity: "MONTH",
      startDate: new Date(start),
      endDate: new Date(start),
      label,
    },
  });
}

// An account plus one balance observation for it, the pair latestAccountRows
// needs before it will surface a row at all.
async function accountWithBalance(
  name: string,
  kind: "ASSET" | "LIABILITY",
  value: number,
  periodId: string,
) {
  const account = await prisma.account.create({
    data: { userId: TEST_USER_ID, name, kind, category: "LONG_TERM" },
  });
  await prisma.balanceItem.create({
    data: {
      periodId,
      accountId: account.id,
      type: kind,
      category: "LONG_TERM",
      label: name,
      value,
    },
  });
  return account;
}

describe("latestReality (integration)", () => {
  it("resolves a category's latest monthly budget × 12, tagged by ItemType", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "INCOME",
        incomeCategory: "SALARY",
        label: "Salary",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "INCOME",
        incomeCategory: "SALARY",
        label: "Salary",
        budget: 3000,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toContainEqual({
      linkId: category.id,
      kind: "INCOME",
      label: "Salary",
      value: 36000,
      wrapper: null,
      flow: null,
      // INCOME_KIND_BY_BUCKET, restored from the deleted seed.ts.
      defaults: {
        drawdownPriority: null,
        incomeKind: "SALARY",
        expenseCategory: null,
      },
    });
  });

  it("skips a category with no budget row", async () => {
    await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });

  it("ignores a YEAR period's budget when computing the ×12 monthly figure", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
      },
    });
    const yearPeriod = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "YEAR",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        label: "2026",
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: yearPeriod.id,
        categoryId: category.id,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
        budget: 24000, // a full-year figure, not a monthly one
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    // No MONTH period exists for this category, so the YEAR-period row must
    // be skipped entirely rather than misread as a monthly budget.
    expect(rows).toEqual([]);
  });

  it("breaks a tie between two rows in the same period by createdAt", async () => {
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Current account", kind: "ASSET" },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Current account",
        value: 100,
        createdAt: new Date("2026-03-01T09:00:00Z"),
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Current account",
        value: 200,
        createdAt: new Date("2026-03-01T10:00:00Z"),
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    // No wrapper was set on the account (not reachable through the Add
    // drawer, which always sets one for an ASSET account) — falls back to
    // PlanAsset's own schema default so a repeat Sync round-trips cleanly.
    expect(rows).toContainEqual({
      linkId: account.id,
      kind: "ASSET",
      label: "Current account",
      value: 200,
      wrapper: "OTHER",
      flow: 0,
      // Account.category is null here too, so drawdown priority falls back to
      // OTHER's — see drawdownPriorityFor.
      defaults: {
        drawdownPriority: 3,
        incomeKind: null,
        expenseCategory: null,
      },
    });
  });

  // Isolates the account-level userId fence: this foreign account's only
  // observation sits under a period this user owns, so the period-level fence
  // (below) would not catch it on its own — only the account query's own
  // `userId` filter does.
  it("never surfaces another user's account, even when its balance item sits under this user's own period", async () => {
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      create: { id: OTHER_USER_ID },
      update: {},
    });
    const foreign = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Their ISA", kind: "ASSET" },
    });
    const ownPeriod = await monthPeriod(
      TEST_USER_ID,
      "March 2026",
      "2026-03-01",
    );
    await prisma.balanceItem.create({
      data: {
        periodId: ownPeriod.id,
        accountId: foreign.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Their ISA",
        value: 999999,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });

  // Isolates the period-level userId fence: this account belongs to the
  // querying user, so the account query's own filter (above) would not catch
  // this on its own — only the balance item's `period: { userId }` filter
  // does.
  it("never surfaces this user's own account through a balance item under another user's period", async () => {
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      create: { id: OTHER_USER_ID },
      update: {},
    });
    const own = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard ISA", kind: "ASSET" },
    });
    const theirPeriod = await monthPeriod(
      OTHER_USER_ID,
      "March 2026",
      "2026-03-01",
    );
    await prisma.balanceItem.create({
      data: {
        periodId: theirPeriod.id,
        accountId: own.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: 999999,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });
  it("carries the drawdown priority for an asset account's term bucket", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        kind: "ASSET",
        category: "LONG_TERM",
        wrapper: "ISA",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Vanguard ISA",
        value: 42300,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toContainEqual({
      linkId: account.id,
      kind: "ASSET",
      label: "Vanguard ISA",
      value: 42300,
      wrapper: "ISA",
      flow: 0,
      defaults: {
        drawdownPriority: 2,
        incomeKind: null,
        expenseCategory: null,
      },
    });
  });

  // The wrapper enum is asset-only, and drawdown priority is an asset field.
  // A liability account carrying a stray wrapper must surface neither.
  it("gives a liability account no wrapper and no drawdown priority", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
        category: "LONG_TERM",
        wrapper: "PROPERTY",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Halifax mortgage",
        value: 250000,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toContainEqual({
      linkId: account.id,
      kind: "LIABILITY",
      label: "Halifax mortgage",
      value: 250000,
      wrapper: null,
      flow: 0,
      defaults: {
        drawdownPriority: null,
        incomeKind: null,
        expenseCategory: null,
      },
    });
  });

  it("carries an expense category's own ExpenseCategory", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "DISCRETIONARY",
        label: "Holidays",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "EXPENSE",
        category: "DISCRETIONARY",
        label: "Holidays",
        budget: 150,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toContainEqual({
      linkId: category.id,
      kind: "EXPENSE",
      label: "Holidays",
      value: 1800,
      wrapper: null,
      flow: null,
      defaults: {
        drawdownPriority: null,
        incomeKind: null,
        expenseCategory: "DISCRETIONARY",
      },
    });
  });

  // A budgeted contribution is what the plan forecasts on — the intention,
  // not the actual. £833.33/mo is the float trap: 833.33 * 12 is
  // 9999.960000000001 in IEEE-754 and 9999.96 in the numeric(12,2) column, so
  // an unrounded read would flag this row as changed on every Sync forever.
  it("annualises a TRANSFER INFLOW into an asset account's flow, rounded to the stored figure", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await accountWithBalance(
      "Vanguard SIPP",
      "ASSET",
      42300,
      period.id,
    );
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 833.33,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.flow).toBe(9999.96);
  });

  // Withdrawals have no plan wiring — the projection derives them from
  // deficits. The row must not be mistaken for a contribution.
  it("gives a TRANSFER OUTFLOW no flow", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await accountWithBalance(
      "Rainy day",
      "ASSET",
      8000,
      period.id,
    );
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "OUTFLOW",
        label: "Savings raid",
        budget: 300,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(0);
  });

  // monthlyRepayment is monthly because liabilityStep does its own × 12.
  // Annualising here would clear the debt twelve times too fast.
  it("carries a REPAYMENT's monthly figure through unchanged", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await accountWithBalance(
      "Halifax mortgage",
      "LIABILITY",
      250000,
      period.id,
    );
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "REPAYMENT",
        label: "Mortgage payment",
        budget: 1250,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(1250);
  });

  it("gives an account with no budgeted flow a flow of zero, not null", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await accountWithBalance("Vanguard ISA", "ASSET", 42300, period.id);

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(0);
  });

  // The rule latestAccountRows already keeps: never having said what an
  // account is worth means it is not a plan row, and a budgeted contribution
  // on its own must not conjure one.
  it("still skips an account with a budgeted flow but no balance observation", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Vanguard SIPP", kind: "ASSET" },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });

  // The double-count guard. A transfer or repayment carries an accountId and
  // no categoryId, and latestCategoryRows joins through categoryId — so the
  // money can only ever land on the account's own row. This locks it: the
  // failure mode of the last two phases was a value that silently stopped
  // travelling while the tests agreed.
  it("never turns a transfer or repayment into an income or expense row", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const sipp = await accountWithBalance("SIPP", "ASSET", 42300, period.id);
    const mortgage = await accountWithBalance(
      "Halifax mortgage",
      "LIABILITY",
      250000,
      period.id,
    );
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: sipp.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: mortgage.id,
        type: "REPAYMENT",
        label: "Mortgage payment",
        budget: 1250,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows.filter((r) => r.kind === "EXPENSE")).toEqual([]);
    expect(rows.filter((r) => r.kind === "INCOME")).toEqual([]);
    expect(rows.map((r) => r.kind).sort()).toEqual(["ASSET", "LIABILITY"]);
    expect(rows.find((r) => r.linkId === sipp.id)?.flow).toBe(6000);
    expect(rows.find((r) => r.linkId === mortgage.id)?.flow).toBe(1250);
  });

  // One findMany now fetches every account's transfers and repayments at
  // once, so the pair (account, type) — not the account alone — has to decide
  // which row wins. A newer mispaired row must stay unfindable rather than
  // shadowing the correctly paired one behind it.
  it("reads an asset's transfer even when a newer repayment names the same account", async () => {
    const march = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const april = await monthPeriod(TEST_USER_ID, "April 2026", "2026-04-01");
    const account = await accountWithBalance(
      "Vanguard SIPP",
      "ASSET",
      42300,
      march.id,
    );
    await prisma.budgetItem.create({
      data: {
        periodId: march.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: april.id,
        accountId: account.id,
        type: "REPAYMENT",
        label: "Mispaired repayment",
        budget: 9999,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(6000);
  });

  // × 12 assumes a monthly figure, exactly as the category read does.
  it("ignores a YEAR period's transfer when reading an account's flow", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await accountWithBalance(
      "Vanguard SIPP",
      "ASSET",
      42300,
      period.id,
    );
    const yearPeriod = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "YEAR",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        label: "2026",
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: yearPeriod.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 6000, // a full-year figure, not a monthly one
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(0);
  });

  it("reads the flow from the most recent month, not the first", async () => {
    const march = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const april = await monthPeriod(TEST_USER_ID, "April 2026", "2026-04-01");
    const account = await accountWithBalance(
      "Vanguard SIPP",
      "ASSET",
      42300,
      march.id,
    );
    await prisma.budgetItem.create({
      data: {
        periodId: march.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 200,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: april.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(6000);
  });

  it("ignores a soft-deleted budget row when reading an account's flow", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await accountWithBalance(
      "Vanguard SIPP",
      "ASSET",
      42300,
      period.id,
    );
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
        deletedAt: new Date(),
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(0);
  });

  // The double-count guarantee rests on "a row with a categoryId is never a
  // TRANSFER or a REPAYMENT". That holds by construction across every write
  // path today, but the category query must enforce it rather than infer it:
  // a future write path that broke the invariant would otherwise double-count
  // silently — once on the account's flow, once as an expense.
  it("ignores a transfer or repayment that somehow carries a categoryId", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "FIXED",
        label: "Pension contribution",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 500,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows).toEqual([]);
  });

  // Per ADR-002 the server Prisma role bypasses RLS, so the query's own
  // userId filter is the only fence. A foreign period must not feed this
  // user's account a flow.
  it("never reads a flow from another user's period", async () => {
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      create: { id: OTHER_USER_ID },
      update: {},
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await accountWithBalance(
      "Vanguard SIPP",
      "ASSET",
      42300,
      period.id,
    );
    const theirPeriod = await monthPeriod(
      OTHER_USER_ID,
      "April 2026",
      "2026-04-01",
    );
    await prisma.budgetItem.create({
      data: {
        periodId: theirPeriod.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Their contribution",
        budget: 9999,
      },
    });

    const rows = await latestReality(TEST_USER_ID);

    expect(rows[0]?.flow).toBe(0);
  });
});
