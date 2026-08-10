-- Transfers nets out money moved between your own accounts. Without it, every
-- transfer reads as income on one side and an expense on the other, which is
-- the first thing to go wrong once real statements are imported — so it now
-- ships on rather than waiting to be found in Settings.
--
-- Unlike the transactionsEnabled flip, this one back-fills existing rows too:
-- the section is additive (it moves transfers out of income/expense, it does
-- not hide anything), and everyone benefits from the correction. Anyone who
-- wants it off can switch it off in Settings.
ALTER TABLE "UserSettings" ALTER COLUMN "transfersEnabled" SET DEFAULT true;

UPDATE "UserSettings" SET "transfersEnabled" = true WHERE "transfersEnabled" = false;
