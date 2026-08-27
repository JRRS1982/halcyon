# Budget transfers and repayments: four kinds on one sheet

The budget used to record two things: money coming in, and money being spent.
Neither describes a pension contribution or a mortgage payment. A contribution
is not spending — you still own the money — and a mortgage payment is spending
that also *reduces a debt*, which an ordinary expense row cannot express.

`ItemType` gained two members for them:

| Kind | What it means | Keys on | Renders in | Direction |
|---|---|---|---|---|
| `INCOME` | money arriving | `Category` | Income | — |
| `EXPENSE` | money spent | `Category` | Expenses | — |
| `TRANSFER` | money moved to or from an account you own | `Account` (`kind: ASSET`) | Transfers | `INFLOW` / `OUTFLOW` |
| `REPAYMENT` | money paid at a debt | `Account` (`kind: LIABILITY`) | **Expenses** | none |

Everything downstream follows from that middle column. The two old kinds hang
on a `Category` and take their actual from the transactions categorised into
it. The two new kinds hang on an `Account` and take their actual from the
transactions *tagged as transfers* against it. They are two different join
paths, and the code routes on the kind rather than on which id happens to be
set — `isAccountKeyed`
([`src/lib/transactions/actual.ts`](../../src/lib/transactions/actual.ts)) is
that rule, exported so both sides of every call site agree. An accident is not
a boundary.

See [`accounts.md`](accounts.md) for the `Account` registry these anchor to,
and [`plan-sync.md`](plan-sync.md) for what Sync does with them.

## Why a repayment renders under Expenses

Because that is where people look for their mortgage, and because the money
genuinely left the account. A repayment is spending on the cash-flow question
the budget answers ("where did my month go?") even though it is not
consumption on the net-worth question the plan answers.

So `sectionOf` ([`src/lib/budget/sections.ts`](../../src/lib/budget/sections.ts))
maps `REPAYMENT` to the **Expenses** section, where it gets its own bucket
subhead alongside Fixed / Variable / Discretionary, and its budget and actual
land in the Expenses total. `surplus` subtracts it exactly as it subtracts an
expense.

`ItemType` does not encode the section, and nothing derived from the data —
the plan wiring, the actual's source, the surplus — reads `sectionOf`. It is
presentation, and only presentation. That separation is why "repayments show
under Expenses" could be decided on taste without any of the arithmetic
moving.

## Why `REPAYMENT` carries no direction

A repayment is always inward to the debt. Money going the other way — drawing
down a mortgage, spending on a credit card, borrowing more — is a *different
act*, not the same act with a sign flipped: it increases what you owe and puts
cash in your pocket, and the plan would have to model new borrowing rather
than amortisation. It is named in Out of scope below and deliberately not
built.

Zod enforces this rather than leaving it to convention
([`src/lib/budget/schemas.ts`](../../src/lib/budget/schemas.ts)): a `TRANSFER`
must carry a direction, and every other kind must not. The same refinement
enforces the anchor — `TRANSFER`/`REPAYMENT` need an `accountId`,
`INCOME`/`EXPENSE` may not have one. The target's `Account.kind` is checked a
layer further in, in the action, because that is the only layer that can read
it.

## The surplus, and why the transfer terms look inverted

```
surplus = Σ income − Σ expense − Σ repayment − Σ transfer(INFLOW) + Σ transfer(OUTFLOW)
```

The last two terms read backwards until you remember what the direction is
relative to. **`INFLOW`/`OUTFLOW` is anchored to the named account, not to
you.** Money *into* your ISA is money *out* of your pocket, so an `INFLOW`
subtracts from what is left over; an `OUTFLOW` — money coming back out of the
account to you — adds to it.

This is the one place in the feature where the honest data model and the
readable sheet disagree, and the sheet wins in the copy: `transferRowLabel`
renders `INFLOW` as **"To Vanguard ISA"** and `OUTFLOW` as **"From Vanguard
ISA"**, and the Add drawer offers those two phrasings rather than the enum. A
`TRANSFER` that has somehow lost its direction names the account and stops
there — calling it an inflow because `null` is falsy is exactly the silent
mis-signing this feature exists to avoid.

