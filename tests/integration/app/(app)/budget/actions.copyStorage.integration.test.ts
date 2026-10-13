import { TEST_USER_ID } from "@test/support/helpers";
import {
  copyPeriodFrom,
  ensurePeriodForMonth,
} from "@/app/(app)/budget/actions";
import { prisma } from "@/lib/prisma";

// MAX_ITEMS_PER_PERIOD counts live rows, which is right for the sheet: it is a
// display ceiling, and a row the user deleted should not keep occupying one of
// their 500. It is not a storage bound, and copy-forward was treating it as
// one. Each copy soft-deleted the target month's rows and created a fresh set,
// so the sheet still read N while the table grew by N every call — a loop over
// one server action, writing permanently, with the cap reporting no change.
describe("budget copy storage (integration)", () => {
  const seedSourceWithRows = async (count: number) => {
    const source = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        label: "March 2026",
        granularity: "MONTH",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
      },
    });
    const categories = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        prisma.category.create({
          data: {
            userId: TEST_USER_ID,
            type: "EXPENSE",
            section: "VARIABLE",
            label: `Cat ${i}`,
          },
        }),
      ),
    );
    await prisma.budgetItem.createMany({
      data: categories.map((c) => ({
        periodId: source.id,
        type: "EXPENSE" as const,
        section: "VARIABLE" as const,
        categoryId: c.id,
        label: c.label,
        budget: 10,
      })),
    });
    return source;
  };

  it("does not grow the table when the same copy runs repeatedly", async () => {
    const source = await seedSourceWithRows(5);
    const target = { targetYear: 2026, targetMonth: 3 };

    await copyPeriodFrom({ sourcePeriodId: source.id, ...target });
    const afterFirst = await prisma.budgetItem.count();

    await copyPeriodFrom({ sourcePeriodId: source.id, ...target });
    await copyPeriodFrom({ sourcePeriodId: source.id, ...target });
    const afterThird = await prisma.budgetItem.count();

    expect(afterThird).toBe(afterFirst);
  });

  // The replaced rows are gone, not hidden: nothing in the app ever reads a
  // soft-deleted budget item back, so leaving tombstones only grew the heap.
  it("leaves no soft-deleted rows behind in the target month", async () => {
    const source = await seedSourceWithRows(3);
    const target = { targetYear: 2026, targetMonth: 3 };

    await copyPeriodFrom({ sourcePeriodId: source.id, ...target });
    await copyPeriodFrom({ sourcePeriodId: source.id, ...target });

    const period = await ensurePeriodForMonth(2026, 3);
    expect(
      await prisma.budgetItem.count({
        where: { periodId: period.id, deletedAt: { not: null } },
      }),
    ).toBe(0);
  });
});
