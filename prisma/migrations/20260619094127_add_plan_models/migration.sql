-- CreateEnum
CREATE TYPE "PlanAssetWrapper" AS ENUM ('PENSION', 'ISA', 'GIA', 'CASH', 'PROPERTY', 'DB_PENSION', 'OTHER');

-- CreateEnum
CREATE TYPE "PlanIncomeKind" AS ENUM ('SALARY', 'SELF_EMPLOYMENT', 'STATE_PENSION', 'DB_PENSION', 'RENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PlanEventDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "GrowthKind" AS ENUM ('INFLATION', 'FIXED', 'NONE');

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "planVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My plan',
    "dateOfBirth" DATE NOT NULL,
    "retirementAge" INTEGER NOT NULL,
    "planToAge" INTEGER NOT NULL DEFAULT 95,
    "inflationPct" DECIMAL(5,2) NOT NULL DEFAULT 2.5,
    "defaultReturnPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "blendedTaxRatePct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "statePensionAge" INTEGER,
    "statePensionAnnual" DECIMAL(12,2),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAsset" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "wrapper" "PlanAssetWrapper" NOT NULL DEFAULT 'OTHER',
    "openingValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expectedReturnPct" DECIMAL(5,2),
    "annualContribution" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "contributionEndAge" INTEGER,
    "drawdownPriority" INTEGER NOT NULL DEFAULT 0,
    "sourceBalanceItemId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanLiability" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interestPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "monthlyRepayment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "endAge" INTEGER,
    "linkedAssetId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanIncome" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "PlanIncomeKind" NOT NULL,
    "annualAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "startAge" INTEGER,
    "endAge" INTEGER,
    "growthKind" "GrowthKind" NOT NULL DEFAULT 'INFLATION',
    "growthPct" DECIMAL(5,2),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanIncome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanExpense" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ExpenseCategory",
    "annualAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "startAge" INTEGER,
    "endAge" INTEGER,
    "inflationLinked" BOOLEAN NOT NULL DEFAULT true,
    "sourceCategoryId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEvent" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "direction" "PlanEventDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_userId_idx" ON "Plan"("userId");

-- CreateIndex
CREATE INDEX "PlanAsset_planId_idx" ON "PlanAsset"("planId");

-- CreateIndex
CREATE INDEX "PlanLiability_planId_idx" ON "PlanLiability"("planId");

-- CreateIndex
CREATE INDEX "PlanIncome_planId_idx" ON "PlanIncome"("planId");

-- CreateIndex
CREATE INDEX "PlanExpense_planId_idx" ON "PlanExpense"("planId");

-- CreateIndex
CREATE INDEX "PlanEvent_planId_idx" ON "PlanEvent"("planId");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAsset" ADD CONSTRAINT "PlanAsset_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanLiability" ADD CONSTRAINT "PlanLiability_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanIncome" ADD CONSTRAINT "PlanIncome_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanExpense" ADD CONSTRAINT "PlanExpense_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanEvent" ADD CONSTRAINT "PlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: life-planning tables.
--
-- Guarded so the entire block is a no-op in databases without the Supabase
-- `auth` schema (e.g., the plain Docker Postgres used for offline local dev).
-- On a Supabase database it enables RLS and adds owner-only policies:
--   Plan       → userId = auth.uid()
--   child rows → EXISTS check through their Plan row

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "plan_owner" ON "Plan"$body$;
    EXECUTE $body$CREATE POLICY "plan_owner" ON "Plan" USING (auth.uid() = "userId")$body$;

    EXECUTE $body$ALTER TABLE "PlanAsset" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "planasset_owner" ON "PlanAsset"$body$;
    EXECUTE $body$
      CREATE POLICY "planasset_owner" ON "PlanAsset" USING (
        EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanAsset"."planId" AND p."userId" = auth.uid())
      )
    $body$;

    EXECUTE $body$ALTER TABLE "PlanLiability" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "planliability_owner" ON "PlanLiability"$body$;
    EXECUTE $body$
      CREATE POLICY "planliability_owner" ON "PlanLiability" USING (
        EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanLiability"."planId" AND p."userId" = auth.uid())
      )
    $body$;

    EXECUTE $body$ALTER TABLE "PlanIncome" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "planincome_owner" ON "PlanIncome"$body$;
    EXECUTE $body$
      CREATE POLICY "planincome_owner" ON "PlanIncome" USING (
        EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanIncome"."planId" AND p."userId" = auth.uid())
      )
    $body$;

    EXECUTE $body$ALTER TABLE "PlanExpense" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "planexpense_owner" ON "PlanExpense"$body$;
    EXECUTE $body$
      CREATE POLICY "planexpense_owner" ON "PlanExpense" USING (
        EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanExpense"."planId" AND p."userId" = auth.uid())
      )
    $body$;

    EXECUTE $body$ALTER TABLE "PlanEvent" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "planevent_owner" ON "PlanEvent"$body$;
    EXECUTE $body$
      CREATE POLICY "planevent_owner" ON "PlanEvent" USING (
        EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanEvent"."planId" AND p."userId" = auth.uid())
      )
    $body$;

  END IF;
END
$outer$;