Repayments *are* subtracted, transfers are not "spending": a pension
contribution never appears in the Expenses total. The dashboard's cash-flow
chart applies the same rule — a `REPAYMENT` counts as expenditure, a `TRANSFER`
counts as neither series (`monthFlow`,
[`src/lib/dashboard/series.ts`](../../src/lib/dashboard/series.ts)) — so
converting a mortgage from an `EXPENSE` category row to a `REPAYMENT` row
leaves the charted expenditure and the savings rate where they were. That
takes two things, not one: `monthFlow` classifying the row, and the dashboard
reading the account-keyed actual source in transactions mode
(`getTransferFlowByMonthAndAccount`), without which a repayment charts zero
however it is classified. A transfers series would be its own chart; it is
not built.

## Where an anchored row's actual comes from

A category-keyed row's actual is the net of the transactions categorised into
it. An account-keyed row's actual is the net **transfer flow** of its account
for the month, signed relative to that account, and then turned the row's way
round by `accountActual`: a `TRANSFER INFLOW` and a `REPAYMENT` both mean
money arriving at the named account, so they read the account's sign as-is; an
`OUTFLOW` flips.

It is never clamped. Budgeting an inflow and watching money leave is a real
reading, and hiding it behind a zero would make the row agree with a plan that
did not happen.

### One source per counterparty pair

One real movement leaves two possible records: the leg the account itself owns
(a transaction *in* that account tagged at a counterparty) and the leg on the
other account pointing back at it. Summing both double-counts, so exactly one
is consulted — chosen **per counterparty pair**, not per account. For account
`X` and counterparty `C`: `X`'s own legs aimed at `C` if it has any, otherwise
`C`'s legs aimed at `X`, sign-flipped
([`src/lib/transactions/transfers.ts`](../../src/lib/transactions/transfers.ts)).

Per pair rather than per account, because owning one leg must not silence
every other counterparty. A pension that pays a £100 fee to an ISA *and*
receives £500 from the current account would otherwise report only the fee —
the wrong sign, not merely a low reading. Each pair still resolves to exactly
one source, so double-counting stays impossible by construction.

**Accepted limitation.** A single pair that records some of its movements from
one side and some from the other counts only the owned legs, so that pair
reads low. It is narrow, it is visible on the sheet, and it fails safe:
under-reporting a transfer never inflates net worth. The rejected alternative
was pairing legs by opposite amount and nearby date — the fuzzy matching this
project has spent two phases removing, which would fail silently and
differently every month.

**A row with no matching flow reads £0.00, not blank.** That says "you moved
nothing" where the truth is "nothing was recorded". It is exactly what the
category path already does (`netActual([])` is `0`), so this introduces no
regression; fixing it means widening `actual` to `number | null` through the
whole sheet.

## The ledger's transfer picker

Tagging a transaction as a transfer is what feeds the actuals above. The
picker in `CategoryCombobox` shows **four** groups: Income, Expenses,
Transfers, Repayments. The two account groups are one list partitioned on
`Account.kind` — `LIABILITY` accounts are Repayments, **everything else** is a
Transfer.

> **Correction to the record.** The unified-accounts design spec says this
> picker "filters on `kind != NONE`". It never did, and it must not. Nothing
> filtered on kind at all before this branch — `LedgerAccount` did not even
> carry `kind` — and a `kind: NONE` account is the default for a plain current
> account, which is a perfectly ordinary transfer target. Implementing that
> sentence literally would have made every newly created account vanish from
> both groups. The spec is a gitignored historical record and is not being
> edited; this paragraph is where the correction lives.

Note the asymmetry, and that it is deliberate: the **ledger** picker offers
every account, because any account can be one end of a movement. The **budget**
Add drawer offers only `ASSET` accounts for a `TRANSFER` and only `LIABILITY`
accounts for a `REPAYMENT`, because a budget row has to mean something to the
plan. Those are different questions and they get different answers.

## Adding a row

