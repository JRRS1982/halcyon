# Row Level Security

How user data is fenced at the database level, why the app doesn't notice, and
what you must do by hand when adding a table.

Companion to [ADR-002 (Security Architecture)](../ADRs/ADR-002-SecurityArchitecture.md),
which sets the policy; this document is the working detail.

## Two doors into the same tables

The Postgres tables are reachable by two independent paths, and only one of them
runs your application code.

```
┌─ Door 1: the app ──────────────────────────────────────────────┐
│ browser → Next.js (server components / actions) → Prisma → DB  │
│ connects as a privileged role → BYPASSES RLS                   │
│ fence = the `userId` filter you write in every query           │
└────────────────────────────────────────────────────────────────┘

┌─ Door 2: the Supabase Data API ────────────────────────────────┐
│ any HTTP client + publishable key → PostgREST → DB             │
│ connects as `anon` or `authenticated` → RLS IS ENFORCED        │
│ fence = RLS policies, and nothing else                         │
└────────────────────────────────────────────────────────────────┘
```

Door 2 is live on this project — `https://<ref>.supabase.co/rest/v1/` answers
requests. It never touches this repo, so no amount of application-side care
protects it.

## The roles, and where `auth.uid()` comes from

| Role | Who it is | RLS applies? |
| --- | --- | --- |
| `postgres` (and the pooled runtime role) | What Prisma connects as, via `DATABASE_URL` / `DIRECT_URL` | **No** — bypassed |
| `anon` | Any HTTP caller presenting the publishable key, not signed in | Yes |
| `authenticated` | Any signed-in Supabase Auth user — *any* user, not just the row's owner | Yes |

Note what `authenticated` means: it is not "the right user", it is "some logged-in
user". Being signed in gets you through the `GRANT`; it is RLS that decides
*which rows* you get.

That decision is made by `auth.uid()`, a Supabase-provided function which reads
the user id out of the request's JWT. So a policy of `auth.uid() = "userId"`
resolves, per request, to "the rows whose owner is the caller". There is no
equivalent inside the app path, which is why Door 1 relies on explicit filters
instead.

**Grants are wide open by default.** Every table in the `public` schema grants
all privileges to both `anon` and `authenticated`. A `GRANT` is table-wide: hold
one, and absent RLS you see and can modify *every row*. RLS is therefore not
belt-and-braces for Door 2 — it is the only lock on it.

## Why a missing policy is invisible

Prisma cannot express RLS. `prisma migrate dev` generates DDL from
`schema.prisma`, which has no concept of policies, so **every RLS block in
`prisma/migrations/` was hand-written into the generated SQL afterwards.**

Because Door 1 bypasses RLS, a table with no policy behaves *identically* in
every unit test, every integration test, and every page. Nothing errors. The app
is perfectly happy. The only observer is Door 2.

That is exactly how `Transaction`, `Account`, `Category` and `ImportBatch`
shipped with app-level filtering but no policy — caught later by a Supabase
advisor warning and backfilled in
`prisma/migrations/20260729080000_enable_rls_transactions_tables/`.

## The regression guard

`src/__tests__/security/rls.test.ts` fails the build if any model in
`schema.prisma` has no `ENABLE ROW LEVEL SECURITY` **and** no `CREATE POLICY`
anywhere in `prisma/migrations/`.

It is deliberately static — it reads the migration SQL rather than querying
Postgres — because the RLS blocks are skipped on the local database (see below),
so a live `pg_tables` assertion could never pass locally.

## Adding a table: the checklist

Three things, and the first two are easy to remember because the third fails
loudly if you forget them.

1. The `userId` filter in every Prisma query (Door 1).
2. An RLS policy in the migration (Door 2).
3. `pnpm test` — the guard above tells you if step 2 is missing.

Author the migration as usual (`make migrate-create name=<verb_table>`), then
append a block to the generated `migration.sql`. For a table with a direct
`userId`:

```sql
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    EXECUTE $body$ALTER TABLE public."YourTable" ENABLE ROW LEVEL SECURITY$body$;

    EXECUTE $body$DROP POLICY IF EXISTS "users_own_your_things" ON public."YourTable"$body$;
    EXECUTE $body$
      CREATE POLICY "users_own_your_things" ON public."YourTable"
        FOR ALL
        USING (auth.uid() = "userId")
        WITH CHECK (auth.uid() = "userId")
    $body$;

  END IF;
END
$outer$;
```

`USING` filters what you can read; `WITH CHECK` stops you writing a row owned by
someone else. Both are needed — omit `WITH CHECK` and a caller can forge rows
under another user's id.

If ownership is indirect, walk the foreign key instead of comparing a column —
see `BalanceItem` in `20260526172728_balance_items/migration.sql`, which resolves
its owner through `FinancialPeriod`.

### The `auth` schema guard

Every block is wrapped in `IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname =
'auth')`. The local Docker Postgres has no Supabase auth and therefore no
`auth.uid()`, so the statements would fail there. The guard makes them a no-op
locally and live in Supabase. Keep it.

## Verifying for real

The guard proves a policy *exists*; it cannot prove the policy is *correct*. To
check behaviour, stand up a scratch database that mimics Supabase — a stub
`auth.uid()` reading a session variable, plus `anon`/`authenticated` roles — then
`SET ROLE authenticated` and confirm that one user cannot read, delete, or forge
another's rows. The backfill migration above was validated exactly this way:
owner sees 1 of 2 rows, cross-user `DELETE` affects nothing, and a forged
`INSERT` is rejected by `WITH CHECK`.

## Related

- [ADR-002 — Security Architecture](../ADRs/ADR-002-SecurityArchitecture.md)
- [Auth flow and sequence diagrams](auth.md)
- [Data models](../DataModels/DataModels.md)
