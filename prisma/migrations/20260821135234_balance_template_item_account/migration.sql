-- A saved template row becomes an observation of an account too, so
-- "Copy from → Template" carries the link forward the same way
-- copyBalancePeriodFrom already does for month-to-month.
ALTER TABLE "BalanceTemplateItem" ADD COLUMN "accountId" UUID;

CREATE INDEX "BalanceTemplateItem_accountId_idx" ON "BalanceTemplateItem"("accountId");

ALTER TABLE "BalanceTemplateItem"
  ADD CONSTRAINT "BalanceTemplateItem_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