`+ Income` and `+ Expense` add a row outright. `+ Transfer` and `+ Repayment`
open a drawer first, because an anchored row cannot exist without a target.
The drawer lists the eligible accounts, the transfer drawer then asks which
way ("To …" / "From …"), and the new row's label defaults to the account's
name and stays editable.

**An empty picker is an ordinary state, not an error.** Every account
onboarding seeds is `kind: NONE`, and an account gets its kind on the balance
sheet's Add drawer — so a user who has never used the balance sheet has
nothing to offer here. `anchorPickerEmptyReason` distinguishes two cases,
because they need different words:

| Reason | What it says |
|---|---|
| `NO_ACCOUNTS` | you have no asset/liability accounts yet — links to `/balance` |
| `ALL_TAKEN` | every eligible account already has a row this month |

Telling someone to create an account they already have would be a lie, which
is why the second case exists and carries no balance-sheet link.

### One anchored row per account, per period

Two rows on one account would each render that account's whole net: two ISA
rows against a real £700 would both show £700 and the Transfers actual would
read £1,400. With one net per account there is no way to tell two rows apart,
so one row is the honest model.

The picker excludes accounts this period's live rows already point at
(`eligibleAnchorAccounts`), and `createItemForMonth` holds the same fence
server-side, inside its transaction — the picker can be bypassed, so the
server's is the one that matters. Live rows only, so deleting a row gives the
account back.

Deliberately **not** a database unique index on `(periodId, accountId)`:
soft-deleted `BudgetItem`s keep their `accountId`, so the constraint would
reject a legitimate re-add. Two concurrent creates could in principle still
race past the action fence; for a single-user finance app that is recorded
rather than solved.

## Reaching the plan

`latestReality` ([`src/lib/plan/reality.ts`](../../src/lib/plan/reality.ts))
now reads a `flow` alongside each account row's value:

| Budget row | Plan column | Unit |
|---|---|---|
| `TRANSFER INFLOW` on an asset | `PlanAsset.annualContribution` | **annual** (`budget × 12`) |
| `TRANSFER OUTFLOW` on an asset | — reads as `0` | |
| `REPAYMENT` on a liability | `PlanLiability.monthlyRepayment` | **monthly** (`budget`, as stored) |

The units are asymmetric on purpose. Each column is stored in the unit its own
drawer displays: the plan's asset drawer asks for an annual contribution, its
liability drawer asks for a repayment per month, and `liabilityStep` does its
own `× 12` inside the projection. Renaming `monthlyRepayment` for symmetry
would touch 54 references across 26 files to make the code look tidier and the
UI wrong.

The annualised figure is rounded to 2dp, because `£833.33 × 12` is
`9999.960000000001` in IEEE-754 and `9999.96` in a `numeric(12,2)` column —
compared unrounded, that row would report as an update on every Sync forever.

Three things worth stating plainly:

- **The plan reads the *budgeted* figure, never the actual.** It is a forecast
  of what you intend to pay in, not a record of what you did. The budget's
  actual column and the plan's contribution are answering different questions.
- **The flow is keyed off the target account's kind, not the row's own type.**
  Equivalent today, since the create fence pairs them — but a mispaired row
  can then never be found rather than found and misread. A repayment
  annualised into `monthlyRepayment` would clear a mortgage twelve times too
  fast.
- **An account row's flow is always a number — `0`, never `null`.** Both plan
  columns are non-nullable with a `@default(0)`, so a `null` would never
  compare equal and every unbudgeted account would sit in `updates` forever,
  with the button never reading "Up to date". `null` belongs to the
  `INCOME`/`EXPENSE` rows, which have no flow column at all.

A `TRANSFER OUTFLOW` reads as zero rather than as a negative contribution: the
projection derives withdrawals from deficits, and budgeting them needs engine
work that is out of scope. A withdrawal is not a contribution, and it must not
pay money into the asset it came out of.

### A budgeted flow rescues a zero-valued row

