import { type CopyableItem, buildCopiedItems } from "@/lib/budget/copyPeriod";

// Deterministic id generator so assertions can name the new ids.
const seqIds = () => {
  let n = 0;
  return () => `new-${++n}`;
};

const src = (
  id: string,
  overrides: Partial<CopyableItem> = {},
): CopyableItem => ({
  id,
  type: "EXPENSE",
  category: "FIXED",
  incomeCategory: null,
  categoryId: null,
  label: id,
  budget: 100,
  sortOrder: 0,
  ...overrides,
});

describe("buildCopiedItems", () => {
  test("gives every item a fresh id and keeps the count", () => {
    const copied = buildCopiedItems([src("a"), src("b")], seqIds());
    expect(copied).toHaveLength(2);
    expect(copied.map((i) => i.id)).toEqual(["new-1", "new-2"]);
    expect(copied.some((i) => i.id === "a" || i.id === "b")).toBe(false);
  });

  test("resets actuals to 0 but carries budgets over", () => {
    const copied = buildCopiedItems([src("a", { budget: 250 })], seqIds());
    expect(copied[0]?.budget).toBe(250);
    expect(copied[0]?.actual).toBe(0);
  });

  test("carries categoryId so transaction actuals stay attached", () => {
    const copied = buildCopiedItems(
      [src("linked", { categoryId: "cat-1" }), src("unlinked")],
      seqIds(),
    );
    expect(copied[0]?.categoryId).toBe("cat-1");
    expect(copied[1]?.categoryId).toBeNull();
  });

  test("keeps type, category, incomeCategory, label and sortOrder", () => {
    const copied = buildCopiedItems(
      [
        src("income", {
          type: "INCOME",
          category: null,
          incomeCategory: "SALARY",
          sortOrder: 3,
        }),
        src("rent", { category: "VARIABLE", sortOrder: 7 }),
      ],
      seqIds(),
    );
    expect(copied[0]).toMatchObject({
      type: "INCOME",
      category: null,
      incomeCategory: "SALARY",
      label: "income",
      sortOrder: 3,
    });
    expect(copied[1]).toMatchObject({
      type: "EXPENSE",
      category: "VARIABLE",
      incomeCategory: null,
      label: "rent",
      sortOrder: 7,
    });
  });
});
