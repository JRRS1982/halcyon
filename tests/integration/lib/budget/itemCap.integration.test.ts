import { TEST_USER_ID } from "@test/support/helpers";
import { createItemForMonth } from "@/app/(app)/budget/actions";
import { ensurePeriodForMonthIn } from "@/lib/budget/ensurePeriod";
import { MAX_ITEMS_PER_PERIOD } from "@/lib/budget/limits";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";

// Nothing bounded how many rows a month could hold, which also made
// copyPeriodFrom an N-times amplifier: one call wrote a whole period's worth of
// rows into another month, rather than the one-row-per-call the period ceiling
// assumes.
const fill = async (periodId: string, count: number) => {
  await prisma.budgetItem.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      periodId,
      type: "EXPENSE" as const,
      section: "FIXED" as const,
      label: `Row ${i}`,
      budget: 0,
      sortOrder: i,
    })),
  });
};

describe("budget row ceiling (integration)", () => {
  it("adds a row while the month is under the ceiling", async () => {
    await expect(
      createItemForMonth({
        year: 2026,
        month: 0,
        type: "EXPENSE",
        label: "Rent",
        budget: 100,
      }),
    ).resolves.toBeDefined();
  });

  it("refuses to add one past the ceiling", async () => {
    const period = await ensurePeriodForMonthIn(
      prisma,
      TEST_USER_ID,
      monthRangeFor(2026, 0),
    );
    await fill(period.id, MAX_ITEMS_PER_PERIOD);

    await expect(
      createItemForMonth({
        year: 2026,
        month: 0,
        type: "EXPENSE",
        label: "One too many",
        budget: 1,
      }),
    ).rejects.toThrow(/maximum of \d+ rows/i);

    expect(
      await prisma.budgetItem.count({
        where: { periodId: period.id, deletedAt: null },
      }),
    ).toBe(MAX_ITEMS_PER_PERIOD);
  });

  // Soft-deleted rows do not count, so clearing a sheet makes room again.
  it("lets a deleted row free up space", async () => {
    const period = await ensurePeriodForMonthIn(
      prisma,
      TEST_USER_ID,
      monthRangeFor(2026, 0),
    );
    await fill(period.id, MAX_ITEMS_PER_PERIOD);
    await prisma.budgetItem.update({
      where: { id: (await prisma.budgetItem.findFirstOrThrow()).id },
      data: { deletedAt: new Date() },
    });

    await expect(
      createItemForMonth({
        year: 2026,
        month: 0,
        type: "EXPENSE",
        label: "Room again",
        budget: 1,
      }),
    ).resolves.toBeDefined();
  });
});
