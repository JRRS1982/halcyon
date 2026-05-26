-- Balance sheet items (assets + liabilities) attached to FinancialPeriod.
-- Same period as /budget — both pages share the row for a given month, so
-- they stay coupled by ?ym=YYYY-MM. RLS guard mirrors the pattern in
-- 20260523120000_financial_documents/.

CREATE TYPE "BalanceItemType" AS ENUM ('ASSET', 'LIABILITY');
CREATE TYPE "BalanceItemCategory" AS ENUM ('CURRENT', 'LONG_TERM', 'OTHER');

CREATE TABLE "BalanceItem" (
  "id"        UUID                  NOT NULL,
  "periodId"  UUID                  NOT NULL,
  "type"      "BalanceItemType"     NOT NULL,
  "category"  "BalanceItemCategory" NOT NULL,
  "label"     TEXT                  NOT NULL,
  "value"     DECIMAL(14, 2)        NOT NULL DEFAULT 0,
  "notes"     TEXT,
  "sortOrder" INTEGER               NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)          NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "BalanceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BalanceItem_periodId_type_category_sortOrder_idx"
  ON "BalanceItem"("periodId", "type", "category", "sortOrder");

ALTER TABLE "BalanceItem"
  ADD CONSTRAINT "BalanceItem_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE public."BalanceItem" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_balance_items" ON public."BalanceItem"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_balance_items" ON public."BalanceItem"
        FOR ALL
        USING (
          auth.uid() = (
            SELECT "userId"
            FROM public."FinancialPeriod"
            WHERE "id" = "BalanceItem"."periodId"
          )
        )
        WITH CHECK (
          auth.uid() = (
            SELECT "userId"
            FROM public."FinancialPeriod"
            WHERE "id" = "BalanceItem"."periodId"
          )
        )
    $body$;

  END IF;
END
$outer$;
