-- One `section` column replaces the `category` + `incomeCategory` pair on
-- Category, BudgetItem and PlanExpense. The two old enums did not overlap, so
-- the backfill is a straight cast of whichever column was set. Data was
-- deleted locally and in prod on 30 Aug 2026 before this shipped; the
-- backfill is belt-and-braces, not a migration path.
--
-- Additive-then-contract in one migration is safe here because nothing reads
-- the old columns after this PR — there is no half-deployed state to protect.

CREATE TYPE "CategorySection" AS ENUM (
  'FIXED', 'VARIABLE', 'DISCRETIONARY',
  'SALARY', 'SIDE_INCOME', 'INVESTMENTS', 'PENSIONS', 'OTHER'
);

-- Category: required.
ALTER TABLE "Category" ADD COLUMN "section" "CategorySection";
UPDATE "Category"
  SET "section" = COALESCE("category"::text, "incomeCategory"::text)::"CategorySection";
ALTER TABLE "Category" ALTER COLUMN "section" SET NOT NULL;
ALTER TABLE "Category" DROP COLUMN "category", DROP COLUMN "incomeCategory";
ALTER TABLE "Category" ADD CONSTRAINT "Category_section_matches_type" CHECK (
  ("type" = 'EXPENSE' AND "section" IN ('FIXED','VARIABLE','DISCRETIONARY')) OR
  ("type" = 'INCOME'  AND "section" IN ('SALARY','SIDE_INCOME','INVESTMENTS','PENSIONS','OTHER'))
);

-- BudgetItem: nullable — anchored rows (TRANSFER/REPAYMENT) have no section.
ALTER TABLE "BudgetItem" ADD COLUMN "section" "CategorySection";
UPDATE "BudgetItem"
  SET "section" = COALESCE("category"::text, "incomeCategory"::text)::"CategorySection";
ALTER TABLE "BudgetItem" DROP COLUMN "category", DROP COLUMN "incomeCategory";
-- IS NOT NULL is load-bearing: a CHECK passes on NULL, so without it an
-- INCOME/EXPENSE row with no section would be accepted.
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_section_matches_type" CHECK (
  ("type" = 'EXPENSE' AND "section" IS NOT NULL AND "section" IN ('FIXED','VARIABLE','DISCRETIONARY')) OR
  ("type" = 'INCOME'  AND "section" IS NOT NULL AND "section" IN ('SALARY','SIDE_INCOME','INVESTMENTS','PENSIONS','OTHER')) OR
  ("type" IN ('TRANSFER','REPAYMENT') AND "section" IS NULL)
);

-- PlanExpense: nullable — a plan-only expense may have no section.
ALTER TABLE "PlanExpense" ADD COLUMN "section" "CategorySection";
UPDATE "PlanExpense" SET "section" = "category"::text::"CategorySection";
ALTER TABLE "PlanExpense" DROP COLUMN "category";
ALTER TABLE "PlanExpense" ADD CONSTRAINT "PlanExpense_section_is_expense" CHECK (
  "section" IS NULL OR "section" IN ('FIXED','VARIABLE','DISCRETIONARY')
);

DROP TYPE "ExpenseCategory";
DROP TYPE "IncomeCategory";
