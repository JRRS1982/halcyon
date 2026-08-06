# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Halcyon is a personal finance web app built as a learning project. The build process, stack choices, and roadmap follow `docs/Playbook.md`; technical decisions are recorded as ADRs in `docs/ADRs/`. Treat those documents as the source of truth when behavior or architecture is unclear — do not invent patterns that contradict them.

Companion AI context lives in `.ai/`:

- `.ai/code-style.md` — coding conventions (early returns, self-documenting code, minimal dependencies)
- `.ai/typescript.md` — TypeScript practices (derive types from zod/Prisma, `satisfies` over `as`, no enums, discriminated unions)
- `.ai/review-guidelines.md` — review checklist (security-sensitive code, hard-coded secrets, dependency justification)

## Stack

Full-stack Next.js 16 (App Router, React 19) on TypeScript, hosted on **Vercel**. Postgres via **Supabase** (managed) with Prisma as the ORM. **Supabase Auth** (via `@supabase/ssr`) for authentication. styled-components for styling, zod for runtime validation. Redux Toolkit is installed but not yet wired — client state is currently server-driven plus local React state. Biome handles both lint and format (no ESLint/Prettier). Jest + React Testing Library for unit; Playwright for E2E. pnpm is the package manager. See `docs/ADRs/ADR-001-TechStackSelection.md` for rationale.

The app is well past scaffold stage — the core features are built, shipped to production, and tested. **Feature map** — each feature lives under `src/app/<feature>/` (route + `page.tsx` + colocated `actions.ts` server actions), with pure logic in `src/lib/<feature>/`:

- `dashboard/` — reporting charts (balance trend, cash flow, category expenditure, balance-by-category); `src/lib/dashboard/`
- `budget/` — per-period income/expense sheet (budgeted vs actual) plus a transfers panel; `src/lib/budget/`
- `balance/` — per-period assets/liabilities/net-worth sheet; `src/lib/balance/`
- `transactions/` — ledger, CSV import (dedupe + reversible batches), categorize; feature-gated by a Settings toggle; `src/lib/transactions/`
- `settings/` — preferences, chart visibility, category management, account management, transactions/transfers toggles, and data export / account deletion (`DataPrivacy`); `src/lib/settings/`
- `sign-in/`, `sign-up/`, `auth/callback/` — Supabase Auth pages + OAuth callback; shared UI in `src/components/auth/`
- marketing landing page (`page.tsx` → `src/components/marketing/`), plus `privacy/` and `terms/` public pages

Shared UI primitives are in `src/components/ui/` (Button, Card, NavBar, …) and the spreadsheet-style grid in `src/components/sheet/`. The Prisma schema has 17 models — the eleven core ones (User, UserSettings, FinancialPeriod, FinancialItem, BalanceItem, BudgetTemplateItem, BalanceTemplateItem, Category, Account, ImportBatch, Transaction), documented in `docs/DataModels/DataModels.md`, plus the six the Plan feature owns (Plan, PlanAsset, PlanLiability, PlanIncome, PlanExpense, PlanEvent), which that document does not yet cover. ADR-001/002 describe the intended architecture; the feature map above is what's actually built.

## Common commands

Local (pnpm):

- `pnpm dev` — Next dev server on :3210
- `pnpm build` / `pnpm start` — production build / run
- `pnpm lint` / `pnpm lint:fix` / `pnpm format` — Biome (lint = `biome check .`, covers both lint and format check)
- `pnpm check` — `biome ci .` (stricter; what CI runs)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm verify` — `typecheck && check && test` (full local pre-flight)
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` — Jest
- `pnpm test:e2e` / `pnpm test:e2e:ui` — Playwright. Spins up a mock Supabase Auth server (`e2e/_mock/supabase.mjs` on `:54321`) and a dedicated Next.js dev server on `:3100`, so it coexists with your own `pnpm dev` on `:3210`. Needs `sudo npx playwright install-deps` once. No real DB touched.
- `pnpm db:seed` / `pnpm db:reset` — Prisma seed / reset+seed
- `postinstall` runs `prisma generate && simple-git-hooks` (installs the `pre-push: pnpm check` hook)

Single test (Make wrappers pass through a name filter):

- `make test name=<pattern>` — Jest `--testNamePattern`
- `make test-watch name=<pattern>` — same in watch
- `make test-e2e name=<pattern>` — Playwright `--grep`

Docker workflow (Make is the primary interface — `make` alone runs `down` then `up`, a bare attached start; `make build` does the full from-scratch setup: rebuild images, start detached, migrate, seed, then tail logs):

