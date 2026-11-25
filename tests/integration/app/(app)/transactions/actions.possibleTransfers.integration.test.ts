import type { Prisma } from "@prisma/client";
import { TEST_USER_ID } from "@test/support/helpers";
import { revalidatePath } from "next/cache";
import {
  bulkDeleteTransactions,
  dismissPairs,
  markPairsAsTransfer,
  reverseImport,
  unhidePairs,
  unmarkPairsAsTransfer,
} from "@/app/(app)/transactions/actions";
import { buildAccountData } from "@/lib/accounts/creation";
import { prisma } from "@/lib/prisma";
import { MAX_DISMISSED_PAIRS_PER_USER } from "@/lib/transactions/limits";
import { UNTAGGED } from "@/lib/transactions/possibleTransfers";
import { getTransactionsPage } from "@/lib/transactions/server";

const OTHER_USER = "00000000-0000-0000-0000-0000000000bb";

const account = (name: string, userId = TEST_USER_ID) =>
  prisma.account.create({
    data: { userId, name, ...buildAccountData({ type: "CURRENT_ACCOUNT" }) },
  });

const tx = (
  accountId: string,
  date: string,
  amount: number,
  extra: { userId?: string; importBatchId?: string } = {},
) =>
  prisma.transaction.create({
    data: {
      userId: extra.userId ?? TEST_USER_ID,
      accountId,
      date: new Date(date),
      amount,
      description: `${amount} on ${date}`,
      importBatchId: extra.importBatchId,
    },
  });

const category = (label: string, userId = TEST_USER_ID) =>
  prisma.category.create({
    data: { userId, type: "INCOME", section: "OTHER", label },
  });

// What a row's category cell holds, as stored.
const tagOf = async (id: string) => {
  const row = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  return {
    categoryId: row.categoryId,
    transferAccountId: row.transferAccountId,
    isCategoryConfirmed: row.isCategoryConfirmed,
  };
};

// Runs `during` while `change` is saved but not yet committed, as a save from
// another tab still in flight would be. The pause only gives `during` time to
// reach the row; code that waits for the row passes however long it takes.
async function whileUncommitted<T>(
  change: (tx: Prisma.TransactionClient) => Promise<unknown>,
  during: () => Promise<T>,
): Promise<T> {
  let commit = () => {};
  const untilCommit = new Promise<void>((resolve) => {
    commit = resolve;
  });
  let changed = () => {};
  const untilChanged = new Promise<void>((resolve) => {
    changed = resolve;
  });
  const otherTab = prisma.$transaction(async (tx) => {
    await change(tx);
    changed();
    await untilCommit;
  });
  await untilChanged;
  const action = during();
  await new Promise((resolve) => setTimeout(resolve, 300));
  commit();
  await otherTab;
  return action;
}

const pairsOnScreen = async () =>
  (await getTransactionsPage(TEST_USER_ID, { possibleTransfers: true })).pairs;

const seedPair = async () => {
  const current = await account("Current");
  const savings = await account("Savings");
  const out = await tx(current.id, "2026-11-03", -200);
  const into = await tx(savings.id, "2026-11-04", 200);
  return { current, savings, out, into };
};

