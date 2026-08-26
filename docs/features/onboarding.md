# Onboarding defaults

A new account starts with data rather than empty state: a category taxonomy, a
set of accounts, and the current month's budget sheet already laid out at £0.

**The list itself lives in `src/lib/onboarding/defaults.ts`** — read that for
the labels. It is deliberately not copied here, because a list in two places is
a list that disagrees with itself.

## What gets created, and when

`provisionUserSettings` (`src/lib/settings/server.ts`) runs on a user's first
authenticated request and creates, in one transaction:

| | |
|---|---|
| `Category` | the full taxonomy, `sortOrder` = list order |
| `Account` | one per default name, `type` left null |
| `FinancialPeriod` + `BudgetItem` | the current month, one £0 row per category flagged `inStarterBudget` |

Only a subset of categories becomes budget rows. The rest are in every picker
from the start and reach the sheet on their own, the first month a transaction
lands in one — the budget page already materialises a row for any category with
activity. That is what makes a fine-grained taxonomy cheap: the sheet stays
short, and the dashboard's spending chart aggregates by bucket, not by label, so
dormant categories add nothing to it.

## Two things to know before you touch this

**Seeding is gated on the `UserSettings` insert reporting a row.** `User` and
`UserSettings` are deduped by `skipDuplicates` because their primary key is the
user id. Nothing makes a category unique per user, so without that gate two
concurrent first requests — a page and its prefetch — would each insert a full
set and the user would open Settings to everything twice.

**The starter month is the *current* month, so it outranks anything a test
seeds for itself.** Code that reads "the latest period" gets the starter sheet:
the dashboard KPIs take the last point of each series, and `createPlan` seeds
from the most recent period. E2E specs that seed a past month and assert on a
derived figure must call `clearStarterPeriods` (`e2e/_helpers/fixtures.ts`)
first, or their fixture is inert. Integration tests are unaffected — their
`seedUser` helper writes `UserSettings` directly, so provisioning never runs.

## Existing users

A data migration
(`prisma/migrations/20260810090000_backfill_default_categories_and_accounts`)
fills these in for accounts created before the feature existed, **only where the
list is completely empty**. The guard counts soft-deleted rows, so someone who
deleted their categories on purpose is skipped rather than re-seeded. It does
not touch existing budget months: pre-filling a month someone is already using
would be vandalism.

The migration duplicates the labels as a point-in-time snapshot. That is normal
for a data migration — it records what happened on that date and is not kept in
step with the module.

## Deliberate omissions

- **No savings, investment or credit-card expense category.** Money moved into
  an ISA or SIPP, or used to pay off a card held as an `Account`, is a
  *transfer*. Transfers ship on by default, so an expense line for the same
  movement would count it twice.
- **Accounts carry no `type`.** The Settings form does not collect one, so a
  default with a type set would be a value the user can see but never edit.
- **Some categories cannot be filled from bank data alone.** A supermarket shop
  arrives as a single total, so wine and meal deals stay inside Groceries
  whatever categories exist. Alcohol and Coffee & Snacks capture what is bought
  on its own.
