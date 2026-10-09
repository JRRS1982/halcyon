-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('MONTHLY_REMINDER');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "MessageResult" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "SentMessage" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "type" "MessageType" NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "subject" TEXT,
    "result" "MessageResult" NOT NULL,
    "error" TEXT,

    CONSTRAINT "SentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SentMessage_userId_idx" ON "SentMessage"("userId");

-- AddForeignKey
ALTER TABLE "SentMessage" ADD CONSTRAINT "SentMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: each user can only see and write their own sent messages.
-- Guarded by the auth schema check so the migration is safe in local dev
-- (no Supabase auth schema) and in CI, where the DB is plain Postgres.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE public."SentMessage" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_sent_messages" ON public."SentMessage"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_sent_messages" ON public."SentMessage"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

  END IF;
END
$outer$;
