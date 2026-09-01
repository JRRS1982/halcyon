import {
  accountDeletionCounts,
  archiveAccount,
  createAccount,
  deleteAccountEverywhere,
  restoreAccount,
} from "@/app/(app)/balance/accountActions";
import { kindOf, wrapperOf } from "@/lib/accounts/accountDraft";
import { monthRangeFor } from "@/lib/budget/period";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

const isaInput = {
  year: 2026,
  month: 2,
  name: "Vanguard ISA",
  type: "STOCKS_ISA" as const,
  section: "LONG_TERM" as const,
  value: 42300,
  canImportTransactions: false,
  mortgage: null,
};

const homeWithMortgageInput = {
  ...isaInput,
  name: "Home",
  type: "PROPERTY" as const,
  section: "PROPERTY" as const,
  value: 420000,
  mortgage: {
    name: "Halifax mortgage",
    value: 184200,
    canImportTransactions: false,
  },
};

describe("account actions (integration)", () => {
  it("creates the account and its first observation together", async () => {
    const { accountId, periodId } = await createAccount(isaInput);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(kindOf(account.type)).toBe("ASSET");
    expect(wrapperOf(account.type)).toBe("ISA");
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
    const { accountId } = await createAccount(homeWithMortgageInput);

    const property = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(property.type).toBe("PROPERTY");
    expect(property.section).toBe("PROPERTY");
    expect(wrapperOf(property.type)).toBe("PROPERTY");

    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });
    expect(mortgage.linkedAccountId).toBe(accountId);
    // Mortgage debt files under long-term liabilities, not PROPERTY —
    // PROPERTY is asset-only and the balance sheet doesn't render a
    // LIABILITY/PROPERTY row at all (see BalanceSheet.tsx).
    expect(mortgage.type).toBe("MORTGAGE");
    expect(mortgage.section).toBe("LONG_TERM");
    // A tax wrapper describes an asset, not a debt.
    expect(wrapperOf(mortgage.type)).toBeNull();
    expect(kindOf(mortgage.type)).toBe("LIABILITY");

    await prisma.balanceItem.findFirstOrThrow({
      where: { accountId: mortgage.id },
    });
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
    const carLoan = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Car loan",
        type: "LOAN",
        section: "LONG_TERM",
        sortOrder: 0,
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: period.id,
        accountId: carLoan.id,
        value: 5000,
      },
    });

    const { accountId } = await createAccount(homeWithMortgageInput);

    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });
    const property = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });

    expect(mortgage.sortOrder).toBe(carLoan.sortOrder + 1);
    expect(property.sortOrder).toBe(0);
  });

  it("archiving keeps history and hides the account", async () => {
    const { accountId } = await createAccount(isaInput);

    await archiveAccount({
      accountId,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 2,
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(account.deletedAt).not.toBeNull();
    // The observation survives, so the balance trend is untouched.
    expect(await prisma.balanceItem.count({ where: { accountId } })).toBe(1);
  });

  it("restoring clears the archive flag", async () => {
    const { accountId } = await createAccount(isaInput);
    await archiveAccount({
      accountId,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 2,
    });

    await restoreAccount({ accountId });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(account.deletedAt).toBeNull();
  });

  it("counts what a full delete would remove, before it happens", async () => {
    const { accountId } = await createAccount(homeWithMortgageInput);

    const counts = await accountDeletionCounts({ accountId });

    expect(counts.months).toBe(1);
    expect(counts.linked?.name).toBe("Halifax mortgage");
    expect(counts.linked?.latestValue).toBe(184200);
  });

  it("counts the account's own transactions and import batches", async () => {
    const { accountId } = await createAccount(isaInput);
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

  it("counts a reversed transaction too, because the delete removes it regardless", async () => {
    const { accountId } = await createAccount(isaInput);
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId,
        date: new Date("2026-03-01"),
        amount: -20,
        description: "Coffee",
      },
    });
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId,
        date: new Date("2026-03-02"),
        amount: -15,
        description: "Reversed import row",
        deletedAt: new Date(),
      },
    });

    const counts = await accountDeletionCounts({ accountId });

    // The delete below removes the account's own transactions unconditionally
    // (deletedAt isn't part of that filter), so the count that's meant to
    // describe what's about to be destroyed must include both.
    expect(counts.transactions).toBe(2);
  });

  it("deleting everywhere removes every observation", async () => {
    const { accountId } = await createAccount(isaInput);

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    expect(
      await prisma.account.findUnique({ where: { id: accountId } }),
    ).toBeNull();
    expect(await prisma.balanceItem.count({ where: { accountId } })).toBe(0);
  });

  it("deleting everywhere also removes the account's transactions and import batches", async () => {
    const { accountId } = await createAccount(isaInput);
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
    const { accountId } = await createAccount(isaInput);
    const other = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        type: "CURRENT_ACCOUNT",
        section: "CURRENT",
      },
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
    const { accountId } = await createAccount(homeWithMortgageInput);
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

  // reverseImport soft-deletes a batch's transactions without clearing their
  // transferAccountId (src/app/(app)/transactions/actions.ts), so a
  // surviving account can carry a dead transaction that still points at the
  // account being hard-deleted here. The refusal above only ever sees live
  // rows, so this one must be neutralised inside the transaction instead —
  // otherwise the account delete hits the schema's Restrict FK and throws a
  // raw P2003.
  it("hard-deletes an account even when a reversed transaction elsewhere still names it as the transfer counterparty", async () => {
    const { accountId } = await createAccount(isaInput);
    const other = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Current",
        type: "CURRENT_ACCOUNT",
        section: "CURRENT",
      },
    });
    const reversedTransfer = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: other.id,
        transferAccountId: accountId,
        date: new Date("2026-03-01"),
        amount: -100,
        description: "Transfer to ISA",
        deletedAt: new Date(),
      },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    expect(
      await prisma.account.findUnique({ where: { id: accountId } }),
    ).toBeNull();
    const survivor = await prisma.transaction.findUniqueOrThrow({
      where: { id: reversedTransfer.id },
    });
    expect(survivor.transferAccountId).toBeNull();
  });

  it("takes the linked mortgage only when asked", async () => {
    const { accountId } = await createAccount(homeWithMortgageInput);
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
    await createAccount(homeWithMortgageInput);
    const { accountId } = await createAccount(homeWithMortgageInput);

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
    const { accountId } = await createAccount(homeWithMortgageInput);
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });
    // Archiving doesn't clear the link — the mortgage is hidden, not
    // forgotten, so `alsoLinked: true` should still reach it.
    await archiveAccount({
      accountId: mortgage.id,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 2,
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: true });

    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
  });

  it("does not store a tax wrapper on a plain liability entry", async () => {
    const { accountId } = await createAccount({
      ...isaInput,
      type: "OTHER_DEBT",
      section: "OTHER",
      mortgage: null,
    });

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    expect(wrapperOf(account.type)).toBeNull();
  });

  it("rejects a mortgage attached to anything other than a PROPERTY asset", async () => {
    await expect(
      createAccount({
        ...isaInput,
        mortgage: { name: "Nope", value: 100, canImportTransactions: false },
      }),
    ).rejects.toThrow();
  });

  // Task 1 made BalanceItem.accountId required and its FK ON DELETE CASCADE,
  // so a balance row can no longer outlive its account with a null accountId
  // — the row it was an observation of is gone, and so is the row.
  it("takes an already-archived balance row with the account, via the FK's cascade", async () => {
    const { accountId } = await createAccount(isaInput);
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

    // Not touched by the action's own deleteMany (which only targets live
    // rows) — the FK's ON DELETE CASCADE removes it when the account goes.
    expect(
      await prisma.balanceItem.findUnique({ where: { id: item.id } }),
    ).toBeNull();
  });

  // deleteAccountEverywhere deletes the children before the account, so the
  // FK action never fires on the happy path — it's the safety net for any
  // other deletion route, present or future. Exercised here against the raw
  // Prisma call, not through the action.
  it("hard-deleting an account takes the balance rows that point at it", async () => {
    const { accountId } = await createAccount(isaInput);
    const balanceItem = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId },
    });

    await prisma.account.delete({ where: { id: accountId } });

    expect(
      await prisma.balanceItem.findUnique({ where: { id: balanceItem.id } }),
    ).toBeNull();
  });

  // Same FK safety net, other model: BudgetItem.accountId is also
  // ON DELETE SET NULL. Not created by these actions, so seeded directly.
  it("hard-deleting an account nulls out budget rows that still point at it, rather than deleting them", async () => {
    const { accountId, periodId } = await createAccount(isaInput);
    const budgetItem = await prisma.budgetItem.create({
      data: {
        periodId,
        accountId,
        type: "EXPENSE",
        section: "VARIABLE",
        label: "ISA contribution",
      },
    });

    await prisma.account.delete({ where: { id: accountId } });

    const item = await prisma.budgetItem.findUniqueOrThrow({
      where: { id: budgetItem.id },
    });
    expect(item.accountId).toBeNull();
  });
});

