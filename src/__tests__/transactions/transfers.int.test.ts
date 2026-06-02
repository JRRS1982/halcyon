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
    expect(byName.Current.net).toBe(-500);
    expect(byName.ISA.net).toBe(500);
    expect(byName.Current.counterparties).toEqual([
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
