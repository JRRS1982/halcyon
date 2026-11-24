import { escapeLike, ledgerWhere } from "@/lib/transactions/filters";

const USER = "user-1";

describe("ledgerWhere", () => {
  test("an unfiltered query is fenced on the user and soft deletes only", () => {
    expect(ledgerWhere(USER, {})).toEqual({
      userId: USER,
      deletedAt: null,
    });
  });

  test("search reads description, note and category name, trimmed", () => {
    const contains = { contains: "tesco", mode: "insensitive" };
    // Containing, not equal: transfers add their own clauses, covered against
    // a real database in server.integration.test.ts.
    expect(ledgerWhere(USER, { search: "  tesco " })).toMatchObject({
      AND: [
        {
          OR: expect.arrayContaining([
            { description: contains },
            { note: contains },
            { category: { is: { label: contains } } },
          ]),
        },
      ],
    });
  });

  // The rows a budget Actual counted are found by a lookup (the transfer
  // source rule cannot be a Prisma predicate) and passed in as ids.
  test("counted narrows to the ids the budget counted", () => {
    const where = ledgerWhere(
      USER,
      { countedIn: { accountId: "acct", year: 2026, month: 2 } },
      { counted: ["t1", "t2"] },
    );
    expect(where).toMatchObject({
      userId: USER,
      AND: [{ id: { in: ["t1", "t2"] } }],
    });
  });

  test("counted with nothing counted matches nothing, never everything", () => {
    const where = ledgerWhere(USER, {
      countedIn: { accountId: "acct", year: 2026, month: 2 },
    });
    expect(where.AND).toEqual([{ id: { in: [] } }]);
  });

  test("a whitespace-only search is not a filter", () => {
    expect(ledgerWhere(USER, { search: "   " })).not.toHaveProperty("AND");
  });

  test("search and to-check both apply, neither replacing the other", () => {
    const where = ledgerWhere(USER, { search: "rent", onlyToCheck: true });
    expect(where.AND).toHaveLength(2);
  });

  test("possible transfers narrows to the paired rows it is given", () => {
    expect(
      ledgerWhere(USER, { possibleTransfers: true }, { pairs: ["a", "b"] }),
    ).toMatchObject({ AND: [{ id: { in: ["a", "b"] } }] });
  });

  test("possible transfers with no pairs matches nothing", () => {
    // An empty list must not fall back to "every row".
    expect(ledgerWhere(USER, { possibleTransfers: true })).toMatchObject({
      AND: [{ id: { in: [] } }],
    });
  });

  test("uncategorized means no category and no transfer", () => {
    expect(ledgerWhere(USER, { onlyUncategorized: true })).toMatchObject({
      categoryId: null,
      transferAccountId: null,
    });
  });

  // The "To check" view. If it is wrong, a pencilled row the user never
  // ticked drops out of the queue and is never reviewed.
  test("to check means no category yet, or one not yet ticked", () => {
    expect(ledgerWhere(USER, { onlyToCheck: true })).toMatchObject({
      AND: [
        {
          OR: [
            { categoryId: null, transferAccountId: null },
            { isCategoryConfirmed: false },
          ],
        },
      ],
    });
  });

  // amountClause owns the top-level OR for a minimum amount; the queue's OR
  // must not overwrite it.
  test("to check keeps a minimum-amount filter intact", () => {
    const where = ledgerWhere(USER, { onlyToCheck: true, amountMin: 10 });
    expect(where.OR).toEqual([
      { amount: { gte: 10 } },
      { amount: { lte: -10 } },
    ]);
    expect(where.AND).toHaveLength(1);
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
      AND: [
        {
          OR: expect.arrayContaining([
            { description: { contains: "rent", mode: "insensitive" } },
            { note: { contains: "rent", mode: "insensitive" } },
            {
              category: {
                is: { label: { contains: "rent", mode: "insensitive" } },
              },
            },
          ]),
        },
      ],
      date: { gte: new Date("2026-02-01T00:00:00.000Z") },
      accountId: "acc-1",
      categoryId: "c-1",
      amount: { gte: -900, lte: 900 },
    });
  });
});

describe("escapeLike", () => {
  test("a typed % or _ is matched literally, not as a wildcard", () => {
    expect(escapeLike("50% off_now")).toBe("50\\% off\\_now");
  });

  test("a backslash is escaped before anything else", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  test("ordinary text passes through unchanged", () => {
    expect(escapeLike("Tesco Metro")).toBe("Tesco Metro");
  });
});
