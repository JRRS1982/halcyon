-- CreateEnum
CREATE TYPE "IncomeCategory" AS ENUM (
  'SALARY',
  'SIDE_INCOME',
  'INVESTMENTS',
  'PENSIONS',
  'OTHER'
);

-- AlterTable: parallel column to `category`, only meaningful on top-level
-- INCOME items (mirrors how `category` is only meaningful on top-level
-- EXPENSE items). Added to both the period-bound table and the template
-- table so templates round-trip the income bucket.
ALTER TABLE "FinancialItem" ADD COLUMN "incomeCategory" "IncomeCategory";
ALTER TABLE "BudgetTemplateItem" ADD COLUMN "incomeCategory" "IncomeCategory";

-- Backfill existing top-level INCOME items so they have a bucket to land in
-- after the UI gains income subsections. Users can re-categorise from the
-- Move-to-section dropdown.
UPDATE "FinancialItem"
SET "incomeCategory" = 'OTHER'
WHERE "type" = 'INCOME' AND "parentItemId" IS NULL;

UPDATE "BudgetTemplateItem"
SET "incomeCategory" = 'OTHER'
WHERE "type" = 'INCOME' AND "parentItemId" IS NULL;
