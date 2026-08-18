import {
  createBalanceItemForMonth,
  setBalanceItemSection,
  updateBalanceItem,
} from "@/app/(app)/balance/actions";

// Prisma `Decimal` can't cross the server→client boundary — Next serialises it
// to `{}` and logs "Only plain objects can be passed to Client Components".
// The budget actions coerce through toClientItem; these pin the same guarantee
// for every balance action that hands a mutated row back to the client.

describe("balance actions return client-safe rows (integration)", () => {
  test("create, update and section-move return value as a plain number", async () => {
    const { item } = await createBalanceItemForMonth({
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
