import {
  accountDeletionCounts,
  archiveAccount,
  createAccountWithBalance,
  deleteAccountEverywhere,
  restoreAccount,
} from "@/app/(app)/balance/accountActions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

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
    const { accountId } = await createAccountWithBalance({
      ...isaInput,
      name: "Home",
      category: "PROPERTY",
      wrapper: "PROPERTY",
      value: 420000,
      mortgage: {
        name: "Halifax mortgage",
        value: 184200,
        canImportTransactions: false,
      },
    });

    const mortgage = await prisma.account.findFirstOrThrow({
      where: { userId: TEST_USER_ID, kind: "LIABILITY" },
    });
    expect(mortgage.linkedAccountId).toBe(accountId);

    const rows = await prisma.balanceItem.findMany({
      where: { period: { userId: TEST_USER_ID } },
    });
    expect(rows).toHaveLength(2);
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
    const { accountId } = await createAccountWithBalance({
      ...isaInput,
      name: "Home",
      category: "PROPERTY",
      wrapper: "PROPERTY",
      value: 420000,
      mortgage: {
        name: "Halifax mortgage",
        value: 184200,
        canImportTransactions: false,
      },
    });

    const counts = await accountDeletionCounts({ accountId });

    expect(counts.months).toBe(1);
    expect(counts.linked?.name).toBe("Halifax mortgage");
    expect(counts.linked?.latestValue).toBe(184200);
  });

  it("deleting everywhere removes every observation", async () => {
    const { accountId } = await createAccountWithBalance(isaInput);

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    expect(
      await prisma.account.findUnique({ where: { id: accountId } }),
    ).toBeNull();
    expect(await prisma.balanceItem.count({ where: { accountId } })).toBe(0);
  });

  it("takes the linked mortgage only when asked", async () => {
    const { accountId } = await createAccountWithBalance({
      ...isaInput,
      name: "Home",
      category: "PROPERTY",
      wrapper: "PROPERTY",
      value: 420000,
      mortgage: {
        name: "Halifax mortgage",
        value: 184200,
        canImportTransactions: false,
      },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: false });

    // The survivor is left unencumbered rather than pointing at nothing.
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { userId: TEST_USER_ID },
    });
    expect(mortgage.name).toBe("Halifax mortgage");
    expect(mortgage.linkedAccountId).toBeNull();
  });

  it("takes both sides when asked", async () => {
    const { accountId } = await createAccountWithBalance({
      ...isaInput,
      name: "Home",
      category: "PROPERTY",
      wrapper: "PROPERTY",
      value: 420000,
      mortgage: {
        name: "Halifax mortgage",
        value: 184200,
        canImportTransactions: false,
      },
    });

    await deleteAccountEverywhere({ accountId, alsoLinked: true });

    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.balanceItem.count({
        where: { period: { userId: TEST_USER_ID } },
      }),
    ).toBe(0);
  });

  // Task 1's reviewer flagged that nothing tests the ON DELETE SET NULL
  // behaviour on BalanceItem.accountId. deleteAccountEverywhere deletes the
  // children before the account, so that FK action never fires on the happy
  // path — it's a safety net for any other deletion route, present or future.
  // Exercised here against the raw Prisma call, not through the action.
  it("hard-deleting an account nulls out balance rows that still point at it, rather than deleting them", async () => {
    const { accountId, periodId } = await createAccountWithBalance(isaInput);

    await prisma.account.delete({ where: { id: accountId } });

    const item = await prisma.balanceItem.findFirstOrThrow({
      where: { periodId },
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
