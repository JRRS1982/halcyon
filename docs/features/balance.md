# Balance Sheet

**What:** Per-month grid of every account grouped by section. The stored fact per account per month is `BalanceItem.value`.  
**Route:** `/balance`  
**Key points:**
- Net worth = asset totals − liability totals, computed in `BalanceSheet.tsx` from the displayed rows
- Account type (`CURRENT_ACCOUNT`, `SAVINGS`, `MORTGAGE`, …) drives kind and wrapper through `kindOf()`/`wrapperOf()`. Neither is stored.
- Value and notes edit in place; name, type, section and terms edit in the account card
- Add, archive and delete accounts from the sheet's Add drawer and delete panel

The registry model behind the sheet is documented in [`accounts.md`](accounts.md). This page covers the sheet itself.

## Sheet structure

The page lists the user's live accounts and left-joins the month's `BalanceItem` onto them (`page.tsx`). An account with no value this month still has a row with an empty cell. A blank cell is not £0: clearing a value (`clearBalanceValue`) soft-deletes the observation, and the footer counts accounts still without one. An archived account shows only on past months where it recorded a value.

Rows group by `Account.section`, then `sortOrder`. Columns are account name, value and notes. A strip below the sheet summarises assets, liabilities and net worth for recent months.

## Account type drives everything

`Account.type` is the stored fact. Two properties are derived on demand, never stored:

- `kindOf(type)` returns `ASSET` or `LIABILITY`.
- `wrapperOf(type)` returns a `PlanAssetWrapper` (`PENSION`, `ISA`, `GIA`, `CASH`, `PROPERTY`, `DB_PENSION`, `OTHER`) or `null` for every liability.

Both live in `src/lib/accounts/accountDraft.ts`. The sheet uses `kindOf` to separate assets from liabilities in net worth, and the dashboard uses it for its balance series.

## Adding accounts

The Add drawer (`AddAccountDrawer.tsx`) asks for type, section, name and value, plus the import checkbox. `createAccount` writes the account and its first `BalanceItem` for the viewed month at the value entered. See [`accounts.md`](accounts.md#adding-an-account) for the property and mortgage branch.

## Editing

- **Value and notes** edit in place (`upsertBalanceValue` in `actions.ts`, debounced). Editing the value clears the row's `carriedOver` flag. A note alone cannot create a row: it needs a value first.
- **Name, type, section and terms** edit in the account card (`AccountCard.tsx`).
- **Fill from another month** (`copyBalancePeriodFrom`) copies the source month's values into the target as provisional `carriedOver` rows. Archived accounts are not carried over.

Changing `type` changes `kindOf`/`wrapperOf` everywhere at once. Changing between asset and liability is refused.

## AccountTerms

A 1:1 satellite on `Account` holding nine nullable projection parameters that Plan Sync mirrors. Which ones the card prompts for is declared per type in `ACCOUNT_TYPES[n].terms`, not in the database. The parameters, their shapes and the rules for stranded values are in [`accounts.md`](accounts.md#account-terms).

## Archiving and deleting

- **Archive** (`archiveAccount`) sets `Account.deletedAt` and soft-deletes that account's values from the viewed month onward. Earlier months keep their values. Settings → Accounts restores it.
- **Delete everywhere** (`deleteAccountEverywhere`) removes the account, its balance values, budget rows, transactions and import batches. It refuses while a live transaction on another account names it as a transfer counterparty.

Both are chosen in `DeleteAccountPanel.tsx`. Details are in [`accounts.md`](accounts.md#deleting-an-account).
