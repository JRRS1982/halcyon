import {
  deleteAccount,
  renameAccount,
  setAccountImports,
} from "@/app/(app)/settings/accountActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

describe("account CRUD (integration)", () => {
  test("creates and renames an account", async () => {
    // createManagedAccount is gone — the drawer (Task 6) is the one way to
    // create an account now — so this creates the fixture directly, the same
    // way that action used to.
    const created = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Savings",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    await renameAccount({ accountId: created.id, name: "ISA" });
    const renamed = await prisma.account.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(renamed.name).toBe("ISA");
  });

  test("soft-deletes an unreferenced account", async () => {
    const acct = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Spare" },
    });
    await deleteAccount({ accountId: acct.id });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: acct.id },
    });
    expect(after.deletedAt).not.toBeNull();
  });

  test("blocks delete while the account owns transactions", async () => {
    const acct = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Owns txns" },
    });
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: acct.id,
        date: new Date("2026-03-01"),
        amount: -5,
        description: "x",
      },
    });
    await expect(deleteAccount({ accountId: acct.id })).rejects.toThrow();
  });

  test("blocks delete while the account is a transfer counterparty", async () => {
    const owner = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Owner" },
    });
    const counterparty = await prisma.account.create({
      data: { userId: TEST_USER_ID, name: "Counterparty" },
    });
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
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

  test("turns imports on for an account, changeable after creation", async () => {
    const acct = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        canImportTransactions: false,
      },
    });
    await setAccountImports({ accountId: acct.id, enabled: true });
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: acct.id },
    });
    expect(after.canImportTransactions).toBe(true);
  });

  // ADR-002: the server role bypasses RLS, so this userId-scoped update is the
  // only fence — proven here by attempting to touch another user's account.
  test("refuses to touch another user's account", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirs = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: "Their ISA",
        canImportTransactions: false,
      },
    });
    await expect(
      setAccountImports({ accountId: theirs.id, enabled: true }),
    ).rejects.toThrow();
    const after = await prisma.account.findUniqueOrThrow({
      where: { id: theirs.id },
    });
    expect(after.canImportTransactions).toBe(false);
  });
});
