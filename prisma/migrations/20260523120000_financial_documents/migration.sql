-- Add the first product tables: FinancialPeriod and FinancialItem.
-- Schema mirrors prisma/schema.prisma; RLS is wrapped in a guarded DO block so
-- this migration is a no-op on Postgres instances without the Supabase `auth`
-- schema (local Docker dev DB) and applies cleanly on Supabase.

-- ─── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE "PeriodGranularity" AS ENUM ('WEEK', 'MONTH', 'QUARTER', 'YEAR');
CREATE TYPE "ItemType" AS ENUM ('INCOME', 'EXPENSE');

-- ─── FinancialPeriod ────────────────────────────────────────────────────────
CREATE TABLE "FinancialPeriod" (
  "id"          UUID                NOT NULL,
  "userId"      UUID                NOT NULL,
  "granularity" "PeriodGranularity" NOT NULL DEFAULT 'MONTH',
  "startDate"   DATE                NOT NULL,
  "endDate"     DATE                NOT NULL,
  "label"       TEXT                NOT NULL,
  "createdAt"   TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)        NOT NULL,
  "deletedAt"   TIMESTAMP(3),

  CONSTRAINT "FinancialPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialPeriod_userId_idx"
  ON "FinancialPeriod"("userId");

CREATE UNIQUE INDEX "FinancialPeriod_userId_granularity_startDate_key"
  ON "FinancialPeriod"("userId", "granularity", "startDate");

ALTER TABLE "FinancialPeriod"
  ADD CONSTRAINT "FinancialPeriod_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── FinancialItem ──────────────────────────────────────────────────────────
CREATE TABLE "FinancialItem" (
  "id"           UUID         NOT NULL,
  "periodId"     UUID         NOT NULL,
  "type"         "ItemType"   NOT NULL,
  "parentItemId" UUID,
  "label"        TEXT         NOT NULL,
  "budget"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "actual"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sortOrder"    INTEGER      NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "deletedAt"    TIMESTAMP(3),

  CONSTRAINT "FinancialItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialItem_periodId_type_parentItemId_sortOrder_idx"
  ON "FinancialItem"("periodId", "type", "parentItemId", "sortOrder");

ALTER TABLE "FinancialItem"
  ADD CONSTRAINT "FinancialItem_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialItem"
  ADD CONSTRAINT "FinancialItem_parentItemId_fkey"
  FOREIGN KEY ("parentItemId") REFERENCES "FinancialItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Guarded by auth-schema existence so the migration is a no-op on databases
-- without Supabase Auth (e.g. plain Docker Postgres). Mirrors the pattern in
-- 20260522130000_supabase_auth_integration/migration.sql.

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    -- FinancialPeriod: a row is yours iff auth.uid() = userId.
    EXECUTE $body$ALTER TABLE public."FinancialPeriod" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_periods" ON public."FinancialPeriod"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_periods" ON public."FinancialPeriod"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

    -- FinancialItem: a row is yours iff its period is yours.
    EXECUTE $body$ALTER TABLE public."FinancialItem" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_items" ON public."FinancialItem"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_items" ON public."FinancialItem"
        FOR ALL
        USING (
          auth.uid() = (
            SELECT "userId"
            FROM public."FinancialPeriod"
            WHERE "id" = "FinancialItem"."periodId"
          )
        )
        WITH CHECK (
          auth.uid() = (
            SELECT "userId"
            FROM public."FinancialPeriod"
            WHERE "id" = "FinancialItem"."periodId"
          )
        )
    $body$;

  END IF;
END
$outer$;
