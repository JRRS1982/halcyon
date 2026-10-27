# ADR-002: Security Architecture and Threat Modelling

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-11-27
- Last revised: 2026-05-22 — replaced NextAuth + bcrypt with Supabase Auth; production now runs on Vercel + Supabase managed Postgres. See [ADR-001](adr-001-tech-stack-selection.md).
- Decision maker: @jrrs1982

> **Update 2026-10-27.** The decision stands. Since it was written: Supabase Data API write privileges
> are revoked on every user-owned table (`20261012090000_restrict_data_api_writes`), so RLS now scopes reads
> only; the RLS guard moved to `tests/unit/schema.rls.test.ts`; Next.js 16 renamed middleware to
> `src/proxy.ts`; and rate-limit failure policy varies per action (see
> [Rate limiting](../engineering/rate-limiting.md)). Step-up re-verification before sensitive actions is
> documented in [Step-up auth](../engineering/step-up-auth.md). Sections below are corrected where they
> described the present wrongly.

**Decision:** Supabase Auth owns identity (passwords, OAuth, session cookies); every Prisma query filters by `userId` as the primary fence; RLS policies are defence-in-depth.

## Context

This is a personal finance application handling sensitive user data (income, expenses, budgets). Users authenticate via email/password or OAuth providers. The app stores financial documents and personal information, making it a target for account takeover, data breaches, and unauthorized access. We need a security architecture that protects user data while maintaining usability.

> See [docs/features/auth.md](../features/auth.md) for the on-the-wire sequence diagrams (sign-up, sign-in, authenticated request, sign-out) and the file-by-file code map.

The original (Nov 2025) design used NextAuth.js + bcrypt against a self-hosted Postgres. In May 2026 the platform moved to Vercel + Supabase, which shifts where several security primitives live: password handling, session management, and email verification are now Supabase's responsibility, while application-level authorization (`userId` filtering, RLS) remains ours.

## Decision

### Authentication

- **Supabase Auth** with email/password and OAuth providers. Supabase handles password hashing, email verification, password reset, and brute-force throttling on its own auth endpoints.
- **`@supabase/ssr`** integrates Supabase Auth with the Next.js App Router. Sessions are JWTs delivered as `HttpOnly`, `Secure`, `SameSite=Lax` cookies.
- **Email verification required** before account activation (Supabase project setting).
- **Account lockout / brute force**: Supabase Auth enforces rate limits on `/auth/v1/token`, `/auth/v1/signup`, etc. We rely on Supabase's defaults and tighten them in the dashboard rather than implementing our own lockout logic in the app.
- **Session lifetime**: configured in Supabase Auth project settings (JWT expiry + refresh token rotation). Default is 1 hour access token, 30-day refresh token.

### Authorization

- **Next.js proxy** (`src/proxy.ts`) reads the Supabase session from cookies and redirects unauthenticated requests away from protected routes.
- **Server components and route handlers** call `supabase.auth.getUser()` to obtain the authenticated user before any data access.
- **Application-level `userId` filtering**: every Prisma query that touches user-owned data is filtered by the authenticated `userId`. This is the *primary* authorization boundary, because Prisma connects to Postgres using a role that bypasses RLS (see "Defence in depth" below).
- **Soft deletes**: `deletedAt` timestamps for financial documents/items (audit trail).

### Defence in depth: Row Level Security

- **RLS policies** are enabled on all user-data tables in Postgres. Enforced by
  `tests/unit/schema.rls.test.ts`, which fails the build if a model has no
  policy or no write revoke. See [Row Level Security](../engineering/row-level-security.md) for the
  working detail and the template for new tables.
- RLS is **not** the primary enforcement mechanism *for the application path*,
  because server-side Prisma queries use the standard Postgres connection (not a
  Supabase JWT) and therefore bypass RLS.
- It **is** the only enforcement mechanism for the **Supabase Data API**
  (PostgREST), which is enabled on this project and reaches the same tables over
  HTTPS without passing through the app. Supabase grants `anon` and `authenticated`
  all privileges on the `public` schema by default, and a `GRANT` is table-wide —
  so an unfenced table is readable and writable by anyone holding the publishable
  key, which is public by design. Describing RLS as purely "defence in depth"
  understates this: for that surface it is the main fence. The second is a revoke
  of `INSERT`, `UPDATE` and `DELETE` on every user-owned table, because a policy
  scopes rows but cannot stop a user writing within their own.
- RLS policies are migrated via Prisma raw SQL migrations alongside schema
  changes. Prisma cannot generate them — `schema.prisma` has no way to express a
  policy — so each one is hand-written into the generated `migration.sql`. Since
  the app bypasses RLS, a forgotten policy is invisible to every test and page,
  which is why the guard above exists.

### Data Protection

- **Environment variables**: Supabase keys and `DATABASE_URL` / `DIRECT_URL` live in Vercel project env vars (production) and `.env.development` (local). All env vars are validated with zod-env. See [ADR-004](adr-004-secret-management.md).
- **Database encryption**: Supabase enforces TLS for all connections and encrypts data at rest. No additional configuration needed.
- **No sensitive data in logs**: Sanitise logs to exclude tokens and raw financial values. Vercel and Supabase logs are accessible from their dashboards.

