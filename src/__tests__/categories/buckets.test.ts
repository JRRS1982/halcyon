import { sectionOrderIndex } from "@/lib/categories/buckets";

describe("sectionOrderIndex", () => {
  test("orders expense sections Fixed → Variable → Discretionary first", () => {
    expect(sectionOrderIndex("FIXED")).toBe(0);
    expect(sectionOrderIndex("VARIABLE")).toBe(1);
    expect(sectionOrderIndex("DISCRETIONARY")).toBe(2);
  });

  test("places income sections after expenses and OTHER near the end", () => {
    expect(sectionOrderIndex("SALARY")).toBeGreaterThan(
      sectionOrderIndex("DISCRETIONARY"),
    );
    expect(sectionOrderIndex("OTHER")).toBeGreaterThan(
      sectionOrderIndex("SALARY"),
    );
  });

  test("sorts unsectioned (null) and unknown buckets last", () => {
    const last = sectionOrderIndex("OTHER");
    expect(sectionOrderIndex(null)).toBeGreaterThan(last);
    expect(sectionOrderIndex(undefined)).toBeGreaterThan(last);
    expect(sectionOrderIndex("NONSENSE")).toBeGreaterThan(last);
  });
});
