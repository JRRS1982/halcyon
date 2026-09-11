# Ledger filters: a drawer, a badge, and the chips that undo it

The transactions ledger could answer "where did I spend the word *tesco*?" and
"what have I not categorised?" — and nothing else. A year of imports had no way
to look at one month, one account, one category, or one size of charge.

Four filters now do, from a drawer on the toolbar:

| Filter | URL | Matches |
|---|---|---|
| Date range | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | inclusive at both ends |
| Account | `?acct=<uuid>` | the account the row belongs to |
| Category | `?cat=<uuid>` or `?cat=transfers` | a category, or any transfer |
| Amount | `?min=&max=` | **magnitude**, either sign |
| Uncategorized | `?uncat=1` | no category and no transfer |

The search box (`?q=`) is the one filter that stays outside the drawer — it is
a single gesture, it is debounced, and the controls card gives it a permanent
home. Everything else, uncategorized included, lives in the drawer and reports
itself as a chip.

## Amounts match magnitude, not sign

`Transaction.amount` is signed — an expense is negative. A literal `min`/`max`
would therefore mean typing `-50` to `-10` to find £10–£50 of spending, and
would silently exclude the income of the same size.

`ledgerWhere`
([`src/lib/transactions/filters.ts`](../../src/lib/transactions/filters.ts))
matches on absolute value instead, and the two bounds decompose differently:

```
|a| <= max   is   -max <= a <= max        one range, no OR
|a| >= min   is   a >= min OR a <= -min   everything outside (-min, min)
```

So an upper bound writes `amount` and a lower bound writes `OR`. They are
separate clauses on purpose: supplying both composes instead of colliding. No
raw SQL is involved.

The consequence worth knowing: "everything over £500" returns big income *and*
big spending. That is the intent — you are hunting a charge, not a sign.

## One predicate, one source of truth for what is on

Two extractions carry the feature, and both exist so the same fact cannot be
stated twice and drift:

- **`ledgerWhere`** is the whole predicate, pure and unit-tested without a
  database. `getTransactionsPage` uses it for the page *and* the total, so the
  count can never describe a different set of rows than the page shows.
- **`activeFilters`**
  ([`src/lib/transactions/activeFilters.ts`](../../src/lib/transactions/activeFilters.ts))
  describes a query as the list of filters narrowing it, each with the URL
  patch that clears it. The badge count is its `.length` and the chip row is
  its contents, so the badge can never claim more filters than the chips show.

`uncat` is in that list precisely *because* it moved into the drawer. It used
to be a visible toolbar toggle, and was deliberately excluded from the chips as
a second representation of state you could already see. Once it went into the
drawer that reasoning inverted: invisible state that hides rows is exactly what
the chips exist to prevent.

A filter pointing at a since-deleted account or category keeps its chip,
labelled `Unknown account`. An invisible filter that silently hides rows is
worse than an unhelpfully labelled one, and the chip is the only way to clear
it without hand-editing the URL.

## The drawer holds a draft

Unlike everything else in the ledger, the drawer does **not** write the URL as
you type. Six controls each navigating on change would round-trip the server
six times to reach one state. It holds a draft and writes once, on **Apply** —
and re-seeds from the URL on every open, so an abandoned edit is discarded
rather than waiting to surprise the next person who opens it.

`Clear all` clears every drawer filter — `uncat` included — and deliberately
leaves `q` alone: it clears what the drawer owns.

## Two contradictions the URL can express and the UI cannot

Both are reachable by hand-editing or sharing a link, so both have a decided
outcome rather than an incidental one:

- **`uncat=1` with `cat=<id>`** — both write `categoryId`. The toggle wins.
- **A malformed id** — `accountId` and `categoryId` are `@db.Uuid`, so
  `?acct=banana` is a Prisma error and a 500 on a page anyone can reach from
  the address bar. `parseLedgerSearchParams` shape-checks ids and drops a
  non-uuid, falling back to "no filter" like every other malformed param. A
  *well-formed* id for something that isn't there is a real filter that
  matches nothing.

