import { calendarDate, calendarMonth, calendarYear } from "@/lib/budget/period";

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

// The three date-string inputs in the app — a plan's date of birth (twice)
// and a quick-add transaction's date — checked only the shape, which lets
// through two different wrong answers. An impossible day is the quieter one:
// `new Date("2026-02-30")` does not fail, it rolls forward to 2 March, so the
// user's row is stored under a date they did not type.
describe("calendarDate", () => {
  it("accepts a real calendar date", () => {
    expect(calendarDate.safeParse("2026-02-28").success).toBe(true);
    expect(calendarDate.safeParse("2028-02-29").success).toBe(true);
    expect(calendarDate.safeParse("1990-12-31").success).toBe(true);
  });

  it("rejects a day the month does not have", () => {
    expect(calendarDate.safeParse("2026-02-30").success).toBe(false);
    expect(calendarDate.safeParse("2026-04-31").success).toBe(false);
    // 2026 is not a leap year, so the 29th does not exist.
    expect(calendarDate.safeParse("2026-02-29").success).toBe(false);
  });

  it("rejects a month outside the twelve", () => {
    expect(calendarDate.safeParse("2026-13-01").success).toBe(false);
    expect(calendarDate.safeParse("2026-00-01").success).toBe(false);
  });

  it("rejects anything that is not a plain YYYY-MM-DD", () => {
    expect(calendarDate.safeParse("2026-2-8").success).toBe(false);
    expect(calendarDate.safeParse("28/02/2026").success).toBe(false);
    expect(calendarDate.safeParse("2026-02-28T00:00:00Z").success).toBe(false);
    expect(calendarDate.safeParse("").success).toBe(false);
  });

  it("rejects a year outside the same bounds calendarYear uses", () => {
    expect(calendarDate.safeParse("1899-01-01").success).toBe(false);
    expect(calendarDate.safeParse("2201-01-01").success).toBe(false);
  });
});
