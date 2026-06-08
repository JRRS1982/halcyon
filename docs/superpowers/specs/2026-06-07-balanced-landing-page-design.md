# Balanced Money — landing page design

- **Date:** 2026-06-07
- **Status:** Draft for review
- **Topic:** Public marketing/landing page for the app (repo "halcyon", product "Balanced Money", domain `www.balanced.money`)
- **Mockup:** `.superpowers/brainstorm/224495-1780857475/content/mockup-a4.html` (high-fidelity, design-system-faithful)

## 1. Context & goals

The repo is named *halcyon*, but the product ships publicly as **Balanced Money** on `www.balanced.money`. The current `/` route is a placeholder that branches on auth state. We are replacing it with a real landing page.

**Primary goal:** educate visitors and make it obvious that Balanced helps you *understand your spending — how much, and on what* — and *track what you have and where it goes*, with structured guidance that removes the need to keep your own spreadsheet.

**Tone:** warm, plain-spoken, education-led. Positions *against* the messy DIY spreadsheet ("put the spreadsheet down"), even though the product's own surfaces are spreadsheet-clean. Honest: this is a real personal project, so **no fake pricing tiers, no fake blog, no invented testimonials or "thousands of users."**

**Approach chosen:** "Alternating showcases" (Approach A from brainstorming) — hero money-shot, a *How it works* branched tree, alternating feature showcase rows with real screenshots, a *details that matter* grid, a dark CTA band, footer + wordmark.

## 2. Non-goals

- No pricing page / paid tiers (the product is free).
- No blog, careers, contact, or "about" pages.
- No fabricated social proof or security badges.
- No new product features — the page only markets what is **already built**.
- Not a full visual rebrand of the in-app surfaces beyond the brand *name* string (see §9).

## 3. Positioning & voice

- **Product name:** **Balanced Money** (used in nav brand, footer, and page title). "Balanced" may appear as a short form only inside running prose where the full name reads clunky. No wordmark stencil (removed — see §4.8 / §9.5).
- **One-liner:** *Personal finance, made clear.*
- **Pitch:** Balanced replaces the spreadsheet you've been meaning to keep, giving structure and gentle guidance to track what you have, understand where it goes, and learn how you really spend.
- **Design system:** strictly follows `DESIGN.md` — Inter sentence-case headlines, uppercase `mono-caps` for every data-touching label, a single black CTA pill per viewport, hairline borders (no shadows on inline surfaces), `canvas-dark` bands for emphasis, accent blue reserved for interaction/wayfinding (kept off marketing prose), and the giant faint `halcyon`→`balanced` wordmark sign-off. Six-size type scale only.

## 4. Page structure (top → bottom)

Page container: max-width 1240px, `DESIGN.md` page padding. Section rhythm uses the established spacing tokens. Final copy below is approved (from mockup A4) — treat as the source copy.

### 4.1 Nav (sticky, 56px, hairline bottom)
- Brand **Balanced Money** (left).
- Centre `mono-caps` anchor links: **How it works · Features · Details** (homepage only — see §9 nav notes).
- Right: **Sign in** (`mono-caps` link) + **Get started** black pill → `/sign-up`.

### 4.2 Hero
- Eyebrow: `PERSONAL FINANCE, MADE CLEAR`
- H1 (display-xl): **Make sense of your money.**
- Lead: *Balanced takes the place of the messy spreadsheet you've been meaning to keep. It gives you the structure — and the gentle guidance — to track what you have, understand where it goes, and learn how you really spend.*
- CTAs: **Get started** (primary, `/sign-up`) + **Sign in** (outline, `/sign-in`).
- Screenshot slot (16:9): **Dashboard** — "Spending by category, cash flow, balance trend, net worth — at a glance."

### 4.3 How it works — branched tree
- Eyebrow `HOW IT WORKS`; H2 **One simple path. You pick how hands-on.**
- Intro: *Set things up once, then choose how your numbers get in. Balanced guides you either way — and you can switch whenever you like.*
- Tree (trunk → fork → merge), drawn with hairline-strong connectors:
  - **Step 1 · Set up** — *Add your accounts and the categories that match how you actually spend. Balanced suggests a sensible starting set.*
  - **Step 2 · Enter your values — two ways** — *Choose the approach that suits you. Both fill in the same budget and balance, so the rest of the app just works.*
  - Fork into two cards:
    - **Option A · Transactions on** (accent-bordered badge) — **Let your statements do the work** — *Import a bank statement and Balanced sorts every transaction into categories, then fills your budget actuals and balances for you. "Where did it all go?" answers itself.*
    - **Option B · Manual** (neutral badge) — **Type the figures in yourself** — *Prefer to stay hands-on, or not connect a bank? Enter your numbers straight into the budget and balance sheets. No imports — just a clean, guided place to keep them.*
  - Merge into a dark (`canvas-dark`) node:
    - **Step 3 · See where you stand** — *Either way, the same dashboard lights up: your spending breakdown, cash flow, budget variance and net worth — all kept up to date for you.*
- Maps to the real `transactionsEnabled` per-user toggle (`isTransactionsEnabled`, settings).

