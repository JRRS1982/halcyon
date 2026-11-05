# Sitemap

**What:** Every route the app serves, derived from `src/app/` and the middleware guard — not a plan.  
**Key points:**
- Public pages: `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/features`, `/features/<slug>`, `/guide`, `/how-its-built`, `/design`, `/privacy`, `/cookies`, `/terms`, `/unsubscribe`
- Authenticated pages: `/transactions`, `/budget`, `/balance`, `/dashboard`, `/plan`, `/settings`
- Non-page routes: `/auth/callback`, `/design.md`, `/api/unsubscribe`, `/api/health`, `/api/csp-report`, `/api/cron/monthly-reminder`
- The six authenticated pages are in the proxy's `protectedPaths` list, and each page re-checks the session itself
- If a route is listed here, it exists in the codebase

Every route the app serves, and who can reach it. Derived from `src/app/` and the
guard in [`src/lib/supabase/middleware.ts`](../src/lib/supabase/middleware.ts),
which `src/proxy.ts` runs on every request.

```mermaid
flowchart LR
    subgraph public ["Public — no session needed"]
        HOME["/ landing"]
        SI["/sign-in"]
        SU["/sign-up"]
        FP["/forgot-password"]
        RP["/reset-password"]
        CB["/auth/callback"]
        ABOUT["/guide — the guide"]
        BUILT["/how-its-built — the engineering tour"]
        DESIGN["/design — the design system"]
        LEGAL["/privacy · /cookies · /terms"]
        UNSUB["/unsubscribe"]
    end

    subgraph guarded ["Behind the auth guard"]
        TX["/transactions"]
        BUD["/budget"]
        BAL["/balance"]
        DASH["/dashboard"]
        PLAN["/plan"]
        SET["/settings"]
    end

    HOME --> SI
    HOME --> SU
    HOME --> ABOUT
    HOME --> BUILT
    HOME --> DESIGN
    HOME --> LEGAL
    SI --> FP
    FP -->|emailed link| RP
    RP -->|POST_AUTH_LANDING| TX
    SI --> CB
    SU --> CB
    SI -->|POST_AUTH_LANDING| TX
    CB -->|POST_AUTH_LANDING| TX

    TX --> TX1["ledger"]
    TX --> TX2["CSV import — dedupe, reversible batches"]
    TX --> TX3["categorise"]

    BUD --> BUD1["income · expenses"]
    BUD --> BUD2["budgeted vs actual"]
    BUD --> BUD3["transfers (optional)"]

    BAL --> BAL1["assets · liabilities"]
    BAL --> BAL2["net worth"]

    DASH --> D1["balance trend"]
    DASH --> D2["cash flow"]
    DASH --> D3["category expenditure"]
    DASH --> D4["balance by category"]

    PLAN --> P1["assets · liabilities · mortgages"]
    PLAN --> P2["income · expenses"]
    PLAN --> P3["events"]

    SET --> S1["format · appearance"]
    SET --> S2["charts · categories · accounts"]
    SET --> S3["feature toggles"]
    SET --> S4["export · delete account"]

    TX -.->|categorised rows fill actuals| BUD
    BUD -.-> DASH
    BAL -.-> DASH
```

## Route groups

Routes live in two App Router groups. The groups shape nothing in the URL; they
decide which layout wraps the page, and that turns out to matter for
performance:

- **`(marketing)`** — the landing page alone. Its layout reads no session, which
  is what lets the whole group prerender: no auth round-trip in front of the one
  page a stranger judges the product by.
- **`(app)`** — every other page, public or not. Its layout resolves the user,
  the nav flags and the colour scheme, so it renders per request.

`/auth/callback`, `/design.md` and the `/api/*` routes sit outside both — they
are route handlers, not pages.

## Public

Reachable without a session.

