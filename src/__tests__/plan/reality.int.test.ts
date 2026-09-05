import type { AccountType } from "@prisma/client";
import { buildAccountData } from "@/lib/accounts/creation";
import { monthRangeFor } from "@/lib/budget/period";
import { latestReality } from "@/lib/plan/reality";
import { emptyRowTerms } from "@/lib/plan/rowTerms";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";
// No test in this file creates an AccountTerms row, so every terms field
// below is empty regardless of whose date of birth this is.
const DOB = new Date("1985-01-01");

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

// A live account carrying every mirror a real creation path writes — the
// same buildAccountData every actions.ts creation path spreads through.
async function typedAccount(
  name: string,
  type: AccountType,
  userId: string = TEST_USER_ID,
) {
  return prisma.account.create({
    data: { userId, name, ...buildAccountData({ type }) },
  });
}

// A FinancialPeriod for one UTC calendar month, plus a BalanceItem for it —
// just the observation itself; the account is the durable fact the row
// carries no mirror of. Several calls against the same account, made in
// scrambled month order, is exactly the DISTINCT ON tie-break this file pins
// against the deleted latestByKey's in-memory equivalent.
async function valueInMonth(
  accountId: string,
  year: number,
  monthIndex: number,
  value: number,
) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });
  const range = monthRangeFor(year, monthIndex);
  const period = await prisma.financialPeriod.create({
    data: {
      userId: account.userId,
      granularity: "MONTH",
      startDate: range.startDate,
      endDate: range.endDate,
      label: range.label,
    },
  });
  return prisma.balanceItem.create({
    data: {
      periodId: period.id,
      accountId: account.id,
      value,
    },
  });
}

// The specific type picked here is incidental — these tests only care that a
// flow query can find its account, not which wrapper it carries.
const TYPE_FOR_KIND = {
  ASSET: "SIPP",
  LIABILITY: "MORTGAGE",
} as const satisfies Record<"ASSET" | "LIABILITY", AccountType>;

