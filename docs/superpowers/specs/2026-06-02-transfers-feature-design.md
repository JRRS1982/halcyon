# Transfers Feature — Design

**Status:** Implemented
**Date:** 2026-06-02
**Builds on:** [`2026-05-30-transactions-feature-design.md`](2026-05-30-transactions-feature-design.md)

## Summary

When categorizing a transaction, a user may face money that is **neither income
nor expenditure** — a transfer between two of their own accounts (e.g. Current →
ISA, Current → SIPP). It is still within their domain of control, so it must not
count toward the budget's income or expense sides, but it should be visible.

This feature lets a user tag a transaction as a **Transfer** and name the
counterparty account it moved to/from. Tagged transfers are excluded from all
income/expense/net maths and instead surface in a new, opt-in **Transfers
section** on the budget page that totals transfer flow **per account** for the
period. Accounts gain full CRUD management in Settings.

## Goals

- A per-user setting `transfersEnabled` (default **off**), living in Settings
  next to `transactionsEnabled`, that reveals the budget Transfers section.
- A `Transfer` choice in the existing categorize combobox that, when picked,
  requires a counterparty **account** (prompting inline account creation when
  none exist).
- A transaction tagged as a transfer is **off-budget**: it contributes to no
  category `actual`, no income, no expense.
- Full **Account** CRUD in Settings (create / rename / delete), mirroring the
  existing Categories manager.
- A budget **Transfers section**, auto-populated, one row **per account** with a
  signed net for the period, each row expandable to its counterparty breakdown.

## Non-goals (explicitly out of scope for v1)

- **Leg linking.** A real transfer has two legs (−500 out of Current, +500 into
  ISA) that appear as two independent transaction rows, on different accounts,
  for different amounts/dates/refs. We do **not** match or link them into a
  single entity — there is no benefit that justifies the matching logic and edge
  cases (no-match, partial, fees). Each leg is tagged independently.
- **Account merge.** Categories support merge because free-typing breeds typos;
  accounts are created deliberately in Settings or at import, so v1 has no merge.
- **Per-account balances.** As in the transactions spec, accounts carry no
  running balance; the Transfers section reports *flow*, not balance.
- **Transfer auto-detection** (e.g. guessing a transfer from description text).
  The user tags transfers manually.

## Core model: a transfer is an off-budget transaction with a counterparty

A transaction is now in exactly **one of three states**:

1. **Categorized** — `categoryId` set → rolls into that category's budget
   `actual` (today's behaviour, unchanged).
2. **Transfer** — `transferAccountId` set → off-budget; surfaces in the
   Transfers section only.
3. **Uncategorized** — neither set → surfaced as needing attention (today's
   behaviour, unchanged).

`categoryId` and `transferAccountId` are **mutually exclusive**: tagging a
transfer clears any category, and assigning a category clears the transfer
counterparty. This is enforced in the server action, not just the UI.

Crucially, **no new entity and no leg-linking**. A transfer is just a normal
`Transaction` row that points at a second `Account` (the counterparty) instead
of a `Category`. Because the existing `actual` aggregate only sums rows that
have a `categoryId` of a given type, transfers fall out of income/expense
automatically — `netActual` is untouched.

### Direction is read from the sign, not stored

The user picks only the counterparty account, never a direction. The
transaction's signed `amount` already encodes direction relative to its owning
account:

- `−500` on Current, counterparty ISA → money **left** Current toward ISA.
- `+500` on ISA, counterparty Current → money **arrived** in ISA from Current.

The UI renders "→ ISA" / "← Current" from the sign. No direction field.

## Per-account totalling (and why, not pair rows)

The Transfers section keys each row by the transaction's **owning account** (the
account whose statement the row came from), summing the signed transfer amounts
on that account for the period.

Worked example — both statements imported:

| Account | Transfer lines on its statement | Row total      |
|---------|----------------------------------|----------------|
| Current | `−500 → ISA`, `−200 → SIPP`       | **−700** (out) |
| ISA     | `+500 ← Current`                 | **+500** (in)  |
| SIPP    | `+200 ← Current`                 | **+200** (in)  |

Each row equals exactly the transfer lines on that account's own statement, so
it always reconciles against the real bank statement. Because the two legs of a
single real transfer live on **two different accounts' rows**, they can never be
summed into one figure — **double-counting is impossible by construction**, with
no linking, no dedup, and no "count one side only" rule.

A pair-keyed row (`Current ↔ ISA`) was considered and rejected: it matches the
user's "relationship" phrasing but double-counts whenever both sides of a
transfer are imported, forcing an arbitration rule. The per-account row recovers
the relationship view by **expanding each row to its counterparty breakdown**
(`Current −700 → ISA −500, SIPP −200`) without the arithmetic trap.

