import { commitImport, setTransactionNote } from "@/app/transactions/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

const seedTxn = async (userId = TEST_USER_ID) => {
  const account = await prisma.account.create({
    data: { userId, name: "Cur" },
  });
  return prisma.transaction.create({
    data: {
      userId,
      accountId: account.id,
      date: new Date("2026-03-01"),
      amount: -5,
      description: "Tesco",
    },
  });
};

describe("setTransactionNote (integration)", () => {
  test("sets and then clears a note", async () => {
    const tx = await seedTxn();

    await setTransactionNote({ transactionId: tx.id, note: "Weekly shop" });
    let row = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(row?.note).toBe("Weekly shop");

    await setTransactionNote({ transactionId: tx.id, note: "" });
    row = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(row?.note).toBeNull();
  });

  test("cannot annotate another user's transaction", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirs = await seedTxn(OTHER_USER_ID);

    await expect(
      setTransactionNote({ transactionId: theirs.id, note: "nope" }),
    ).rejects.toThrow("Transaction not found");
  });
});

describe("commitImport extra columns (integration)", () => {
  test("stores kept columns as JSON keyed by header label", async () => {
    await commitImport({
      accountId: null,
      newAccountName: "Current",
      rows: [
        ["date", "desc", "amount", "Type", "Reference"],
        ["2026-03-01", "Tesco", "-10", "DD", "000123"],
        ["2026-03-02", "Shell", "-50", "", ""],
      ],
      mapping: {
        dateColumn: 0,
        descriptionColumn: 1,
        amountColumn: 2,
        dateFormat: "YMD",
        hasHeader: true,
        extraColumns: [3, 4],
      },
      skipIndexes: [],
    });

    const rows = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { date: "asc" },
    });
    expect(rows[0]?.extra).toEqual({ Type: "DD", Reference: "000123" });
    expect(rows[1]?.extra).toBeNull();
  });
});
