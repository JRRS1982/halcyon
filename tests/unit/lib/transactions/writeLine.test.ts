import { parseLine } from "@/lib/transactions/writeLine";

// A fixed "today", so the date words never depend on when the test runs.
const today = new Date("2026-10-30T12:00:00.000Z");
const parse = (text: string) => parseLine(text, today);

// The "write a line" box. If parsing is wrong, a user's typed spend opens the
// add form with the wrong amount, direction or date already filled in.
describe("parseLine", () => {
  test("an amount then a description is money out, today", () => {
    expect(parse("4.35 Pret coffee")).toEqual({
      amount: 4.35,
      direction: "out",
      description: "Pret coffee",
      date: "2026-10-30",
    });
  });

  test("the amount can come last, with a pound sign", () => {
    expect(parse("Cinema £12")).toMatchObject({
      amount: 12,
      description: "Cinema",
    });
  });

  test("a leading plus is money in", () => {
    expect(parse("+2,850 Salary")).toMatchObject({
      amount: 2850,
      direction: "in",
      description: "Salary",
    });
  });

  test("a leading minus is still money out", () => {
    expect(parse("-9.80 Coffee and pastry")).toMatchObject({
      amount: 9.8,
      direction: "out",
    });
  });

  test("'yesterday' sets the date and leaves the description", () => {
    expect(parse("4.35 Pret yesterday")).toMatchObject({
      description: "Pret",
      date: "2026-10-29",
    });
  });

  test("a day/month sets the date in the current year", () => {
    expect(parse("12/10 30 Fuel")).toMatchObject({
      amount: 30,
      description: "Fuel",
      date: "2026-10-12",
    });
  });

  test("a full day/month/year date is taken as written", () => {
    expect(parse("01/12/2025 20 Gift")).toMatchObject({
      date: "2025-12-01",
    });
  });

  test("only the first number is the amount; later ones stay in the text", () => {
    expect(parse("15 Bus 42")).toMatchObject({
      amount: 15,
      description: "Bus 42",
    });
  });

  test("an impossible date is left as text", () => {
    expect(parse("31/02 5 Market")).toMatchObject({
      description: "31/02 Market",
      date: "2026-10-30",
    });
  });

  test("is nothing without an amount", () => {
    expect(parse("Pret coffee")).toBeNull();
  });

  test("is nothing without a description", () => {
    expect(parse("4.35")).toBeNull();
  });

  test("is nothing for a zero amount", () => {
    expect(parse("0 Nothing")).toBeNull();
  });
});