- `make up` / `make down` / `make rebuild` / `make logs` / `make shell` / `make clean`
- `make db-shell` — `psql` into the `halcyon` DB
- `make db-seed` / `make db-reset` — runs `prisma migrate deploy`/`reset` then `prisma/seed.ts` inside the app container
- `make migrate-create name=<verb_table>` — `prisma migrate dev --name <name>`; authors a new migration (name required, should start with a verb)
- `make migrate-deploy` — `prisma migrate deploy` to apply all pending migrations to the local DB, then regenerates the client and restarts the app (via `prisma-generate`) so the running app matches the schema. Run after pulling/adding migrations. Unlike the CI/prod `prisma migrate deploy` step, the local target also regenerates + restarts (a local-only convenience — prod rebuilds the client from scratch on every deploy, so it can't go stale there).
- `make prisma-generate` — `prisma generate` inside the container, then restarts the app. Standalone fix for when the running app loads a stale client after a schema change (symptom: Prisma `Unknown argument <field>` at runtime even though the column exists and migrations are applied). `migrate-deploy` and `migrate-create` both call/perform this for you; use it directly when the client is stale but no migration needs applying.
- `make lint-and-format` — `pnpm lint:fix && pnpm format`

There is no longer a self-hosted production setup — `Dockerfile.prod`, `compose.prod.yaml`, the `make prod-*` targets, and `.github/workflows/deploy.yml` were removed when production moved to Vercel.

## Architecture notes

- **Next.js App Router** is the whole app: server components, route handlers, and middleware all live under `src/app/`. There is no separate backend service — "backend" means route handlers + server components + Next middleware. Next middleware enforces route protection by reading the Supabase session cookie.
- **Path alias**: `@/*` → `src/*` (configured in both `tsconfig.json` and `jest.config.ts`).
- **Data access**: Prisma is the ORM. Schema in `prisma/schema.prisma`, migrations in `prisma/migrations/`. In production Prisma talks to Supabase Postgres via two URLs — `DATABASE_URL` (pooled, port 6543, runtime) and `DIRECT_URL` (direct, port 5432, migrations). See ADR-003.
  - **⚠️ Local vs prod DB trap**: two DBs exist — local Postgres (Docker `db`) and prod Supabase — but no local env file holds prod DB URLs (those live only in Vercel env vars and CI secrets). `.env.development` (committed) pins the local DB for host `pnpm dev`; `compose.yaml` pins it for the container; the gitignored `.env` holds only Supabase auth values (there is no `.env.local`). The Prisma CLI loads no env file at all (`prisma.config.ts`), so a stray host `pnpm prisma migrate` fails loudly instead of touching anything. **Run migrations only inside the container** (`make migrate-create name=<verb_table>` to author, `make migrate-deploy` to apply pending). See README → "Which database am I hitting?".
- **Authorization model** (per ADR-002): server-side Prisma queries connect with a role that bypasses Postgres RLS, so **app-level `userId` filtering is the primary boundary**. RLS policies are defined as defence-in-depth — they only become the real fence if a future feature queries Supabase directly from the client. When adding user-owned models, write both the `userId` filter and the RLS policy.
- **Auth model** (per ADR-002): Supabase Auth owns passwords, email verification, OAuth, and brute-force throttling. Don't reintroduce bcrypt, lockout counters, or session-rotation logic in the app — those are Supabase's job. `@supabase/ssr` is the integration layer between Supabase Auth and Next.js cookies. Sequence diagrams for sign-up / sign-in / sign-out and the file-by-file code map are in [`docs/features/auth.md`](docs/features/auth.md).
- **Validation boundary**: zod schemas validate API inputs and env vars (`src/lib/env.ts`, run at server startup via `src/instrumentation.ts`). Don't bypass them when adding routes.
- **Testing layout**:
  - Jest runs against `src/` only — `jest.config.ts` excludes `e2e/` and `.next/` from both test discovery and coverage.
  - Playwright tests live in `e2e/`. Auth tests use a mock Supabase Auth server (`e2e/_mock/supabase.mjs`) rather than a real Supabase project. `playwright.config.ts` runs the mock + a Next.js dev server on port `3100` with env vars pointing at the mock (so it doesn't accidentally hit production).
  - Real Postgres is **not** mocked. Prisma-touching **integration tests** (`*.int.test.ts`, node env, `jest.integration.config.ts`, run via `pnpm test:int`) execute the real server actions against a real `halcyon_test` database — only the Supabase auth boundary + next cache/navigation are mocked. The unit run excludes `*.int.test.ts`. `pnpm test:int` pins `DATABASE_URL` at `halcyon_test` with a hard guard; never point it at a real DB.
- **CI/CD**: GitHub Actions `.github/workflows/ci.yml` has four jobs:
  - `lint-and-test` — `pnpm check`, `pnpm typecheck`, `pnpm test:coverage`
  - `integration-tests` — `pnpm test:int` against a Postgres service (`postgres/postgres`, `halcyon_test`)
  - `e2e-tests` — `playwright install --with-deps chromium`, `pnpm test:e2e`, backed by a Postgres service (`test/test`, `halcyon_test`) + the mock Supabase auth server
  - `migrate-prod` — on push to `master` only, gated on the three above; runs `prisma migrate deploy` against production Supabase (`PROD_DIRECT_URL` secret). Vercel waits for this workflow before deploying, so code never goes live against an un-migrated schema. Rollback is one-click in the Vercel dashboard.
- **Merging PRs**: the repo is private on the GitHub Free plan, so there is no branch protection — nothing forces CI to pass before merge, and `gh pr merge --auto` merges *immediately* (auto-merge only waits when checks are required). Always wait for green checks before merging: `gh pr checks <n> --watch`, then `gh pr merge <n> --merge --delete-branch`. Never use `--auto`.

## Code style (from .ai/code-style.md)

- Prefer pure functions and self-documenting names over comments.
- Use early returns instead of nested conditionals.
- Keep changes minimal when editing existing code; don't refactor or "clean up" unless asked.
- Don't add features that weren't requested.
- Justify any new external dependency against long-term maintenance cost.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
