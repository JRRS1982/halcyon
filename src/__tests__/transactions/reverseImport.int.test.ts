import {
  commitImport,
  listImportBatches,
  reverseImport,
} from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { TEST_USER_ID } from "../../../test/integration/helpers";

const OTHER_USER_ID = "00000000-0000-0000-0000-0000000000bb";

const mapping = {
  dateColumn: 0,
  descriptionColumn: 1,
  amountColumn: 2,
  dateFormat: "YMD" as const,
  hasHeader: true,
};

const runImport = (descriptions: string[], fileName = "statement.csv") =>
  commitImport({
    accountId: null,
    newAccountName: "Current",
    rows: [
      ["date", "desc", "amount"],
      ...descriptions.map((d, i) => [`2026-03-0${i + 1}`, d, "-10"]),
    ],
    mapping,
    skipIndexes: [],
    fileName,
  });

describe("import batches (integration)", () => {
  test("commitImport records a batch and tags its transactions", async () => {
    await runImport(["Tesco", "Shell"]);

    const batches = await prisma.importBatch.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(batches).toHaveLength(1);
    expect(batches[0]?.fileName).toBe("statement.csv");

    const txns = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(txns).toHaveLength(2);
    expect(txns.every((t) => t.importBatchId === batches[0]?.id)).toBe(true);
  });

  test("listImportBatches reports live counts, newest first", async () => {
    await runImport(["Tesco", "Shell"], "first.csv");
    await runImport(["Greggs"], "second.csv");

    const list = await listImportBatches();

    expect(list).toHaveLength(2);
    expect(list[0]?.fileName).toBe("second.csv");
    expect(list[0]?.count).toBe(1);
    expect(list[1]?.fileName).toBe("first.csv");
    expect(list[1]?.count).toBe(2);
    expect(list[0]?.accountName).toBe("Current");
  });

  test("reverseImport soft-deletes only the chosen batch and retires it", async () => {
    await runImport(["Tesco", "Shell"], "first.csv");
    await runImport(["Greggs"], "second.csv");
    const [latest] = await listImportBatches();
    if (!latest) throw new Error("Expected a batch to reverse");

    const res = await reverseImport({ batchId: latest.id });

    expect(res).toEqual({ reversed: 1, accountName: "Current" });
    const live = await prisma.transaction.findMany({
      where: { userId: TEST_USER_ID, deletedAt: null },
    });
    expect(live.map((t) => t.description).sort()).toEqual(["Shell", "Tesco"]);

    // The reversed batch leaves the picker; the other remains.
    const list = await listImportBatches();
    expect(list).toHaveLength(1);
    expect(list[0]?.fileName).toBe("first.csv");

    // A second reversal of the same batch is rejected.
    await expect(reverseImport({ batchId: latest.id })).rejects.toThrow(
      "Import not found",
    );
  });

  test("individually deleted rows shrink the batch count; empty batches drop out", async () => {
    await runImport(["Tesco", "Shell"]);
    await prisma.transaction.updateMany({
      where: { userId: TEST_USER_ID, description: "Tesco" },
      data: { deletedAt: new Date() },
    });

    let list = await listImportBatches();
    expect(list[0]?.count).toBe(1);

    await prisma.transaction.updateMany({
      where: { userId: TEST_USER_ID },
      data: { deletedAt: new Date() },
    });
    list = await listImportBatches();
    expect(list).toHaveLength(0);
  });

  test("cannot reverse another user's import", async () => {
    await runImport(["Tesco"]);
    const batch = await prisma.importBatch.findFirstOrThrow({
      where: { userId: TEST_USER_ID },
    });

    // Re-home the batch to someone else, then try to reverse it as the
    // signed-in test user.
    await prisma.user.create({ data: { id: OTHER_USER_ID } });
    const otherAccount = await prisma.account.create({
      data: {
        userId: OTHER_USER_ID,
        name: "Other",
        ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
      },
    });
    await prisma.transaction.updateMany({
      where: { userId: TEST_USER_ID },
      data: { importBatchId: null },
    });
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { userId: OTHER_USER_ID, accountId: otherAccount.id },
    });

    await expect(reverseImport({ batchId: batch.id })).rejects.toThrow(
      "Import not found",
    );
  });
});
