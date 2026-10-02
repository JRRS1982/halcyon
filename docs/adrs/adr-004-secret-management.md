# ADR-004: Secret Management

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-12-05
- Last revised: 2026-09-28 — replaced the stale required-vars list with a pointer to the inventory in `.env.example`; test tier no longer uses `.env.test`. Earlier (2026-07-24): dropped the planned `.env.local`; the gitignored `.env` is the single local secrets file (it is the only file Docker Compose can interpolate `${...}` from). Startup env validation implemented in `src/lib/env.ts`.
- Decision maker: @jrrs1982

**Decision:** Gitignored `.env` for local secrets (Docker Compose constraint); Vercel env vars for production; startup validation via `src/lib/env.ts` catches missing values at boot.

## Context

The application requires secure management of sensitive configuration values (database credentials, Supabase keys, OAuth client secrets) across development, test, and production environments.

Next.js loads environment files in the form `.env.{NODE_ENV}` for the matching environment, plus a base `.env`. Docker Compose interpolates `${...}` in `compose.yaml` only from a file literally named `.env` — which is why local secrets live there rather than in a `.env.local`.

## Decision

A tiered approach by environment:

1. **Local development** — `.env.development` checked into the repo for non-secret defaults (the local Docker Postgres URL). Secrets (the Supabase URL/keys) go in the gitignored `.env` — never DB URLs, so no local file can point tooling at production. Docker Compose `environment` blocks in `compose.yaml` provide DB connection strings for the dev container and forward the Supabase values from `.env`.
2. **Test** — no env file. `playwright.config.ts` injects a mock Supabase and dummy keys; the `test:integration` script and CI job `env` blocks pin the disposable `halcyon_test` database, so no credential there is sensitive.
3. **Production** — **Vercel project environment variables**, configured via the Vercel dashboard. They are injected at build time and runtime; never read from a file in production.

### Where each variable is set

[`.env.example`](../../.env.example) is both the template for the local `.env` and the per-environment inventory: every variable, which dashboard or file sets it, and why. DB URLs appear only in that inventory, never as template lines.

### Rules

- Secrets are never committed to version control. `.env` and any file with real secrets are gitignored.
- `.env.example` documents what a local `.env` holds, without values, and is committed.
- `NEXT_PUBLIC_*` env vars are inlined into client bundles at build time — never put a secret behind this prefix.
- `SUPABASE_SECRET_KEY` is only used in server components, route handlers, and server actions; it must never appear in a `'use client'` file or a `NEXT_PUBLIC_*` variable.
- Validate all env vars with zod at app startup (`src/lib/env.ts`) so missing/malformed values fail loudly.

## Considered Alternatives

- **`.env.production` committed with placeholder values** — rejected; Vercel is now the source of truth for production env vars. Keeping a checked-in production env file invites drift and accidental real-value leaks.
- **A secrets manager (Doppler, Infisical, Vault)** — overkill for a personal project with one production environment.

## Implementation

- Production secrets are configured directly in the Vercel project's Environment Variables settings.
- Local dev secrets are configured in `.env` (gitignored).
- `.env.example` is the inventory of what is set where, and the template for the local `.env`.
- A zod schema in `src/lib/env.ts` validates `process.env` on first import; `src/instrumentation.ts` triggers it at server startup so missing/malformed values fail the boot loudly.
