# Dashboard Charts

**What:** Read-only summary of financial health — four KPI tiles and four togglable charts drawn from balance and budget data.  
**Route:** `/dashboard`  
**Key points:**
- KPI strip: net worth, surplus, savings rate, spend vs budget — each with delta vs previous month
- Four charts: balance trend, income vs expenses, spending by category, balance by account type
- Each chart individually togglable via Settings → Dashboard charts (`UserSettings.hiddenCharts`)
- No editing from this page; all data flows from `/balance` and `/budget`

## Summary strip

Four KPI tiles derived from the same series data as the charts — no extra queries:

| Tile | Value | Direction |
|------|-------|-----------|
| Net worth | Latest `BalancePoint.net` (assets − liabilities) | Higher is better |
| Surplus | Latest `CashFlowPoint.net` (income − expense) | Higher is better |
| Savings rate | `CashFlowPoint.savingsRatePct` (net / income × 100) | Higher is better |
| Spend vs budget | Actual spend as % of budgeted across all expense sections | Lower is better |

Each tile shows a delta against the previous recorded month. A tile shows `—` when there is no data yet. `savingsRatePct` is 0 when income is zero (not null) to avoid division-by-zero.

## Charts

Four charts, each togglable via Settings → Dashboard charts:

### Balance over time (`balanceTrend`)
Stacked area showing asset and liability groups per month. Liabilities are negated (sit below zero). Groups: current, medium-term, long-term, property (assets only), other. Net worth line overlaid. Source: `balanceSeries()` in `src/lib/dashboard/series.ts`, fed from `BalanceItem` rows joined to their owning `Account.type`.

### Income vs expenses (`cashFlow`)
Bar chart of income and expense per month, with a net line. REPAYMENT rows count as expense; TRANSFER rows are excluded (money you still own). Source: `cashFlowSeries()` / `monthFlow()` in `src/lib/dashboard/series.ts`, fed from `BudgetItem.actual` values.

### Spending by category (`categorySpending`)
Per-expense-section actual vs budget per month (Fixed / Variable / Discretionary), each with a trailing 6-month average line. Source: `trailingAverageSeries()` in `src/lib/dashboard/series.ts`.

### Balance by category (`balanceCategory`)
Breakdown of the current net worth by account section. Source: same `BalanceSums` buckets as the balance trend chart.

## Chart visibility

Each chart group has a key (`cashFlow`, `categorySpending`, `balanceTrend`, `balanceCategory`). Keys land in `UserSettings.hiddenCharts` (a `String[]`) when toggled off. The dashboard skips hidden groups at render time.

Configure via Settings → Dashboard charts (`src/app/(app)/settings/DashboardSettings.tsx`). The toggle list is declared in `src/lib/dashboard/charts.ts` (`DASHBOARD_CHARTS`).

## Data flow

All chart data is fetched server-side in `page.tsx`, transformed in `src/lib/dashboard/series.ts`, and passed to client chart components. The "latest period" for KPIs is the most recent `FinancialPeriod` for the user — the starter month seeded at sign-up satisfies this on first load.
