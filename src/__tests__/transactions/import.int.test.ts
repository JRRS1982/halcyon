import { commitImport, previewImport } from "@/app/(app)/transactions/actions";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

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
      data: { userId: TEST_USER_ID, name: "Cur" },
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
});
