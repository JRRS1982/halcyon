-- AlterEnum
-- Adding new values mid-enum (BEFORE existing values) keeps the Postgres enum
-- in logical liquidity order: CURRENT < MEDIUM_TERM < LONG_TERM < PROPERTY <
-- OTHER. The app's display order is controlled in code (reorder.ts), so this
-- ordering is for tidiness when querying the DB directly.
ALTER TYPE "BalanceItemCategory" ADD VALUE 'MEDIUM_TERM' BEFORE 'LONG_TERM';
ALTER TYPE "BalanceItemCategory" ADD VALUE 'PROPERTY' BEFORE 'OTHER';