Sync's zero-value guard exists so a brand-new user's first plan does not open
on a table of ~17 empty starter categories. It now reads
`value > 0 || (flow ?? 0) > 0`: an account you opened at £0 and are paying
£500/mo into is not an empty row — it is the case this feature exists for.
Without the widening, Sync would report "Up to date" while £6,000/yr never
reached the projection, self-healing only once the balance went positive. A
category can never take the new branch, because its flow is `null`.

## ⚠️ Sync now replaces contributions and repayments

`PlanAsset.annualContribution` and `PlanLiability.monthlyRepayment` have moved
from Sync's **Kept** list to its **Replaced** list. This is a deliberate
change to the rule in [`plan-sync.md`](plan-sync.md), and it has a
user-visible consequence:

> **An existing user's hand-typed mortgage repayment, with no matching
> `REPAYMENT` budget row, resets to 0 on their next Sync.**

It is visible — the row carries a `●` changed marker beforehand and is counted
in the Sync button's change count — but nothing on screen explains *why*, so
it is written down here.

The alternative was "null means leave it alone", and it was rejected: it can
never **clear** a contribution when its budget row is deleted. A stale figure
that no edit can remove is worse than a visible reset, and the two behaviours
are not both available — a field cannot be fed by the budget *and* preserved
against it.

The fix for an affected user is to add the matching `REPAYMENT` (or
`TRANSFER`) row to their budget, which is the thing the field now mirrors.

## ⚠️ Migrating a mortgage: delete the old expense row

Before this feature, the only way to record a mortgage on the budget sheet was
an ordinary `EXPENSE` row on a "Mortgage" category. Converting it is a two-step
job, and doing only the first step **double-counts the payment in the plan**:

> Add the `REPAYMENT` row at the mortgage account, **and delete the old
> expense-category row.** Keeping both is not a harmless duplicate — the
> projection charges the payment twice.

Nothing detects the pair. `latestCategoryRows` mints a `PlanExpense` from the
category row at £15,000/yr, and the repayment row's £1,250 becomes £15,000/yr
of `liab.repaid` — £30,000/yr of outflow for one £15,000 payment, and no
warning at either end. The budget sheet is not affected: it shows what you
typed, and both rows are in the Expenses total there, which is at least
visibly wrong. It is the plan that silently compounds it.

Closing this properly needs a `Category` → `Account` link, so a category can
declare itself a repayment and be excluded from the category totals. That is
recorded as the open half of the corresponding gap in
[`plan-sync.md`](plan-sync.md); until it exists, deleting the old row is the
whole mitigation.

## Limitations

Three, stated here rather than left to be discovered.

**Budget templates do not carry transfers or repayments.**
`BudgetTemplateItem` has no `accountId` or `direction` columns, so the anchor
cannot survive the round trip. `saveBudgetTemplate` writes such a row with the
anchor nulled and says nothing at save time; `copyBudgetTemplateInto` then
drops it (`withValidAnchorsOnly`, which refuses to create a row the create
action itself would reject) and returns a `skipped` count, which the sheet
*does* surface as a notice. So the rows are not silently lost. The notice reads
"because their accounts could not be carried over", which is true of both paths
that reach it; it used to say "no longer available", which was a false
statement here — it blamed an account that is perfectly fine when the real
cause is the template's schema. Persisting the anchor needs a migration plus a
product decision about what a "template transfer"
means when the account may not exist in the target month; `BalanceTemplateItem`
already carries an `accountId`, so there is in-repo precedent whenever that is
built. Copying from another *month* carries anchors correctly — that path
re-fences ownership and kind and skips only rows whose account has since been
archived, deleted or re-kinded.

**`favourableVariance` implements the variance rule, and the sheet has no
variance column.** The sheet shows Budget, Actual and "Left over" — there is
no variance display for the rule to drive, so the function is tested and
unconsumed. It is kept rather than deleted because the asymmetry it encodes is
subtle: positive means "went the way you wanted", which is uniform on
*direction* and never on whether the target is an asset or a liability. Money
*into* an account improves net worth whether it is a pension or a mortgage,
and money *out* worsens it either way — there is no `Account.kind` to branch
on. A documented unconsumed rule is honest; an undocumented one is rot.

