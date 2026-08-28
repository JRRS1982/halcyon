import { latestReality } from "@/lib/plan/reality";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

// The migration repairs rows written before the link existed. Proved here
// rather than trusted: a row with no categoryId is exactly what a user's whole
// budget looked like, and "the plan is empty" is how it presented.
describe("the backfill migration", () => {
  it("links an orphaned row so the plan can see it", async () => {
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
        label: "March 2026",
      },
    });
    // Written straight to the database, bypassing the fixed action — the shape
    // every self-made row had before this change.
    await prisma.budgetItem.create({
      data: {
        periodId: period.id,
        type: "EXPENSE",
        category: "FIXED",
        label: "Rent",
        budget: 1200,
      },
    });

    expect(await latestReality(TEST_USER_ID)).toEqual([]);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "Category" ("id", "userId", "type", "label", "category", "incomeCategory", "sortOrder", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), p."userId", b."type", btrim(b."label"),
             (array_agg(b."category"))[1], (array_agg(b."incomeCategory"))[1], 0, now(), now()
      FROM "BudgetItem" b
      JOIN "FinancialPeriod" p ON p."id" = b."periodId"
      WHERE b."categoryId" IS NULL AND b."deletedAt" IS NULL
        AND b."type" IN ('INCOME', 'EXPENSE') AND btrim(b."label") <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "Category" c
          WHERE c."userId" = p."userId" AND c."type" = b."type"
            AND c."label" = btrim(b."label") AND c."deletedAt" IS NULL)
      GROUP BY p."userId", b."type", btrim(b."label");

      UPDATE "BudgetItem" b SET "categoryId" = c."id"
      FROM "FinancialPeriod" p, "Category" c
      WHERE p."id" = b."periodId" AND c."userId" = p."userId"
        AND c."type" = b."type" AND c."label" = btrim(b."label")
        AND c."deletedAt" IS NULL AND b."categoryId" IS NULL
        AND b."deletedAt" IS NULL AND b."type" IN ('INCOME', 'EXPENSE')
        AND btrim(b."label") <> '';
    `);

    const rows = await latestReality(TEST_USER_ID);
    expect(rows.map((r) => r.label)).toContain("Rent");
    expect(rows.find((r) => r.label === "Rent")?.value).toBe(1200 * 12);
  });
});
