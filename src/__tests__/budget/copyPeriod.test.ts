import { type CopyableItem, buildCopiedItems } from "@/lib/budget/copyPeriod";

// Deterministic id generator so assertions can name the new ids.
const seqIds = () => {
  let n = 0;
  return () => `new-${++n}`;
};

const src = (
  id: string,
  parentItemId: string | null,
  overrides: Partial<CopyableItem> = {},
): CopyableItem => ({
  id,
  type: "EXPENSE",
  parentItemId,
  category: parentItemId === null ? "FIXED" : null,
  incomeCategory: null,
  label: id,
  budget: 100,
  sortOrder: 0,
  ...overrides,
});

describe("buildCopiedItems", () => {
  test("gives every item a fresh id and keeps the count", () => {
    const copied = buildCopiedItems([src("a", null), src("b", null)], seqIds());
    expect(copied).toHaveLength(2);
    expect(copied.map((i) => i.id)).toEqual(["new-1", "new-2"]);
    expect(copied.some((i) => i.id === "a" || i.id === "b")).toBe(false);
  });

  test("resets actuals to 0 but carries budgets over", () => {
    const copied = buildCopiedItems(
      [src("a", null, { budget: 250 })],
      seqIds(),
    );
    expect(copied[0].budget).toBe(250);
    expect(copied[0].actual).toBe(0);
  });

  test("remaps parent references onto the new ids", () => {
    const copied = buildCopiedItems(
      [src("salary", null), src("his", "salary"), src("hers", "salary")],
      seqIds(),
    );
    const [salary, his, hers] = copied;
    expect(salary.parentItemId).toBeNull();
    expect(his.parentItemId).toBe(salary.id);
    expect(hers.parentItemId).toBe(salary.id);
  });

  test("preserves nesting across three levels", () => {
    const copied = buildCopiedItems(
      [src("root", null), src("mid", "root"), src("leaf", "mid")],
      seqIds(),
    );
    const byLabel = new Map(copied.map((i) => [i.label, i]));
    expect(byLabel.get("root")?.parentItemId).toBeNull();
    expect(byLabel.get("mid")?.parentItemId).toBe(byLabel.get("root")?.id);
    expect(byLabel.get("leaf")?.parentItemId).toBe(byLabel.get("mid")?.id);
  });

  test("keeps type, category, incomeCategory, label and sortOrder", () => {
    const copied = buildCopiedItems(
      [
        src("income", null, {
          type: "INCOME",
          category: null,
          incomeCategory: "SALARY",
          sortOrder: 3,
        }),
        src("rent", null, { category: "VARIABLE", sortOrder: 7 }),
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