describe("markPairsAsTransfer (integration)", () => {
  test("points each row at the other row's account and approves both", async () => {
    const { current, savings, out, into } = await seedPair();

    const result = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toEqual({
      updated: 2,
      skipped: 0,
      marked: [
        {
          outId: out.id,
          inId: into.id,
          outBefore: UNTAGGED,
          inBefore: UNTAGGED,
        },
      ],
    });
    const rows = await prisma.transaction.findMany({
      where: { id: { in: [out.id, into.id] } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(out.id)?.transferAccountId).toBe(savings.id);
    expect(byId.get(into.id)?.transferAccountId).toBe(current.id);
    expect(rows.every((row) => row.categoryId === null)).toBe(true);
    expect(rows.every((row) => row.isCategoryConfirmed)).toBe(true);
  });

  test("changes only the pair's own rows", async () => {
    const { current, out, into } = await seedPair();
    const bystander = await tx(current.id, "2026-11-03", -9);

    await markPairsAsTransfer({ pairs: [{ outId: out.id, inId: into.id }] });

    const after = await prisma.transaction.findUniqueOrThrow({
      where: { id: bystander.id },
    });
    expect(after.transferAccountId).toBeNull();
  });

  test("leaves another user's rows untouched", async () => {
    await prisma.user.create({ data: { id: OTHER_USER } });
    const theirsA = await account("A", OTHER_USER);
    const theirsB = await account("B", OTHER_USER);
    const out = await tx(theirsA.id, "2026-11-03", -5, { userId: OTHER_USER });
    const into = await tx(theirsB.id, "2026-11-03", 5, { userId: OTHER_USER });

    const result = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toEqual({ updated: 0, skipped: 1, marked: [] });
    const rows = await prisma.transaction.findMany({
      where: { id: { in: [out.id, into.id] } },
    });
    expect(rows.every((row) => row.transferAccountId === null)).toBe(true);
  });

  test("skips a pair that no longer matches, and says so", async () => {
    const { out, into } = await seedPair();
    // Edited elsewhere since the page was drawn: no longer the same size.
    await prisma.transaction.update({
      where: { id: into.id },
      data: { amount: 199 },
    });

    const result = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toEqual({ updated: 0, skipped: 1, marked: [] });
    const rows = await prisma.transaction.findMany({
      where: { id: { in: [out.id, into.id] } },
    });
    expect(rows.every((row) => row.transferAccountId === null)).toBe(true);
  });

  test("skips a pair with a side in an archived account", async () => {
    const { savings, out, into } = await seedPair();
    await prisma.account.update({
      where: { id: savings.id },
      data: { deletedAt: new Date() },
    });

    const result = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toEqual({ updated: 0, skipped: 1, marked: [] });
  });
});

// Approving a pair is undone by handing back what markPairsAsTransfer said
// each row held. If either half is wrong, withdrawing an approval loses the
// category a row had, or leaves a transfer the user took back in their budget.
describe("markPairsAsTransfer then unmarkPairsAsTransfer (integration)", () => {
  test("marking says what each row held before", async () => {
    const { out, into } = await seedPair();
    const salary = await category("Salary");
    await prisma.transaction.update({
      where: { id: into.id },
      data: { categoryId: salary.id, isCategoryConfirmed: false },
    });

    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(marked).toEqual([
      {
        outId: out.id,
        inId: into.id,
        outBefore: UNTAGGED,
        inBefore: {
          categoryId: salary.id,
          transferAccountId: null,
          isCategoryConfirmed: false,
        },
      },
    ]);
  });

  test("withdrawing an approval leaves both rows uncategorised again", async () => {
    const { out, into } = await seedPair();
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    const result = await unmarkPairsAsTransfer({ pairs: marked });

    expect(result).toEqual({ restored: 1, skipped: [] });
    expect(await tagOf(out.id)).toEqual(UNTAGGED);
    expect(await tagOf(into.id)).toEqual(UNTAGGED);
  });

  test("a row that had a category gets it back, still in pencil", async () => {
    const { out, into } = await seedPair();
    const salary = await category("Salary");
    await prisma.transaction.update({
      where: { id: into.id },
      data: { categoryId: salary.id, isCategoryConfirmed: false },
    });
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    await unmarkPairsAsTransfer({ pairs: marked });

    expect(await tagOf(into.id)).toEqual({
      categoryId: salary.id,
      transferAccountId: null,
      isCategoryConfirmed: false,
    });
    expect(await tagOf(out.id)).toEqual(UNTAGGED);
  });

  test("a row that was a transfer to a third account gets that back", async () => {
    const { out, into } = await seedPair();
    const isa = await account("ISA");
    await prisma.transaction.update({
      where: { id: out.id },
      data: { transferAccountId: isa.id },
    });
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    await unmarkPairsAsTransfer({ pairs: marked });

    expect((await tagOf(out.id)).transferAccountId).toBe(isa.id);
  });

  test("a pair changed since it was approved is left alone, and reported", async () => {
    const { out, into, current } = await seedPair();
    const salary = await category("Salary");
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });
    // The user then filed one side themselves: that choice must survive.
    await prisma.transaction.update({
      where: { id: out.id },
      data: { categoryId: salary.id, transferAccountId: null },
    });

    const result = await unmarkPairsAsTransfer({ pairs: marked });

    expect(result).toEqual({
      restored: 0,
      skipped: [{ outId: out.id, inId: into.id }],
    });
    expect((await tagOf(out.id)).categoryId).toBe(salary.id);
    expect((await tagOf(into.id)).transferAccountId).toBe(current.id);
  });

  test("refreshes the budget and dashboard, whose totals it changes", async () => {
    const { out, into } = await seedPair();
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });
    jest.mocked(revalidatePath).mockClear();

    await unmarkPairsAsTransfer({ pairs: marked });

    for (const path of ["/transactions", "/budget", "/dashboard"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  test("leaves another user's rows untouched", async () => {
    await prisma.user.create({ data: { id: OTHER_USER } });
    const theirsA = await account("A", OTHER_USER);
    const theirsB = await account("B", OTHER_USER);
    const out = await tx(theirsA.id, "2026-11-03", -5, { userId: OTHER_USER });
    const into = await tx(theirsB.id, "2026-11-03", 5, { userId: OTHER_USER });
    await prisma.transaction.update({
      where: { id: out.id },
      data: { transferAccountId: theirsB.id },
    });
    await prisma.transaction.update({
      where: { id: into.id },
      data: { transferAccountId: theirsA.id },
    });

    const result = await unmarkPairsAsTransfer({
      pairs: [
        {
          outId: out.id,
          inId: into.id,
          outBefore: UNTAGGED,
          inBefore: UNTAGGED,
        },
      ],
    });

    expect(result.restored).toBe(0);
    expect((await tagOf(out.id)).transferAccountId).toBe(theirsB.id);
    expect((await tagOf(into.id)).transferAccountId).toBe(theirsA.id);
  });

  // The "before" travels through the browser, so it is checked like any
  // other input: a row may only go back to a category or account of the
  // user's own.
  test("will not put back a category that is not the user's", async () => {
    const { out, into, savings } = await seedPair();
    await prisma.user.create({ data: { id: OTHER_USER } });
    const theirs = await category("Theirs", OTHER_USER);
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    const result = await unmarkPairsAsTransfer({
      pairs: marked.map((pair) => ({
        ...pair,
        outBefore: { ...UNTAGGED, categoryId: theirs.id },
      })),
    });

    expect(result.restored).toBe(0);
    expect(await tagOf(out.id)).toEqual({
      ...UNTAGGED,
      transferAccountId: savings.id,
    });
  });

  test.each([
    ["another user's", "theirs"],
    ["archived", "archived"],
    ["the row's own", "own"],
  ] as const)(
    "will not put back a transfer to an account that is %s",
    async (_, which) => {
      const { out, into, current, savings } = await seedPair();
      await prisma.user.create({ data: { id: OTHER_USER } });
      const targets = {
        theirs: await account("Theirs", OTHER_USER),
        archived: await prisma.account.create({
          data: {
            userId: TEST_USER_ID,
            name: "Closed",
            deletedAt: new Date(),
            ...buildAccountData({ type: "CURRENT_ACCOUNT" }),
          },
        }),
        own: current,
      };
      const { marked } = await markPairsAsTransfer({
        pairs: [{ outId: out.id, inId: into.id }],
      });

      const result = await unmarkPairsAsTransfer({
        pairs: marked.map((pair) => ({
          ...pair,
          outBefore: { ...UNTAGGED, transferAccountId: targets[which].id },
        })),
      });

      expect(result.restored).toBe(0);
      expect((await tagOf(out.id)).transferAccountId).toBe(savings.id);
    },
  );

  // Such a row would match "To approve only" for good: nothing can approve it.
  test("refuses a row put back unconfirmed with no category", async () => {
    const { out, into, savings } = await seedPair();
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    await expect(
      unmarkPairsAsTransfer({
        pairs: marked.map((pair) => ({
          ...pair,
          outBefore: { ...UNTAGGED, isCategoryConfirmed: false },
        })),
      }),
    ).rejects.toThrow();
    expect(await tagOf(out.id)).toEqual({
      ...UNTAGGED,
      transferAccountId: savings.id,
    });
  });

  // Whatever is stored, marking must hand back something withdrawing accepts.
  test("a row with no category is reported as confirmed, so it can be put back", async () => {
    const { out, into } = await seedPair();
    await prisma.transaction.update({
      where: { id: out.id },
      data: { isCategoryConfirmed: false },
    });

    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(marked[0]?.outBefore).toEqual(UNTAGGED);
    expect((await unmarkPairsAsTransfer({ pairs: marked })).restored).toBe(1);
  });

  // The check and the write are one step: a save from another tab that lands
  // between them must not be overwritten, and a pair is written whole or not
  // at all.
  test("a pair edited in another tab while it is being marked is left alone", async () => {
    const { out, into } = await seedPair();

    const result = await whileUncommitted(
      (tx) =>
        tx.transaction.update({
          where: { id: into.id },
          data: { amount: 199 },
        }),
      () => markPairsAsTransfer({ pairs: [{ outId: out.id, inId: into.id }] }),
    );

    expect(result).toEqual({ updated: 0, skipped: 1, marked: [] });
    expect(await tagOf(out.id)).toEqual(UNTAGGED);
    expect(await tagOf(into.id)).toEqual(UNTAGGED);
  });

  test("a row re-filed in another tab while its approval is withdrawn keeps that choice", async () => {
    const { out, into, current } = await seedPair();
    const salary = await category("Salary");
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    const result = await whileUncommitted(
      (tx) =>
        tx.transaction.update({
          where: { id: out.id },
          data: { categoryId: salary.id, transferAccountId: null },
        }),
      () => unmarkPairsAsTransfer({ pairs: marked }),
    );

    expect(result).toEqual({
      restored: 0,
      skipped: [{ outId: out.id, inId: into.id }],
    });
    expect((await tagOf(out.id)).categoryId).toBe(salary.id);
    // The other row is not put back on its own.
    expect((await tagOf(into.id)).transferAccountId).toBe(current.id);
  });

  test("refuses a row put back as both a category and a transfer", async () => {
    const { out, into, savings } = await seedPair();
    const salary = await category("Salary");
    const isa = await account("ISA");
    const { marked } = await markPairsAsTransfer({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    await expect(
      unmarkPairsAsTransfer({
        pairs: marked.map((pair) => ({
          ...pair,
          outBefore: {
            categoryId: salary.id,
            transferAccountId: isa.id,
            isCategoryConfirmed: true,
          },
        })),
      }),
    ).rejects.toThrow();
    expect((await tagOf(out.id)).transferAccountId).toBe(savings.id);
  });
});

describe("possible transfers through the database (integration)", () => {
  test("rows in an archived account are not offered as a pair", async () => {
    const { savings } = await seedPair();
    await prisma.account.update({
      where: { id: savings.id },
      data: { deletedAt: new Date() },
    });

    expect(await pairsOnScreen()).toEqual([]);
  });

  test("editing a row brings its dismissed pair back", async () => {
    const { out, into } = await seedPair();
    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });
    expect(await pairsOnScreen()).toEqual([]);

    // Still within the window, so still a pair, but no longer the one hidden.
    await prisma.transaction.update({
      where: { id: into.id },
      data: { date: new Date("2026-11-05") },
    });

    expect(await pairsOnScreen()).toEqual([
      expect.objectContaining({ outId: out.id, inId: into.id }),
    ]);
  });

  test("hiding A–B leaves A free to pair with C", async () => {
    const { out, into } = await seedPair();
    const monzo = await account("Monzo");
    const other = await tx(monzo.id, "2026-11-05", 200);

    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });

    expect(await pairsOnScreen()).toEqual([
      expect.objectContaining({ outId: out.id, inId: other.id }),
    ]);
  });

  test("the hidden view lists a row once, however many pairs hid it", async () => {
    const { out, into } = await seedPair();
    const monzo = await account("Monzo");
    const other = await tx(monzo.id, "2026-11-05", 200);
    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });
    await dismissPairs({ pairs: [{ outId: out.id, inId: other.id }] });

    const hidden = await getTransactionsPage(TEST_USER_ID, {
      possibleTransfers: true,
      showHiddenPairs: true,
    });

    expect(hidden.pairs).toHaveLength(1);
    expect(new Set(hidden.items.map((row) => row.id)).size).toBe(
      hidden.items.length,
    );
  });
});

