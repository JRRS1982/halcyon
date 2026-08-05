-- Transactions is the fastest route to a filled-in app (one CSV import
-- populates the budget, the category breakdown and every chart), so new
-- accounts get it switched on rather than having to find the toggle first.
--
-- ALTER COLUMN ... SET DEFAULT changes only rows inserted from now on. Existing
-- users keep whatever they chose — deliberately no UPDATE here, so nobody has a
-- feature turned on behind their back.
ALTER TABLE "UserSettings" ALTER COLUMN "transactionsEnabled" SET DEFAULT true;
