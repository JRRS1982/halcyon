import { bucketFields } from "@/lib/categories/buckets";
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  STARTER_BUDGET_CATEGORIES,
} from "@/lib/onboarding/defaults";

// The defaults are written straight into a new user's account, so a malformed
// entry isn't a rendering bug — it's a row in someone's database. These check
// the shape holds, not the specific labels, which are free to change.
describe("onboarding defaults", () => {
  it("gives every category a bucket its type can actually store", () => {
    for (const c of DEFAULT_CATEGORIES) {
      const fields = bucketFields(c.type, c.bucket);
      const stored =
        c.type === "EXPENSE" ? fields.category : fields.incomeCategory;
      expect(stored).toBe(c.bucket);
    }
  });

  it("leaves the other type's bucket column null", () => {
    for (const c of DEFAULT_CATEGORIES) {
      const fields = bucketFields(c.type, c.bucket);
      const unused =
        c.type === "EXPENSE" ? fields.incomeCategory : fields.category;
      expect(unused).toBeNull();
    }
  });

  it("has no duplicate category labels", () => {
    const labels = DEFAULT_CATEGORIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("has no duplicate account names", () => {
    expect(new Set(DEFAULT_ACCOUNTS).size).toBe(DEFAULT_ACCOUNTS.length);
  });

  it("covers both income and expenses, and every expense bucket", () => {
    const buckets = new Set(
      DEFAULT_CATEGORIES.filter((c) => c.type === "EXPENSE").map(
        (c) => c.bucket,
      ),
    );
    expect(buckets).toEqual(new Set(["FIXED", "VARIABLE", "DISCRETIONARY"]));
    expect(DEFAULT_CATEGORIES.some((c) => c.type === "INCOME")).toBe(true);
  });

  it("draws the starter budget from the category list, income and expenses both", () => {
    const labels = new Set(DEFAULT_CATEGORIES.map((c) => c.label));
    for (const s of STARTER_BUDGET_CATEGORIES) {
      expect(labels.has(s.label)).toBe(true);
    }
    expect(STARTER_BUDGET_CATEGORIES.some((c) => c.type === "INCOME")).toBe(
      true,
    );
    expect(STARTER_BUDGET_CATEGORIES.some((c) => c.type === "EXPENSE")).toBe(
      true,
    );
  });

  // The whole point of the subset: a sheet you fill in, not one you scroll.
  it("keeps the starter budget a strict subset of the taxonomy", () => {
    expect(STARTER_BUDGET_CATEGORIES.length).toBeLessThan(
      DEFAULT_CATEGORIES.length,
    );
    expect(STARTER_BUDGET_CATEGORIES.length).toBeGreaterThan(0);
  });

  // Money moved into an ISA/SIPP is a transfer between the user's own accounts,
  // and transfers now ship on by default. A savings *expense* category would
  // invite filing the same money twice.
  it("has no savings or investment expense category", () => {
    const expenseLabels = DEFAULT_CATEGORIES.filter(
      (c) => c.type === "EXPENSE",
    ).map((c) => c.label.toLowerCase());
    for (const label of expenseLabels) {
      expect(label).not.toMatch(/savings|investment|pension|isa|sipp/);
    }
  });
});
