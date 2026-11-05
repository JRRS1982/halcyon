import { TEST_USER_ID } from "@test/support/helpers";
import { buildAccountData } from "@/lib/accounts/creation";
import { getCategoryHistory } from "@/lib/insights/server";
import { prisma } from "@/lib/prisma";

// The month brief's "highest since …" reads this. If it buckets or signs the
// transactions wrong, a user is told a month was a record when it was not.
describe("getCategoryHistory (integration)", () => {
  test("nets each earlier month's transactions into that month's spend", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    const groceries = await prisma.category.create({
      data: {
        userId: TEST_USER_ID,
        label: "Groceries",
        type: "EXPENSE",
        section: "VARIABLE",
      },
    });
    const spend = (date: string, amount: number) =>
      prisma.transaction.create({
        data: {
          userId: TEST_USER_ID,
          accountId: account.id,
          categoryId: groceries.id,
          date: new Date(date),
          description: "Shop",
          amount,
        },
      });
    await spend("2026-07-03", -100);
    await spend("2026-07-20", -50);
    await spend("2026-08-11", -80);
    // A refund nets off the month it landed in.
    await spend("2026-08-12", 30);
    // The month being viewed is not its own history.
    await spend("2026-09-02", -999);

    const history = await getCategoryHistory({
      userId: TEST_USER_ID,
      categoryTypes: new Map([[groceries.id, "EXPENSE"]]),
      priorPeriods: [
        { startDate: new Date("2026-07-01"), label: "July 2026" },
        { startDate: new Date("2026-08-01"), label: "August 2026" },
      ],
      before: new Date("2026-09-01"),
      transactionsEnabled: true,
    });

    expect(history[groceries.id]).toEqual([
      { label: "July 2026", actual: 150 },
      { label: "August 2026", actual: 50 },
    ]);
  });
});