// An account plus one balance observation for it, the pair latestAccountRows
// needs before it will surface a row at all.
async function accountWithBalance(
  name: string,
  kind: "ASSET" | "LIABILITY",
  value: number,
  periodId: string,
) {
  const account = await typedAccount(name, TYPE_FOR_KIND[kind]);
  await prisma.balanceItem.create({
    data: {
      periodId,
      accountId: account.id,
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
        section: "SALARY",
        label: "Salary",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "INCOME",
        section: "SALARY",
        label: "Salary",
        budget: 3000,
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows).toContainEqual({
      linkId: category.id,
      kind: "INCOME",
      label: "Salary",
      value: 36000,
      wrapper: null,
      flow: null,
      // INCOME_KIND_BY_SECTION, restored from the deleted seed.ts.
      defaults: {
        drawdownPriority: null,
        incomeKind: "SALARY",
        expenseSection: null,
      },
      terms: emptyRowTerms(),
    });
  });

  it("skips a category with no budget row", async () => {
    await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "FIXED",
        label: "Rent",
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows).toEqual([]);
  });

  it("ignores a QUARTER period's budget when computing the ×12 monthly figure", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "FIXED",
        label: "Rent",
      },
    });
    const quarterPeriod = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "QUARTER",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
        label: "Q1 2026",
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: quarterPeriod.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "FIXED",
        label: "Rent",
        budget: 6000, // a full-quarter figure, not a monthly one
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

    // No MONTH period exists for this category, so the QUARTER-period row
    // must be skipped entirely rather than misread as a monthly budget.
    expect(rows).toEqual([]);
  });

  // A MONTH and a QUARTER period can share a startDate — January's MONTH
  // period and the enclosing Q1 QUARTER period both start on Jan 1st — so two
  // live rows for the same account can still collide on `startDate DESC`
  // alone. The partial unique index on live (periodId, accountId) rules out
  // the other way this used to arise (two rows in one period), so this is
  // the only remaining case the `createdAt` tiebreak has to resolve.
  it("breaks a tie between a MONTH and a QUARTER period sharing a startDate, by createdAt", async () => {
    const account = await typedAccount("Current account", "OTHER_ASSET");
    const quarterPeriod = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "QUARTER",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
        label: "Q1 2026",
      },
    });
    const january = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        label: "January 2026",
      },
    });
    // The winning row (later createdAt) is inserted FIRST on purpose: if the
    // query ever dropped its `createdAt DESC` tiebreak and fell back to
    // whatever order Postgres happened to scan rows in, physical insertion
    // order would tend to agree with it — inserting the winner last would let
    // that bug pass unnoticed. Insert order here is the opposite of the
    // correct read order, so only a real tiebreak can produce value: 200.
    await prisma.balanceItem.create({
      data: {
        periodId: january.id,
        accountId: account.id,
        value: 200,
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: quarterPeriod.id,
        accountId: account.id,
        value: 100,
        createdAt: new Date("2026-01-01T09:00:00Z"),
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

    // OTHER_ASSET is the one account type with no natural wrapper or term
    // bucket of its own — wrapperOf and drawdownPriorityFor both read
    // straight off the type, no fallback involved.
    expect(rows).toContainEqual({
      linkId: account.id,
      kind: "ASSET",
      label: "Current account",
      value: 200,
      wrapper: "OTHER",
      flow: 0,
      defaults: {
        drawdownPriority: 3,
        incomeKind: null,
        expenseSection: null,
      },
      // feePct reads 0, not null, on an ASSET row with no AccountTerms:
      // PlanAsset.feePct is NOT NULL (schema default 0), and null here would
      // compare unequal to that 0 forever.
      terms: { ...emptyRowTerms(), feePct: 0 },
    });
  });

  // Pinned by Task 7's brief: an account with no BalanceItem must still
  // reach the plan, at value 0 — the stranded-account bug this restructure
  // exists to kill. See typedCreation.int.test.ts's deferred assertion for
  // the same rule proven from provisioning's own defaults.
  it("lists an account that has never had a balance row, at value 0", async () => {
    const a = await typedAccount("Fresh", "SAVINGS");
    const rows = await latestReality(TEST_USER_ID, DOB);
    const row = rows.find((r) => r.linkId === a.id);
    expect(row?.value).toBe(0);
    expect(row?.wrapper).toBe("CASH");
  });

  // DISTINCT ON's ORDER BY replaces latestByKey's in-memory reduction; pins
  // the same winner across three months created out of order.
  it("DISTINCT ON picks the same winner latestByKey did across several months", async () => {
    const a = await typedAccount("Pot", "SAVINGS");
    await valueInMonth(a.id, 2026, 0, 100);
    await valueInMonth(a.id, 2026, 2, 300);
    await valueInMonth(a.id, 2026, 1, 200);
    const rows = await latestReality(TEST_USER_ID, DOB);
    expect(rows.find((r) => r.linkId === a.id)?.value).toBe(300);
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
    const foreign = await typedAccount(
      "Their ISA",
      "STOCKS_ISA",
      OTHER_USER_ID,
    );
    const ownPeriod = await monthPeriod(
      TEST_USER_ID,
      "March 2026",
      "2026-03-01",
    );
    await prisma.balanceItem.create({
      data: {
        periodId: ownPeriod.id,
        accountId: foreign.id,
        value: 999999,
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows).toEqual([]);
  });

  // Isolates the period-level userId fence, now that every live account
  // surfaces on its own regardless of observation: this account's only
  // BalanceItem sits under another user's period, so the account must still
  // read as unobserved (value 0) rather than leaking that period's figure —
  // only the balance item's `period: { userId }` filter stops that leak.
  it("never reads a balance item under another user's period as this user's own account's value", async () => {
    await prisma.user.upsert({
      where: { id: OTHER_USER_ID },
      create: { id: OTHER_USER_ID },
      update: {},
    });
    const own = await typedAccount("Vanguard ISA", "STOCKS_ISA");
    const theirPeriod = await monthPeriod(
      OTHER_USER_ID,
      "March 2026",
      "2026-03-01",
    );
    await prisma.balanceItem.create({
      data: {
        periodId: theirPeriod.id,
        accountId: own.id,
        value: 999999,
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(0);
  });
  it("carries the drawdown priority for an asset account's term bucket", async () => {
    const account = await typedAccount("Vanguard ISA", "STOCKS_ISA");
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        value: 42300,
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

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
        expenseSection: null,
      },
      terms: { ...emptyRowTerms(), feePct: 0 },
    });
  });

  // The wrapper enum is asset-only, and drawdown priority is an asset field.
  // wrapperOf is derived from the account's type, so a liability account can
  // no longer carry a stray wrapper at all — this locks in that the
  // derivation itself, not a defensive fallback, is what keeps both null.
  it("gives a liability account no wrapper and no drawdown priority", async () => {
    const account = await typedAccount("Halifax mortgage", "MORTGAGE");
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: account.id,
        value: 250000,
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

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
        expenseSection: null,
      },
      // interestPct reads 0, not null, on a LIABILITY row with no
      // AccountTerms: PlanLiability.interestPct is NOT NULL (schema default
      // 0), the same reasoning as feePct's ASSET-side counterpart above.
      terms: { ...emptyRowTerms(), interestPct: 0 },
    });
  });

  it("carries an expense category's own section", async () => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        section: "DISCRETIONARY",
        label: "Holidays",
      },
    });
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        categoryId: category.id,
        type: "EXPENSE",
        section: "DISCRETIONARY",
        label: "Holidays",
        budget: 150,
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

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
        expenseSection: "DISCRETIONARY",
      },
      terms: emptyRowTerms(),
    });
  });

  // A budgeted contribution is what the plan forecasts on — the intention,
  // not the actual. It reads back exactly: PlanAsset.monthlyContribution is
  // the same unit as the budget row, so there is no × 12 and no rounding to
  // survive.
  it("reads a TRANSFER INFLOW into an asset account's flow unchanged", async () => {
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

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.flow).toBe(833.33);
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

    const rows = await latestReality(TEST_USER_ID, DOB);

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

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows[0]?.flow).toBe(1250);
  });

  it("gives an account with no budgeted flow a flow of zero, not null", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    await accountWithBalance("Vanguard ISA", "ASSET", 42300, period.id);

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows[0]?.flow).toBe(0);
  });

  // Task 7 reverses the old rule here: an account is a plan row from the
  // moment it exists, whether or not a balance sheet has ever observed it —
  // a budgeted flow with no balance observation now surfaces at value 0,
  // carrying the flow it does have.
  it("surfaces an account with a budgeted flow but no balance observation, at value 0", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await typedAccount("Vanguard SIPP", "SIPP");
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

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(0);
    expect(rows[0]?.flow).toBe(500);
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

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows.filter((r) => r.kind === "EXPENSE")).toEqual([]);
    expect(rows.filter((r) => r.kind === "INCOME")).toEqual([]);
    expect(rows.map((r) => r.kind).sort()).toEqual(["ASSET", "LIABILITY"]);
    expect(rows.find((r) => r.linkId === sipp.id)?.flow).toBe(500);
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

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows[0]?.flow).toBe(500);
  });

  // The flow is copied across as a monthly figure, so a quarter's total read
  // as one month's would be wrong — exactly as it would be for the category
  // read, which does multiply by 12.
  it("ignores a QUARTER period's transfer when reading an account's flow", async () => {
    const period = await monthPeriod(TEST_USER_ID, "March 2026", "2026-03-01");
    const account = await accountWithBalance(
      "Vanguard SIPP",
      "ASSET",
      42300,
      period.id,
    );
    const quarterPeriod = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "QUARTER",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
        label: "Q1 2026",
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId: quarterPeriod.id,
        accountId: account.id,
        type: "TRANSFER",
        direction: "INFLOW",
        label: "Pension contribution",
        budget: 1500, // a full-quarter figure, not a monthly one
      },
    });

    const rows = await latestReality(TEST_USER_ID, DOB);

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

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows[0]?.flow).toBe(500);
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

    const rows = await latestReality(TEST_USER_ID, DOB);

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
        section: "FIXED",
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

    const rows = await latestReality(TEST_USER_ID, DOB);

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

    const rows = await latestReality(TEST_USER_ID, DOB);

    expect(rows[0]?.flow).toBe(0);
  });
});
