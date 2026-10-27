# Row Level Security

**What:** Postgres RLS policies as defence-in-depth; the primary fence is `userId` filtering in every Prisma query.  
**Key points:**
- App Prisma role bypasses RLS — app-level `userId` filters are the real boundary (per ADR-002)
- RLS policies fire only on the Supabase Data API (PostgREST); the app does not use it, but it is reachable
- Since `20261012090000_restrict_data_api_writes`, `anon` and `authenticated` hold `SELECT` only on every user-owned table
- When adding a user-owned model: write the Prisma `userId` filter, the RLS policy, and the write revoke
- `ENABLE ROW LEVEL SECURITY` on the table alone is not enough — also needs a policy, or all rows are blocked

How user data is fenced at the database level, why the app doesn't notice, and
what you must do by hand when adding a table.

Companion to [ADR-002 (Security Architecture)](../adrs/adr-002-security-architecture.md),
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

Door 2 is live on this project: `https://<ref>.supabase.co/rest/v1/` answers
requests. It never runs application code, so only the database can protect it.

## The roles, and where `auth.uid()` comes from

| Role | Who it is | RLS applies? |
| --- | --- | --- |
| `postgres` (and the pooled runtime role) | What Prisma connects as, via `DATABASE_URL` / `DIRECT_URL` | **No** — bypassed |
| `anon` | Any HTTP caller presenting the publishable key, not signed in | Yes |
| `authenticated` | Any signed-in Supabase Auth user — *any* user, not just the row's owner | Yes |

`authenticated` means "some logged-in user", not "the row's owner". Being signed
in gets you through the `GRANT`; RLS decides *which rows* you get.

RLS decides with `auth.uid()`, a Supabase function that reads the user id from
the request's JWT. A policy of `auth.uid() = "userId"` resolves, per request, to
"the rows owned by the caller". The app path has no equivalent, so Door 1 relies
on explicit filters.

**Supabase grants wide by default.** A new table in the `public` schema grants
all privileges to both `anon` and `authenticated`. A `GRANT` is table-wide: hold
one, and absent RLS you see *every row*. Two locks therefore guard Door 2:

- **RLS policies** scope reads to the caller's own rows.
- **Write revokes** remove `INSERT`, `UPDATE` and `DELETE` from `anon` and
  `authenticated`. A policy answers "whose rows?", never "may you write at all?",
  so without the revoke a signed-in user could post rows straight to
  `/rest/v1/<table>` and bypass every cap the app enforces. The app never writes
  that way (`supabase.auth` only, no `.from()` in `src/`), so
  `20261012090000_restrict_data_api_writes` revoked writes on all 17 tables in one
  loop. `SELECT` stays.

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

`tests/unit/schema.rls.test.ts` fails the build if any model in `schema.prisma`
lacks any of: `ENABLE ROW LEVEL SECURITY`, a `CREATE POLICY`, or a
`REVOKE INSERT, UPDATE, DELETE ... FROM anon, authenticated`, found anywhere in
`prisma/migrations/`. It accepts the revoke either as its own statement or in
the name array of the bulk migration.

It is deliberately static — it reads the migration SQL rather than querying
Postgres — because the RLS blocks are skipped on the local database (see below),
so a live `pg_tables` assertion could never pass locally.

## Adding a table: the checklist

Four things. The guard fails loudly on steps 2 and 3 if you forget them.

1. The `userId` filter in every Prisma query (Door 1).
2. An RLS policy in the migration (Door 2).
3. A write revoke in the same migration (Door 2).
4. `pnpm test` runs the guard.

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

    EXECUTE $body$REVOKE INSERT, UPDATE, DELETE ON public."YourTable" FROM anon, authenticated$body$;

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

- [ADR-002 — Security Architecture](../adrs/adr-002-security-architecture.md)
- [Auth flow and sequence diagrams](../features/auth.md)
- [Data models](../data-models/data-models.md)
