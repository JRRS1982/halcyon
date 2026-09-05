-- AccountTerms: the projection's parameters, one row per account.
CREATE TABLE "AccountTerms" (
    "accountId" UUID NOT NULL,
    "expectedReturnPct" DECIMAL(5,2),
    "feePct" DECIMAL(5,2),
    "minAccessAge" INTEGER,
    "annualIncome" DECIMAL(12,2),
    "interestPct" DECIMAL(5,2),
    "interestOnly" BOOLEAN NOT NULL DEFAULT false,
    "revisionDate" DATE,
    "revisionRate" DECIMAL(5,2),
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTerms_pkey" PRIMARY KEY ("accountId")
);

ALTER TABLE "AccountTerms"
    ADD CONSTRAINT "AccountTerms_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- PlanLiability: a two-rate mortgage — fixed until revisionAge, then revisionRate.
ALTER TABLE "PlanLiability" ADD COLUMN "revisionRate" DECIMAL(5,2);
ALTER TABLE "PlanLiability" ADD COLUMN "revisionAge" INTEGER;

-- PlanAsset: the DB pension entitlement and the age it starts paying.
ALTER TABLE "PlanAsset" ADD COLUMN "annualIncome" DECIMAL(12,2);
ALTER TABLE "PlanAsset" ADD COLUMN "incomeFromAge" INTEGER;

-- PlanAsset: annual becomes monthly. A RENAME so any code still asking for
-- annualContribution fails loudly, rather than reading a monthly figure as an
-- annual one during a migrate-without-redeploy window.
ALTER TABLE "PlanAsset" RENAME COLUMN "annualContribution" TO "monthlyContribution";
UPDATE "PlanAsset" SET "monthlyContribution" = ROUND("monthlyContribution" / 12, 2);

-- RLS, per ADR-002: defence in depth beside the app-level userId filter.
-- AccountTerms carries no userId of its own, so ownership is reached through
-- its account, exactly as FinancialItem reaches it through its period.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE public."AccountTerms" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_account_terms" ON public."AccountTerms"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_account_terms" ON public."AccountTerms"
        FOR ALL
        USING (
          auth.uid() = (
            SELECT "userId"
            FROM public."Account"
            WHERE "id" = "AccountTerms"."accountId"
          )
        )
        WITH CHECK (
          auth.uid() = (
            SELECT "userId"
            FROM public."Account"
            WHERE "id" = "AccountTerms"."accountId"
          )
        )
    $body$;

  END IF;
END
$outer$;
