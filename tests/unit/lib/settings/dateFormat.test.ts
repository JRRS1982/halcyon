import {
  DATE_FORMATS,
  DEFAULT_DATE_FORMAT,
  formatDate,
  isDateFormat,
} from "@/lib/settings/dateFormat";

// If this is wrong, a user reads 03/04 as the wrong month: the order is the
// whole point of the setting.
describe("formatDate", () => {
  test.each([
    ["DMY", "31/12/2026"],
    ["MDY", "12/31/2026"],
    ["YMD", "2026-12-31"],
  ] as const)("writes %s as %s", (format, expected) => {
    expect(formatDate("2026-12-31", format)).toBe(expected);
  });

  test("leaves anything that is not a whole date alone", () => {
    expect(formatDate("", "DMY")).toBe("");
    expect(formatDate("2026-12", "DMY")).toBe("2026-12");
  });
});

describe("isDateFormat", () => {
  test("accepts the three formats and nothing else", () => {
    for (const format of DATE_FORMATS) expect(isDateFormat(format)).toBe(true);
    expect(isDateFormat("DDMMYYYY")).toBe(false);
    expect(isDateFormat(undefined)).toBe(false);
  });

  // A UK-first app: a new user, and a stored value that is unreadable, see
  // day-month-year.
  test("defaults to day, month, year", () => {
    expect(DEFAULT_DATE_FORMAT).toBe("DMY");
  });
});
