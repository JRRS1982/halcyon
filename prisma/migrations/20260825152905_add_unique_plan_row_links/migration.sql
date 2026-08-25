-- One plan row per account, and one per category, per plan.
--
-- Sync resolves what to add outside the transaction that adds it, so two
-- concurrent presses (two tabs, a double submit) can both decide to add the
-- same account and both create a row. Nothing in code can prevent that; a
-- unique index can. Postgres treats NULLs as distinct by default, so plan-only
-- rows — the ones with no link — are unaffected however many a plan holds.

-- A soft-deleted row is a tombstone, not this plan's mirror of the account any
-- more, and it must not occupy the slot the next Sync needs. Going forward the
-- delete actions clear the link as they set deletedAt; this clears the links
-- rows already carry, and is what makes the indexes below appliable.
UPDATE "PlanAsset"     SET "accountId"  = NULL WHERE "deletedAt" IS NOT NULL AND "accountId"  IS NOT NULL;
UPDATE "PlanLiability" SET "accountId"  = NULL WHERE "deletedAt" IS NOT NULL AND "accountId"  IS NOT NULL;
UPDATE "PlanIncome"    SET "categoryId" = NULL WHERE "deletedAt" IS NOT NULL AND "categoryId" IS NOT NULL;
UPDATE "PlanExpense"   SET "categoryId" = NULL WHERE "deletedAt" IS NOT NULL AND "categoryId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PlanAsset_planId_accountId_key" ON "PlanAsset"("planId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanLiability_planId_accountId_key" ON "PlanLiability"("planId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanIncome_planId_categoryId_key" ON "PlanIncome"("planId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanExpense_planId_categoryId_key" ON "PlanExpense"("planId", "categoryId");
