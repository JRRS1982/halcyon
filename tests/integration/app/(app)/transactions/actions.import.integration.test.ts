import { TEST_USER_ID } from "@test/support/helpers";
import { commitImport, previewImport } from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";

const rows = [
  ["date", "desc", "amount"],
  ["2026-03-01", "Tesco", "-10"],
  ["2026-03-02", "Shell", "-50"],
];
const mapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
  dateFormat: "YMD" as const,
  hasHeader: true,
};

const countTxns = (accountId: string) =>
  prisma.transaction.count({ where: { userId: TEST_USER_ID, accountId } });

describe("import (integration)", () => {
  test("commitImport creates the account and inserts valid rows", async () => {
    const res = await commitImport({
      accountId: null,
      newAccountName: "Current",
      rows,
      mapping,
      skipIndexes: [],
    });

    expect(res.imported).toBe(2);
    expect(res.accountName).toBe("Current");

    const account = await prisma.account.findFirst({
      where: { userId: TEST_USER_ID },
    });
    expect(account).not.toBeNull();
    expect(await countTxns(account?.id ?? "")).toBe(2);
  });

  test("invalid rows are skipped, not imported", async () => {
    const res = await commitImport({
      accountId: null,
      newAccountName: "A",
      rows: [
        ["date", "desc", "amount"],
        ["nope", "X", "-1"],
        ["2026-03-01", "Y", "abc"],
      ],
      mapping,
      skipIndexes: [],
    });
    expect(res.imported).toBe(0);
    expect(res.invalid).toBe(2);
  });

  test("previewImport flags rows already in the account; commit can skip them", async () => {
    const account = await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        name: "Cur",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    await commitImport({
      accountId: account.id,
      newAccountName: null,
      rows,
      mapping,
      skipIndexes: [],
    });

    const preview = await previewImport({
      accountId: account.id,
      newAccountName: null,
      rows,
      mapping,
    });
    expect(preview.validCount).toBe(2);
    expect(preview.duplicates).toHaveLength(2);

    // Skip the flagged duplicates → nothing new imported, no doubling.
    const res = await commitImport({
      accountId: account.id,
      newAccountName: null,
      rows,
      mapping,
      skipIndexes: preview.duplicates.map((d) => d.index),
    });
    expect(res.imported).toBe(0);
    expect(await countTxns(account.id)).toBe(2);
  });

  test("a brand-new account flags no duplicates", async () => {
    const preview = await previewImport({
      accountId: null,
      newAccountName: "Fresh",
      rows,
      mapping,
    });
    expect(preview.duplicates).toHaveLength(0);
    expect(preview.validCount).toBe(2);
  });

  describe("categorisation memory", () => {
    const seedCategorisedHistory = async () => {
      const account = await prisma.account.create({
        data: {
          userId: TEST_USER_ID,
          name: "History",
          ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
        },
      });
      const groceries = await prisma.category.create({
        data: {
          userId: TEST_USER_ID,
          type: "EXPENSE",
          section: "VARIABLE",
          label: "Groceries",
        },
      });
      await prisma.transaction.create({
        data: {
          userId: TEST_USER_ID,
          accountId: account.id,
          date: new Date("2026-02-10T00:00:00.000Z"),
          amount: -12,
          description: "TESCO STORES 3421",
          categoryId: groceries.id,
        },
      });
      return { account, groceries };
    };

    test("an import files repeat merchants the way they were filed last time", async () => {
      const { account, groceries } = await seedCategorisedHistory();

      const res = await commitImport({
        accountId: account.id,
        newAccountName: null,
        rows: [
          ["date", "desc", "amount"],
          ["2026-03-05", "TESCO STORES 9999", "-15"],
          ["2026-03-06", "BRAND NEW PLACE", "-20"],
        ],
        mapping,
        skipIndexes: [],
      });

      expect(res.imported).toBe(2);
      expect(res.autoCategorised).toBe(1);

      const tesco = await prisma.transaction.findFirst({
        where: { userId: TEST_USER_ID, description: "TESCO STORES 9999" },
      });
      expect(tesco?.categoryId).toBe(groceries.id);

      const novel = await prisma.transaction.findFirst({
        where: { userId: TEST_USER_ID, description: "BRAND NEW PLACE" },
      });
      expect(novel?.categoryId).toBeNull();
    });

    test("a deleted category is never resurrected by an import", async () => {
      const { account, groceries } = await seedCategorisedHistory();
      await prisma.category.update({
        where: { id: groceries.id },
        data: { deletedAt: new Date() },
      });

      const res = await commitImport({
        accountId: account.id,
        newAccountName: null,
        rows: [
          ["date", "desc", "amount"],
          ["2026-03-05", "TESCO STORES 9999", "-15"],
        ],
        mapping,
        skipIndexes: [],
      });

      expect(res.autoCategorised).toBe(0);
      const tesco = await prisma.transaction.findFirst({
        where: { userId: TEST_USER_ID, description: "TESCO STORES 9999" },
      });
      expect(tesco?.categoryId).toBeNull();
    });
  });

  // The duplicate lookup used to query the span between the CSV's earliest and
  // latest dates, which loaded every transaction in between — on a wide CSV,
  // the whole ledger, in a route that writes nothing and so is capped by
  // nothing. It now queries only the dates the CSV names. This is the case
  // that would break if the `in` list were wrong: the dates are years apart,
  // so a span would cover them trivially while an `in` list has to be exact.
  test("flags duplicates on dates that are years apart", async () => {
    const scattered = [
      ["date", "desc", "amount"],
      ["2020-01-15", "Old thing", "-10"],
      ["2026-03-02", "Shell", "-50"],
    ];

    const res = await commitImport({
      accountId: null,
      newAccountName: "Scattered",
      rows: scattered,
      mapping,
      skipIndexes: [],
    });
    expect(res.imported).toBe(2);

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: TEST_USER_ID, name: "Scattered" },
    });

    // A transaction sitting between the two CSV dates — the span query would
    // have loaded it, the `in` list must not, and either way it is not a
    // duplicate of anything in the file.
    await prisma.transaction.create({
      data: {
        userId: TEST_USER_ID,
        accountId: account.id,
        date: new Date("2023-06-01"),
        description: "In between",
        amount: -99,
      },
    });

    const preview = await previewImport({
      accountId: account.id,
      newAccountName: null,
      rows: scattered,
      mapping,
    });

    expect(preview.validCount).toBe(2);
    expect(preview.duplicates).toHaveLength(2);
  });
});
