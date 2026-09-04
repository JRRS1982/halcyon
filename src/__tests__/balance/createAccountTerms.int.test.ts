import { createAccount } from "@/app/(app)/balance/accountActions";
import { prisma } from "@/lib/prisma";
import {
  resetDb,
  seedUser,
  TEST_USER_ID,
} from "../../../test/integration/helpers";

describe("createAccount with terms", () => {
  beforeEach(async () => {
    await resetDb();
    await seedUser();
  });

  it("writes the terms alongside the account and its first value", async () => {
    await createAccount({
      year: 2026,
      month: 8,
      name: "Vanguard ISA",
      type: "STOCKS_ISA",
      section: "LONG_TERM",
      value: 24500,
      canImportTransactions: true,
      terms: { expectedReturnPct: 5, feePct: 0.22 },
      mortgage: null,
    });

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: TEST_USER_ID },
      include: { terms: true },
    });
    expect(Number(account.terms?.expectedReturnPct)).toBe(5);
    expect(Number(account.terms?.feePct)).toBe(0.22);
  });

  it("creates no terms row when the drawer's advanced section was skipped", async () => {
    await createAccount({
      year: 2026,
      month: 8,
      name: "Halifax current",
      type: "CURRENT_ACCOUNT",
      section: "CURRENT",
      value: 2100,
      canImportTransactions: true,
      terms: {},
      mortgage: null,
    });

    // No row rather than a row of nulls: the account has answered nothing, and
    // every reader already treats a missing parameter as "take the default".
    expect(await prisma.accountTerms.count()).toBe(0);
  });

  it("gives a property's mortgage its own terms, not the property's", async () => {
    await createAccount({
      year: 2026,
      month: 8,
      name: "Home",
      type: "PROPERTY",
      section: "PROPERTY",
      value: 420000,
      canImportTransactions: false,
      terms: { expectedReturnPct: 3 },
      mortgage: {
        name: "Barclays mortgage",
        value: 212000,
        canImportTransactions: false,
        terms: { interestPct: 4.29, endDate: new Date("2049-06-01") },
      },
    });

    const property = await prisma.account.findFirstOrThrow({
      where: { userId: TEST_USER_ID, type: "PROPERTY" },
      include: { terms: true },
    });
    const mortgage = await prisma.account.findFirstOrThrow({
      where: { userId: TEST_USER_ID, type: "MORTGAGE" },
      include: { terms: true },
    });

    expect(Number(property.terms?.expectedReturnPct)).toBe(3);
    expect(property.terms?.interestPct).toBeNull();
    expect(Number(mortgage.terms?.interestPct)).toBe(4.29);
    expect(mortgage.terms?.expectedReturnPct).toBeNull();
  });
});
