import {
  caretAfterSignificant,
  groupForEditing,
  parseEditable,
} from "@/lib/settings/currency";

describe("groupForEditing (COMMA_2: thousands ',', decimal '.')", () => {
  test("groups the integer part as you type", () => {
    expect(groupForEditing("1234", "COMMA_2")).toBe("1,234");
    expect(groupForEditing("1234567", "COMMA_2")).toBe("1,234,567");
  });

  test("leaves short numbers ungrouped", () => {
    expect(groupForEditing("12", "COMMA_2")).toBe("12");
  });

  test("re-groups input that already contains separators", () => {
    // user typed a digit into "1,234" → browser gives "1,2345"
    expect(groupForEditing("1,2345", "COMMA_2")).toBe("12,345");
  });

  test("preserves a trailing decimal point mid-typing", () => {
    expect(groupForEditing("1234.", "COMMA_2")).toBe("1,234.");
  });

  test("keeps decimals exactly as typed without padding", () => {
    expect(groupForEditing("1234.5", "COMMA_2")).toBe("1,234.5");
    expect(groupForEditing("1234.567", "COMMA_2")).toBe("1,234.567");
  });

  test("empty stays empty", () => {
    expect(groupForEditing("", "COMMA_2")).toBe("");
  });
});

describe("groupForEditing (DOT_2: thousands '.', decimal ',')", () => {
  test("groups with dots and keeps a comma decimal", () => {
    expect(groupForEditing("1234567,5", "DOT_2")).toBe("1.234.567,5");
  });
});

describe("parseEditable", () => {
  test("parses a grouped string back to a number", () => {
    expect(parseEditable("1,234.5", "COMMA_2")).toBe(1234.5);
    expect(parseEditable("1.234.567,5", "DOT_2")).toBe(1234567.5);
  });

  test("empty / partial returns 0", () => {
    expect(parseEditable("", "COMMA_2")).toBe(0);
    expect(parseEditable(".", "COMMA_2")).toBe(0);
  });
});

describe("caretAfterSignificant", () => {
  // "1,234", 4 significant chars to the left (digits 1234) → caret at end (5)
  test("places the caret after the Nth significant char", () => {
    expect(caretAfterSignificant("1,234", 4, "COMMA_2")).toBe(5);
  });

  test("counts past a separator that sits before the caret", () => {
    // 2 significant digits "12" → in "1,234" that's after the '2' at index 3
    expect(caretAfterSignificant("1,234", 2, "COMMA_2")).toBe(3);
  });

  test("zero significant chars → caret at start", () => {
    expect(caretAfterSignificant("1,234", 0, "COMMA_2")).toBe(0);
  });
});
