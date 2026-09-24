-- Add explicit WITH CHECK clauses to the six Plan-family RLS policies.
--
-- PostgreSQL's FOR ALL implicitly uses the USING predicate for write checks,
-- so cross-user INSERTs/UPDATEs are blocked today — but the protection is
-- invisible to reviewers and disappears silently if a policy is ever split
-- into separate FOR INSERT / FOR UPDATE commands. Stating it explicitly keeps
-- the write-side guard visible and stable.
--
-- Guarded by an auth-schema check: the CI test database is a bare Postgres
-- container with no Supabase auth extension, so auth.uid() would fail there.
-- The guard makes this a no-op in CI while applying correctly in Supabase.

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.schemata WHERE schema_name = 'auth'
  ) THEN
    ALTER POLICY "plan_owner" ON public."Plan"
      USING  (auth.uid() = "userId")
      WITH CHECK (auth.uid() = "userId");

    ALTER POLICY "planasset_owner" ON public."PlanAsset"
      USING  (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanAsset"."planId"    AND p."userId" = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanAsset"."planId" AND p."userId" = auth.uid()));

    ALTER POLICY "planliability_owner" ON public."PlanLiability"
      USING  (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanLiability"."planId"    AND p."userId" = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanLiability"."planId" AND p."userId" = auth.uid()));

    ALTER POLICY "planincome_owner" ON public."PlanIncome"
      USING  (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanIncome"."planId"    AND p."userId" = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanIncome"."planId" AND p."userId" = auth.uid()));

    ALTER POLICY "planexpense_owner" ON public."PlanExpense"
      USING  (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanExpense"."planId"    AND p."userId" = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanExpense"."planId" AND p."userId" = auth.uid()));

    ALTER POLICY "planevent_owner" ON public."PlanEvent"
      USING  (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanEvent"."planId"    AND p."userId" = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM "Plan" p WHERE p.id = "PlanEvent"."planId" AND p."userId" = auth.uid()));
  END IF;
END $$;
