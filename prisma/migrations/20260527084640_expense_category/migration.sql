-- Expense grouping buckets on FinancialItem. Only meaningful for top-level
-- EXPENSE rows; null elsewhere. Backfill existing top-level expenses to FIXED
-- so they land in a bucket rather than disappearing from the grouped view.

CREATE TYPE "ExpenseCategory" AS ENUM ('FIXED', 'VARIABLE', 'DISCRETIONARY');

ALTER TABLE "FinancialItem" ADD COLUMN "category" "ExpenseCategory";

UPDATE "FinancialItem"
  SET "category" = 'FIXED'
  WHERE "type" = 'EXPENSE' AND "parentItemId" IS NULL;
