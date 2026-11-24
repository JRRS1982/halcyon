# Ledger filters: a drawer, a badge, and the chips that undo it

**What:** Six filters (date range, account, category, amount, uncategorised, to approve) in a drawer beside the search box, plus a Possible transfers view that pairs rows cancelling out across accounts; every active filter shows as a removable chip.  
**Key points:**
- All filter state lives in the URL — shareable, bookmarkable, back-button aware
- Amount filter matches magnitude (absolute value), not sign — £50 matches both debit and credit
- The drawer badge shows the count of active non-search filters
- `ledgerWhere()` in `src/lib/transactions/` is the single pure predicate composing all filters
- Possible transfers are found on read across every row, shown pair by pair, and never change a total

A drawer on the toolbar narrows the ledger by month, account, category, size of
charge, missing category or a category still to approve, alongside the search
box:

| Filter | URL | Matches |
|---|---|---|
| Date range | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | inclusive at both ends |
| Account | `?acct=<uuid>` | the account the row belongs to |
| Category | `?cat=<uuid>` or `?cat=transfers` | a category, or any transfer |
| Amount | `?min=&max=` | **magnitude**, either sign |
| Uncategorised only | `?uncat=1` | no category and no transfer |
| To approve only | `?check=1` | no category and no transfer, **or** a category still in pencil (`isCategoryConfirmed = false`) |
| Counted in budget | `?counted=<accountId>:<YYYY-MM>` | exactly the transactions a budget Transfer or Debt payment row's Actual counted that month; no drawer control |
| Possible transfers | `?pairs=1` | rows in a possible-transfer pair, shown pair by pair; see [below](#possible-transfers) |
| Show hidden pairs | `?pairs=1&hidden=1` | instead, the pairs the user marked *Not a transfer* |

The search box (`?q=`) matches the description, the note and the category's
label, case-insensitively. A transfer has no category, so it is matched by what
its category cell shows instead: the account it moved to or from ("ISA"), the
word "transfer" or the start of it ("trans", three letters or more), or the
whole phrase ("transfer to ISA", where "to" is money out and "from" is money
in). The rules are `transferSearch` in `src/lib/transactions/filters.ts`.

It also reads the import columns a user kept (the row's Details panel, stored in
`Transaction.extra`, such as a bank's own "Pot transfer" type), matching their
**values** only: column names vary by bank, and "type" must not match every row
that kept a Type column. Prisma cannot filter "any value of a JSON object
contains", so `getTransactionsPage` first runs `detailMatchIds`, one
parameterised SQL lookup fenced on the user, and passes the ids it finds into
`ledgerWhere`, which stays a pure function and still wraps them in the user's
own filter. It is the one filter that stays outside the drawer — it is
a single gesture, it is debounced, and the controls card gives it a permanent
home. Everything else, both status toggles included, lives in the drawer and
reports itself as a chip.

## Counted in budget

The budget's Actual popover links to the ledger. For a category row that link
is the drawer's own filters (category plus the month's dates), so the usual
chips appear. A Transfer or Debt payment row's Actual cannot be expressed that
way: it counts one side per counterparty pair, sometimes a leg recorded on
another account ([budget-transfers.md](budget-transfers.md#one-source-per-counterparty-pair)).
So it links to `?counted=<accountId>:<YYYY-MM>`, chip "Counted in budget:
Savings · Mar 2026".

`getTransactionsPage` resolves it to ids with `getTransferBreakdown`, the same
lookup the popover lists, and passes them into `ledgerWhere` beside
`detailMatchIds`. With the filter on and no ids, it matches nothing rather than
everything. It has no drawer control, but it is a chip and counts in the
badge, so both its chip and the drawer's `Clear all` clear it. A malformed
value (a non-uuid, a month outside 1–12) falls back to no filter, like every
other bad param.

A budget month can link to an account archived since, so the page looks up
names for the account and category ids the query names — archived and deleted
ones included, fenced on the user (`getFilterNames`) — and the chip still says
which account it is rather than `Unknown account`.

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

`uncat` and `check` are in that list because they live in the drawer: invisible
state that hides rows is exactly what the chips exist to prevent. The search box is the
one exclusion, since its own input already shows it.

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

`Clear all` clears every drawer filter — `uncat`, `check`, and `pairs` with
its `hidden` view included — and the budget's `counted` filter, and
deliberately leaves `q` alone: it clears every
filter the badge counts.

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

## Possible transfers

A transfer the user has not tagged counts as spending in one account and as
income in the other. **Possible transfers** finds both sides so they can be
dealt with in one go. Off when transfers are off in Settings: the drawer hides
the toggle, like the category picker's Transfers option, and the page ignores
`?pairs=1` in a saved or shared link.

**What counts as a pair:** two live rows of the user's, in **different
accounts**, neither archived (nothing can be a transfer to an archived
account), the same amount with opposite signs, dated within
`PAIR_WINDOW_DAYS` (3) of each other, the window the import review's
`pairOpposites` uses. When a row could match more than one other row, the
pairing is the same every time: rows in date order (ties by id), each taking
the nearest-dated unpaired match after it. The pair is then flagged *"1 other
row could also match"*, counting the distinct other rows that match either side.
A pair is also flagged *"Tagged to a different account"* when a row is already
a transfer to some account other than its match's.

**How it is found:** on read, over every row the user has, never one page.
Nothing is stored at import. `possibleTransferCandidates` (`server.ts`) is one
parameterised self-join, fenced on the user, that returns every row with a
possible opposite. `pairPossibleTransfers`
([`possibleTransfers.ts`](../../src/lib/transactions/possibleTransfers.ts)) is
the pure pairing. The pairs' ids then go into `ledgerWhere`, like
`detailMatchIds`, so the other filters apply. The join compares integer pence,
not `amount`: Postgres hashes a numeric without its sign, so `amount = -amount`
put every −£10 row in one hash bucket with every +£10 row. On 51,500 rows per
user it took 1.3–3.0 s, and an index on `(userId, amount, date)` went unused.
Joining on pence takes about 40 ms with no index, so none was added.

**Other filters choose which pairs show; both rows always show.** A pair shows
when either of its rows matches the rest of the query. So *Account: Current*
still shows the Savings side, and with *Uncategorised only* a pair stays while
at least one row still needs dealing with. With no other filter, pairs already
tagged as transfers still show. The filter never changes a total: the footer
nets the rows on screen, which for whole pairs is £0.

**Layout:** each pair is a summary line, *"Current → Savings · £200.00 · 1 day
apart"*, with both rows bracketed beneath it as ordinary ledger rows. Their
category cells work as usual. In this view a row offers **Details** only when
its import kept columns, and shows no note. Pairs are listed newest first, by
the pair's earlier date, so the column headings do not sort here. The list
pages by pair (`PAIRS_PER_PAGE`, 25, which is 50 rows), so a pair is never split
across two pages.

**Acting on pairs.** One tick on the summary selects both rows, and the usual
bulk actions (categorise, delete) apply to both. Two more appear in the
controls card:

| Action | Server action | Does |
|---|---|---|
| Mark as transfer | `markPairsAsTransfer` | Each row becomes a transfer to the **other** row's account, in one transaction. `bulkSetTransactionTransfer` cannot do this: it points every row at one account and skips rows already in it. A pair that no longer matches (edited since the page was drawn) or has a side in an archived account is left alone, and the ledger says how many. |
| Not a transfer | `dismissPairs` | Stores a `DismissedTransferPair` (both ids plus a snapshot of each row's amount, date and account), then offers **Undo**. A pair that no longer matches is not stored and stays listed, and the ledger says so. At the cap nothing is stored and the reason is shown. |
| Unhide (hidden view) | `unhidePairs` | Removes the record, so the pair is offered again. Undo uses it too. |

A dismissal hides only that exact pair, and only while both rows still match
its snapshot. Editing either row brings the pair back. Hiding A–B does not stop
A pairing with another row, C. `dismissPairs` stores only a real possible pair
of the user's own rows. A repeat dismissal refreshes the snapshot rather than
adding a record. Deleting a row, singly or by undoing its import, removes the
dismissals that name it. A dismissal that stopped applying for any other
reason (a row edited, or moved by deleting its account) is removed at the
user's next dismissal. Records are written only by `dismissWithinCap` and
capped per user at `MAX_DISMISSED_PAIRS_PER_USER` (10,000), counted over every
record; refreshing a pair already hidden does not count as a new one.

Show hidden pairs lists a row once. A row hidden in two pairs (A–B hidden, A
then paired with C, A–C hidden too) appears in the first; unhiding that one
reveals the next.

The notice after a pair action (with Undo, after a dismissal) closes itself
after eight seconds, but not while the pointer or keyboard focus is on it.
Show hidden pairs is there after it goes.

## Where it lives

| File | Job |
|---|---|
| [`src/lib/transactions/pagination.ts`](../../src/lib/transactions/pagination.ts) | URL → sanitized `LedgerUrlQuery` |
| [`src/lib/transactions/filters.ts`](../../src/lib/transactions/filters.ts) | query → Prisma predicate |
| [`src/lib/transactions/possibleTransfers.ts`](../../src/lib/transactions/possibleTransfers.ts) | candidate rows → pairs, dismissals, warnings |
| [`src/lib/transactions/dismissWithinCap.ts`](../../src/lib/transactions/dismissWithinCap.ts) | the one writer of dismissals: prune, cap, store |
| [`src/app/(app)/transactions/PairSummary.tsx`](../../src/app/(app)/transactions/PairSummary.tsx) | a pair's summary line and bracket |
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
It opens the page's **Review transactions** section, under the add controls'
own section. The card is contextual:

| | Card contents |
|---|---|
| Nothing selected | `Filters ⌄` (with count badge) · search box · `Approve all N suggested` (when any are pencilled) · active-filter chips |
| Rows selected | `N selected` · **categorize box** · `Delete…` · `Clear` |
| Pairs selected (Possible transfers) | as above, plus `Mark as transfer` · `Not a transfer` (or `Unhide` among hidden pairs) before `Delete…` |

The search input and the categorize combobox share one fixed-width slot, so the
card does not resize as one replaces the other. The search input is **hidden,
not unmounted** — a half-typed query has to survive a stray row click and come
back when the selection clears.

The swap is the point: once rows are selected you have already found them, so
the box's job changes from finding rows to labelling them.

`Delete…` and `Clear` do not exist until rows are selected. The card itself is
always mounted, so the table does not jump.

## The table's own chrome

The header follows the design system's `sheet-row-head`: semibold labels in the
body colour, closed by a 2px ink rule.

The footer follows `sheet-row-grand`, the bottom line on the soft ground
between two 2px ink rules, with one deliberate deviation: the spec sets its
amount in `amount-xl`, but the ledger's amount column is 96px and a
five-figure total would overflow it, so the footer uses `amount-strong`. The
rules still carry the emphasis, which is the point the spec is making.

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

Calling a partial sum "Total" would be a lie by omission. The page size is the
constant `PAGE_SIZE` (50) in `pagination.ts`.

The sum runs in integer pence. `0.1 + 0.2` in floating point is
`0.30000000000000004`, and a money total nobody typed is a bug people notice.

The figure renders through `formatAmount` (`src/lib/settings/currency.ts`), as
the amount cells it sums do, so both follow the user's currency and number
format setting.
