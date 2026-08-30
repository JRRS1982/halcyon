import { createAccount } from "@/app/(app)/balance/accountActions";
import { upsertBalanceValue } from "@/app/(app)/balance/actions";
import { prisma } from "@/lib/prisma";

// Prisma `Decimal` can't cross the server→client boundary — Next serialises it
// to `{}` and logs "Only plain objects can be passed to Client Components".
// The budget actions coerce through toClientItem; this pins the same guarantee
// for the balance action that hands a mutated row back to the client.

const seedAccount = () =>
  createAccount({
    year: 2026,
    month: 2,
    name: "Savings",
    type: "SAVINGS",
    section: "CURRENT",
    value: 0,
    canImportTransactions: false,
    mortgage: null,
  });

describe("balance actions return client-safe rows (integration)", () => {
  test("upserting a value returns it as a plain number", async () => {
    const { accountId } = await seedAccount();

    const updated = await upsertBalanceValue({
      accountId,
      year: 2026,
      month: 2,
      value: 1234.56,
    });
    expect(typeof updated.value).toBe("number");
    expect(updated.value).toBe(1234.56);

    // The notes-only path returns the same row through the same coercion —
    // it must be a number there too, not the Decimal Prisma handed back.
    const noted = await upsertBalanceValue({
      accountId,
      year: 2026,
      month: 2,
      notes: "Emergency fund",
    });
    expect(typeof noted.value).toBe("number");
    expect(noted.value).toBe(1234.56);
  });

  test("the first value of a month creates the row, still as a number", async () => {
    const { accountId } = await seedAccount();

    // A month the account has never been observed in: upsert creates the row
    // rather than updating one, and that return path needs coercing too.
    const created = await upsertBalanceValue({
      accountId,
      year: 2026,
      month: 3,
      value: 99.5,
    });
    expect(typeof created.value).toBe("number");
    expect(created.value).toBe(99.5);
  });
});

describe("a note needs a value to describe (integration)", () => {
  // The row this note would hang on doesn't exist yet, and creating one
  // would mean inventing a £0 the user never typed — which would also move
  // the account out of the sheet's "without a value" count. Refused, and
  // nothing is written.
  test("a notes-only edit on an unobserved month is refused, and creates no row", async () => {
    const { accountId } = await seedAccount();

    await expect(
      upsertBalanceValue({
        accountId,
        year: 2026,
        month: 5,
        notes: "Chase the statement",
      }),
    ).rejects.toThrow(
      "Enter a value first — a note describes this month's figure",
    );

    // Only the row the account was created with (March) — June got nothing,
    // not even the period the refused write would have opened.
    const rows = await prisma.balanceItem.findMany({
      where: { accountId },
      include: { period: { select: { startDate: true } } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.period.startDate).toEqual(new Date("2026-03-01"));
    expect(
      await prisma.financialPeriod.findFirst({
        where: { startDate: new Date("2026-06-01") },
      }),
    ).toBeNull();
  });

  test("the same note lands once the month has a value", async () => {
    const { accountId } = await seedAccount();

    await upsertBalanceValue({ accountId, year: 2026, month: 5, value: 10 });
    const noted = await upsertBalanceValue({
      accountId,
      year: 2026,
      month: 5,
      notes: "Chase the statement",
    });

    expect(noted.notes).toBe("Chase the statement");
    expect(noted.value).toBe(10);
  });
});
