# Accounts: the durable registry

Before this feature, a "Vanguard ISA" was typed onto the balance sheet every
month as a free-text `label`, related to last month's row only by the label
matching, and typed a second time into the plan. Nothing stable existed for
the plan to point at, so the plan guessed everything it couldn't observe.

`Account` is now that stable thing. Each month's `BalanceItem` is an
*observation* of an account rather than a fact typed on its own. See
[the design doc](../superpowers/specs/2026-08-21-unified-accounts-design.md)
for the full reasoning — this doc covers what P1 actually built and the
decisions a reader would otherwise have to reverse-engineer.

P2 connected the plan to this registry: every plan row now links to the
`Account` or `Category` it mirrors, and one Sync button refreshes them. See
[`plan-sync.md`](plan-sync.md), which also records a decision this document's
design doc made and P2 reversed — see "Plan values are editable," below.

## The three-layer split

The design separates three kinds of datum so that no column lives in two
places:

| Layer | Holds | Model |
|---|---|---|
| Identity & classification | what the thing **is** | `Account` |
| Observation | what it was **worth this month** | `BalanceItem` (budget side: `BudgetItem`) |
| Assumption | how it **behaves in future** | `PlanAsset` / `PlanLiability` |

`Account` carries `type`, `section`, `canImportTransactions` and
`linkedAccountId` — `kind` and `wrapper` are derived from `type`, never
stored (see below).
`BudgetItem` gained a nullable `accountId`; **`BalanceItem.accountId` is
required**, `ON DELETE CASCADE`, and fenced by a partial unique index on live
rows (`BalanceItem_period_account_live` on `(periodId, accountId) WHERE
deletedAt IS NULL`) — one live value per account per month, with soft-deleted
history free to collide. P1 only wired the balance side; the budget side
(`BudgetItem.accountId`) landed in the schema so the delete path was honest
(see "What P1 does not do," below) but nothing wrote it. **P3 writes it**: a
budget row of kind `TRANSFER` or `REPAYMENT` anchors to an `Account` instead
of a `Category` — see [`budget-transfers.md`](budget-transfers.md).

**The sheet lists accounts, not rows.** The balance page queries the user's
live accounts and left-joins the month onto them, so an account the user
hasn't got to yet still has a line with an empty cell to type into. A blank
cell is *not* a zero — clearing a value soft-deletes the observation rather
than recording £0, and the footer counts how many accounts are still without
one.

## Plan values are editable — a P1 decision, reversed in P2

The P1 design doc's ["Where values are edited"](../superpowers/specs/2026-08-21-unified-accounts-design.md)
section made plan values **read-only**: a linked row would show the latest
month's figure greyed and annotated, with only assumptions editable. It
explicitly rejected a plan-side override because that "reintroduces two numbers
for one thing — the defect this work exists to remove."

**That is reversed. Plan values are editable.** The objection assumed
divergence would be *invisible*, and it was answered by making divergence
legible rather than by preventing it:

- a deliberate **Sync** button that says how many rows it will change,
- a **per-row indicator** showing the balance-sheet figure beside a diverged
  plan value,
- a **confirmation** before anything is destroyed.

What that buys is a plan you can push around to see what happens, without
touching your actual records. The cost is real and accepted: two numbers exist
while a row is diverged, and the screen always shows both.

The mechanism is [`plan-sync.md`](plan-sync.md). Neither document is stale —
this one describes the registry, that one describes how the plan tracks it.

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
- **`section`** (`AccountSection`, renamed from `BalanceItemCategory`) is the
  sheet grouping — Current, Medium-term, Long-term, Property, Other. It is
  the one classification the account owns rather than derives, and the user
  edits it from the sheet; `setAccountSection` refuses `PROPERTY` on a
  liability and appends the moved account to the end of its new section.

`BalanceItem` itself carries no mirrors either: `periodId`, `accountId`,
`value`, `notes`, `carriedOver` is the whole row. A month's figure for an
account observes that account — every other fact about it (`type`, `section`,
`kind`, `wrapper`) is read off the `Account` it points at, never copied onto
the observation.

