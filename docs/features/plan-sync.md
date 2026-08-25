# Plan sync: one button makes the plan match reality

Before this feature the plan was seeded from the balance sheet and the budget
**once, at creation**, and never looked again. A plan made in January still
projected January's balances in December, and adding, editing or deleting an
account changed nothing in it.

Each plan row now carries a durable link to the thing it mirrors —
`accountId` on `PlanAsset` and `PlanLiability`, `categoryId` on `PlanIncome`
and `PlanExpense`, all nullable. A **Sync** button on `/plan` re-reads the
balance sheet and the budget and makes the plan agree with them.

See [the design doc](../superpowers/specs/2026-08-25-plan-sync-design.md) for
the reasoning that got here, and [`accounts.md`](accounts.md) for the
`Account` registry this is built on. This doc describes what the code actually
does; where it and the design doc disagree, the design doc is the historical
record.

## The one rule

> Sync makes the plan's rows and values match what the balance sheet and
> budget currently say. Everything else the plan holds survives.

| | |
|---|---|
| **Replaced** | opening values, annual amounts, labels, an asset's wrapper, and *which rows exist* |
| **Kept** | expected return, fees, drawdown priority, min access age, contribution end age, interest rate, interest-only flag, monthly repayment, growth kind, taxable flag, start/end ages, retirement age, inflation, return spread, tax rate, state pension, and every `PlanEvent` **except** a `PROPERTY_SALE` whose property is being removed |
| **Removed** | rows whose link is null (plan-only), rows whose account or category is gone — archived or hard-deleted alike — and everything that cannot outlive one of those: a property's mortgage, a mortgage's repayment expense, a property's sale events |

One press, decided by `resolvePlanSync`
([`src/lib/plan/sync.ts`](../../src/lib/plan/sync.ts)):

1. **Updates** every linked row whose value, label or wrapper differs from the
   latest observation.
2. **Adds** a row for anything on the balance sheet or budget the plan lacks
   (subject to the zero-value guard, below).
3. **Removes** rows whose account or category no longer exists. "Stop
   tracking" means the user no longer has the thing, so the plan must stop
   projecting it. Historical `BalanceItem` rows are untouched, so charts are
   unaffected.
4. **Removes** plan-only rows — those with a null link.
5. **Removes** whatever cannot outlive any of the above — see *Removal is
   complete*, below.
6. **Preserves** assumptions on every surviving row, matched by its link
   rather than its position.

Point 6 is the one doing quiet work: a user who has tuned their ISA to a 4.2%
expected return and a 0.22% fee gets the £42,300 updated and the tuning left
alone.

Matching is by **kind *and* link id** (`keyOf` builds `ASSET::<uuid>`). An
account id and a category id could collide, and an asset row must never
resolve against an income — kind is part of the identity, not a filter.

## Removal is complete

A mortgaged property is four rows that cannot stand apart: the property
`PlanAsset`, the `PlanLiability` that names it through `linkedAssetId`, the
repayment `PlanExpense` that liability manages through `liabilityId`, and any
`PROPERTY_SALE` `PlanEvent` pointing at the property through `assetId`.
Removing only the one reality lost used to leave the rest behind:

- a mortgage on a house that is gone, its `linkedAssetId` nulled by the FK;
- a sale event whose `assetId` the FK had nulled — a **zombie**. `project.ts`
  skips it in three places so it contributes no proceeds, `schemas.ts` has a
  refine that refuses to save an edit to it, and `EventsTable` renders it as a
  sale of `"?"`. Net worth fell at the sale age with nothing on screen
  explaining why.

`deletePlanAsset` already enforced this invariant on the plan's own delete —
*"a mortgage cannot outlive its property"* — cascading to the linked mortgage
and that mortgage's repayment expense, and `deletePlanLiability` does the same
for the repayment alone. Sync now matches them going down the chain. It does
not match `deletePlanExpense`'s refusal to delete a repayment on its own — see
*Known gaps*.

