# Transactions Feature — Design

**Status:** Draft (awaiting review)
**Date:** 2026-05-30
**Branch:** `feat/transactions`

## Summary

Add an opt-in **Transactions** feature, toggled per user in Settings. When on, a
new **Transactions** page (and nav item) appears where the user uploads bank
statements (CSV), the app parses and categorizes them, and each transaction
rolls up into the user's budget: a budget line's `actual` figure becomes the
sum of its categorized transactions for that month, instead of a manually
typed number.

The change reframes the data model: a stable **Category** entity becomes the
spine that both the budget and transactions hang off, replacing today's
per-month free-typed budget labels with a curated, id-stable list.

## Goals

- A per-user setting (`transactionsEnabled`, default **off**) that reveals the
  Transactions page + nav item.
- A stable, user-owned `Category` list present in **both** modes, managed in
  Settings (CRUD + Rename + Merge + Archive).
- CSV import with an easy mapping UI, duplicate flagging, and manual CRUD of
  transactions.
- When enabled, `actual` for a budget line is computed from its categorized
  transactions (net of refunds); when disabled, `actual` is manual as today.
- Performance: cursor pagination on the transactions table; `actual` computed
  via a single grouped aggregate query per month (no denormalized counter).

## Non-goals (explicitly out of scope for v1)

- OFX / QIF import formats (CSV only; OFX/QIF is a post-MVP follow-up).
- Keyword/rule-based auto-categorization.
- History-based auto-suggest of categories (post-MVP).
- Multi-currency / FX handling on import — every amount is treated as the
  user's existing currency setting, stored as entered.
- Denormalized/cached `actual` counter (add only if measurement demands it).
- Undo-whole-import / import-batch tracking.

## Core model shift: Category becomes the spine

A stable, user-owned **`Category`** entity becomes the thing both budget and
transactions reference. It is present regardless of feature mode.

- **Feature OFF:** the budget page still free-types a label, but typing
  find-or-creates a category (normalized: trimmed + case-insensitive) and links
  the budget row to it. Categories accumulate as autocomplete suggestions.
  `actual` stays manually entered, exactly as today.
- **Feature ON:** the budget page keeps the same choose-or-create interaction,
  with two differences only:
  1. `actual` is **computed and read-only** — the net sum of that category's
     transactions for the period. The stored `FinancialItem.actual` column is
     **never overwritten** by transactions; the computed sum is a display
     overlay. So if the user typed a manual `actual` while the feature was off,
     that figure is preserved and shown again the moment they toggle the feature
     back off.
  2. Any category that has transactions in a period is **always shown** for that
     period, even if never explicitly added — so spend never hides.
  Adding/creating a category on the budget page is still allowed (to budget
  ahead for expected spend before any transaction exists). The only thing lost
  when ON is typing `actual` by hand.

Because categories exist in both modes, turning the feature on is a mode switch,
not a scary data migration. Switching modes leaves categories, budget (plan)
values, and which rows appear stable — **only the source of `actual` changes**
(manual ↔ transaction sum). That re-sourcing is by design and is the one place
where switching is not "zero change."

### Category vs `FinancialItem`

These answer two different questions and must not be conflated:

- **`Category`** — *"what kind of money is this?"* A single, stable identity
  that **spans every month** (id + mutable `label` + type + bucket). "Groceries"
  is one `Category` row, forever. Renaming it updates every month at once.
- **`FinancialItem`** — *"what's the plan and result for this category in **one
  specific month**?"* A month-scoped cell holding `budget` (the plan) and, in
  manual mode, `actual`. It belongs to one `FinancialPeriod` and points at a
  `Category` via `categoryId`.

The relationship is **one `Category` → many `FinancialItem`s** (at most one per
month the category is budgeted). The Category is the column header that never
moves; the FinancialItem is the value in March's cell vs April's cell.

A **`Transaction` references the `Category`** (not a `FinancialItem`), and its
**`date`** decides which month's `FinancialItem.actual` it rolls into — which is
why a transaction stores no `periodId`.