### 4.4 Features intro
- Eyebrow `FEATURES`; H2 **Structure where you'd otherwise wing it.**
- Lead: *No more rolling your own tabs and formulas. Balanced gives every part of your money a proper home — and guides you to what actually matters.*

### 4.5 Showcase rows (alternating image/text)

**1 · Budget** (shot left)
- Eyebrow `BUDGET`; H3 **Budget — then learn how you really spend.**
- *Set a budget for each category, then watch your categorised spending fill in beside it. The gap between the plan and the reality is the lesson: Balanced makes it impossible to ignore where your money is actually going.*
- Shot: **Budget** — "Budgeted vs. actual by category, once spending is sorted."
- (Educational angle, deliberately *not* prescriptive "what's safe to spend.")

**2 · Balance** (shot right)
- Eyebrow `BALANCE`; H3 **Wealthy, or just spending?**
- *Your bank balance lies. Big pension contributions can leave you feeling broke while your net worth quietly climbs; a month of treats can feel rich while your assets go nowhere. Balanced sorts what you own and owe across short, medium and long-term horizons — so you can see whether you're truly getting ahead, and think past this month.*
- Shot: **Balance** — "Assets & liabilities by short / medium / long term → net worth."

**3 · Transactions** (shot left, expanded/upsold — the standout)
- Eyebrow `TRANSACTIONS`; H3 **Turn a bank statement into understanding.**
- *This is where Balanced earns its keep. Switch transactions on, drop in a statement, and a wall of cryptic bank rows becomes a clear, categorised picture of your month — and from there, every chart, budget and balance fills itself in.*
- Capability list (`mono-caps` key + line):
  - **Import** — Drop in a CSV statement and Balanced maps the columns for you.
  - **Auto-sort** — Each transaction lands in the right category, ready to review.
  - **Bulk edits** — Re-categorise or clear dozens of rows in one go — no row-by-row slog.
  - **Safe by default** — Duplicate-aware on import, and any import can be reversed in one click.
- Shot: **Transactions** — "An imported statement, sorted into categories in the ledger."

### 4.6 The details that matter
- Eyebrow `THE DETAILS`; H2 **It's the small things that make it tick.**
- Lead: *The thoughtful touches that turn "a place to type numbers" into something that actually tells the truth about your money.*
- 3×2 hairline grid, six equal boxes (`mono-caps` key + line):
  1. **Transfers aren't spending** — Move money between your own accounts and Balanced treats it as a transfer, not spending — so your expenditure stays honest and you don't look poorer or richer than you are.
  2. **Live & in sync** — Edit or import a transaction and every chart, total and budget recalculates instantly — no refresh, no stale numbers, no "recalculate" button.
  3. **Duplicate-safe imports** — Re-import an overlapping statement and Balanced spots the rows you already have, so nothing gets counted twice.
  4. **Reversible imports** — Imported the wrong file? Undo the entire import in one action — the ledger snaps back to exactly where it was.
  5. **Notes & original detail** — Add a note to any transaction and keep the original statement details beside the tidy, categorised version.
  6. **Your data, yours** — Export everything to a file, clear your data, or delete your account outright — no dark patterns, no hostage-taking.
- **Note:** "Lock the month" is intentionally **excluded** — not a built feature (aspirational only in `DESIGN.md`).

### 4.7 CTA band (`canvas-dark`)
- Eyebrow `GET STARTED`; H2 (white) **Put the spreadsheet down.**
- *Create a free account and let Balanced give your money the structure it's been missing — and guide you to what matters.*
- **Get started** pill (inverted: white fill, ink text on the dark band) → `/sign-up`.

### 4.8 Footer
- Footer columns: **Product** (How it works / Features / Details anchors) · **Legal** (Terms of Service `/terms`, Data Privacy `/privacy`). Brand block: **Balanced Money** + "Personal finance, made clear. Track what you have, understand where it goes."
- **No wordmark stencil.** The giant faint wordmark is removed from the page (and from `DESIGN.md` — see §9.5). The footer block is the page's final element.

## 5. Screenshots

- **Source:** real screenshots of the running app against the existing **18-month seed data** (per project memory: SIPP, ISA, Current, Joint accounts + transfers; `transfersEnabled`).
- **Slots:** Dashboard (hero), Budget, Balance, Transactions/ledger. All framed 16:9, hairline border, `rounded.sm` corners on the image only (per `DESIGN.md` photography geometry).
- **Storage:** static assets under `public/marketing/` (e.g. `public/marketing/dashboard.png`), referenced via `next/image`.
- **Capture mechanism (decision — see §9):** recommended to script with the existing Playwright + mock-Supabase + seeded `halcyon_test` setup for repeatable, deterministic captures; manual capture acceptable as a first pass. Either way: **screenshots must be re-captured when the relevant UI changes** — note this near the assets.
- Until real captures exist, slots render labelled placeholders so the page can ship structurally and have images dropped in.

## 6. Visual / design-system mapping

