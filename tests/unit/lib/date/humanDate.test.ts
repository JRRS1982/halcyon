import { humanDate, shortDate } from "@/lib/date/humanDate";

describe("humanDate", () => {
  test("writes a day, short month and year", () => {
    expect(humanDate("2026-01-01")).toBe("1 Jan 2026");
    expect(humanDate("2026-10-28T00:00:00.000Z", false)).toBe("28 Oct");
  });
});

// If this is wrong, a user scanning the ledger either reads a year on every row
// or cannot tell last December from this one.
describe("shortDate", () => {
  const today = new Date(Date.UTC(2026, 10, 1));

  test("drops the year for this year's dates", () => {
    expect(shortDate("2026-10-28", today)).toBe("28 Oct");
  });

  test("keeps the year for any other year", () => {
    expect(shortDate("2025-12-24", today)).toBe("24 Dec 2025");
  });
});
