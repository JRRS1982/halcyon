-- Account becomes the durable registry for everything owned or owed, not just
-- the transactions accounts a statement can be imported to.
CREATE TYPE "AccountKind" AS ENUM ('ASSET', 'LIABILITY', 'NONE');

ALTER TABLE "Account"
  ADD COLUMN "kind" "AccountKind" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "category" "BalanceItemCategory",
  ADD COLUMN "wrapper" "PlanAssetWrapper",
  ADD COLUMN "canImportTransactions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "linkedAccountId" UUID;

-- Free text, written by nothing and read only by an assertion that it is null.
-- `kind` and `wrapper` say what it was reaching for, with a closed set.
ALTER TABLE "Account" DROP COLUMN "type";

CREATE UNIQUE INDEX "Account_linkedAccountId_key" ON "Account"("linkedAccountId");
CREATE INDEX "Account_userId_kind_idx" ON "Account"("userId", "kind");

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_linkedAccountId_fkey"
  FOREIGN KEY ("linkedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Each month's balance row becomes an observation of an account.
ALTER TABLE "BalanceItem" ADD COLUMN "accountId" UUID;

CREATE INDEX "BalanceItem_accountId_idx" ON "BalanceItem"("accountId");

ALTER TABLE "BalanceItem"
  ADD CONSTRAINT "BalanceItem_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lands early so Task 4's delete path can remove budget rows by account. The
-- budget UI does not read it until P3.
ALTER TABLE "FinancialItem" ADD COLUMN "accountId" UUID;

CREATE INDEX "FinancialItem_accountId_idx" ON "FinancialItem"("accountId");

ALTER TABLE "FinancialItem"
  ADD CONSTRAINT "FinancialItem_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
