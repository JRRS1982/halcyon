import { TEST_USER_ID } from "@test/support/helpers";
import { copyBalancePeriodFrom } from "@/app/(app)/balance/actions";
import { MAX_ITEMS_PER_PERIOD } from "@/lib/budget/limits";
import { prisma } from "@/lib/prisma";

// One live account per row, because a BalanceItem observes an account and the
// partial unique index allows only one live row per (period, account).
async function seedPeriodWithRows(count: number) {
  const period = await prisma.financialPeriod.create({
    data: {
      userId: TEST_USER_ID,
      label: "March 2026",
      granularity: "MONTH",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
    },
  });

  await prisma.account.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId: TEST_USER_ID,
      name: `Seeded ${i}`,
      type: "SAVINGS" as const,
      section: "OTHER" as const,
    })),
  });
  const accounts = await prisma.account.findMany({
    where: { userId: TEST_USER_ID },
    select: { id: true },
  });

  await prisma.balanceItem.createMany({
    data: accounts.map((a) => ({
      periodId: period.id,
      accountId: a.id,
      value: 1,
    })),
  });

  return period;
}

describe("balance copy ceiling (integration)", () => {
  // Copy-forward writes one row per live account in one transaction, so it is
  // the amplifier the per-period ceiling exists to stop: without this check a
  // single call fills a new month with however many rows the source holds.
  it("refuses to copy a period that would overfill the target month", async () => {
    const source = await seedPeriodWithRows(MAX_ITEMS_PER_PERIOD + 1);

    await expect(
      copyBalancePeriodFrom({
        sourcePeriodId: source.id,
        targetYear: 2026,
        targetMonth: 3,
      }),
    ).rejects.toThrow(`maximum of ${MAX_ITEMS_PER_PERIOD} rows`);

    const april = await prisma.financialPeriod.findFirst({
      where: { userId: TEST_USER_ID, startDate: new Date("2026-04-01") },
    });
    expect(
      await prisma.balanceItem.count({ where: { periodId: april?.id } }),
    ).toBe(0);
  });

  it("copies a period that sits exactly on the ceiling", async () => {
    const source = await seedPeriodWithRows(MAX_ITEMS_PER_PERIOD);

    const { items } = await copyBalancePeriodFrom({
      sourcePeriodId: source.id,
      targetYear: 2026,
      targetMonth: 3,
    });

    expect(items).toHaveLength(MAX_ITEMS_PER_PERIOD);
  });

  // The same storage defect the budget twin had: MAX_ITEMS_PER_PERIOD counts
  // live rows, so stamping the replaced rows let one action write permanently
  // while the cap reported no change.
  it("does not grow the table when the same copy runs repeatedly", async () => {
    const source = await seedPeriodWithRows(3);
    const target = { targetYear: 2026, targetMonth: 3 };

    await copyBalancePeriodFrom({ sourcePeriodId: source.id, ...target });
    const afterFirst = await prisma.balanceItem.count();

    await copyBalancePeriodFrom({ sourcePeriodId: source.id, ...target });
    await copyBalancePeriodFrom({ sourcePeriodId: source.id, ...target });

    expect(await prisma.balanceItem.count()).toBe(afterFirst);
    expect(
      await prisma.balanceItem.count({ where: { deletedAt: { not: null } } }),
    ).toBe(0);
  });
});
