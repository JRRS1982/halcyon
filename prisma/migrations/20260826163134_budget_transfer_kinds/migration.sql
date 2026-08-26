-- Two new budget row kinds. Both key on BudgetItem.accountId (added in P1)
-- rather than on a category: a TRANSFER targets an ASSET account, a REPAYMENT
-- a LIABILITY one.
--
-- ALTER TYPE ... ADD VALUE is safe inside Prisma's transaction here only
-- because nothing below references the new values. Do not add a backfill.
ALTER TYPE "ItemType" ADD VALUE 'TRANSFER';
ALTER TYPE "ItemType" ADD VALUE 'REPAYMENT';

-- Anchored to the named account: money in positive, money out negative.
CREATE TYPE "TransferDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- Null for INCOME, EXPENSE and REPAYMENT. Set for TRANSFER.
ALTER TABLE "BudgetItem" ADD COLUMN "direction" "TransferDirection";
