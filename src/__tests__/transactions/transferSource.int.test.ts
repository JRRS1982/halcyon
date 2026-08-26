import { prisma } from "@/lib/prisma";
import { getTransferFlowByAccount } from "@/lib/transactions/server";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const makeAccount = (name: string) =>
  prisma.account.create({ data: { userId: TEST_USER_ID, name } });

const MARCH_START = new Date("2026-03-01");
const MARCH_END = new Date("2026-03-31");

describe("getTransferFlowByAccount (integration)", () => {
  test("nets an unimported account from the leg pointing at it", async () => {
    // The common case: only the current account's statement is imported, so
    // the pension owns no transaction of its own.
    const current = await makeAccount("Current");
    const pension = await makeAccount("Pension");

    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: current.id,
        transferAccountId: pension.id,
        date: new Date("2026-03-10"),
        amount: -500,
        description: "To pension",
      },
    });

    const flow = await getTransferFlowByAccount(
      TEST_USER_ID,
      MARCH_START,
      MARCH_END,
    );
    expect(flow.get(pension.id)).toBe(500);
    expect(flow.get(current.id)).toBe(-500);
  });

  test("an account owning a leg and pointed at by another counts one movement", async () => {
    // Both statements imported: the pension's own leg is the source, and the
    // current account's leg aimed at it must not be added on top.
    const current = await makeAccount("Current");
    const pension = await makeAccount("Pension");

    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: pension.id,
          date: new Date("2026-03-10"),
          amount: -500,
          description: "To pension",
        },
        {
          userId: TEST_USER_ID,
          accountId: pension.id,
          transferAccountId: current.id,
          date: new Date("2026-03-10"),
          amount: 500,
          description: "From current",
        },
      ],
    });

    const flow = await getTransferFlowByAccount(
      TEST_USER_ID,
      MARCH_START,
      MARCH_END,
    );
    expect(flow.get(pension.id)).toBe(500);
    expect(flow.get(current.id)).toBe(-500);
  });

  test("ignores untagged, deleted, out-of-range and other users' rows", async () => {
    const current = await makeAccount("Current");
    const pension = await makeAccount("Pension");

    const other = await prisma.user.create({
      data: { id: "00000000-0000-0000-0000-0000000000bb" },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: other.id, name: "Their Current" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: pension.id,
          date: new Date("2026-03-10"),
          amount: -500,
          description: "To pension",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: pension.id,
          date: new Date("2026-02-10"),
          amount: -900,
          description: "Last month",
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          transferAccountId: pension.id,
          date: new Date("2026-03-12"),
          amount: -700,
          description: "Deleted",
          deletedAt: new Date("2026-03-13"),
        },
        {
          userId: TEST_USER_ID,
          accountId: current.id,
          date: new Date("2026-03-14"),
          amount: -40,
          description: "Coffee (not a transfer)",
        },
        {
          userId: other.id,
          accountId: otherAccount.id,
          transferAccountId: otherAccount.id,
          date: new Date("2026-03-10"),
          amount: -1000,
          description: "Someone else's transfer",
        },
      ],
    });

    const flow = await getTransferFlowByAccount(
      TEST_USER_ID,
      MARCH_START,
      MARCH_END,
    );
    expect(flow.get(current.id)).toBe(-500);
    expect(flow.get(pension.id)).toBe(500);
    expect(flow.has(otherAccount.id)).toBe(false);
  });
});
