import { latestReality } from "@/lib/plan/reality";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// Before repayments existed, a mortgage was recorded as an expense category.
// Adding the repayment row without deleting that expense is the natural
// migration path — and the projection then charged for the payment twice,
// once as an expense and once as the account's repayment. £30,000/yr of
// outflow for one £15,000 payment, with nothing failing.
describe("a mortgage paid once is charged once", () => {
  const month = async (label: string, start: string) =>
    prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date(start),
        endDate: new Date(start),
        label,
      },
    });

  const mortgageAccount = async (periodId: string) => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId,
        accountId: account.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Halifax mortgage",
        value: 250000,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId,
        accountId: account.id,
        type: "REPAYMENT",
        label: "Halifax mortgage",
        budget: 1250,
      },
    });
    return account;
  };

  const mortgageExpense = async (
    periodId: string,
    accountId: string | null,
  ) => {
    const category = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        type: "EXPENSE",
        category: "FIXED",
        label: "Mortgage",
        accountId,
      },
    });
    await prisma.budgetItem.create({
      data: {
        periodId,
        categoryId: category.id,
        type: "EXPENSE",
        category: "FIXED",
        label: "Mortgage",
        budget: 1250,
      },
    });
    return category;
  };

  it("counts it once when the expense says which debt it pays", async () => {
    const period = await month("March 2026", "2026-03-01");
    const account = await mortgageAccount(period.id);
    await mortgageExpense(period.id, account.id);

    const rows = await latestReality(TEST_USER_ID);

    // The repayment carries the payment; the expense that declared itself
    // that same payment is not counted again.
    expect(rows.filter((r) => r.kind === "EXPENSE")).toEqual([]);
    // Monthly, not annualised: monthlyRepayment is stored monthly because
    // liabilityStep does its own × 12 — each column is in the unit its own
    // drawer displays. See budgetedFlow.
    expect(rows.find((r) => r.linkId === account.id)?.flow).toBe(1250);
  });

  // The link says "I am this account's payment". With no repayment row there
  // is nothing else carrying it, so dropping the expense would lose the money
  // rather than de-duplicate it.
  it("still counts the expense when the debt has no repayment row", async () => {
    const period = await month("March 2026", "2026-03-01");
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        kind: "LIABILITY",
      },
    });
    await mortgageExpense(period.id, account.id);

    const rows = await latestReality(TEST_USER_ID);

    expect(rows.filter((r) => r.kind === "EXPENSE")).toHaveLength(1);
    expect(rows.find((r) => r.kind === "EXPENSE")?.value).toBe(1250 * 12);
  });

  // An unlinked expense is just an expense, whatever it is called. Guessing
  // from the label would be a heuristic that sometimes deletes real spending.
  it("leaves an unlinked expense alone even beside a repayment", async () => {
    const period = await month("March 2026", "2026-03-01");
    await mortgageAccount(period.id);
    await mortgageExpense(period.id, null);

    const rows = await latestReality(TEST_USER_ID);

    expect(rows.filter((r) => r.kind === "EXPENSE")).toHaveLength(1);
  });
});
