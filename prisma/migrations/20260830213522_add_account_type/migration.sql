-- Expand half of the balance restructure (PR 1 of 2). Adds the stored
-- account type and the account-owned section/sortOrder, and requires
-- BalanceItem.accountId. NOTHING is dropped or renamed here: old code in the
-- migrate→deploy window still reads kind/wrapper/category and
-- BalanceItem.type/category/label, so those stay and keep being written as
-- mirrors until the contract PR. (Shipping a drop with the code that stops
-- reading it is the split that broke /plan on 27 Aug 2026.)

CREATE TYPE "AccountType" AS ENUM (
  'CURRENT_ACCOUNT','SAVINGS','CASH_ISA','STOCKS_ISA','SIPP','FINAL_SALARY',
  'GIA','PROPERTY','OTHER_ASSET','MORTGAGE','CREDIT_CARD','LOAN','OVERDRAFT','OTHER_DEBT'
);

ALTER TABLE "Account" ADD COLUMN "type" "AccountType";
ALTER TABLE "Account" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill type from what the old columns recorded. Assets: (wrapper,
-- category) per the ACCOUNT_TYPES table. Liabilities: category. kind NONE
-- (ledger/seed accounts, all current-account-shaped): CURRENT_ACCOUNT.
UPDATE "Account" SET "type" = CASE
  WHEN "kind" = 'LIABILITY' AND "linkedAccountId" IS NOT NULL THEN 'MORTGAGE'
  WHEN "kind" = 'LIABILITY' AND "category" = 'LONG_TERM'      THEN 'MORTGAGE'
  WHEN "kind" = 'LIABILITY' AND "category" = 'MEDIUM_TERM'    THEN 'LOAN'
  WHEN "kind" = 'LIABILITY' AND "category" = 'CURRENT'        THEN 'CREDIT_CARD'
  WHEN "kind" = 'LIABILITY'                                   THEN 'OTHER_DEBT'
  WHEN "wrapper" = 'CASH'       AND "category" = 'CURRENT'    THEN 'CURRENT_ACCOUNT'
  WHEN "wrapper" = 'CASH'                                     THEN 'SAVINGS'
  WHEN "wrapper" = 'ISA'        AND "category" = 'LONG_TERM'  THEN 'STOCKS_ISA'
  WHEN "wrapper" = 'ISA'                                      THEN 'CASH_ISA'
  WHEN "wrapper" = 'PENSION'                                  THEN 'SIPP'
  WHEN "wrapper" = 'DB_PENSION'                               THEN 'FINAL_SALARY'
  WHEN "wrapper" = 'GIA'                                      THEN 'GIA'
  WHEN "wrapper" = 'PROPERTY'                                 THEN 'PROPERTY'
  WHEN "kind" = 'ASSET'                                       THEN 'OTHER_ASSET'
  ELSE 'CURRENT_ACCOUNT'  -- kind NONE
END::"AccountType";

-- Section: the recorded category, backfilled where null then renamed. NONE
-- accounts carried none; every ledger-created account is current-shaped.
UPDATE "Account" SET "category" = 'CURRENT' WHERE "category" IS NULL;

ALTER TABLE "Account" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "Account" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "Account" RENAME COLUMN "category" TO "section";

-- BalanceItem.accountId required. Strict: orphan rows deleted, not adopted
-- (decided 29 Aug — data was wiped; the app is in beta). The FK moves to
-- ON DELETE CASCADE: a value with no account is meaningless, and archive is a
-- soft-delete that never fires it.
DELETE FROM "BalanceItem" WHERE "accountId" IS NULL;
ALTER TABLE "BalanceItem" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "BalanceItem" DROP CONSTRAINT "BalanceItem_accountId_fkey";
ALTER TABLE "BalanceItem" ADD CONSTRAINT "BalanceItem_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One live value per account per month. Older live duplicates are
-- soft-deleted (newest by createdAt wins), then a PARTIAL unique index
-- fences live rows only — soft-deleted history must not collide, which is
-- also why the app upserts by find-then-write (Prisma upsert cannot target
-- a partial index).
UPDATE "BalanceItem" b SET "deletedAt" = now()
WHERE b."deletedAt" IS NULL AND b."id" NOT IN (
  SELECT DISTINCT ON (b2."periodId", b2."accountId") b2."id"
  FROM "BalanceItem" b2 WHERE b2."deletedAt" IS NULL
  ORDER BY b2."periodId", b2."accountId", b2."createdAt" DESC
);
CREATE UNIQUE INDEX "BalanceItem_period_account_live"
  ON "BalanceItem" ("periodId", "accountId") WHERE "deletedAt" IS NULL;