Every element maps to an existing `DESIGN.md` token/component:
- Headlines → `display-xl` / `display-lg`; eyebrows, badges, nav links, capability keys, button labels → `mono-caps`; body/lead → `body-md`; detail/tree body → `body-sm`.
- Buttons → `button-primary` (black pill) + `button-outline`; on the dark CTA band the primary inverts to white-fill/ink-text (sanctioned inversion for a dark surface — the only place this occurs).
- Surfaces → `canvas` page, `canvas-soft` for the details band, `canvas-dark` for the tree merge node + CTA band. Dividers → `hairline` / `hairline-strong`.
- Accent blue → only the "Transactions on" badge border + (existing) inline link/focus behaviour. Kept off all marketing prose and amounts.
- No wordmark — the `wordmark-footer` / `display-xxl` treatment is being removed from the system (see §9.5).

## 7. Components & files (Next.js App Router + styled-components)

- Replace `src/app/page.tsx` with the composed landing page (server component; reads auth state for the signed-in CTA swap — see §8).
- New landing-only presentational components under `src/components/marketing/` (styled-components, following existing `src/components/ui` conventions), e.g.:
  - `Hero`, `HowItWorksTree`, `FeatureShowcase` (reusable alternating row, `imageSide` prop), `DetailGrid`, `CtaBand`, `MarketingFooter` (or reuse/extend the existing `Footer`).
  - A `Screenshot`/`MarketingShot` wrapper (16:9 frame + `next/image` + placeholder fallback).
- Reuse existing `Button` and styled primitives where possible; do not introduce new design tokens (extend `theme.ts` only if a token is genuinely missing).
- Keep components small and focused (one purpose each), per `.ai/code-style.md`.

## 8. Behaviour

- **Public route:** `/` is public (middleware must not gate it).
- **Signed-out:** full marketing page as specified.
- **Signed-in:** redirect `/` → `/dashboard`. The marketing page is for prospects; signed-in users have full nav and don't need it. Also remove the now-redundant **Home** item from the signed-in `NavBar` list (it would only point at a redirect).
- **Responsive:** follows `DESIGN.md` breakpoints. Hero/showcase/footer grids collapse to single column on mobile; the tree fork/merge connectors hide and branch cards stack; detail grid goes 1-up. Touch targets ≥44px on mobile.
- **Accessibility:** semantic landmarks (`nav`/`main`/`section`/`footer`), one `h1`, logical heading order, alt text on every screenshot, anchor links with visible focus. Follow `docs/AccessibilityStandards.md`.

## 9. Decisions (resolved)

1. **Brand name string across the app — RESOLVED.** Rename the user-facing brand string to **Balanced Money** in `NavBar` + page `<title>`/metadata (repo name stays "halcyon").
2. **Marketing nav vs shared nav — RESOLVED.** Extend the shared `NavBar`: show the **Get started** pill in the signed-out state, and the section anchor links **only on `/`** (anchors are homepage-specific).
3. **Signed-in homepage behaviour — RESOLVED.** Redirect signed-in `/` → `/dashboard`; remove the redundant **Home** item from the signed-in `NavBar` list.
4. **Screenshot capture — RESOLVED.** Playwright-scripted capture against seeded data into `public/marketing/` (manual acceptable as a first pass).
5. **Wordmark — RESOLVED (removed).** The wordmark stencil is removed from the landing page **and** from `DESIGN.md`. Cleanup of `DESIGN.md` (and the coupled `theme.ts`) is required:
   - Remove the `wordmark-footer` component block, the `ex-budget-page` reference to it, the Overview characteristic bullet, the Decorative-Depth "Wordmark stencil" entry, the Shapes/border-radius "footer wordmark" mention, the footer-section `wordmark-footer` description, and the Do/Don't lines about the wordmark.
   - The now-orphaned 96px `display-xxl` size is removed too — see §9a (resolved). All of this is **already applied on this branch**.

### 9a. Sub-decision: the 96px `display-xxl` size — RESOLVED (option B)
Drop 96px entirely → a **five-size scale** (28 / 18 / 14 / 13 / 11). **Already applied on this branch:** the wordmark and the 96px `display-xxl` token have been removed from `DESIGN.md` (all ~10 references, including "six sizes"→"five sizes"), and `display-xxl` removed from `src/lib/theme.ts` (it had no other consumers; typecheck passes). The landing page therefore has no wordmark and uses the five-size scale.

## 10. Testing

- Unit (Jest + RTL): landing renders all sections; signed-in vs signed-out CTA swap; nav links/targets present; external/auth links point at `/sign-up`, `/sign-in`, `/terms`, `/privacy`.
- E2E (Playwright): `/` loads for an unauthenticated visitor; **Get started** routes to `/sign-up`; **Sign in** to `/sign-in`; anchor links scroll to sections; basic responsive smoke (mobile viewport renders without overflow).
- `pnpm verify` (typecheck + biome + tests) green before merge.

## 11. References

- `DESIGN.md` — design system (source of truth).
- `docs/SiteMap.md`, `docs/Wireframes/Homepage/` (superseded by this design — old wireframe predates the design system and used fictional content).
- `.ai/code-style.md`, `.ai/typescript.md`, `docs/AccessibilityStandards.md`.
- Mockup: `.superpowers/brainstorm/224495-1780857475/content/mockup-a4.html`.
