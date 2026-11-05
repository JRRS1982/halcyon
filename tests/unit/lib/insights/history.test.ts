import { historyByCategory } from "@/lib/insights/history";

const months = [
  { ym: "2026-07", label: "July 2026" },
  { ym: "2026-08", label: "August 2026" },
];

// Feeds "its highest month since …". If it is wrong, the brief tells a user a
// month was a record when it was not.
describe("historyByCategory", () => {
  test("sums each category's entries per month, oldest first", () => {
    expect(
      historyByCategory(
        [
          { categoryId: "groceries", ym: "2026-08", actual: 200 },
          { categoryId: "groceries", ym: "2026-08", actual: 50 },
          { categoryId: "groceries", ym: "2026-07", actual: 300 },
        ],
        months,
      ),
    ).toEqual({
      groceries: [
        { label: "July 2026", actual: 300 },
        { label: "August 2026", actual: 250 },
      ],
    });
  });

  test("a recorded month with nothing in the category counts as £0", () => {
    expect(
      historyByCategory(
        [{ categoryId: "fuel", ym: "2026-08", actual: 60 }],
        months,
      ).fuel,
    ).toEqual([
      { label: "July 2026", actual: 0 },
      { label: "August 2026", actual: 60 },
    ]);
  });

  test("entries outside the recorded months are not counted", () => {
    expect(
      historyByCategory(
        [{ categoryId: "fuel", ym: "2025-01", actual: 999 }],
        months,
      ).fuel,
    ).toEqual([
      { label: "July 2026", actual: 0 },
      { label: "August 2026", actual: 0 },
    ]);
  });
});