**`canImportTransactions` is the user's choice, not a derived fact.** Plenty
of mortgage providers issue statements, and someone who wants that ledger
should have it. The Add drawer defaults it from the derived `(kind, wrapper)` —
`AddAccountDrawer.tsx` via `defaultCanImportTransactions` in
[`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts):
true for an asset that isn't a property, false otherwise — and once the user
touches the checkbox directly, that choice sticks through further `type`/
`section` changes in the same form session. It stays editable afterwards from
Settings → Accounts (`setAccountImports`).

**As built, nothing reads this flag yet.** The schema comment (and the design
doc) describe it gating the CSV-import target picker and the ledger's account
filter. In practice `/transactions` loads every account for the user
(`prisma.account.findMany({ where: { userId, deletedAt: null } })` in
[`src/app/(app)/transactions/page.tsx`](../../src/app/(app)/transactions/page.tsx))
and hands that same unfiltered list to `ImportPanel`, `QuickAdd` and the
ledger's filter — `canImportTransactions` isn't consulted anywhere in that
path. No task in this phase touched `transactions/`, so this isn't a
regression, but it also isn't the "gates the picker" behaviour the doc
describes elsewhere; wiring it up is unstarted work, not a design decision.

## Account terms

Assumption used to live only on the plan — a mortgage's rate, a SIPP's fee,
were things you typed once into `PlanLiability`/`PlanAsset` and Sync left
alone forever. `AccountTerms` moves them onto the account itself, 1:1 (its
`accountId` is the primary key, not a separate `id`), so they are a fact about
the account rather than a plan-only guess, and Sync can keep them current
like everything else it mirrors — see [`plan-sync.md`](plan-sync.md).

Nine parameters, three shapes:

| Shape | Parameters | Used by |
|---|---|---|
| Growth | `expectedReturnPct`, `feePct`, `minAccessAge` | asset types, varying which of the three |
| Final salary | `annualIncome`, `endDate` | `FINAL_SALARY` only |
| Debt | `interestPct`, `interestOnly`, `revisionDate`, `revisionRate`, `endDate` | liability types, varying which |

**Eight of the nine columns are nullable, and there is no CHECK constraint.**
A blank means *take the default*, never *unknown* — a property with no
`feePct` has no platform charges, which is true rather than an error. The
ninth, `interestOnly`, is `NOT NULL` with a `false` default rather than
nullable, and that's the same rule wearing a boolean's clothes: a flag has no
meaningful "unknown" the way a rate or a date does, so `false` — not
repaying interest-only — already *is* the default, and there's nothing for a
null to mean that `false` doesn't already say. That's also why one table
serves fourteen account types rather than fourteen tables: each type asks
for a subset of the nine, never a type-specific column.

**Which parameters a type prompts for is code, not schema.** `ACCOUNT_TYPES`
in
[`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts)
declares a `terms: TermField[]` per type — a mortgage asks for five, a
current account for one (`expectedReturnPct`) — and `termsFor(type)` reads it
back.