The dependency reaches the resolver **as data**, never as a query inside the
action: `PlanRow.dependsOn` carries the id of the row it cannot outlive
(`PlanLiability.linkedAssetId`, `PlanExpense.liabilityId`), and events — which
are not `PlanRow`s, since they mirror nothing on the balance sheet — arrive as
`DependentRow[]`. `resolvePlanSync` then walks the closure **transitively**:
property → mortgage → repayment is three deep, and a hand-rolled two levels
would leave the third behind. The walk is breadth-first over the `removals`
array itself, which is both queue and result.

Three properties fall out of doing it there rather than in the action:

- **Nothing is removed or counted twice.** A repayment expense is *both*
  plan-only (`linkRepaymentExpense` sets no `categoryId`) and dragged by its
  mortgage. An id already in `removals` is never added again, so it is deleted
  once, listed once, and counted once.
- **A dragged row leaves `updates` and `unchanged`.** It was classified against
  reality before the cascade reached it. Left in `updates` it would be counted
  twice in the breakdown and written by `applySyncPlan` immediately before
  being deleted.
- **`syncChangeCount` stays truthful.** Cascades are removals like any other,
  so the button's number is exactly what the dialog itemises.

**A dragged row whose own account is still live comes back on the next press.**
A mortgage removed because its property went, while its own account sits
un-archived on the balance sheet, leaves an unmirrored live account: the next
preview offers it as an addition, and it returns as a standalone liability with
default assumptions. That is the honest answer — the debt still exists, now
standing on its own — and the button says "1 change" rather than "Up to date"
until the user acts, which is what the button is for. Archiving both halves of
the pair, which is what selling a house means, avoids it entirely.

## Where the numbers come from

| Plan row | Source |
|---|---|
| `PlanAsset.openingValue` | latest `BalanceItem.value` for the account |
| `PlanLiability.openingBalance` | latest `BalanceItem.value` for the account |
| `PlanIncome.annualAmount` | latest `FinancialItem.budget` **× 12** for the category |
| `PlanExpense.annualAmount` | latest `FinancialItem.budget` **× 12** for the category |

Read by `latestReality` ([`src/lib/plan/reality.ts`](../../src/lib/plan/reality.ts)),
one row per live account and per live budget category:

- **"Latest" is not "this month".** It is the most recent non-deleted period
  that has a row for that account or category — a user may not have filled
  this month in yet. Ordering is `period.startDate desc`, then `createdAt
  desc`: two periods can share a `startDate` (a MONTH and a YEAR period
  collide there), and nothing stops two rows for one account inside one
  period, so without the tiebreaker the winner is whatever order Postgres
  happened to return.
- **Budget rows are read from `granularity: "MONTH"` periods only.** The × 12
  assumes a monthly figure; a YEAR period would inflate the annualised value
  twelvefold.
- **The × 12 is rounded to 2dp.** `budget` and `annualAmount` are both
  `numeric(_,2)` and the multiplication happens in doubles: £833.33 × 12 is
  `9999.960000000001` in IEEE-754 but `9999.96` in the column. Compared
  unrounded against the stored figure, such a row reads as an update on every
  press and the button never reaches "Up to date" — 31% of penny values are
  affected. The balance-sheet path needs no rounding: it reads a
  `numeric(14,2)` into a `numeric(14,2)` with no arithmetic between.
- **`kind: NONE` accounts are excluded** — a plain transaction account is not
  a balance-sheet line, so it is not a plan row.
- **Nothing observed, nothing offered.** An account with no `BalanceItem` at
  all, or a category with no monthly budget row, is skipped rather than added
  at zero.
- **A `carriedOver` row still counts.** A value cloned forward from last month
  and not yet confirmed is still the best figure available; skipping it would
  make Sync ignore the row or fall back to an older month, both more
  surprising than using it.
- **Labels come from `Account.name` and `Category.label`**, not from the
  period row's own label, so a rename propagates into the plan on the next
  Sync.

## Addition-time defaults are not updates

`drawdownPriority`, `PlanIncome.kind`, `PlanIncome.endAge` and
`PlanExpense.category` are derived from how the user has already classified
the account or category
([`src/lib/plan/realityDefaults.ts`](../../src/lib/plan/realityDefaults.ts)) —
but **only when a row is created**. `updateRow` in
[`applySyncPlan.ts`](../../src/lib/plan/applySyncPlan.ts) never writes them.

