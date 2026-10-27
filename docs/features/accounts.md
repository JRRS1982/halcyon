# Accounts: the durable registry

**What:** The registry of everything a user owns or owes. Each month's balance entry is an *observation* of an account, not a free-typed label.  
**Key points:**
- `Account.type` (`CURRENT_ACCOUNT`, `SAVINGS`, `MORTGAGE`, …) is the one stored classification; `kind` (asset or liability) and `wrapper` (ISA, pension, …) are derived from it, never stored
- One live `BalanceItem` per account per month
- `AccountTerms` carries up to nine projection parameters that Plan Sync mirrors
- Archiving hides an account from this month onward and keeps earlier history; "delete everywhere" removes the account and its data for good
- At most 500 live accounts per user (`MAX_ACCOUNTS_PER_USER`, `src/lib/accounts/limits.ts`); every account is created through `createAccountWithinCap`

Balance rows used to be free-text labels, matched month to month by the label and typed a second time into the plan. Nothing stable existed for the plan to point at. `Account` is that stable thing. The original design is in
[the design doc](../superpowers/specs/2026-08-21-unified-accounts-design.md); this page records what was built and the decisions a reader would otherwise have to reverse-engineer. Every plan row links to the `Account` or `Category` it mirrors, and Sync refreshes them: see [`plan-sync.md`](plan-sync.md).

## The three-layer split

No column lives in two places:

| Layer | Holds | Model |
|---|---|---|
| Identity & classification | what the thing **is** | `Account` |
| Observation | what it was **worth this month** | `BalanceItem` (budget side: `BudgetItem`) |
| Assumption | how it **behaves in future** | `PlanAsset` / `PlanLiability` |

`Account` carries `type`, `section`, `canImportTransactions` and `linkedAccountId`.
`BalanceItem.accountId` is required, `ON DELETE CASCADE`, and fenced by a partial unique index on live rows (`BalanceItem_period_account_live` on `(periodId, accountId) WHERE deletedAt IS NULL`), so soft-deleted history never collides.
`BudgetItem.accountId` is nullable: a `TRANSFER` or `REPAYMENT` row anchors to an `Account` instead of a `Category`. See [`budget-transfers.md`](budget-transfers.md).

**The sheet lists accounts, not rows.** The balance page queries the user's
live accounts and left-joins the month onto them, so an account the user
hasn't got to yet still has a line with an empty cell to type into. A blank
cell is *not* a zero — clearing a value soft-deletes the observation rather
than recording £0, and the footer counts how many accounts are still without
one.

## Plan values are editable

The design doc made plan values read-only, to avoid two numbers for one thing. That decision was reversed: plan values are editable, so you can push a plan around without touching your records. Divergence is made visible instead of prevented: a Sync button that counts the rows it will change, a per-row indicator beside a diverged value, and a confirmation before anything is destroyed. The cost is accepted: two numbers exist while a row is diverged, and the screen shows both. The mechanism is in [`plan-sync.md`](plan-sync.md).

## `Account.type` is the stored fact; `kind` and `wrapper` are derived

The user picks *what the account is* once — "Stocks & Shares ISA", "Mortgage" —
and everything else about its classification follows from that:

- **`type`** (`AccountType`: `CURRENT_ACCOUNT SAVINGS CASH_ISA STOCKS_ISA SIPP
  FINAL_SALARY GIA PROPERTY OTHER_ASSET MORTGAGE CREDIT_CARD LOAN OVERDRAFT
  OTHER_DEBT`) — the one stored classification, required on every account.
- **`kind`** (asset or liability, `AccountKind`) and **`wrapper`** (ISA, GIA,
  pension, …, asset-only — a tax wrapper describes what you own, not what you
  owe) are **computed** from `type` by `kindOf` / `wrapperOf` in
  [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts).
  Neither is a column — nothing stores them, and nothing may write them.
- **`section`** (`AccountSection`) is the
  sheet grouping — Current, Medium-term, Long-term, Property, Other. It is
  the one classification the account owns rather than derives, and the user
  edits it from the sheet; `setAccountSection` refuses `PROPERTY` on a
  liability and appends the moved account to the end of its new section.

`BalanceItem` carries no mirrors: `periodId`, `accountId`, `value`, `notes` and `carriedOver` are the whole row. Every other fact about the account is read off the `Account`, never copied onto the observation.

