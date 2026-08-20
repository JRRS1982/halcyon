import {
  copyBalancePeriodFrom,
  createBalanceItemForMonth,
  updateBalanceItem,
} from "@/app/(app)/balance/actions";
import { prisma } from "@/lib/prisma";

// Copied balance values are last month's numbers, not this month's — until the
// user confirms each one it must stay visibly provisional. These pin the flag's
// whole lifecycle: set by copy, cleared by a value edit, untouched by other
// edits.

describe("balance carried-over flag (integration)", () => {
  const seedSourceMonth = async () => {
    const { item } = await createBalanceItemForMonth({
      year: 2026,
      month: 1,
      type: "ASSET",
      category: "CURRENT",
      label: "Savings",
    });
    await updateBalanceItem({ itemId: item.id, value: 5000 });
    const period = await prisma.balanceItem.findUniqueOrThrow({
      where: { id: item.id },
      select: { periodId: true },
    });
    return period.periodId;
  };

  test("a row created by hand is not carried over", async () => {
    const { item } = await createBalanceItemForMonth({
      year: 2026,
      month: 1,
      type: "ASSET",
      category: "CURRENT",
      label: "Savings",
    });
    const row = await prisma.balanceItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(row.carriedOver).toBe(false);
  });

  test("copying a month marks every clone carried over, in the DB and the returned rows", async () => {
    const sourcePeriodId = await seedSourceMonth();

    const result = await copyBalancePeriodFrom({
      sourcePeriodId,
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

  test("editing the value confirms the row; editing the label does not", async () => {
    const sourcePeriodId = await seedSourceMonth();
    const { items } = await copyBalancePeriodFrom({
      sourcePeriodId,
      targetYear: 2026,
      targetMonth: 2,
    });
    const cloneId = items[0]?.id ?? "";

    const afterLabel = await updateBalanceItem({
      itemId: cloneId,
      label: "Savings ISA",
    });
    expect(afterLabel.carriedOver).toBe(true);

    const afterValue = await updateBalanceItem({
      itemId: cloneId,
      value: 5100,
    });
    expect(afterValue.carriedOver).toBe(false);

    const row = await prisma.balanceItem.findUniqueOrThrow({
      where: { id: cloneId },
    });
    expect(row.carriedOver).toBe(false);
  });
});
