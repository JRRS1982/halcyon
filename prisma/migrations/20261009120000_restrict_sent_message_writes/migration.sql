-- Narrow the Data API surface on public."SentMessage" to read-only.
--
-- SentMessage is an audit log of outbound communications: the record of what
-- the app sent to a user, and the evidence behind the consent flag on
-- UserSettings.monthlyReminderEnabled. It shipped with
--
--   CREATE POLICY "users_own_sent_messages" ON public."SentMessage"
--     FOR ALL USING (auth.uid() = "userId") WITH CHECK (auth.uid() = "userId")
--
-- which, combined with Supabase's default table-wide grants to `authenticated`,
-- lets the SUBJECT of the log rewrite it over the HTTPS Data API: DELETE their
-- own send history, or POST forged rows, which then flow into the GDPR export
-- at src/app/(app)/settings/dataActions.ts. An audit log that its subject can
-- edit is not evidence of anything.
--
-- Nothing in the app needs that write access. The only writer is the reminder
-- job (src/lib/email/subscriptions.ts) and the only reader is the data export,
-- both of which go through server-side Prisma — a role that BYPASSES RLS and
-- grants (ADR-002), so application behaviour is unchanged. Rows are removed by
-- the ON DELETE CASCADE from User when an account is deleted, never by a
-- client.
--
-- SELECT stays. Reading your own send history is harmless, and it keeps the
-- table consistent with every other user-owned model should a communication
-- history screen ever query Supabase directly from the browser.
--
-- Guarded like every other RLS block: a no-op on databases without the Supabase
-- `auth` schema (the plain Docker Postgres used locally and in CI).

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE $body$
      REVOKE INSERT, UPDATE, DELETE ON public."SentMessage" FROM anon, authenticated
    $body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_sent_messages" ON public."SentMessage"$body$;
    EXECUTE $body$
      CREATE POLICY "users_read_own_sent_messages" ON public."SentMessage"
        FOR SELECT
        TO authenticated
        USING (auth.uid() = "userId")
    $body$;
  END IF;
END
$outer$;
