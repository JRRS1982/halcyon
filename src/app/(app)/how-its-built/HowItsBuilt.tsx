"use client";

import type { ReactNode } from "react";
import {
  LegalBody,
  LegalHeading,
  LegalSection,
  LegalShell,
  LegalTable,
  LegalTableWrap,
} from "@/components/legal/LegalPage";
import { PageHeader } from "@/components/ui/PageHeader";

// The engineering tour: what is in the application, why each piece is there,
// and how it is implemented.
//
// House rule for this page: a row may only claim something the code on master
// does today. No roadmap, no "planned", no rounding up. If a row cites a
// number it came from the code, not from memory. That is the whole reason the
// page is worth sharing — anyone can open the repo and check it, and the
// fastest way to lose a reader is one row they can prove wrong.
//
// Second house rule: no links. The page is a standalone read meant to be
// handed to someone, so it never sends them elsewhere mid-table — e2e asserts
// `main a` is empty, so adding one will fail the build rather than drift in.
//
// Avoid counting things the codebase happens to contain — dependencies,
// migrations, tables, tests. Those drift with every commit, and a tally that is
// one out reads as carelessness about everything around it. Configured values
// (session windows, rate limits, import caps) are fair game: if one changes,
// this page ought to change with it.
//
// Content lives as data rather than hand-written table rows: they all share one
// shape, so the shape is written once and the substance stays readable.

type Feature = {
  // Plain string rather than a node: it doubles as the row key, and every
  // entry is a short label that needs no markup.
  what: string;
  why: ReactNode;
  how: ReactNode;
};

type Section = {
  id: string;
  heading: string;
  lead: ReactNode;
  features: Feature[];
};

