import { type BriefRow, monthBrief } from "@/lib/insights/monthBrief";

// Plain pounds, so expectations read as the sentence a user sees.
const fmt = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const row = (
  label: string,
  type: BriefRow["type"],
  budget: number,
  actual: number,
  history: BriefRow["history"] = [],
): BriefRow => ({ label, type, budget, actual, history });

const brief = (rows: BriefRow[]) =>
  monthBrief({ rows, monthLabel: "September 2026", fmt });

// The headline is the first thing on the budget page. If it is wrong, a user
// is told they overspent when they saved, or blamed on the wrong category.
describe("monthBrief headline", () => {
  test("names the categories that pushed spending past plan", () => {
    const { headline } = brief([
      row("Salary", "INCOME", 4000, 4000),
      row("Groceries", "EXPENSE", 420, 492),
      row("Meals Out", "EXPENSE", 120, 176),
      row("Fuel", "EXPENSE", 100, 90),
    ]);
    expect(headline).toBe(
      "Groceries and Meals Out pushed spending £118 past plan",
    );
  });

  test("names one category when only one ran over", () => {
    const { headline } = brief([
      row("Groceries", "EXPENSE", 420, 492),
      row("Fuel", "EXPENSE", 100, 100),
    ]);
    expect(headline).toBe("Groceries pushed spending £72 past plan");
  });

  test("says spending came in under plan, and what helped most", () => {
    const { headline } = brief([
      row("Utilities", "EXPENSE", 240, 190),
      row("Groceries", "EXPENSE", 420, 400),
    ]);
    expect(headline).toBe("Spending came in £70 under plan, led by Utilities");
  });

  test("reports spending plainly when nothing was budgeted", () => {
    const { headline } = brief([row("Groceries", "EXPENSE", 0, 310)]);
    expect(headline).toBe("You spent £310 in September 2026");
  });

  test("says so when the month has nothing in it yet", () => {
    const { headline } = brief([row("Groceries", "EXPENSE", 0, 0)]);
    expect(headline).toBe("Nothing recorded for September 2026 yet");
  });

  // Repayments are spending (the money left the account), and the sheet counts
  // them in Expenses; the headline must add up to the same figure.
  test("counts repayments in spending", () => {
    const { headline } = brief([
      row("Groceries", "EXPENSE", 400, 400),
      row("Credit card", "REPAYMENT", 200, 250),
    ]);
    expect(headline).toBe("Spending came in £50 over plan");
  });
});

describe("monthBrief standfirst", () => {
  test("states what is left over against what was planned", () => {
    const { standfirst } = brief([
      row("Salary", "INCOME", 4000, 4000),
      row("Groceries", "EXPENSE", 420, 492),
    ]);
    expect(standfirst).toBe(
      "That leaves £3,508 left over, £72 less than the £3,580 you planned.",
    );
  });

  test("skips the comparison when nothing was planned", () => {
    const { standfirst } = brief([
      row("Salary", "INCOME", 0, 2000),
      row("Groceries", "EXPENSE", 0, 500),
    ]);
    expect(standfirst).toBe("That leaves £1,500 left over.");
  });
});

// The notes are where a user learns why. Each is checked for the fact it states.
describe("monthBrief notes", () => {
  test("explains the biggest overspend against the category's own history", () => {
    const { notes } = brief([
      row("Groceries", "EXPENSE", 420, 492, [
        { label: "May 2026", actual: 510 },
        { label: "June 2026", actual: 430 },
        { label: "July 2026", actual: 440 },
        { label: "August 2026", actual: 450 },
      ]),
    ]);
    expect(notes[0]).toEqual({
      lead: "Where it ran over.",
      body: "Groceries ran £72 over budget, its highest month since May 2026.",
    });
  });

  test("calls a record month a record", () => {
    const { notes } = brief([
      row("Groceries", "EXPENSE", 420, 600, [
        { label: "July 2026", actual: 440 },
        { label: "August 2026", actual: 450 },
      ]),
    ]);
    expect(notes[0]?.body).toBe(
      "Groceries ran £180 over budget, its highest in the 3 months on record.",
    );
  });

  test("names what landed exactly on budget", () => {
    const { notes } = brief([
      row("Mortgage", "EXPENSE", 1250, 1250),
      row("Council Tax", "EXPENSE", 180, 180),
    ]);
    expect(notes).toContainEqual({
      lead: "What held.",
      body: "Mortgage and Council Tax landed exactly on budget.",
    });
  });

  test("says where most of the money went", () => {
    const { notes } = brief([
      row("Mortgage", "EXPENSE", 1250, 1250),
      row("Groceries", "EXPENSE", 500, 500),
      row("Fuel", "EXPENSE", 250, 250),
    ]);
    expect(notes).toContainEqual({
      lead: "Where it goes.",
      body: "Mortgage took 63% of everything you spent.",
    });
  });

  test("ignores rows that moved by pennies", () => {
    const { notes } = brief([row("Groceries", "EXPENSE", 420, 424)]);
    expect(notes.find((n) => n.lead === "Where it ran over.")).toBeUndefined();
  });

  test("never says more than three things", () => {
    const { notes } = brief([
      row("Mortgage", "EXPENSE", 1250, 1250),
      row("Groceries", "EXPENSE", 420, 492),
      row("Utilities", "EXPENSE", 240, 190),
    ]);
    expect(notes.length).toBeLessThanOrEqual(3);
  });
});
