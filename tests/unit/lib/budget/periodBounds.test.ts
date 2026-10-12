import { calendarMonth, calendarYear } from "@/lib/budget/period";

// ensurePeriodForMonth is a server action: its two arguments arrive straight
// from the client and reached Date.UTC() and a FinancialPeriod write with no
// parse at all, which is how `[2026, 999]` wrote a row labelled
// "undefined 2026". These bounds are the parse it was missing, and the same
// ones the copy schemas in budget/ and balance/ now use for their year field.
describe("calendar bounds", () => {
  it("accepts an ordinary month", () => {
    expect(calendarYear.safeParse(2026).success).toBe(true);
    expect(calendarMonth.safeParse(0).success).toBe(true);
    expect(calendarMonth.safeParse(11).success).toBe(true);
  });

  it("rejects a month outside the twelve", () => {
    expect(calendarMonth.safeParse(12).success).toBe(false);
    expect(calendarMonth.safeParse(-1).success).toBe(false);
    expect(calendarMonth.safeParse(999).success).toBe(false);
  });

  it("rejects a year outside any plausible ledger", () => {
    expect(calendarYear.safeParse(1899).success).toBe(false);
    expect(calendarYear.safeParse(2201).success).toBe(false);
    expect(calendarYear.safeParse(1e9).success).toBe(false);
  });

  it("rejects non-integers, which Date.UTC would silently truncate", () => {
    expect(calendarYear.safeParse(2026.5).success).toBe(false);
    expect(calendarMonth.safeParse(1.5).success).toBe(false);
  });
});