#### Worked example

`Category` "Groceries" (id `cat_groc`, EXPENSE / VARIABLE) — one row, reused
every month:

| Month      | FinancialItem        | `budget` (plan) | `actual` (feature ON) |
|------------|----------------------|-----------------|------------------------|
| March 2026 | `fi_mar` → `cat_groc`| 400             | **390** (computed)     |
| April 2026 | `fi_apr` → `cat_groc`| 400             | **420** (computed)     |

March's `actual` of 390 is the net of transactions, all pointing at `cat_groc`:

- 03 Mar · Tesco · **−250**
- 18 Mar · Sainsbury's · **−150**
- 25 Mar · Tesco refund · **+10**

Net = −390 → spend of 390 in `fi_mar`. April's own transactions (different set,
same `cat_groc`) net to 420 in `fi_apr`. **Renaming** `cat_groc` to "Food"
re-labels both months at once; **merging** a stray "Grocries" category repoints
its FinancialItems *and* transactions onto `cat_groc`.

### One-time ship migration

When this feature ships:

1. Backfill `Category` rows from existing distinct `FinancialItem` labels,
   deduping conservatively (trim + case-insensitive exact match only — e.g.
   "Groceries" / "groceries " / "GROCERIES" → one category). **No fuzzy/typo
   matching** at migration time: the same fuzziness that merges typos would
   wrongly merge "Car insurance" with "Health insurance". Typos are left for the
   user to resolve via the Merge tool.
2. Add a nullable `categoryId` FK to `FinancialItem` and link each existing row
   to its backfilled category.

## Data model (Prisma)

### New: `Category`
- `id` (uuid), `userId` (uuid FK)
- `label` (mutable string — renaming touches one row, propagates by id)
- `type` (`ItemType`: INCOME | EXPENSE)
- `category` (`ExpenseCategory?`), `incomeCategory` (`IncomeCategory?`) — the
  grouping bucket, matching `FinancialItem`'s existing scheme
- `sortOrder` (int), `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- `@@index([userId, type, sortOrder])`

### New: `Account`
- `id` (uuid), `userId` (uuid FK)
- `name` (string), `type` (string?, optional institution/kind)
- `createdAt`, `updatedAt`, `deletedAt`
- Picked-or-created at import time; managed in Settings.
- `@@index([userId])`

### New: `Transaction`
- `id` (uuid), `userId` (uuid FK), `accountId` (uuid FK)
- `categoryId` (uuid FK, **nullable** — uncategorized allowed)
- `date` (Date — derives the budget month on the fly; no `periodId` stored)
- `amount` (`Decimal(14,2)`, **signed** — negative and positive both valid)
- `description` (string — raw text from the file)
- `note` (string?, optional user text)
- `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- `@@index([userId, accountId, date])` — serves the grouped-actual aggregate and
  cursor pagination
- index supporting the dedup fingerprint (`userId, accountId, date, amount`)

### Changed: `FinancialItem`
- Add `categoryId` (uuid FK, nullable) → `Category`.

### Changed: `UserSettings`
- Add `transactionsEnabled` `Boolean @default(false)`.

## Amount / actual semantics

- Amount is stored **signed**; the **category's type routes the side**. A
  transaction assigned to "Salary" (INCOME) adds to income; a negative
  "paying someone" transaction under an expense category adds to expense. The
  sign is preserved data, not the router. (Example: paying a person is a
  negative amount on an EXPENSE category — sign and side stay consistent.)
- `actual` for (category, month) = **net sum** of that category's signed
  transactions whose `date` falls in the month. Refunds (a credit on an expense
  category) net against spend; clawbacks net against income. Normalized so
  "spend" reads positive on expense rows.
- Computed via a single `groupBy(categoryId)` aggregate per month with a
  date-range filter, backed by the `(userId, accountId, date)` index and
  React `cache()` for per-render dedup. No `periodId` on transactions; no
  denormalized counter.