describe("account actions ownership boundary (integration)", () => {
  it("refuses to touch another user's account", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const foreignAccount = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: "Their ISA",
        type: "STOCKS_ISA",
        section: "LONG_TERM",
      },
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
        value: 500,
      },
    });

    await expect(
      archiveAccount({
        accountId: foreignAccount.id,
        alsoLinked: false,
        fromYear: 2026,
        fromMonth: 2,
      }),
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
  // createAccount would ever do, but nothing in the schema stops
  // it, and a forged/future-written value must not let deleteAccountEverywhere
  // reach across the tenant boundary. This test must fail before the fix in
  // resolveLinkedPartnerId (see report for the RED run).
  it("does not let a forged link reach another user's account when deleting", async () => {
    const { accountId } = await createAccount(isaInput);

    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const foreignAccount = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: "Their ISA",
        type: "STOCKS_ISA",
        section: "LONG_TERM",
      },
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
        value: 9999,
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

describe("archiving a mortgaged property (integration)", () => {
  it("takes the mortgage with it when asked", async () => {
    const { accountId } = await createAccount(homeWithMortgageInput);
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });

    await archiveAccount({
      accountId,
      alsoLinked: true,
      fromYear: 2026,
      fromMonth: 2,
    });

    const property = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: mortgage.id },
    });
    // A debt secured on a property nobody tracks any more has nothing to sit
    // against; leaving it live is what put a lone mortgage on the sheet.
    expect(property.deletedAt).not.toBeNull();
    expect(after.deletedAt).not.toBeNull();
  });

  it("leaves the mortgage alone when not asked", async () => {
    const { accountId } = await createAccount(homeWithMortgageInput);
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { linkedAccountId: accountId },
    });

    await archiveAccount({
      accountId,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 2,
    });

    const after = await prisma.account.findUniqueOrThrow({
      where: { id: mortgage.id },
    });
    expect(after.deletedAt).toBeNull();
  });

  // "Stop tracking" now means from this month, not the next one — clicking it
  // and still seeing the row reads as the button not having worked. Months
  // already closed keep what they recorded, which is what separates this from
  // deleting everywhere.
  it("clears this month's row and keeps the closed months", async () => {
    const { accountId, periodId } = await createAccount(isaInput);
    const thisMonth = await prisma.financialPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });

    // An earlier month, closed, with its own observation.
    const earlier = await prisma.financialPeriod.create({
      data: {
        userId: TEST_USER_ID,
        label: "Earlier",
        startDate: new Date("2020-01-01"),
        endDate: new Date("2020-01-31"),
      },
    });
    await prisma.balanceItem.create({
      data: {
        periodId: earlier.id,
        accountId,
        value: 100,
      },
    });

    await archiveAccount({
      accountId,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 2,
    });

    const live = await prisma.balanceItem.findMany({
      where: { accountId, deletedAt: null },
      select: { periodId: true },
    });
    expect(live.map((r) => r.periodId)).toEqual([earlier.id]);
    expect(thisMonth.id).not.toBe(earlier.id);
  });
});
