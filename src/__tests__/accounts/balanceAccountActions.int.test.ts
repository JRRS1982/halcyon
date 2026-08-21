import {
  accountDeletionCounts,
  archiveAccount,
  createAccountWithBalance,
  deleteAccountEverywhere,
  restoreAccount,
} from "@/app/(app)/balance/accountActions";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

const isaInput = {
  year: 2026,
  month: 2,
  name: "Vanguard ISA",
  type: "ASSET" as const,
  category: "LONG_TERM" as const,
  wrapper: "ISA" as const,
  value: 42300,
  canImportTransactions: false,
  mortgage: null,
};

const homeWithMortgageInput = {
  ...isaInput,
  name: "Home",
  category: "PROPERTY" as const,
  wrapper: "PROPERTY" as const,
  value: 420000,
  mortgage: {
    name: "Halifax mortgage",
    value: 184200,
    canImportTransactions: false,
  },
};

describe("account actions (integration)", () => {
  it("creates the account and its first observation together", async () => {
    const { accountId, periodId } = await createAccountWithBalance(isaInput);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(account.kind).toBe("ASSET");
    expect(account.wrapper).toBe("ISA");
    expect(account.canImportTransactions).toBe(false);

    const item = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId },
    });
    expect(item.periodId).toBe(periodId);
    expect(Number(item.value)).toBe(42300);
    // Typed by the user for this month, so not provisional.
    expect(item.carriedOver).toBe(false);
  });

  it("creates a property and its mortgage as one linked pair", async () => {
    const { accountId } = await createAccountWithBalance(homeWithMortgageInput);

    const property = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(property.category).toBe("PROPERTY");
    expect(property.wrapper).toBe("PROPERTY");

    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });
    expect(mortgage.linkedAccountId).toBe(accountId);
    // Mortgage debt files under long-term liabilities, not PROPERTY —
    // PROPERTY is asset-only and the balance sheet doesn't render a
    // LIABILITY/PROPERTY row at all (see BalanceSheet.tsx).
    expect(mortgage.category).toBe("LONG_TERM");
    // A tax wrapper describes an asset, not a debt.
    expect(mortgage.wrapper).toBeNull();

    const mortgageItem = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId: mortgage.id },
    });
    expect(mortgageItem.category).toBe("LONG_TERM");
    expect(mortgageItem.type).toBe("LIABILITY");

    const rows = await prisma.balanceItem.findMany({
      where: { period: { userId: TEST_USER_ID } },
    });
    expect(rows).toHaveLength(2);
  });

  it("gives the mortgage its own sortOrder in the liabilities bucket, not the property's", async () => {
    // Pre-populate the LONG_TERM liability bucket so the property's ASSET
    // sortOrder and the mortgage's LIABILITY sortOrder would collide if the
    // mortgage's sortOrder were (wrongly) computed against the asset bucket.
    const range = monthRangeFor(isaInput.year, isaInput.month);
    const period = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        granularity: "MONTH",
        startDate: range.startDate,
        endDate: range.endDate,
        label: range.label,
      },
    });
    const existingLiability = await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        type: "LIABILITY",
        category: "LONG_TERM",
        label: "Car loan",
        value: 5000,
        sortOrder: 1,
      },
    });

    const { accountId } = await createAccountWithBalance(homeWithMortgageInput);

    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });
    const mortgageItem = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId: mortgage.id },
    });
    const propertyItem = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId },
    });

    expect(mortgageItem.sortOrder).toBe(existingLiability.sortOrder + 1);
    expect(propertyItem.sortOrder).toBe(1);
  });

  it("archiving keeps history and hides the account", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);

    await archiveAccount({ accountId });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(account.deletedAt).not.toBeNull();
    // The observation survives, so the balance trend is untouched.
    expect(await prisma.balanceItem.count({ where: { accountId } })).toBe(1);
  });

  it("restoring clears the archive flag", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);
    await archiveAccount({ accountId });

    await restoreAccount({ accountId });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(account.deletedAt).toBeNull();
  });

  it("counts what a full delete would remove, before it happens", async () => {
    const { accountId } = await createAccountWithBalance(homeWithMortgageInput);

    const counts = await accountDeletionCounts({ accountId });

    expect(counts.months).toBe(1);
    expect(counts.linked?.name).toBe("Halifax mortgage");
    expect(counts.linked?.latestValue).toBe(184200);
  });

  it("counts the account's own transactions and import batches", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);
    const batch = await prisma.importBatch.create({
      data: { userId: TEST_USER_ID, accountId, fileName: "statement.csv" },
    });
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId,
        importBatchId: batch.id,
        date: new Date("2026-03-01"),
        amount: -20,
        description: "Coffee",
      },
    });

    const counts = await accountDeletionCounts({ accountId });

    expect(counts.transactions).toBe(1);
    expect(counts.importBatches).toBe(1);
  });

  it("deleting everywhere removes every observation", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    expect(
      await prisma.account.findUnique({ where: { id: accountId } }),
    ).toBeNull();
    expect(await prisma.balanceItem.count({ where: { accountId } })).toBe(0);
  });

  it("deleting everywhere also removes the account's transactions and import batches", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);
    const batch = await prisma.importBatch.create({
      data: { userId: TEST_USER_ID, accountId, fileName: "statement.csv" },
    });
    const txn = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId,
        importBatchId: batch.id,
        date: new Date("2026-03-01"),
        amount: -20,
        description: "Coffee",
      },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    expect(
      await prisma.transaction.findUnique({ where: { id: txn.id } }),
    ).toBeNull();
    expect(
      await prisma.importBatch.findUnique({ where: { id: batch.id } }),
    ).toBeNull();
  });

  it("refuses to delete an account still named as another transaction's transfer counterparty", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);
    const other = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Current", kind: "NONE" },
    });
    const transferTxn = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: other.id,
        transferAccountId: accountId,
        date: new Date("2026-03-01"),
        amount: -100,
        description: "Transfer to ISA",
      },
    });

    await expect(
      deleteAccountEverywhere({ accountId, alsoLinked: false }),
    ).rejects.toThrow(
      "This account still has transactions. Reassign or remove them first.",
    );

    expect(
      await prisma.account.findUnique({ where: { id: accountId } }),
    ).not.toBeNull();
    expect(
      await prisma.transaction.findUnique({ where: { id: transferTxn.id } }),
    ).not.toBeNull();
  });

  it("does not block deleting a linked pair over a transfer transaction between them", async () => {
    const { accountId } = await createAccountWithBalance(homeWithMortgageInput);
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });
    // Both sides of this transfer are leaving together, so it shouldn't
    // count as a counterparty reference blocking the delete.
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: mortgage.id,
        transferAccountId: accountId,
        date: new Date("2026-03-01"),
        amount: -500,
        description: "Overpayment",
      },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: true });

    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
  });

  it("takes the linked mortgage only when asked", async () => {
    const { accountId } = await createAccountWithBalance(homeWithMortgageInput);
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    // The survivor is left unencumbered rather than pointing at nothing.
    const survivor = await prisma.account.findUniqueOrThrow({
      where: { id: mortgage.id },
    });
    expect(survivor.name).toBe("Halifax mortgage");
    expect(survivor.linkedAccountId).toBeNull();
  });

  it("takes both sides when asked", async () => {
    await createAccountWithBalance(homeWithMortgageInput);
    const { accountId } = await createAccountWithBalance(homeWithMortgageInput);

    await deleteAccountEverywhere({ accountId, alsoLinked: true });

    // Only the second pair was targeted — the first pair (a distinct property
    // + mortgage) is untouched, so this also proves `ids` didn't leak beyond
    // the one linked pair asked for.
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(2);
    expect(
      await prisma.balanceItem.count({
        where: { period: { userId: TEST_USER_ID } },
      }),
    ).toBe(2);
  });

  it("still finds an archived partner when asked to take it along", async () => {
    const { accountId } = await createAccountWithBalance(homeWithMortgageInput);
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });
    // Archiving doesn't clear the link — the mortgage is hidden, not
    // forgotten, so `alsoLinked: true` should still reach it.
    await archiveAccount({ accountId: mortgage.id });

    await deleteAccountEverywhere({ accountId, alsoLinked: true });

    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
  });

  it("does not store a tax wrapper on a plain liability entry", async () => {
    const { accountId } = await createAccountWithBalance({
      ...isaInput,
      type: "LIABILITY",
      category: "OTHER",
      wrapper: "OTHER",
      mortgage: null,
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(account.wrapper).toBeNull();
  });

  it("rejects a mortgage attached to anything other than a PROPERTY asset", async () => {
    await expect(
      createAccountWithBalance({
        ...isaInput,
        mortgage: { name: "Nope", value: 100, canImportTransactions: false },
      }),
    ).rejects.toThrow();
  });

  it("leaves an already-archived balance row alone in the delete, letting the FK null its accountId", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);
    const item = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId },
    });
    // A row already soft-deleted for some unrelated reason — e.g. the user
    // deleted this month's entry directly — before the account itself is
    // hard-deleted.
    await prisma.balanceItem.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    // Not force-deleted by the action's deleteMany (which only targets live
    // rows) — instead left for the FK's own ON DELETE SET NULL to clear its
    // accountId when the account goes.
    const survivor = await prisma.balanceItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(survivor.accountId).toBeNull();
    expect(survivor.deletedAt).not.toBeNull();
  });

  // Task 1's reviewer flagged that nothing tests the ON DELETE SET NULL
  // behaviour on BalanceItem.accountId. deleteAccountEverywhere deletes the
  // children before the account, so that FK action never fires on the happy
  // path — it's a safety net for any other deletion route, present or future.
  // Exercised here against the raw Prisma call, not through the action.
  it("hard-deleting an account nulls out balance rows that still point at it, rather than deleting them", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);
    const balanceItem = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId },
    });

    await prisma.account.delete({ where: { id: accountId } });

    const item = await prisma.balanceItem.findUniqueOrThrow({
      where: { id: balanceItem.id },
    });
    expect(item.accountId).toBeNull();
  });

  // Same FK safety net, other model: FinancialItem.accountId is also
  // ON DELETE SET NULL. Not created by these actions, so seeded directly.
  it("hard-deleting an account nulls out budget rows that still point at it, rather than deleting them", async () => {
    const { accountId, periodId } = await createAccountWithBalance(isaInput);
    const financialItem = await prisma.financialItem.create({
      data: {
        periodId,
        accountId,
        type: "EXPENSE",
        label: "ISA contribution",
      },
    });

    await prisma.account.delete({ where: { id: accountId } });

    const item = await prisma.financialItem.findUniqueOrThrow({
      where: { id: financialItem.id },
    });
    expect(item.accountId).toBeNull();
  });
});

