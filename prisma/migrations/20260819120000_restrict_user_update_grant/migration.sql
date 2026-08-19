-- Narrow the Data API write surface on public."User".
--
-- The own-row UPDATE policy (users_can_update_own_profile) only checks
-- auth.uid() = id; it places no restriction on WHICH columns may change. The
-- default Supabase table-wide UPDATE grant to `authenticated` therefore lets a
-- signed-in user set admin-lifecycle columns on their OWN profile row over the
-- Data API — notably `status` (ACTIVE/SUSPENDED/DELETED), `lastActiveAt` and
-- `createdAt`. No feature enforces `status` today, so there is no live exploit;
-- but if suspension is ever enforced, a suspended user could flip themselves
-- back to ACTIVE with the publishable key, bypassing the ban.
--
-- Fix: revoke the blanket UPDATE and re-grant only the columns a user
-- legitimately self-edits. Server-side Prisma connects with a role that
-- BYPASSES RLS and grants (ADR-002), so application behaviour is unchanged —
-- this only constrains the HTTPS Data API path.
--
-- Guarded like every other RLS block: a no-op on databases without the
-- Supabase `auth` schema (plain Docker Postgres used for offline local dev).

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE $body$REVOKE UPDATE ON public."User" FROM anon, authenticated$body$;
    EXECUTE $body$
      GRANT UPDATE (username, name, image, timezone, "updatedAt")
        ON public."User" TO authenticated
    $body$;
  END IF;
END
$outer$;
