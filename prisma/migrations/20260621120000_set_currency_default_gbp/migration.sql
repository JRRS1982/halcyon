-- The app is UK-first, so new UserSettings rows default to GBP rather than USD.
ALTER TABLE "UserSettings" ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- One-time backfill: flip existing rows still on the old USD default to GBP.
-- (Users who deliberately picked another currency are untouched.)
UPDATE "UserSettings" SET "currency" = 'GBP' WHERE "currency" = 'USD';
