# ADR-002: Security Architecture and Threat Modelling

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-11-27
- Last revised: 2026-05-22 — replaced NextAuth + bcrypt with Supabase Auth; production now runs on Vercel + Supabase managed Postgres. See [ADR-001](ADR-001-TechStackSelection.md).
- Decision maker: @jrrs1982

## Context

This is a personal finance application handling sensitive user data (income, expenses, budgets). Users authenticate via email/password or OAuth providers. The app stores financial documents and personal information, making it a target for account takeover, data breaches, and unauthorized access. We need a security architecture that protects user data while maintaining usability.

> See [docs/features/auth.md](../features/auth.md) for the on-the-wire sequence diagrams (sign-up, sign-in, authenticated request, sign-out) and the file-by-file code map.

The original (Nov 2025) design used NextAuth.js + bcrypt against a self-hosted Postgres. In May 2026 the platform moved to Vercel + Supabase, which shifts where several security primitives live: password handling, session management, and email verification are now Supabase's responsibility, while application-level authorization (`userId` filtering, RLS) remains ours.

## Decision

### Authentication

- **Supabase Auth** with email/password and OAuth providers. Supabase handles password hashing (Argon2 internally), email verification, password reset, and brute-force throttling on its own auth endpoints.
- **`@supabase/ssr`** integrates Supabase Auth with the Next.js App Router. Sessions are JWTs delivered as `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- **Email verification required** before account activation (Supabase project setting).
- **Account lockout / brute force**: Supabase Auth enforces rate limits on `/auth/v1/token`, `/auth/v1/signup`, etc. We rely on Supabase's defaults and tighten them in the dashboard rather than implementing our own lockout logic in the app.
- **Session lifetime**: configured in Supabase Auth project settings (JWT expiry + refresh token rotation). Default is 1 hour access token, 30-day refresh token.

### Authorization

- **Next.js middleware** reads the Supabase session from cookies and redirects unauthenticated requests away from protected routes.
- **Server components and route handlers** call `supabase.auth.getUser()` to obtain the authenticated user before any data access.
- **Application-level `userId` filtering**: every Prisma query that touches user-owned data is filtered by the authenticated `userId`. This is the *primary* authorization boundary, because Prisma connects to Postgres using a role that bypasses RLS (see "Defence in depth" below).
- **Soft deletes**: `deletedAt` timestamps for financial documents/items (audit trail).

### Defence in depth: Row Level Security

- **RLS policies** are enabled on all user-data tables in Postgres. Enforced by
  `src/__tests__/security/rls.test.ts`, which fails the build if a model has no
  policy. See [Row Level Security](../features/row-level-security.md) for the
  working detail and the template for new tables.
- RLS is **not** the primary enforcement mechanism *for the application path*,
  because server-side Prisma queries use the standard Postgres connection (not a
  Supabase JWT) and therefore bypass RLS.
- It **is** the only enforcement mechanism for the **Supabase Data API**
  (PostgREST), which is enabled on this project and reaches the same tables over
  HTTPS without passing through the app. `anon` and `authenticated` hold all
  privileges on the `public` schema by default, and a `GRANT` is table-wide — so
  an unfenced table is world-readable and world-writable to anyone holding the
  publishable key, which is public by design. Describing RLS as purely
  "defence in depth" understates this: for that surface it is the whole fence.
- Beyond that, RLS also means mistakes in server code that forget a `userId`
  filter are caught at the database layer when policies match.
- RLS policies are migrated via Prisma raw SQL migrations alongside schema
  changes. Prisma cannot generate them — `schema.prisma` has no way to express a
  policy — so each one is hand-written into the generated `migration.sql`. Since
  the app bypasses RLS, a forgotten policy is invisible to every test and page,
  which is why the guard above exists.

### Data Protection

- **Environment variables**: Supabase keys and `DATABASE_URL` / `DIRECT_URL` live in Vercel project env vars (production) and `.env.development` (local). All env vars are validated with zod-env. See [ADR-004](ADR-004-SecretManagement.md).
- **Database encryption**: Supabase enforces TLS for all connections and encrypts data at rest. No additional configuration needed.
- **No sensitive data in logs**: Sanitise logs to exclude tokens and raw financial values. Vercel and Supabase logs are accessible from their dashboards.

### API Security

- **Rate limiting**:
  - Supabase Auth rate-limits its own endpoints (login, signup, password reset).
  - Application API routes are **not yet rate-limited**. Planned: [Upstash Ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) called from Next.js middleware. Tracked as a follow-up.
- **CSRF protection**: Next.js Server Actions include CSRF tokens by default. Route handlers that mutate state must be POST-only.
- **Input validation**: Zod schemas for all API inputs (prevents injection and shape errors).
- **CORS**: Restrict to same-origin only.
- **Security headers**: CSP, HSTS, X-Frame-Options configured in `next.config.mjs`. Vercel adds reasonable defaults; we override where stricter.

### Threat Model & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **SQL injection** | Prisma ORM with parameterised queries |
| **XSS** | React auto-escaping, CSP headers, sanitise user-generated content |
| **CSRF** | Server Actions' built-in tokens, SameSite cookies |
| **Brute force login** | Supabase Auth rate limits + dashboard-configured thresholds |
| **Session hijacking** | HttpOnly cookies, Secure flag, SameSite=Lax, short access-token expiry |
| **Unauthorised data access** | App-level `userId` filtering on every Prisma query; RLS policies as defence-in-depth |
| **Password leaks** | Supabase handles hashing (Argon2); password reset via verified email |
| **OAuth token theft** | OAuth flow managed by Supabase Auth; tokens never round-trip through our app |
| **Forgotten `userId` filter** | RLS policies block the query at the DB layer if client-side; code review + tests if server-side |
| **Public-key exposure** | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is safe to expose by design; `SUPABASE_SECRET_KEY` is server-only and never sent to the browser |
| **Direct Data API access** | The publishable key reaches PostgREST without touching the app, so RLS policies are the only control — enforced on every model by `src/__tests__/security/rls.test.ts` |

### Monitoring & Incident Response

- **Audit logging**: Supabase Auth logs login attempts, signups, password resets, and admin actions. Vercel logs application-level events.
- **Suspicious activity alerts**: Supabase has built-in alerting on unusual auth patterns; tune in the dashboard.
- **Security updates**: Dependabot for automated dependency vulnerability scanning (GitHub Actions).

## Schema implications

The `User` model in `prisma/schema.prisma` predates this revision and currently mirrors NextAuth-style fields (`password`, `failedLoginAttempts`, `accountLockedAt`, `passwordChangedAt`, etc.). Under Supabase Auth these belong on `auth.users` (managed by Supabase), not in the app's schema.

**Follow-up work**: refactor `prisma/schema.prisma` so the application's `User` table becomes a profile table keyed to `auth.users(id)` and drops the auth-managed columns. This is a separate change, tracked outside this ADR.

## Considered Alternatives

### Original (2025-11)

- **Argon2 instead of bcrypt**: more secure but less mature in Node; bcrypt was battle-tested. *Obsolete under Supabase Auth* — Supabase uses Argon2 internally, so we get it without managing it ourselves.
- **Refresh token rotation**: added complexity; deferred for MVP. *Now provided by Supabase Auth by default.*
- **Database-level encryption (pgcrypto)**: deferred to post-MVP (performance overhead). Unchanged.
- **2FA/MFA**: excluded from MVP. Supabase Auth supports TOTP MFA — easy to enable when needed.

### Migration (2026-05)

- **Keep NextAuth.js, use Supabase Postgres as its database only**: preserves the original ADR but doubles the user surface (NextAuth's user table + Supabase's `auth.users`) and forgoes Supabase's built-in OAuth/magic-link/MFA work. Rejected; the duplication isn't worth it.
- **Rely on RLS as the primary authorization boundary**: would require routing all queries through `@supabase/supabase-js` with the user's JWT, which means dropping Prisma server-side. Rejected; explicit app-level `userId` filtering is easier to reason about, and Prisma stays.
- **Implement app-level account lockout in addition to Supabase's**: extra complexity, two-source-of-truth for "is this account locked." Rejected; tune Supabase's own throttles instead.

## Consequences

- **Good**: Layered security — Supabase handles the auth primitives that are hardest to get right (hashing, rotation, email verification, brute-force), application code handles the domain authorization it actually knows about (`userId` filtering).
- **Good**: RLS gives us a safety net if a future feature ever queries Supabase directly from the browser.
- **Good**: No 2FA in MVP but the path to enable it is now just a Supabase dashboard toggle + UI work.
- **Bad**: Vendor lock-in on Supabase Auth — `auth.users` is theirs, and migrating off later would require user re-onboarding or a custom migration.
- **Bad**: Server-side queries bypass RLS, so app-level filtering bugs are not caught at the DB layer for server-side reads. Mitigation: code review + integration tests + RLS-on-by-default policy structure.
- **Neutral**: JWT sessions mean no server-side session revocation; mitigated by short access-token expiry and the ability to invalidate refresh tokens via Supabase Admin API.
