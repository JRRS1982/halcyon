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

// A statement date is a calendar date like any other, and the same bounds the
// rest of the app uses apply here. Unbounded, a two-row CSV dated 01/01/0001
// and 31/12/9999 made previewImport's duplicate lookup span all of recorded
// time — it queried gte(min)/lte(max), so the span was the user's whole ledger.
describe("parseDate year bounds", () => {
  test("rejects a year outside any plausible statement", () => {
    expect(parseDate("31/12/9999", "DMY")).toBeNull();
    expect(parseDate("1899-12-31", "YMD")).toBeNull();
    expect(parseDate("2201-01-01", "YMD")).toBeNull();
  });

  test("still accepts the range a real ledger covers", () => {
    expect(parseDate("1900-01-01", "YMD")?.toISOString()).toBe(
      "1900-01-01T00:00:00.000Z",
    );
    expect(parseDate("2200-12-31", "YMD")?.toISOString()).toBe(
      "2200-12-31T00:00:00.000Z",
    );
  });

  // Two-digit years expand into the 2000s, so they are always in range — the
  // bound must not reject them by looking at the typed digits. "0001" is the
  // same rule seen from the other side: its value is 1, so it expands to 2001
  // rather than meaning the year one, and the low end of the span attack was
  // never reachable this way.
  test("keeps two-digit years working, however they are written", () => {
    expect(parseDate("14/03/26", "DMY")?.toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
    expect(parseDate("01/01/0001", "DMY")?.toISOString()).toBe(
      "2001-01-01T00:00:00.000Z",
    );
  });
});
