-- Reusable per-user templates for seeding a month via "Copy from → Template".
-- Owned directly by the user (no FinancialPeriod link), and flat in v1 (no
-- parent self-reference). Reuses the existing ItemType / ExpenseCategory /
-- BalanceItemType / BalanceItemCategory enums. RLS guard mirrors the pattern
-- in 20260526172728_balance_items/, simplified to a direct userId check
-- since there's no period to join through.

CREATE TABLE "BudgetTemplateItem" (
  "id"           UUID              NOT NULL,
  "userId"       UUID              NOT NULL,
  "type"         "ItemType"        NOT NULL,
  "parentItemId" UUID,
  "category"     "ExpenseCategory",
  "label"        TEXT              NOT NULL,
  "budget"       DECIMAL(12, 2)    NOT NULL DEFAULT 0,
  "sortOrder"    INTEGER           NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)      NOT NULL,
  "deletedAt"    TIMESTAMP(3),

  CONSTRAINT "BudgetTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BudgetTemplateItem_userId_type_parentItemId_sortOrder_idx"
  ON "BudgetTemplateItem"("userId", "type", "parentItemId", "sortOrder");

ALTER TABLE "BudgetTemplateItem"
  ADD CONSTRAINT "BudgetTemplateItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetTemplateItem"
  ADD CONSTRAINT "BudgetTemplateItem_parentItemId_fkey"
  FOREIGN KEY ("parentItemId") REFERENCES "BudgetTemplateItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BalanceTemplateItem" (
  "id"        UUID                  NOT NULL,
  "userId"    UUID                  NOT NULL,
  "type"      "BalanceItemType"     NOT NULL,
  "category"  "BalanceItemCategory" NOT NULL,
  "label"     TEXT                  NOT NULL,
  "value"     DECIMAL(14, 2)        NOT NULL DEFAULT 0,
  "notes"     TEXT,
  "sortOrder" INTEGER               NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)          NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "BalanceTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BalanceTemplateItem_userId_type_category_sortOrder_idx"
  ON "BalanceTemplateItem"("userId", "type", "category", "sortOrder");

ALTER TABLE "BalanceTemplateItem"
  ADD CONSTRAINT "BalanceTemplateItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE public."BudgetTemplateItem" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "users_own_budget_template_items" ON public."BudgetTemplateItem"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_budget_template_items" ON public."BudgetTemplateItem"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

    EXECUTE $body$ALTER TABLE public."BalanceTemplateItem" ENABLE ROW LEVEL SECURITY$body$;
    EXECUTE $body$DROP POLICY IF EXISTS "users_own_balance_template_items" ON public."BalanceTemplateItem"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_balance_template_items" ON public."BalanceTemplateItem"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

  END IF;
END
$outer$;