That asymmetry is the easiest thing here to get wrong. Drawdown priority and
start/end ages are named on the **Kept** list, and the other two follow the
same principle: a user who tuned their drawdown order, or ended a salary at
55, must not lose it by pressing Sync. An *addition* has no assumptions to
preserve, so it needs a sensible starting point; an existing row already has
one and it is the user's.

| Field | Derived from | Why it matters |
|---|---|---|
| `PlanAsset.drawdownPriority` | `Account.category` (cash 0 → medium 1 → long 2 → other 3 → property 9) | Left at the schema default, every synced asset ties at 0 and drawdown order becomes incidental |
| `PlanIncome.kind` | `Category.incomeCategory` | Hard-coding `OTHER` misclassifies a salary |
| `PlanIncome.endAge` | `retirementAge` when the kind is `SALARY`, else null | Left null a synced salary runs to `expectedDeathAge` and overstates lifetime income by decades |
| `PlanExpense.category` | `Category.category` (nullable both sides) | An uncategorised category stays uncategorised rather than reading as a guess |

The type system carries the rule: `RealityRow.defaults` is a **nested** object
precisely so `resolvePlanSync`'s equality check reads three flat fields
(`value`, `label`, `wrapper`) and structurally cannot compare the defaults.

**`wrapper` is the deliberate exception** — it *is* an update. It is
classification the user stated in the Add drawer, not an assumption they tuned
in the plan, so the plan should follow it. An `ASSET` account somehow left
without one falls back to `PlanAsset`'s own schema default (`OTHER`) rather
than surfacing null; otherwise every subsequent Sync would compare a null
reality against an `OTHER` row and flag a false update forever.

## The zero-value guard filters additions, not reality

`resolvePlanSync` drops additions worth £0 or less. It does **not** filter
zeros out of `latestReality`, and the difference is not cosmetic:

- A row **absent** from reality is a *removal* with reason `"gone"`. Filtering
  zeros upstream would therefore delete a paid-off mortgage's row and every
  assumption tuned on it — and silently, because the confirmation dialog names
  only plan-only rows.
- Updating an existing linked row **to** £0 is correct: a debt that reached
  zero should show as zero.
- Refusing to **create** a new row at £0 is also correct: `provisionUserSettings`
  seeds ~17 starter budget categories at £0, and without the guard a new
  user's first plan opens on a table of empty lines.

Putting the guard inside `resolvePlanSync` rather than in its caller keeps the
button's count, the row markers and the confirmation list honest — all three
render that one object.

## Creating a plan is a Sync against an empty plan

`createPlan` no longer seeds. It creates the `Plan` with its assumptions and
the "New car" event, then, inside the same transaction, calls
`applySyncPlan(tx, plan.id, userId, resolvePlanSync([], await latestReality(userId)), new Map())`.
An empty plan synced against reality *is* a seeded plan — one code path, not
two.

`src/lib/plan/seed.ts` and its label-sniffing heuristics are gone with it:
`seedPlanChildren`, `inferWrapper`, `inferInterestPct`. The wrapper is now a
fact the user chose in the Add drawer, not a regex reading `/isa/` out of a
label. `DRAWDOWN_BY_CATEGORY` and `INCOME_KIND_BY_BUCKET` survive verbatim in
`realityDefaults.ts`, now keyed off the account's and category's own
classification.

**`inferInterestPct` has no replacement.** A balance sheet records what a debt
is worth, not its rate. A synced liability takes the schema default, and the
interest rate becomes an assumption the user sets on the plan row — which is
where assumptions belong, and where it survives every later Sync.

`applySyncPlan` takes a transaction client rather than opening its own,
because a `"use server"` export cannot accept one and `createPlan` needs to
call it from inside its existing transaction.

## The indicator

Computed at render time by `indicatorFor`
([`syncIndicator.ts`](<../../src/app/(app)/plan/syncIndicator.ts>)) from the
same `SyncPlan` the button counts. No stored state.

| Glyph | State | Meaning |
|---|---|---|
| `✓` | `synced` | matches your balance sheet |
| `●` | `changed` | differs — Sync will replace it; the reality figure is shown beside it |
| `◇` | `plan-only` | not on your balance sheet — Sync will remove it |
| `◇` | `attached` | Sync will remove it with the row it cannot outlive |

