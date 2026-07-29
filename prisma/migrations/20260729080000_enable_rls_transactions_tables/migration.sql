-- Backfills row level security on the four transactions-feature tables, which
-- shipped with app-level `userId` filtering but no RLS policy.
--
-- Why it mattered: the Supabase Data API (PostgREST) serves these same tables
-- over HTTPS without passing through the Next.js app, and `anon`/`authenticated`
-- hold every privilege on the public schema by default. With no policy, anyone
-- holding the publishable key could read or delete every user's transactions.
-- The 13 tables migrated before this one were already fenced; these four were
-- missed because RLS is hand-written (schema.prisma cannot express it) and the
-- app bypasses RLS, so nothing failed visibly. See ADR-002 and
-- docs/features/row-level-security.md.
--
-- No schema change here: policies only. Safe for the app — server-side Prisma
-- connects with a role that bypasses RLS, exactly as it already does for the
-- tables fenced in 20260523120000_financial_documents and friends.
--
-- All four tables carry a direct `userId`, so each policy is the simple
-- `auth.uid() = "userId"` form rather than the FK-walk used by BalanceItem.
--
-- Guarded on the `auth` schema existing so this is a no-op against local Docker
-- Postgres (where there is no Supabase auth and therefore no auth.uid()),
-- mirroring every earlier RLS migration.

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE public."Account" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_accounts" ON public."Account"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_accounts" ON public."Account"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

    EXECUTE $body$ALTER TABLE public."Category" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_categories" ON public."Category"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_categories" ON public."Category"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

    EXECUTE $body$ALTER TABLE public."ImportBatch" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_import_batches" ON public."ImportBatch"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_import_batches" ON public."ImportBatch"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

    EXECUTE $body$ALTER TABLE public."Transaction" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_transactions" ON public."Transaction"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_transactions" ON public."Transaction"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

    -- Prisma's own bookkeeping table. Not a model, holds no user data, but the
    -- default public-schema grants let anon DELETE/TRUNCATE it and corrupt
    -- migration state. No API client should ever touch it: revoke the grants and
    -- enable RLS with no policy (deny-all). `prisma migrate deploy` connects via
    -- DIRECT_URL as a superuser, which bypasses both.
    EXECUTE $body$REVOKE ALL ON public."_prisma_migrations" FROM anon, authenticated$body$;
    EXECUTE $body$ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY$body$;

  END IF;
END
$outer$;