const sections: Section[] = [
  {
    id: "architecture",
    heading: "Architecture and stack",
    lead: (
      <>
        One Next.js application, no separate backend service. The browser talks
        to server components and server actions; those talk to Postgres through
        Prisma. Fewer moving parts means fewer places for data to leak out of.
      </>
    ),
    features: [
      {
        what: "Rendering happens on the server",
        why: "Your financial data is assembled into a page on the server and sent as finished markup. It is never handed to the browser as a queryable API that someone else could learn to call.",
        how: (
          <>
            React server components under <code>src/app/</code>. Pages read from
            the database directly in the component that renders them.
          </>
        ),
      },
      {
        what: "Writes go through server actions, not a public API",
        why: "There is no REST surface sitting on the internet waiting to be probed, so there is no separately-versioned API to keep secure as the app changes.",
        how: (
          <>
            Server actions colocated with each feature as{" "}
            <code>actions.ts</code>. Every action that touches your data
            re-establishes who you are on the server before it reads or writes a
            row; the only actions without a session are the ones that cannot
            have it yet — signing in, signing up and unsubscribing — and none of
            them reaches account data.
          </>
        ),
      },
      {
        what: "Connection pooling",
        why: "Serverless functions start and stop constantly. Without pooling, a busy minute would open more database connections than Postgres allows and the app would start refusing requests.",
        how: (
          <>
            Two connections by design: a pooled one for everything the app does
            at runtime, and a direct one for migrations, which cannot run
            through a pooler. A single Prisma client is cached per process, so
            hot reloads and warm invocations reuse it instead of stacking up new
            pools.
          </>
        ),
      },
      {
        what: "As few runtime dependencies as possible",
        why: "Every package installed is code someone else wrote running next to your data, and a future security advisory somebody has to answer for. A short list is a smaller attack surface and a shorter upgrade treadmill.",
        how: (
          <>
            The production list covers the framework, the database layer, the
            auth client, the rate-limit store, charts, styling and validation —
            and stops there. A new dependency has to justify itself against the
            cost of maintaining it; everything else is a build-time tool that
            never ships to you.
          </>
        ),
      },
      {
        what: "Swappable infrastructure, one edit deep",
        why: "Vendors get acquired, priced out or outgrown. Choices made now should not need a rewrite to reverse later.",
        how: (
          <>
            Anything touching a vendor hides behind one module: logging is a
            neutral interface with a single place that decides where lines go,
            and the rate limiter keeps its policy separate from its Redis
            transport, so the store can change without touching a call site.
          </>
        ),
      },
      {
        what: "Deep modules with narrow interfaces",
        why: "Complexity that leaks out of a module has to be understood by everyone who touches it. Kept inside, one hard thing stays one hard thing instead of spreading through the codebase.",
        how: (
          <>
            Each module exposes the smallest useful surface and hides the rest.
            The rate limiter is the clearest example: callers ask one question —
            is this request within the limit? — while the store, the hashing,
            the window and the failure policy all stay behind that single
            function.
          </>
        ),
      },
      {
        what: "Coding standards written down, not implied",
        why: "Standards that live in someone’s head cannot be reviewed against, and are the first thing to slip when the work gets busy.",
        how: (
          <>
            The conventions are committed alongside the code: early returns over
            nested conditionals, self-documenting names over comments, types
            derived from the validation schemas and the database schema rather
            than hand-written beside them, and a review checklist for
            security-sensitive changes. Architectural decisions are recorded as
            dated decision records, so the reasoning survives longer than the
            memory of it.
          </>
        ),
      },
    ],
  },
  {
    id: "validation",
    heading: "Validation and type safety",
    lead: (
      <>
        Nothing reaches the database on trust. Every value crossing a boundary —
        a form submission, a CSV row, an environment variable — is parsed
        against a schema first, and the types the code is written against are
        derived from those same schemas rather than declared separately and
        hoped to match.
      </>
    ),
    features: [
      {
        what: "Schema validation at every input boundary",
        why: "A browser can send anything, whatever the form on screen allowed. Checking on the server is the only check that counts.",
        how: (
          <>
            Each feature keeps its zod schemas in its own{" "}
            <code>schemas.ts</code>, and its server actions parse against them
            before touching the database. A parse failure surfaces as an error
            instead of reaching Prisma as a half-understood write.
          </>
        ),
      },
      {
        what: "Configuration is validated before the server takes traffic",
        why: "A missing key should be an obvious failure at startup, not a confusing error that reaches one unlucky user mid-request.",
        how: (
          <>
            The environment is parsed with zod as the process boots. A malformed
            or absent required variable stops the boot with a message naming it.
          </>
        ),
      },
      {
        what: "Secrets are structurally unable to reach the browser",
        why: "The most common way credentials leak is being bundled into client-side JavaScript by accident.",
        how: (
          <>
            Public and server-only configuration are separate schemas, and the
            server-only parse is guarded so it never runs in the browser bundle
            or in the edge proxy. A secret read in the wrong place fails rather
            than shipping.
          </>
        ),
      },
      {
        what: "Money is stored as exact decimals",
        why: "Floating point cannot represent 0.10 exactly. Used for money it produces balances that drift by pennies and totals that do not reconcile — the one class of bug a finance app cannot have.",
        how: (
          <>
            Every monetary column is a Postgres <code>DECIMAL</code> fixed at
            two decimal places — <code>DECIMAL(12,2)</code> for budgeted and
            actual amounts, <code>DECIMAL(14,2)</code> for balances. Values stay
            decimal rather than becoming floats on the way through.
          </>
        ),
      },
    ],
  },
  {
    id: "auth",
    heading: "Authentication and sessions",
    lead: (
      <>
        Passwords, email confirmation and Google sign-in are handled by Supabase
        Auth, a dedicated identity service — not by hand-rolled hashing in this
        codebase. What the app adds is session lifetime, route protection, and
        closing the gaps a hosted service leaves open.
      </>
    ),
    features: [
      {
        what: "Passwords are never handled by this application",
        why: "Credential storage is a solved problem that is still routinely got wrong. The safest amount of custom password code is none.",
        how: (
          <>
            Supabase Auth owns password hashing, email verification, OAuth and
            its own brute-force throttling. The app holds a session, never a
            credential.
          </>
        ),
      },
      {
        what: "Sessions expire: 6 hours idle, 24 hours absolute",
        why: "A session that never ends is a session still valid on the laptop you left on a train. The absolute cap means even continuous use eventually asks you to sign in again.",
        how: (
          <>
            Supabase enforces these limits only on paid plans, so the app
            implements them: an activity cookie records session start and last
            request, and the proxy re-evaluates both windows on every request.
            You are warned 60 seconds before an idle expiry rather than losing
            what you were typing.
          </>
        ),
      },
      {
        what: "The activity cookie is deliberately unsigned",
        why: "Worth stating plainly rather than leaving it to look like an oversight: forging it can only extend the forger’s own session, and they already hold the token that grants it. There is nothing to gain and nothing to protect.",
        how: (
          <>
            Two timestamps, <code>httpOnly</code> so page scripts cannot read
            it, with a lifetime that outlives both windows on purpose — a cookie
            expiring at the idle limit would arrive looking like a fresh session
            and silently resurrect the one that limit exists to end.
          </>
        ),
      },
      {
        what: "Route protection at the edge, without an open redirect",
        why: "Guarding pages is the easy half. The usual bug is the convenience feature beside it: a “return here after login” parameter that will happily forward you to an attacker’s domain.",
        how: (
          <>
            The proxy redirects unauthenticated requests to sign-in with the
            intended path preserved, and that path is validated before use —
            relative destinations only, so it cannot be pointed off-site.
          </>
        ),
      },
      {
        what: "Sign-up cannot be used to test whether an address has an account",
        why: "An error reading “already registered” turns a public form into a tool for confirming who uses the service. Worth protecting even while the service is small.",
        how: (
          <>
            The underlying error is logged server-side for diagnostics, and
            every attempt lands on the same neutral “check your email” page
            regardless of outcome.
          </>
        ),
      },
    ],
  },
  {
    id: "abuse",
    heading: "Abuse resistance and rate limiting",
    lead: (
      <>
        Public forms attract automated traffic: password guessing on sign-in,
        confirmation-email flooding on sign-up, unbounded uploads on import.
        Each is capped, and the caps are built so that the protection failing
        never becomes an outage.
      </>
    ),
    features: [
      {
        what: "The real client IP reaches the identity service",
        why: "Supabase throttles authentication per IP — but behind a hosting platform every request appears to come from a handful of shared platform addresses, which collapses everyone’s attempts into one bucket and makes the throttle useless.",
        how: (
          <>
            The client IP is taken from the platform edge’s{" "}
            <code>x-forwarded-for</code> header — set by the platform, so not
            spoofable by the client — and forwarded explicitly on Supabase
            calls, so its per-IP limits bind to actual clients.
          </>
        ),
      },
      {
        what: "A second rate limiter in the application itself",
        why: "Defence that depends on one vendor’s behaviour is one configuration change away from being gone. The app enforces its own ceiling regardless.",
        how: (
          <>
            Ten attempts per minute per IP on sign-in and on sign-up, counted in
            Upstash Redis over HTTPS — a managed store reached per request,
            which is the only shape of Redis that suits serverless, where
            holding a TCP connection open is an anti-pattern.
          </>
        ),
      },
      {
        what: "Rate limiting that stores no IP addresses",
        why: "An IP address is personal data. Blocking abuse should not require building a record of where users connect from.",
        how: (
          <>
            The counter key holds a SHA-256 digest of the address, never the
            address itself, and the key self-expires after its 60-second window.
            Nothing about the request outlives the minute it happened in.
          </>
        ),
      },
      {
        what: "The limiter fails open, on purpose",
        why: "If the counter store is unreachable the choice is to degrade protection or to lock every legitimate user out of their own account. For a personal finance app the first is clearly right.",
        how: (
          <>
            A missing or erroring store allows the request and records a
            warning, so an outage is visible in the logs rather than silent. The
            limiter also no-ops where it is not configured, which is why local
            development and CI need no Redis at all.
          </>
        ),
      },
      {
        what: "Import and storage are bounded",
        why: "A signed-in user is still an untrusted source of volume. Uncapped uploads are a cost and availability problem long before they are a security one.",
        how: (
          <>
            5,000 rows and 2MB per CSV, and a ceiling of 250,000 stored
            transactions per account — the per-file cap alone would have left
            the number of files unbounded.
          </>
        ),
      },
    ],
  },
  {
    id: "data",
    heading: "Your data, and who can reach it",
    lead: (
      <>
        The app holds a month-by-month picture of your finances, which is about
        as sensitive as personal data gets. Two independent fences keep one
        account’s rows away from another’s, and everything the law calls a data
        right is a working button in Settings rather than an email you have to
        send.
      </>
    ),
    features: [
      {
        what: "Every query is scoped to one account",
        why: "This is the boundary that does the work day to day. It is applied in the query itself, so a missing filter shows up as a visible bug in review rather than a silent cross-account read.",
        how: (
          <>
            Server-side reads and writes filter on the authenticated user id,
            taken from the verified session on the server — never from anything
            the browser supplied.
          </>
        ),
      },
      {
        what: "Row-level security in the database as a second fence",
        why: "Application filters protect you from bugs in the application. They do not help if something ever reaches the tables by another route. The database should refuse on its own.",
        how: (
          <>
            Postgres row-level security is enabled on every table, so the rules
            live with the data and not only in the code that usually reads it.
          </>
        ),
      },
      {
        what: "Table permissions narrowed to what a user may legitimately change",
        why: "Columns like account status or last-active timestamps are the app’s business, not the account holder’s. A broad update permission would let someone rewrite their own record.",
        how: (
          <>
            A migration restricts the user table’s update grant to the
            self-editable columns, so the rest cannot be written through that
            path whatever is sent.
          </>
        ),
      },
      {
        what: "Export everything, as JSON, whenever you like",
        why: "Data you cannot get out is data you do not control. Leaving should not cost you your history.",
        how: (
          <>
            One button in Settings serialises every row belonging to you into a
            single JSON file.
          </>
        ),
      },
      {
        what: "Delete your financial data but keep the account",
        why: "Starting over after a year of experimenting should not mean losing your login and preferences too.",
        how: (
          <>
            A single database transaction clears the financial rows in
            foreign-key-safe order, leaving your account and categories intact.
          </>
        ),
      },
      {
        what: "Real deletion, in the order that protects you if it fails",
        why: "“Delete my account” often means a flag in a column. Here the rows are actually gone — and the sequence is chosen so a failure part-way through cannot leave your financial data sitting behind a login you can no longer use.",
        how: (
          <>
            Financial rows, categories and settings go first, in one
            transaction; the identity at the auth provider is erased second. If
            that second step ever failed, the sensitive data is already gone and
            the leftover empty identity is logged for follow-up.
          </>
        ),
      },
      {
        what: "No analytics, no trackers, no third-party pixels",
        why: "Nobody needs a record of which parts of your budget you looked at. It also means there is no consent banner to click, because there is nothing to consent to.",
        how: (
          <>
            No measurement scripts, no advertising or retargeting tags, no
            session recording, no third-party embeds. The only cookies set are
            the ones that keep you signed in — each named and explained in the
            cookie policy.
          </>
        ),
      },
      {
        what: "No bank connections, by choice",
        why: "Linking accounts is the industry norm and the single largest risk in it: somewhere has to hold credentials or long-lived tokens that can read your accounts. This app cannot be breached for access it never had.",
        how: (
          <>
            You export a CSV from your bank and import it. Duplicate detection
            and remembered categories are what make that a minute’s work rather
            than a chore.
          </>
        ),
      },
    ],
  },
  {
    id: "integrity",
    heading: "Correctness and data integrity",
    lead: (
      <>
        A finance app is judged on whether the numbers are right and stay right.
        The recurring theme below is that an action either completes or does
        nothing at all, and that anything automatic can be inspected and undone.
      </>
    ),
    features: [
      {
        what: "One action either fully happens or does not happen at all",
        why: "A multi-row edit interrupted half-way is the classic way a ledger ends up subtly wrong — and nobody notices for months.",
        how: (
          <>
            Each user gesture is one server action wrapped in a single database
            transaction. A failure rolls the whole thing back, so there is no
            half-applied state to reconcile.
          </>
        ),
      },
      {
        what: "Schema changes are forward-only and reviewed",
        why: "Ad-hoc changes to a live database are how production schemas drift out of step with the code that reads them.",
        how: (
          <>
            Every schema change is a migration file committed alongside the code
            that needs it and applied in order. Already-applied migrations are
            never edited.
          </>
        ),
      },
      {
        what: "Deletes respect the relationships between records",
        why: "Removing an account that transfers still point at should not be possible; removing a plan should not leave its rows orphaned.",
        how: (
          <>
            Every relation in the schema declares what a delete does — cascade
            where the children are meaningless on their own, restrict where a
            reference has to block the removal outright.
          </>
        ),
      },
      {
        what: "Duplicate imports are surfaced, never silently merged",
        why: "Importing overlapping date ranges is normal and should not double your spending. Guessing on your behalf would be worse than asking: two identical payments on one day are sometimes genuinely two payments.",
        how: (
          <>
            A fingerprint per row — account, calendar day, signed amount and a
            normalised description — flags likely duplicates for you to confirm
            or drop. Nothing is combined automatically.
          </>
        ),
      },
      {
        what: "Any import can be reversed",
        why: "The confidence to import comes from knowing you can undo it. A bad CSV should be a thirty-second mistake.",
        how: (
          <>
            Rows are grouped into an import batch, and the batch can be removed
            as a unit, restoring the ledger to exactly its previous state.
          </>
        ),
      },
      {
        what: "Categories are remembered without storing a model",
        why: "Bank descriptions repeat every month with only the reference digits changing, so your own past decisions are the best classifier available — and a better one than a generic merchant list.",
        how: (
          <>
            The memory is rebuilt from your recent categorised transactions at
            import time rather than saved anywhere, so it always matches what
            the ledger actually says, and a correction is picked up on the next
            import with nothing to retrain or clear.
          </>
        ),
      },
    ],
  },
  {
    id: "testing",
    heading: "Testing and delivery",
    lead: (
      <>
        Three layers of tests, each answering a different question, and a
        pipeline arranged so the database schema can never be behind the code
        that depends on it.
      </>
    ),
    features: [
      {
        what: "Unit tests for the logic that decides your numbers",
        why: "Budget maths, date handling, amount parsing and session-expiry rules are pure logic. They should be provable in milliseconds, not by clicking around.",
        how: (
          <>
            Jest and React Testing Library across the calculation modules and
            the components that present them.
          </>
        ),
      },
      {
        what: "Integration tests against a real Postgres",
        why: "Most bugs in a data-heavy app live in the gap between the code and the database — constraints, transactions, delete ordering. A mocked database finds none of them, because a mock agrees with whatever the code expects.",
        how: (
          <>
            The real server actions run against a real throwaway database, with
            only the authentication boundary substituted. Constraint violations
            and rollback behaviour are exercised rather than imagined.
          </>
        ),
      },
      {
        what: "End-to-end tests in three real browser engines",
        why: "Layout, focus behaviour and colour scheme genuinely differ between engines. Testing one of them means shipping regressions to users of the other two.",
        how: (
          <>
            Playwright drives Chromium, Firefox and WebKit through the actual
            journeys — sign in, import, categorise, plan — including phone-sized
            viewports.
          </>
        ),
      },
      {
        what: "No retries: a test that fails once fails the build",
        why: "Automatic retries turn a real intermittent bug into a green tick. A flaky test is information, and re-running until it passes throws that information away.",
        how: (
          <>
            Retries are set to zero. When a test proves unreliable the cause
            gets fixed rather than papered over.
          </>
        ),
      },
      {
        what: "Checks that cannot be skipped, including by the author",
        why: "A rule the person who wrote it can wave through is a habit, not a guarantee.",
        how: (
          <>
            Lint, types, unit, integration and end-to-end tests run on every
            pull request, and a branch rule requires them with nobody on a
            bypass list. The same checks run locally on every push through a git
            hook, so CI is rarely the first place a problem is noticed.
          </>
        ),
      },
      {
        what: "Migrations run before the new code is live",
        why: "The classic deployment outage is code that expects a column the database does not have yet.",
        how: (
          <>
            Migrations are applied as a gated pipeline step and the deploy waits
            for it to succeed. Rolling back is one click.
          </>
        ),
      },
    ],
  },
  {
    id: "interface",
    heading: "Interface, accessibility and operations",
    lead: (
      <>
        The last group is the everyday experience: that the app is usable
        without a mouse, readable in either colour scheme, honest when something
        breaks, and observable when it does.
      </>
    ),
    features: [
      {
        what: "Accessibility is a written standard, not a good intention",
        why: "“Accessible” claimed with nothing behind it is worth nothing. Written down, it can be checked — and argued with.",
        how: (
          <>
            A standards document in the repository sets the rules the interface
            is held to: semantic landmarks, a proper heading hierarchy, keyboard
            operability, and a minimum 4.5:1 contrast ratio for body text.
          </>
        ),
      },
      {
        what: "Keyboard and screen-reader structure is tested, not assumed",
        why: "Accessibility regressions are invisible to everyone who does not rely on them, which is exactly why they need a test rather than a review.",
        how: (
          <>
            End-to-end tests assert that every route exposes exactly one main
            landmark, that skip-to-content is the first thing a keyboard user
            reaches and that it actually moves focus, and that the budget and
            balance sheets expose real tables with named columns. They run in
            all three engines on purpose, because this is where engines differ
            most.
          </>
        ),
      },
      {
        what: "Light and dark, following your system",
        why: "Dark mode at midnight is less a preference than a comfort, and the choice should not have to be made twice.",
        how: (
          <>
            Themes are design tokens applied through styled-components,
            honouring <code>prefers-color-scheme</code> by default with an
            explicit override in Settings if you want one.
          </>
        ),
      },
      {
        what: "Motion respects the setting that says it should not",
        why: "Animation can cause real physical discomfort, and the operating system already knows who it affects.",
        how: (
          <>
            The loading skeletons stop shimmering and the plan drawer stops
            sliding under <code>prefers-reduced-motion</code> — the two places
            in the app that animate at all.
          </>
        ),
      },
      {
        what: "Designed for a phone, not shrunk onto one",
        why: "Spreadsheet-style grids are where responsive design usually gives up and hands you a page that scrolls sideways.",
        how: (
          <>
            The sheets pan horizontally with their labels pinned, dialogs fit
            small screens, and the plan editor becomes a bottom sheet — each
            with its own phone-viewport tests.
          </>
        ),
      },
      {
        what: "Honest failure states",
        why: "A blank screen tells you nothing. Knowing that something broke, and that it was not your data’s fault, is the minimum.",
        how: (
          <>
            Loading skeletons while a page’s data arrives, an error boundary
            that explains and offers a retry, and a real not-found page rather
            than a crash.
          </>
        ),
      },
      {
        what: "Structured logging, with somewhere to go next",
        why: "The point of a log line is to shorten the gap between something going wrong and someone knowing why.",
        how: (
          <>
            Call sites use a neutral logger rather than <code>console</code>,
            emitting structured lines with errors expanded into name, message
            and stack. Sending them on to a monitoring service later is one
            function body, not a sweep through the codebase.
          </>
        ),
      },
      {
        what: "The reminder email carries no financial information",
        why: "Email is not a private channel. A monthly nudge should not become a monthly leak of your net worth into an inbox.",
        how: (
          <>
            Off unless you turn it on, no figures in the message — just a link
            to sign in — and a one-click unsubscribe that works without logging
            in.
          </>
        ),
      },
    ],
  },
];