An out-of-order range (`from` after `to`) is **not** silently swapped. The chip
shows what was asked for, and an empty ledger is the honest answer.

## Where it lives

| File | Job |
|---|---|
| [`src/lib/transactions/pagination.ts`](../../src/lib/transactions/pagination.ts) | URL → sanitized `LedgerUrlQuery` |
| [`src/lib/transactions/filters.ts`](../../src/lib/transactions/filters.ts) | query → Prisma predicate |
| [`src/lib/transactions/activeFilters.ts`](../../src/lib/transactions/activeFilters.ts) | query → chips + badge count |
| [`src/lib/transactions/dateRanges.ts`](../../src/lib/transactions/dateRanges.ts) | the one-tap presets, on an injected `today` |
| [`src/app/(app)/transactions/FilterDrawer.tsx`](../../src/app/(app)/transactions/FilterDrawer.tsx) | the drawer, on the shared `Drawer` chrome |
| [`src/app/(app)/transactions/Ledger.tsx`](../../src/app/(app)/transactions/Ledger.tsx) | the button, badge and chip row |

The drawer's account picker reads the **full** active-account list, not the
importable subset (`canImportTransactions`) used by the import picker and
quick-add — so it can never fail to name an account that owns rows but has
imports switched off.


## The controls card

Everything that acts on the ledger sits in one bounded card, so the table below
reads as a separate object rather than the bottom of a loose pile of controls.
The card is contextual:

| | Card contents |
|---|---|
| Nothing selected | `Filters ⌄` (with count badge) · search box · active-filter chips |
| Rows selected | `N selected` · **categorize box** · `Delete…` · `Clear` |

The search input and the categorize combobox share one fixed-width slot, so the
card does not resize as one replaces the other. The search input is **hidden,
not unmounted** — a half-typed query has to survive a stray row click and come
back when the selection clears.

The swap is the point: once rows are selected you have already found them, so
the box's job changes from finding rows to labelling them.

This replaced a permanently-mounted bulk bar that sat greyed out below the
toolbar whenever nothing was selected. It was permanent only to stop the table
jumping as it mounted and unmounted; a card that is always there solves that
without the dead row. `Delete…` and `Clear` now simply do not exist until there
is something to act on.

## The table's own chrome

The ledger table never got the design system's sheet treatment, and its header
was off-spec in four ways at once — `dim` colour, weight 600, body face, plain
`hairline` — which is why it read as slightly heavier data rather than as the
head of a table. It now follows `sheet-row-head`: canvas-soft ground, mono-caps
labels, `hairline-strong` below.

The footer follows `sheet-row-grand`, the black band that ends a sheet, with
one deliberate deviation: the spec sets its amount in `amount-xl` (18px), but
the ledger's amount column is 96px and a five-figure total would overflow it,
so the band uses `amount-strong`. The band still carries the emphasis, which is
the point the spec is making.

### The total is the page, and says so

`ledgerFooter`
([`src/lib/transactions/totals.ts`](../../src/lib/transactions/totals.ts)) nets
the rows **on screen**, not every matching row. A filtered group usually fits
on one page, where the two are the same number — and when it does not, the
label is what keeps it honest:

| Situation | Label |
|---|---|
| Everything matching fits this page | `Total · 42 transactions` |
| It does not | `This page · 50 of 312` |

Calling a partial sum "Total" would be a lie by omission, and the page size is
expected to become a user setting later, which changes which case you are in.

The sum runs in integer pence. `0.1 + 0.2` in floating point is
`0.30000000000000004`, and a money total nobody typed is a bug people notice.

The figure renders through `toFixed(2)`, matching the amount cells it sums —
they use a raw ASCII hyphen, and the app's typographic minus (`−`) would sit at
a different width in the same column. Worth knowing that the ledger's amount
cells are the one place in the app that bypass
`src/lib/settings/currency.ts`; the footer matches the column it belongs to
rather than half-fixing that.
