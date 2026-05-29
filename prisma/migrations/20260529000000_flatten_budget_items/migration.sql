-- Flatten the budget item hierarchy: drop parentItemId from FinancialItem and
-- BudgetTemplateItem so every item is a standalone top-level row. Before
-- dropping the column, promote each nested child by copying its top-level
-- ancestor's category/incomeCategory onto it, so flattened rows keep the
-- bucket they were displayed under. (A child's type always matches its root's,
-- so copying both columns from the root is correct for either side: an expense
-- root carries category + null incomeCategory, an income root the reverse.)

-- ── FinancialItem: backfill children from their root ancestor ───────────────
WITH RECURSIVE roots AS (
  SELECT id, id AS root_id
  FROM "FinancialItem"
  WHERE "parentItemId" IS NULL
  UNION ALL
  SELECT fi.id, r.root_id
  FROM "FinancialItem" fi
  JOIN roots r ON fi."parentItemId" = r.id
)
UPDATE "FinancialItem" fi
SET "category" = root."category",
    "incomeCategory" = root."incomeCategory"
FROM roots
JOIN "FinancialItem" root ON root.id = roots.root_id
WHERE fi.id = roots.id
  AND fi."parentItemId" IS NOT NULL;

-- ── BudgetTemplateItem: same backfill ───────────────────────────────────────
WITH RECURSIVE roots AS (
  SELECT id, id AS root_id
  FROM "BudgetTemplateItem"
  WHERE "parentItemId" IS NULL
  UNION ALL
  SELECT bt.id, r.root_id
  FROM "BudgetTemplateItem" bt
  JOIN roots r ON bt."parentItemId" = r.id
)
UPDATE "BudgetTemplateItem" bt
SET "category" = root."category",
    "incomeCategory" = root."incomeCategory"
FROM roots
JOIN "BudgetTemplateItem" root ON root.id = roots.root_id
WHERE bt.id = roots.id
  AND bt."parentItemId" IS NOT NULL;

-- ── Drop the self-reference FKs, hierarchy indexes, and the columns ─────────
ALTER TABLE "FinancialItem" DROP CONSTRAINT "FinancialItem_parentItemId_fkey";
DROP INDEX "FinancialItem_periodId_type_parentItemId_sortOrder_idx";
ALTER TABLE "FinancialItem" DROP COLUMN "parentItemId";
CREATE INDEX "FinancialItem_periodId_type_sortOrder_idx"
  ON "FinancialItem"("periodId", "type", "sortOrder");

ALTER TABLE "BudgetTemplateItem" DROP CONSTRAINT "BudgetTemplateItem_parentItemId_fkey";
DROP INDEX "BudgetTemplateItem_userId_type_parentItemId_sortOrder_idx";
ALTER TABLE "BudgetTemplateItem" DROP COLUMN "parentItemId";
CREATE INDEX "BudgetTemplateItem_userId_type_sortOrder_idx"
  ON "BudgetTemplateItem"("userId", "type", "sortOrder");