- **Uncategorized** transactions contribute to no `actual`. They are surfaced
  in the transactions table (filter + persistent count nudge) so nothing rots,
  but are never auto-assigned to a catch-all category and never block import.

## Settings page additions

The Settings page gains (kept compact):

- **Transactions toggle** — `transactionsEnabled`, default off.
- **Categories management** — full CRUD plus:
  - **Rename** — mutates `label`; propagates everywhere by id.
  - **Merge** — pick a duplicate + a survivor; repoint every `FinancialItem`
    and `Transaction` from the dupe to the survivor, then delete the dupe.
    This is how the user collapses typos/variants ("Grocries" → "Groceries").
  - **Archive/Delete** — delete only when the category has no transactions;
    otherwise the user merges it into another first.
- **Accounts management** — simple CRUD.

## /transactions page (gated)

### Gating
- Server check at the top of the page **and** in every transactions server
  action (never trust the hidden nav). When `transactionsEnabled` is false,
  **redirect to `/dashboard`**.
- The nav link is shown only when the feature is enabled (the layout reads the
  setting and threads it to `NavBar`).

### Import flow (CSV, easy UI)
1. Upload a CSV.
2. App detects columns; user maps **date / amount / description**, picks the
   **date format** (resolves DD/MM vs MM/DD ambiguity), and picks/creates the
   **account** the statement belongs to.
3. **Preview with duplicate flags** — rows matching an existing transaction on
   **amount + date + description** (scoped to the account) are flagged; the user
   confirms keep or drop per flagged row. Import everything else. No silent
   drops, no separate review queue.
4. Commit.

### Transactions table
- **Cursor / keyset pagination** ordered `date desc, id` (fetch N+1, cursor in
  the URL) — stays fast at any depth, stable as new imports arrive.
- Filters: account, category, **Uncategorized**, date range, text search.
- Per-row category dropdown + **bulk-select → set category** for clearing
  batches.
- Manual **CRUD** of individual transactions.

## Budget page changes

- Both modes: choose-or-create category on a row.
- ON: `actual` is read-only from the grouped aggregate; categories with
  transactions in the period are force-shown; the budget (plan) value stays
  editable so the user can budget ahead of spend.
- On import / categorize / edit / delete / merge, invalidate `/budget` and
  `/dashboard` via `revalidatePath` / cache tags (the existing pattern).

## Server lib & validation

- New parsing/import module (CSV → rows), dedup fingerprint helper, and
  transaction/category/account server actions, all behind zod schemas at the
  input boundary (consistent with the existing budget/balance actions).
- Every action enforces auth independently and applies `userId` scoping as the
  primary boundary (per ADR-002), with RLS policies added as defence-in-depth
  for the new tables.

## Testing

- Unit (Jest): normalization/dedup of category labels at migration; signed-sum
  `actual` aggregation (including refund/clawback netting); CSV parsing +
  date-format handling; duplicate fingerprinting; cursor pagination helper.
- E2E (Playwright): toggle reveals nav + page; gate redirects when off; import
  → map → dedup-confirm → categorize → budget `actual` reflects the sum.
- Prisma-touching tests require real Postgres (per CLAUDE.md) — spin up the
  Docker Postgres service when those land.

## Open questions / risks

- **Category type vs. transaction:** changing a category's type/bucket after it
  has transactions reshuffles which side its actuals land on. Acceptable; the
  management UI should make the consequence clear.
- **Merge correctness:** merge must be transactional (repoint + delete in one
  transaction) to avoid orphaning references.
- **Merge same-period collision:** if both the survivor and the dupe have a
  `FinancialItem` in the *same* period (e.g. both "Groceries" and "Grocries"
  were budgeted in March), merging would leave two rows for one category in one
  month. Rule: **combine them** — sum the `budget` values into the survivor's
  row and delete the dupe's row. Transactions just repoint (no collision, since
  they reference the category, not a per-month row).
- **Migration on large existing data:** backfill should be a single migration
  step; conservative dedup keeps it deterministic.
