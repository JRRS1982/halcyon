import { DATE_FORMATS, parseDate } from "@/lib/transactions/date";

describe("parseDate", () => {
  test("parses DMY with the day first", () => {
    expect(parseDate("14/03/2026", "DMY")?.toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
  });

  test("parses MDY with the month first", () => {
    expect(parseDate("03/14/2026", "MDY")?.toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
  });

  test("parses ISO YMD", () => {
    expect(parseDate("2026-03-14", "YMD")?.toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
  });

  test("accepts '-', '/' and '.' separators", () => {
    expect(parseDate("14-03-2026", "DMY")?.toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
    expect(parseDate("14.03.2026", "DMY")?.toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
  });

  test("expands two-digit years to 2000s", () => {
    expect(parseDate("14/03/26", "DMY")?.toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
  });

  test("anchors the date at UTC midnight (no timezone drift)", () => {
    const d = parseDate("01/01/2026", "DMY");
    expect(d?.getUTCHours()).toBe(0);
    expect(d?.getUTCDate()).toBe(1);
  });

  test("rejects impossible and malformed dates", () => {
    expect(parseDate("32/03/2026", "DMY")).toBeNull();
    expect(parseDate("14/13/2026", "DMY")).toBeNull();
    expect(parseDate("not a date", "DMY")).toBeNull();
    expect(parseDate("", "DMY")).toBeNull();
  });

  test("exposes the supported formats", () => {
    expect(DATE_FORMATS).toEqual(["DMY", "MDY", "YMD"]);
  });
});
