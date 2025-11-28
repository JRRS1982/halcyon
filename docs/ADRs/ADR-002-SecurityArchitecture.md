# ADR-002: Security Architecture and Threat Modelling

- Status: Accepted
- Created by: @jrrs1982
- Date: 2025-11-27
- Decision maker: @jrrs1982

## Context

This is a personal finance application handling sensitive user data (income, expenses, budgets). Users authenticate via email/password or OAuth providers. The app stores financial documents and personal information, making it a target for account takeover, data breaches, and unauthorized access. We need a security architecture that protects user data while maintaining usability.

## Decision

### Authentication & Authorization

- **NextAuth.js** for authentication with JWT sessions (already selected in ADR-001)
- **Bcrypt** (rounds: 10) for password hashing
- **Email verification required** before account activation
- **Account lockout**: 5 failed login attempts → suspend account, require password reset
- **Session management**: JWT with 7-day expiration, refresh on activity
- **Auto-logout**: 30 minutes of inactivity (`lastActiveAt` tracking)
- **Next.js middleware** for route protection (server-side authorization checks)

### Data Protection

- **Row-level security**: All queries filtered by `userId` via Prisma middleware
- **Soft deletes**: `deletedAt` timestamps for financial documents/items (audit trail)
- **Environment variables**: All secrets in `.env.local`, validated with zod-env
- **Database encryption**: PostgreSQL SSL/TLS connections in production
- **No sensitive data in logs**: Sanitize logs to exclude passwords, tokens, financial values

### API Security

- **Rate limiting**: 100 requests/minute per IP, 20 login attempts/hour per email
- **CSRF protection**: Next.js built-in CSRF tokens for state-changing operations
- **Input validation**: Zod schemas for all API inputs (prevent injection attacks)
- **CORS**: Restrict to same-origin only (no external API access)
- **Security headers**: Next.js has inbuilt security headers support via next.config.js (CSP, HSTS, X-Frame-Options)

### Threat Model & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **SQL Injection** | Prisma ORM with parameterized queries |
| **XSS** | React auto-escaping, CSP headers, sanitize user-generated content |
| **CSRF** | Next.js CSRF tokens, SameSite cookies |
| **Brute force login** | Account lockout, rate limiting, CAPTCHA after 3 failures |
| **Session hijacking** | HttpOnly cookies, secure flag, short JWT expiration |
| **Unauthorized data access** | Prisma middleware enforcing userId filtering on all queries |
| **Password leaks** | Bcrypt hashing, force password reset on suspicious activity |
| **OAuth token theft** | Store tokens encrypted at rest, short-lived access tokens |

### Monitoring & Incident Response

- **Audit logging**: Track login attempts, account suspensions, password resets
- **Suspicious activity alerts**: Multiple failed logins, access from new locations (future)
- **Security updates**: Dependabot for automated dependency vulnerability scanning (GitHub Actions)

## Considered Alternatives

- **Argon2 instead of Bcrypt**: More secure but less mature ecosystem in Node.js; bcrypt is battle-tested and sufficient for this use case
- **Refresh token rotation**: Adds complexity; JWT with reasonable expiration + activity tracking is simpler for MVP
- **Database-level encryption**: PostgreSQL pgcrypto for column encryption; deferred to post-MVP (performance overhead)
- **2FA/MFA**: Critical for financial apps but excluded from MVP; will add via NextAuth.js providers in v2

### Consequences

- **Good**: Layered security approach protects against common web vulnerabilities while maintaining developer velocity
- **Good**: Account lockout and rate limiting prevent brute force attacks without impacting legitimate users
- **Good**: Row-level security via Prisma ensures users can only access their own financial data
- **Bad**: No 2FA in MVP reduces security for high-value targets (mitigated by strong password requirements)
- **Neutral**: JWT sessions mean no server-side session revocation (acceptable trade-off for stateless architecture)
