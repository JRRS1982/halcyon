-- Give every existing budget row the category the plan reads it through.
--
-- The plan joins the budget on BudgetItem.categoryId (see reality.ts). That
-- column was only ever written by the starter data seeded at signup, so every
-- row a user added themselves was invisible to their own forecast — the budget
-- looked right and the plan silently ignored it. The write paths are fixed;
-- this repairs the rows already in the database.
--
-- Additive only: nothing is deleted, and rows that already have a category are
-- left alone.

-- 1. A category for every (user, type, label) that has rows but no category.
--    The bucket is taken from one of the rows itself, so the new category
--    lands in the section the user had already put it in.
INSERT INTO "Category" ("id", "userId", "type", "label", "category", "incomeCategory", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  p."userId",
  b."type",
  btrim(b."label"),
  (array_agg(b."category"))[1],
  (array_agg(b."incomeCategory"))[1],
  0,
  now(),
  now()
FROM "BudgetItem" b
JOIN "FinancialPeriod" p ON p."id" = b."periodId"
WHERE b."categoryId" IS NULL
  AND b."deletedAt" IS NULL
  AND b."type" IN ('INCOME', 'EXPENSE')
  AND btrim(b."label") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Category" c
    WHERE c."userId" = p."userId"
      AND c."type" = b."type"
      AND c."label" = btrim(b."label")
      AND c."deletedAt" IS NULL
  )
GROUP BY p."userId", b."type", btrim(b."label");

-- 2. Point the rows at it. Matched on label alone within a type, the same rule
--    the application now uses, so a row moved between sections keeps one
--    category rather than forking into two that compete for the same spending.
UPDATE "BudgetItem" b
SET "categoryId" = c."id"
FROM "FinancialPeriod" p, "Category" c
WHERE p."id" = b."periodId"
  AND c."userId" = p."userId"
  AND c."type" = b."type"
  AND c."label" = btrim(b."label")
  AND c."deletedAt" IS NULL
  AND b."categoryId" IS NULL
  AND b."deletedAt" IS NULL
  AND b."type" IN ('INCOME', 'EXPENSE')
  AND btrim(b."label") <> '';
