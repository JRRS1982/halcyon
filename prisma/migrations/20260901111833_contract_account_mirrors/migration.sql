-- Contract half of the balance restructure (PR 2 of 2; expand was #189).
-- Everything dropped here has been write-only since PR 1 deployed; the
-- deploy window (old code failing to WRITE these columns until the new
-- deploy lands) is accepted by the owner, as in PR 1.

-- Guards: fail loudly rather than lose a row unexpectedly.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FinancialPeriod" WHERE "granularity" = 'YEAR') THEN
    RAISE EXCEPTION 'YEAR periods exist; PR-2 assumed none';
  END IF;
  IF EXISTS (SELECT 1 FROM "Category" WHERE "type" NOT IN ('INCOME','EXPENSE')) THEN
    RAISE EXCEPTION 'Category rows outside INCOME/EXPENSE exist';
  END IF;
END $$;

-- BalanceItem: monthly facts only.
DROP INDEX IF EXISTS "BalanceItem_periodId_type_category_sortOrder_idx";
ALTER TABLE "BalanceItem"
  DROP COLUMN "type", DROP COLUMN "category",
  DROP COLUMN "label", DROP COLUMN "sortOrder";
DROP TYPE "BalanceItemType";

-- Account: kind and wrapper are derived (kindOf/wrapperOf), never stored.
DROP INDEX IF EXISTS "Account_userId_kind_idx";
ALTER TABLE "Account" DROP COLUMN "kind", DROP COLUMN "wrapper";

-- AccountKind loses NONE (recreate: Postgres cannot drop an enum value).
-- No column uses it any more; the type is kept for symmetry with the Prisma
-- enum the client still generates.
DROP TYPE "AccountKind";
CREATE TYPE "AccountKind" AS ENUM ('ASSET','LIABILITY');

-- The sheet-section enum takes its real name.
ALTER TYPE "BalanceItemCategory" RENAME TO "AccountSection";

-- Category.type narrows to what a category can actually be. The
-- Category_section_matches_type check constraint (from the section-rename
-- migration) casts to "ItemType" and would reject the column's new type, so
-- it is dropped and recreated around the ALTER with the same logic, cast to
-- the new enum.
CREATE TYPE "CategoryKind" AS ENUM ('INCOME','EXPENSE');
ALTER TABLE "Category" DROP CONSTRAINT "Category_section_matches_type";
ALTER TABLE "Category" ALTER COLUMN "type" TYPE "CategoryKind"
  USING ("type"::text::"CategoryKind");
ALTER TABLE "Category" ADD CONSTRAINT "Category_section_matches_type" CHECK (
  ((type = 'EXPENSE'::"CategoryKind") AND (section = ANY (ARRAY['FIXED'::"CategorySection", 'VARIABLE'::"CategorySection", 'DISCRETIONARY'::"CategorySection"])))
  OR
  ((type = 'INCOME'::"CategoryKind") AND (section = ANY (ARRAY['SALARY'::"CategorySection", 'SIDE_INCOME'::"CategorySection", 'INVESTMENTS'::"CategorySection", 'PENSIONS'::"CategorySection", 'OTHER'::"CategorySection"])))
);

-- PeriodGranularity loses YEAR (recreate + cast; guard above proved no rows).
-- The column default blocks an automatic cast, so it is dropped and restored
-- around the ALTER.
ALTER TYPE "PeriodGranularity" RENAME TO "PeriodGranularity_old";
CREATE TYPE "PeriodGranularity" AS ENUM ('WEEK','MONTH','QUARTER');
ALTER TABLE "FinancialPeriod" ALTER COLUMN "granularity" DROP DEFAULT;
ALTER TABLE "FinancialPeriod" ALTER COLUMN "granularity" TYPE "PeriodGranularity"
  USING ("granularity"::text::"PeriodGranularity");
ALTER TABLE "FinancialPeriod" ALTER COLUMN "granularity" SET DEFAULT 'MONTH'::"PeriodGranularity";
DROP TYPE "PeriodGranularity_old";