Importing only one side (the common case — destination accounts like ISA/SIPP
often aren't imported) shows just that side's row; nothing is missing or
doubled.

## Data model (Prisma)

### Changed: `Transaction`
- Add `transferAccountId String? @db.Uuid` → `Account` (the counterparty),
  `onDelete: SetNull` is **not** used here — see deletion rule below; the FK is
  `Restrict`/guarded at the app layer so a referenced account can't vanish.
- Relation back to `Account` as a second, named relation (the existing
  `accountId` is the owning account; this is the counterparty). Both point at
  `Account`, so the Prisma relations need explicit names.
- Add an index supporting the per-account period aggregate over transfers:
  `@@index([userId, accountId, date])` already exists and serves it (filter
  `transferAccountId IS NOT NULL`, group by `accountId`, range on `date`).

### Changed: `Account`
- Add the inverse relation for the counterparty link (e.g.
  `transfersIn Transaction[] @relation("TransferCounterparty")`) alongside the
  existing `transactions` relation (owning account).

### Changed: `UserSettings`
- Add `transfersEnabled Boolean @default(false)`.

## Amount / actual semantics

- A transfer transaction's `amount` stays **signed**, exactly as stored. It is
  simply **omitted** from every category `actual` aggregate (the aggregate
  already filters on `categoryId`/type, and a transfer has no category).
- The Transfers section sum for an account = signed sum of that account's
  transfer-tagged transactions whose `date` falls in the period. Sign is
  preserved (net out reads negative, net in reads positive). No orientation flip
  — unlike budget `actual`, "in vs out" is the whole point here.
- Transfers never touch income, expense, net, or net-worth figures anywhere
  (budget page, dashboard charts, balance sheet).

## Categorize UX (combobox)

The existing `CategoryCombobox` (`src/app/transactions/CategoryCombobox.tsx`)
gains a **Transfer ▸** entry in the popover, shown above/below the category list:

1. Selecting **Transfer ▸** swaps the panel to an **account picker** (the user's
   accounts, searchable, same interaction as the category list).
2. If the user has **no accounts**, the panel shows an inline "create your first
   account" field instead, then proceeds to the picker.
3. Picking an account calls a new `onTransfer(accountId)` handler → server action
   sets `transferAccountId` and clears `categoryId`.
4. The trigger then renders the transfer state (e.g. "Transfer → ISA"),
   distinct from a category chip and from "— Uncategorized —".

This keeps a single control for "what is this transaction?" — category, transfer,
or nothing — matching the user's request that selecting Transfer reveals a
required from/to-account field.

## Settings page additions

- **Transfers toggle** — `transfersEnabled`, default off. Only meaningful when
  Transactions is enabled (transfers are transactions); shown in the same
  section, visually subordinate to / disabled when `transactionsEnabled` is off.
- **Accounts management** — a new manager mirroring `CategoryManager.tsx`:
  - **Create** — name (+ optional `type` label).
  - **Rename** — mutates `name`; propagates by id everywhere.
  - **Delete** — **blocked** while the account owns transactions *or* is named
    as a transfer counterparty by any transaction. The user reassigns/clears
    those first. (Soft-delete via `deletedAt`, consistent with categories.)
  - **No merge** in v1.

Accounts are also still pick-or-created at CSV import time (unchanged); the
Settings manager and the import picker read the same `Account` list.

## Budget page changes

- A new **Transfers section** renders **only when `transfersEnabled`** is true
  (and Transactions is on). It sits apart from the income/expense sections.
- One row per account with transfer activity in the period, showing the signed
  net, ordered by account name for stable display.
- Each row **expands** to its counterparty breakdown — one line per counterparty
  account with its signed subtotal (e.g. `Current −700 → ISA −500, SIPP −200`).
- Accounts with no transfer activity in the period are omitted (the section is
  derived, like force-shown categories — it never shows empty rows).
- On import / tag-as-transfer / edit / delete, invalidate `/budget` and
  `/dashboard` via the existing `revalidatePath` / cache-tag pattern.

## Server lib & validation

- New/extended server actions: `setTransactionTransfer(transactionId,
  accountId)` (sets counterparty, clears category) and the inverse already
  covered by the existing set-category action (which must now also clear
  `transferAccountId`). Account CRUD actions mirror the category actions.
- A `transfersByAccount(userId, periodStart, periodEnd)` query: grouped signed
  sum over transfer-tagged transactions, plus a counterparty breakdown, behind
  React `cache()` and the existing `(userId, accountId, date)` index.
- All actions enforce auth independently and apply `userId` scoping as the
  primary boundary (ADR-002), with RLS policies added for the new column/queries
  as defence-in-depth. Inputs validated with zod at the boundary.
- The transactions gate already redirects when `transactionsEnabled` is off;
  the Transfers section additionally checks `transfersEnabled` server-side
  before querying — never trust the hidden UI.

## Testing

- **Unit (Jest):** per-account transfer netting (signed, multi-counterparty);
  mutual-exclusion helper (assigning a category clears transfer and vice versa);
  sign→direction label derivation.
- **Integration (`*.int.test.ts`, real Postgres):** `setTransactionTransfer`
  clears `categoryId`; set-category clears `transferAccountId`; account delete
  blocked while referenced as owner or counterparty; `transfersByAccount`
  grouping/breakdown against seeded rows; transfers excluded from category
  `actual` aggregate.
- **E2E (Playwright):** Settings toggle reveals the budget Transfers section;
  Accounts CRUD; categorize → Transfer → pick account (incl. inline-create when
  none) → row appears in Transfers section and is absent from income/expense.

## Open questions / risks

- **Both legs imported and tagged:** per-account totalling means each leg shows
  on its own account row — correct and non-inflating, but the user should
  understand a single real transfer can appear as two rows (one −, one +). A
  short section hint covers this.
- **Changing a transfer back to a category (or vice versa):** must be atomic
  (clear one, set the other in one action) to avoid a row that is briefly both.
- **Account delete vs history:** blocking delete while referenced (owner or
  counterparty) keeps Transfers/ledger totals intact; soft-delete preserves
  historical rows. Reassignment tooling beyond "clear it first" is out of scope.
- **Self-counterparty:** the account picker must exclude the transaction's own
  owning account (a transfer to itself is meaningless); enforced in UI + action.