Each glyph carries an accessible name via `role="img"`
([`SyncMarker.tsx`](<../../src/app/(app)/plan/SyncMarker.tsx>)) — the shapes
alone do not distinguish `●` from `◇` for a screen-reader user.

**`●` says that a row differs, not why** — and that is the distinction this
feature still refuses to draw. Telling "you edited this" from "reality moved"
needs a stored `syncedValue` per field, and it would change no behaviour: Sync
overwrites both identically. Showing the source figure beside the plan's own
makes the situation legible without a state machine. If the distinction is ever
wanted, the column can be added without redesigning anything.

**`plan-only` and `attached` share the `◇` glyph deliberately.** To a sighted
user both say the same thing — Sync will remove this row — and a fourth symbol
for a distinction the shape cannot carry would be noise. They differ only in
their accessible name, because the *reason* differs and one of the two names
would be false about the other's row: an `attached` row may well be on the
balance sheet — a mortgage whose own account is live, going only because its
property is not — so "not on your balance sheet" cannot be said of it.

A row removed because its account is *gone* reads as `plan-only`: in both cases
the link resolves to nothing and Sync will delete it, which is all the marker
claims. `indicatorFor` branches on `reason` only to separate `cascade` from the
other two.

## The button

`Sync with latest — N changes` in accent colour, with a breakdown beneath
reading `X updated · Y added · Z removed`, any zero part omitted. With nothing
to do it reads **`Up to date`** and is disabled — so the button also answers
"is my plan current?", which is the question that prompted this work.

A real count, on the same principle as the balance sheet's delete panel: a
number stops a mistake where "are you sure?" does not.

## The confirmation, and where it does not appear

`SyncRemovalDialog` ([source](<../../src/app/(app)/plan/SyncRemovalDialog.tsx>))
opens when Sync would remove **plan-only rows, plus anything a removal takes
with it**, and names each one. A count alone cannot tell the user whether what
is about to go is scratch work or an evening's scenario.

The rule is one function, `confirmableRemovals` in
[`sync.ts`](../../src/lib/plan/sync.ts) — `reason !== "gone"` — read twice: the
button gates on it, and the dialog filters its list with it. Two copies of a
predicate is exactly how a gate and a list drift apart.

A Sync that only updates and adds goes straight through, and so does one whose
only removals are `"gone"` with nothing hanging off them. That case is the
deliberate narrowing, and it still stands:

- A **`"gone"`** removal follows a choice the user already made on the balance
  sheet's own delete panel, which named counts and, for a permanent delete,
  required typing `DELETE`. Re-confirming a decision already made deliberately
  is the friction that teaches people to click past confirmations — the exact
  erosion the dialog exists to avoid. The row still shows a `◇` marker
  beforehand, so nothing disappears unannounced.
- A **plan-only** row exists nowhere else, has had no warning from anywhere,
  and Sync is the only thing that will ever destroy it.
- An **attached** row is going because something it cannot outlive is going.
  The balance sheet's delete panel warned about the *account*; it said nothing
  about the mortgage, the repayment or the property-sale scenario built on top
  of it in the plan. So the widening adds only cases where real work would
  otherwise vanish silently, which is the whole test.

The dialog is handed the **whole** removal list and decides what to name, both
because that keeps the rule in one place and because naming an attached row
means naming what it goes with — usually a `"gone"` row, which is itself not
named. Each line reads `Halifax mortgage — goes with The house`, and the
heading counts the two losses separately: `Sync will remove 1 plan-only row and
2 attached rows`. The zero part is omitted, so the common case still reads
exactly `Sync will remove 1 plan-only row`.

Confirming every press is how a dialog stops protecting anything.

The dialog copies the focus handling from `balance/AddAccountDrawer.tsx` —
Tab trapped in both directions, Esc cancels, body scroll locked, focus
restored to the Sync button on close.

## Authorization

Per ADR-002, application-level `userId` filtering is the primary boundary —
the server role bypasses RLS. Every read filters on `userId` directly or
through its relation (`BalanceItem` and `FinancialItem` reach one only through
`period`; plan rows only through `plan`).

Every write in `applySyncPlan` carries **its own fence** rather than trusting
the resolution step that produced the id:

