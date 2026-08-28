import { EMPTY_PARTS, isoFromParts, partsFromIso } from "@/lib/date/dateParts";

describe("partsFromIso", () => {
  test("splits a stored date into day, month and year", () => {
    expect(partsFromIso("1986-06-01")).toEqual({
      day: "01",
      month: "06",
      year: "1986",
    });
  });

  test.each([
    "",
    "1986-6-1",
    "01/06/1986",
    "not a date",
  ])("gives blanks for %p", (input) => {
    expect(partsFromIso(input)).toEqual(EMPTY_PARTS);
  });
});

describe("isoFromParts", () => {
  test("builds a stored date, padding a single-digit day and month", () => {
    expect(isoFromParts({ day: "1", month: "6", year: "1986" })).toBe(
      "1986-06-01",
    );
  });

  test("accepts an already-padded date unchanged", () => {
    expect(isoFromParts({ day: "01", month: "06", year: "1986" })).toBe(
      "1986-06-01",
    );
  });

  // The whole reason the parts round-trip through a Date: building one from
  // 31 February silently yields 2 March, so the result is compared back
  // against what was asked for.
  test("rejects a day that does not exist in that month", () => {
    expect(isoFromParts({ day: "31", month: "02", year: "1986" })).toBe("");
    expect(isoFromParts({ day: "31", month: "04", year: "1986" })).toBe("");
  });

  test("knows which Februaries have 29 days", () => {
    expect(isoFromParts({ day: "29", month: "02", year: "1988" })).toBe(
      "1988-02-29",
    );
    expect(isoFromParts({ day: "29", month: "02", year: "1986" })).toBe("");
    // 1900 is divisible by 4 but not a leap year.
    expect(isoFromParts({ day: "29", month: "02", year: "1900" })).toBe("");
    expect(isoFromParts({ day: "29", month: "02", year: "2000" })).toBe(
      "2000-02-29",
    );
  });

  // "" is the contract that keeps a half-typed date off the server, and is
  // what leaves "Create my plan" disabled until the date is whole.
  test.each([
    ["a missing year", { day: "01", month: "06", year: "" }],
    ["a two-digit year", { day: "01", month: "06", year: "86" }],
    ["a missing day", { day: "", month: "06", year: "1986" }],
    ["a month of 13", { day: "01", month: "13", year: "1986" }],
    ["a month of 0", { day: "01", month: "0", year: "1986" }],
    ["a day of 0", { day: "0", month: "06", year: "1986" }],
    ["letters", { day: "aa", month: "06", year: "1986" }],
  ])('gives "" for %s', (_label, parts) => {
    expect(isoFromParts(parts)).toBe("");
  });

  test("round-trips through partsFromIso", () => {
    const iso = "1986-06-01";
    expect(isoFromParts(partsFromIso(iso))).toBe(iso);
  });
});
