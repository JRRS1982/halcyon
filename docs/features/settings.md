# Settings

**What:** User-configurable preferences, feature toggles, category and account management, and irreversible data actions.  
**Route:** `/settings`  
**Key points:**
- Preferences: currency, number format, theme — saved to `UserSettings`
- Feature toggles: Transactions (hides the nav item and page) and Transfers and saving (gates the ledger's Transfer option). There is no Plan toggle.
- Category management: create, edit, soft-delete, merge (merge repoints transactions and budget rows, then soft-deletes the source)
- Change password: shown only to accounts that sign in with a password
- Data privacy actions (export, clear, reset, delete account) all require step-up re-authentication: a password, or a one-time emailed code for an account that has none

## Preferences

Saved to `UserSettings`:

| Setting | Options | Default |
|---------|---------|---------|
| Currency | ISO codes via `CURRENCY_CODES` | GBP |
| Number format | `COMMA_0` etc. via `NUMBER_FORMATS` | COMMA_0 |
| Theme | `SYSTEM`, `LIGHT`, `DARK` | SYSTEM |

Theme saves on change; currency and number format save on form submit. Both use `src/app/(app)/settings/actions.ts`.

## Dashboard charts

Toggle which charts appear on `/dashboard`. Hidden keys are stored in `UserSettings.hiddenCharts`. See [dashboard.md](dashboard.md).

## Category management

`CategoryManager.tsx` → `categoryActions.ts`:

- **Create**: adds a `Category` (type, section, label) through `createWithinCap`
- **Edit**: changes the label and section
- **Delete** (soft): sets `Category.deletedAt`. The category leaves the pickers, but transactions keep their `categoryId`, so history still resolves
- **Merge**: repoints the source's transactions and budget rows to a survivor (combining budgets where both have a row in the same month), then soft-deletes the source, in one `$transaction`

The UI shows a transaction count per category to inform merge and delete decisions.

## Account management

See [accounts.md](accounts.md). `AccountManager.tsx` renames an account, toggles `canImportTransactions`, adds an account (the balance sheet's drawer) and deletes one. Delete is a soft-delete, refused while any live transaction sits in the account or names it as a transfer counterparty. Archived accounts list separately and can be restored. Type and section change from the balance sheet's account card, not here.

## Feature toggles

| Toggle | `UserSettings` column | What it gates |
|--------|----------------------|--------------|
| Transactions | `transactionsEnabled` | Hides the Transactions nav item and page; budget actuals are then typed by hand instead of summed from transactions |
| Transfers and saving | `transfersEnabled` | Shows the Transfers option in the ledger's category picker and filter drawer. The switch is disabled while Transactions is off |

Both persist the moment they are switched. There is no Plan toggle: the Plan tab is always visible.

The budget page does not read `transfersEnabled`. TRANSFER and REPAYMENT budget rows show regardless; see [budget-transfers.md](budget-transfers.md).

## Change password

`ChangePassword.tsx` → `changePassword` in `credentialActions.ts`. It verifies the current password through `verifyUser`, checks the new one against the breached-password list (an unreachable list lets the change through), calls `supabase.auth.updateUser`, then revokes the other sessions. The minimum length is 12. It has no rate-limit bucket of its own: `verifyUser` already limits guessing of the current password.

## Monthly reminder

Opt-in email on a chosen day of the month, off by default. The switch and day select are in `SettingsForm.tsx` and persist immediately. See [reminders.md](reminders.md).

## Data privacy

Every action here, export included, takes a step-up proof: a password, or a one-time emailed code for an account with no password. See [../engineering/step-up-auth.md](../engineering/step-up-auth.md). The actions live in `dataActions.ts`.

| Action | What it does |
|--------|-------------|
| Export my data | Returns a JSON string (schema version 3) of every user-owned table, including plans with their child rows and `SentMessage`. Rate-limited to 2 exports a minute, per user. |
| Clear my data | Deletes all financial rows (transactions, budget, balance, accounts, plan, periods). Keeps User, UserSettings, and Categories. |
| Reset to defaults | Same as clear, plus deletes categories, then re-seeds the starter data (41 categories, 6 accounts, £0 budget sheet). |
| Delete my account | Deletes all rows including User and UserSettings in one transaction, then erases the Supabase auth identity with the admin client. If that last call fails it returns `orphaned-auth`; the app data is already gone. On success it redirects to `/`. |
