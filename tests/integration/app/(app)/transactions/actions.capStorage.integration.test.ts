import { TEST_USER_ID } from "@test/support/helpers";
import {
  bulkDeleteTransactions,
  commitImport,
} from "@/app/(app)/transactions/actions";
import { prisma } from "@/lib/prisma";

// MAX_TRANSACTIONS_PER_USER exists to bound how large the shared Transaction
// table can get — its own comment says so. It counted live rows, and both
// delete paths are soft, so commit → reverse → repeat wrote permanently while
// the count returned to where it started.
//
// Unlike the budget and balance copy paths, these tombstones are not dead:
// the data export reads transactions with no deletedAt filter, so they are
// still the user's data and hard deleting them would change what an export
// contains. The cap counts them instead.
const mapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
  dateFormat: "YMD" as const,
  hasHeader: false,
};

const rowsFrom = (n: number) =>
  Array.from({ length: n }, (_, i) => [
    `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    `Row ${i}`,
    `-${i + 1}`,
  ]);

describe("transaction storage cap (integration)", () => {
  it("counts soft-deleted rows, so deleting does not free capacity", async () => {
    const { accountName } = await commitImport({
      accountId: null,
      newAccountName: "Current",
      rows: rowsFrom(3),
      mapping,
      skipIndexes: [],
    });
    expect(accountName).toBe("Current");

    const live = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID, deletedAt: null },
      select: { id: true },
    });
    await bulkDeleteTransactions({ transactionIds: live.map((t) => t.id) });

    // What the user sees is empty; what the table holds is not. The cap has to
    // read the second number, because that is the one it exists to bound.
    expect(
      await prisma.transaction.count({
        where: { userId: TEST_USER_ID, deletedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.transaction.count({ where: { userId: TEST_USER_ID } }),
    ).toBe(3);

    const { countedByCap } = await import("@/lib/transactions/limits");
    expect(await countedByCap(prisma.transaction, TEST_USER_ID)).toBe(3);
  });
});
