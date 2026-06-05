import {
  setTransactionCategory,
  setTransactionTransfer,
} from "@/app/transactions/actions";
import { prisma } from "@/lib/prisma";
import { getTransfersByAccount } from "@/lib/transactions/server";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const makeAccount = (name: string) =>
  prisma.account.create({ data: { userId: TEST_USER_ID, name } });

describe("getTransfersByAccount (integration)", () => {
  test("nets transfer legs per owning account within the range", async () => {
    const current = await makeAccount("Current");
    const isa = await makeAccount("ISA");

    // Two legs of one real move, plus an unrelated categorised txn.
    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: isa.id,
          date: new Date("2026-03-10"),
          amount: -500,
          description: "To ISA",
        },
        {
          userId: TEST_USER_ID,
          accountId: isa.id,
          transferAccountId: current.id,
          date: new Date("2026-03-10"),
          amount: 500,
          description: "From Current",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          date: new Date("2026-03-12"),
          amount: -40,
          description: "Coffee (not a transfer)",
        },
      ],
    });

    const rows = await getTransfersByAccount(
      TEST_USER_ID,
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );

    const byName = Object.fromEntries(rows.map((r) => [r.accountName, r]));
    expect(byName.Current?.net).toBe(-500);
    expect(byName.ISA?.net).toBe(500);
    expect(byName.Current?.counterparties).toEqual([
      { accountId: isa.id, accountName: "ISA", net: -500 },
    ]);
  });

  test("excludes transfers dated outside the range", async () => {
    const current = await makeAccount("Current");
    const isa = await makeAccount("ISA");
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: current.id,
        transferAccountId: isa.id,
        date: new Date("2026-02-15"),
        amount: -200,
        description: "Feb move",
      },
    });

    const rows = await getTransfersByAccount(
      TEST_USER_ID,
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    );
    expect(rows).toEqual([]);
  });
});

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
