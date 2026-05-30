import { parseAmount } from "@/lib/transactions/amount";

describe("parseAmount", () => {
  test("parses a plain signed decimal", () => {
    expect(parseAmount("-50")).toBe(-50);
    expect(parseAmount("50.00")).toBe(50);
  });

  test("strips comma thousands separators", () => {
    expect(parseAmount("1,234.56")).toBe(1234.56);
  });

  test("treats parentheses as a negative", () => {
    expect(parseAmount("(50.00)")).toBe(-50);
  });

  test("strips currency symbols and surrounding whitespace", () => {
    expect(parseAmount("  £1,200 ")).toBe(1200);
    expect(parseAmount("$99.9")).toBe(99.9);
  });

  test("honours a leading plus sign", () => {
    expect(parseAmount("+12.34")).toBe(12.34);
  });

  test("returns null for non-numeric or empty input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });
});
