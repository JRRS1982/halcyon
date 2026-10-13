import { TEST_USER_ID } from "@test/support/helpers";
import {
  ensurePeriodForMonthIn,
  MAX_PERIODS_PER_USER,
} from "@/lib/budget/ensurePeriod";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";

// A month is one row, and nothing capped how many a caller could mint. The
// action that creates them takes a (year, month) pair, so a loop over distinct
// years grew the shared FinancialPeriod table without limit — storage, backup
// size, and every period-scanning query (dashboard KPIs, the export) slowing
// for the whole project. 1,200 is a century of monthly use, so it only ever
// bites automated abuse.
const fillPeriods = async (count: number) => {
  const rows = Array.from({ length: count }, (_, i) => {
    const range = monthRangeFor(900 + Math.floor(i / 12), i % 12);
    return {
      userId: TEST_USER_ID,
      granularity: "MONTH" as const,
      startDate: range.startDate,
      endDate: range.endDate,
      label: range.label,
    };
  });
  await prisma.financialPeriod.createMany({ data: rows });
};

describe("ensurePeriodForMonthIn — per-user ceiling", () => {
  it("creates a period while the account is under the ceiling", async () => {
    const range = monthRangeFor(2026, 0);
    const period = await ensurePeriodForMonthIn(prisma, TEST_USER_ID, range);
    expect(period.label).toBe("January 2026");
  });

  it("refuses to create one past the ceiling", async () => {
    await fillPeriods(MAX_PERIODS_PER_USER);

    const range = monthRangeFor(2026, 5);
    await expect(
      ensurePeriodForMonthIn(prisma, TEST_USER_ID, range),
    ).rejects.toThrow(/maximum number of months/i);

    expect(
      await prisma.financialPeriod.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(MAX_PERIODS_PER_USER);
  });

  // The ceiling bounds creation, never reading: an account that somehow sits at
  // the limit must still be able to open the months it already has.
  it("still returns an existing period at the ceiling", async () => {
    await fillPeriods(MAX_PERIODS_PER_USER);
    const existing = monthRangeFor(900, 0);

    const period = await ensurePeriodForMonthIn(prisma, TEST_USER_ID, existing);
    expect(period.label).toBe(existing.label);
  });
});