**One anchored budget row per account per period** — see above. Fenced in the
picker and in `createItemForMonth`, not in the database.

## Out of scope, named so nobody builds them by accident

- **Borrowing more** — an increase in debt with cash in. Needs its own kind or
  a direction on `REPAYMENT`, and plan-side modelling of new borrowing.
- **`TRANSFER OUTFLOW` reaching the projection.** The plan derives withdrawals
  from deficits; budgeting them is engine work.
- **A transfers series on the dashboard's cash-flow chart.** The chart counts
  a `REPAYMENT` as expenditure and a `TRANSFER` as neither series; giving
  transfers a series of their own is a different change.
- **A repayment in the dashboard's per-category expenditure chart.** That chart
  buckets by `ExpenseCategory`, which a `REPAYMENT` row does not carry, so a
  repayment appears in the cash-flow chart's expense total and not in the
  category breakdown. The two charts answer different questions and neither is
  wrong, but they no longer add up to the same number.
- **Refusing an account-keyed plan row with no `BalanceItem` behind it.**
  `latestAccountRows` drops an account with no observation before it reads the
  budgeted flow ([`reality.ts`](../../src/lib/plan/reality.ts)), so budgeting a
  contribution to an account you have never put on the balance sheet reaches
  nothing. Distinct from "a budgeted flow rescues a zero-valued row" above,
  which is about an account observed *at £0*: that one has a `BalanceItem` and
  does reach the resolver. It is the pre-existing "no observation, no plan row"
  rule rather than anything this branch introduced, and changing it is a
  product decision about what an unobserved account is worth. Deferred to P4.
- **Retiring `PlanLiability.linkedAssetId`** in favour of
  `Account.linkedAccountId`.
- **Renaming `monthlyRepayment`** for symmetry with `annualContribution` — the
  units are deliberate, see above.
- **Splitting `BudgetSheet.tsx`** (now ~1,860 lines). Real, and not this
  branch's job.
- **Holdings within a wrapper** — designed for, not built; see
  [`accounts.md`](accounts.md).
- **Giving the onboarding-seeded accounts real kinds.** All six are
  `kind: NONE`, so a user who has never used the balance sheet meets an empty
  picker and a signpost. Typing four of them (Savings, Emergency Fund, ISA,
  SIPP) would change what `latestReality`, the balance sheet and the dashboard
  see for every new user — a blast radius well beyond transfers.

## Code map

| Concern | File |
|---|---|
| `ItemType` +`TRANSFER`/`REPAYMENT`, `TransferDirection`, `BudgetItem.accountId`/`direction` | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
| Anchor invariants (which kinds carry an account, which carry a direction) | [`src/lib/budget/schemas.ts`](../../src/lib/budget/schemas.ts) |
| Which `Account.kind` each kind must target, and the fence's message | [`src/lib/budget/anchors.ts`](../../src/lib/budget/anchors.ts) |
| Section placement, row labels, picker eligibility, the skipped-rows notice | [`src/lib/budget/sections.ts`](../../src/lib/budget/sections.ts) |
| Section sums, `surplus`, `favourableVariance` | [`src/lib/budget/totals.ts`](../../src/lib/budget/totals.ts) |
| Net transfer flow per account, one source per counterparty pair | [`src/lib/transactions/transfers.ts`](../../src/lib/transactions/transfers.ts) |
| `isAccountKeyed`, `netActual`, `accountActual` | [`src/lib/transactions/actual.ts`](../../src/lib/transactions/actual.ts) |
| `transferLegs`, `getTransferFlowByAccount`, `getTransferFlowByMonthAndAccount`, `getLedgerAccounts` | [`src/lib/transactions/server.ts`](../../src/lib/transactions/server.ts) |
| Create/copy fences, `withValidAnchorsOnly`, template paths | [`src/app/(app)/budget/actions.ts`](<../../src/app/(app)/budget/actions.ts>) |
| Actual overlay routing, `serializedItems` carrying the anchor | [`src/app/(app)/budget/page.tsx`](<../../src/app/(app)/budget/page.tsx>) |
| Add drawers, three sections, the Repayments bucket | [`src/app/(app)/budget/BudgetSheet.tsx`](<../../src/app/(app)/budget/BudgetSheet.tsx>) |
| The picker's four groups | [`src/app/(app)/transactions/CategoryCombobox.tsx`](<../../src/app/(app)/transactions/CategoryCombobox.tsx>) |
| `RealityRow.flow`, `budgetedFlow` | [`src/lib/plan/reality.ts`](../../src/lib/plan/reality.ts) |
| `flow` in the update comparison and the zero-value guard | [`src/lib/plan/sync.ts`](../../src/lib/plan/sync.ts) |
| Writing `annualContribution` / `monthlyRepayment` on add and update | [`src/lib/plan/applySyncPlan.ts`](../../src/lib/plan/applySyncPlan.ts) |
| Cash-flow classification: a repayment is spending, a transfer is neither | [`src/lib/dashboard/series.ts`](../../src/lib/dashboard/series.ts) |
| The dashboard's two-source actual overlay across the 12-month window | [`src/app/(app)/dashboard/page.tsx`](<../../src/app/(app)/dashboard/page.tsx>) |