| Route | What it is |
| --- | --- |
| `/` | Landing page. A signed-in visitor is redirected to `/transactions` by the proxy before the page renders, so this is only ever seen signed out. |
| `/sign-in` | Email + password, and "Continue with Google". Accepts `?next=` to return you where you were heading, and `?timeout=idle\|absolute\|unreadable` after a session expiry. Links to `/forgot-password`. |
| `/sign-up` | Account creation, by email + password or "Continue with Google". Supabase Auth owns the password and the confirmation email. |
| `/forgot-password` | Asks for an email address and sends a reset link. The reply is the same whether or not the address has an account. |
| `/reset-password` | Where the emailed link lands (it carries a `token_hash`). Sets a new password, signs the user in and signs out their other sessions. Google-only accounts are refused. |
| `/auth/callback` | Route handler. Exchanges the one-time `code` from OAuth and email confirmation for a session. Refuses password-recovery codes, which belong at `/reset-password`. |
| `/features` | The features index: one article per part of the app, each linking to its page. |
| `/features/<slug>` | One article per feature (`transactions`, `budget`, `balance`, `dashboard`, `plan`, `settings`), from `src/lib/editorial/features.ts` through one template. The front page's stories link here. |
| `/guide` | The guide — what the app is for, the monthly rhythm, and what each section does. Deliberately public: it is the honest answer to "what is this?" before signing up. |
| `/how-its-built` | The engineering tour — every feature of the build, with what it does, why it matters and how it is implemented. Public on purpose: it is the page to hand to someone who wants to know whether this is trustworthy. |
| `/design` | The design system, rendered live from `DESIGN.md`: colour tokens, type scale, spacing and component patterns. Public like the guide. |
| `/design.md` | Route handler. The same `DESIGN.md` as raw Markdown, for pointing a tool at. |
| `/privacy` | Privacy notice. |
| `/cookies` | Cookie policy — every cookie the app sets, named, with purpose and lifetime. |
| `/terms` | Terms of service. |
| `/unsubscribe` | Where the monthly reminder email's "stop these reminders" link lands. Needs no session; the token in the URL can only turn one account's reminder off. |

### API routes

Machine endpoints; none is in `protectedPaths`.

| Route | What it is |
| --- | --- |
| `POST /api/unsubscribe` | One-click unsubscribe (RFC 8058), called by mail clients from the reminder's `List-Unsubscribe` header. Token in the query string. |
| `POST /api/csp-report` | Where browsers send Content-Security-Policy violation reports. Counts each in Upstash for 30 days; see ADR-002. |
| `GET /api/health` | Production liveness check (`SELECT 1` through Prisma). Needs the `CRON_SECRET` bearer token; called daily by `.github/workflows/health.yml`. |
| `/api/cron/monthly-reminder` | The daily Vercel Cron job that sends due monthly reminders. Needs the `CRON_SECRET` bearer token. |

## Behind the auth guard

Listed in `protectedPaths` in the proxy. A request without a confirmed session is redirected to `/sign-in?next=<path>`.

| Route | What it is |
| --- | --- |
| `/transactions` | The ledger. CSV import (duplicate detection, reversible batches) and categorisation. Where users land after signing in. Hidden from the nav when the Transactions setting is off. |
| `/budget` | Per-period budgeted against actual, across four row kinds: income and expenses (split Fixed / Variable / Discretionary), repayments at a debt (inside Expenses), and transfers to an account you own (their own section). |
| `/balance` | Per-period assets and liabilities, one row per account, grouped into sections (Current, Medium-term, Long-term, Property, Other), totalling to net worth. |
| `/dashboard` | Read-only. Balance trend, cash flow, category expenditure and balance-by-category, drawn from the months filled in elsewhere. |
| `/plan` | Long-range forecasting — income, spending, property, mortgages and pensions projected decades ahead. Refreshed from the balance sheet and budget by an explicit Sync. |
| `/settings` | Currency and number format, colour scheme, chart visibility, categories, accounts, transactions and transfers toggles, monthly reminder, change password (password accounts only), and data export / account deletion. |

## Navigation

The signed-in nav leads with the guide, then follows how the app is used —
import, categorise, budget, balance, then read the result:

```
Guide → Transactions → Budget → Balance → Dashboard → Plan → Settings
```

Transactions drops out when the Transactions setting is off. Signed out, every page's bar carries Features and Guide, one word each; `/sign-in`, `/sign-up`, `/forgot-password` and `/reset-password` carry only the brand. App pages share a footer linking the features, guide, design system, engineering tour and legal pages.

There is deliberately no "Home" entry: signed-in users are redirected away from
`/`, so it would only ever point at a redirect.

## Not built

- **Blog** — not built. The feature articles are plain data rendered by one
  article template (`src/components/editorial/`), so a blog can reuse both
  when there are posts to publish.
