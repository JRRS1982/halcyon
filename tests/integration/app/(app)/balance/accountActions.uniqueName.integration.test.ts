import type { AccountType } from "@prisma/client";
import { resetDb, seedUser, TEST_USER_ID } from "@test/support/helpers";
import {
  archiveAccount,
  createAccount,
  renameAccount,
  restoreAccount,
} from "@/app/(app)/balance/accountActions";
import { createAccountAndTransfer } from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

// If two accounts can share a name, the user cannot tell them apart in any
// picker, and an import into "the" Joint Account can land in either — so its
// duplicate check, which is per account, sees nothing to match.

function typedAccount(name: string, type: AccountType = "CURRENT_ACCOUNT") {
  return prisma.account.create({
    data: { userId: TEST_USER_ID, name, ...buildAccountData({ type }) },
  });
}

const liveNamed = (name: string) =>
  prisma.account.count({
    where: {
      userId: TEST_USER_ID,
      deletedAt: null,
      name: { equals: name, mode: "insensitive" },
    },
  });

const createInput = (name: string) => ({
  year: 2026,
  month: 2,
  name,
  type: "CURRENT_ACCOUNT" as const,
  section: "CURRENT" as const,
  value: 0,
  canImportTransactions: true,
  terms: {},
  mortgage: null,
});

beforeEach(async () => {
  await resetDb();
  await seedUser();
});

describe("account names are unique per user", () => {
  test("creating an account refuses a name already in use, whatever its case", async () => {
    await typedAccount("Joint Account");

    await expect(
      createAccount(createInput("  joint   ACCOUNT ")),
    ).rejects.toThrow(/already have an account called/);
    expect(await liveNamed("Joint Account")).toBe(1);
  });

  test("a transfer target cannot be created under a name already in use", async () => {
    await typedAccount("Savings");
    const owner = await typedAccount("Current");
    const tx = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: owner.id,
        date: new Date("2026-03-01"),
        amount: -10,
        description: "To savings",
      },
    });

    await expect(
      createAccountAndTransfer({ transactionIds: [tx.id], name: "savings" }),
    ).rejects.toThrow(/already have an account called/);
    expect(await liveNamed("Savings")).toBe(1);
  });

  test("renaming refuses another account's name, but allows a change of case to its own", async () => {
    await typedAccount("Joint Account");
    const other = await typedAccount("Monzo");

    await expect(
      renameAccount({ accountId: other.id, name: "JOINT ACCOUNT" }),
    ).rejects.toThrow(/already have an account called/);
    expect(
      (await prisma.account.findUniqueOrThrow({ where: { id: other.id } }))
        .name,
    ).toBe("Monzo");

    await renameAccount({ accountId: other.id, name: "MONZO" });
    expect(
      (await prisma.account.findUniqueOrThrow({ where: { id: other.id } }))
        .name,
    ).toBe("MONZO");
  });

  test("an archived account's name can be reused, but it cannot then be restored alongside", async () => {
    const old = await typedAccount("Joint Account");
    await archiveAccount({
      accountId: old.id,
      alsoLinked: false,
      fromYear: 2026,
      fromMonth: 2,
    });

    await createAccount(createInput("Joint Account"));
    expect(await liveNamed("Joint Account")).toBe(1);

    await expect(restoreAccount({ accountId: old.id })).rejects.toThrow(
      /already have an account called/,
    );
    expect(await liveNamed("Joint Account")).toBe(1);
  });
});
