import {
  setTransactionCategory,
  setTransactionTransfer,
} from "@/app/(app)/transactions/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const makeAccount = (name: string) =>
  prisma.account.create({ data: { userId: TEST_USER_ID, name } });

describe("setTransactionTransfer / mutual exclusion (integration)", () => {
  test("sets the counterparty and clears any category; reverting to a category clears the transfer", async () => {
    const current = await makeAccount("Current");
    const isa = await makeAccount("ISA");
    const category = await prisma.category.create({
      data: { userId: TEST_USER_ID, type: "EXPENSE", label: "Groceries" },
    });
    const tx = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
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
    after = await prisma.transaction.findUniqueOrThrow({
      where: { id: tx.id },
    });
    expect(after.categoryId).toBe(category.id);
    expect(after.transferAccountId).toBeNull();
  });

  test("rejects a transfer to the transaction's own account", async () => {
    const current = await makeAccount("Current");
    const tx = await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
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
