import type { Prisma, PrismaClient } from "@prisma/client";

// Either the long-lived client or a transaction's. Callers that need the period
// and something else to succeed or fail together pass a transaction client.
export type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

export type MonthRange = {
  startDate: Date;
  endDate: Date;
  label: string;
};

/**
 * The user's FinancialPeriod for a month, created if it doesn't exist yet.
 *
 * Lives here rather than in budget/actions.ts because that file is "use server"
 * — every export in it becomes a server action, and a server action cannot take
 * a Prisma transaction client as an argument. Both the budget and balance
 * sheets need this inside a transaction: their "add row" buttons create the
 * period and the first row together, and a period with nothing in it is a month
 * that looks visited but is empty.
 */
export async function ensurePeriodForMonthIn(
  db: PrismaClientOrTransaction,
  userId: string,
  range: MonthRange,
) {
  const existing = await db.financialPeriod.findUnique({
    where: {
      userId_granularity_startDate: {
        userId,
        granularity: "MONTH",
        startDate: range.startDate,
      },
    },
  });
  if (existing) return existing;

  return db.financialPeriod.create({
    data: {
      userId,
      granularity: "MONTH",
      startDate: range.startDate,
      endDate: range.endDate,
      label: range.label,
    },
  });
}
