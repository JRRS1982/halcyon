# ADR-004: Secret Management

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-12-05
- Last revised: 2026-07-24 — dropped the planned `.env.local`; the gitignored `.env` is the single local secrets file (it is the only file Docker Compose can interpolate `${...}` from). Startup env validation implemented in `src/lib/env.ts`.
- Decision maker: @jrrs1982

## Context

The application requires secure management of sensitive configuration values (database credentials, Supabase keys, OAuth client secrets) across development, test, and production environments.

Next.js loads environment files in the form `.env.{NODE_ENV}` for the matching environment, plus a base `.env`. Docker Compose interpolates `${...}` in `compose.yaml` only from a file literally named `.env` — which is why local secrets live there rather than in a `.env.local`.

## Decision

A tiered approach by environment:

1. **Local development** — `.env.development` checked into the repo for non-secret defaults (the local Docker Postgres URL). Secrets (the Supabase URL/keys) go in the gitignored `.env` — never DB URLs, so no local file can point tooling at production. Docker Compose `environment` blocks in `compose.yaml` provide DB connection strings for the dev container and forward the Supabase values from `.env`.
2. **Test** — `.env.test` + `environment` blocks in `compose.test.yaml`. The test DB is ephemeral (tmpfs) so credentials there are not sensitive.
3. **Production** — **Vercel project environment variables**, configured via the Vercel dashboard. They are injected at build time and runtime; never read from a file in production.

### Required env vars

Documented in `.env.example` (no values):

- `DATABASE_URL` — Supabase pooled connection (port 6543), used by the app at runtime
- `DIRECT_URL` — Supabase direct connection (port 5432), used by Prisma for migrations
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (safe to expose to the browser by design)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key, `sb_publishable_…` (safe to expose by design; RLS enforces what it can do)
- `SUPABASE_SECRET_KEY` — Supabase secret key, `sb_secret_…` (**server-only**; bypasses RLS — never expose to the client)
- `NODE_ENV` — set automatically by Next.js / Vercel; do not override in production

### Rules

- Secrets are never committed to version control. `.env` and any file with real secrets are gitignored.
- `.env.example` documents required env vars without values and is committed.
- `NEXT_PUBLIC_*` env vars are inlined into client bundles at build time — never put a secret behind this prefix.
- `SUPABASE_SECRET_KEY` is only used in server components, route handlers, and server actions; it must never appear in a `'use client'` file or a `NEXT_PUBLIC_*` variable.
- Validate all env vars with zod at app startup (`src/lib/env.ts`) so missing/malformed values fail loudly.

## Considered Alternatives

- **`.env.production` committed with placeholder values** — rejected; Vercel is now the source of truth for production env vars. Keeping a checked-in production env file invites drift and accidental real-value leaks.
- **A secrets manager (Doppler, Infisical, Vault)** — overkill for a personal project with one production environment.

## Implementation

- Production secrets are configured directly in the Vercel project's Environment Variables settings.
- Local dev secrets are configured in `.env` (gitignored).
- `.env.example` is the contract for what variables must be set.
- A zod schema in `src/lib/env.ts` validates `process.env` on first import; `src/instrumentation.ts` triggers it at server startup so missing/malformed values fail the boot loudly.
