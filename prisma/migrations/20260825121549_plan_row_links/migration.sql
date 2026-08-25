-- Plan rows gain a durable link to the thing they mirror. Nullable: null means
-- a plan-only row, which is exactly the row Sync removes.

-- PlanExpense already carried the right link under the wrong name. RENAME
-- rather than drop-and-add, so existing links survive.
ALTER TABLE "PlanExpense" RENAME COLUMN "sourceCategoryId" TO "categoryId";

-- PlanAsset's link pointed at one month's BalanceItem, not at the account.
ALTER TABLE "PlanAsset" DROP COLUMN "sourceBalanceItemId";
ALTER TABLE "PlanAsset" ADD COLUMN "accountId" UUID;

ALTER TABLE "PlanLiability" ADD COLUMN "accountId" UUID;
ALTER TABLE "PlanIncome" ADD COLUMN "categoryId" UUID;

CREATE INDEX "PlanAsset_accountId_idx" ON "PlanAsset"("accountId");
CREATE INDEX "PlanLiability_accountId_idx" ON "PlanLiability"("accountId");
CREATE INDEX "PlanIncome_categoryId_idx" ON "PlanIncome"("categoryId");
CREATE INDEX "PlanExpense_categoryId_idx" ON "PlanExpense"("categoryId");

ALTER TABLE "PlanAsset"
  ADD CONSTRAINT "PlanAsset_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlanLiability"
  ADD CONSTRAINT "PlanLiability_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlanIncome"
  ADD CONSTRAINT "PlanIncome_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlanExpense"
  ADD CONSTRAINT "PlanExpense_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
