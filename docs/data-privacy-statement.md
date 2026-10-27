# Data Privacy

**What:** Links to the three user-facing legal documents (Privacy Policy, Cookie Policy, Terms) that are the authoritative privacy record.  
**Key points:**
- Privacy Policy, Cookie Policy, Terms are JSX files in `src/app/(app)/` — the code IS the policy
- UK GDPR applies: data subject rights include export (JSON) and hard deletion via Settings
- No cookie consent banner: only essential session cookies are set, so no consent required
- Open owner to-dos: ICO registration fee, Supabase/Vercel DPAs, breach runbook

The authoritative privacy documents are the ones users actually see, versioned
with the code that must honour them:

- **Privacy Policy** — `src/app/(app)/privacy/PrivacyPolicy.tsx`, served at `/privacy`
- **Cookie Policy** — `src/app/(app)/cookies/CookiePolicy.tsx`, served at `/cookies`
- **Terms of Service** — `src/app/(app)/terms/TermsOfService.tsx`, served at `/terms`

This file is a pointer, not a policy. A generic GDPR template once stood here and
contradicted the live policy, which in a public repo is itself a risk.

## The actual posture, for maintainers

- The only personal data held is the account email address and the financial
  figures the user enters (including, if they use Plan, their date of birth).
- No analytics, tracking, advertising, profiling, or AI anywhere.
- Processors: Supabase (DB + auth), Vercel (hosting), Resend (outbound email —
  address only, opt-in reminder only), ImprovMX (inbound contact-email
  forwarding — see [`contact-email.md`](engineering/contact-email.md)). Name any new processor
  in the Privacy Policy before shipping it.
- Only strictly-necessary first-party cookies (Supabase session, `bm_activity`
  timeout cookie, transient OAuth PKCE) — which is why there is no consent
  banner. A new cookie must be added to the Cookie Policy first; anything
  non-essential needs a consent mechanism before it ships.
- Self-service rights: export (JSON), clear, and hard-delete live in
  Settings → Your data (`src/app/(app)/settings/dataActions.ts`). When adding a
  user-owned model, add it to the export AND to the clear/delete paths, and
  extend `tests/integration/app/(app)/settings/dataActions.integration.test.ts` — the privacy
  policy promises "everything", so an omitted table makes the policy false.

Known gap: Upstash (rate-limit counters keyed by a SHA-256 digest of IP or email,
see [rate limiting](engineering/rate-limiting.md)) is not in the Privacy Policy's
processor table. Owner to-dos tracked elsewhere: ICO registration and
Supabase/Vercel DPA records. The `hello@balanced.money` contact address named in the policies is
live (ImprovMX forwarding, verified 2026-08-18).