### API Security

- **Rate limiting**:
  - Supabase Auth rate-limits its own endpoints (login, signup, password reset).
  - Application-level rate limiting is implemented via Upstash Ratelimit (`src/lib/rateLimit/index.ts`). The policy table, keys and failure behaviour (fail open for most, fail closed where a call sends email or spends a guess budget) are in [Rate limiting](../engineering/rate-limiting.md).
- **CSRF protection**: Next.js Server Actions include CSRF tokens by default. Route handlers that mutate state must be POST-only.
- **Input validation**: Zod schemas for all API inputs (prevents injection and shape errors).
- **CORS**: Restrict to same-origin only.
- **Security headers**: `next.config.mjs` sends `frame-ancestors 'none'` and `X-Frame-Options: DENY` (clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` switching off camera, microphone and location on every response; `tests/e2e/security-headers.spec.ts` checks them. HSTS comes from Vercel. A script-restricting Content-Security-Policy is *Not yet built* — Next and styled-components inline scripts and styles, so it needs per-request nonces and a report-only trial first.

### Threat Model & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **SQL injection** | Prisma ORM with parameterised queries |
| **Clickjacking** | `frame-ancestors 'none'` and `X-Frame-Options: DENY` on every response |
| **XSS** | React auto-escaping, sanitise user-generated content (a script-restricting CSP is not yet built) |
| **CSRF** | Server Actions' built-in tokens, SameSite cookies |
| **Brute force login** | Supabase Auth rate limits + dashboard-configured thresholds |
| **Session hijacking** | HttpOnly cookies, Secure flag, SameSite=Lax, short access-token expiry |
| **Unauthorised data access** | App-level `userId` filtering on every Prisma query; RLS policies as defence-in-depth |
| **Password leaks** | Supabase handles hashing; password reset via verified email |
| **OAuth token theft** | OAuth flow managed by Supabase Auth; tokens never round-trip through our app |
| **Forgotten `userId` filter** | Server-side Prisma bypasses RLS, so code review and integration tests are the only catch; RLS covers the Data API only |
| **Public-key exposure** | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is safe to expose by design; `SUPABASE_SECRET_KEY` is server-only and never sent to the browser |
| **Direct Data API access** | The publishable key reaches PostgREST without touching the app, so RLS policies are the only control — enforced on every model by `tests/unit/schema.rls.test.ts`, with writes revoked as well |

### Monitoring & Incident Response

- **Audit logging**: Supabase Auth logs login attempts, signups, password resets, and admin actions. Vercel logs application-level events.
- **Suspicious activity alerts**: Supabase has built-in alerting on unusual auth patterns; tune in the dashboard.
- **Security updates**: Dependabot for automated dependency vulnerability scanning (GitHub Actions).

## Considered Alternatives

### Original (2025-11)

- **Argon2 instead of bcrypt**: more secure but less mature in Node; bcrypt was battle-tested. *Obsolete under Supabase Auth* — Supabase owns password hashing.
- **Refresh token rotation**: added complexity; deferred for MVP. *Now provided by Supabase Auth by default.*
- **Database-level encryption (pgcrypto)**: deferred to post-MVP (performance overhead). Unchanged.
- **2FA/MFA**: excluded from MVP. Supabase Auth supports TOTP MFA — easy to enable when needed.

### Migration (2026-05)

- **Keep NextAuth.js, use Supabase Postgres as its database only**: preserves the original ADR but doubles the user surface (NextAuth's user table + Supabase's `auth.users`) and forgoes Supabase's built-in OAuth/magic-link/MFA work. Rejected; the duplication isn't worth it.
- **Rely on RLS as the primary authorization boundary**: would require routing all queries through `@supabase/supabase-js` with the user's JWT, which means dropping Prisma server-side. Rejected; explicit app-level `userId` filtering is easier to reason about, and Prisma stays.
- **Implement app-level account lockout in addition to Supabase's**: extra complexity, two-source-of-truth for "is this account locked." Rejected; tune Supabase's own throttles instead.

## Consequences

- **Good**: Layered security — Supabase handles the auth primitives that are hardest to get right (hashing, rotation, email verification, brute-force), application code handles the domain authorization it actually knows about (`userId` filtering).
- **Good**: RLS and the write revokes fence the Supabase Data API, and are a safety net if a feature ever queries Supabase directly from the browser.
- **Good**: No 2FA in MVP but the path to enable it is now just a Supabase dashboard toggle + UI work.
- **Bad**: Vendor lock-in on Supabase Auth — `auth.users` is theirs, and migrating off later would require user re-onboarding or a custom migration.
- **Bad**: Server-side queries bypass RLS, so app-level filtering bugs are not caught at the DB layer for server-side reads. Mitigation: code review + integration tests.
- **Neutral**: JWT sessions mean no server-side session revocation; mitigated by short access-token expiry and the ability to invalidate refresh tokens via Supabase Admin API.
