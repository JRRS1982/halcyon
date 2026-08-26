-- Rename FinancialItem to BudgetItem.
--
-- A pure rename, no behaviour change. FinancialItem read like the general case
-- of which BalanceItem was a specialisation; they are siblings. A budget row is
-- a flow (sums across months, has budget and actual), a balance row is a stock
-- (never summed, take the latest). Naming the budget row for what it is.
--
-- No @@map: the table itself moves, so the schema and the database keep saying
-- the same word.
--
-- prisma migrate dev cannot author this — it sees a drop and a create — so it
-- is hand-written and applied with `make migrate-deploy`.
--
-- Postgres carries the old names through a table rename, so every constraint
-- and index is renamed too, to exactly what Prisma would now generate. Without
-- that the next `prisma migrate dev` reports drift. The list is the full
-- contents of `\d "FinancialItem"`: one primary key, three foreign keys, three
-- indexes. There is no userId column here — a row reaches its owner through
-- its period — so there is no userId foreign key to rename.
--
-- Postgres carries the RLS policy across the rename on its own — the expression
-- is stored as a parse tree bound to the table's OID — but the repo's rule
-- (src/__tests__/security/rls.test.ts) is that every table's RLS is declared in
-- migration SQL under its current name, because that text is the only place the
-- manual step is visible. The block at the end re-declares it; both statements
-- are no-ops in effect, and are skipped entirely where no `auth` schema exists
-- (local Docker Postgres), exactly as the original block was.

ALTER TABLE "FinancialItem" RENAME TO "BudgetItem";

ALTER TABLE "BudgetItem" RENAME CONSTRAINT "FinancialItem_pkey" TO "BudgetItem_pkey";
ALTER TABLE "BudgetItem" RENAME CONSTRAINT "FinancialItem_periodId_fkey" TO "BudgetItem_periodId_fkey";
ALTER TABLE "BudgetItem" RENAME CONSTRAINT "FinancialItem_categoryId_fkey" TO "BudgetItem_categoryId_fkey";
ALTER TABLE "BudgetItem" RENAME CONSTRAINT "FinancialItem_accountId_fkey" TO "BudgetItem_accountId_fkey";

ALTER INDEX "FinancialItem_periodId_type_sortOrder_idx" RENAME TO "BudgetItem_periodId_type_sortOrder_idx";
ALTER INDEX "FinancialItem_categoryId_idx" RENAME TO "BudgetItem_categoryId_idx";
ALTER INDEX "FinancialItem_accountId_idx" RENAME TO "BudgetItem_accountId_idx";

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    -- BudgetItem: a row is yours iff its period is yours. Unchanged in
    -- substance from the policy of the same name on FinancialItem; restated
    -- against the new table name.
    EXECUTE $body$ALTER TABLE public."BudgetItem" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_items" ON public."BudgetItem"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_items" ON public."BudgetItem"
        FOR ALL
        USING (
          auth.uid() = (
            SELECT "userId"
            FROM public."FinancialPeriod"
            WHERE "id" = "BudgetItem"."periodId"
          )
        )
        WITH CHECK (
          auth.uid() = (
            SELECT "userId"
            FROM public."FinancialPeriod"
            WHERE "id" = "BudgetItem"."periodId"
          )
        )
    $body$;

  END IF;
END
$outer$;
