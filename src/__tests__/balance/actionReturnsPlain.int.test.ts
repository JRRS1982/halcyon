import {
  setBalanceItemSection,
  updateBalanceItem,
} from "@/app/(app)/balance/actions";
import { ensurePeriodForMonth } from "@/app/(app)/budget/actions";
import { prisma } from "@/lib/prisma";

// Prisma `Decimal` can't cross the server→client boundary — Next serialises it
// to `{}` and logs "Only plain objects can be passed to Client Components".
// The budget actions coerce through toClientItem; these pin the same guarantee
// for every balance action that hands a mutated row back to the client.

// A fixture row created directly against the DB — standing in for the removed
// createBalanceItemForMonth (the app now only creates a non-legacy balance
// row through an Account via createAccountWithBalance). This test is about
// updateBalanceItem / setBalanceItemSection, not about how the fixture row
// got there.
async function seedBalanceItem(input: {
  year: number;
  month: number;
  type: "ASSET" | "LIABILITY";
  category: "CURRENT" | "MEDIUM_TERM" | "LONG_TERM" | "PROPERTY" | "OTHER";
  label: string;
}) {
  const period = await ensurePeriodForMonth(input.year, input.month);
  const item = await prisma.balanceItem.create({
    data: {
      periodId: period.id,
      type: input.type,
      category: input.category,
      label: input.label,
    },
  });
  return { item: { ...item, value: Number(item.value) } };
}

describe("balance actions return client-safe rows (integration)", () => {
  test("update and section-move return value as a plain number", async () => {
    const { item } = await seedBalanceItem({
      year: 2026,
      month: 2,
      type: "ASSET",
      category: "CURRENT",
      label: "Savings",
    });
    expect(typeof item.value).toBe("number");

    const updated = await updateBalanceItem({
      itemId: item.id,
      value: 1234.56,
    });
    expect(updated.value).toBe(1234.56);

    const moved = await setBalanceItemSection({
      itemId: item.id,
      type: "ASSET",
      category: "LONG_TERM",
    });
    expect(typeof moved.value).toBe("number");

    // The no-op path returns the row it looked up rather than an update result
    // — it must be coerced too.
    const unchanged = await setBalanceItemSection({
      itemId: item.id,
      type: "ASSET",
      category: "LONG_TERM",
    });
    expect(typeof unchanged.value).toBe("number");
  });
});
