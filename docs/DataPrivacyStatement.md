# Data Privacy

The authoritative privacy documents are the ones users actually see, versioned
with the code that must honour them:

- **Privacy Policy** — `src/app/(app)/privacy/page.tsx`, served at `/privacy`
- **Cookie Policy** — `src/app/(app)/cookies/page.tsx`, served at `/cookies`
- **Terms of Service** — `src/app/(app)/terms/page.tsx`, served at `/terms`

An earlier version of this file was a generic GDPR template that listed
categories of data the app might collect (names, gender, phone numbers, postal
addresses, location, usage analytics). Balanced Money collects none of those,
and keeping the template around contradicted the live policy — in a public
repo, that contradiction is itself a risk. It was replaced with this pointer.

## The actual posture, for maintainers

- The only personal data held is the account email address and the financial
  figures the user enters (including, if they use Plan, their date of birth).
- No analytics, tracking, advertising, profiling, or AI anywhere.
- Processors: Supabase (DB + auth), Vercel (hosting), Resend (outbound email —
  address only, opt-in reminder only), ImprovMX (inbound contact-email
  forwarding — see `docs/features/contact-email.md`). Name any new processor
  in the Privacy Policy before shipping it.
- Only strictly-necessary first-party cookies (Supabase session, `bm_activity`
  timeout cookie, transient OAuth PKCE) — which is why there is no consent
  banner. A new cookie must be added to the Cookie Policy first; anything
  non-essential needs a consent mechanism before it ships.
- Self-service rights: export (JSON), clear, and hard-delete live in
  Settings → Your data (`src/app/(app)/settings/dataActions.ts`). When adding a
  user-owned model, add it to the export AND to the clear/delete paths, and
  extend `src/__tests__/settings/dataActions.int.test.ts` — the privacy policy
  promises "everything", so an omitted table makes the policy false.

Owner to-dos tracked elsewhere: ICO registration and Supabase/Vercel DPA
records. The `hello@balanced.money` contact address named in the policies is
live (ImprovMX forwarding, verified 2026-08-18).
