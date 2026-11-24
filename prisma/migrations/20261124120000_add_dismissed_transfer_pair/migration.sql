-- CreateTable
CREATE TABLE "DismissedTransferPair" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstId" UUID NOT NULL,
    "secondId" UUID NOT NULL,
    "firstAmount" DECIMAL(14,2) NOT NULL,
    "firstDate" DATE NOT NULL,
    "firstAccountId" UUID NOT NULL,
    "secondAmount" DECIMAL(14,2) NOT NULL,
    "secondDate" DATE NOT NULL,
    "secondAccountId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DismissedTransferPair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DismissedTransferPair_userId_idx" ON "DismissedTransferPair"("userId");

-- CreateIndex
CREATE INDEX "DismissedTransferPair_secondId_idx" ON "DismissedTransferPair"("secondId");

-- CreateIndex
CREATE UNIQUE INDEX "DismissedTransferPair_firstId_secondId_key" ON "DismissedTransferPair"("firstId", "secondId");

-- AddForeignKey
ALTER TABLE "DismissedTransferPair" ADD CONSTRAINT "DismissedTransferPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DismissedTransferPair" ADD CONSTRAINT "DismissedTransferPair_firstId_fkey" FOREIGN KEY ("firstId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DismissedTransferPair" ADD CONSTRAINT "DismissedTransferPair_secondId_fkey" FOREIGN KEY ("secondId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: each user reads only their own dismissals, and the Data API cannot
-- write them at all. The only writer is the ledger's server actions, through
-- server-side Prisma, which bypasses RLS and grants (ADR-002).
-- Guarded by the auth schema check so the migration is a no-op on the plain
-- Postgres used locally and in CI.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE $body$ALTER TABLE public."DismissedTransferPair" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$
      REVOKE INSERT, UPDATE, DELETE ON public."DismissedTransferPair" FROM anon, authenticated
    $body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_read_own_dismissed_transfer_pairs" ON public."DismissedTransferPair"$body$;
    EXECUTE $body$
      CREATE POLICY "users_read_own_dismissed_transfer_pairs" ON public."DismissedTransferPair"
        FOR SELECT
        TO authenticated
        USING (auth.uid() = "userId")
    $body$;
  END IF;
END
$outer$;