- updates and removals run as `updateMany`/`deleteMany` with
  `where: { id, plan: { id: planId, userId } }`, and **throw when `count === 0`**
  — a rejected write must not report success, since the returned `SyncPlan` is
  what the UI claims happened.
- `create` cannot carry a `where`, so additions are covered by the single
  up-front `tx.plan.findFirst({ where: { id: planId, userId } })` ownership
  check, which also supplies the `retirementAge` that ends a synced salary.

The two mechanisms are complementary: the ownership check is the only fence
possible on a create; the per-statement fences catch a foreign row id passed
under a legitimately owned plan id.

### One row per account, per plan

`PlanAsset` and `PlanLiability` carry `@@unique([planId, accountId])`;
`PlanIncome` and `PlanExpense` carry `@@unique([planId, categoryId])`. The
design spec said uniqueness was "enforced in code by the resolution step" — it
is not, and could not be: `resolvePlanSync` runs *outside* the transaction that
applies it, so two concurrent presses (two tabs, a double submit) both resolve
"add this account" against the same plan and both create. The row would then
appear twice, both marked synced, and net worth would double-count for good.
Only the database can refuse the second write.

Postgres treats NULLs as distinct by default, so plan-only rows — the ones with
no link — are unaffected however many a plan holds; the plan's own Add buttons
keep working. Deleting a plan row clears its link as it sets `deletedAt`, so a
tombstone never occupies the slot the next Sync needs.

## Out of scope, named so nobody builds them by accident

- **Contributions and repayments.** `PlanAsset.annualContribution` and
  `PlanLiability.monthlyRepayment` describe money *flowing* into an asset or
  against a debt. Those come from budget **transfers**, which do not exist
  until P3 adds `ItemType.TRANSFER`. So a synced pension shows £0 going in.
  This ships as a visible gap rather than a guess, and it is the natural seam
  between P2 and P3.
- **Distinguishing "you changed this" from "reality moved"** — see the
  indicator section: needs a stored `syncedValue` per field and changes no
  behaviour.
- **Retiring `PlanLiability.linkedAssetId`.** `Account.linkedAccountId` now
  carries the mortgage ↔ property pairing, so the plan's own copy is
  duplication. Noted, not addressed.
- **Per-row sync** — all-or-nothing is a deliberate choice.
- **Undo** — Sync overwrites; the confirmation covers the destructive case.

## Known gaps

- **The plan's own Add buttons create plan-only rows.** `createPlanAsset`,
  `createPlanProperty`, `createPlanLiability`, `createMortgage` and the income
  and expense equivalents set no `accountId`/`categoryId`, so everything added
  from the plan is `◇` and the next Sync offers to delete it — including a
  property + mortgage pair built through the plan drawer, and with it any
  `PROPERTY_SALE` event on that property. The confirmation now names all of it:
  the property and the mortgage as plan-only rows, the sale event as attached,
  and the pair's repayment expense once rather than twice. That is why this
  ships. The plan-side mortgage drawer duplicates the balance sheet's, and
  yields worse data; retiring it is later-phase work.
- **`deletePlanAsset` does not take the property's sale events with it.** It
  cascades to the linked mortgage and that mortgage's repayment expense, but a
  `PROPERTY_SALE` event survives its property, pointing at a soft-deleted asset
  that `toPlanInput` no longer loads — the same zombie Sync used to leave, from
  the other door. Sync's cascade does not reach it either: the row is
  soft-deleted with its link intact, and `loadPrimaryPlanRows` filters
  `deletedAt: null`, so neither the event nor its property is visible to the
  resolver. Fixing it belongs in `deletePlanAsset`'s own transaction, and is
  not this change.
- **A repayment expense is removed without its liability.** Every repayment
  expense is plan-only (`linkRepaymentExpense` sets no `categoryId`), so any
  Sync removes it while the mortgage survives — where `deletePlanExpense`
  refuses exactly that, and `unlinkRepaymentExpense` copies the amount back to
  `monthlyRepayment` first. The projection falls back to the liability's stored
  `monthlyRepayment`, which may be stale, so the mortgage keeps paying at a
  different rate. The confirmation names the row, so it is not silent, and it
  is the pre-existing behaviour of the plan-only rule rather than anything the
  cascade introduced. The real fix is for the plan drawer to link its rows —
  the gap above — not to carve an exception into "Sync removes plan-only rows".