**`canImportTransactions` is the user's choice, not a derived fact.** Plenty of mortgage providers issue statements. The Add drawer defaults it with `defaultCanImportTransactions` in [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) (true for an asset that isn't a property, false otherwise). Once the user touches the checkbox, that choice sticks through later `type`/`section` changes in the same form session. It stays editable from Settings → Accounts (`setAccountImports`).

It gates only the importable list: the import target picker and quick-add on `/transactions` (the `canImportTransactions: true` query in [`src/app/(app)/transactions/page.tsx`](../../src/app/(app)/transactions/page.tsx)). It does not gate transfer targets, the ledger's account filter, or the name shown on rows that already point at an account; those read an unfiltered list. An account with imports off, such as a mortgage, can therefore still be a transfer counterparty.

## Account terms

A mortgage's rate or a SIPP's fee used to be typed once into `PlanLiability`/`PlanAsset`, and Sync left it alone. `AccountTerms` moves those assumptions onto the account, 1:1 (`accountId` is its primary key), so Sync can keep them current like everything else it mirrors. See [`plan-sync.md`](plan-sync.md).

Nine parameters, three shapes:

| Shape | Parameters | Used by |
|---|---|---|
| Growth | `expectedReturnPct`, `feePct`, `minAccessAge` | asset types, varying which of the three |
| Final salary | `annualIncome`, `endDate` | `FINAL_SALARY` only |
| Debt | `interestPct`, `interestOnly`, `revisionDate`, `revisionRate`, `endDate` | liability types, varying which |

**Eight of the nine columns are nullable, and there is no CHECK constraint.** A blank means *take the default*, never *unknown*: a property with no `feePct` has no platform charges. `interestOnly` is `NOT NULL` defaulting to `false`, because a flag has no meaningful "unknown" and `false` already is the default. One table serves all fourteen types because each type asks for a subset of the nine, never a type-specific column.

**Which parameters a type prompts for is code, not schema.** `ACCOUNT_TYPES` in [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) declares a `terms` list per type (a mortgage asks for five, a current account for one) and `termsFor(type)` reads it back.

**The compiler does not require an entry per `AccountType`.** `ACCOUNT_TYPES` is a plain array. `terms` is a required member, so an entry can't be incomplete, but a fifteenth enum value compiles without an entry. Two things catch it: `kindOf`, `wrapperOf` and `termsFor` throw `Unknown account type` at runtime, and `accountDraft.derivation.test.ts` asserts `ACCOUNT_TYPES` has length 14. The `satisfies Record<AccountType, true>` pin in [`src/lib/balance/schemas.ts`](../../src/lib/balance/schemas.ts) covers only the zod `accountTypeSchema`, not this list.

**`endDate` means something different depending on kind.** On a liability it is the date the balance is repaid, and Sync lands it on `PlanLiability.endAge`. On `FINAL_SALARY` it is the date the pot converts to an income, landing on `PlanAsset.incomeFromAge`, because `endAge` exists only on `PlanLiability`.

**The card, not the row.** Clicking a row's name on the balance sheet opens `AccountCard`, which owns name, type, section and terms. Value and notes stay editable in place on the sheet. A refused type change (a linked mortgage or a `PROPERTY_SALE` event blocks it, as does switching between asset and liability) shows the server's sentence inline in the card.

**A type change does not delete terms, so nothing may read a stranded one.**
`setAccountType` leaves the `AccountTerms` row alone — silently destroying a
user's data because they corrected a misfiling is worse than ignoring the
value. The consequence is that an account can hold a parameter its current
type does not prompt for: a pension entered as `FINAL_SALARY` with an
`annualIncome`, corrected to `SIPP`, keeps it, and no SIPP card renders it. So
three things guard it, and none of them is a delete:

- `setAccountTerms` and `createAccount` **refuse** a payload naming a
  parameter the account's type does not prompt for (`disallowedTerms`), taking
  the type from the row rather than the payload.
- `AccountTermsFields` **emits only** the parameters it rendered
  (`promptedTerms`), and the Add drawer clears its terms draft when its type
  picker changes — so a value typed under one type is never submitted under
  another.
