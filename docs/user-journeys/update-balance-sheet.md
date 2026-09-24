# User Journey: Update Balance Sheet

**Journey:** A user opens the balance sheet and records the current value of each account for the month.  
**Outcome:** All account values entered; net worth updated; Plan Sync can read these as opening figures.

## Flow

```mermaid
flowchart TD
    A[Navigate to /balance] --> B[Sheet loads for current month]
    B --> C[Each row is an Account with a value cell and notes cell]
    C --> D{What does the user want?}
    D -->|Enter a value| E[Click value cell → type amount → blur to save]
    D -->|Add a note| F[Click notes cell — only enabled after value entered]
    D -->|Edit account details| G[Click account name → Account card opens\nname / type / section / AccountTerms]
    D -->|Account missing| H[Click Add → Add Account drawer\nname + type required]
    D -->|Wrong month| I[Use period navigator in toolbar → pick month]
    E --> J[Net worth total updates immediately]
    F --> J
    G --> J
    H --> C
    I --> B
```

## Steps

### Enter a value

Click any value cell, type the current balance, then Tab or click away. The value saves on blur. The net worth total at the bottom of the sheet updates immediately.

### Add a note

Notes describe the figure — a note cell is disabled until the value cell has a number. Click the notes cell, type, blur to save.

### Edit account details

Click the account **name** to open the account card. From there: rename, change type or section, edit AccountTerms projection parameters (expected return, fees, interest rate, etc.). Value and notes stay editable inline on the sheet — the card is for everything else.

### Account missing

Click **Add** in the toolbar. The drawer requires a name and account type; type drives which AccountTerms fields are offered (e.g. mortgages show revision rate and end date, SIPPs show minimum access age). The new account appears in the sheet immediately.

### Past periods

The period navigator shows all existing months. Past period values can still be edited — there is no read-only lock. Editing a past month updates the historical net worth chart on `/dashboard`.