### Testing

- **Unit** — `budget/schemas.test.ts` (all four kinds' anchor and direction
  invariants, each asserting the specific refinement message),
  `budget/anchors.test.ts` (required kind per type, and the unanchored branch
  zod makes unreachable through the action), `budget/sections.test.ts`
  (`sectionOf`, `transferRowLabel`, `anchorTargetLabel`,
  `eligibleAnchorAccounts`, `anchorPickerEmptyReason`, `skippedRowsNotice`),
  `budget/totals.test.ts` (`sumAmounts` across kinds, `surplus` in both
  directions, `favourableVariance`'s `INFLOW`/`OUTFLOW` asymmetry),
  `transactions/transferSource.test.ts` (the per-pair source rule, including
  the self-transfer edge and all three double-count scenarios),
  `transactions/actual.test.ts` (`accountActual`'s sign, `netActual`'s
  exclusion), `transactions/CategoryCombobox.test.tsx` (the four groups and
  the keyboard index across them), `transactions/transferSource.test.ts` again
  for `netTransfersByMonthAndAccount` (each month nets on its own; the per-pair
  rule holds inside a bucket), `dashboard/series.test.ts` (`monthFlow` counts a
  repayment and excludes a transfer, and converting a mortgage between the two
  leaves the savings rate where it was).
- **Integration** (`*.int.test.ts`, real Postgres) —
  `budget/transferSchema.int.test.ts`, `budget/transferActions.int.test.ts`
  (cross-tenant, both kind mismatches, the one-row-per-account fence, the
  happy path), `budget/copyAnchors.int.test.ts` (anchors carried and re-fenced
  across copy-forward; template rows dropped),
  `budget/copyComputedActuals.int.test.ts` (a copied anchored row adopts the
  target month's flow rather than returning 0),
  `dashboard/cashFlow.int.test.ts` (a repayment is charted as expenditure in
  both modes — the transactions-mode case needs the account-keyed source, not
  just `monthFlow`),
  `transactions/transferSource.int.test.ts`, `plan/reality.int.test.ts` (the
  flow read, both units, the `OUTFLOW` zero), `plan/syncAction.int.test.ts`
  (the flow reaching both plan columns, and the widened zero-value guard).
- **E2E** — [`e2e/budget-transfers.spec.ts`](../../e2e/budget-transfers.spec.ts):
  budget a transfer to an ISA, see it in Transfers and out of Expenses with
  the surplus falling by it, then tag a real movement and watch it fill that
  row's actual; and budget a repayment at a mortgage, see it counted in
  Expenses, then Sync and find it on the plan's liability. Both are
  server-action journeys, so both are chromium-gated per the repo's
  browser-coverage rule. Section placement is asserted through the section
  totals rather than through DOM order, so no structural claim is gated to one
  engine.
