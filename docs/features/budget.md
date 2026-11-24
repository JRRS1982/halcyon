# Budget Table

**What:** Per-month spreadsheet of planned vs actual income, spending, transfers and debt repayments across four row kinds.  
**Route:** `/budget`  
**Key points:**
- Four row kinds: `INCOME`, `EXPENSE`, `TRANSFER`, `REPAYMENT`. Each keys on a `Category` or an `Account`.
- Columns are Category, Budget, Actual, vs budget, Share and Notes. A "Left over" footer shows the surplus for both Budget and Actual.
- The page opens with a headline and a month-in-brief strip computed from the rows (`monthBrief`, `src/lib/insights/monthBrief.ts`).
- Transactions mode off: Actual is a number you type. Transactions mode on: Actual is read-only and computed from transactions, and clicking it lists the transactions behind it.
- `REPAYMENT` rows render inside Expenses and count in that total. `TRANSFER` rows get their own section and do not count as spending.

## The month in brief

`monthBrief` turns the month's rows into a headline (for example "Spending came in £570 under plan, led by Holidays"), a standfirst, the left-over figure against plan, and up to three notes led `Where it ran over.`, `Where you saved.`, `What held.` or `Where it goes.`. Every sentence is computed from the user's own rows, and a row has to move past a threshold before it earns one. A run-over note can compare the category with its own earlier months, read by `getCategoryHistory` (`src/lib/insights/server.ts`) from the months the user actually recorded.

## Variance and share

- **vs budget:** `describeVariance` (`src/lib/budget/totals.ts`) says how far a row landed from its budget in its kind's words: spending runs `over`/`under`, income comes in `above`/`below`, transfers move `more`/`less`. Green when the variance helped, red when it didn't, `On budget` when level.
- **Share:** expense and repayment rows show their share of the month's actual spending, and income rows their share of the month's actual income (`shareOf`), as a bar in their section's colour. Each expense section has one colour wherever it appears (`sectionFixed`, `sectionVariable`, `sectionDiscretionary` in `src/lib/palette.ts`), including the dashboard's charts; each income section takes the plan cash-flow chart's hue for the same kind of income. Transfers take no share.

A "Past months" table under the sheet lists income, expenses and net for each recorded month.

## Four row kinds

| Kind | Keyed on | Renders in | Actual source (transactions mode) |
|------|---------|---------|--------------|
| `INCOME` | `Category` + income section | Income | Transactions categorised as that category |
| `EXPENSE` | `Category` + expense section | Expenses | Transactions categorised as that category |
| `REPAYMENT` | `Account` (liability) | Expenses, under "Debt payments" | Transfer flow of that account |
| `TRANSFER` | `Account` (asset) + direction | "Transfers and saving" | Transfer flow of that account |

`sectionOf()` in `src/lib/budget/sections.ts` decides where a row renders. The reasoning, the surplus formula and the limits of the anchored kinds are in [`budget-transfers.md`](budget-transfers.md).

## Sections within each kind

- `EXPENSE` rows carry a `CategorySection`: `FIXED`, `VARIABLE` or `DISCRETIONARY`.
- `INCOME` rows carry one of `SALARY`, `SIDE_INCOME`, `INVESTMENTS`, `PENSIONS` or `OTHER`.
- `TRANSFER` and `REPAYMENT` rows carry no section. They anchor to an account.

## Actuals

With the transactions feature off, `BudgetItem.actual` is stored and editable. With it on (Settings toggle), the page overlays a computed figure for display and the stored column is left alone. Category-keyed rows net their category's transactions in the month; account-keyed rows net their account's transfer flow. When transactions mode is on, any category with a categorised transaction in the month gets a £0 budget row materialised on page load, so categorised spend always appears.

### What makes up an Actual

In transactions mode each Actual is a button. It opens a popover beside the
figure listing the transactions the figure is made of: date, account,
description and signed amount, with a pencilled row (a category an import
suggested, `isCategoryConfirmed = false`) marked "pencil". The header names the
row and its section and counts the rows ("7 transactions · 1 still in pencil");
the footer reads "Actual £X of £Y budgeted" and links to the same rows in the
ledger. The list scrolls after about eight rows.

It is view only — changes happen in the ledger — and it does not exist with
transactions mode off, where the Actual is typed and has nothing behind it.

| Row | Lists | Signs | Open in ledger |
|---|---|---|---|
| Income, Expense | the category's transactions in the month | as stored (spending negative) | `?cat=<id>&from=&to=`, the drawer's own filters |
| Transfer, Debt payment | the legs the Actual counted, one source per counterparty pair ([budget-transfers.md](budget-transfers.md#one-source-per-counterparty-pair)) | as seen from the row's account | `?counted=<accountId>:<YYYY-MM>` ([ledger-filters.md](ledger-filters.md#counted-in-budget)) |

A leg recorded on the other account's side is labelled "Recorded on <account>'s
side" and sign-flipped, so the list nets to the figure.

**The list and the figure come from one calculation.** The breakdown is read
through the same queries the page's overlay uses (`categoryActualWhere`,
`transferLegs`), the transfer legs through the same rule
(`countedTransferLegs`, which `netTransfersForAccounts` sums), and the footer's
figure is derived from the listed amounts by the same `netActual` /
`accountActual` (`breakdownActual`, `src/lib/transactions/breakdown.ts`).

It is fetched by the `getActualBreakdown` server action when the popover opens,
not with the sheet. The popover (`ActualBreakdown.tsx`) is portalled to the
body so the sheet's overflow cannot clip it. It closes on a click or focus
outside, on Esc (focus returns to the figure), on a second click of the figure,
and on a page scroll or resize, which would otherwise strand it.

## Period management

- Viewing a month never creates its `FinancialPeriod`; the page shows an empty sheet. The period is created on the first write (adding a row or filling from another month) through `ensurePeriodForMonthIn` (`src/lib/budget/ensurePeriod.ts`).
- New users get a seeded £0 sheet for the current month (`src/lib/onboarding/defaults.ts`, see [`onboarding.md`](onboarding.md)).
- **Fill from another month** (`copyPeriodFrom` in `src/app/(app)/budget/actions.ts`) replaces every row in the target month with a copy of the source month's rows. Budgeted amounts carry over and actuals reset to 0. The replaced rows are hard-deleted. Rows whose anchor account has since been archived, deleted or re-kinded are skipped, and the sheet reports the count.
- There are no budget templates. The only copy path is month to month.
- A period holds at most 500 live rows (`MAX_ITEMS_PER_PERIOD`, `src/lib/budget/limits.ts`).

## One anchored row per account per period

Two `TRANSFER`/`REPAYMENT` rows on one account would each render the account's whole net and double-count it. The Add drawer filters already-anchored accounts (`eligibleAnchorAccounts`), and `createItemForMonth` enforces the rule server-side.
