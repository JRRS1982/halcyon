# Dashboard Charts

**What:** Read-only summary of financial health: a computed headline and notes, four KPI tiles, a this-month checklist and four chart groups drawn from balance and budget data.  
**Route:** `/dashboard`  
**Key points:**
- Window: the last 12 monthly periods (`WINDOW_MONTHS` in `page.tsx`)
- Headline, standfirst and notes from `overallBrief` (`src/lib/insights/overallBrief.ts`), read across the whole window
- KPI tiles: net worth, surplus and savings rate with a delta against the previous recorded month; spend vs budget states the money left or overspent instead
- Four chart groups: income vs expenses, spending by category, balance over time, balance by category
- Each group can be hidden in Settings → Dashboard charts (`UserSettings.hiddenCharts`)
- No editing here; all data comes from `/balance`, `/budget` and (in transactions mode) the ledger

## The overall picture

`overallBrief` reads the same series the charts draw. The headline says how net worth has moved across the window (for example "Net worth up £25,591 since Dec 25, to £348,326"), the standfirst says how much income came in and how much was kept, and up to three notes are led `Months in surplus.`, `What's growing.` (or `What's easing.`) and `Best month.`. With nothing to read it returns null and the page falls back to a plain "Dashboard" header.

## This-month checklist and summary strip

With no chartable data, the page shows a first-run card instead. Otherwise, under the brief, a card holds the four KPI tiles and the checklist.

`monthChecklist` (`src/lib/dashboard/checklist.ts`) derives the monthly loop from data the page already loads. It stores nothing. Items: transactions waiting to be categorised (transactions mode only), a budget sheet for the current month, and balances recorded for the current month.

`dashboardSummary` (`src/lib/dashboard/summary.ts`) takes the last point of each series:

| Tile | Value | Better when |
|------|-------|-------------|
| Net worth | Latest `BalancePoint.net` (assets − liabilities) | Higher |
| Surplus | Latest `CashFlowPoint.net` (income − expense) | Higher |
| Savings rate | Latest `CashFlowPoint.savingsRatePct` (net / income × 100) | Higher |
| Spend vs budget | Actual as a percentage of budget across the three expense sections | Lower |

A delta compares against the previous point in the same series, and is absent when there is no earlier point. A tile shows `—` when its series is empty. `savingsRatePct` is 0 when income is zero. Spend vs budget is `null`, not 0%, when nothing was budgeted. It reads only `EXPENSE` rows, so repayments are not in it.

Spend vs budget shows no month-on-month delta. Its stat carries `leftInBudget` (budget minus actual) and the tile says `£X under budget` in green, or `£X over budget` in red with the percentage itself turned red.

## Charts

### Income vs expenses (`cashFlow`)
Bars for income and expense per month, plus a dashed savings-rate line on a second axis. `monthFlow()` in `src/lib/dashboard/series.ts` counts `REPAYMENT` rows as expense and leaves `TRANSFER` rows out of both series (money you still own). A month appears when it has any non-transfer row.

### Spending by category (`categorySpending`)
Three panels (Fixed, Variable, Discretionary), each showing actual, budget and a trailing 6-month average of actual per month. Built from `EXPENSE` rows only, so repayments do not appear here.

### Balance over time (`balanceTrend`)
A line chart with one line per bucket, assets above zero and liabilities negated below it, plus a net line. Buckets are current, medium-term, long-term, property (assets only) and other; a bucket that is zero in every month is not drawn. The axis spans the user's own lowest and highest figures on round gridlines (`niceStep` with `amountAxis`, `src/lib/charts/format.ts`), and only the latest net point is labelled. `accountBalanceSums()` buckets each `BalanceItem` by its account's derived `kindOf(type)` and `section`. `balanceSeries()` negates liabilities and computes net.

### Balance by category (`balanceCategory`)
Up to six small panels (current, medium-term and long-term, for assets and for liabilities); a bucket that is zero in every month gets none. Each shows that bucket's balance per month against its 6-month average. The liability panels start a new row, so debts line up under the assets. Property and other buckets have no panel.

## Actuals source

With the transactions feature off, actuals are the stored `BudgetItem.actual`. With it on, the page overlays computed actuals for the whole window in one pass per source: category rows net their categorised transactions, and `TRANSFER`/`REPAYMENT` rows net their account's transfer flow (`getTransferFlowByMonthAndAccount`). Without the account-keyed half, a repayment would chart as zero.

## Chart visibility

Keys (`cashFlow`, `categorySpending`, `balanceTrend`, `balanceCategory`) are declared in `DASHBOARD_CHARTS` (`src/lib/dashboard/charts.ts`). Switching a group off in `src/app/(app)/settings/DashboardSettings.tsx` adds its key to `UserSettings.hiddenCharts` (a `String[]`), and `DashboardView` skips hidden groups. The summary strip is always shown.

## Data flow

`page.tsx` loads the window's periods server-side, shapes the series with the pure functions in `src/lib/dashboard/`, and passes them to client chart components. The charts load lazily. The "latest" point for the KPIs is the last month that has data in each series, and the starter month seeded at provisioning gives new users one (see [`onboarding.md`](onboarding.md)).
