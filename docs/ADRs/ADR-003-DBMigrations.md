# ADR-003: DB Migrations

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-12-05
- Last revised: 2026-05-22 — added the Supabase-specific connection-string split (pooled `DATABASE_URL` for runtime, direct `DIRECT_URL` for migrations).
- Decision maker: @jrrs1982

## Context

I am setting up the database migration scripts and would like to document my preference for not having a rollback script, as Prisma does not support it. Manual SQL would be required for each rollback, and forward-only migrations are safer as they are less error-prone.

Since [ADR-001](ADR-001-TechStackSelection.md) was revised, production runs on Supabase managed Postgres. Supabase exposes the database via two connection strings:

- **Pooled** (port 6543, PgBouncer in transaction mode) — used by the app at runtime as `DATABASE_URL`. Required for serverless on Vercel.
- **Direct** (port 5432) — used by Prisma for migrations as `DIRECT_URL`. Prisma migrations need a session-mode connection because they use advisory locks and `CREATE TYPE` / DDL that PgBouncer's transaction mode doesn't support.

`prisma/schema.prisma` should declare both via the `datasource db` block:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

(The current schema only declares `url`; adding `directUrl` is a pending follow-up to be done alongside the Supabase migration.)

## Decision

- **No rollback scripts.** Forward-only migrations only.
- **Prisma migrations** are the single tool — both for the local Docker Postgres and for Supabase Postgres. Supabase's own migration tool (`supabase db push`) is **not** used; Prisma owns the schema.
- **CI** runs `prisma migrate deploy` against the database before E2E tests.
- **Production migrations** are applied as part of Vercel's build step (or manually via `pnpm exec prisma migrate deploy` against `DIRECT_URL`). The exact wiring is tracked separately.
- **RLS policies** that accompany schema changes go into Prisma migrations as raw SQL (see [ADR-002](ADR-002-SecurityArchitecture.md)).

## Considered Alternatives

- **Having a rollback script** — rejected; see Context.
- **Supabase migrations (`supabase db push` / `supabase migration new`)** — rejected. Splitting schema ownership between Prisma and the Supabase CLI creates two sources of truth; sticking with Prisma keeps one tool. Trade-off: Supabase's UI-generated migrations (made via the dashboard) won't auto-sync, so all schema changes must come from a Prisma migration.

### Consequences

- **Good**: Forward-only migrations are safer and force me to think carefully before writing one.
- **Good**: Single migration tool across local dev and prod keeps cognitive load low.
- **Bad**: No rollback script — fixing a bad migration requires a new forward migration.
- **Bad**: Schema changes made in the Supabase dashboard will drift unless captured in a Prisma migration. Mitigation: avoid using the dashboard for schema work.
