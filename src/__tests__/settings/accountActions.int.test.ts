import {
  createManagedAccount,
  deleteAccount,
  renameAccount,
} from "@/app/(app)/settings/accountActions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

describe("account CRUD (integration)", () => {
  test("creates and renames an account", async () => {
    await createManagedAccount({ name: "Savings" });
    const created = await prisma.account.findFirstOrThrow({
      where: { userId: TEST_USER_ID, name: "Savings" },
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
});
