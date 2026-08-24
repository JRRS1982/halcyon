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

## The backfill — read this before running it in production

`src/lib/accounts/backfill.ts` gives every historical, unlinked `BalanceItem`
an `Account`, run once per user via `backfillAccountsForUser`.

**It is temporary.** Delete `src/lib/accounts/backfill.ts`,
`scripts/backfill-accounts.ts`, the `backfill-accounts` Make target, and their
tests (`src/__tests__/accounts/backfill.test.ts`,
`backfill.int.test.ts`) once the production run has completed and been
verified. Nothing else depends on this code after that point — leaving it in
only invites someone to run it again "just in case" against data it no longer
applies to.

**What it does, per user, inside one transaction:**

1. Every distinct `(type, label)` pair among that user's unlinked
   `BalanceItem`s becomes one `Account` (or is matched onto an existing
   account of the same name — including promoting a plain `kind: NONE`
   transaction account into an asset/liability once a balance row proves it's
   also a balance-sheet line). Every row sharing that pair takes the same
   `accountId`.
2. A freshly created asset account gets `wrapper` from the existing
   `inferWrapper` heuristic (`src/lib/plan/seed.ts`) — guessing once during
   migration is accepted; the point of the feature is that nothing guesses
   afterwards. (`PlanLiability.interestPct` needs no equivalent step here: it
   was already set at plan-creation time by `inferInterestPct`, and the
   backfill doesn't touch `PlanLiability` at all.)
3. `PlanLiability.linkedAssetId` pairings are lifted onto
   `Account.linkedAccountId` by `linkMortgagesToProperties` — see "The
   `PlanLiability` matching residual" below for how the two sides of that
   pairing are resolved differently.

**It's idempotent — for runs that don't overlap.** A second, later run reads
only rows with `accountId: null` and only creates an account when no matching
one exists, so it reports `0 accounts created, 0 rows linked` (the script's
final summary line phrases it as "N accounts created, N balance rows linked")
and touches nothing. This is safe by construction, not by convention — there's
no "already ran" flag to get out of sync. It is **not** safe against two runs
*for the same user* overlapping in time: there's no advisory lock, so two
concurrent invocations can both read the same unlinked rows before either has
written anything, and both create an account for the same (type, label) pair.
Run it sequentially, one user at a time.

### Running it against production

There is no production container, so this is a local, one-shot invocation with
the production URL injected for that single command and never written to a
file:

```bash
DATABASE_URL="$PROD_DIRECT_URL" DIRECT_URL="$PROD_DIRECT_URL" pnpm backfill:accounts
```

**Ordering matters.** `migrate-prod` applies the schema on push to `master`,
*before* Vercel deploys. The app works fine with every `BalanceItem.accountId`
still null — that's why `label` stays populated on every row regardless — so
the backfill is not part of the deploy pipeline and is run deliberately
afterwards, once the deploy is confirmed live.

### Rollback, and its one weakness

Undo is:

```sql
UPDATE "BalanceItem" SET "accountId" = NULL WHERE "accountId" IN (...);
DELETE FROM "Account" WHERE id IN (...) AND "createdAt" >= '<run start timestamp>';
```

**Nothing marks which accounts the backfill created.** There is no batch id
or flag column on `Account` — `createdAt` compared against the run's start
time is the only thing to lean on, and it also can't distinguish a
backfill-created account from one a user happened to create in the same
window by coincidence. It's also incomplete in a way the two-statement sketch
above doesn't show: an account the backfill *matched and promoted* (a
pre-existing `kind: NONE` account whose `kind`/`category`/`wrapper` got
written in step 1) isn't a new row, so deleting "accounts created after the
run started" doesn't touch it — nor does it undo a `linkedAccountId` written
onto a pre-existing liability account in step 3. Rolling back a promoted
account means resetting `kind` to `NONE` and clearing `category`/`wrapper`/
`linkedAccountId` by hand.

**The 60-second transaction cap.** `backfillAccountsForUser` wraps the whole
per-user run in one `prisma.$transaction(..., { timeout: 60_000 })`. A user
with enough unlinked balance rows to exceed that window fails, rolls back
completely (partial progress is not kept — that's what makes the transaction
safe to retry), and never converges on retry, because the same rows are still
there next time. Check the largest user's row count before running this
against production.

### The `PlanLiability` matching residual

`linkMortgagesToProperties` resolves the two sides of a mortgage↔property pair
differently. The **property** side resolves through
`PlanAsset.sourceBalanceItemId` first — a real foreign key, populated whenever
the plan asset was seeded from a balance row — and only falls back to
label-matching when that's null. The **liability** side has no equivalent
column, so it is always matched by label. In practice this means: a plan and a
balance sheet that disagree about a mortgage's name simply won't link (safe,
just inert), but two mortgages with confusable labels could in principle pair
with the wrong property. Nothing detects that case; it's a known, accepted
residual rather than a bug to fix here.

## What P1 does not do

Named so nobody builds these by accident, mirroring the design doc's own
scoping:

- **The Plan doesn't read accounts yet (P2).** It keeps seeding from
  `seedPlanChildren` exactly as before; `PlanAsset.sourceBalanceItemId` and
  `PlanLiability.linkedAssetId` are still the live pairing mechanism until P2
  switches the builder over.
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
| One-time migration: unlinked balance rows → accounts, mortgage↔property link lift | [`src/lib/accounts/backfill.ts`](../../src/lib/accounts/backfill.ts) |
| Backfill CLI entry point | [`scripts/backfill-accounts.ts`](../../scripts/backfill-accounts.ts), `make backfill-accounts` |
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
  `backfill.test.ts` (the mortgage-link arbitration function in isolation).
- **Integration** (`*.int.test.ts`, real Postgres) —
  `schema.int.test.ts` (columns and defaults), `backfill.int.test.ts` (the
  full per-user run, including idempotency — running it twice over the same
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

- **`canImportTransactions` gates nothing yet** (see above) — the next step
  is filtering `ImportPanel`'s and the ledger's account list on it, per the
  original intent in the schema comment.
- **`docs/DataModels/DataModels.md` still describes `Account` as
  transactions-only** ("where money sits — current, savings, ISA, SIPP");
  it wasn't updated as part of this phase and should be, alongside the P2/P3
  docs updates once the Plan and budget sides land.
