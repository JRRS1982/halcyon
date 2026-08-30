import { createItemForMonth } from "@/app/(app)/budget/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// Adding the first row of a month used to be two actions: ensurePeriodForMonth,
// then createItem. Navigating between them left a FinancialPeriod with nothing
// in it — a month that looks visited but is empty. These are now one action and
// one transaction, which is what these tests pin down.

const countPeriods = () =>
  prisma.financialPeriod.count({ where: { userId: TEST_USER_ID } });

describe("createItemForMonth (integration)", () => {
  test("creates the month's period and the row together", async () => {
    expect(await countPeriods()).toBe(0);

    const { periodId, item } = await createItemForMonth({
      year: 2026,
      month: 2, // March, 0-indexed
      type: "EXPENSE",
      label: "Rent",
    });

    expect(await countPeriods()).toBe(1);
    const period = await prisma.financialPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.label).toBe("March 2026");
    expect(item.periodId).toBe(periodId);
    expect(item.label).toBe("Rent");
    // Expenses default to FIXED when no section is given.
    expect(item.section).toBe("FIXED");
  });

  test("reuses the period for the second row rather than making another", async () => {
    const first = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "EXPENSE",
      label: "Rent",
    });
    const second = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "EXPENSE",
      label: "Food",
    });

    expect(second.periodId).toBe(first.periodId);
    expect(await countPeriods()).toBe(1);
    // sortOrder appends within (period, type).
    expect(second.item.sortOrder).toBeGreaterThan(first.item.sortOrder);
  });

  test("income rows default their section to OTHER", async () => {
    const { item } = await createItemForMonth({
      year: 2026,
      month: 2,
      type: "INCOME",
      label: "Salary",
    });

    expect(item.section).toBe("OTHER");
  });

  // The point of the merge: a period is never left behind on its own.
  test("creates no period when the row can't be created", async () => {
    await expect(
      createItemForMonth({
        year: 2026,
        month: 2,
        type: "EXPENSE",
        // Past the schema's 120-character ceiling, so parse throws before any
        // write — the closest thing to a mid-transaction failure that can be
        // provoked from outside.
        label: "x".repeat(200),
      }),
    ).rejects.toThrow();

    expect(await countPeriods()).toBe(0);
  });
});
