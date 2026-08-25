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
| Observation | what it was **worth this month** | `BalanceItem` (budget side: `FinancialItem`) |
| Assumption | how it **behaves in future** | `PlanAsset` / `PlanLiability` |

`Account` carries `kind`, `category`, `wrapper`, `canImportTransactions` and
`linkedAccountId`. `BalanceItem` and `FinancialItem` each gained a nullable
`accountId` — nullable because unlinked and legacy rows still parse, with
`label` staying as the fallback exactly as it always was. P1 only wires the
balance side; the budget side (`FinancialItem.accountId`) landed in the schema
so the delete path is honest (see "What P1 does not do," below), but nothing
writes it yet.

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

## `Account.kind`, `category`, `wrapper`

`Account.type` — free text, written by nothing, read only by an assertion
that it was null — is dropped. In its place:

- **`kind`** (`ASSET | LIABILITY | NONE`) — `NONE` is a plain transaction
  account that isn't itself a balance-sheet line.
- **`category`** reuses `BalanceItemCategory` (the term buckets: Current,
  Medium-term, Long-term, Property, Other) rather than a parallel enum.
- **`wrapper`** reuses `PlanAssetWrapper` (ISA, GIA, pension, …), asset-only —
  a tax wrapper describes what you own, not what you owe.

**`canImportTransactions` is the user's choice, not a derived fact.** Plenty
of mortgage providers issue statements, and someone who wants that ledger
should have it. The Add drawer defaults it from `(type, category)` —
`AddAccountDrawer.tsx` via `defaultCanImportTransactions` in
[`src/lib/accounts/accountDraft.ts`](../../src/lib/accounts/accountDraft.ts):
true for an asset that isn't a property, false otherwise — and once the user
touches the checkbox directly, that choice sticks through further `type`/
`category` changes in the same form session. It stays editable afterwards from
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

## Adding an account

One `+ Add` button on the Balance page opens `AddAccountDrawer.tsx`, which
asks Asset/Liability, a required Section (no default — `OTHER` is a bucket
things fall into and never leave, so defaulting into it would be a silent
misfile), a Wrapper for assets, a value, and the import checkbox.

**Asset → Property** adds an "Is there a mortgage on it?" branch. Ticking it
creates the property account, the liability account, the `linkedAccountId`
pairing, and both accounts' first `BalanceItem` in one `$transaction`
(`createAccountWithBalance` in
[`accountActions.ts`](<../../src/app/(app)/balance/accountActions.ts>)) — the
atomic-server-action rule applies here as everywhere else. The mortgage side
is always filed `LIABILITY` / `LONG_TERM` regardless of what the property's
own category is, and never offers its own import checkbox — it mirrors the
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
  does), deletes its `BalanceItem`s, `FinancialItem`s, `Transaction`s and
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

- **Legacy rows still render.** `BalanceItem.label` remains populated and
  `accountId` stays nullable, so a row without an account displays exactly as it
  always did and deletes through the old path. `prisma/seed.ts` still creates
  rows this way, so local development exercises that path — see Known gaps.
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
- **The budget side is schema-only.** `FinancialItem.accountId` exists so the
  delete path (`deleteAccountEverywhere`) is honest about what it removes, but
  nothing writes it — there's no budget Add drawer, no `ItemType.TRANSFER`,
  and `TransfersPanel` is untouched. That's all P3.
- **`canImportTransactions` isn't consulted anywhere yet** — see the note
  under `canImportTransactions` above. Wiring the import-target picker and the
  ledger filter to it wasn't part of any task in this phase.
- **Holdings inside an account** (an ISA as £38k VWRL + £4.3k cash rather than
  one typed value) — designed for, not built. See the design doc's "Designed
  for, not built" section.

## Code map

| Concern | File |
|---|---|
| `AccountKind` enum, `Account.kind`/`category`/`wrapper`/`canImportTransactions`/`linkedAccountId`, `BalanceItem`/`FinancialItem`/`BalanceTemplateItem.accountId` | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
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

### Testing

- **Unit** — `accountDraft.test.ts` (import-checkbox default/stickiness,
  submit gating), `creation.test.ts` (pure data shaping),
  `deletion.test.ts` (property-row and confirm-text rules),
- **Integration** (`*.int.test.ts`, real Postgres) —
  `schema.int.test.ts` (columns and defaults),
  data produces the same result), `balanceAccountActions.int.test.ts`
  (create-with-mortgage transaction, archive/restore, both delete modes),
  `copyForward.int.test.ts` (accountId survives copy-forward and template
  copy), `accountActions.int.test.ts` (Settings-side rename/import-toggle/
  delete-when-unreferenced).
- **Component** — `AddAccountDrawer.test.tsx`, `DeleteAccountPanel.test.tsx`,
  `AccountManager.test.tsx`.
- **E2E** — [`e2e/balance-accounts.spec.ts`](../../e2e/balance-accounts.spec.ts):
  adding an asset, a mortgaged property (both sides created), stop-tracking
  into the Settings archive, and delete-everywhere. Server-action journeys,
  so chromium-gated per the repo's browser-coverage rule.

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

- **`prisma/seed.ts` still creates balance rows with no `accountId`.** Local
  development therefore starts with legacy-shaped rows that no longer have a
  migration to link them. That is currently useful — it keeps the null-`accountId`
  path in `BalanceSheet` exercised, and that path is real code — but P2 raised
  the cost: `latestReality` reads *accounts*, so an unlinked balance row
  contributes nothing to a plan, and a plan created from seeded data comes up
  with no asset rows at all. The seed should create accounts and link its rows,
  so `make db-reset` yields data shaped like production.
- **`docs/DataModels/DataModels.md` still describes `Account` as
  transactions-only** ("where money sits — current, savings, ISA, SIPP"). P2
  widened the gap rather than closing it: the plan's `accountId`/`categoryId`
  links aren't described there either. Still deferred — it wants doing
  alongside the P3 budget-side changes, not piecemeal.
