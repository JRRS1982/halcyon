# Transfers Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user tag a transaction as a transfer between two of their own accounts so it counts as neither income nor expense, manage accounts in Settings, and see per-account transfer totals in an opt-in budget section.

**Architecture:** A transfer is a normal `Transaction` that points at a second `Account` (the counterparty) via a new nullable `transferAccountId` instead of a `Category`. Category and transfer are mutually exclusive and enforced server-side. Because every budget/dashboard `actual` aggregate already filters on `categoryId`, transfers fall out of income/expense automatically. A new opt-in budget "Transfers" section totals signed transfer flow per owning account (double-counting is impossible because the two legs live on different accounts' rows), each row expandable to its counterparty breakdown.

**Tech Stack:** Next.js 14 App Router (server components + server actions), Prisma + Postgres, styled-components, zod, Jest (unit + `*.int.test.ts` integration against real Postgres), Playwright (e2e). pnpm.

**Spec:** `docs/superpowers/specs/2026-06-02-transfers-feature-design.md`

**Conventions to follow:**
- Early returns, self-documenting names, minimal deps (`.ai/code-style.md`).
- Server actions validate input with zod at the boundary; enforce auth + `userId` scoping independently.
- **Migrations run only inside the container** (CLAUDE.md DB trap): `make migrate-create name=<verb_table>` to author, `make migrate-deploy` to apply. Never `pnpm prisma migrate` on the host.
- Integration tests are `*.int.test.ts` (node env), run with `pnpm test:int` against `halcyon_test`. Unit tests are `*.test.ts`/`*.test.tsx`, run with `pnpm test`.
- Pre-flight before each commit: `pnpm verify` (typecheck + check + test) for unit-only tasks; add `pnpm test:int` when integration tests change.

---

## File Structure

**Create:**
- `src/lib/transactions/transfers.ts` — pure `netTransfersByAccount` helper (per-account netting + counterparty breakdown). Unit-tested.
- `src/lib/transactions/transfers.test.ts` — unit tests for the helper.
- `src/app/settings/accountActions.ts` — account CRUD server actions + delete guard.
- `src/app/settings/accountActions.int.test.ts` — integration tests for account CRUD.
- `src/app/settings/AccountManager.tsx` — Settings UI for account CRUD (mirrors `CategoryManager.tsx`).
- `src/app/budget/TransfersPanel.tsx` — client component rendering the budget Transfers section (expandable rows).
- `src/app/transactions/transfers.int.test.ts` — integration tests for `setTransactionTransfer` + mutual exclusion + the `getTransfersByAccount` query.

**Modify:**
- `prisma/schema.prisma` — `Transaction.transferAccountId` + named relations; `UserSettings.transfersEnabled`.
- `src/lib/settings/server.ts` — surface `transfersEnabled` from `getCurrentUserSettings`.
- `src/lib/transactions/server.ts` — `getTransfersByAccount` query + `getLedgerAccounts`; add `accountId`/`transferAccountId` to `LedgerTransaction`; fix `onlyUncategorized` filter + `countUncategorized` to exclude transfers.
- `src/app/transactions/actions.ts` — `setTransactionTransfer`; clear `transferAccountId` in `setTransactionCategory`; `createAccount` inline action for the ledger.
- `src/app/transactions/CategoryCombobox.tsx` — Transfer ▸ option → account picker + inline create.
- `src/app/transactions/Ledger.tsx` — thread accounts + `transfersEnabled`; transfer handlers + optimistic state.
- `src/app/transactions/TransactionsView.tsx` — pass `transfersEnabled` through to `Ledger`.
- `src/app/transactions/page.tsx` — load `transfersEnabled`, pass to view.
- `src/app/settings/actions.ts` — `toggleTransfers`.
- `src/app/settings/SettingsForm.tsx` — transfers toggle (subordinate to transactions).
- `src/app/settings/page.tsx` — load accounts + counts; render `AccountManager`; pass `transfersEnabled` to `SettingsForm`.
- `src/app/budget/page.tsx` — render `TransfersPanel` when `transactionsEnabled && transfersEnabled`.

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (the `Transaction`, `Account`, `UserSettings` models)

Adding a second relation between `Transaction` and `Account` forces **both** relations to be named (Prisma requirement). We name the existing owning-account relation `AccountTransactions` and the new counterparty relation `TransferCounterparty`.

- [ ] **Step 1: Add `transferAccountId` + named relations to `Transaction`**

In `prisma/schema.prisma`, change the `Transaction` model's `account` relation and add the counterparty field/relation:

```prisma
model Transaction {
  id                String    @id @default(uuid()) @db.Uuid
  userId            String    @db.Uuid
  accountId         String    @db.Uuid
  categoryId        String?   @db.Uuid
  transferAccountId String?   @db.Uuid
  date              DateTime  @db.Date
  amount            Decimal   @db.Decimal(14, 2)
  description       String
  note              String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  account         Account   @relation("AccountTransactions", fields: [accountId], references: [id], onDelete: Cascade)
  category        Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  // The other side of a transfer. App-level guards block deleting an account
  // that is still referenced here (we soft-delete accounts), so onDelete:
  // Restrict is belt-and-braces defence, never expected to fire.
  transferAccount Account?  @relation("TransferCounterparty", fields: [transferAccountId], references: [id], onDelete: Restrict)

  // (userId, accountId, date) → pagination + dedup-fingerprint day lookup +
  // the per-account transfer aggregate (filtered transferAccountId IS NOT NULL).
  // (userId, categoryId, date) → the per-category-per-month actual aggregate.
  @@index([userId, accountId, date])
  @@index([userId, categoryId, date])
}
```

- [ ] **Step 2: Name the inverse relations on `Account`**

In the `Account` model, replace `transactions Transaction[]` with the two named inverse relations:

```prisma
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions  Transaction[] @relation("AccountTransactions")
  transfersFrom Transaction[] @relation("TransferCounterparty")
```

- [ ] **Step 3: Add `transfersEnabled` to `UserSettings`**

In the `UserSettings` model, add the column next to `transactionsEnabled`:

```prisma
  transactionsEnabled Boolean  @default(false)
  transfersEnabled    Boolean  @default(false)
```

- [ ] **Step 4: Author the migration (inside the container)**

Run: `make migrate-create name=add_account_transfers`
Expected: a new folder under `prisma/migrations/` containing `ALTER TABLE "Transaction" ADD COLUMN "transferAccountId"`, the FK to `Account`, and `ALTER TABLE "UserSettings" ADD COLUMN "transfersEnabled"`. Prisma Client regenerates as part of `migrate dev`.

> If `make` is unavailable in the execution environment, this task is blocked — flag it. Do **not** run `pnpm prisma migrate` on the host (it targets production per CLAUDE.md).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (the generated client now knows `transferAccountId`, `transferAccount`, `transfersFrom`, `transfersEnabled`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(transfers): schema — transferAccountId + transfersEnabled"
```

---

## Task 2: Surface `transfersEnabled` in settings server

**Files:**
- Modify: `src/lib/settings/server.ts`

- [ ] **Step 1: Add `transfersEnabled` to the return type and value**

In `getCurrentUserSettings`, add to the return type object and the returned value:

```ts
export async function getCurrentUserSettings(): Promise<{
  userId: string;
  currency: CurrencyCode;
  numberFormat: NumberFormat;
  transactionsEnabled: boolean;
  transfersEnabled: boolean;
  hiddenCharts: string[];
}> {
```

and in the `return { ... }` at the end of the function add:

```ts
    transactionsEnabled: row.transactionsEnabled,
    transfersEnabled: row.transfersEnabled,
    hiddenCharts: row.hiddenCharts,
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (This is a passthrough field; consumers in later tasks add the behavioural tests.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/settings/server.ts
git commit -m "feat(transfers): expose transfersEnabled from settings server"
```

---

## Task 3: Per-account transfer netting helper (pure, unit-tested)

**Files:**
- Create: `src/lib/transactions/transfers.ts`
- Test: `src/lib/transactions/transfers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/transactions/transfers.test.ts`:

```ts
import { netTransfersByAccount, type TransferLeg } from "./transfers";

const leg = (
  accountId: string,
  accountName: string,
  counterpartyId: string,
  counterpartyName: string,
  amount: number,
): TransferLeg => ({
  accountId,
  accountName,
  counterpartyId,
  counterpartyName,
  amount,
});

describe("netTransfersByAccount", () => {
  it("nets signed amounts per owning account", () => {
    const rows = netTransfersByAccount([
      leg("cur", "Current", "isa", "ISA", -500),
      leg("cur", "Current", "sipp", "SIPP", -200),
      leg("isa", "ISA", "cur", "Current", 500),
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.accountId, r]));
    expect(byId.cur.net).toBe(-700);
    expect(byId.isa.net).toBe(500);
  });

  it("does NOT collapse the two legs of one transfer (different accounts)", () => {
    const rows = netTransfersByAccount([
      leg("cur", "Current", "isa", "ISA", -500),
      leg("isa", "ISA", "cur", "Current", 500),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.net).sort()).toEqual([-500, 500]);
  });

  it("breaks each account down by counterparty", () => {
    const rows = netTransfersByAccount([
      leg("cur", "Current", "isa", "ISA", -500),
      leg("cur", "Current", "isa", "ISA", -100),
      leg("cur", "Current", "sipp", "SIPP", -200),
    ]);
    const cur = rows.find((r) => r.accountId === "cur");
    expect(cur?.net).toBe(-800);
    expect(cur?.counterparties).toEqual([
      { accountId: "isa", accountName: "ISA", net: -600 },
      { accountId: "sipp", accountName: "SIPP", net: -200 },
    ]);
  });

  it("sorts accounts and counterparties by name and avoids -0", () => {
    const rows = netTransfersByAccount([
      leg("b", "Beta", "a", "Alpha", 100),
      leg("a", "Alpha", "b", "Beta", -100),
    ]);
    expect(rows.map((r) => r.accountName)).toEqual(["Alpha", "Beta"]);
    expect(Object.is(rows[0].net, -100)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/transactions/transfers.test.ts`
Expected: FAIL — "Cannot find module './transfers'".

- [ ] **Step 3: Implement the helper**

Create `src/lib/transactions/transfers.ts`:

```ts
// Turns transfer-tagged transactions into per-account net flow with a
// counterparty breakdown. Each leg is keyed by its OWNING account, so the two
// legs of one real transfer (which live on different accounts) never collapse
// into one figure — double-counting is impossible by construction. Signed:
// money out reads negative, money in positive. Rounded to cents to avoid float
// drift, normalising -0 to 0.

export type TransferLeg = {
  accountId: string;
  accountName: string;
  counterpartyId: string;
  counterpartyName: string;
  amount: number;
};

export type TransferCounterparty = {
  accountId: string;
  accountName: string;
  net: number;
};

export type TransferAccountRow = {
  accountId: string;
  accountName: string;
  net: number;
  counterparties: TransferCounterparty[];
};

const round = (n: number): number => {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
};

export function netTransfersByAccount(
  legs: TransferLeg[],
): TransferAccountRow[] {
  const accounts = new Map<
    string,
    { name: string; total: number; parts: Map<string, { name: string; total: number }> }
  >();

  for (const leg of legs) {
    const account = accounts.get(leg.accountId) ?? {
      name: leg.accountName,
      total: 0,
      parts: new Map(),
    };
    account.total += leg.amount;
    const part = account.parts.get(leg.counterpartyId) ?? {
      name: leg.counterpartyName,
      total: 0,
    };
    part.total += leg.amount;
    account.parts.set(leg.counterpartyId, part);
    accounts.set(leg.accountId, account);
  }

  return Array.from(accounts.entries())
    .map(([accountId, account]) => ({
      accountId,
      accountName: account.name,
      net: round(account.total),
      counterparties: Array.from(account.parts.entries())
        .map(([id, part]) => ({
          accountId: id,
          accountName: part.name,
          net: round(part.total),
        }))
        .sort((a, b) => a.accountName.localeCompare(b.accountName)),
    }))
    .sort((a, b) => a.accountName.localeCompare(b.accountName));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/transactions/transfers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/transactions/transfers.ts src/lib/transactions/transfers.test.ts
git commit -m "feat(transfers): per-account netting helper"
```

---

## Task 4: `getTransfersByAccount` query + `getLedgerAccounts`

**Files:**
- Modify: `src/lib/transactions/server.ts`
- Test: `src/app/transactions/transfers.int.test.ts` (created here; extended in Task 5/6)

- [ ] **Step 1: Write the failing integration test**

Create `src/app/transactions/transfers.int.test.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { getTransfersByAccount } from "@/lib/transactions/server";
import { randomUUID } from "node:crypto";

const userId = randomUUID();

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId } });
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("getTransfersByAccount", () => {
  it("nets transfer legs per owning account within the range", async () => {
    const current = await prisma.account.create({
      data: { userId, name: "Current" },
    });
    const isa = await prisma.account.create({ data: { userId, name: "ISA" } });

    // Two transfer legs of one real move, plus an unrelated categorised txn.
    await prisma.transaction.createMany({
      data: [
        {
          userId,
          accountId: current.id,
          transferAccountId: isa.id,
          date: new Date("2026-03-10"),
          amount: -500,
          description: "To ISA",
        },
        {
          userId,
          accountId: isa.id,
          transferAccountId: current.id,
          date: new Date("2026-03-10"),
          amount: 500,
          description: "From Current",
        },
        {
          userId,
          accountId: current.id,
          date: new Date("2026-03-12"),
          amount: -40,
          description: "Coffee (not a transfer)",
        },
      ],
    });

    const rows = await getTransfersByAccount(
      userId,
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    const byName = Object.fromEntries(rows.map((r) => [r.accountName, r]));
    expect(byName.Current.net).toBe(-500);
    expect(byName.ISA.net).toBe(500);
    expect(byName.Current.counterparties).toEqual([
      { accountId: isa.id, accountName: "ISA", net: -500 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:int -- src/app/transactions/transfers.int.test.ts`
Expected: FAIL — `getTransfersByAccount` is not exported.

- [ ] **Step 3: Implement the query**

In `src/lib/transactions/server.ts`, add the import at the top:

```ts
import { netTransfersByAccount, type TransferAccountRow } from "./transfers";
```

and append these exports at the end of the file:

```ts
// Per-account transfer flow for a period: signed net plus counterparty
// breakdown. Only transfer-tagged rows (transferAccountId set) participate, so
// income/expense is untouched. The owning account keys each row (see
// netTransfersByAccount) — the two legs of one transfer never collapse.
export async function getTransfersByAccount(
  userId: string,
  start: Date,
  end: Date,
): Promise<TransferAccountRow[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      transferAccountId: { not: null },
      date: { gte: start, lte: end },
    },
    select: {
      amount: true,
      account: { select: { id: true, name: true } },
      transferAccount: { select: { id: true, name: true } },
    },
  });

  return netTransfersByAccount(
    rows.flatMap((r) =>
      r.transferAccount
        ? [
            {
              accountId: r.account.id,
              accountName: r.account.name,
              counterpartyId: r.transferAccount.id,
              counterpartyName: r.transferAccount.name,
              amount: Number(r.amount),
            },
          ]
        : [],
    ),
  );
}

// Active accounts for the ledger's transfer picker (id + name).
export async function getLedgerAccounts(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return prisma.account.findMany({
    where: { userId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:int -- src/app/transactions/transfers.int.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transactions/server.ts src/app/transactions/transfers.int.test.ts
git commit -m "feat(transfers): getTransfersByAccount query + getLedgerAccounts"
```

---

## Task 5: `setTransactionTransfer` + mutual exclusion + inline `createAccount`

**Files:**
- Modify: `src/app/transactions/actions.ts`
- Test: `src/app/transactions/transfers.int.test.ts` (extend)

- [ ] **Step 1: Add failing integration tests for the actions**

Append to `src/app/transactions/transfers.int.test.ts` a new describe block (and add the action imports at the top of the file):

```ts
import {
  setTransactionCategory,
  setTransactionTransfer,
} from "./actions";
```

```ts
// requireTransactionsEnabled reads the user's settings; enable the feature.
async function enableTransactions() {
  await prisma.userSettings.upsert({
    where: { userId },
    update: { transactionsEnabled: true },
    create: { userId, transactionsEnabled: true },
  });
}

// The actions call Supabase auth; mock it to return our test user.
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  }),
}));

describe("setTransactionTransfer / mutual exclusion", () => {
  beforeAll(enableTransactions);

  it("sets the counterparty and clears any category; reverting to a category clears the transfer", async () => {
    const current = await prisma.account.create({
      data: { userId, name: "Current 5" },
    });
    const isa = await prisma.account.create({ data: { userId, name: "ISA 5" } });
    const category = await prisma.category.create({
      data: { userId, label: "Groceries 5", type: "EXPENSE" },
    });
    const tx = await prisma.transaction.create({
      data: {
        userId,
        accountId: current.id,
        categoryId: category.id,
        date: new Date("2026-03-05"),
        amount: -500,
        description: "Move",
      },
    });

    await setTransactionTransfer({ transactionId: tx.id, accountId: isa.id });
    let after = await prisma.transaction.findUniqueOrThrow({
      where: { id: tx.id },
    });
    expect(after.transferAccountId).toBe(isa.id);
    expect(after.categoryId).toBeNull();

    await setTransactionCategory({
      transactionId: tx.id,
      categoryId: category.id,
    });
    after = await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(after.categoryId).toBe(category.id);
    expect(after.transferAccountId).toBeNull();
  });

  it("rejects a transfer to the transaction's own account", async () => {
    const current = await prisma.account.create({
      data: { userId, name: "Current 5b" },
    });
    const tx = await prisma.transaction.create({
      data: {
        userId,
        accountId: current.id,
        date: new Date("2026-03-06"),
        amount: -10,
        description: "Self",
      },
    });
    await expect(
      setTransactionTransfer({ transactionId: tx.id, accountId: current.id }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:int -- src/app/transactions/transfers.int.test.ts`
Expected: FAIL — `setTransactionTransfer` is not exported.

- [ ] **Step 3: Implement the actions**

In `src/app/transactions/actions.ts`, modify `setTransactionCategory` so it also clears the transfer (replace its `data: { categoryId }`):

```ts
  const result = await prisma.transaction.updateMany({
    where: { id: transactionId, userId, deletedAt: null },
    // Category and transfer are mutually exclusive — assigning (or clearing) a
    // category always clears any transfer counterparty.
    data: { categoryId, transferAccountId: null },
  });
```

Then add the transfer action and an inline account creator (place after `setTransactionCategory`):

```ts
const setTransferSchema = z.object({
  transactionId: z.string().uuid(),
  accountId: z.string().uuid(),
});

// Tags a transaction as a transfer to/from one of the user's own accounts:
// sets transferAccountId and clears any category (mutually exclusive). The
// counterparty must belong to the user, be active, and differ from the
// transaction's own owning account (a transfer to itself is meaningless).
export async function setTransactionTransfer(
  input: z.input<typeof setTransferSchema>,
): Promise<void> {
  const userId = await requireTransactionsEnabled();
  const { transactionId, accountId } = setTransferSchema.parse(input);

  const [account, transaction] = await Promise.all([
    prisma.account.findFirst({
      where: { id: accountId, userId, deletedAt: null },
      select: { id: true },
    }),
    prisma.transaction.findFirst({
      where: { id: transactionId, userId, deletedAt: null },
      select: { accountId: true },
    }),
  ]);
  if (!account) throw new Error("Account not found");
  if (!transaction) throw new Error("Transaction not found");
  if (transaction.accountId === accountId) {
    throw new Error("A transfer must be to a different account");
  }

  await prisma.transaction.updateMany({
    where: { id: transactionId, userId, deletedAt: null },
    data: { transferAccountId: accountId, categoryId: null },
  });

  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

// Creates an account inline from the ledger transfer picker (when the user has
// none yet) and returns it for immediate assignment.
export async function createAccount(
  input: z.input<typeof createAccountSchema>,
): Promise<{ id: string; name: string }> {
  const userId = await requireTransactionsEnabled();
  const { name } = createAccountSchema.parse(input);
  const created = await prisma.account.create({
    data: { userId, name: cleanLabel(name) },
    select: { id: true, name: true },
  });
  revalidatePath("/transactions");
  revalidatePath("/settings");
  return created;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:int -- src/app/transactions/transfers.int.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/app/transactions/actions.ts src/app/transactions/transfers.int.test.ts
git commit -m "feat(transfers): setTransactionTransfer + mutual exclusion + inline createAccount"
```

---

## Task 6: Account CRUD actions + delete guard

**Files:**
- Create: `src/app/settings/accountActions.ts`
- Test: `src/app/settings/accountActions.int.test.ts`
- Modify: `src/app/settings/actions.ts` (add `toggleTransfers`)

- [ ] **Step 1: Write the failing integration test**

Create `src/app/settings/accountActions.int.test.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import {
  createManagedAccount,
  deleteAccount,
  renameAccount,
} from "./accountActions";

const userId = randomUUID();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  }),
}));

beforeAll(async () => {
  await prisma.user.create({ data: { id: userId } });
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("account CRUD", () => {
  it("creates and renames an account", async () => {
    await createManagedAccount({ name: "Savings" });
    const created = await prisma.account.findFirstOrThrow({
      where: { userId, name: "Savings" },
    });
    await renameAccount({ accountId: created.id, name: "ISA" });
    const renamed = await prisma.account.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(renamed.name).toBe("ISA");
  });

  it("soft-deletes an unreferenced account", async () => {
    const acct = await prisma.account.create({
      data: { userId, name: "Spare" },
    });
    await deleteAccount({ accountId: acct.id });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: acct.id },
    });
    expect(after.deletedAt).not.toBeNull();
  });

  it("blocks delete while the account owns transactions", async () => {
    const acct = await prisma.account.create({
      data: { userId, name: "Owns txns" },
    });
    await prisma.transaction.create({
      data: {
        userId,
        accountId: acct.id,
        date: new Date("2026-03-01"),
        amount: -5,
        description: "x",
      },
    });
    await expect(deleteAccount({ accountId: acct.id })).rejects.toThrow();
  });

  it("blocks delete while the account is a transfer counterparty", async () => {
    const owner = await prisma.account.create({
      data: { userId, name: "Owner cp" },
    });
    const counterparty = await prisma.account.create({
      data: { userId, name: "Counterparty cp" },
    });
    await prisma.transaction.create({
      data: {
        userId,
        accountId: owner.id,
        transferAccountId: counterparty.id,
        date: new Date("2026-03-02"),
        amount: -5,
        description: "x",
      },
    });
    await expect(
      deleteAccount({ accountId: counterparty.id }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:int -- src/app/settings/accountActions.int.test.ts`
Expected: FAIL — "Cannot find module './accountActions'".

- [ ] **Step 3: Implement the account actions**

Create `src/app/settings/accountActions.ts`:

```ts
"use server";

import { cleanLabel } from "@/lib/categories/normalize";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Accounts are managed in Settings and exist independently of the transactions
// feature toggle, so these gate on auth only.
async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/settings");
  return user.id;
}

function revalidateAll() {
  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/budget");
}

const createSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function createManagedAccount(
  input: z.input<typeof createSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { name } = createSchema.parse(input);
  await prisma.account.create({ data: { userId, name: cleanLabel(name) } });
  revalidateAll();
}

const renameSchema = createSchema.extend({ accountId: z.string().uuid() });

export async function renameAccount(
  input: z.input<typeof renameSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId, name } = renameSchema.parse(input);
  const result = await prisma.account.updateMany({
    where: { id: accountId, userId, deletedAt: null },
    data: { name: cleanLabel(name) },
  });
  if (result.count === 0) throw new Error("Account not found");
  revalidateAll();
}

const idSchema = z.object({ accountId: z.string().uuid() });

// Soft-delete, but only when the account is unreferenced: it must own no
// transactions and not be named as a transfer counterparty by any transaction.
// The user reassigns/clears those first (mirrors how categories block delete).
export async function deleteAccount(
  input: z.input<typeof idSchema>,
): Promise<void> {
  const userId = await requireUserId();
  const { accountId } = idSchema.parse(input);

  const referenced = await prisma.transaction.count({
    where: {
      userId,
      deletedAt: null,
      OR: [{ accountId }, { transferAccountId: accountId }],
    },
  });
  if (referenced > 0) {
    throw new Error(
      "This account still has transactions. Reassign or remove them first.",
    );
  }

  const result = await prisma.account.updateMany({
    where: { id: accountId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Account not found");
  revalidateAll();
}
```

- [ ] **Step 4: Add `toggleTransfers` to settings actions**

In `src/app/settings/actions.ts`, append:

```ts
// Flips the budget Transfers section on/off. Only affects the budget page's
// rendering (and the ledger's Transfer option), so revalidate those.
export async function toggleTransfers(enabled: boolean) {
  const userId = await requireUserId();
  await prisma.userSettings.upsert({
    where: { userId },
    update: { transfersEnabled: enabled },
    create: { userId, transfersEnabled: enabled },
  });
  revalidatePath("/budget");
  revalidatePath("/transactions");
  revalidatePath("/settings");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:int -- src/app/settings/accountActions.int.test.ts`
Expected: PASS (4 tests).
Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/settings/accountActions.ts src/app/settings/accountActions.int.test.ts src/app/settings/actions.ts
git commit -m "feat(transfers): account CRUD actions + delete guard + toggleTransfers"
```

---

## Task 7: CategoryCombobox — Transfer ▸ option, account picker, inline create

**Files:**
- Modify: `src/app/transactions/CategoryCombobox.tsx`

This adds a second "panel" to the popover. The category behaviour is unchanged; a new **Transfer ▸** row switches to an account picker (search + create-when-empty). The trigger renders the transfer state when set.

- [ ] **Step 1: Extend the props and trigger**

In `src/app/transactions/CategoryCombobox.tsx`, replace the `Props` type and the start of the component (`useState` block) with:

```ts
export type LedgerAccount = { id: string; name: string };

type Props = {
  categories: LedgerCategory[];
  accounts: LedgerAccount[];
  value: string | null;
  transferAccountId: string | null;
  ownAccountId: string;
  defaultType: "EXPENSE" | "INCOME";
  transfersEnabled: boolean;
  disabled?: boolean;
  onSelect: (categoryId: string | null) => void;
  onCreate: (input: NewCategoryInput) => void;
  onTransfer: (accountId: string) => void;
  onCreateAccount: (name: string) => void;
};

export function CategoryCombobox({
  categories,
  accounts,
  value,
  transferAccountId,
  ownAccountId,
  defaultType,
  transfersEnabled,
  disabled,
  onSelect,
  onCreate,
  onTransfer,
  onCreateAccount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"category" | "transfer">("category");
  const [query, setQuery] = useState("");
  const [newType, setNewType] = useState<"EXPENSE" | "INCOME">(defaultType);
  const [newBucket, setNewBucket] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const current = categories.find((c) => c.id === value) ?? null;
  const transferAccount =
    accounts.find((a) => a.id === transferAccountId) ?? null;
  const trimmed = query.trim();
  const matches = trimmed
    ? categories.filter((c) =>
        c.label.toLowerCase().includes(trimmed.toLowerCase()),
      )
    : categories;
  const exact = categories.some(
    (c) => c.label.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exact;

  // Transfer panel: pickable accounts exclude the transaction's own account.
  const transferable = accounts.filter((a) => a.id !== ownAccountId);
  const accountMatches = trimmed
    ? transferable.filter((a) =>
        a.name.toLowerCase().includes(trimmed.toLowerCase()),
      )
    : transferable;
  const accountExact = transferable.some(
    (a) => a.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreateAccount = trimmed.length > 0 && !accountExact;

  const bucketOptions =
    newType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS;
```

- [ ] **Step 2: Update `close`, add panel switch + transfer handlers**

Replace the `close`, `choose`, `startCreate`, `submitCreate` block with:

```ts
  const close = () => {
    setOpen(false);
    setPanel("category");
    setQuery("");
  };

  const choose = (categoryId: string | null) => {
    onSelect(categoryId);
    close();
  };

  const chooseAccount = (accountId: string) => {
    onTransfer(accountId);
    close();
  };

  const startCreate = () => {
    setNewType(defaultType);
    setNewBucket(
      (defaultType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS)[0].value,
    );
  };

  const submitCreate = () => {
    const bucket =
      newBucket ||
      (newType === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS)[0].value;
    onCreate({ label: trimmed, type: newType, bucket });
    close();
  };

  const submitCreateAccount = () => {
    onCreateAccount(trimmed);
    close();
  };

  // Sign decides the arrow: negative leaves this account (→), positive arrives (←).
  const transferArrow = defaultType === "EXPENSE" ? "→" : "←";
```

- [ ] **Step 3: Update the trigger label**

Replace the `<Trigger>`'s inner content (the `{current ? ... : ...}` expression) with:

```tsx
        {current ? (
          <>
            {current.label} <Muted>· {current.section}</Muted>
          </>
        ) : transferAccount ? (
          <>
            <Muted>Transfer {transferArrow}</Muted> {transferAccount.name}
          </>
        ) : (
          <Muted>— Uncategorized —</Muted>
        )}
```

- [ ] **Step 4: Render the two panels in the popover**

Replace the popover body (everything inside `{open && (<Popover> ... </Popover>)}`) with:

```tsx
      {open && (
        <Popover>
          <SearchInput
            ref={inputRef}
            value={query}
            placeholder={
              panel === "transfer"
                ? "Search or create an account…"
                : "Type to search or create…"
            }
            onChange={(e) => {
              setQuery(e.target.value);
              if (panel === "category") startCreate();
            }}
          />

          {panel === "category" ? (
            <>
              <List>
                {value !== null && (
                  <Option
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(null)}
                  >
                    <span>— Uncategorized —</span>
                  </Option>
                )}
                {transfersEnabled && (
                  <Option
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPanel("transfer");
                      setQuery("");
                    }}
                  >
                    <span>Transfer ▸</span>
                    <OptionMeta>to / from an account</OptionMeta>
                  </Option>
                )}
                {matches.map((c) => (
                  <Option
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(c.id)}
                  >
                    <span>{c.label}</span>
                    <OptionMeta>
                      {c.section} · {c.type === "INCOME" ? "in" : "out"}
                    </OptionMeta>
                  </Option>
                ))}
                {matches.length === 0 && !canCreate && (
                  <Option as="li" style={{ cursor: "default" }}>
                    <Muted>No matches</Muted>
                  </Option>
                )}
              </List>

              {canCreate && (
                <CreatePanel>
                  <span style={{ fontSize: 13 }}>
                    Create <strong>“{trimmed}”</strong> in:
                  </span>
                  <CreateLine>
                    <MiniSelect
                      value={newType}
                      onChange={(e) => {
                        const t = e.target.value as "EXPENSE" | "INCOME";
                        setNewType(t);
                        setNewBucket(
                          (t === "EXPENSE" ? EXPENSE_BUCKETS : INCOME_BUCKETS)[0]
                            .value,
                        );
                      }}
                    >
                      <option value="EXPENSE">Expense</option>
                      <option value="INCOME">Income</option>
                    </MiniSelect>
                    <MiniSelect
                      value={newBucket}
                      onChange={(e) => setNewBucket(e.target.value)}
                    >
                      {bucketOptions.map((b) => (
                        <option key={b.value} value={b.value}>
                          {b.label}
                        </option>
                      ))}
                    </MiniSelect>
                  </CreateLine>
                  <CreateButton
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitCreate}
                  >
                    Create &amp; assign
                  </CreateButton>
                </CreatePanel>
              )}
            </>
          ) : (
            <>
              <List>
                <Option
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setPanel("category");
                    setQuery("");
                  }}
                >
                  <Muted>◂ Back to categories</Muted>
                </Option>
                {accountMatches.map((a) => (
                  <Option
                    key={a.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => chooseAccount(a.id)}
                  >
                    <span>{a.name}</span>
                    <OptionMeta>{transferArrow}</OptionMeta>
                  </Option>
                ))}
                {accountMatches.length === 0 && !canCreateAccount && (
                  <Option as="li" style={{ cursor: "default" }}>
                    <Muted>
                      {transferable.length === 0
                        ? "No accounts yet — type a name to create one"
                        : "No matches"}
                    </Muted>
                  </Option>
                )}
              </List>

              {canCreateAccount && (
                <CreatePanel>
                  <span style={{ fontSize: 13 }}>
                    Create account <strong>“{trimmed}”</strong>
                  </span>
                  <CreateButton
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitCreateAccount}
                  >
                    Create &amp; assign
                  </CreateButton>
                </CreatePanel>
              )}
            </>
          )}
        </Popover>
      )}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: FAIL — `Ledger.tsx` still calls `CategoryCombobox` without the new required props. That is fixed in Task 8; this task's own file is type-correct. Proceed.

- [ ] **Step 6: Commit**

```bash
git add src/app/transactions/CategoryCombobox.tsx
git commit -m "feat(transfers): Transfer option + account picker in CategoryCombobox"
```

---

## Task 8: Ledger wiring + ledger data shape + filters

**Files:**
- Modify: `src/lib/transactions/server.ts` (LedgerTransaction shape, filters)
- Modify: `src/app/transactions/Ledger.tsx`
- Modify: `src/app/transactions/TransactionsView.tsx`
- Modify: `src/app/transactions/page.tsx`

- [ ] **Step 1: Add transfer fields to `LedgerTransaction` + serialize**

In `src/lib/transactions/server.ts`, extend the `LedgerTransaction` type:

```ts
export type LedgerTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  categoryId: string | null;
  transferAccountId: string | null;
  accountId: string;
  accountName: string;
};
```

Update `serialize` (its parameter type and return) to carry the new fields:

```ts
function serialize(tx: {
  id: string;
  date: Date;
  amount: { toString(): string };
  description: string;
  categoryId: string | null;
  transferAccountId: string | null;
  accountId: string;
  account: { name: string };
}): LedgerTransaction {
  return {
    id: tx.id,
    date: tx.date.toISOString(),
    amount: Number(tx.amount),
    description: tx.description,
    categoryId: tx.categoryId,
    transferAccountId: tx.transferAccountId,
    accountId: tx.accountId,
    accountName: tx.account.name,
  };
}
```

In `getTransactionsPage`, add the fields to `select` and fix the uncategorized filter (a transfer is resolved, not uncategorized):

```ts
      ...(query.onlyUncategorized
        ? { categoryId: null, transferAccountId: null }
        : {}),
```

```ts
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      categoryId: true,
      transferAccountId: true,
      accountId: true,
      account: { select: { name: true } },
    },
```

And fix `countUncategorized` so transfers don't count as needing attention:

```ts
export async function countUncategorized(userId: string): Promise<number> {
  return prisma.transaction.count({
    where: {
      userId,
      deletedAt: null,
      categoryId: null,
      transferAccountId: null,
    },
  });
}
```

- [ ] **Step 2: Thread accounts + transfers into the Ledger**

In `src/app/transactions/Ledger.tsx`, update the imports and `LedgerProps`:

```ts
import type {
  LedgerCategory,
  LedgerPage,
  LedgerTransaction,
  SortColumn,
  SortDir,
} from "@/lib/transactions/server";
import { useEffect, useState, useTransition } from "react";
import styled from "styled-components";
import { CategoryCombobox, type NewCategoryInput } from "./CategoryCombobox";
import {
  createAccount,
  createCategory,
  loadMoreTransactions,
  setTransactionCategory,
  setTransactionTransfer,
} from "./actions";

type LedgerAccount = { id: string; name: string };

type LedgerProps = {
  initialPage: LedgerPage;
  categories: LedgerCategory[];
  accounts: LedgerAccount[];
  uncategorizedCount: number;
  transfersEnabled: boolean;
};
```

Update the component signature + state to take and track accounts:

```ts
export function Ledger({
  initialPage,
  categories: initialCategories,
  accounts: initialAccounts,
  uncategorizedCount,
  transfersEnabled,
}: LedgerProps) {
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<LedgerTransaction[]>(initialPage.items);
  const [nextOffset, setNextOffset] = useState<number | null>(
    initialPage.nextOffset,
  );
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [categories, setCategories] = useState(initialCategories);
  const [accounts, setAccounts] = useState(initialAccounts);
```

Add accounts to the re-sync effect dependency block:

```ts
  useEffect(() => {
    setItems(initialPage.items);
    setNextOffset(initialPage.nextOffset);
    setCategories(initialCategories);
    setAccounts(initialAccounts);
  }, [initialPage, initialCategories, initialAccounts]);
```

- [ ] **Step 3: Add transfer optimistic handlers**

In `Ledger.tsx`, replace `applyAssignment` and add transfer handlers. A row that becomes a transfer is no longer uncategorized, so drop it under the filter:

```ts
  // Optimistically reflect a category assignment; clears any transfer. Drops the
  // row if it no longer matches the "uncategorized only" filter.
  const applyAssignment = (transactionId: string, categoryId: string | null) =>
    setItems((prev) =>
      onlyUncategorized && categoryId !== null
        ? prev.filter((t) => t.id !== transactionId)
        : prev.map((t) =>
            t.id === transactionId
              ? { ...t, categoryId, transferAccountId: null }
              : t,
          ),
    );

  // Optimistically reflect a transfer; clears any category. A transfer is no
  // longer "uncategorized", so drop it under that filter.
  const applyTransfer = (transactionId: string, accountId: string) =>
    setItems((prev) =>
      onlyUncategorized
        ? prev.filter((t) => t.id !== transactionId)
        : prev.map((t) =>
            t.id === transactionId
              ? { ...t, transferAccountId: accountId, categoryId: null }
              : t,
          ),
    );

  const onSelect = (transactionId: string, categoryId: string | null) => {
    applyAssignment(transactionId, categoryId);
    startTransition(async () => {
      await setTransactionCategory({ transactionId, categoryId });
    });
  };

  const onTransfer = (transactionId: string, accountId: string) => {
    applyTransfer(transactionId, accountId);
    startTransition(async () => {
      await setTransactionTransfer({ transactionId, accountId });
    });
  };

  const onCreateAccountAndTransfer = (transactionId: string, name: string) => {
    startTransition(async () => {
      const created = await createAccount({ name });
      setAccounts((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      applyTransfer(transactionId, created.id);
      await setTransactionTransfer({ transactionId, accountId: created.id });
    });
  };
```

- [ ] **Step 4: Pass the new props to `CategoryCombobox`**

In `Ledger.tsx`, replace the `<CategoryCombobox .../>` usage in the table body with:

```tsx
                  <CategoryCombobox
                    categories={categories}
                    accounts={accounts}
                    value={tx.categoryId}
                    transferAccountId={tx.transferAccountId}
                    ownAccountId={tx.accountId}
                    defaultType={tx.amount < 0 ? "EXPENSE" : "INCOME"}
                    transfersEnabled={transfersEnabled}
                    onSelect={(categoryId) => onSelect(tx.id, categoryId)}
                    onCreate={(input) => onCreateAndAssign(tx.id, input)}
                    onTransfer={(accountId) => onTransfer(tx.id, accountId)}
                    onCreateAccount={(name) =>
                      onCreateAccountAndTransfer(tx.id, name)
                    }
                  />
```

- [ ] **Step 5: Thread `transfersEnabled` through the view + page**

In `src/app/transactions/TransactionsView.tsx`, add `transfersEnabled` to the props and pass it to `Ledger`:

```tsx
export function TransactionsView({
  accounts,
  categories,
  initialPage,
  uncategorizedCount,
  transfersEnabled,
}: {
  accounts: Account[];
  categories: LedgerCategory[];
  initialPage: LedgerPage;
  uncategorizedCount: number;
  transfersEnabled: boolean;
}) {
  return (
    <Shell>
      <PageHeader
        eyebrow="Money in & out"
        title="Transactions"
        lead="Import bank statements and categorize spending against your budget."
      />
      <ImportPanel accounts={accounts} />
      <Ledger
        initialPage={initialPage}
        categories={categories}
        accounts={accounts}
        uncategorizedCount={uncategorizedCount}
        transfersEnabled={transfersEnabled}
      />
    </Shell>
  );
}
```

In `src/app/transactions/page.tsx`, read the setting and pass it through. Replace the body of `TransactionsPage`:

```tsx
import { prisma } from "@/lib/prisma";
import {
  getCurrentUserSettings,
  requireTransactionsEnabled,
} from "@/lib/settings/server";
import {
  countUncategorized,
  getOrProvisionCategories,
  getTransactionsPage,
} from "@/lib/transactions/server";
import { TransactionsView } from "./TransactionsView";

export default async function TransactionsPage() {
  const userId = await requireTransactionsEnabled();
  const { transfersEnabled } = await getCurrentUserSettings();

  const [accounts, categories, initialPage, uncategorizedCount] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      getOrProvisionCategories(userId),
      getTransactionsPage(userId),
      countUncategorized(userId),
    ]);

  return (
    <TransactionsView
      accounts={accounts}
      categories={categories}
      initialPage={initialPage}
      uncategorizedCount={uncategorizedCount}
      transfersEnabled={transfersEnabled}
    />
  );
}
```

- [ ] **Step 6: Typecheck + unit tests**

Run: `pnpm typecheck`
Expected: PASS (combobox callers now satisfy the new props).
Run: `pnpm test`
Expected: PASS (no unit regressions).

- [ ] **Step 7: Commit**

```bash
git add src/lib/transactions/server.ts src/app/transactions/Ledger.tsx src/app/transactions/TransactionsView.tsx src/app/transactions/page.tsx
git commit -m "feat(transfers): wire transfer tagging through the ledger"
```

---

## Task 9: Settings UI — AccountManager + transfers toggle

**Files:**
- Create: `src/app/settings/AccountManager.tsx`
- Modify: `src/app/settings/SettingsForm.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Build the AccountManager component**

Create `src/app/settings/AccountManager.tsx` (mirrors `CategoryManager.tsx`; create / rename / delete with a guard message):

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styled from "styled-components";
import { SectionHeading } from "./SectionHeading";
import {
  createManagedAccount,
  deleteAccount,
  renameAccount,
} from "./accountActions";

export type ManagedAccount = {
  id: string;
  name: string;
  // Transactions that sit IN this account.
  ownedCount: number;
  // Transactions naming this account as a transfer counterparty.
  counterpartyCount: number;
};

const Shell = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]}
    ${({ theme }) => theme.spacing["5xl"]};
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.xl};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
`;

const Grow = styled.span`
  flex: 1;
  min-width: 120px;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
`;

const Meta = styled.span`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
  white-space: nowrap;
`;

const Input = styled.input`
  flex: 1;
  min-width: 120px;
  padding: ${({ theme }) => theme.spacing.xs}
    ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.hairline};
  border-radius: ${({ theme }) => theme.rounded.sm};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
`;

const TextButton = styled.button<{ $danger?: boolean }>`
  border: none;
  background: none;
  padding: ${({ theme }) => theme.spacing.xs};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.negative : theme.colors.accent};
  cursor: pointer;

  &:disabled {
    color: ${({ theme }) => theme.colors.dim};
    cursor: default;
  }
`;

const CreateRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

type Mode = { kind: "edit" | "delete"; id: string } | null;

export function AccountManager({
  accounts,
}: {
  accounts: ManagedAccount[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(null);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      setMode(null);
      router.refresh();
    });

  const onCreate = () => {
    if (!newName.trim()) return;
    run(() => createManagedAccount({ name: newName }));
    setNewName("");
  };

  const renderRow = (a: ManagedAccount) => {
    const referenced = a.ownedCount + a.counterpartyCount;

    if (mode?.kind === "edit" && mode.id === a.id) {
      return (
        <Row key={a.id}>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <TextButton
            type="button"
            disabled={pending || !editName.trim()}
            onClick={() =>
              run(() => renameAccount({ accountId: a.id, name: editName }))
            }
          >
            Save
          </TextButton>
          <TextButton type="button" onClick={() => setMode(null)}>
            Cancel
          </TextButton>
        </Row>
      );
    }

    if (mode?.kind === "delete" && mode.id === a.id) {
      return (
        <Row key={a.id}>
          <Grow>
            {referenced > 0 ? (
              <>
                <strong>{a.name}</strong> still has {referenced} transaction(s).
                Reassign or remove them before deleting.
              </>
            ) : (
              <>
                Remove <strong>{a.name}</strong>?
              </>
            )}
          </Grow>
          {referenced === 0 && (
            <TextButton
              type="button"
              $danger
              disabled={pending}
              onClick={() => run(() => deleteAccount({ accountId: a.id }))}
            >
              Remove
            </TextButton>
          )}
          <TextButton type="button" onClick={() => setMode(null)}>
            Cancel
          </TextButton>
        </Row>
      );
    }

    return (
      <Row key={a.id}>
        <Grow>{a.name}</Grow>
        <Meta>{referenced} txns</Meta>
        <TextButton
          type="button"
          onClick={() => {
            setMode({ kind: "edit", id: a.id });
            setEditName(a.name);
          }}
        >
          Edit
        </TextButton>
        <TextButton
          type="button"
          $danger
          onClick={() => setMode({ kind: "delete", id: a.id })}
        >
          Delete
        </TextButton>
      </Row>
    );
  };

  return (
    <Shell>
      <SectionHeading>Accounts</SectionHeading>
      <Lead>
        Accounts are where your money sits — current, savings, ISA, SIPP. Import
        statements against them, and name them when tagging a transfer. An
        account can’t be deleted while it still has transactions.
      </Lead>

      <CreateRow>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New account…"
        />
        <Button type="button" onClick={onCreate} disabled={pending}>
          Add
        </Button>
      </CreateRow>

      {accounts.length === 0 ? (
        <Empty>No accounts yet — add one above or create one while importing.</Empty>
      ) : (
        [...accounts]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(renderRow)
      )}
    </Shell>
  );
}
```

- [ ] **Step 2: Add the transfers toggle to SettingsForm**

In `src/app/settings/SettingsForm.tsx`, add `transfersEnabled` to the props type and destructure (after `transactionsEnabled`):

```ts
  transactionsEnabled,
  transfersEnabled,
}: {
  action: (formData: FormData) => Promise<void>;
  currency: string;
  currencyOptions: SelectOption[];
  numberFormat: string;
  numberFormatOptions: SelectOption[];
  transactionsEnabled: boolean;
  transfersEnabled: boolean;
}) {
```

Add the import:

```ts
import { toggleTransactions, toggleTransfers } from "./actions";
```

Add transfers state near the transactions toggle state (after `togglePending`):

```ts
  // The transfers toggle persists immediately (low-risk; no confirm dialog).
  // It is subordinate to transactions — only meaningful when transactions is on.
  const [transfersOn, setTransfersOn] = useState(transfersEnabled);
  const [transfersPending, startTransfers] = useTransition();
  const onToggleTransfers = (next: boolean) => {
    setTransfersOn(next);
    startTransfers(async () => {
      await toggleTransfers(next);
      router.refresh();
    });
  };
```

Then render a second toggle inside the Transactions section, immediately after the closing `</ToggleField>` of the transactions toggle (before the `{confirming && ...}` block):

```tsx
      <ToggleField>
        <ToggleText>
          <FieldLabel>Transfers</FieldLabel>
          <FieldHint>
            Adds a Transfers section to the budget that totals money moved
            between your own accounts (e.g. Current → ISA) — kept out of income
            and expenses. Tag a transaction as a transfer from the Transactions
            page. Needs Transactions switched on.
          </FieldHint>
        </ToggleText>
        <SwitchControl>
          <SwitchInput
            type="checkbox"
            aria-label="Transfers"
            checked={transfersOn}
            disabled={transfersPending || !enabled}
            onChange={(event) => onToggleTransfers(event.target.checked)}
          />
          <SwitchTrack />
        </SwitchControl>
      </ToggleField>
```

- [ ] **Step 3: Wire AccountManager + props into the settings page**

In `src/app/settings/page.tsx`, add imports:

```ts
import { AccountManager, type ManagedAccount } from "./AccountManager";
```

Destructure `transfersEnabled` from settings (update the existing destructure):

```ts
  const {
    userId,
    currency,
    numberFormat,
    transactionsEnabled,
    transfersEnabled,
    hiddenCharts,
  } = await getCurrentUserSettings();
```

After the category loading block, load accounts with both counts. Add:

```ts
  const accountRows = await prisma.account.findMany({
    where: { userId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const [ownedCounts, counterpartyCounts] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { userId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["transferAccountId"],
      where: { userId, deletedAt: null, transferAccountId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const ownedByAccount: Record<string, number> = {};
  for (const c of ownedCounts) ownedByAccount[c.accountId] = c._count._all;
  const counterpartyByAccount: Record<string, number> = {};
  for (const c of counterpartyCounts) {
    if (c.transferAccountId)
      counterpartyByAccount[c.transferAccountId] = c._count._all;
  }
  const managedAccounts: ManagedAccount[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    ownedCount: ownedByAccount[a.id] ?? 0,
    counterpartyCount: counterpartyByAccount[a.id] ?? 0,
  }));
```

Pass `transfersEnabled` to `SettingsForm` and render `AccountManager` after `CategoryManager`:

```tsx
      <SettingsForm
        action={updateSettings}
        currency={currency}
        currencyOptions={currencyOptions}
        numberFormat={numberFormat}
        numberFormatOptions={numberFormatOptions}
        transactionsEnabled={transactionsEnabled}
        transfersEnabled={transfersEnabled}
      />
      <DashboardSettings hiddenCharts={hiddenCharts} />
      <CategoryManager categories={managedCategories} />
      <AccountManager accounts={managedAccounts} />
```

- [ ] **Step 4: Typecheck + lint + unit tests**

Run: `pnpm typecheck`
Expected: PASS.
Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/AccountManager.tsx src/app/settings/SettingsForm.tsx src/app/settings/page.tsx
git commit -m "feat(transfers): Settings AccountManager + transfers toggle"
```

---

## Task 10: Budget Transfers section

**Files:**
- Create: `src/app/budget/TransfersPanel.tsx`
- Modify: `src/app/budget/page.tsx`

- [ ] **Step 1: Build the TransfersPanel client component**

Create `src/app/budget/TransfersPanel.tsx`:

```tsx
"use client";

import { formatSignedAmount } from "@/lib/settings/currency";
import type { TransferAccountRow } from "@/lib/transactions/transfers";
import { useState } from "react";
import styled from "styled-components";

const Section = styled.section`
  max-width: 960px;
  margin: ${({ theme }) => theme.spacing["3xl"]} auto 0;
  padding: 0 ${({ theme }) => theme.spacing["2xl"]}
    ${({ theme }) => theme.spacing["3xl"]};
`;

const Title = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.monoCaps.family};
  font-size: ${({ theme }) => theme.typography.monoCaps.size};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.monoCaps.letterSpacing};
  color: ${({ theme }) => theme.colors.dim};
`;

const Lead = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
  max-width: 60ch;
`;

const Row = styled.button`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.colors.hairline};
  background: none;
  cursor: pointer;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: ${({ theme }) => theme.typography.bodyMd.size};
  color: ${({ theme }) => theme.colors.ink};
  text-align: left;
`;

const Net = styled.span<{ $negative: boolean }>`
  font-variant-numeric: tabular-nums;
  color: ${({ $negative, theme }) =>
    $negative ? theme.colors.ink : theme.colors.positive};
`;

const Parts = styled.div`
  padding: ${({ theme }) => theme.spacing.xs} 0
    ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;

const PartRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xs} 0;
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

const Empty = styled.p`
  font-family: ${({ theme }) => theme.typography.bodyMd.family};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.body};
`;

export function TransfersPanel({
  rows,
  currency,
  numberFormat,
}: {
  rows: TransferAccountRow[];
  currency: string;
  numberFormat: string;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Section>
      <Title>Transfers</Title>
      <Lead>
        Money moved between your own accounts this month — counted as neither
        income nor expense. Each row is one account’s net transfer flow; expand
        it to see where the money went or came from.
      </Lead>
      {rows.length === 0 ? (
        <Empty>No transfers this month.</Empty>
      ) : (
        rows.map((row) => (
          <div key={row.accountId}>
            <Row
              type="button"
              onClick={() =>
                setOpen((id) => (id === row.accountId ? null : row.accountId))
              }
            >
              <span>
                {open === row.accountId ? "▾" : "▸"} {row.accountName}
              </span>
              <Net $negative={row.net < 0}>
                {formatSignedAmount(currency, row.net, numberFormat)}
              </Net>
            </Row>
            {open === row.accountId && (
              <Parts>
                {row.counterparties.map((part) => (
                  <PartRow key={part.accountId}>
                    <span>
                      {part.net < 0 ? "→" : "←"} {part.accountName}
                    </span>
                    <Net $negative={part.net < 0}>
                      {formatSignedAmount(currency, part.net, numberFormat)}
                    </Net>
                  </PartRow>
                ))}
              </Parts>
            )}
          </div>
        ))
      )}
    </Section>
  );
}
```

> `formatSignedAmount` and `NumberFormat` typing: the function accepts the format string; `numberFormat` from settings is already that string, matching how `BudgetSheet` passes it.

- [ ] **Step 2: Render the panel from the budget page**

In `src/app/budget/page.tsx`, add the imports:

```ts
import { getTransfersByAccount } from "@/lib/transactions/server";
import type { TransferAccountRow } from "@/lib/transactions/transfers";
import { TransfersPanel } from "./TransfersPanel";
```

Pull `transfersEnabled` from settings (update the existing destructure near line 59):

```ts
  const { currency, numberFormat, transactionsEnabled, transfersEnabled } =
    await getCurrentUserSettings();
```

Before the `return (`, compute the rows when both features are on:

```ts
  const transferRows: TransferAccountRow[] =
    transactionsEnabled && transfersEnabled
      ? await getTransfersByAccount(user.id, range.startDate, range.endDate)
      : [];
```

Wrap the existing `<BudgetSheet .../>` return in a fragment and append the panel. Replace the final `return (<BudgetSheet ... />)` so it reads:

```tsx
  return (
    <>
      <BudgetSheet
        key={formatYm(year, month)}
        period={serializedPeriod}
        initialItems={serializedItems}
        year={year}
        month={month}
        currency={currency}
        numberFormat={numberFormat}
        hasTemplate={hasTemplate}
        {/* keep any remaining existing props below this line unchanged */}
      />
      {transactionsEnabled && transfersEnabled && (
        <TransfersPanel
          rows={transferRows}
          currency={currency}
          numberFormat={numberFormat}
        />
      )}
    </>
  );
```

> Preserve every existing `<BudgetSheet>` prop (lines ~210-220 continue past the snippet read here, e.g. `hasTemplate` and any others). Only wrap-and-append — do not drop props.

- [ ] **Step 3: Typecheck + lint + unit tests**

Run: `pnpm typecheck`
Expected: PASS.
Run: `pnpm check`
Expected: PASS (Biome — fix with `pnpm lint:fix` / `pnpm format` if needed).
Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/budget/TransfersPanel.tsx src/app/budget/page.tsx
git commit -m "feat(transfers): budget Transfers section"
```

---

## Task 11: End-to-end test

**Files:**
- Create: `e2e/transfers.spec.ts`

This follows the existing `e2e/` patterns (mock Supabase auth on `:54321`, Next dev on `:3100`, real `halcyon_test` Postgres). Inspect an existing spec (e.g. the transactions journey referenced in git log) for the sign-in helper and selectors before writing; reuse them.

- [ ] **Step 1: Write the e2e spec**

Create `e2e/transfers.spec.ts`. Adapt the sign-in/setup helpers from the existing transactions spec; the assertions that matter:

```ts
import { expect, test } from "@playwright/test";
// import { signIn, enableTransactions } from "./_helpers"; // reuse existing helpers

test("transfers: enable, tag a transaction, see it in the budget section", async ({
  page,
}) => {
  // 1. Sign in (reuse the existing helper used by the transactions spec).
  // await signIn(page);

  // 2. Settings: turn on Transactions, then Transfers.
  await page.goto("/settings");
  await page.getByLabel("Transactions").check();
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByLabel("Transfers").check();

  // 3. Accounts: create two accounts in Settings.
  await page.getByPlaceholder("New account…").fill("Current");
  await page.getByRole("button", { name: "Add" }).click();
  await page.getByPlaceholder("New account…").fill("ISA");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("ISA")).toBeVisible();

  // 4. Transactions: import or seed a row, then tag it as a transfer.
  //    Open the category combobox on a row, choose "Transfer ▸", pick "ISA".
  await page.goto("/transactions");
  // ...import a statement against "Current" (reuse the transactions spec's
  //    import helper), then on the imported negative row:
  await page.getByText("— Uncategorized —").first().click();
  await page.getByText("Transfer ▸").click();
  await page.getByText("ISA").click();

  // 5. The row now shows the transfer state and is gone from "Uncategorized only".
  await expect(page.getByText("Transfer →").first()).toBeVisible();

  // 6. Budget: the Transfers section lists the Current account's net.
  await page.goto("/budget");
  await expect(
    page.getByRole("heading", { name: "Transfers" }),
  ).toBeVisible();
  await expect(page.getByText("Current")).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e test locally (chromium)**

Run: `make test-e2e name="transfers"`
Expected: PASS. (Needs `sudo npx playwright install-deps` once, per CLAUDE.md.)

- [ ] **Step 3: Commit**

```bash
git add e2e/transfers.spec.ts
git commit -m "test(e2e): transfers journey — enable, tag, budget section"
```

---

## Task 12: Full verification + spec status

**Files:**
- Modify: `docs/superpowers/specs/2026-06-02-transfers-feature-design.md` (status line)

- [ ] **Step 1: Apply pending migration to the local DB**

Run: `make migrate-deploy`
Expected: the `add_account_transfers` migration applies cleanly.

- [ ] **Step 2: Full local pre-flight (unit + lint + types)**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 3: Integration tests**

Run: `pnpm test:int`
Expected: PASS (transfers + account CRUD suites green).

- [ ] **Step 4: Mark the spec accepted**

In the spec, change `**Status:** Draft (awaiting review)` to `**Status:** Implemented`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-02-transfers-feature-design.md
git commit -m "docs(transfers): mark spec implemented"
```

---

## Self-Review Notes (coverage map)

| Spec requirement | Task |
|---|---|
| `transferAccountId` on Transaction, mutually exclusive with category | 1, 5 |
| `transfersEnabled` setting (in Settings) | 1, 2, 6, 9 |
| Transfer ▸ in combobox → required counterparty account + inline create | 5, 7 |
| Off-budget (no category aggregate change needed) | verified in 4/10 (aggregate already filters categoryId) |
| Direction read from sign | 7 (combobox arrow), 10 (panel arrow) |
| Accounts CRUD in Settings; delete blocked while referenced; no merge | 6, 9 |
| Per-account totalling, double-count impossible, expandable counterparty detail | 3, 4, 10 |
| Self-counterparty excluded | 5 (action guard), 7 (picker filters ownAccountId) |
| Uncategorized count/filter excludes transfers | 8 |
| zod validation + userId scoping + auth on every action | 5, 6 |
| Tests: unit / integration / e2e | 3, 4, 5, 6, 11 |
