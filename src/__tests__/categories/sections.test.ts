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

  it("narrows to the expense subset", () => {
    expect(isExpenseSection("VARIABLE")).toBe(true);
    expect(isExpenseSection("PENSIONS")).toBe(false);
  });
});
