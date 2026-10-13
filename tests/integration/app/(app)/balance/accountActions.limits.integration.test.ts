import { TEST_USER_ID } from "@test/support/helpers";
import { createAccount } from "@/app/(app)/balance/accountActions";
import { MAX_ACCOUNTS_PER_USER } from "@/lib/accounts/limits";
import { prisma } from "@/lib/prisma";

const savingsInput = {
  year: 2026,
  month: 2,
  name: "One more",
  type: "SAVINGS" as const,
  section: "OTHER" as const,
  value: 100,
  canImportTransactions: false,
  terms: {},
  mortgage: null,
};

// Seeded straight through Prisma rather than through createAccount: the cap is
// what we are testing, and five hundred round trips through the action would
// make the test slower than the suite it lives in.
async function seedAccounts(count: number, deletedAt: Date | null = null) {
  await prisma.account.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId: TEST_USER_ID,
      name: `Seeded ${i}`,
      type: "SAVINGS" as const,
      section: "OTHER" as const,
      deletedAt,
    })),
  });
}

describe("account cap (integration)", () => {
  it("refuses to create an account once the user is at the ceiling", async () => {
    await seedAccounts(MAX_ACCOUNTS_PER_USER);

    await expect(createAccount(savingsInput)).rejects.toThrow(
      `maximum of ${MAX_ACCOUNTS_PER_USER} accounts`,
    );

    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(MAX_ACCOUNTS_PER_USER);
  });

  // The cap counts what the user still has, not what they have ever had —
  // otherwise archiving an account would permanently consume one of their
  // slots and a long-lived account would lock the sheet.
  it("does not count archived accounts toward the ceiling", async () => {
    await seedAccounts(MAX_ACCOUNTS_PER_USER, new Date());

    const { accountId } = await createAccount(savingsInput);

    expect(accountId).toBeTruthy();
  });
});
