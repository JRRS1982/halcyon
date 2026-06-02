# Privacy & Account-Data Controls — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm), pending implementation plan
**Related:** [ADR-002 (Security Architecture)](../../ADRs/ADR-002-SecurityArchitecture.md), [AuthFlow.md](../../AuthFlow.md)

## Why

Halcyon is currently single-user (the author's own finances) but is internet-hosted and intended to accept other users later. The moment anyone else can sign up, Halcyon becomes a **data controller** under UK GDPR / Data Protection Act 2018, which requires (among other things) a privacy notice, the right to **erasure**, and the right to **data portability**. This work builds the *code-side* pieces of that so the app is ready before the first external user.

Out-of-band obligations that are **not** code (tracked separately, see "Deferred"): ICO registration, accepting the Supabase + Vercel Data Processing Addenda, and writing the real legal copy.

Scope was confirmed via brainstorming:
- **Delete account** → **hard delete** (true erasure), including the Supabase `auth.users` record.
- **Export** → **single JSON file**.
- **Clear my data** → **financial data only** (keep login, settings, categories).
- **Legal pages** → scaffold `/privacy` + `/terms` with **placeholder copy**, except a **factual** cookies section.
- **Cookie consent banner** → **not needed** (auth-only strictly-necessary cookies, no analytics; disclosed in the privacy page).

## What we're building

### 1. Server actions — `src/app/settings/dataActions.ts` (new file)

A new file rather than extending `accountActions.ts`, because that file already has a `deleteAccount` that deletes a *single managed Account row* — a different concept from deleting the user's whole account. Follows the existing house pattern: `"use server"`, a local `requireUserId()` (redirect to `/sign-in?next=/settings` when unauthenticated), zod where there's input, `revalidatePath` after writes.

#### `exportMyData(): Promise<string>`
- Reads every user-owned row via Prisma (`user`, `settings`, `categories`, `accounts`, `periods`, `financialItems`, `balanceItems`, `budgetTemplateItems`, `balanceTemplateItems`, `transactions`), each filtered by `userId`.
- Assembles `{ exportedAt, schemaVersion, user, settings, categories, accounts, periods, financialItems, balanceItems, budgetTemplateItems, balanceTemplateItems, transactions }`.
- Serialises to JSON via a small helper that converts Prisma `Decimal` → string and `Date` → ISO-8601 string (a `JSON.stringify` replacer in `src/lib/data/serialize.ts`).
- Returns the JSON string. Read-only; no confirmation. The client wraps it in a `Blob` and downloads `halcyon-export-<YYYY-MM-DD>.json`.

#### `clearMyData(): Promise<void>`
- Inside `prisma.$transaction`, deletes **financial** rows in FK-safe order (see "Deletion order"):
  Transaction → FinancialItem → BalanceItem → FinancialPeriod → Account → BudgetTemplateItem → BalanceTemplateItem.
- **Keeps** `User`, `UserSettings`, and `Category`. User stays logged in.
- `revalidatePath` for `/dashboard`, `/budget`, `/balance`, `/transactions`, `/settings`.

#### `deleteMyAccount(): Promise<void>`
- Inside `prisma.$transaction`, deletes **all** user rows in FK-safe order: the seven financial tables above, then `Category`, `UserSettings`, and finally the `User` row.
- **Then** calls `adminClient.auth.admin.deleteUser(userId)` to erase the Supabase `auth.users` identity record.
- **Then** `supabase.auth.signOut()` and `redirect("/")`.
- **Ordering rationale:** app data first, identity second. If the admin call failed mid-way, we'd have erased the financial PII (the privacy-critical part) rather than orphaning it behind an undeletable login. A failure is surfaced, not swallowed.

##### Deletion order (FK-safe)
`Transaction` **must** be deleted before `Account` because `Transaction.transferAccount` is `onDelete: Restrict` (a referenced account cannot be deleted while a transfer points at it). The other relations are `onDelete: Cascade` from `User`/`FinancialPeriod`, but we delete explicitly in order rather than relying on cascade so the `Restrict` edge can never fire mid-cascade and the behaviour is identical between `clear` and `delete`.

### 2. Supabase admin client — `src/lib/supabase/admin.ts` (new file)

`createAdminClient()` built from `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` (already present in env), with `{ auth: { autoRefreshToken: false, persistSession: false } }`. Server-only; used in exactly one place (`deleteMyAccount`).

It carries a thorough top-of-file doc comment explaining: the identity-in-`auth` / profile-in-`public` split, that the session-bound publishable-key client is *not permitted* to delete an `auth.users` row, that erasure therefore requires the Admin API + the secret key, and that the secret key bypasses RLS so this module must never be imported by a client component.

### 3. Settings UI — `src/app/settings/DataPrivacy.tsx` (new component)

A "Your data" / Danger Zone section rendered at the bottom of `settings/page.tsx` (after `AccountManager`). Three controls:
- **Export my data** — button calls `exportMyData()`, builds a `Blob`, triggers download. Brief success/error feedback.
- **Clear my data** — `window.confirm` ("Delete all your financial records? Your account and settings stay.") then `clearMyData()`.
- **Delete my account** — **type-to-confirm**: the destructive button stays disabled until the user types `DELETE`, then `deleteMyAccount()` runs and they land signed-out on `/`.

Matches existing settings components' styling (styled-components, `SectionHeading`). Visually separated/colour-cued as destructive.

### 4. Legal pages + footer

- `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` — static server components.
  - **Placeholder copy** for the policy/terms body (TODO markers), per decision.
  - **Factual cookies section** (not placeholder): states that Halcyon sets a single strictly-necessary Supabase session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`), uses **no** analytics/tracking/advertising cookies, and shares nothing for marketing — hence no consent banner.
- Both routes must render **signed-out**, so add `/privacy` and `/terms` to the middleware public-route allowlist (`src/lib/supabase/middleware.ts` / `src/middleware.ts` matcher).
- `src/components/ui/Footer.tsx` — rendered in `layout.tsx` beneath `children`; links to `/privacy` and `/terms`. This footer is the home of the privacy notice.

### 5. Documentation

- The doc comment in `admin.ts` (above).
- A new **"Account deletion & data erasure"** section in `docs/AuthFlow.md` (expanding the existing "No delete account flow" gap note at the bottom): prose on the two-place identity split + why erasure needs the Admin path, a `mermaid` sequence diagram for `deleteMyAccount` (matching the file's existing sign-up/sign-in/sign-out diagrams), and short notes on `clearMyData` / `exportMyData`. Add `admin.ts` and `dataActions.ts` to the code-map table.

## Testing

Decent coverage requested.

- **Integration** (`src/__tests__/settings/dataActions.int.test.ts`, mirroring `accountActions.int.test.ts`, real `halcyon_test` DB):
  - `exportMyData` returns every seeded row, scoped to the caller's `userId` (a second user's rows are absent).
  - `clearMyData` removes all financial rows **but** leaves `User`, `UserSettings`, and `Category` intact, and does **not** touch a second user's data.
  - `deleteMyAccount` removes **all** rows for the user (financial + category + settings + User), leaves other users intact, and calls `auth.admin.deleteUser` once with the right id (admin client mocked).
- **Unit** (`src/__tests__/data/serialize.test.ts`): the JSON serializer renders `Decimal` as a string and `Date` as ISO, round-trips structure.
- **E2E** (light, extend existing specs): `/privacy` and `/terms` render while signed-out; footer links resolve from a signed-in page.

## Deferred (not in this work)

- **Owner to-dos (non-code):** ICO registration (~£40–60/yr) before external signups; accept Supabase + Vercel DPAs; replace placeholder legal copy with real wording.
- Cookie consent banner (only if analytics are ever added).
- Soft-delete / grace-period / undo / "export then delete" bundle.
- Account-deletion confirmation **email** (email flows not yet built in Halcyon generally).
- Re-auth / password re-entry before destructive actions.

## Files touched

| File | Change |
|---|---|
| `src/app/settings/dataActions.ts` | **new** — export / clear / delete actions |
| `src/lib/supabase/admin.ts` | **new** — service-role admin client (documented) |
| `src/lib/data/serialize.ts` | **new** — Decimal/Date JSON serializer |
| `src/app/settings/DataPrivacy.tsx` | **new** — Danger Zone UI |
| `src/app/settings/page.tsx` | render `DataPrivacy` |
| `src/app/privacy/page.tsx` | **new** — privacy page (placeholder + factual cookies) |
| `src/app/terms/page.tsx` | **new** — terms page (placeholder) |
| `src/components/ui/Footer.tsx` | **new** — footer with legal links |
| `src/app/layout.tsx` | render `Footer` |
| `src/lib/supabase/middleware.ts` / `src/middleware.ts` | allow `/privacy`, `/terms` signed-out |
| `docs/AuthFlow.md` | new "Account deletion & data erasure" section + code-map rows |
| `src/__tests__/settings/dataActions.int.test.ts` | **new** — integration tests |
| `src/__tests__/data/serialize.test.ts` | **new** — unit test |
| `e2e/*.spec.ts` | extend — legal pages + footer |
