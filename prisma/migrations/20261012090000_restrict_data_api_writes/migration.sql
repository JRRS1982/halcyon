-- Narrow the Data API write surface on every user-owned table to read-only.
--
-- Supabase grants `anon`/`authenticated` full table access on the public schema
-- by default — that is what makes the Data API work at all. RLS policies were
-- added to scope those grants to the caller's own rows, which closed the
-- cross-user hole. They do not close the per-user one: a policy answers "whose
-- rows?", never "may you write at all?".
--
-- So a signed-in account could take the publishable key out of the page bundle
-- and POST rows straight to /rest/v1/<table> with its own auth.uid(), bypassing
-- every ceiling the application believes it enforces —
-- MAX_TRANSACTIONS_PER_USER (250,000) and MAX_IMPORT_ROWS (5,000) in
-- src/lib/transactions/limits.ts both live in a server action the Data API
-- never runs. Not a disclosure: the owner checks hold. A cost and availability
-- problem, growing shared tables without bound and slowing every query that
-- scans them.
--
-- Safe because nothing in the app writes that way. The Supabase client is used
-- for `supabase.auth` only — 20 call sites, no `.from()` anywhere in src/, and
-- no browser client at all. Every read and write goes through server-side
-- Prisma, which connects as the table owner and BYPASSES both RLS and grants
-- (ADR-002). Application behaviour is unchanged.
--
-- SELECT stays, for the same reason it stayed on SentMessage in
-- 20261009120000: reading your own rows is harmless, and it keeps the door open
-- should a screen ever query Supabase directly from the browser.
--
-- This supersedes the column-scoped UPDATE grant on "User" from
-- 20260819120000. That migration narrowed UPDATE to the self-editable columns
-- because it assumed some client write path might exist; we have since
-- confirmed none does, so revoking outright is both simpler and tighter.
--
-- Policies are deliberately left as they are rather than rewritten to
-- FOR SELECT. The grants above are checked before any policy, so the revoke is
-- what carries the security; rewriting seventeen USING clauses would be churn
-- with no gain and a real chance of getting one subtly wrong.
--
-- Guarded like every other RLS block: a no-op on databases without the Supabase
-- `auth` schema (the plain Docker Postgres used locally and in CI).

DO $outer$
DECLARE
  target text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    FOREACH target IN ARRAY ARRAY[
      'User', 'UserSettings', 'FinancialPeriod', 'BudgetItem', 'BalanceItem',
      'Category', 'Account', 'AccountTerms', 'ImportBatch', 'Transaction',
      'Plan', 'PlanAsset', 'PlanLiability', 'PlanIncome', 'PlanExpense',
      'PlanEvent', 'SentMessage'
    ] LOOP
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated',
        target
      );
    END LOOP;
  END IF;
END
$outer$;
