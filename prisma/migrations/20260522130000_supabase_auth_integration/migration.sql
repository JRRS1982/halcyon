-- Supabase Auth integration: trigger + RLS for public."User".
--
-- Guarded so the entire migration is a no-op in databases without the Supabase
-- `auth` schema (e.g., the plain Docker Postgres used for offline local dev).
-- On a Supabase database, it:
--   1. Creates a public.handle_new_user() function that inserts a profile row
--      into public."User" with id = auth.users.id whenever a new auth user is
--      created.
--   2. Installs an AFTER INSERT trigger on auth.users that invokes it.
--   3. Enables Row Level Security on public."User" and adds SELECT/UPDATE
--      policies limiting rows to the authenticated user's own profile.
--
-- Reasoning: see docs/ADRs/ADR-002-SecurityArchitecture.md.

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    -- Profile auto-creation function.
    EXECUTE $body$
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      BEGIN
        INSERT INTO public."User" (id, "updatedAt")
        VALUES (new.id, now());
        RETURN new;
      END;
      $fn$
    $body$;

    -- Trigger on auth.users insert.
    EXECUTE $body$DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users$body$;
    EXECUTE $body$
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
    $body$;

    -- Row Level Security on the profile table.
    EXECUTE $body$ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_can_view_own_profile" ON public."User"$body$;
    EXECUTE $body$
      CREATE POLICY "users_can_view_own_profile" ON public."User"
        FOR SELECT
        USING (auth.uid() = id)
    $body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_can_update_own_profile" ON public."User"$body$;
    EXECUTE $body$
      CREATE POLICY "users_can_update_own_profile" ON public."User"
        FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id)
    $body$;

    -- No INSERT policy: profile rows are only created by the SECURITY DEFINER
    -- trigger above (which bypasses RLS), never by client-side code.

  END IF;
END
$outer$;
