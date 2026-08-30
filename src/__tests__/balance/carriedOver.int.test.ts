import { createAccount } from "@/app/(app)/balance/accountActions";
import {
  copyBalancePeriodFrom,
  upsertBalanceValue,
} from "@/app/(app)/balance/actions";
import { prisma } from "@/lib/prisma";

// Copied balance values are last month's numbers, not this month's — until the
// user confirms each one it must stay visibly provisional. These pin the flag's
// whole lifecycle: set by copy, cleared by a value edit, untouched by a
// notes-only edit.

const seedFebruary = async () => {
  const { accountId, periodId } = await createAccount({
    year: 2026,
    month: 1,
    name: "Savings",
    type: "SAVINGS",
    section: "CURRENT",
    value: 5000,
    canImportTransactions: false,
    mortgage: null,
  });
  return { accountId, periodId };
};

describe("balance carried-over flag (integration)", () => {
  test("a value the user typed for the month is not carried over", async () => {
    const { accountId } = await seedFebruary();

    const row = await prisma.balanceItem.findFirstOrThrow({
      where: { accountId },
    });
    expect(row.carriedOver).toBe(false);
  });

  test("copying a month marks every clone carried over, in the DB and the returned rows", async () => {
    const { periodId } = await seedFebruary();

    const result = await copyBalancePeriodFrom({
      sourcePeriodId: periodId,
      targetYear: 2026,
      targetMonth: 2,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.carriedOver).toBe(true);

    const clone = await prisma.balanceItem.findUniqueOrThrow({
      where: { id: result.items[0]?.id ?? "" },
    });
    expect(clone.carriedOver).toBe(true);
    expect(Number(clone.value)).toBe(5000);
  });

  test("editing the value confirms the row; editing the notes does not", async () => {
    const { accountId, periodId } = await seedFebruary();
    const { items } = await copyBalancePeriodFrom({
      sourcePeriodId: periodId,
      targetYear: 2026,
      targetMonth: 2,
    });
    const cloneId = items[0]?.id ?? "";

    const afterNotes = await upsertBalanceValue({
      accountId,
      year: 2026,
      month: 2,
      notes: "Still to check",
    });
    expect(afterNotes.id).toBe(cloneId);
    expect(afterNotes.carriedOver).toBe(true);

    const afterValue = await upsertBalanceValue({
      accountId,
      year: 2026,
      month: 2,
      value: 5100,
    });
    expect(afterValue.carriedOver).toBe(false);

    const row = await prisma.balanceItem.findUniqueOrThrow({
      where: { id: cloneId },
    });
    expect(row.carriedOver).toBe(false);
    expect(Number(row.value)).toBe(5100);
  });
});
