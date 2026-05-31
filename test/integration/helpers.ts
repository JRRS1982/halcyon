import { prisma } from "@/lib/prisma";

// Must match the id returned by the mocked Supabase client in setup.ts.
export const TEST_USER_ID = "00000000-0000-0000-0000-0000000000aa";

// Wipes all user-owned data between tests. Truncating User cascades to the
// rest; listed explicitly for clarity.
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Transaction", "FinancialItem", "BalanceItem", "Category", "Account", "FinancialPeriod", "UserSettings", "User" RESTART IDENTITY CASCADE',
  );
}

// Seeds the signed-in test user + settings. transactionsEnabled defaults true
// so the transactions actions' gate passes.
export async function seedUser(transactionsEnabled = true): Promise<void> {
  await prisma.user.create({ data: { id: TEST_USER_ID } });
  await prisma.userSettings.create({
    data: { userId: TEST_USER_ID, transactionsEnabled },
  });
}
