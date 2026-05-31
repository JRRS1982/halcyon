# Halcyon

[![CI](https://github.com/JRRS1982/halcyon/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/JRRS1982/halcyon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

This is a web application for managing personal finance, built to be easy to use and understand.

Please see the [Playbook](docs/Playbook.md) for more information on the project, along with the [docs](docs/) directory for more information on the architecture and design.

## Deployment

- **Development**: <http://localhost:3000/> (`pnpm dev` or `make dev-up`).
- **Production**: <https://halcyon-silk.vercel.app>.
- **Hosting**: [Vercel](https://vercel.com) runs the Next.js app (App Router server components + route handlers + middleware). [Supabase](https://supabase.com) provides managed Postgres and Auth. See [ADR-001](docs/ADRs/ADR-001-TechStackSelection.md) for the rationale.
- **Pipeline**: pushes to `master` trigger GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) which runs `biome ci`, `tsc --noEmit`, Jest, and Playwright on Node 22 + pnpm 10. Vercel watches `master` independently and ships the build to production once its own build passes.
- **Database migrations**: applied by GitHub Actions, not by the host. The `migrate-prod` job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `prisma migrate deploy` against the production `DIRECT_URL` (unpooled Supabase connection, port 5432, supplied via the `PROD_DIRECT_URL` repo secret) — but only on push to `master` and only after lint/test + e2e pass. Vercel is configured to wait for this workflow before deploying, so the new code never goes live against an un-migrated schema. Migrations are forward-only; to undo, write a corrective migration. Manual fallback: `pnpm exec prisma migrate deploy` with `DIRECT_URL` set.
- **Rollback**: one click in the Vercel dashboard (it keeps every previous build immutable). Pair with a corrective DB migration if a release introduced a schema change.
- **Secrets**: managed in the Vercel project settings, not committed. The repo's `.env.example` lists every variable the app reads. See [ADR-004](docs/ADRs/ADR-004-SecretManagement.md).

## Setup

Install dependencies with pnpm, then run the app **in Docker** for local development (this is what points it at the local database — see below):

```bash
  pnpm install      # install dependencies
  make dev-up       # build + run the app and local Postgres in Docker (http://localhost:3000)
```

### Commands — `make` vs `pnpm`

- **`make` for the app + the database** (runs inside Docker, against local Postgres): `make dev-up` / `make dev-down` / `make dev-build`, `make dev-db-migrate name=<verb_table>`, `make dev-db-reset`, `make dev-db-seed`, `make dev-db-shell`.
- **`pnpm` for stateless checks** (faster, and what CI runs): `pnpm typecheck`, `pnpm check` (lint+format), `pnpm test`, `pnpm build`, `pnpm verify`.
- **Migrations: always `make dev-db-migrate`, never host `pnpm prisma …`** — see the gotcha below.

### Which database am I hitting?

Two databases exist: **local Postgres** (the Docker `db` service) and **production Supabase**. Which one a command uses comes down to env-file values *and* which tool reads them. With `.env.local` pointing at the local DB (the recommended local setup), it shakes out as:

| Command | Reads | Hits |
| --- | --- | --- |
| App in Docker — `make dev-up` | `compose.yaml` env (local) | **local** |
| App on host — `pnpm dev` (Next.js) | `.env.local` → `.env.development` → `.env` | **local** |
| **Prisma CLI on host — `pnpm prisma …`** | **`.env` only** | **production ⚠️** |

The gotcha: **Next.js reads `.env.local` first** (which we set to the local DB), so `pnpm dev` is local — but the **Prisma CLI reads only `.env`** (it ignores `.env.local`), and `.env` holds the **production** Supabase URLs. So host `pnpm prisma migrate`/seed quietly target **production**. Always run migrations with **`make dev-db-migrate`** (in-container → local).

So it only hits prod when a tool falls back to `.env`. To make the host app hit production deliberately, comment the local URLs out of `.env.local`. (These files are gitignored — set them from `.env.example`.)

## Documentation

I have done my best, with the support of AI to put a comprehensive set of documents in place to help me and others understand the project and its architecture.

- [Tech Stack](docs/ADRs/ADR-001-TechStackSelection.md)
- [Playbook](docs/Playbook.md)
- [Data Models](docs/DataModels/)
- [Design Decisions](docs/DesignDecisions/)
- [Security Architecture](docs/ADRs/ADR-002-SecurityArchitecture.md)
- [Auth Flow (sequence diagrams)](docs/AuthFlow.md)
- [User Personas](docs/UserPersonas.md)
- [User Journeys](docs/UserJourney.md)
- [Stakeholder Mapping](docs/StakeholderMapping.md)
- [Success Metrics](docs/SuccessMetrics.md)
- [Data Privacy Statement](docs/DataPrivacyStatement.md)
- [Design System (DESIGN.md)](DESIGN.md)
- [Accessibility Standards](docs/AccessibilityStandards.md)

## Demo

Insert gif or link to a demo of the project.

## Testing

The unit tests run against the code in the `src/` directory, rather than the container code, which improved the speed and reliability of the tests. In other projects i have worked on, running tests against the container code was a common source of frustration.

### Unit tests

To run the unit tests, use the following command: `pnpm test`, or one of the helpers listed below:

- `make test`
- `make test-watch`
- `make test-coverage`

### End to end tests (E2E)

Run the tests locally:

1. Install browser system deps once: `sudo npx playwright install-deps`.
2. Install the project deps: `pnpm install`.
3. Run the tests: `pnpm test:e2e` (or `pnpm test:e2e:ui` for the UI runner).

Playwright spins up two webservers automatically:

- a **mock Supabase Auth server** on `localhost:54321` (see [`e2e/_mock/supabase.mjs`](e2e/_mock/supabase.mjs))
- a **Next.js dev server** on `localhost:3100` (the deliberately-different port lets the test server coexist with a developer's own `pnpm dev` on `:3000`)

No real Supabase project or database is touched during E2E. Coverage and approach are documented in [`docs/AuthFlow.md`](docs/AuthFlow.md#e2e-test-coverage).

### Database Seeding

To seed the local development database, use the following command: `pnpm db:seed`, or one of the helpers listed below to seed and reset the database in the container.

- `make db-seed`
- `make db-reset`

## Contributing

Contributions are always welcome! Please open a pull request or issue to discuss any changes you would like to make.

## Feedback

If you have any feedback, please reach out to us at <fake@fake.com>