function FeatureTable({ features }: { features: Feature[] }) {
  return (
    <LegalTableWrap>
      <LegalTable>
        <thead>
          <tr>
            <th>What</th>
            <th>Why it matters</th>
            <th>How it&rsquo;s built</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature.what}>
              <td>
                <strong>{feature.what}</strong>
              </td>
              <td>{feature.why}</td>
              <td>{feature.how}</td>
            </tr>
          ))}
        </tbody>
      </LegalTable>
    </LegalTableWrap>
  );
}

export function HowItsBuilt() {
  return (
    <LegalShell>
      <PageHeader
        eyebrow="Engineering"
        title="How it’s built"
        lead="What is in this application, why each piece is there, and how it works. Written to be checked rather than admired — everything below is in the code today."
      />

      <LegalSection>
        <LegalBody>
          Balanced Money is a personal finance app holding a month-by-month
          record of what you earn, owe and own. That makes two things
          non-negotiable: the numbers have to be right, and the data has to stay
          yours. Most of the decisions on this page follow from those two
          sentences.
        </LegalBody>
        <LegalBody>
          It is also a deliberately small stack, maintained by one person. Where
          a choice looks conservative — no bank connections, as few dependencies
          as the job allows, no analytics — that is usually the point rather
          than a compromise.
        </LegalBody>
      </LegalSection>

      {sections.map((section) => (
        <LegalSection key={section.id} id={section.id}>
          <LegalHeading>{section.heading}</LegalHeading>
          <LegalBody>{section.lead}</LegalBody>
          <FeatureTable features={section.features} />
        </LegalSection>
      ))}

      <LegalSection>
        <LegalHeading>Found something wrong?</LegalHeading>
        <LegalBody>
          This page is only useful if it is accurate. If a row overstates what
          the code does, that is a bug worth reporting like any other —
          hello@balanced.money. For what the app is for and how to use it, read
          the guide.
        </LegalBody>
      </LegalSection>
    </LegalShell>
  );
}
