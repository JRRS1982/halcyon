# ADR-001: Tech Stack Selection

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-11-25
- Last revised: 2026-05-22 — migrated production hosting from self-hosted Docker to Vercel, replaced NextAuth/bcrypt with Supabase Auth, replaced self-hosted Postgres with Supabase managed Postgres.
- Decision maker: @jrrs1982

## Context

I am building this webapp as a personal project to learn and improve my software development skills/process. I want to follow the steps set out in the [Playbook](../Playbook.md), which I hope will help me select the best tech stack for this project.

This project has a frontend and backend as well as a database. The original plan was to self-host on a home server using Docker Compose; in May 2026 I switched to **Vercel** for hosting and **Supabase** for managed Postgres + Auth so I no longer have to operate the production infrastructure myself. Local development is still Dockerized for parity and offline work.

I want unit tests, end-to-end tests, and integration tests. I want a database that is easy to use and scale, and an ORM. I want a frontend framework that is easy to use and scale, and a backend framework that is easy to use and scale.

## Decision

### General

- **pnpm**: fast and disk-efficient package manager
- **TypeScript**: type safety
- **Docker + modern docker compose**: local development environment only (production runs on Vercel)
- **zod**: runtime validation of data
- **zod-env**: environment variable validation
- **Biome**: alternative to eslint + prettier, for lint + format
- **simple-git-hooks**: pre-push hook that runs `pnpm check` (`biome ci .`) for fast local guardrails
- **Swagger**: automatically generated API documentation (planned)

### Frontend

- **React**: building the user interface
- **Next.js App Router**: full-stack development framework
- **Styled Components**: isolated styling of components
- **Redux Toolkit (Immer)**: state management

### Backend

- **Next.js API Routes**: API routes
- **Next.js Server Components**: server-side request logic
- **Next.js middleware**: server-side route protection (e.g., redirecting unauthenticated users)

### Hosting & Deployment

- **Vercel**: hosting for the Next.js app. Vercel's Git integration deploys `master` automatically when CI succeeds; instant rollback is available via the Vercel dashboard.
- **No self-hosted production infrastructure.** `Dockerfile.dev` and `compose.yaml` exist for local dev only.

### Database

- **Supabase (managed Postgres 16)**: production and staging database. Supabase provides connection pooling (`DATABASE_URL`, port 6543) and a direct connection (`DIRECT_URL`, port 5432) — Prisma uses the pooled URL for runtime and the direct URL for migrations.
- **Postgres in Docker Compose**: local development database (kept for offline work and CI parity).

### ORM

- **Prisma**: type-safe database client, schema language, and migration tool. Prisma points at Supabase Postgres in production and at the local Docker Postgres in development. See [ADR-003](ADR-003-DBMigrations.md) for the connection-string split and the forward-only migration policy.

### Authentication & Authorization

- **Supabase Auth**: email/password + OAuth providers + magic links. Supabase manages password hashing (Argon2 internally), email verification, password reset flows, and brute-force throttling on its auth endpoints.
- **`@supabase/ssr`**: integrates Supabase Auth with the Next.js App Router — session cookies are validated server-side in middleware, server components, and route handlers.
- **Next.js middleware**: enforces route protection by reading the Supabase session from cookies and redirecting unauthenticated users.
- **Row Level Security (RLS)** in Postgres: defence-in-depth. See [ADR-002](ADR-002-SecurityArchitecture.md).

### CI/CD

- **GitHub Actions**: lint, typecheck, unit tests, build, and E2E tests guard every push and PR. Production deploys are handled by Vercel's Git integration (not GitHub Actions).

### Monitoring

- **Vercel Analytics / Logs**: built-in for the Next.js app.
- **Supabase Logs**: built-in for database queries and auth events.
- Anything more sophisticated is out of scope for the MVP.

### Logging

- Server-side `console.*` is captured by Vercel logs. Structured logging is deferred until there is a need.

### Testing

- **Jest**: unit tests — standard test runner
- **React Testing Library**: component tests — standard for React
- **Playwright**: e2e tests — recommended by Vercel for Next.js, excellent Docker support, faster CI runs

## Considered Alternatives

### Original (2025-11)

- **npm**: most familiar, but pnpm is faster and more efficient.
- **Vite**: great DX but doesn't fit a full-stack app with API routes + database.
- **TypeORM**: actively fixing issues with it at work; avoided.
- **Tailwind**: feels like writing CSS in a different language.
- **ESLint + Husky**: used in most past projects; trying Biome instead.
- **Dotenv**: not required in Next.js.
- **Emotion**: no strong feelings; styled-components is the experiment.
- **Zustand**: happy with Redux Toolkit; deep-dive at work didn't change my opinion.
- **Cypress**: Playwright has better Docker support, faster parallel execution, and is Vercel-recommended.

### Migration (2026-05)

- **Stay on the home server**: removed because operating my own production box (TLS renewal, OS patching, backups, postgres tuning, uptime) was eating time I wanted to spend on the app. The Playbook's "Build Foundation" phase explicitly wants reliable infra without much maintenance burden.
- **GitHub Pages + Supabase (static export)**: considered. Rejected because it would force `output: 'export'` and kill API routes, server components, server actions, and Next.js middleware — all of which ADR-002 leans on. The architecture rewrite was bigger than the hosting saving justified.
- **Cloudflare Pages / Netlify**: viable, but Vercel has first-class Next.js support (its origin) and zero-config integration. No reason to use a less-aligned platform for a personal project.
- **NextAuth.js (kept) + Supabase Postgres only**: would have preserved ADR-002's NextAuth design, but doubles the auth surface area (NextAuth's own user table + Supabase's `auth.users`) and forgoes Supabase's built-in email verification, OAuth, magic links, and brute-force protection. Not worth the duplication.
- **Drop Prisma in favour of `@supabase/supabase-js` everywhere**: cleaner Supabase-native pattern, but rewrites every planned query and throws away the migration tooling that's already wired into CI. Kept Prisma; supabase-js is used only for Auth.

## Consequences

- **Good**: I stopped owning production infrastructure. Deploys are git-push, rollbacks are one click, Postgres backups are managed by Supabase.
- **Good**: Supabase Auth deletes a meaningful chunk of ADR-002 (password hashing, lockout policy, email verification flow, OAuth wiring) — code I don't have to write or maintain.
- **Good**: Prisma + the rest of the dev stack are unchanged, so the migration cost was concentrated in auth and deployment, not the whole app.
- **Bad**: I now depend on two managed services (Vercel, Supabase) with their own pricing tiers and outages. Vendor-lock-in is real, especially on Supabase Auth (`auth.users` is theirs).
- **Bad**: Server-side Prisma queries run with the Postgres connection string, which bypasses RLS. That means `userId` filtering has to be enforced in app code; RLS is only a real boundary for client-side queries (currently none planned). See [ADR-002](ADR-002-SecurityArchitecture.md).
- **Neutral**: Local dev still uses Docker Postgres rather than `supabase start`. Cheaper to spin up; further from production parity. Worth revisiting if schema drift bites.