describe("dismissPairs / unhidePairs (integration)", () => {
  test("a dismissed pair stops showing, and unhiding brings it back", async () => {
    const { out, into } = await seedPair();
    const pair = { outId: out.id, inId: into.id };

    expect(await dismissPairs({ pairs: [pair] })).toEqual({
      ok: true,
      dismissed: 1,
      skipped: [],
    });
    expect(await pairsOnScreen()).toEqual([]);

    expect(await unhidePairs({ pairs: [pair] })).toEqual({ unhidden: 1 });
    expect(await pairsOnScreen()).toHaveLength(1);
  });

  test("stores a snapshot of both rows, in id order", async () => {
    const { current, savings, out, into } = await seedPair();

    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });

    const [first, second] = [out, into].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const stored = await prisma.dismissedTransferPair.findFirstOrThrow();
    expect(stored).toMatchObject({
      userId: TEST_USER_ID,
      firstId: first?.id,
      secondId: second?.id,
      firstAccountId: first?.id === out.id ? current.id : savings.id,
    });
  });

  test("the same pair sent twice in one request is stored once", async () => {
    const { out, into } = await seedPair();

    await dismissPairs({
      pairs: [
        { outId: out.id, inId: into.id },
        { outId: into.id, inId: out.id },
      ],
    });

    expect(await prisma.dismissedTransferPair.count()).toBe(1);
  });

  test("dismissing twice keeps one record", async () => {
    const { out, into } = await seedPair();
    const pair = { outId: out.id, inId: into.id };

    await dismissPairs({ pairs: [pair] });
    await dismissPairs({ pairs: [{ outId: into.id, inId: out.id }] });

    expect(await prisma.dismissedTransferPair.count()).toBe(1);
  });

  test("refuses two rows that are not a possible transfer, writing nothing", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    const out = await tx(current.id, "2026-11-03", -200);
    const unrelated = await tx(savings.id, "2026-11-03", 199);

    const result = await dismissPairs({
      pairs: [{ outId: out.id, inId: unrelated.id }],
    });

    expect(result).toEqual({
      ok: true,
      dismissed: 0,
      skipped: [{ outId: out.id, inId: unrelated.id }],
    });
    expect(await prisma.dismissedTransferPair.count()).toBe(0);
  });

  test("a dismissal that stored nothing still refreshes the ledger", async () => {
    // Otherwise rows hidden optimistically would stay hidden until the next
    // navigation, with nothing stored behind them.
    const current = await account("Current");
    const savings = await account("Savings");
    const out = await tx(current.id, "2026-11-03", -200);
    const unrelated = await tx(savings.id, "2026-11-03", 199);
    jest.mocked(revalidatePath).mockClear();

    await dismissPairs({ pairs: [{ outId: out.id, inId: unrelated.id }] });

    expect(revalidatePath).toHaveBeenCalledWith("/transactions");
  });

  test("will not store a pair of another user's rows", async () => {
    await prisma.user.create({ data: { id: OTHER_USER } });
    const a = await account("A", OTHER_USER);
    const b = await account("B", OTHER_USER);
    const out = await tx(a.id, "2026-11-03", -5, { userId: OTHER_USER });
    const into = await tx(b.id, "2026-11-03", 5, { userId: OTHER_USER });

    const result = await dismissPairs({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toMatchObject({ ok: true, dismissed: 0 });
    expect(await prisma.dismissedTransferPair.count()).toBe(0);
  });

  test("will not unhide another user's pair", async () => {
    await prisma.user.create({ data: { id: OTHER_USER } });
    const a = await account("A", OTHER_USER);
    const b = await account("B", OTHER_USER);
    const out = await tx(a.id, "2026-11-03", -5, { userId: OTHER_USER });
    const into = await tx(b.id, "2026-11-03", 5, { userId: OTHER_USER });
    const [first, second] = [out, into].sort((x, y) => (x.id < y.id ? -1 : 1));
    await prisma.dismissedTransferPair.create({
      data: {
        userId: OTHER_USER,
        firstId: first?.id ?? "",
        secondId: second?.id ?? "",
        firstAmount: Number(first?.amount),
        firstDate: new Date("2026-11-03"),
        firstAccountId: first?.accountId ?? "",
        secondAmount: Number(second?.amount),
        secondDate: new Date("2026-11-03"),
        secondAccountId: second?.accountId ?? "",
      },
    });

    const result = await unhidePairs({
      pairs: [{ outId: out.id, inId: into.id }],
    });

    expect(result).toEqual({ unhidden: 0 });
    expect(await prisma.dismissedTransferPair.count()).toBe(1);
  });

  test("a dismissal whose row was edited is cleared at the next one", async () => {
    // It no longer hides anything, so it must not linger or count to the cap.
    const { out, into } = await seedPair();
    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });
    await prisma.transaction.update({
      where: { id: into.id },
      data: { date: new Date("2026-11-05") },
    });
    const monzo = await account("Monzo");
    const other = await tx(monzo.id, "2026-11-01", -50);
    const back = await tx(into.accountId, "2026-11-01", 50);

    await dismissPairs({ pairs: [{ outId: other.id, inId: back.id }] });

    const stored = await prisma.dismissedTransferPair.findMany();
    expect(stored.map((d) => [d.firstId, d.secondId].sort())).toEqual([
      [other.id, back.id].sort(),
    ]);
  });

  test("refuses past the per-user cap, writing nothing", async () => {
    const { current, savings, out, into } = await seedPair();
    // The cap counts records, whatever they name: fill it with a cross join
    // of 100 x 100 real rows, as the foreign keys require.
    await prisma.$executeRaw`
      INSERT INTO "Transaction" (id, "userId", "accountId", date, amount, description, "updatedAt")
      SELECT gen_random_uuid(), ${TEST_USER_ID}::uuid, a.id, '2020-01-01', -1, 'filler', now()
      FROM "Account" a, generate_series(1, 100)
      WHERE a.id IN (${current.id}::uuid, ${savings.id}::uuid)`;
    await prisma.$executeRaw`
      INSERT INTO "DismissedTransferPair"
        (id, "userId", "firstId", "secondId", "firstAmount", "firstDate",
         "firstAccountId", "secondAmount", "secondDate", "secondAccountId")
      SELECT gen_random_uuid(), ${TEST_USER_ID}::uuid, f.id, s.id, -1,
             '2020-01-01', f."accountId", -1, '2020-01-01', s."accountId"
      FROM "Transaction" f, "Transaction" s
      WHERE f.description = 'filler' AND s.description = 'filler'
        AND f."accountId" = ${current.id}::uuid
        AND s."accountId" = ${savings.id}::uuid
      LIMIT ${MAX_DISMISSED_PAIRS_PER_USER}`;
    expect(await prisma.dismissedTransferPair.count()).toBe(
      MAX_DISMISSED_PAIRS_PER_USER,
    );

    expect(
      await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] }),
    ).toEqual({ ok: false, reason: expect.stringMatching(/hidden pairs/) });
    expect(
      await prisma.dismissedTransferPair.count({
        where: { OR: [{ firstId: out.id }, { secondId: out.id }] },
      }),
    ).toBe(0);
  });

  test("refreshing a pair already hidden is not refused at the cap", async () => {
    const { out, into } = await seedPair();
    const pair = { outId: out.id, inId: into.id };
    await dismissPairs({ pairs: [pair] });
    const filler = await account("Filler");
    // One short of the cap besides the pair itself, all still live.
    await prisma.$executeRaw`
      INSERT INTO "Transaction" (id, "userId", "accountId", date, amount, description, "updatedAt")
      SELECT gen_random_uuid(), ${TEST_USER_ID}::uuid, ${filler.id}::uuid, '2020-01-01', -1, 'filler', now()
      FROM generate_series(1, 150)`;
    await prisma.$executeRaw`
      INSERT INTO "DismissedTransferPair"
        (id, "userId", "firstId", "secondId", "firstAmount", "firstDate",
         "firstAccountId", "secondAmount", "secondDate", "secondAccountId")
      SELECT gen_random_uuid(), ${TEST_USER_ID}::uuid, f.id, s.id, -1,
             '2020-01-01', f."accountId", -1, '2020-01-01', s."accountId"
      FROM "Transaction" f, "Transaction" s
      WHERE f.description = 'filler' AND s.description = 'filler' AND f.id < s.id
      LIMIT ${MAX_DISMISSED_PAIRS_PER_USER - 1}`;
    expect(await prisma.dismissedTransferPair.count()).toBe(
      MAX_DISMISSED_PAIRS_PER_USER,
    );

    expect(await dismissPairs({ pairs: [pair] })).toMatchObject({
      ok: true,
      dismissed: 1,
    });
  });

  test("deleting a row removes the dismissal that named it", async () => {
    const { out, into } = await seedPair();
    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });

    await bulkDeleteTransactions({ transactionIds: [into.id] });

    expect(await prisma.dismissedTransferPair.count()).toBe(0);
  });

  test("undoing an import removes the dismissals naming its rows", async () => {
    const current = await account("Current");
    const savings = await account("Savings");
    const batch = await prisma.importBatch.create({
      data: { userId: TEST_USER_ID, accountId: savings.id },
    });
    const out = await tx(current.id, "2026-11-03", -200);
    const into = await tx(savings.id, "2026-11-03", 200, {
      importBatchId: batch.id,
    });
    await dismissPairs({ pairs: [{ outId: out.id, inId: into.id }] });

    await reverseImport({ batchId: batch.id });

    expect(await prisma.dismissedTransferPair.count()).toBe(0);
  });
});