describe("account actions ownership boundary (integration)", () => {
  it("refuses to touch another user's account", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const foreignAccount = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Their ISA", kind: "ASSET" },
    });
    const range = monthRangeFor(isaInput.year, isaInput.month);
    const foreignPeriod = await prisma.financialPeriod.create({
      data: {
        userId: OTHER_USER_ID,
        granularity: "MONTH",
        startDate: range.startDate,
        endDate: range.endDate,
        label: range.label,
      },
    });
    const foreignItem = await prisma.balanceItem.create({
      data: {
        periodId: foreignPeriod.id,
        accountId: foreignAccount.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Their ISA",
        value: 500,
        sortOrder: 1,
      },
    });

    await expect(
      archiveAccount({ accountId: foreignAccount.id }),
    ).rejects.toThrow("Account not found");
    await expect(
      restoreAccount({ accountId: foreignAccount.id }),
    ).rejects.toThrow("Account not found");
    await expect(
      accountDeletionCounts({ accountId: foreignAccount.id }),
    ).rejects.toThrow("Account not found");
    await expect(
      deleteAccountEverywhere({
        accountId: foreignAccount.id,
        alsoLinked: false,
      }),
    ).rejects.toThrow("Account not found");

    expect(
      await prisma.account.findUnique({ where: { id: foreignAccount.id } }),
    ).not.toBeNull();
    expect(
      await prisma.balanceItem.findUnique({ where: { id: foreignItem.id } }),
    ).not.toBeNull();
  });

  // The Critical #1 case: `linkedAccountId` on the caller's own (owned) row is
  // made to point at another user's account — not something
  // createAccountWithBalance would ever do, but nothing in the schema stops
  // it, and a forged/future-written value must not let deleteAccountEverywhere
  // reach across the tenant boundary. This test must fail before the fix in
  // resolveLinkedPartnerId (see report for the RED run).
  it("does not let a forged link reach another user's account when deleting", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);

    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const foreignAccount = await prisma.account.create({
      data: { userId: OTHER_USER_ID, name: "Their ISA", kind: "ASSET" },
    });
    const range = monthRangeFor(isaInput.year, isaInput.month);
    const foreignPeriod = await prisma.financialPeriod.create({
      data: {
        userId: OTHER_USER_ID,
        granularity: "MONTH",
        startDate: range.startDate,
        endDate: range.endDate,
        label: range.label,
      },
    });
    const foreignItem = await prisma.balanceItem.create({
      data: {
        periodId: foreignPeriod.id,
        accountId: foreignAccount.id,
        type: "ASSET",
        category: "LONG_TERM",
        label: "Their ISA",
        value: 9999,
        sortOrder: 1,
      },
    });
    await prisma.account.update({
      where: { id: accountId },
      data: { linkedAccountId: foreignAccount.id },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: true });

    expect(
      await prisma.account.findUnique({ where: { id: accountId } }),
    ).toBeNull();
    expect(
      await prisma.account.findUnique({ where: { id: foreignAccount.id } }),
    ).not.toBeNull();
    expect(
      await prisma.balanceItem.findUnique({ where: { id: foreignItem.id } }),
    ).not.toBeNull();
  });
});
