const mockDeleteUser = jest.fn(async () => ({ data: {}, error: null }));
const mockSignInWithPassword = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const mockSignInWithOtp = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const mockVerifyOtp = jest.fn(
  async (_args: unknown): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
// Mutable so a case can present a Google-only account, or one with no address.
let mockIdentities: { provider: string }[] = [{ provider: "email" }];
let mockUserEmail: string | null = "test@example.com";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser: mockDeleteUser } },
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "00000000-0000-0000-0000-0000000000aa",
            email: mockUserEmail,
            identities: mockIdentities,
          },
        },
      }),
      signInWithPassword: (args: unknown) => mockSignInWithPassword(args),
      signInWithOtp: (args: unknown) => mockSignInWithOtp(args),
      verifyOtp: (args: unknown) => mockVerifyOtp(args),
      signOut: async () => ({ error: null }),
    },
  }),
}));

// The real module is used everywhere else; this seam lets one case drive the
// limiter to "limited" without a Redis.
const mockCheckRateLimit = jest.fn(async (): Promise<string> => "allowed");
jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: () => mockCheckRateLimit(),
}));

import { TEST_USER_ID } from "@test/support/helpers";
import {
  clearMyData,
  deleteMyAccount,
  exportMyData,
  resetToDefaults,
  sendReauthCode,
} from "@/app/(app)/settings/dataActions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

// A second user, to prove every action is scoped by userId.
const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

async function seedFinancialData(userId: string) {
  const account = await prisma.account.create({
    data: {
      userId,
      name: "Current",
      ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
    },
  });
  const category = await prisma.category.create({
    data: { userId, type: "EXPENSE", section: "VARIABLE", label: "Food" },
  });
  const period = await prisma.financialPeriod.create({
    data: {
      userId,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      label: "Mar 2026",
    },
  });
  await prisma.budgetItem.create({
    data: {
      periodId: period.id,
      type: "EXPENSE",
      section: "FIXED",
      label: "Rent",
      budget: 1000,
    },
  });
  await prisma.balanceItem.create({
    data: {
      periodId: period.id,
      accountId: account.id,
      value: 500,
    },
  });
  const batch = await prisma.importBatch.create({
    data: { userId, accountId: account.id, fileName: "statement.csv" },
  });
  await prisma.transaction.create({
    data: {
      userId,
      accountId: account.id,
      categoryId: category.id,
      importBatchId: batch.id,
      date: new Date("2026-03-02"),
      amount: -25.5,
      description: "Groceries",
    },
  });
  await prisma.plan.create({
    data: {
      userId,
      dateOfBirth: new Date("1990-01-01"),
      retirementAge: 65,
      assets: { create: { label: "ISA", openingValue: 10_000 } },
      liabilities: { create: { label: "Mortgage", openingBalance: 100_000 } },
      incomes: { create: { label: "Salary", kind: "SALARY" } },
      expenses: { create: { label: "Living costs", annualAmount: 12_000 } },
      events: {
        create: { label: "Inheritance", age: 50, direction: "INFLOW" },
      },
    },
  });
  await prisma.sentMessage.create({
    data: {
      userId,
      sentAt: new Date("2026-09-08T09:00:00.000Z"),
      type: "MONTHLY_REMINDER",
      channel: "EMAIL",
      subject: "August 2026 is ready to log",
      result: "SENT",
    },
  });
}

// The mocked account is mutable so a case can present a Google-only user or
// one with no address; reset before every test so no case leaks into the next.
beforeEach(() => {
  mockIdentities = [{ provider: "email" }];
  mockUserEmail = "test@example.com";
  mockCheckRateLimit.mockResolvedValue("allowed");
  mockSignInWithPassword.mockClear();
  mockSignInWithOtp.mockClear();
  mockVerifyOtp.mockClear();
});

describe("exportMyData (integration)", () => {
  test("includes every user-owned table, scoped to the caller", async () => {
    await seedFinancialData(TEST_USER_ID);
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    await seedFinancialData(OTHER_USER_ID);

    const dump = JSON.parse(await exportMyData());

    expect(dump.user.id).toBe(TEST_USER_ID);
    expect(dump.accounts).toHaveLength(1);
    expect(dump.categories).toHaveLength(1);
    expect(dump.periods).toHaveLength(1);
    expect(dump.budgetItems).toHaveLength(1);
    expect(dump.balanceItems).toHaveLength(1);
    expect(dump.transactions).toHaveLength(1);
    expect(dump.transactions[0].amount).toBe("-25.5");
    expect(dump.importBatches).toHaveLength(1);
    expect(dump.importBatches[0].fileName).toBe("statement.csv");
    expect(dump.plans).toHaveLength(1);
    expect(dump.plans[0].assets).toHaveLength(1);
    expect(dump.plans[0].liabilities).toHaveLength(1);
    expect(dump.plans[0].incomes).toHaveLength(1);
    expect(dump.plans[0].expenses).toHaveLength(1);
    expect(dump.plans[0].events).toHaveLength(1);
    expect(dump.sentMessages).toHaveLength(1);
    expect(dump.sentMessages[0]).toMatchObject({
      userId: TEST_USER_ID,
      type: "MONTHLY_REMINDER",
      channel: "EMAIL",
      subject: "August 2026 is ready to log",
      result: "SENT",
    });
    expect(
      dump.accounts.every((a: { userId: string }) => a.userId === TEST_USER_ID),
    ).toBe(true);
  });
});

