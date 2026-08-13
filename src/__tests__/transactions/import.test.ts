import { guessMapping, mapRows } from "@/lib/transactions/import";

const mapping = {
  dateColumn: 0,
  amountColumn: 2,
  descriptionColumn: 1,
  dateFormat: "YMD" as const,
  hasHeader: true,
};

describe("mapRows", () => {
  const rows = [
    ["date", "description", "amount"],
    ["2026-03-14", "Tesco", "-50"],
    ["2026-03-15", "Salary", "2000"],
  ];

  test("skips the header and maps each data row by column index", () => {
    const mapped = mapRows(rows, mapping);
    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toMatchObject({
      description: "Tesco",
      amount: -50,
      errors: [],
    });
    expect(mapped[0]?.date?.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  });

  test("includes the first row when hasHeader is false", () => {
    const mapped = mapRows(rows, { ...mapping, hasHeader: false });
    expect(mapped).toHaveLength(3);
    expect(mapped[0]?.errors).toContain("Invalid date");
  });

  test("flags an unparseable date", () => {
    const mapped = mapRows(
      [
        ["x", "y", "z"],
        ["nope", "Tesco", "-50"],
      ],
      mapping,
    );
    expect(mapped[0]?.errors).toContain("Invalid date");
    expect(mapped[0]?.date).toBeNull();
  });

  test("flags an unparseable amount", () => {
    const mapped = mapRows(
      [
        ["x", "y", "z"],
        ["2026-03-14", "Tesco", "abc"],
      ],
      mapping,
    );
    expect(mapped[0]?.errors).toContain("Invalid amount");
    expect(mapped[0]?.amount).toBeNull();
  });

  test("trims the description and tolerates a missing column", () => {
    const mapped = mapRows(
      [
        ["x", "y", "z"],
        ["2026-03-14", "  Tesco  "],
      ],
      mapping,
    );
    expect(mapped[0]?.description).toBe("Tesco");
    expect(mapped[0]?.errors).toContain("Invalid amount");
  });

  test("carries the original row and its data index", () => {
    const mapped = mapRows(rows, mapping);
    expect(mapped[1]).toMatchObject({
      index: 1,
      raw: ["2026-03-15", "Salary", "2000"],
    });
  });
});

describe("guessMapping", () => {
  test("matches common header names case-insensitively", () => {
    const guess = guessMapping(["Date", "Description", "Amount"]);
    expect(guess).toMatchObject({
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 2,
    });
  });

  test("recognises synonyms (Transaction Date, Narrative, Value)", () => {
    const guess = guessMapping(["Narrative", "Value", "Transaction Date"]);
    expect(guess).toMatchObject({
      descriptionColumn: 0,
      amountColumn: 1,
      dateColumn: 2,
    });
  });

  test("falls back to the first three columns when nothing matches", () => {
    const guess = guessMapping(["a", "b", "c"]);
    expect(guess).toMatchObject({
      dateColumn: 0,
      descriptionColumn: 1,
      amountColumn: 2,
    });
  });

  test("defaults hasHeader true and a date format", () => {
    const guess = guessMapping(["Date", "Description", "Amount"]);
    expect(guess.hasHeader).toBe(true);
    expect(["DMY", "MDY", "YMD"]).toContain(guess.dateFormat);
  });

  test("keeps every unmapped column by default", () => {
    const guess = guessMapping([
      "Date",
      "Description",
      "Amount",
      "Type",
      "Reference",
    ]);
    expect(guess.extraColumns).toEqual([3, 4]);
  });

  test("keeps no columns when the core three cover the file", () => {
    const guess = guessMapping(["Date", "Description", "Amount"]);
    expect(guess.extraColumns).toEqual([]);
  });

  test("caps the kept columns at the import limit on very wide files", () => {
    const headers = Array.from({ length: 30 }, (_, i) => `col${i}`);
    const guess = guessMapping(headers);
    expect(guess.extraColumns).toHaveLength(20);
    expect(guess.extraColumns?.[0]).toBe(3);
  });
});

describe("mapRows extra columns", () => {
  const rows = [
    ["date", "description", "amount", "Type", "Reference"],
    ["2026-03-14", "Tesco", "-50", "DD", "000123"],
    ["2026-03-15", "Salary", "2000", "", "  "],
  ];

  test("keeps chosen columns keyed by their header label", () => {
    const mapped = mapRows(rows, { ...mapping, extraColumns: [3, 4] });
    expect(mapped[0]?.extra).toEqual({ Type: "DD", Reference: "000123" });
  });

  test("blank values are dropped; all-blank rows get null extra", () => {
    const mapped = mapRows(rows, { ...mapping, extraColumns: [3, 4] });
    expect(mapped[1]?.extra).toBeNull();
  });

  test("no extraColumns means extra is null", () => {
    const mapped = mapRows(rows, mapping);
    expect(mapped[0]?.extra).toBeNull();
  });

  test("headerless files key by column number", () => {
    const mapped = mapRows([["2026-03-14", "Tesco", "-50", "DD"]], {
      ...mapping,
      hasHeader: false,
      extraColumns: [3],
    });
    expect(mapped[0]?.extra).toEqual({ "Column 4": "DD" });
  });

  test("core mapped columns are never duplicated into extra", () => {
    const mapped = mapRows(rows, { ...mapping, extraColumns: [0, 1, 2, 3] });
    expect(mapped[0]?.extra).toEqual({ Type: "DD" });
  });
});
