-- An expense category can declare itself the payment for a debt.
--
-- Without it, nothing detects a budget EXPENSE row on a "Mortgage" category
-- coexisting with a REPAYMENT row on the mortgage account: the projection
-- charges £30,000/yr for one £15,000 payment, silently, and keeping both rows
-- is the natural migration path because an expense row was the only way to
-- record a mortgage before repayments existed.
--
-- Additive and nullable: every existing category keeps working untouched.
ALTER TABLE "Category" ADD COLUMN "accountId" UUID;

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Category_accountId_idx" ON "Category"("accountId");
