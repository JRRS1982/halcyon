-- One-to-one settings row per user. Created lazily on first access via
-- upsert so existing users (and the User trigger) don't need backfilling.
-- RLS guard mirrors the pattern in 20260523120000_financial_documents/.

CREATE TABLE "UserSettings" (
  "userId"    UUID         NOT NULL,
  "currency"  TEXT         NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserSettings"
  ADD CONSTRAINT "UserSettings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE public."UserSettings" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_settings" ON public."UserSettings"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_settings" ON public."UserSettings"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

  END IF;
END
$outer$;
