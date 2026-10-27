# User Journey: Update Balance Sheet

**Journey:** A user opens the balance sheet and records the current value of each account for the month.  
**Outcome:** Account values entered; net worth updated; Plan Sync can read these as opening figures.

## Flow

```mermaid
flowchart TD
    A[Navigate to /balance] --> B[Sheet loads for current month]
    B --> C[Each row is an Account with a value cell and a notes cell]
    C --> D{What does the user want?}
    D -->|Enter a value| E[Click value cell → type amount → saves shortly after]
    D -->|Add a note| F[Click notes cell — enabled once a value exists]
    D -->|Edit account details| G[Click account name → account card opens\nname / type / section / terms]
    D -->|Account missing| H[Click + Add → Add an account drawer\ntype and name required]
    D -->|Stop tracking or delete| R[Click a cell in the row → × Delete row]
    D -->|Copy last month's values| S[Fill this month from… → choose month → Fill]
    D -->|Wrong month| I[◀ ▶ arrows, Today, or the month picker]
    E --> J[Net worth total updates immediately]
    F --> J
    G --> J
    H --> C
    S --> C
    I --> B
```

## Steps

### Enter a value

Click a value cell and type the current balance. The value saves shortly after you stop typing, and the **Net worth** row updates immediately. Assets and liabilities each have a subtotal, grouped into the account's section (Current, Medium-term, Long-term, Property, Other).

### Add a note

A note describes the month's figure, so the notes cell is disabled until the row has a value. Type to save.

### Edit account details

Click the account **name** to open the account card. From there: rename, change type or section, and edit the terms that feed Plan Sync (expected return, fees, interest rate and so on; which fields appear depends on the type). Value and notes stay editable on the sheet.

### Account missing

Click **+ Add**. The **Add an account** drawer asks "What are you adding?" (an asset or liability type), then a name, a section and the value now. The type decides which terms are offered: a mortgage asks for interest rate, interest-only, revision date and rate, and end date; a SIPP asks for expected return, fees and minimum access age.

### Stop tracking or delete an account

Click a cell in the row, then **× Delete row**. A panel offers **Stop tracking it** (the account leaves this month's sheet; closed months keep their values; restorable from Settings) or **Delete it everywhere** (removes every monthly value and the budget transfers pointing at it; cannot be undone, and you type `DELETE` to confirm).

### Fill from another month

Click **Fill this month from…**, choose a month, and confirm with **Fill**. Every line carries over with its value, dimmed until you update it. Filling replaces any values already in the month.

### Past periods

Use **◀** and **▶**, **Today**, or the month label to move between months. Past months stay editable; there is no read-only lock. Editing one changes the balance trend on `/dashboard`. A summary table of months (Assets, Liabilities, Net Worth) appears under the sheet once more than one month exists.
