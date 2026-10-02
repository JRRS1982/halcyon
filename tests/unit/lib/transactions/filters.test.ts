import { ledgerWhere } from "@/lib/transactions/filters";

const USER = "user-1";

describe("ledgerWhere", () => {
  test("an unfiltered query is fenced on the user and soft deletes only", () => {
    expect(ledgerWhere(USER, {})).toEqual({
      userId: USER,
      deletedAt: null,
    });
  });

  test("search matches the description case-insensitively, trimmed", () => {
    expect(ledgerWhere(USER, { search: "  tesco " })).toMatchObject({
      description: { contains: "tesco", mode: "insensitive" },
    });
  });

  test("a whitespace-only search is not a filter", () => {
    expect(ledgerWhere(USER, { search: "   " })).not.toHaveProperty(
      "description",
    );
  });

  test("uncategorized means no category and no transfer", () => {
    expect(ledgerWhere(USER, { onlyUncategorized: true })).toMatchObject({
      categoryId: null,
      transferAccountId: null,
    });
  });

  test("dates bound the range inclusively at UTC midnight", () => {
    expect(
      ledgerWhere(USER, { from: "2026-01-01", to: "2026-03-31" }),
    ).toMatchObject({
      date: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-03-31T00:00:00.000Z"),
      },
    });
  });

  test("one open end bounds only that end", () => {
    expect(ledgerWhere(USER, { from: "2026-01-01" }).date).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(ledgerWhere(USER, { to: "2026-01-01" }).date).toEqual({
      lte: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  test("an account filter pins the owning account", () => {
    expect(ledgerWhere(USER, { accountId: "acc-1" })).toMatchObject({
      accountId: "acc-1",
    });
  });

  test("a category filter pins the category", () => {
    expect(
      ledgerWhere(USER, { category: { kind: "category", categoryId: "c-1" } }),
    ).toMatchObject({ categoryId: "c-1" });
  });

  test("the transfers filter selects rows with a counterparty", () => {
    expect(
      ledgerWhere(USER, { category: { kind: "transfers" } }),
    ).toMatchObject({ transferAccountId: { not: null } });
  });

  test("an upper amount bound is a single signed range around zero", () => {
    // |amount| <= 50 is exactly -50 <= amount <= 50, so no OR is needed.
    const where = ledgerWhere(USER, { amountMax: 50 });
    expect(where.amount).toEqual({ gte: -50, lte: 50 });
    expect(where).not.toHaveProperty("OR");
  });

  test("a lower amount bound matches either sign", () => {
    // |amount| >= 10 cannot be one range — it is everything outside (-10, 10).
    const where = ledgerWhere(USER, { amountMin: 10 });
    expect(where.OR).toEqual([
      { amount: { gte: 10 } },
      { amount: { lte: -10 } },
    ]);
    expect(where).not.toHaveProperty("amount");
  });

  test("both bounds combine without either clobbering the other", () => {
    const where = ledgerWhere(USER, { amountMin: 10, amountMax: 50 });
    expect(where.amount).toEqual({ gte: -50, lte: 50 });
    expect(where.OR).toEqual([
      { amount: { gte: 10 } },
      { amount: { lte: -10 } },
    ]);
  });

  test("uncategorized outranks a contradictory category in a hand-edited URL", () => {
    // Both name the same column. The UI cannot produce this pair, but a
    // shared or hand-typed URL can, so the winner is chosen, not incidental.
    const where = ledgerWhere(USER, {
      onlyUncategorized: true,
      category: { kind: "category", categoryId: "c-1" },
    });
    expect(where.categoryId).toBeNull();
    expect(where.transferAccountId).toBeNull();
  });

  test("uncategorized outranks a contradictory transfers filter", () => {
    const where = ledgerWhere(USER, {
      onlyUncategorized: true,
      category: { kind: "transfers" },
    });
    expect(where.transferAccountId).toBeNull();
  });

  test("filters compose rather than replace one another", () => {
    const where = ledgerWhere(USER, {
      search: "rent",
      from: "2026-02-01",
      accountId: "acc-1",
      category: { kind: "category", categoryId: "c-1" },
      amountMax: 900,
    });
    expect(where).toEqual({
      userId: USER,
      deletedAt: null,
      description: { contains: "rent", mode: "insensitive" },
      date: { gte: new Date("2026-02-01T00:00:00.000Z") },
      accountId: "acc-1",
      categoryId: "c-1",
      amount: { gte: -900, lte: 900 },
    });
  });
});
