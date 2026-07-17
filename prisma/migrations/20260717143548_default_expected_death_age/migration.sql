-- AlterTable
ALTER TABLE "Plan" ALTER COLUMN "expectedDeathAge" SET DEFAULT 90;

-- Backfill plans created before the column existed so they show a life-expectancy
-- line / verdict figure without the user having to set the age by hand.
UPDATE "Plan" SET "expectedDeathAge" = 90 WHERE "expectedDeathAge" IS NULL;
