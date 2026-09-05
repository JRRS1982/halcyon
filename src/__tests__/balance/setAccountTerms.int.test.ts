import { setAccountTerms } from "@/app/(app)/balance/accountActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import {
  resetDb,
  seedUser,
  TEST_USER_ID,
} from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

describe("setAccountTerms", () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser();
  });

  it("creates the terms row on first write and updates it on the second", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Vanguard ISA",
        ...buildAccountData({ type: "STOCKS_ISA" }),
      },
    });

    await setAccountTerms({
      accountId: account.id,
      terms: { expectedReturnPct: 5, feePct: 0.22 },
    });

    let terms = await prisma.accountTerms.findUnique({
      where: { accountId: account.id },
    });
    expect(Number(terms?.expectedReturnPct)).toBe(5);

    await setAccountTerms({
      accountId: account.id,
      terms: { expectedReturnPct: 4, feePct: 0.22 },
    });

    terms = await prisma.accountTerms.findUnique({
      where: { accountId: account.id },
    });
    expect(Number(terms?.expectedReturnPct)).toBe(4);
    // The second write is an update, not a second row.
    expect(await prisma.accountTerms.count()).toBe(1);
  });

  it("clears a parameter when it is sent as null", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "SIPP",
        ...buildAccountData({ type: "SIPP" }),
      },
    });
    await setAccountTerms({
      accountId: account.id,
      terms: { minAccessAge: 57 },
    });

    await setAccountTerms({
      accountId: account.id,
      terms: { minAccessAge: null },
    });

    const terms = await prisma.accountTerms.findUnique({
      where: { accountId: account.id },
    });
    // Null means "take the default", which is a legitimate answer — not a
    // no-op the writer should skip.
    expect(terms?.minAccessAge).toBeNull();
  });

  it("refuses an account belonging to another user", async () => {
    // The session is always TEST_USER_ID (mocked in test/integration/setup.ts),
    // so the other user is the row's owner rather than the caller. Per ADR-002
    // the server Prisma role bypasses RLS, making this filter the only fence.
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const theirs = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: "Their ISA",
        ...buildAccountData({ type: "STOCKS_ISA" }),
      },
    });

    await expect(
      setAccountTerms({
        accountId: theirs.id,
        terms: { expectedReturnPct: 99 },
      }),
    ).rejects.toThrow();
    expect(await prisma.accountTerms.count()).toBe(0);
  });

  it("rejects a rate outside the column's precision", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Mortgage",
        ...buildAccountData({ type: "MORTGAGE" }),
      },
    });

    await expect(
      setAccountTerms({ accountId: account.id, terms: { interestPct: 1000 } }),
    ).rejects.toThrow();
  });
});
