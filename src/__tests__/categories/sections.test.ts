import {
  EXPENSE_SECTIONS,
  INCOME_SECTIONS,
  isExpenseSection,
  sectionFor,
  sectionLabel,
  sectionOrderIndex,
  sectionsFor,
} from "@/lib/categories/sections";

describe("category sections", () => {
  it("keeps the two value sets disjoint", () => {
    const expense = EXPENSE_SECTIONS.map((s) => s.value);
    const income = INCOME_SECTIONS.map((s) => s.value);
    expect(expense.filter((v) => (income as string[]).includes(v))).toEqual([]);
  });

  it("picks the table for a type", () => {
    expect(sectionsFor("EXPENSE")).toBe(EXPENSE_SECTIONS);
    expect(sectionsFor("INCOME")).toBe(INCOME_SECTIONS);
  });

  it("accepts a section that belongs to the type", () => {
    expect(sectionFor("EXPENSE", "FIXED")).toBe("FIXED");
    expect(sectionFor("INCOME", "SALARY")).toBe("SALARY");
  });

  it("refuses an income section on an expense, loudly", () => {
    expect(() => sectionFor("EXPENSE", "SALARY")).toThrow(
      "SALARY is not an EXPENSE section",
    );
    expect(() => sectionFor("INCOME", "FIXED")).toThrow(
      "FIXED is not an INCOME section",
    );
  });

  it("labels and orders every section", () => {
    expect(sectionLabel("SIDE_INCOME")).toBe("Side income");
    expect(sectionOrderIndex("FIXED")).toBeLessThan(
      sectionOrderIndex("SALARY"),
    );
    expect(sectionOrderIndex("OTHER")).toBe(7);
  });

  // Pins every ordinal, not just one inequality — FIXED/VARIABLE/DISCRETIONARY
  // swapped would still pass "FIXED < SALARY" above. Every expense section
  // sorts before every income section, in each table's declared order.
  // sectionOrderIndex now takes CategorySection, not string | null | undefined,
  // so the old null/undefined/"NONSENSE" cases no longer typecheck — the type
  // itself rules them out, so there is nothing left to test there.
  it("pins the full display order", () => {
    const ALL = [...EXPENSE_SECTIONS, ...INCOME_SECTIONS].map((s) => s.value);
    expect(ALL.map(sectionOrderIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(sectionOrderIndex("DISCRETIONARY")).toBeLessThan(
      sectionOrderIndex("SALARY"),
    );
  });

  it("narrows to the expense subset", () => {
    expect(isExpenseSection("VARIABLE")).toBe(true);
    expect(isExpenseSection("PENSIONS")).toBe(false);
  });
});