**Don't conflate the guarantee this actually gives with a stronger one it
doesn't** — this is exactly the mistake this feature's own
[`plan-sync.md`](plan-sync.md#the-compare-set-four-fields-then-fourteen)
warns against, one file over. `ACCOUNT_TYPES: readonly AccountTypeOption[]`
is a plain array. Because `terms` is a *required* member of
`AccountTypeOption`, an entry that omits it fails to compile — so a listed
type can never be listed *incompletely*. But nothing about the array itself
requires every `AccountType` enum value to *have* an entry: add a fifteenth
type to the enum and `ACCOUNT_TYPES` compiles exactly as it did before,
silently missing it. That is a real, if narrow, gap — nothing here would
call it out.

A genuine full-enum pin does exist in this codebase, just not for this
list: `ALL_ACCOUNT_TYPES satisfies Record<AccountType, true>` in
[`src/lib/balance/schemas.ts`](../../src/lib/balance/schemas.ts), which
`accountTypeSchema` derives its keys from. Add a fifteenth `AccountType` and
*that* fails to compile until `ALL_ACCOUNT_TYPES` learns it — but that pin
protects the `type` field's own zod validation, not `ACCOUNT_TYPES`'s terms
mapping; the two lists are independent, and nothing wires an update to one
into a requirement on the other.

**`endDate` means something different depending on kind.** On a liability
it's the date the balance is repaid, and Sync lands it on
`PlanLiability.endAge`. On `FINAL_SALARY` it's the date the pot converts to
an income instead, landing on `PlanAsset.incomeFromAge` — a dedicated column,
because `endAge` exists only on `PlanLiability`. Same column, opposite
destination, chosen by the account's `kind`.

**The card, not the row.** Clicking a row's name on the balance sheet opens
`AccountCard`, which owns name, type, section and terms in one place —
everything the row's toolbar and the Add drawer's advanced section used to
split between them. The row-scoped toolbar's *Change type* and *Move to
section* selects are gone; a refused type change (a linked mortgage or
`PROPERTY_SALE` event blocking it) now shows the server's own sentence
naming the blocker, inline in the card rather than as a toast. Value and
notes stay editable in place on the sheet itself, debounced, same as before
— only identity and assumptions moved into the card.

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

One `+ Add` button on the Balance page opens `AddAccountDrawer.tsx`, which
asks "What are you adding?" — one `AccountType` picked from Assets and
Liabilities optgroups — then a Section (pre-filled from the type's
`defaultSection` but freely changed; the user's own choice sticks through
further type changes), a name, a value, and the import checkbox. Kind and
wrapper are never asked for: they follow from the type.

**Asset → Property** adds an "Is there a mortgage on it?" branch. Ticking it
creates the property account, the liability account, the `linkedAccountId`
pairing, and both accounts' first `BalanceItem` in one `$transaction`
(`createAccount` in
[`accountActions.ts`](<../../src/app/(app)/balance/accountActions.ts>)) — the
atomic-server-action rule applies here as everywhere else. The mortgage side
is always `type: MORTGAGE`, filed in section `LONG_TERM` regardless of what
the property's own section is, and never offers its own import checkbox — it mirrors the
liability default (false).

## Deleting an account

Two modes, chosen rather than a bare confirm, in `DeleteAccountPanel.tsx`.
Counts are fetched first (`accountDeletionCounts`) so the panel can say "removes
14 monthly values," not "are you sure?"

- **Stop tracking it** (default) — `archiveAccount` sets `Account.deletedAt`.
  Every `BalanceItem` stays; the account drops off next month's sheet and out
  of pickers, and reappears with a Restore button in Settings → Accounts.
  Reversible, so it needs no confirmation.
- **Delete it everywhere** — `deleteAccountEverywhere`, gated on typing
  `DELETE`. One `$transaction`: clears any transfer references that point at
  the account from a *surviving* account (refusing outright if a live one
  does), deletes its `BalanceItem`s, `BudgetItem`s, `Transaction`s and
  `ImportBatch`es, then the account itself.

**Linked pairs prompt symmetrically, default asymmetrically.** Whenever the
account has a `linkedAccountId` partner (either direction —
`resolveLinkedPartnerId` checks both), the panel always shows a second
checkbox for it, never inferring or hiding the choice. Deleting the
**property** pre-ticks the mortgage (`isProperty` prop defaults `alsoLinked`
to `true` — you rarely keep a debt secured on a house you no longer hold);
deleting the **mortgage** leaves the property unticked (the commoner reason to
delete a mortgage is that it's paid off). A property panel also carries a line
pointing at the plan's `PROPERTY_SALE` event, so a sold house isn't purged and
its proceeds lost from history.

## There was a one-time backfill. It has been removed.

Historical balance rows were free text, so shipping this feature needed a
migration that gave each distinct label an `Account` and pointed its rows at
one. That code lived in `src/lib/accounts/backfill.ts` with a `make
backfill-accounts` entry point, and was written to be run deliberately rather
than as a deploy side effect — it was the one irreversible step in the phase.

**It was never run in production, and it has been deleted.** Production held a
single user with eleven unlinked rows, all in one month. Deleting those rows and
re-entering them through the Add drawer was better than migrating them: the user
chose each section and wrapper deliberately instead of inheriting
`inferWrapper`'s guesses, and the property/mortgage pair got a real
`linkedAccountId` — which the backfill would *not* have produced, because it
lifts links from an existing plan by matching labels, and "76 Victoria Ave"
does not match "76 Vic Ave Mortgage".

**It cannot be needed again.** Every path that creates a `BalanceItem` now sets
`accountId`: the Add drawer sets it directly, and both copy-forward paths carry
it through `toCarriedOverRows`. `createBalanceItemForMonth` — the last way to
create a row without one — was deleted during this phase.

The history is in PR #170 if the reasoning is ever needed again. What survives
from it and still matters:

- **There are no legacy rows left.** `BalanceItem.accountId` is now required:
  the type migration deleted the last null-`accountId` rows and the sheet's
  null-account path went with them. `label` was a mirror of the account's
  name; the Contract PR dropped it, along with `BalanceItem`'s `type`/
  `category`/`sortOrder` mirrors and `Account.kind`/`wrapper`.
- **The `@unique` on `Account.linkedAccountId`** means one mortgage per
  property, enforced by the database rather than by convention.

## What P1 does not do

Named so nobody builds these by accident, mirroring the design doc's own
scoping:

- **The Plan didn't read accounts in P1 — it does now.** P2 replaced
  `seedPlanChildren` and `PlanAsset.sourceBalanceItemId` with an `accountId`
  (and `categoryId`) on every plan row, refreshed by Sync; creating a plan is
  a Sync against an empty one. See [`plan-sync.md`](plan-sync.md).
  `PlanLiability.linkedAssetId` still exists alongside
  `Account.linkedAccountId` — retiring that duplication remains unstarted.
- ~~**The budget side is schema-only.**~~ **P3 wired it.**
  `BudgetItem.accountId` is now written by the budget sheet's `+ Transfer` and
  `+ Repayment` drawers, `ItemType` carries `TRANSFER` and `REPAYMENT`, and
  `TransfersPanel` has been deleted — a tagged transfer transaction no longer
  conjures a budget row, it fills the actual of a row the user added. The
  `Account.kind` a row may anchor to is fenced in the action:
  `TRANSFER` → `ASSET`, `REPAYMENT` → `LIABILITY`. See
  [`budget-transfers.md`](budget-transfers.md).
- **`canImportTransactions` isn't consulted anywhere yet** — see the note
  under `canImportTransactions` above. Wiring the import-target picker and the
  ledger filter to it wasn't part of any task in this phase.
- **Holdings inside an account** (an ISA as £38k VWRL + £4.3k cash rather than
  one typed value) — designed for, not built. One invariant was adopted now to
  keep it reachable:

  > **An account's value is either observed or derived, never both.**

  Today it costs nothing, because every account observes its value directly —
  a `BalanceItem` the user types. Break it, by letting an account carry a typed
  value *alongside* holdings that also sum to a value, and net worth
  double-counts the moment the first holding appears: silently, and
  retrospectively across every month of history. That is why the rule is
  written down before there is anything to apply it to.

  When holdings are built, a holding is its own table rather than a child
  `Account` — it has a ticker, a unit count and a unit price, where an account
  has a provider, an import flag, transfers aimed at it and possibly a linked
  mortgage. The decisive difference is quantity × price: £38k of VWRL is 412
  units at £92.23, so one price update revalues every account holding it. An
  account has a value; a holding has a position. `BalanceItem` stays as the
  monthly observation even for a derived account — written by the system rather
  than typed — so history and the balance-trend chart keep working untouched.

## Code map

| Concern | File |
|---|---|
| `AccountType` enum, `Account.type`/`section`/`canImportTransactions`/`linkedAccountId`, required `BalanceItem.accountId` with its CASCADE and live-row partial unique index | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
| `kindOf` / `wrapperOf` / `accountTypesOfKind` — the derivations | [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) |
| Pure account-creation data shaping (primary + mortgage) | [`src/lib/accounts/creation.ts`](../../src/lib/accounts/creation.ts) |
| Zod schemas for create / delete-everywhere | [`src/lib/accounts/schemas.ts`](../../src/lib/accounts/schemas.ts) |
| Delete-mode + property-row pure rules | [`src/lib/accounts/deletion.ts`](../../src/lib/accounts/deletion.ts) |
| Add-drawer draft state + import-checkbox default/stickiness | [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) |
| Create / archive / restore / deletion-counts / hard-delete server actions | [`src/app/(app)/balance/accountActions.ts`](<../../src/app/(app)/balance/accountActions.ts>) |
| Add-account drawer (Balance page) | [`src/app/(app)/balance/AddAccountDrawer.tsx`](<../../src/app/(app)/balance/AddAccountDrawer.tsx>) |
| Two-mode delete panel with linked-pair prompt | [`src/app/(app)/balance/DeleteAccountPanel.tsx`](<../../src/app/(app)/balance/DeleteAccountPanel.tsx>) |
| Settings → Accounts: archive list, rename, plain-account create, import toggle | [`src/app/(app)/settings/AccountManager.tsx`](<../../src/app/(app)/settings/AccountManager.tsx>) |
| Settings-side account server actions (`setAccountImports`, rename, plain delete) | [`src/app/(app)/settings/accountActions.ts`](<../../src/app/(app)/settings/accountActions.ts>) |
| Copy-forward row shaping shared by month-to-month and template copy | [`src/lib/balance/copyRows.ts`](../../src/lib/balance/copyRows.ts) |
| `AccountTerms` model, `termsFor(type)`, the `ACCOUNT_TYPES[].terms` exhaustiveness pin | [`prisma/schema.prisma`](../../prisma/schema.prisma), [`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts) |
| `accountTermsSchema`, `setAccountTerms`/`setAccountType`/`setAccountSection`/`renameAccount` server actions | [`src/lib/accounts/schemas.ts`](../../src/lib/accounts/schemas.ts), [`src/app/(app)/balance/accountActions.ts`](<../../src/app/(app)/balance/accountActions.ts>) |
| The row's card: name/type/section/terms in one place, opened from the sheet's name cell | [`src/app/(app)/balance/AccountCard.tsx`](<../../src/app/(app)/balance/AccountCard.tsx>) |
| Per-type term fields rendered inside the card | [`src/components/accounts/AccountTermsFields.tsx`](../../src/components/accounts/AccountTermsFields.tsx) |
| One-line summary shown on the card's collapsed "Advanced" section | [`src/lib/accounts/termsSummary.ts`](../../src/lib/accounts/termsSummary.ts) |

### Testing

- **Unit** — `accountDraft.test.ts` (import-checkbox default/stickiness,
  submit gating), `creation.test.ts` (pure data shaping),
  `deletion.test.ts` (property-row and confirm-text rules),
  `accountTerms.test.ts` (`termsFor` maps every one of the fourteen types to
  its declared fields), `termsSummary.test.ts` (the collapsed-section
  one-liner per type).
- **Integration** (`*.int.test.ts`, real Postgres) —
  `schema.int.test.ts` (columns and defaults),
  data produces the same result), `balanceAccountActions.int.test.ts`
  (create-with-mortgage transaction, archive/restore, both delete modes),
  `copyForward.int.test.ts` (accountId survives copy-forward and template
  copy), `accountActions.int.test.ts` (Settings-side rename/import-toggle/
  delete-when-unreferenced), `accountTerms.int.test.ts` (the 1:1 relation and
  its cascade), `createAccountTerms.int.test.ts` (a new account's terms row),
  `setAccountTerms.int.test.ts` (ownership fence, cross-user rejection).
- **Component** — `AddAccountDrawer.test.tsx`, `DeleteAccountPanel.test.tsx`,
  `AccountManager.test.tsx`, `AccountCard.test.tsx` (name/type/section/terms
  saving through their own actions, the type-change refusal sentence shown
  inline), `AccountTermsFields.test.tsx` (per-type field rendering, blank
  clears to null).
- **E2E** — [`e2e/balance-accounts.spec.ts`](../../e2e/balance-accounts.spec.ts):
  six journeys — adding an asset, a mortgaged property (both sides created),
  stop-tracking into the Settings archive, delete-everywhere, an account with
  no value being listed and counted, and renaming on the sheet reaching the
  budget's anchored row. Server-action journeys, so chromium-gated per the
  repo's browser-coverage rule.

## Two unrelated fixes that rode along with this phase

Two commits on this branch fix pre-existing bugs unrelated to accounts,
surfaced while building and testing this feature:

- **Debounced saves cancelled each other across cells.**
  `useDebouncedCallback` held one timer keyed by argument count, so editing
  one balance/budget cell and then a different one within 500ms silently
  discarded the first edit's save. Fixed by keying the debounce explicitly
  per call site (`src/lib/hooks/useDebouncedCallback.ts`) rather than by
  argument shape.
- **`prisma/seed.ts` still passed `type` to `Account.create()`**, a field
  Task 1 of this phase dropped in favour of `kind`. This silently broke
  `make db-reset` for anyone reseeding after pulling this branch.

## Known gaps

- **`docs/DataModels/DataModels.md` still describes `Account` as
  transactions-only** ("where money sits — current, savings, ISA, SIPP"). P2
  widened the gap rather than closing it: the plan's `accountId`/`categoryId`
  links aren't described there either. P3 has now widened it again —
  `ItemType` has four members and `BudgetItem` anchors to an `Account` — so
  the "do it alongside P3" plan has expired without being carried out. The
  per-feature docs (this one, [`plan-sync.md`](plan-sync.md) and
  [`budget-transfers.md`](budget-transfers.md)) are the accurate description of
  all three phases; `DataModels.md` is the
  one that needs rewriting, and it is now a task of its own rather than a
  rider on someone else's.