describe("clearMyData (integration)", () => {
  test("removes financial rows but keeps User, settings, and categories", async () => {
    await seedFinancialData(TEST_USER_ID);
    // seedUser() (global beforeEach) already created UserSettings for TEST_USER_ID.

    await clearMyData({ method: "password", password: "test-password" });

    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.financialPeriod.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.budgetItem.count({
        where: { period: { userId: TEST_USER_ID } },
      }),
    ).toBe(0);
    expect(
      await prisma.balanceItem.count({
        where: { period: { userId: TEST_USER_ID } },
      }),
    ).toBe(0);
    expect(
      await prisma.importBatch.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(await prisma.plan.count({ where: { userId: TEST_USER_ID } })).toBe(
      0,
    );
    expect(
      await prisma.planAsset.count({
        where: { plan: { userId: TEST_USER_ID } },
      }),
    ).toBe(0);

    // Kept:
    expect(
      await prisma.user.findUnique({ where: { id: TEST_USER_ID } }),
    ).not.toBeNull();
    expect(
      await prisma.userSettings.findUnique({ where: { userId: TEST_USER_ID } }),
    ).not.toBeNull();
    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
    // SentMessage is communications history, not financial data — clearMyData
    // deliberately leaves it in place. Only deleteMyAccount removes it.
    expect(
      await prisma.sentMessage.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });

  test("does not touch another user's data", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    await seedFinancialData(OTHER_USER_ID);

    await clearMyData({ method: "password", password: "test-password" });

    expect(
      await prisma.transaction.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(
      await prisma.account.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(await prisma.plan.count({ where: { userId: OTHER_USER_ID } })).toBe(
      1,
    );
  });
});

describe("deleteMyAccount (integration)", () => {
  beforeEach(() => mockDeleteUser.mockClear());

  test("hard-deletes all rows, calls auth admin deleteUser, then redirects", async () => {
    await seedFinancialData(TEST_USER_ID);

    // redirect("/") is mocked to throw `redirect:/`.
    await expect(deleteMyAccount({ method: "password", password: "test-password" })).rejects.toThrow(
      "redirect:/",
    );

    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(TEST_USER_ID);

    expect(
      await prisma.user.findUnique({ where: { id: TEST_USER_ID } }),
    ).toBeNull();
    expect(
      await prisma.userSettings.findUnique({ where: { userId: TEST_USER_ID } }),
    ).toBeNull();
    expect(
      await prisma.category.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(
      await prisma.importBatch.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
    expect(await prisma.plan.count({ where: { userId: TEST_USER_ID } })).toBe(
      0,
    );
    expect(
      await prisma.sentMessage.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(0);
  });

  test("does not touch another user's rows", async () => {
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    await seedFinancialData(OTHER_USER_ID);

    await expect(deleteMyAccount({ method: "password", password: "test-password" })).rejects.toThrow(
      "redirect:/",
    );

    expect(
      await prisma.user.findUnique({ where: { id: OTHER_USER_ID } }),
    ).not.toBeNull();
    expect(
      await prisma.transaction.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(
      await prisma.category.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
    expect(
      await prisma.account.count({ where: { userId: OTHER_USER_ID } }),
    ).toBe(1);
  });
});

describe("verifyUser (integration)", () => {
  test("checks a password for an account that has one", async () => {
    await clearMyData({ method: "password", password: "hunter2" });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "hunter2",
    });
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  test("checks an emailed code for an account with no password", async () => {
    mockIdentities = [{ provider: "google" }];

    await clearMyData({ method: "otp", code: "123456" });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      token: "123456",
      type: "email",
    });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  test("reports a wrong code distinctly from a wrong password", async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: "expired" } });

    await expect(
      clearMyData({ method: "otp", code: "000000" }),
    ).rejects.toThrow("That code is not valid");
  });

  test("sends the code to the address on the account", async () => {
    await sendReauthCode();

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      options: { shouldCreateUser: false },
    });
  });

  // Review Focus 4: a user who mistypes twice must be told why no further code
  // arrives, not left staring at a panel that silently stops working.
  test("explains when too many codes have been requested", async () => {
    mockCheckRateLimit.mockResolvedValue("limited");

    await expect(sendReauthCode()).rejects.toThrow(
      "Too many codes requested. Please try again later.",
    );
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  // Review Focus 5: an account with no address can neither be mailed a code
  // nor matched to a password, so it must redirect rather than throw.
  test("redirects an account with no email to sign-in", async () => {
    mockUserEmail = null;

    await expect(
      clearMyData({ method: "otp", code: "123456" }),
    ).rejects.toThrow(/redirect:\/sign-in/);
  });
});

describe("verifyUser — wrong password rejection (integration)", () => {
  beforeEach(() => {
    mockDeleteUser.mockClear();
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
  });

  afterEach(() => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  test("clearMyData throws and leaves all rows intact", async () => {
    await seedFinancialData(TEST_USER_ID);
    const countBefore = await prisma.transaction.count({
      where: { userId: TEST_USER_ID },
    });

    await expect(clearMyData({ method: "password", password: "wrong-password" })).rejects.toThrow(
      "Incorrect password",
    );

    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(countBefore);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });

  test("deleteMyAccount throws and leaves user rows intact", async () => {
    await seedFinancialData(TEST_USER_ID);

    await expect(deleteMyAccount({ method: "password", password: "wrong-password" })).rejects.toThrow(
      "Incorrect password",
    );

    expect(
      await prisma.user.findUnique({ where: { id: TEST_USER_ID } }),
    ).not.toBeNull();
    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("resetToDefaults throws and leaves data unchanged", async () => {
    await seedFinancialData(TEST_USER_ID);

    await expect(resetToDefaults({ method: "password", password: "wrong-password" })).rejects.toThrow(
      "Incorrect password",
    );

    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
    expect(
      await prisma.account.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(1);
  });
});