- **A plan row deleted from the plan comes back.** The plan's own row delete is
  a soft delete, and `loadPrimaryPlanRows` filters `deletedAt: null`, so a
  soft-deleted row for a still-live account is invisible to the resolver and
  the next Sync adds a fresh one — a new row, not the old one revived, since
  the tombstone's link is cleared on delete. Removing the account (or archiving
  it) is the way to remove its plan row for good. Sync's own removals are hard
  deletes.
- **Two primary-plan queries per `/plan` render** — `getPrimaryPlan` and
  `getPlanSyncPreview` each load it. Inherent to the server-action boundary,
  not a correctness problem.

## Code map

| Concern | File |
|---|---|
| `PlanAsset.accountId`, `PlanLiability.accountId`, `PlanIncome.categoryId`, `PlanExpense.categoryId` (all `onDelete: SetNull`) | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
| Pure resolver — what a Sync would do, no database; the dependency closure and the confirmation rule | [`src/lib/plan/sync.ts`](../../src/lib/plan/sync.ts) |
| Addition-time classification defaults (no database) | [`src/lib/plan/realityDefaults.ts`](../../src/lib/plan/realityDefaults.ts) |
| Latest observation per account and category | [`src/lib/plan/reality.ts`](../../src/lib/plan/reality.ts) |
| Writing a `SyncPlan`, fenced, inside a caller's transaction | [`src/lib/plan/applySyncPlan.ts`](../../src/lib/plan/applySyncPlan.ts) |
| `getPlanSyncPreview` / `syncPlan` server actions | [`src/app/(app)/plan/syncActions.ts`](<../../src/app/(app)/plan/syncActions.ts>) |
| `createPlan` as a sync against an empty plan | [`src/app/(app)/plan/actions.ts`](<../../src/app/(app)/plan/actions.ts>) |
| Button, counts, breakdown, confirmation gate | [`src/app/(app)/plan/SyncButton.tsx`](<../../src/app/(app)/plan/SyncButton.tsx>) |
| Row state from a `SyncPlan` | [`src/app/(app)/plan/syncIndicator.ts`](<../../src/app/(app)/plan/syncIndicator.ts>) |
| Marker glyphs, accessible names, source figure | [`src/app/(app)/plan/SyncMarker.tsx`](<../../src/app/(app)/plan/SyncMarker.tsx>) |
| Removal confirmation | [`src/app/(app)/plan/SyncRemovalDialog.tsx`](<../../src/app/(app)/plan/SyncRemovalDialog.tsx>) |

### Testing

- **Unit** — `sync.test.ts` (every resolver case, including the kind-collision,
  the zero-value guard and the cascade: transitive depth, the plan-only/dragged
  overlap counted once, a dragged row leaving `updates`),
  `realityDefaults.test.ts`, `syncIndicator.test.ts`, `SyncButton.test.tsx`
  (counts, breakdown, all three confirmation branches — plan-only, a `"gone"`
  row that drags something, and a `"gone"` row that does not),
  `SyncMarker.test.tsx` (four distinct accessible names, asserted structurally
  as a set), `SyncRemovalDialog.test.tsx` (names attached rows and what they go
  with; does not name the `"gone"` rows themselves).
- **Integration** (`*.int.test.ts`, real Postgres) — `planLinks.int.test.ts`
  (the four links, and `SetNull` proved by the row surviving), `reality.int.test.ts`,
  `syncAction.int.test.ts` (assumptions survive, plan-only removed, archived
  account removed, second sync is a no-op, cross-tenant), `applySyncPlan.int.test.ts`
  (a foreign row id under an owned plan id is rejected by the per-statement
  fence), `createPlan.int.test.ts`, `syncCascade.int.test.ts` (an archived
  property takes its mortgage, its repayment and its sale event; the resulting
  `toPlanInput` holds no event or mortgage pointing at an asset that is gone).
- **E2E** — `e2e/plan-sync.spec.ts`: change a balance value, see the `●`
  marker and the source figure, press Sync, see the value update and the button
  read `Up to date`. A server-action journey, so chromium-gated per the repo's
  browser-coverage rule.
