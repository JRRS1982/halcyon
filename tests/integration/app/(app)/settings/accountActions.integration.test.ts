import { TEST_USER_ID } from "@test/support/helpers";
import {
  renameAccount,
  setAccountImports,
} from "@/app/(app)/settings/accountActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

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

  test("turns imports on for an account, changeable after creation", async () => {
    const acct = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Halifax mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
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
        ...buildAccountData({ type: "STOCKS_ISA" }),
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
