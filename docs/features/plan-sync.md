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
| **Kept** | expected return, fees, drawdown priority, min access age, contribution end age, interest rate, interest-only flag, monthly repayment, growth kind, taxable flag, start/end ages, retirement age, inflation, return spread, tax rate, state pension, and every `PlanEvent` |
| **Removed** | rows whose link is null (plan-only), and rows whose account or category is gone — archived or hard-deleted alike |

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
5. **Preserves** assumptions on every surviving row, matched by its link
   rather than its position.

Point 5 is the one doing quiet work: a user who has tuned their ISA to a 4.2%
expected return and a 0.22% fee gets the £42,300 updated and the tuning left
alone.

Matching is by **kind *and* link id** (`keyOf` builds `ASSET::<uuid>`). An
account id and a category id could collide, and an asset row must never
resolve against an income — kind is part of the identity, not a filter.

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

## The indicator: three states, deliberately not four

Computed at render time by `indicatorFor`
([`syncIndicator.ts`](<../../src/app/(app)/plan/syncIndicator.ts>)) from the
same `SyncPlan` the button counts. No stored state.

| Glyph | State | Meaning |
|---|---|---|
| `✓` | `synced` | matches your balance sheet |
| `●` | `changed` | differs — Sync will replace it; the reality figure is shown beside it |
| `◇` | `plan-only` | not on your balance sheet — Sync will remove it |

Each glyph carries an accessible name via `role="img"`
([`SyncMarker.tsx`](<../../src/app/(app)/plan/SyncMarker.tsx>)) — the shapes
alone do not distinguish `●` from `◇` for a screen-reader user.

**`●` deliberately does not say *why* a row differs.** Telling "you edited
this" from "reality moved" needs a stored `syncedValue` per field, and it
would change no behaviour: Sync overwrites both identically. Showing the
source figure beside the plan's own makes the situation legible without a
state machine. If the distinction is ever wanted, the column can be added
without redesigning anything.

**`◇` is not a separate flag.** It is a row whose link is null, which is
exactly the row Sync removes. A row removed because its account is *gone*
reads as `plan-only` too — neither `indicatorFor` nor the label map branches
on `reason` at all, so the marker cannot drift from the removal rule.

## The button

`Sync with latest — N changes` in accent colour, with a breakdown beneath
reading `X updated · Y added · Z removed`, any zero part omitted. With nothing
to do it reads **`Up to date`** and is disabled — so the button also answers
"is my plan current?", which is the question that prompted this work.

A real count, on the same principle as the balance sheet's delete panel: a
number stops a mistake where "are you sure?" does not.

## The confirmation, and where it does not appear

`SyncRemovalDialog` ([source](<../../src/app/(app)/plan/SyncRemovalDialog.tsx>))
opens **only when Sync would remove plan-only rows**, and names each one. A
count alone cannot tell the user whether what is about to go is scratch work
or an evening's scenario.

A Sync that only updates and adds goes straight through, and so does one whose
only removals are `"gone"`. That second case is the deliberate narrowing:

- A **`"gone"`** removal follows a choice the user already made on the balance
  sheet's own delete panel, which named counts and, for a permanent delete,
  required typing `DELETE`. Re-confirming a decision already made deliberately
  is the friction that teaches people to click past confirmations — the exact
  erosion the dialog exists to avoid. The row still shows a `◇` marker
  beforehand, so nothing disappears unannounced.
- A **plan-only** row exists nowhere else, has had no warning from anywhere,
  and Sync is the only thing that will ever destroy it.

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
  property + mortgage pair built through the plan drawer, and with it the
  referent of any `PROPERTY_SALE` event. The confirmation names every such row
  before anything happens, which is why this ships. The plan-side mortgage
  drawer duplicates the balance sheet's, and yields worse data; retiring it is
  later-phase work.
- **A plan row deleted from the plan comes back.** The plan's own row delete is
  a soft delete, and `loadPrimaryPlanRows` filters `deletedAt: null`, so a
  soft-deleted row for a still-live account is invisible to the resolver and
  the next Sync adds a fresh one. Removing the account (or archiving it) is the
  way to remove its plan row for good. Sync's own removals are hard deletes.
- **Synced additions all take `sortOrder` 0.** `addRow` does not set it, and
  the tables order by `sortOrder asc`, so ordering among synced rows is
  whatever Postgres returns.
- **Two primary-plan queries per `/plan` render** — `getPrimaryPlan` and
  `getPlanSyncPreview` each load it. Inherent to the server-action boundary,
  not a correctness problem.

## Code map

| Concern | File |
|---|---|
| `PlanAsset.accountId`, `PlanLiability.accountId`, `PlanIncome.categoryId`, `PlanExpense.categoryId` (all `onDelete: SetNull`) | [`prisma/schema.prisma`](../../prisma/schema.prisma) |
| Pure resolver — what a Sync would do, no database | [`src/lib/plan/sync.ts`](../../src/lib/plan/sync.ts) |
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

- **Unit** — `sync.test.ts` (every resolver case, including the kind-collision
  and the zero-value guard), `realityDefaults.test.ts`, `syncIndicator.test.ts`,
  `SyncButton.test.tsx` (counts, breakdown, both confirmation branches),
  `SyncMarker.test.tsx` (three distinct accessible names, asserted structurally
  as a set), `SyncRemovalDialog.test.tsx`.
- **Integration** (`*.int.test.ts`, real Postgres) — `planLinks.int.test.ts`
  (the four links, and `SetNull` proved by the row surviving), `reality.int.test.ts`,
  `syncAction.int.test.ts` (assumptions survive, plan-only removed, archived
  account removed, second sync is a no-op, cross-tenant), `applySyncPlan.int.test.ts`
  (a foreign row id under an owned plan id is rejected by the per-statement
  fence), `createPlan.int.test.ts`.
- **E2E** — `e2e/plan-sync.spec.ts`: change a balance value, see the `●`
  marker and the source figure, press Sync, see the value update and the button
  read `Up to date`. A server-action journey, so chromium-gated per the repo's
  browser-coverage rule.