- Sync **ignores** a stranded value entirely: `reality.ts` gates every
  parameter on `termsFor(account.type)`, not on `kindOf`. That is the layer
  that matters, because it is the only one that can do anything about a value
  that is already stored. See
  [`plan-sync.md`](plan-sync.md#the-compare-set-four-fields-then-fourteen).

## Adding an account

The `+ Add` button on the Balance page opens `AddAccountDrawer.tsx`. It asks "What are you adding?" (one `AccountType`, picked from Assets and Liabilities groups), then a Section (pre-filled from the type's `defaultSection`, freely changed), a name, a value, and the import checkbox. Kind and wrapper are never asked for.

**Asset → Property** adds an "Is there a mortgage on it?" branch. Ticking it creates the property account, the mortgage account, the `linkedAccountId` pairing and both first `BalanceItem`s in one `$transaction` (`createAccount` in [`accountActions.ts`](<../../src/app/(app)/balance/accountActions.ts>)). The mortgage is always `type: MORTGAGE` in section `LONG_TERM`, whatever the property's section, and has no import checkbox of its own: its flag defaults to `false`.

## Deleting an account

`DeleteAccountPanel.tsx` offers two modes. Counts are fetched first (`accountDeletionCounts`), so the panel says "removes 14 monthly values", not "are you sure?".

- **Stop tracking it** (default): `archiveAccount` sets `Account.deletedAt` and soft-deletes the account's `BalanceItem`s from the current month onward. Earlier months keep their values, so the account still shows on those past sheets. It drops out of pickers and reappears with a Restore button in Settings → Accounts. Restore brings back the account only, not the months archived with it. No confirmation needed.
- **Delete it everywhere**: `deleteAccountEverywhere`, gated on typing `DELETE`. One `$transaction` deletes the account's `Transaction`s and `ImportBatch`es, its live `BalanceItem`s and `BudgetItem`s, clears links to it, then deletes the account. It refuses if a live transaction on a *surviving* account names this account as its transfer counterparty.

Settings → Accounts has a third, narrower path: `deleteAccount` soft-deletes an account only when no live transaction owns it or names it as a counterparty.

**Linked pairs prompt symmetrically, default asymmetrically.** When the account has a `linkedAccountId` partner (either direction, via `resolveLinkedPartnerId`), the panel always shows a second checkbox for it. Deleting the **property** pre-ticks the mortgage (you rarely keep a debt secured on a house you no longer hold). Deleting the **mortgage** leaves the property unticked (the commoner reason is that it's paid off). A property panel also points at the plan's `PROPERTY_SALE` event, so a sold house isn't purged and its proceeds lost from history.

## No legacy rows

Historical balance rows were free text. A one-time backfill (deleted; see PR #170) was never run in production, which held one user with eleven unlinked rows. Re-entering them through the Add drawer was better than migrating: the user chose each section deliberately, and the property/mortgage pair got a real `linkedAccountId`, which label-matching would not have produced. Every path that creates a `BalanceItem` now sets `accountId`, and `BalanceItem.label`, its `type`/`category`/`sortOrder` mirrors and `Account.kind`/`wrapper` are gone. The `@unique` on `Account.linkedAccountId` enforces one mortgage per property in the database.

## Not yet built

- **Retiring `PlanLiability.linkedAssetId`.** It still exists beside `Account.linkedAccountId`.
- **Holdings inside an account** (an ISA as £38k VWRL + £4.3k cash rather than one typed value). One invariant is adopted now to keep it reachable:

  > **An account's value is either observed or derived, never both.**

  Today every account observes its value directly through a typed `BalanceItem`. An account carrying a typed value alongside holdings that also sum to a value would double-count net worth, silently and across all history. When holdings are built, a holding is its own table, not a child `Account`: it has a ticker, a unit count and a unit price, and one price update revalues every account holding it. `BalanceItem` stays the monthly observation even for a derived account, written by the system rather than typed, so history and the balance-trend chart keep working.

## Code map

| Concern | File |
|---|---|
| `AccountType` enum, `Account.type`/`section`/`canImportTransactions`/`linkedAccountId`, required `BalanceItem.accountId` with its CASCADE and live-row partial unique index | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
| `kindOf` / `wrapperOf` / `accountTypesOfKind` — the derivations | [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) |
| Pure account-creation data shaping (primary + mortgage), `nextSortOrder` | [`src/lib/accounts/creation.ts`](../../src/lib/accounts/creation.ts) |
| Zod schemas for create / delete-everywhere, `accountTermsSchema`, `disallowedTerms`, `promptedTerms` | [`src/lib/accounts/schemas.ts`](../../src/lib/accounts/schemas.ts) |
| Delete-mode + property-row pure rules | [`src/lib/accounts/deletion.ts`](../../src/lib/accounts/deletion.ts) |
| Add-drawer draft state + import-checkbox default/stickiness | [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) |
| Create / archive / restore / deletion-counts / hard-delete server actions | [`src/app/(app)/balance/accountActions.ts`](<../../src/app/(app)/balance/accountActions.ts>) |
| Add-account drawer (Balance page) | [`src/app/(app)/balance/AddAccountDrawer.tsx`](<../../src/app/(app)/balance/AddAccountDrawer.tsx>) |
| Two-mode delete panel with linked-pair prompt | [`src/app/(app)/balance/DeleteAccountPanel.tsx`](<../../src/app/(app)/balance/DeleteAccountPanel.tsx>) |
| Settings → Accounts: archive list with Restore, rename, add (reuses the Add drawer), import toggle, delete | [`src/app/(app)/settings/AccountManager.tsx`](<../../src/app/(app)/settings/AccountManager.tsx>) |
| Settings-side account server actions (`setAccountImports`, `renameAccount` re-export, `deleteAccount`) | [`src/app/(app)/settings/accountActions.ts`](<../../src/app/(app)/settings/accountActions.ts>) |
| Copy-forward row shaping (`toCarriedOverRows`) for the balance sheet's "Fill from another month" | [`src/lib/balance/copyRows.ts`](../../src/lib/balance/copyRows.ts) |
| `AccountTerms` model, `termsFor(type)`, `ACCOUNT_TYPES[].terms` | [`prisma/schema.prisma`](../../prisma/schema.prisma), [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) |
| `setAccountTerms` / `setAccountType` / `setAccountSection` / `renameAccount` server actions | [`src/app/(app)/balance/accountActions.ts`](<../../src/app/(app)/balance/accountActions.ts>) |
| The 500-account cap and the one guarded create path | [`src/lib/accounts/limits.ts`](../../src/lib/accounts/limits.ts), [`src/lib/accounts/createWithinCap.ts`](../../src/lib/accounts/createWithinCap.ts) |
| The row's card: name/type/section/terms in one place, opened from the sheet's name cell | [`src/app/(app)/balance/AccountCard.tsx`](<../../src/app/(app)/balance/AccountCard.tsx>) |
| Per-type term fields rendered inside the card | [`src/components/accounts/AccountTermsFields.tsx`](../../src/components/accounts/AccountTermsFields.tsx) |
| One-line summary shown on the card's collapsed "Advanced" section | [`src/lib/accounts/termsSummary.ts`](../../src/lib/accounts/termsSummary.ts) |

### Testing

Paths are under `tests/`.

- **Unit** (`unit/lib/accounts/`): `accountDraft.test.ts` (import-checkbox default and stickiness, submit gating), `accountDraft.derivation.test.ts` (`kindOf`/`wrapperOf`/`defaultSectionOf` agree with `ACCOUNT_TYPES`, length 14), `accountDraft.terms.test.ts` (terms per type), `creation.test.ts`, `deletion.test.ts`, `termsSummary.test.ts`.
- **Component**: `unit/app/(app)/balance/` (`AddAccountDrawer`, `DeleteAccountPanel`, `AccountCard`), `unit/app/(app)/settings/AccountManager.test.tsx`, `unit/components/accounts/AccountTermsFields.test.tsx`.
- **Integration** (real Postgres): `integration/schema.accounts.integration.test.ts`, `integration/schema.accountTerms.integration.test.ts`, and under `integration/app/(app)/balance/` the `accountActions.*.integration.test.ts` files (create with mortgage, archive/restore, both delete modes, edits, limits, terms) plus `actions.copyForward.integration.test.ts`; `integration/app/(app)/settings/accountActions.integration.test.ts`.
- **E2E**: [`tests/e2e/balance-accounts.spec.ts`](../../tests/e2e/balance-accounts.spec.ts), seven journeys: adding an asset, a mortgaged property, stop-tracking into the Settings archive, delete-everywhere, an account with no value being listed and counted, renaming through the card reaching the budget's anchored row, and terms persisting through add and card edit. Chromium-gated, as server-action journeys.
