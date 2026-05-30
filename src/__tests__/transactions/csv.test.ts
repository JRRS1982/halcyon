import { parseCsv } from "@/lib/transactions/csv";

describe("parseCsv", () => {
  test("splits a simple grid into rows of cells", () => {
    expect(parseCsv("date,desc,amount\n2026-03-14,Tesco,-50")).toEqual([
      ["date", "desc", "amount"],
      ["2026-03-14", "Tesco", "-50"],
    ]);
  });

  test("keeps commas that live inside quoted fields", () => {
    expect(parseCsv('"Tesco, Express",-5')).toEqual([
      ["Tesco, Express", "-5"],
    ]);
  });

  test("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('"She said ""hi"""')).toEqual([['She said "hi"']]);
  });

  test("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("ignores a trailing newline rather than emitting a blank row", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  test("preserves newlines embedded inside a quoted field", () => {
    expect(parseCsv('"line one\nline two",x')).toEqual([
      ["line one\nline two", "x"],
    ]);
  });

  test("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   \n  ")).toEqual([]);
  });
});
