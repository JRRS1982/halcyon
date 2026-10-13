import { TEST_USER_ID } from "@test/support/helpers";
import { createItemForMonth } from "@/app/(app)/budget/actions";
import { createManagedCategory } from "@/app/(app)/settings/categoryActions";
import { MAX_ITEMS_PER_PERIOD } from "@/lib/budget/limits";
import { MAX_CATEGORIES_PER_USER } from "@/lib/categories/limits";
import { storedCeilingFor } from "@/lib/limits/ceilings";
import { prisma } from "@/lib/prisma";

// The defect these ceilings exist for: every delete path in this schema stamps
// deletedAt, and every cap counted live rows, so create → delete → repeat ran
// forever behind a number that never moved. The live count stays at zero while
// the table grows, which is why a test on the live count can never see it.
//
// Tombstones are seeded directly rather than by looping the actions, because
// the point is the ceiling, not the thousands of round trips it takes to reach.
describe("storage ceilings (integration)", () => {
  it("stops a budget create-delete loop the live cap cannot see", async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        label: "March 2026",
        granularity: "MONTH",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
      },
    });
    const deletedAt = new Date();
    await prisma.budgetItem.createMany({
      data: Array.from(
        { length: storedCeilingFor(MAX_ITEMS_PER_PERIOD) },
        (_, i) => ({
          periodId: period.id,
          type: "EXPENSE" as const,
          section: "VARIABLE" as const,
          label: `Gone ${i}`,
          budget: 0,
          deletedAt,
        }),
      ),
    });

    // What the sheet shows: nothing. What the table holds: the ceiling.
    expect(
      await prisma.budgetItem.count({
        where: { periodId: period.id, deletedAt: null },
      }),
    ).toBe(0);

    await expect(
      createItemForMonth({
        year: 2026,
        month: 2,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "One more",
      }),
    ).rejects.toThrow(/created and deleted too many times/);
  });

  it("stops a category create-delete loop the live cap cannot see", async () => {
    const deletedAt = new Date();
    await prisma.category.createMany({
      data: Array.from(
        { length: storedCeilingFor(MAX_CATEGORIES_PER_USER) },
        (_, i) => ({
          userId: TEST_USER_ID,
          label: `Gone ${i}`,
          type: "EXPENSE" as const,
          section: "VARIABLE" as const,
          deletedAt,
        }),
      ),
    });

    await expect(
      createManagedCategory({
        label: "One more",
        type: "EXPENSE",
        section: "VARIABLE",
      }),
    ).rejects.toThrow(/created and deleted too many times/);
  });

  // The ceiling must not fire on ordinary use, or tidying up would lock the
  // sheet. Well under the stored ceiling, a deleted row frees its slot.
  it("leaves ordinary deleting alone", async () => {
    await prisma.category.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId: TEST_USER_ID,
        label: `Gone ${i}`,
        type: "EXPENSE" as const,
        section: "VARIABLE" as const,
        deletedAt: new Date(),
      })),
    });

    await expect(
      createManagedCategory({
        label: "Fine",
        type: "EXPENSE",
        section: "VARIABLE",
      }),
    ).resolves.toBeUndefined();
  });
});
