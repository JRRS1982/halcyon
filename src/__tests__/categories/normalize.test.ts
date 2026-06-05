import {
  categoryKey,
  cleanLabel,
  dedupeLabels,
} from "@/lib/categories/normalize";

describe("categoryKey", () => {
  test("lowercases and trims surrounding whitespace", () => {
    expect(categoryKey("  Groceries ")).toBe("groceries");
    expect(categoryKey("GROCERIES")).toBe("groceries");
  });

  test("collapses internal whitespace runs", () => {
    expect(categoryKey("Car   Insurance")).toBe("car insurance");
    expect(categoryKey("Car Insurance")).toBe("car insurance");
  });
});

describe("cleanLabel", () => {
  test("trims and collapses whitespace but preserves case", () => {
    expect(cleanLabel("  Car   Insurance ")).toBe("Car Insurance");
  });
});

describe("dedupeLabels", () => {
  test("groups case/whitespace variants under one key", () => {
    const groups = dedupeLabels(["Groceries", "groceries ", "GROCERIES"]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "groceries", count: 3 });
  });

  test("keeps genuinely different labels separate", () => {
    const groups = dedupeLabels(["Car Insurance", "Health Insurance"]);
    expect(groups.map((g) => g.key)).toEqual([
      "car insurance",
      "health insurance",
    ]);
  });

  test("canonical label is the most frequent cleaned form", () => {
    const groups = dedupeLabels(["Groceries", "groceries", "groceries"]);
    expect(groups[0]?.label).toBe("groceries");
  });

  test("ties on frequency fall back to first appearance", () => {
    const groups = dedupeLabels(["Groceries", "groceries"]);
    expect(groups[0]?.label).toBe("Groceries");
  });

  test("preserves first-appearance order of distinct keys", () => {
    const groups = dedupeLabels(["Rent", "Food", "rent"]);
    expect(groups.map((g) => g.key)).toEqual(["rent", "food"]);
  });
});
