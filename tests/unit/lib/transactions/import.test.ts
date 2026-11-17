import {
  columnValues,
  guessLeaveOut,
  guessMapping,
  isLeftOut,
  MAX_LEAVE_OUT_VALUES,
  mapRows,
  PAIR_WINDOW_DAYS,
  pairOpposites,
} from "@/lib/transactions/import";

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

  // The date column is found by its header, then its cells pick the format —
  // so an ISO statement previews cleanly instead of every row "Invalid date".
  test("reads the date format off the date column it found", () => {
    const guess = guessMapping(
      ["Description", "Amount", "Date"],
      [
        ["Tesco", "-23.40", "2026-10-30"],
        ["Salary", "2100", "2026-10-31"],
      ],
    );
    expect(guess.dateFormat).toBe("YMD");
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

// The shape of a Monzo export, trimmed to the columns that matter here.
const MONZO = [
  ["Date", "Type", "Name", "Amount", "Description"],
  ["02/11/2026", "Pot transfer", "Bills Pot", "151.00", ""],
  ["02/11/2026", "Card payment", "Pret", "-4.35", "PRET A MANGER LONDON"],
  ["03/11/2026", "Monzo-to-Monzo", "Sam", "-20.00", "Dinner"],
  ["04/11/2026", "Pot transfer", "Savings", "-50.00", ""],
];

describe("description fallback", () => {
  test("guesses a Name column as the fallback for an empty description", () => {
    const guess = guessMapping(MONZO[0] as string[], MONZO.slice(1));
    expect(guess.descriptionColumn).toBe(4);
    expect(guess.fallbackDescriptionColumn).toBe(2);
  });

  test("guesses no fallback when the file has no Name column", () => {
    expect(
      guessMapping(["Date", "Description", "Amount"]).fallbackDescriptionColumn,
    ).toBeNull();
  });

  test("fills only the empty descriptions from the fallback, and says so", () => {
    const rows = mapRows(
      MONZO,
      guessMapping(MONZO[0] as string[], MONZO.slice(1)),
    );
    expect(rows.map((r) => r.description)).toEqual([
      "Bills Pot",
      "PRET A MANGER LONDON",
      "Dinner",
      "Savings",
    ]);
    expect(rows.map((r) => r.isDescriptionFromFallback)).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });

  test("with no fallback chosen, an empty description stays empty", () => {
    const mapping = {
      ...guessMapping(MONZO[0] as string[], MONZO.slice(1)),
      fallbackDescriptionColumn: null,
    };
    expect(mapRows(MONZO, mapping)[0]?.description).toBe("");
  });
});

describe("leaving rows out", () => {
  test("pre-fills pot transfers when a Type column holds them", () => {
    expect(guessLeaveOut(MONZO[0] as string[], MONZO.slice(1))).toEqual({
      column: 1,
      values: ["Pot transfer"],
    });
  });

  test("leaves nothing out by default when there are no pot transfers", () => {
    expect(
      guessLeaveOut(["Date", "Type", "Amount"], [["1/1/2026", "DD", "-5"]]),
    ).toBeNull();
    expect(guessLeaveOut(["Date", "Description", "Amount"], [])).toBeNull();
  });

  test("lists a column's values, most common first", () => {
    expect(columnValues(MONZO, 1, true)).toEqual([
      { value: "Pot transfer", count: 2 },
      { value: "Card payment", count: 1 },
      { value: "Monzo-to-Monzo", count: 1 },
    ]);
  });

  test("offers no checkboxes for a free-text column", () => {
    const rows = [
      ["Name"],
      ...Array.from({ length: MAX_LEAVE_OUT_VALUES + 1 }, (_, i) => [`p${i}`]),
    ];
    expect(columnValues(rows, 0, true)).toBeNull();
  });

  test("leaves out exactly the rows whose value was ticked", () => {
    const rows = mapRows(MONZO, guessMapping(MONZO[0] as string[]));
    const rule = { column: 1, values: ["Pot transfer", "Monzo-to-Monzo"] };
    expect(rows.filter((r) => isLeftOut(r, rule)).map((r) => r.index)).toEqual([
      0, 2, 3,
    ]);
    expect(rows.some((r) => isLeftOut(r, null))).toBe(false);
    expect(rows.some((r) => isLeftOut(r, { column: 1, values: [] }))).toBe(
      false,
    );
  });
});

describe("pairOpposites", () => {
  const row = (index: number, day: string, amount: number) => ({
    index,
    raw: [],
    date: new Date(`2026-11-${day}T00:00:00.000Z`),
    amount,
    description: `row ${index}`,
    isDescriptionFromFallback: false,
    extra: null,
    errors: [],
  });
  const ids = (result: ReturnType<typeof pairOpposites>) => ({
    pairs: result.pairs.map(([a, b]) => [a.index, b.index]),
    singles: result.singles.map((r) => r.index),
  });

  test("pairs money into a pot with the matching money out", () => {
    expect(ids(pairOpposites([row(0, "02", -151), row(1, "02", 151)]))).toEqual(
      { pairs: [[0, 1]], singles: [] },
    );
  });

  test("leaves a row with no opposite on its own", () => {
    expect(ids(pairOpposites([row(0, "02", -151), row(1, "02", 42)]))).toEqual({
      pairs: [],
      singles: [0, 1],
    });
  });

  test("does not pair rows further apart than the window", () => {
    const late = String(2 + PAIR_WINDOW_DAYS + 1).padStart(2, "0");
    expect(ids(pairOpposites([row(0, "02", -50), row(1, late, 50)]))).toEqual({
      pairs: [],
      singles: [0, 1],
    });
  });

  test("each row pairs once, with the nearest date", () => {
    expect(
      ids(
        pairOpposites([
          row(0, "02", -20),
          row(1, "04", 20),
          row(2, "03", 20),
          row(3, "03", -20),
        ]),
      ),
    ).toEqual({
      pairs: [
        [0, 2],
        [3, 1],
      ],
      singles: [],
    });
  });

  test("a same-sign repeat is not a pair", () => {
    expect(ids(pairOpposites([row(0, "02", 10), row(1, "02", 10)]))).toEqual({
      pairs: [],
      singles: [0, 1],
    });
  });
});
