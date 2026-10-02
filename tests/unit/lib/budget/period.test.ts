import { currentMonthRange } from "@/lib/budget/period";

describe("currentMonthRange", () => {
  test("mid-month — returns the calendar month containing the date", () => {
    const range = currentMonthRange(new Date("2026-05-15T10:00:00Z"));
    expect(range.startDate.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(range.endDate.toISOString()).toBe("2026-05-31T00:00:00.000Z");
    expect(range.label).toBe("May 2026");
  });

  test("first of month — returns that month", () => {
    const range = currentMonthRange(new Date("2026-01-01T00:00:00Z"));
    expect(range.startDate.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(range.endDate.toISOString()).toBe("2026-01-31T00:00:00.000Z");
    expect(range.label).toBe("January 2026");
  });

  test("last-day-of-month — stays in that month", () => {
    const range = currentMonthRange(new Date("2026-02-28T23:59:59Z"));
    expect(range.startDate.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(range.endDate.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(range.label).toBe("February 2026");
  });

  test("December — end month edge case", () => {
    const range = currentMonthRange(new Date("2026-12-31T23:59:59Z"));
    expect(range.startDate.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(range.endDate.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(range.label).toBe("December 2026");
  });

  test("leap year February", () => {
    const range = currentMonthRange(new Date("2028-02-15T00:00:00Z"));
    expect(range.startDate.toISOString()).toBe("2028-02-01T00:00:00.000Z");
    expect(range.endDate.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(range.label).toBe("February 2028");
  });
});
